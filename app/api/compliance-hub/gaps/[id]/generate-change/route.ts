import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  complianceGaps,
  controlChanges,
  regulatoryRequirements,
  regulatorySources,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Fetch the gap
    const gap = db
      .select()
      .from(complianceGaps)
      .where(eq(complianceGaps.id, id))
      .get()
    if (!gap) {
      return NextResponse.json({ error: 'Gap not found' }, { status: 404 })
    }

    // 2. Fetch the linked requirement
    const requirement = db
      .select()
      .from(regulatoryRequirements)
      .where(eq(regulatoryRequirements.id, gap.requirementId))
      .get()
    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
    }

    // 3. Fetch the linked regulatory source (for shortCode)
    const source = db
      .select()
      .from(regulatorySources)
      .where(eq(regulatorySources.id, gap.sourceId))
      .get()
    if (!source) {
      return NextResponse.json({ error: 'Regulatory source not found' }, { status: 404 })
    }

    // 4. Call AI
    const ai = getAiProvider()
    const proposal = await ai.generateControlChange(
      {
        title: gap.title,
        description: gap.description,
        severity: gap.severity,
        gapType: gap.gapType,
        aiAnalysis: gap.aiAnalysis,
      },
      {
        articleRef: requirement.articleRef,
        title: requirement.title,
        description: requirement.description,
        obligationType: requirement.obligationType,
      },
      source.shortCode
    )

    // 5. Create the control change record
    const controlChangeId = `CC-AI-${Date.now()}`
    const now = new Date().toISOString()

    const controlChange = {
      id: controlChangeId,
      gapId: gap.id,
      requirementId: gap.requirementId,
      title: proposal.title,
      description: proposal.description,
      changeType: proposal.changeType,
      status: 'DRAFT' as const,
      proposedAt: now,
      proposedChanges: JSON.stringify(proposal.proposedChanges),
      aiGenerated: true,
    }
    db.insert(controlChanges).values(controlChange).run()

    // 6. Update gap status to IN_ANALYSIS
    db.update(complianceGaps)
      .set({ status: 'IN_ANALYSIS' })
      .where(eq(complianceGaps.id, id))
      .run()

    return NextResponse.json({
      ok: true,
      controlChange,
      proposal,
    })
  } catch (err) {
    console.error('[Generate Control Change]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
