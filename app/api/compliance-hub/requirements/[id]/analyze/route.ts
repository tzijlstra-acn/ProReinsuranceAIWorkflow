import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  complianceGaps,
  regulatoryRequirements,
  regulatorySources,
  requirementDocumentMappings,
  internalDocuments,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Fetch the requirement
    const requirement = db
      .select()
      .from(regulatoryRequirements)
      .where(eq(regulatoryRequirements.id, id))
      .get()
    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
    }

    // 2. Fetch the regulatory source (for context / sourceId)
    const source = db
      .select()
      .from(regulatorySources)
      .where(eq(regulatorySources.id, requirement.sourceId))
      .get()

    // 3. Fetch all requirement_document_mappings for this requirement
    const mappings = db
      .select()
      .from(requirementDocumentMappings)
      .where(eq(requirementDocumentMappings.requirementId, id))
      .all()

    // 4. Fetch linked internal documents
    const documentIds = mappings.map(m => m.documentId)
    const docs = documentIds.length > 0
      ? db
          .select()
          .from(internalDocuments)
          .all()
          .filter(d => documentIds.includes(d.id))
      : []

    // 5. Call AI
    const ai = getAiProvider()
    const result = await ai.analyzeComplianceGaps(
      {
        articleRef: requirement.articleRef,
        title: requirement.title,
        description: requirement.description,
        obligationType: requirement.obligationType,
        obligationLevel: requirement.obligationLevel,
      },
      docs.map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
        content: d.content,
        status: d.status,
      }))
    )

    // 6. Persist each gap
    const createdGaps: typeof complianceGaps.$inferInsert[] = []
    const now = new Date().toISOString()

    result.gaps.forEach((gap, index) => {
      const gapId = `GAP-AI-${Date.now()}-${index}`
      const row = {
        id: gapId,
        requirementId: id,
        sourceId: requirement.sourceId,
        title: gap.title,
        description: gap.description,
        severity: gap.severity,
        gapType: gap.gap_type,
        status: 'OPEN' as const,
        detectedAt: now,
        affectedDocumentIds: JSON.stringify(gap.affectedDocumentIds),
        aiAnalysis: gap.aiAnalysis,
      }
      db.insert(complianceGaps).values(row).run()
      createdGaps.push(row)
    })

    // 7. Update coverage_status on all mappings
    mappings.forEach(mapping => {
      db.update(requirementDocumentMappings)
        .set({ coverageStatus: result.coverageStatus })
        .where(eq(requirementDocumentMappings.id, mapping.id))
        .run()
    })

    return NextResponse.json({
      ok: true,
      gaps: createdGaps,
      coverageStatus: result.coverageStatus,
      coverageNotes: result.coverageNotes,
      provenance: result.provenance,
    })
  } catch (err) {
    console.error('[Analyze Compliance Gaps]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
