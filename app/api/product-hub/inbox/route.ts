import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  controlChanges,
  regulatoryRequirements,
  regulatorySources,
  productApplicability,
  products,
  productGaps,
  remediationCases,
  productWorkProducts,
} from '@/lib/db/schema'

type Stage = 'ACTION_REQUIRED' | 'DOC_GENERATED' | 'GAPS_FOUND' | 'REMEDIATION' | 'FULFILLED'

function deriveStage(
  workProds: Array<{ status: string }>,
  pgaps: Array<{ status: string }>,
  rcases: Array<{ status: string }>
): Stage {
  const allGapsResolved = pgaps.length === 0 || pgaps.every(g => g.status === 'RESOLVED')
  if (workProds.some(wp => wp.status === 'FULFILLED' || wp.status === 'APPROVED') && allGapsResolved) {
    return 'FULFILLED'
  }
  if (pgaps.some(g => g.status === 'IN_REMEDIATION' || rcases.some(rc => rc.status === 'IN_PROGRESS' || rc.status === 'OPEN'))) {
    if (!allGapsResolved) return 'REMEDIATION'
  }
  if (pgaps.some(g => g.status !== 'RESOLVED')) {
    return 'GAPS_FOUND'
  }
  if (workProds.length > 0) {
    return 'DOC_GENERATED'
  }
  return 'ACTION_REQUIRED'
}

export function GET() {
  try {
    const publishedChanges = db.select().from(controlChanges).all()
      .filter(c => c.status === 'PUBLISHED')
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))

    const allRequirements = db.select().from(regulatoryRequirements).all()
    const allSources = db.select().from(regulatorySources).all()
    const allApplicability = db.select().from(productApplicability).all()
    const allProducts = db.select().from(products).all()
    const allGaps = db.select().from(productGaps).all()
    const allCases = db.select().from(remediationCases).all()
    const allWorkProds = db.select().from(productWorkProducts).all()

    const items = publishedChanges.map(cc => {
      const requirement = allRequirements.find(r => r.id === cc.requirementId) ?? null
      const source = requirement ? allSources.find(s => s.id === requirement.sourceId) ?? null : null

      const applicable = allApplicability.filter(a => a.requirementId === cc.requirementId && a.applicable)

      const affectedProducts = applicable.flatMap(app => {
        const product = allProducts.find(p => p.id === app.productId)
        if (!product) return []

        const pgaps = allGaps.filter(g => g.productId === product.id && g.requirementId === cc.requirementId)
        const rcases = allCases.filter(c => c.productId === product.id && c.requirementId === cc.requirementId)
        const workProds = allWorkProds.filter(w => w.productId === product.id && w.requirementId === cc.requirementId)

        return [{
          product: {
            id: product.id,
            name: product.name,
            criticality: product.criticality,
            type: product.type,
            owner: product.owner,
          },
          stage: deriveStage(workProds, pgaps, rcases),
          productGaps: pgaps.map(g => ({ id: g.id, severity: g.severity, status: g.status, title: g.title })),
          remediationCases: rcases.map(rc => ({ id: rc.id, status: rc.status, title: rc.title })),
          workProducts: workProds.map(wp => ({ id: wp.id, title: wp.title, status: wp.status })),
        }]
      })

      return {
        controlChange: {
          id: cc.id,
          title: cc.title,
          description: cc.description,
          changeType: cc.changeType,
          publishedAt: cc.publishedAt,
          requirementId: cc.requirementId,
          gapId: cc.gapId,
        },
        requirement: requirement ? {
          id: requirement.id,
          articleRef: requirement.articleRef,
          title: requirement.title,
          obligationType: requirement.obligationType,
          obligationLevel: requirement.obligationLevel,
          sourceId: requirement.sourceId,
        } : null,
        source: source ? { id: source.id, shortCode: source.shortCode, name: source.name } : null,
        affectedProducts,
      }
    })

    return NextResponse.json(items)
  } catch (err) {
    console.error('[product-hub/inbox]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
