import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  regulatoryRequirements,
  internalDocuments,
  requirementDocumentMappings,
  productGaps,
  products,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const { requirementId } = await req.json() as { requirementId: string }

    const product = db.select().from(products).where(eq(products.id, productId)).get()
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const requirement = db.select().from(regulatoryRequirements)
      .where(eq(regulatoryRequirements.id, requirementId)).get()
    if (!requirement) return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })

    const mappings = db.select().from(requirementDocumentMappings).all()
      .filter(m => m.requirementId === requirementId)
    const docIds = [...new Set(mappings.map(m => m.documentId))]
    const allDocs = db.select().from(internalDocuments).all()
    const linkedDocs = docIds.length > 0
      ? allDocs.filter(d => docIds.includes(d.id)).map(d => ({
          id: d.id,
          title: d.title,
          type: d.type,
          content: d.content,
          status: d.status,
        }))
      : []

    const ai = getAiProvider()
    const result = await ai.analyzeComplianceGaps(
      {
        articleRef: requirement.articleRef,
        title: requirement.title,
        description: requirement.description,
        obligationType: requirement.obligationType,
        obligationLevel: requirement.obligationLevel,
      },
      linkedDocs
    )

    const now = new Date().toISOString()
    const created: { id: string; title: string; severity: string; status: string }[] = []

    for (const gap of result.gaps) {
      const gapId = `PG-MITRA-${productId.slice(-4)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const validTypes = ['CONFIGURATION', 'DOCUMENTATION', 'PROCESS', 'APPROVAL'] as const
      type ValidGapType = typeof validTypes[number]
      const validGapType: ValidGapType = (validTypes as readonly string[]).includes(gap.gap_type)
        ? gap.gap_type as ValidGapType
        : 'PROCESS'

      db.insert(productGaps).values({
        id: gapId,
        productId,
        requirementId,
        controlChangeId: null,
        title: gap.title,
        description: gap.description,
        gapType: validGapType,
        severity: gap.severity,
        status: 'OPEN',
        detectedAt: now,
        resolvedAt: null,
        createdAt: now,
      }).run()
      created.push({ id: gapId, title: gap.title, severity: gap.severity, status: 'OPEN' })
    }

    return NextResponse.json({
      ok: true,
      gaps: created,
      coverageStatus: result.coverageStatus,
      coverageNotes: result.coverageNotes,
    })
  } catch (err) {
    console.error('[product-hub/mitra]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
