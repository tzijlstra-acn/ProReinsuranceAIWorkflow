import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { products, regulatorySources, regulatoryRequirements } from '@/lib/db/schema'
import {
  getProductOverallStatus,
  getProductRegulationStatuses,
  getProductRequirementStatuses,
} from '@/lib/domain/ddcr/status-engine'

export async function GET() {
  try {
    const allProducts = db.select().from(products).all()
    const allSources = db.select().from(regulatorySources).all()
    const allRequirements = db.select().from(regulatoryRequirements).all()

    const result = allProducts.map(product => {
      const overallStatus = getProductOverallStatus(product.id)
      const requirementStatuses = getProductRequirementStatuses(product.id)

      const byRegulation = getProductRegulationStatuses(product.id).map(record => {
        const source = allSources.find(s => s.id === record.sourceId)
        const reqsForSource = requirementStatuses.filter(r => r.sourceId === record.sourceId)
        // Surface evidence package ID from requirement-level records if the regulation-level doesn't have one
        const epId = record.evidencePackageId
          ?? reqsForSource.find(r => r.evidencePackageId)?.evidencePackageId
          ?? null
        return {
          sourceId: record.sourceId,
          shortCode: source?.shortCode ?? record.sourceId ?? '',
          name: source?.name ?? record.sourceId ?? '',
          status: record.status,
          evidencePackageId: epId,
          requirementCount: reqsForSource.filter(r => r.status !== 'NOT_APPLICABLE').length,
          nonCompliantCount: reqsForSource.filter(r => r.status === 'NON_COMPLIANT').length,
          compliantCount: reqsForSource.filter(r => r.status === 'COMPLIANT').length,
          notApplicableCount: reqsForSource.filter(r => r.status === 'NOT_APPLICABLE').length,
        }
      })

      const byRequirement = requirementStatuses.map(record => {
        const req = allRequirements.find(r => r.id === record.requirementId)
        const source = allSources.find(s => s.id === record.sourceId)
        return {
          requirementId: record.requirementId,
          sourceId: record.sourceId,
          status: record.status,
          effectiveAt: record.effectiveAt,
          evidencePackageId: record.evidencePackageId,
          notes: record.notes,
          title: req?.title ?? record.requirementId ?? '',
          articleRef: req?.articleRef ?? '',
          obligationType: req?.obligationType ?? '',
          obligationLevel: req?.obligationLevel ?? 'MANDATORY',
          shortCode: source?.shortCode ?? record.sourceId ?? '',
        }
      })

      const applicableReqs = byRequirement.filter(r => r.status !== 'NOT_APPLICABLE')
      const nonCompliantCount = applicableReqs.filter(r => r.status === 'NON_COMPLIANT').length

      return {
        productId: product.id,
        productName: product.name,
        productType: product.type,
        criticality: product.criticality,
        overallStatus: overallStatus?.status ?? 'PENDING',
        applicableRequirementCount: applicableReqs.length,
        nonCompliantRequirementCount: nonCompliantCount,
        byRegulation,
        byRequirement,
      }
    })

    return NextResponse.json({ products: result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
