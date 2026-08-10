import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  products,
  regulatorySources,
  regulatoryRequirements,
  evidencePackages,
  verificationCriteria,
  verificationResults,
  requirementStatusHistory,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  getProductOverallStatus,
  getProductRegulationStatuses,
  getProductRequirementStatuses,
} from '@/lib/domain/ddcr/status-engine'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = db.select().from(products).where(eq(products.id, id)).all()[0]
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const allSources = db.select().from(regulatorySources).all()
    const allRequirements = db.select().from(regulatoryRequirements).all()
    const allEvidencePackages = db.select().from(evidencePackages)
      .where(eq(evidencePackages.productId, id))
      .all()
    const allCriteria = db.select().from(verificationCriteria).all()
    const allResults = db.select().from(verificationResults)
      .where(eq(verificationResults.productId, id))
      .all()
    const allHistory = db.select().from(requirementStatusHistory)
      .where(eq(requirementStatusHistory.productId, id))
      .all()

    const overallStatus = getProductOverallStatus(id)
    const regulationStatuses = getProductRegulationStatuses(id)
    const requirementStatuses = getProductRequirementStatuses(id)

    // Regulation breakdown
    const byRegulation = regulationStatuses.map(record => {
      const source = allSources.find(s => s.id === record.sourceId)
      const reqsForSource = requirementStatuses.filter(r => r.sourceId === record.sourceId)
      return {
        sourceId: record.sourceId,
        shortCode: source?.shortCode ?? record.sourceId ?? '',
        regulationName: source?.name ?? record.sourceId ?? '',
        status: record.status,
        effectiveAt: record.effectiveAt,
        notes: record.notes,
        requirementCount: reqsForSource.filter(r => r.status !== 'NOT_APPLICABLE').length,
        nonCompliantCount: reqsForSource.filter(r => r.status === 'NON_COMPLIANT').length,
        compliantCount: reqsForSource.filter(r => r.status === 'COMPLIANT').length,
      }
    })

    // Requirement breakdown with full evidence and verification detail
    const byRequirement = requirementStatuses.map(record => {
      const req = allRequirements.find(r => r.id === record.requirementId)
      const source = allSources.find(s => s.id === record.sourceId)

      // Find associated evidence package
      const ep = record.evidencePackageId
        ? allEvidencePackages.find(e => e.id === record.evidencePackageId) ?? null
        : allEvidencePackages.find(
            e => e.requirementId === record.requirementId && e.status === 'COMPLETE'
          ) ?? null

      // Verification criteria with latest result per criterion
      const criteria = allCriteria
        .filter(c => c.requirementId === record.requirementId)
        .map(c => {
          const criterionResults = allResults
            .filter(r => r.criterionId === c.id)
            .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))
          const latestResult = criterionResults[0] ?? null
          return {
            criterion: {
              id: c.id,
              title: c.title,
              description: c.description,
              verifierType: c.verifierType,
              isMandatory: c.isMandatory,
              policyCode: c.policyCode,
            },
            latestResult: latestResult
              ? {
                  id: latestResult.id,
                  status: latestResult.status,
                  observedValue: latestResult.observedValue
                    ? tryParseJson(latestResult.observedValue)
                    : null,
                  evidenceReference: latestResult.evidenceReference,
                  verifiedAt: latestResult.verifiedAt,
                  notes: latestResult.notes,
                }
              : null,
          }
        })

      // Status history (last 5 transitions)
      const history = allHistory
        .filter(h => h.requirementId === record.requirementId)
        .sort((a, b) => b.transitionedAt.localeCompare(a.transitionedAt))
        .slice(0, 5)
        .map(h => ({
          id: h.id,
          status: h.status,
          previousStatus: h.previousStatus,
          reason: h.reason,
          transitionedAt: h.transitionedAt,
          transitionedBy: h.transitionedBy,
          controlChangeId: h.controlChangeId,
          evidencePackageId: h.evidencePackageId,
        }))

      return {
        record: {
          id: record.id,
          status: record.status,
          effectiveAt: record.effectiveAt,
          evidencePackageId: record.evidencePackageId ?? ep?.id ?? null,
          reportedAt: record.reportedAt,
          reportedBy: record.reportedBy,
          notes: record.notes,
        },
        requirement: req
          ? {
              id: req.id,
              sourceId: req.sourceId,
              articleRef: req.articleRef,
              title: req.title,
              description: req.description,
              obligationType: req.obligationType,
              obligationLevel: req.obligationLevel,
            }
          : null,
        source: source
          ? { id: source.id, shortCode: source.shortCode, name: source.name }
          : null,
        evidencePackage: ep
          ? {
              id: ep.id,
              status: ep.status,
              assembledAt: ep.assembledAt,
              approvedAt: ep.approvedAt,
              approvedBy: ep.approvedBy,
              verificationResultIds: tryParseJson(ep.verificationResultIds ?? '[]') as string[],
            }
          : null,
        criteria,
        history,
      }
    })

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        type: product.type,
        criticality: product.criticality,
        hostingModel: product.hostingModel,
        applicationId: product.applicationId,
        owner: product.owner,
        description: product.description,
        status: product.status,
      },
      overallStatus: overallStatus
        ? {
            status: overallStatus.status,
            effectiveAt: overallStatus.effectiveAt,
            reportedAt: overallStatus.reportedAt,
            notes: overallStatus.notes,
          }
        : null,
      byRegulation,
      byRequirement,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
