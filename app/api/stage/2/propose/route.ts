import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { applications, controlActivities, iacChanges, auditEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'
import { transition, getCurrentState } from '@/lib/state-machine'
import { randomUUID } from 'crypto'

export async function POST() {
  try {
    const { state, correlationId } = await getCurrentState()
    if (state !== 'STANDARD_APPROVED') {
      return NextResponse.json({ error: `Cannot propose IaC in state ${state}` }, { status: 400 })
    }

    const app = db.select().from(applications).where(eq(applications.id, 'APP-X-001')).get()
    const control = db.select().from(controlActivities).where(eq(controlActivities.id, 'CA-BR0039-GR')).get()
    if (!app || !control) return NextResponse.json({ error: 'App or control not found' }, { status: 404 })

    const ai = getAiProvider()
    const iacProposal = await ai.generateIacProposal(app.id, app.name, control.code)

    const commitSha = randomUUID().slice(0, 8)
    const prNumber = `PR-${Math.floor(Math.random() * 900) + 100}`
    const iacId = randomUUID()

    db.insert(iacChanges).values({
      id: iacId,
      applicationId: 'APP-X-001',
      controlActivityId: 'CA-BR0039-GR',
      branchName: iacProposal.branchName,
      commitSha,
      prNumber,
      author: `ai:${iacProposal.provenance.provider}`,
      status: 'open',
      diffContent: iacProposal.diffContent,
    }).run()

    db.insert(auditEvents).values({
      id: randomUUID(),
      actor: `ai:${iacProposal.provenance.provider}:${iacProposal.provenance.model}`,
      action: 'IAC_CHANGE_GENERATED',
      objectType: 'IacChange',
      objectId: iacId,
      outcome: 'success',
      correlationId,
      metadata: JSON.stringify({
        prNumber,
        commitSha,
        branchName: iacProposal.branchName,
        provenance: iacProposal.provenance,
      }),
    }).run()

    const txResult = await transition('IAC_PR_CREATED', `ai:${iacProposal.provenance.model}`)
    if (!txResult.ok) return NextResponse.json({ error: txResult.error }, { status: 400 })

    return NextResponse.json({ ok: true, newState: txResult.newState, iacProposal, iacId, commitSha, prNumber })
  } catch (err) {
    console.error('[Stage 2 Propose]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
