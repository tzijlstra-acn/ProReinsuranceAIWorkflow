'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'

interface RequirementSource {
  id: string
  shortCode: string
  name: string
  jurisdiction: string
}

interface Requirement {
  id: string
  sourceId: string
  articleRef: string
  title: string
  description: string
  obligationType: string
  obligationLevel: string
}

interface ProductGap {
  id: string
  requirementId: string
  controlChangeId: string | null
  title: string
  description: string
  gapType: string
  severity: string
  status: string
  detectedAt: string
  resolvedAt: string | null
}

interface ProductWorkProduct {
  id: string
  requirementId: string | null
  title: string
  status: string
  documentId: string | null
}

interface StatusHistoryItem {
  id: string
  productId: string
  requirementId: string
  sourceId: string
  status: string
  previousStatus: string | null
  reason: string | null
  controlChangeId: string | null
  transitionedAt: string
  transitionedBy: string | null
}

interface VerificationCriterion {
  id: string
  requirementId: string
  title: string
  description: string | null
  verifierType: string
  isMandatory: boolean
  expectedValue: string | null
  policyCode: string | null
}

interface VerificationResult {
  id: string
  criterionId: string
  productId: string
  requirementId: string
  status: string
  observedValue: string | null
  evidenceReference: string | null
  verifiedAt: string
  notes: string | null
}

interface ComplianceItem {
  applicability: {
    id: string
    applicable: boolean
    applicabilityReason: string | null
    assessedAt: string
    assessedBy: string | null
  }
  requirement: Requirement | null
  source: RequirementSource | null
  applicable: boolean
  currentStatus: string
  statusHistory: StatusHistoryItem[]
  openGaps: ProductGap[]
  workProducts: ProductWorkProduct[]
  verificationCriteria: VerificationCriterion[]
  verificationResults: VerificationResult[]
}

function statusStyle(status: string) {
  switch (status) {
    case 'COMPLIANT':              return { color: '#0A7C59', bg: 'rgba(10,124,89,0.08)',   border: 'rgba(10,124,89,0.25)',  label: 'Compliant' }
    case 'NON_COMPLIANT':         return { color: '#E4002B', bg: 'rgba(228,0,43,0.08)',    border: 'rgba(228,0,43,0.25)',   label: 'Non-Compliant' }
    case 'NOT_APPLICABLE':        return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',   border: 'rgba(74,85,104,0.25)', label: 'Not Applicable' }
    case 'IN_REMEDIATION':        return { color: '#B45309', bg: 'rgba(180,83,9,0.08)',    border: 'rgba(180,83,9,0.25)',   label: 'In Remediation' }
    case 'FULFILLED':             return { color: '#0A7C59', bg: 'rgba(10,124,89,0.08)',   border: 'rgba(10,124,89,0.25)',  label: 'Fulfilled' }
    case 'NOT_FULFILLED':         return { color: '#E4002B', bg: 'rgba(228,0,43,0.08)',    border: 'rgba(228,0,43,0.25)',   label: 'Not Fulfilled' }
    case 'NOT_STARTED':           return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',   border: 'rgba(74,85,104,0.25)', label: 'Not Started' }
    case 'IN_PROGRESS':           return { color: '#B45309', bg: 'rgba(180,83,9,0.08)',    border: 'rgba(180,83,9,0.25)',   label: 'In Progress' }
    case 'PASSED':                return { color: '#0A7C59', bg: 'rgba(10,124,89,0.08)',   border: 'rgba(10,124,89,0.25)',  label: 'Passed' }
    case 'FAILED':                return { color: '#E4002B', bg: 'rgba(228,0,43,0.08)',    border: 'rgba(228,0,43,0.25)',   label: 'Failed' }
    case 'NOT_RUN':               return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',   border: 'rgba(74,85,104,0.25)', label: 'Not Run' }
    case 'NOT_ASSESSED':          return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',   border: 'rgba(74,85,104,0.25)', label: 'Not Assessed' }
    default:                      return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',   border: 'rgba(74,85,104,0.25)', label: status.replace(/_/g, ' ') }
  }
}

