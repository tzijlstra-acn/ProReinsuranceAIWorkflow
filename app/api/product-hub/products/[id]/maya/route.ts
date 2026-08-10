import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  controlChanges,
  complianceGaps,
  regulatoryRequirements,
  regulatorySources,
  internalDocuments,
  requirementDocumentMappings,
  productWorkProducts,
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
    const { controlChangeId } = await req.json() as { controlChangeId: string }

    const product = db.select().from(products).where(eq(products.id, productId)).get()
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const cc = db.select().from(controlChanges).where(eq(controlChanges.id, controlChangeId)).get()
    if (!cc) return NextResponse.json({ error: 'Control change not found' }, { status: 404 })

    const requirement = db.select().from(regulatoryRequirements)
      .where(eq(regulatoryRequirements.id, cc.requirementId)).get()
    if (!requirement) return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })

    const source = db.select().from(regulatorySources)
      .where(eq(regulatorySources.id, requirement.sourceId)).get()

    const gap = cc.gapId
      ? db.select().from(complianceGaps).where(eq(complianceGaps.id, cc.gapId)).get()
      : null

    const mappings = db.select().from(requirementDocumentMappings).all()
      .filter(m => m.requirementId === cc.requirementId)
    const docIds = [...new Set(mappings.map(m => m.documentId))]
    const allDocs = db.select().from(internalDocuments).all()
    const linkedDocs = docIds.length > 0 ? allDocs.filter(d => docIds.includes(d.id)) : []

    if (linkedDocs.length === 0) {
      return NextResponse.json({ error: 'No documents linked to this requirement' }, { status: 400 })
    }

    const ai = getAiProvider()
    const gapData = {
      title: gap?.title ?? cc.title,
      description: gap?.description ?? cc.description,
      severity: (gap?.severity ?? 'MEDIUM') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
      gapType: gap?.gapType ?? 'DOCUMENTATION_GAP',
      aiAnalysis: gap?.aiAnalysis ?? null,
    }
    const reqData = {
      articleRef: requirement.articleRef,
      title: requirement.title,
      description: requirement.description,
    }
    const shortCode = source?.shortCode ?? 'UNKNOWN'

    const created: { id: string; title: string; status: string }[] = []
    const now = new Date().toISOString()

    for (const doc of linkedDocs) {
      const proposal = await ai.proposeDocumentUpdate(gapData, reqData, {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        content: doc.content,
      }, shortCode)

      const wpId = `WP-MAYA-${productId.slice(-4)}-${doc.id.slice(-6)}-${Date.now()}`
      db.insert(productWorkProducts).values({
        id: wpId,
        productId,
        definitionId: 'MAYA',
        requirementId: cc.requirementId,
        title: `Document Update: ${doc.title}`,
        status: 'PROPOSED',
        content: JSON.stringify({
          controlChangeId,
          documentId: doc.id,
          documentTitle: doc.title,
          documentType: doc.type,
          proposedContent: proposal.proposedContent,
          changeSummary: proposal.changeSummary,
          addedClauses: proposal.addedClauses,
        }),
        documentId: doc.id,
        createdAt: now,
        updatedAt: now,
      }).run()

      created.push({ id: wpId, title: `Document Update: ${doc.title}`, status: 'PROPOSED' })
    }

    return NextResponse.json({ ok: true, workProducts: created })
  } catch (err) {
    console.error('[product-hub/maya]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
