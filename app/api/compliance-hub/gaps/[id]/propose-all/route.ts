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

    // Affected documents
    const mappings = db.select().from(requirementDocumentMappings).all()
      .filter(m => m.requirementId === gap.requirementId)
    const docIds = [...new Set(mappings.map(m => m.documentId))]
    const allDocs = db.select().from(internalDocuments).all()
    const affectedDocs = docIds.length > 0 ? allDocs.filter(d => docIds.includes(d.id)) : []

    // Find most recent published control for this requirement (the live baseline)
    const publishedControls = db.select().from(controlChanges).all()
      .filter(c => c.requirementId === gap.requirementId && c.status === 'PUBLISHED')
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    const existingPublished = publishedControls[0] ?? null

    let existingControl: { id: string; title: string; description: string; steps: string[]; acceptanceCriteria: string[] } | null = null
    if (existingPublished) {
      try {
        const pc = JSON.parse(existingPublished.proposedChanges ?? '{}') as Record<string, unknown>
        existingControl = {
          id: existingPublished.id,
          title: existingPublished.title,
          description: existingPublished.description,
          steps: Array.isArray(pc.steps) ? (pc.steps as unknown[]).map(String) : [],
          acceptanceCriteria: Array.isArray(pc.acceptanceCriteria) ? (pc.acceptanceCriteria as unknown[]).map(String) : [],
        }
      } catch { /* use null if JSON fails */ }
    }

    const linked = await ai.proposeLinkedChanges(
      { title: gap.title, description: gap.description, severity: gap.severity, gapType: gap.gapType, aiAnalysis: gap.aiAnalysis },
      { articleRef: requirement.articleRef, title: requirement.title, description: requirement.description, obligationType: requirement.obligationType },
      source.shortCode,
      affectedDocs.map(d => ({ id: d.id, title: d.title, type: d.type, content: d.content })),
      existingControl
    )

    const controlChangeId = `CC-REVIEW-${Date.now()}`
    const now = new Date().toISOString()

    db.insert(controlChanges).values({
      id: controlChangeId,
      gapId: gap.id,
      requirementId: gap.requirementId,
      title: linked.control.title,
      description: linked.control.description,
      changeType: linked.control.changeType,
      status: 'DRAFT',
      proposedAt: now,
      proposedChanges: JSON.stringify({
        summary: linked.control.description,
        steps: linked.control.steps,
        documentsToUpdate: linked.documents.map(d => d.documentTitle),
        technicalChanges: '',
        acceptanceCriteria: linked.control.acceptanceCriteria,
        trigger: linked.trigger,
        existingControlId: existingControl?.id ?? null,
        documentUpdates: linked.documents.map(d => ({
          documentId: d.documentId,
          documentTitle: d.documentTitle,
          proposedContent: d.proposedContent,
          changeSummary: d.changeSummary,
        })),
      }),
      aiGenerated: true,
    }).run()

    db.update(complianceGaps)
      .set({ status: 'IN_ANALYSIS' })
      .where(eq(complianceGaps.id, id))
      .run()

    return NextResponse.json({
      ok: true,
      controlChangeId,
      trigger: linked.trigger,
      control: linked.control,
      documents: linked.documents,
    })
  } catch (err) {
    console.error('[Propose All]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
