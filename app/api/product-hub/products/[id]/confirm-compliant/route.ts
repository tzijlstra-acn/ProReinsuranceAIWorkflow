import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  products,
  productApplicability,
  productGaps,
  productWorkProducts,
  verificationCriteria,
  verificationResults,
  evidencePackages,
  requirementStatusHistory,
  ddcrReportingRecords,
  ddcrItems,
  regulatorySources,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { recomputeAggregates } from '@/lib/domain/ddcr/status-engine'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const { requirementId, sourceId, approvedBy } = await req.json() as {
      requirementId: string
      sourceId: string
      approvedBy: string
    }

    if (!requirementId || !sourceId || !approvedBy?.trim()) {
      return NextResponse.json({ error: 'requirementId, sourceId and approvedBy are required' }, { status: 400 })
    }

    const product = db.select().from(products).where(eq(products.id, productId)).get()
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const applicability = db.select().from(productApplicability).all()
      .find(a => a.productId === productId && a.requirementId === requirementId)
    if (!applicability?.applicable) {
      return NextResponse.json({ error: 'Requirement not applicable to this product' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // 1. Resolve all open product gaps for this product × requirement
    const openGaps = db.select().from(productGaps)
      .where(and(eq(productGaps.productId, productId), eq(productGaps.requirementId, requirementId)))
      .all()
      .filter(g => g.status !== 'RESOLVED')

    for (const gap of openGaps) {
      db.update(productGaps)
        .set({ status: 'RESOLVED', resolvedAt: now })
        .where(eq(productGaps.id, gap.id))
        .run()
    }

    // 2. Get work products (evidence artifacts)
    const workProducts = db.select().from(productWorkProducts)
      .where(and(eq(productWorkProducts.productId, productId), eq(productWorkProducts.requirementId, requirementId)))
      .all()
    const artifactIds = workProducts.map(wp => wp.id)

    // 3. Create PASSED verification results for all criteria
    const criteria = db.select().from(verificationCriteria)
      .where(eq(verificationCriteria.requirementId, requirementId))
      .all()

    const verResultIds: string[] = []
    for (const criterion of criteria) {
      const vrId = `VR-CONFIRM-${randomUUID().slice(0, 8)}`
      db.insert(verificationResults).values({
        id: vrId,
        criterionId: criterion.id,
        productId,
        requirementId,
        status: 'PASSED',
        notes: `Verification passed after AI-assisted remediation. Approved by ${approvedBy}.`,
        verifiedAt: now,
      }).run()
      verResultIds.push(vrId)
    }

    // 4. Create a COMPLETE evidence package
    const epId = `EP-CONFIRM-${randomUUID().slice(0, 8)}`
    db.insert(evidencePackages).values({
      id: epId,
      productId,
      requirementId,
      status: 'COMPLETE',
      verificationResultIds: JSON.stringify(verResultIds),
      evidenceArtifactIds: JSON.stringify(artifactIds),
      assembledAt: now,
      approvedAt: now,
      approvedBy,
      createdAt: now,
    }).run()

    // 5. Write COMPLIANT to requirementStatusHistory (this is what compliance summary reads)
    const prevHistory = db.select().from(requirementStatusHistory)
      .where(and(
        eq(requirementStatusHistory.productId, productId),
        eq(requirementStatusHistory.requirementId, requirementId),
      ))
      .all()
      .sort((a, b) => b.transitionedAt.localeCompare(a.transitionedAt))

    const previousStatus = prevHistory[0]?.status ?? 'NOT_ASSESSED'

    db.insert(requirementStatusHistory).values({
      id: randomUUID(),
      productId,
      requirementId,
      sourceId,
      status: 'COMPLIANT',
      previousStatus,
      reason: `AI-assisted remediation complete. ${openGaps.length} gap${openGaps.length !== 1 ? 's' : ''} resolved, ${workProducts.length} document update${workProducts.length !== 1 ? 's' : ''} applied.`,
      evidencePackageId: epId,
      transitionedAt: now,
      transitionedBy: approvedBy,
    }).run()

    // 6. Write to ddcrReportingRecords (keeps DDCR status engine in sync)
    db.insert(ddcrReportingRecords).values({
      id: randomUUID(),
      productId,
      requirementId,
      sourceId,
      status: 'COMPLIANT',
      effectiveAt: now,
      evidencePackageId: epId,
      reportedAt: now,
      reportedBy: approvedBy,
      notes: `Confirmed COMPLIANT via Product Hub. ${openGaps.length} gap(s) resolved. Evidence package ${epId} assembled.`,
    }).run()

    // 7. Update DDCR cockpit items that came from PRODUCT_HUB for this product × regulation
    const regSource = db.select().from(regulatorySources).where(eq(regulatorySources.id, sourceId)).get()
    if (regSource) {
      const cockpitItems = db.select().from(ddcrItems)
        .where(and(eq(ddcrItems.entityId, productId), eq(ddcrItems.sourceSystem, 'PRODUCT_HUB')))
        .all()
        .filter(i => i.regulatoryFramework === regSource.shortCode)
      for (const item of cockpitItems) {
        db.update(ddcrItems).set({
          executionStatus: 'COMPLETED',
          verificationStatus: 'PASSED',
          reportingStatus: 'COMPLIANT',
          nextAction: null,
          lastUpdated: now,
        }).where(eq(ddcrItems.id, item.id)).run()
      }
    }

    // 8. Recompute regulation/product-level DDCR aggregates
    recomputeAggregates(productId)

    return NextResponse.json({
      ok: true,
      evidencePackageId: epId,
      gapsResolved: openGaps.length,
      verificationsCreated: verResultIds.length,
      workProductsLinked: artifactIds.length,
      previousStatus,
    })
  } catch (err) {
    console.error('[confirm-compliant]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
