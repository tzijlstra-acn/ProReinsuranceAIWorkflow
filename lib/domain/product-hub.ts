import { db } from '@/lib/db/index'
import {
  products,
  productApplicability,
  productGaps,
  productWorkProducts,
  requirementStatusHistory,
  regulatoryRequirements,
  regulatorySources,
  verificationCriteria,
  verificationResults,
} from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export function getProducts() {
  return db.select().from(products).all()
}

export function getProduct(id: string) {
  return db.select().from(products).where(eq(products.id, id)).get() ?? null
}

export function getProductComplianceSummary(productId: string) {
  const applicabilityRecords = db
    .select()
    .from(productApplicability)
    .where(eq(productApplicability.productId, productId))
    .all()

  return applicabilityRecords.map(app => {
    const requirement = db
      .select()
      .from(regulatoryRequirements)
      .where(eq(regulatoryRequirements.id, app.requirementId))
      .get() ?? null

    const source = db
      .select()
      .from(regulatorySources)
      .where(eq(regulatorySources.id, app.sourceId))
      .get() ?? null

    const statusHistory = db
      .select()
      .from(requirementStatusHistory)
      .where(
        and(
          eq(requirementStatusHistory.productId, productId),
          eq(requirementStatusHistory.requirementId, app.requirementId)
        )
      )
      .orderBy(desc(requirementStatusHistory.transitionedAt))
      .all()

    const currentStatus = statusHistory[0]?.status ?? 'NOT_ASSESSED'

    const allGaps = db
      .select()
      .from(productGaps)
      .where(
        and(
          eq(productGaps.productId, productId),
          eq(productGaps.requirementId, app.requirementId)
        )
      )
      .all()
    const openGaps = allGaps.filter(g => g.status !== 'RESOLVED')

    const workProducts = db
      .select()
      .from(productWorkProducts)
      .where(
        and(
          eq(productWorkProducts.productId, productId),
          eq(productWorkProducts.requirementId, app.requirementId)
        )
      )
      .all()

    const criteria = db
      .select()
      .from(verificationCriteria)
      .where(eq(verificationCriteria.requirementId, app.requirementId))
      .all()

    const verResults = db
      .select()
      .from(verificationResults)
      .where(
        and(
          eq(verificationResults.productId, productId),
          eq(verificationResults.requirementId, app.requirementId)
        )
      )
      .all()

    return {
      applicability: app,
      requirement,
      source,
      applicable: app.applicable,
      currentStatus,
      statusHistory,
      openGaps,
      workProducts,
      verificationCriteria: criteria,
      verificationResults: verResults,
    }
  })
}

export function getProductGaps(productId: string, requirementId?: string) {
  if (requirementId) {
    return db
      .select()
      .from(productGaps)
      .where(
        and(
          eq(productGaps.productId, productId),
          eq(productGaps.requirementId, requirementId)
        )
      )
      .all()
  }
  return db.select().from(productGaps).where(eq(productGaps.productId, productId)).all()
}

export function getProductWorkProducts(productId: string) {
  return db
    .select()
    .from(productWorkProducts)
    .where(eq(productWorkProducts.productId, productId))
    .all()
}

export function updateProductGapStatus(gapId: string, status: string) {
  return db.update(productGaps).set({ status }).where(eq(productGaps.id, gapId)).run()
}