function gapTypeStyle(type: string) {
  switch (type) {
    case 'CONFIGURATION': return { color: '#003781', bg: 'rgba(0,55,129,0.08)',   border: 'rgba(0,55,129,0.25)' }
    case 'DOCUMENTATION': return { color: '#6D28D9', bg: 'rgba(109,40,217,0.08)', border: 'rgba(109,40,217,0.25)' }
    case 'PROCESS':       return { color: '#B45309', bg: 'rgba(180,83,9,0.08)',   border: 'rgba(180,83,9,0.25)' }
    case 'APPROVAL':      return { color: '#0A7C59', bg: 'rgba(10,124,89,0.08)',  border: 'rgba(10,124,89,0.25)' }
    default:              return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',  border: 'rgba(74,85,104,0.25)' }
  }
}

function obTypeLabel(t: string) {
  return t.replace(/_/g, ' ')
}

function verifierTypeLabel(t: string) {
  switch (t) {
    case 'TECHNICAL_POLICY': return 'Technical Policy'
    case 'DOCUMENT_APPROVAL': return 'Document Approval'
    case 'WORKFLOW_EVIDENCE': return 'Workflow Evidence'
    case 'REPOSITORY_CHECK': return 'Repository Check'
    case 'MANUAL_ASSESSMENT': return 'Manual Assessment'
    default: return t.replace(/_/g, ' ')
  }
}

function findVerResult(
  criterionId: string,
  results: VerificationResult[]
): VerificationResult | undefined {
  return results.find(r => r.criterionId === criterionId)
}

