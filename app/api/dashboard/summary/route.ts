import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  regulatorySources,
  regulatoryVersions,
  complianceGaps,
  products,
  ddcrReportingRecords,
} from '@/lib/db/schema'

export async function GET() {
  try {
    const allSources = db.select().from(regulatorySources).all()
    const allVersions = db.select().from(regulatoryVersions).all()
    const allGaps = db.select().from(complianceGaps).all()
    const allProducts = db.select().from(products).all()
    const allReportingRecords = db.select().from(ddcrReportingRecords).all()

    // ── Product overall status ──────────────────────────────────────────────
    // Product-level aggregates: requirementId === null AND sourceId === null
    const productLevelRecords = allReportingRecords.filter(
      r => r.requirementId === null && r.sourceId === null
    )

    const byStatus: Record<string, number> = {
      COMPLIANT: 0,
      NON_COMPLIANT: 0,
      PENDING: 0,
      NOT_APPLICABLE: 0,
    }

    const reportedProductIds = new Set(productLevelRecords.map(r => r.productId))

    for (const r of productLevelRecords) {
      const s = r.status
      if (s === 'COMPLIANT') byStatus.COMPLIANT++
      else if (s === 'NON_COMPLIANT') byStatus.NON_COMPLIANT++
      else if (s === 'NOT_APPLICABLE') byStatus.NOT_APPLICABLE++
      else byStatus.PENDING++
    }

    // Products with no reporting record are implicitly PENDING
    for (const p of allProducts) {
      if (!reportedProductIds.has(p.id)) {
        byStatus.PENDING++
      }
    }

    // ── Pending regulatory updates ──────────────────────────────────────────
    const pendingVersions = allVersions.filter(v => !v.isActive)
    const pendingRegulatoryUpdates = pendingVersions.length

    // ── Regulations list ────────────────────────────────────────────────────
    const regulations = allSources.map(src => ({
      id: src.id,
      shortCode: src.shortCode,
      name: src.name,
      pendingUpdates: pendingVersions.filter(v => v.sourceId === src.id).length,
    }))

    // ── Compliance gaps ─────────────────────────────────────────────────────
    const bySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    let openCount = 0

    for (const g of allGaps) {
      const sev = g.severity
      if (sev === 'CRITICAL') bySeverity.CRITICAL++
      else if (sev === 'HIGH') bySeverity.HIGH++
      else if (sev === 'MEDIUM') bySeverity.MEDIUM++
      else if (sev === 'LOW') bySeverity.LOW++
      if (g.status === 'OPEN') openCount++
    }

    // ── Compliance matrix ───────────────────────────────────────────────────
    // Per-product per-regulation records: requirementId === null AND sourceId !== null
    const matrixRecords = allReportingRecords.filter(
      r => r.requirementId === null && r.sourceId !== null
    )

    const matrix = allProducts.map(p => ({
      productId: p.id,
      productName: p.name,
      regulations: allSources.map(src => {
        const record = matrixRecords.find(r => r.productId === p.id && r.sourceId === src.id)
        return {
          sourceId: src.id,
          shortCode: src.shortCode,
          status: record?.status ?? 'PENDING',
        }
      }),
    }))

    return NextResponse.json({
      products: {
        total: allProducts.length,
        byStatus,
      },
      regulations,
      complianceGaps: {
        total: allGaps.length,
        bySeverity,
        open: openCount,
      },
      pendingRegulatoryUpdates,
      matrix,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
