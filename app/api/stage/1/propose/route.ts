import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulationSources, guidelineVersions, controlActivities, auditEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'
import { transition, getCurrentState } from '@/lib/state-machine'
import { randomUUID } from 'crypto'

export async function POST() {
  try {
    const { state, correlationId } = await getCurrentState()

    if (state === 'STANDARD_PROPOSED') {
      // Already proposed — idempotent success (concurrent execution already completed this step)
      return NextResponse.json({ ok: true, newState: 'STANDARD_PROPOSED', idempotent: true })
    }
    if (state !== 'BASELINE') {
      return NextResponse.json({ error: `Cannot propose in state ${state}` }, { status: 400 })
    }

    // Load regulation fixture
    const regSource = db.select().from(regulationSources).where(eq(regulationSources.id, 'DORA-ART-12')).get()
    if (!regSource) return NextResponse.json({ error: 'Regulation source not found' }, { status: 404 })

    const regulation = JSON.parse(regSource.fixture)

    // Load current guideline content
    const currentGv = db.select().from(guidelineVersions).where(eq(guidelineVersions.id, 'GLV-BR-001-v32')).get()
    if (!currentGv) return NextResponse.json({ error: 'Current guideline not found' }, { status: 404 })

    const ai = getAiProvider()

    // Generate guideline proposal
    const guidelineProposal = await ai.deriveGuidelineProposal(regulation, currentGv.content)

    // Generate control activity proposal
    const controlProposal = await ai.deriveControlActivity(regulation, guidelineProposal)

    // Persist guideline proposal (update v3.3 proposed content)
    db.update(guidelineVersions)
      .set({ proposedContent: guidelineProposal.proposedContent, status: 'proposed' })
      .where(eq(guidelineVersions.id, 'GLV-BR-001-v33'))
      .run()

    // Persist control activity proposal
    db.update(controlActivities)
      .set({
        title: controlProposal.title,
        objective: controlProposal.objective,
        implementationStatement: controlProposal.implementationStatement,
        scope: controlProposal.scope,
        frequency: controlProposal.frequency,
        ownerRole: controlProposal.ownerRole,
        evidenceRequirements: controlProposal.evidenceRequirements,
        automatedTestLogic: controlProposal.automatedTestLogic,
        exceptionLogic: controlProposal.exceptionLogic,
        status: 'proposed',
      })
      .where(eq(controlActivities.id, 'CA-BR0039-GR'))
      .run()

    // Audit event
    db.insert(auditEvents).values({
      id: randomUUID(),
      actor: `ai:${guidelineProposal.provenance.provider}:${guidelineProposal.provenance.model}`,
      action: 'STAGE1_PROPOSAL_GENERATED',
      objectType: 'GuidelineVersion',
      objectId: 'GLV-BR-001-v33',
      outcome: 'success',
      correlationId,
      metadata: JSON.stringify({
        guidelineProvenance: guidelineProposal.provenance,
        controlProvenance: controlProposal.provenance,
        changeSummary: guidelineProposal.changeSummary,
      }),
    }).run()

    // Transition state
    const txResult = await transition('STANDARD_PROPOSED', `ai:${guidelineProposal.provenance.model}`)
    if (!txResult.ok) return NextResponse.json({ error: txResult.error }, { status: 400 })

    return NextResponse.json({
      ok: true,
      newState: txResult.newState,
      guidelineProposal,
      controlProposal,
    })
  } catch (err) {
    console.error('[Stage 1 Propose]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
