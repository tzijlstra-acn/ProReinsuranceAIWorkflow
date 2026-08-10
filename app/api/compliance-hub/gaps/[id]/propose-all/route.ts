import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  complianceGaps,
  controlChanges,
  regulatoryRequirements,
  regulatorySources,
  internalDocuments,
  requirementDocumentMappings,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'

// Generates a control change proposal + document update proposals for a gap.
// Stores as a DRAFT control_change with documentUpdates embedded in proposedChanges JSON.
// Returns the full before/after state for the review UI.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ai = getAiProvider()

    const gap = db.select().from(complianceGaps).where(eq(complianceGaps.id, id)).get()
    if (!gap) return NextResponse.json({ error: 'Gap not found' }, { status: 404 })

    const requirement = db.select().from(regulatoryRequirements).where(eq(regulatoryRequirements.id, gap.requirementId)).get()
    if (!requirement) return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })

    const source = db.select().from(regulatorySources).where(eq(regulatorySources.id, gap.sourceId)).get()
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

    // Find the documents mapped to this requirement
    const mappings = db.select().from(requirementDocumentMappings).all()
      .filter(m => m.requirementId === gap.requirementId)
    const docIds = [...new Set(mappings.map(m => m.documentId))]
    const allDocs = db.select().from(internalDocuments).all()
    const affectedDocs = docIds.length > 0
      ? allDocs.filter(d => docIds.includes(d.id))
      : []

    // 1. Generate control change proposal (existing AI method)
    const controlProposal = await ai.generateControlChange(
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

    // 2. Generate document update proposals (one per affected document)
    const documentUpdates: Array<{
      documentId: string
      documentTitle: string
      currentContent: string
      proposedContent: string
      changeSummary: string
      addedClauses: string[]
    }> = []

    for (const doc of affectedDocs) {
      try {
        const docProposal = await ai.proposeDocumentUpdate(
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
          },
          doc,
          source.shortCode
        )
        documentUpdates.push({
          documentId: docProposal.documentId,
          documentTitle: docProposal.documentTitle,
          currentContent: docProposal.currentContent,
          proposedContent: docProposal.proposedContent,
          changeSummary: docProposal.changeSummary,
          addedClauses: docProposal.addedClauses,
        })
      } catch {
        // skip individual document failures
      }
    }

    // 3. Store control change as DRAFT with documentUpdates embedded
    const controlChangeId = `CC-REVIEW-${Date.now()}`
    const now = new Date().toISOString()

    const proposedChangesPayload = {
      ...controlProposal.proposedChanges,
      documentUpdates,
    }

    db.insert(controlChanges).values({
      id: controlChangeId,
      gapId: gap.id,
      requirementId: gap.requirementId,
      title: controlProposal.title,
      description: controlProposal.description,
      changeType: controlProposal.changeType,
      status: 'DRAFT',
      proposedAt: now,
      proposedChanges: JSON.stringify(proposedChangesPayload),
      aiGenerated: true,
    }).run()

    // 4. Transition gap to IN_ANALYSIS
    db.update(complianceGaps)
      .set({ status: 'IN_ANALYSIS' })
      .where(eq(complianceGaps.id, id))
      .run()

    return NextResponse.json({
      ok: true,
      controlChangeId,
      gap: {
        id: gap.id,
        title: gap.title,
        severity: gap.severity,
        gapType: gap.gapType,
        requirementRef: requirement.articleRef,
        requirementTitle: requirement.title,
        sourceShortCode: source.shortCode,
        aiAnalysis: gap.aiAnalysis,
      },
      controlProposal: {
        title: controlProposal.title,
        description: controlProposal.description,
        changeType: controlProposal.changeType,
        estimatedEffort: controlProposal.estimatedEffort,
        proposedChanges: controlProposal.proposedChanges,
      },
      documentUpdates,
    })
  } catch (err) {
    console.error('[Propose All]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
