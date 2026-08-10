import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { products, regulatorySources, ddcrReportingRecords, productApplicability } from '@/lib/db/schema'

export async function GET() {
  try {
    const allProducts = db.select().from(products).all()
    const allSources = db.select().from(regulatorySources).all()
    const allRecords = db.select().from(ddcrReportingRecords).all()
    const allApplicability = db.select().from(productApplicability).all()

    // For each product, derive overall status + per-regulation status
    const result = allProducts.map(product => {
      // Product-level record (no requirementId, no sourceId)
      const productLevelRecords = allRecords.filter(
        r => r.productId === product.id && r.requirementId === null && r.sourceId === null
      )
      const overallRecord = productLevelRecords.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))[0] ?? null

      // Regulation-level records (has sourceId, no requirementId)
      const regulationRecords = allRecords.filter(
        r => r.productId === product.id && r.sourceId !== null && r.requirementId === null
      )

      // Latest per source
      const latestPerSource = new Map<string, typeof regulationRecords[0]>()
      for (const r of regulationRecords) {
        const existing = latestPerSource.get(r.sourceId!)
        if (!existing || r.reportedAt > existing.reportedAt) latestPerSource.set(r.sourceId!, r)
      }

      const byRegulation = allSources.map(source => {
        const record = latestPerSource.get(source.id) ?? null
        const applicable = allApplicability.some(
          a => a.productId === product.id && a.sourceId === source.id && a.applicable === 1
        )
        return {
          sourceId: source.id,
          shortCode: source.shortCode,
          name: source.name,
          status: record?.status ?? (applicable ? 'NOT_ASSESSED' : 'NOT_APPLICABLE'),
          applicable,
        }
      })

      return {
        productId: product.id,
        productName: product.name,
        productType: product.type,
        criticality: product.criticality,
        owner: product.owner,
        overallStatus: overallRecord?.status ?? 'NOT_ASSESSED',
        byRegulation,
      }
    })

    return NextResponse.json({ products: result, regulations: allSources })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
