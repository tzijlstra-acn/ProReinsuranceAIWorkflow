import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { evidencePackages, products, regulatoryRequirements, regulatorySources } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const packages = db.select().from(evidencePackages).all()
    const allProducts = db.select().from(products).all()
    const allRequirements = db.select().from(regulatoryRequirements).all()
    const allSources = db.select().from(regulatorySources).all()

    const enriched = packages.map(ep => {
      const product = allProducts.find(p => p.id === ep.productId) ?? null
      const requirement = allRequirements.find(r => r.id === ep.requirementId) ?? null
      const source = requirement ? allSources.find(s => s.id === requirement.sourceId) ?? null : null
      return {
        id: ep.id,
        status: ep.status,
        assembledAt: ep.assembledAt,
        approvedAt: ep.approvedAt,
        approvedBy: ep.approvedBy,
        createdAt: ep.createdAt,
        verificationResultIds: JSON.parse(ep.verificationResultIds ?? '[]') as string[],
        evidenceArtifactIds: JSON.parse(ep.evidenceArtifactIds ?? '[]') as string[],
        product: product ? { id: product.id, name: product.name } : null,
        requirement: requirement ? {
          id: requirement.id,
          articleRef: requirement.articleRef,
          title: requirement.title,
          obligationType: requirement.obligationType,
        } : null,
        source: source ? { id: source.id, shortCode: source.shortCode, name: source.name } : null,
      }
    })

    return NextResponse.json(enriched)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
