import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  regulatoryVersions,
  regulatorySources,
  regulatoryRequirements,
  internalDocuments,
  requirementDocumentMappings,
  complianceGaps,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params

    // 1. Fetch the regulatory version
    const version = db
      .select()
      .from(regulatoryVersions)
      .where(eq(regulatoryVersions.id, versionId))
      .get()
    if (!version) {
      return NextResponse.json({ error: 'Regulatory version not found' }, { status: 404 })
    }

    // 2. Fetch the regulatory source
    const source = db
      .select()
      .from(regulatorySources)
      .where(eq(regulatorySources.id, version.sourceId))
      .get()
    if (!source) {
      return NextResponse.json({ error: 'Regulatory source not found' }, { status: 404 })
    }

    // 3. Fetch all requirements for this source
    const requirements = db
      .select()
      .from(regulatoryRequirements)
      .where(eq(regulatoryRequirements.sourceId, version.sourceId))
      .all()

    // 4. Fetch all requirement_document_mappings for these requirements to find relevant docs
    const requirementIds = requirements.map(r => r.id)
    const allMappings = requirementIds.length > 0
      ? db
          .select()
          .from(requirementDocumentMappings)
          .all()
          .filter(m => requirementIds.includes(m.requirementId))
      : []

    const relevantDocIds = [...new Set(allMappings.map(m => m.documentId))]

    // 5. Fetch all internal documents (all for context, prioritising the relevant ones)
    const allDocs = db.select().from(internalDocuments).all()
    const docs = relevantDocIds.length > 0
      ? allDocs.filter(d => relevantDocIds.includes(d.id))
      : allDocs

    // 6. Call AI
    const ai = getAiProvider()
    const result = await ai.analyzeRegulatoryDelta(
      version.changeSummary ?? '',
      source.shortCode,
      requirements.map(r => ({
        id: r.id,
        articleRef: r.articleRef,
        title: r.title,
        description: r.description,
      })),
      docs.map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
        content: d.content,
      }))
    )

    // 7. Insert each new gap into compliance_gaps
    const now = new Date().toISOString()
    let gapsCreated = 0

    result.newGaps.forEach((gap, index) => {
      const gapId = `GAP-RD-${Date.now()}-${index}`
      db.insert(complianceGaps).values({
        id: gapId,
        requirementId: gap.requirementId,
        sourceId: version.sourceId,
        title: gap.title,
        description: gap.description,
        severity: gap.severity,
        gapType: gap.gap_type,
        status: 'OPEN',
        detectedAt: now,
        affectedDocumentIds: '[]',
        aiAnalysis: gap.aiAnalysis,
        createdAt: now,
      }).run()
      gapsCreated++
    })

    // 8. Mark the regulatory version as is_active = true (reviewed and acknowledged)
    db.update(regulatoryVersions)
      .set({ isActive: true })
      .where(eq(regulatoryVersions.id, versionId))
      .run()

    return NextResponse.json({ ok: true, analysis: result, gapsCreated })
  } catch (err) {
    console.error('[Regulatory Updates Analyze]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