export default function ComplianceDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params)
  const [compliance, setCompliance] = useState<ComplianceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/product-hub/products/${productId}/compliance`)
      .then(r => r.json())
      .then(data => {
        setCompliance(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [productId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-56 bg-[#F4F6F9] rounded animate-pulse" />
        <div className="h-64 bg-[#F4F6F9] rounded-lg animate-pulse" />
        <div className="h-64 bg-[#F4F6F9] rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#4A5568]">
        <Link href="/product-hub" className="hover:text-[#003781] hover:underline">Product Hub</Link>
        <span>/</span>
        <Link href={`/product-hub/products/${productId}`} className="hover:text-[#003781] hover:underline">
          {productId}
        </Link>
        <span>/</span>
        <span className="text-[#003781] font-medium">Compliance Detail</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[#003781]">Compliance Detail</h1>
        <p className="text-[#4A5568] text-sm mt-1">
          Per-requirement compliance status, gaps, verification criteria and work products for{' '}
          <span className="font-medium text-[#1A1A2E]">{productId}</span>
        </p>
      </div>

      {/* One section per requirement */}
      {compliance.map(item => {
        const s = statusStyle(item.currentStatus)
        const req = item.requirement
        const src = item.source

        return (
          <div
            key={item.applicability.id}
            className="bg-white border border-[#D0D7E3] rounded-xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
          >
            {/* Requirement header strip */}
            <div
              className="px-6 py-4 border-b border-[#D0D7E3] flex items-start justify-between"
              style={
                item.currentStatus === 'NON_COMPLIANT'
                  ? { background: 'rgba(228,0,43,0.04)' }
                  : item.currentStatus === 'COMPLIANT'
                  ? { background: 'rgba(10,124,89,0.04)' }
                  : { background: '#F4F6F9' }
              }
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <span className="text-base font-bold text-[#003781]">
                    {src?.shortCode?.replace(/_/g, ' ')} · {req?.articleRef}
                  </span>
                  <span
                    className="px-2.5 py-0.5 text-xs font-semibold rounded border"
                    style={{ color: s.color, background: s.bg, borderColor: s.border }}
                  >
                    {s.label}
                  </span>
                  {req?.obligationType && (
                    <span className="px-2 py-0.5 text-xs rounded border text-[#4A5568] border-[#D0D7E3] bg-white">
                      {obTypeLabel(req.obligationType)}
                    </span>
                  )}
                  {!item.applicable && (
                    <span className="px-2 py-0.5 text-xs rounded border text-[#4A5568] border-[#D0D7E3] bg-white">
                      Not Applicable
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-[#1A1A2E] mb-0.5">{req?.title}</p>
                <p className="text-xs text-[#4A5568] max-w-2xl leading-relaxed">{req?.description}</p>
              </div>
            </div>

            {/* Applicability reason */}
            {item.applicability.applicabilityReason && (
              <div className="px-6 py-3 border-b border-[#D0D7E3] bg-[#F4F6F9]">
                <p className="text-xs text-[#4A5568]">
                  <span className="font-medium text-[#1A1A2E]">Applicability: </span>
                  {item.applicability.applicabilityReason}
                </p>
                <p className="text-xs text-[#4A5568]/60 mt-0.5">
                  Assessed {item.applicability.assessedAt}
                  {item.applicability.assessedBy ? ` by ${item.applicability.assessedBy}` : ''}
                </p>
              </div>
            )}

            {/* Status history timeline */}
            {item.statusHistory.length > 0 && (
              <div className="px-6 py-4 border-b border-[#D0D7E3]">
                <p className="text-xs font-semibold text-[#4A5568] uppercase tracking-wide mb-3">
                  Status History
                </p>
                <div className="relative">
                  <div
                    className="absolute left-3 top-0 bottom-0 w-px"
                    style={{ background: '#D0D7E3' }}
                  />
                  <div className="space-y-3">
                    {item.statusHistory.map((h, idx) => {
                      const hs = statusStyle(h.status)
                      return (
                        <div key={h.id} className="flex items-start gap-4 pl-8 relative">
                          <div
                            className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white"
                            style={{ background: hs.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="px-2 py-0.5 text-xs font-semibold rounded border"
                                style={{ color: hs.color, background: hs.bg, borderColor: hs.border }}
                              >
                                {hs.label}
                              </span>
                              {h.previousStatus && (
                                <span className="text-xs text-[#4A5568]">
                                  from {h.previousStatus.replace(/_/g, ' ')}
                                </span>
                              )}
                              <span className="text-xs text-[#4A5568]/60">{h.transitionedAt}</span>
                              {h.transitionedBy && (
                                <span className="text-xs text-[#4A5568]/60">by {h.transitionedBy}</span>
                              )}
                            </div>
                            {h.reason && (
                              <p className="text-xs text-[#4A5568] mt-0.5 leading-relaxed">{h.reason}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Verification criteria checklist */}
            {item.verificationCriteria.length > 0 && (
              <div className="px-6 py-4 border-b border-[#D0D7E3]">
                <p className="text-xs font-semibold text-[#4A5568] uppercase tracking-wide mb-3">
                  Verification Criteria
                </p>
                <div className="space-y-2">
                  {item.verificationCriteria.map(criterion => {
                    const result = findVerResult(criterion.id, item.verificationResults)
                    const resultStatus = result?.status ?? 'NOT_RUN'
                    const rs = statusStyle(resultStatus)
                    const isPassed = resultStatus === 'PASSED'
                    const isFailed = resultStatus === 'FAILED'

                    return (
                      <div
                        key={criterion.id}
                        className="flex items-start gap-3 rounded-lg border p-3"
                        style={{
                          borderColor: isPassed ? 'rgba(10,124,89,0.25)' : isFailed ? 'rgba(228,0,43,0.25)' : '#D0D7E3',
                          background: isPassed ? 'rgba(10,124,89,0.04)' : isFailed ? 'rgba(228,0,43,0.04)' : '#fff',
                        }}
                      >
                        {/* Check/X icon */}
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 text-xs font-bold"
                          style={{
                            background: isPassed ? '#0A7C59' : isFailed ? '#E4002B' : '#D0D7E3',
                            color: '#fff',
                          }}
                        >
                          {isPassed ? '✓' : isFailed ? '✗' : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-[#1A1A2E]">{criterion.title}</p>
                            {criterion.isMandatory && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-[#E4002B]/10 text-[#E4002B] border border-[#E4002B]/20">
                                Mandatory
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 text-xs rounded border text-[#4A5568] border-[#D0D7E3] bg-[#F4F6F9]">
                              {verifierTypeLabel(criterion.verifierType)}
                            </span>
                          </div>
                          {criterion.description && (
                            <p className="text-xs text-[#4A5568] mt-0.5 leading-relaxed">{criterion.description}</p>
                          )}
                          {result && (
                            <div className="mt-1.5 flex items-center gap-2 text-xs text-[#4A5568]">
                              <span
                                className="px-2 py-0.5 text-xs font-semibold rounded border"
                                style={{ color: rs.color, background: rs.bg, borderColor: rs.border }}
                              >
                                {rs.label}
                              </span>
                              {result.verifiedAt && (
                                <span>Verified {result.verifiedAt}</span>
                              )}
                              {result.notes && (
                                <span className="text-[#4A5568]/60">{result.notes}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Open gaps */}
            {item.openGaps.length > 0 && (
              <div className="px-6 py-4 border-b border-[#D0D7E3]">
                <p className="text-xs font-semibold text-[#4A5568] uppercase tracking-wide mb-3">
                  Open Product Gaps
                  <span
                    className="ml-2 px-1.5 py-0.5 text-xs font-bold rounded-full text-white"
                    style={{ background: '#E4002B' }}
                  >
                    {item.openGaps.length}
                  </span>
                </p>
                <div className="space-y-3">
                  {item.openGaps.map(gap => {
                    const gt = gapTypeStyle(gap.gapType)
                    return (
                      <div
                        key={gap.id}
                        className="rounded-lg border p-4"
                        style={{ borderColor: 'rgba(228,0,43,0.2)', background: 'rgba(228,0,43,0.03)' }}
                      >
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-mono text-[#4A5568]">{gap.id}</span>
                          <span
                            className="px-2 py-0.5 text-xs font-medium rounded border"
                            style={{ color: gt.color, background: gt.bg, borderColor: gt.border }}
                          >
                            {gap.gapType}
                          </span>
                          <span className="text-xs text-[#4A5568]">Severity: {gap.severity}</span>
                          {gap.controlChangeId && (
                            <span className="text-xs text-[#4A5568]">via {gap.controlChangeId}</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-[#1A1A2E] mb-0.5">{gap.title}</p>
                        <p className="text-sm text-[#4A5568]">{gap.description}</p>
                        <p className="text-xs text-[#4A5568]/60 mt-1.5">Detected {gap.detectedAt}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Work products */}
            {item.workProducts.length > 0 && (
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-[#4A5568] uppercase tracking-wide mb-3">
                  Work Products
                </p>
                <div className="space-y-2">
                  {item.workProducts.map(wp => {
                    const ws = statusStyle(wp.status)
                    return (
                      <div
                        key={wp.id}
                        className="flex items-center justify-between rounded-lg border px-4 py-2.5"
                        style={{ borderColor: ws.border, background: ws.bg }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-[#4A5568] flex-shrink-0">{wp.id}</span>
                          <span className="text-sm font-medium text-[#1A1A2E] truncate">{wp.title}</span>
                        </div>
                        <span
                          className="flex-shrink-0 px-2.5 py-0.5 text-xs font-semibold rounded border"
                          style={{ color: ws.color, background: '#fff', borderColor: ws.border }}
                        >
                          {ws.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Not applicable notice */}
            {!item.applicable && item.openGaps.length === 0 && item.workProducts.length === 0 && (
              <div className="px-6 py-5 text-center">
                <p className="text-sm text-[#4A5568]">
                  This regulation does not apply to <span className="font-medium">{productId}</span>.
                </p>
                {item.applicability.applicabilityReason && (
                  <p className="text-xs text-[#4A5568]/60 mt-1">{item.applicability.applicabilityReason}</p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {compliance.length === 0 && (
        <div className="text-center py-16 text-[#4A5568]">
          <p>No compliance data found for this product.</p>
        </div>
      )}
    </div>
  )
}
