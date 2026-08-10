'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  type: string
  criticality: string
  hostingModel: string | null
  legalEntity: string | null
  owner: string | null
  description: string | null
  status: string
  applicationId: string | null
  createdAt: string | null
}

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
  productId: string
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
  productId: string
  definitionId: string
  requirementId: string | null
  title: string
  status: string
  content: string | null
  documentId: string | null
  approvalId: string | null
  createdAt: string | null
  updatedAt: string | null
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
  openGaps: ProductGap[]
  workProducts: ProductWorkProduct[]
}

function statusStyle(status: string) {
  switch (status) {
    case 'COMPLIANT':        return { color: '#0A7C59', bg: 'rgba(10,124,89,0.08)',   border: 'rgba(10,124,89,0.25)',  label: 'Compliant' }
    case 'NON_COMPLIANT':   return { color: '#E4002B', bg: 'rgba(228,0,43,0.08)',    border: 'rgba(228,0,43,0.25)',   label: 'Non-Compliant' }
    case 'NOT_APPLICABLE':  return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',   border: 'rgba(74,85,104,0.25)', label: 'Not Applicable' }
    case 'IN_REMEDIATION':  return { color: '#B45309', bg: 'rgba(180,83,9,0.08)',    border: 'rgba(180,83,9,0.25)',   label: 'In Remediation' }
    case 'FULFILLED':       return { color: '#0A7C59', bg: 'rgba(10,124,89,0.08)',   border: 'rgba(10,124,89,0.25)',  label: 'Fulfilled' }
    case 'NOT_FULFILLED':   return { color: '#E4002B', bg: 'rgba(228,0,43,0.08)',    border: 'rgba(228,0,43,0.25)',   label: 'Not Fulfilled' }
    case 'NOT_STARTED':     return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',   border: 'rgba(74,85,104,0.25)', label: 'Not Started' }
    case 'IN_PROGRESS':     return { color: '#B45309', bg: 'rgba(180,83,9,0.08)',    border: 'rgba(180,83,9,0.25)',   label: 'In Progress' }
    default:                return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)',   border: 'rgba(74,85,104,0.25)', label: status.replace(/_/g, ' ') }
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

function criticalityStyle(c: string) {
  switch (c.toUpperCase()) {
    case 'CRITICAL': return { color: '#E4002B', bg: 'rgba(228,0,43,0.08)',   border: 'rgba(228,0,43,0.25)' }
    case 'HIGH':     return { color: '#B45309', bg: 'rgba(180,83,9,0.08)',   border: 'rgba(180,83,9,0.25)' }
    case 'MEDIUM':   return { color: '#003781', bg: 'rgba(0,55,129,0.08)',   border: 'rgba(0,55,129,0.25)' }
    default:         return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)', border: 'rgba(74,85,104,0.25)' }
  }
}

function severityStyle(s: string) {
  switch (s.toUpperCase()) {
    case 'CRITICAL': return { color: '#E4002B', bg: 'rgba(228,0,43,0.08)',  border: 'rgba(228,0,43,0.25)' }
    case 'HIGH':     return { color: '#B45309', bg: 'rgba(180,83,9,0.08)',  border: 'rgba(180,83,9,0.25)' }
    case 'MEDIUM':   return { color: '#003781', bg: 'rgba(0,55,129,0.08)', border: 'rgba(0,55,129,0.25)' }
    default:         return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)', border: 'rgba(74,85,104,0.25)' }
  }
}

export default function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [compliance, setCompliance] = useState<ComplianceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/product-hub/products/${productId}`).then(r => r.json()),
      fetch(`/api/product-hub/products/${productId}/compliance`).then(r => r.json()),
    ]).then(([prod, comp]) => {
      setProduct(prod)
      setCompliance(Array.isArray(comp) ? comp : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [productId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-48 bg-[#F4F6F9] rounded animate-pulse" />
        <div className="h-32 bg-[#F4F6F9] rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <p className="text-[#E4002B] font-medium">Product not found.</p>
        <Link href="/product-hub" className="text-[#003781] text-sm mt-2 inline-block hover:underline">
          &larr; Back to Product Hub
        </Link>
      </div>
    )
  }

  const allWorkProducts = compliance.flatMap(i => i.workProducts)
  const allOpenGaps = compliance.flatMap(i => i.openGaps)
  const crit = criticalityStyle(product.criticality)

  // Group work products by requirementId for display
  const wpByReq: Record<string, { req: Requirement | null; source: RequirementSource | null; wps: ProductWorkProduct[] }> = {}
  for (const item of compliance) {
    if (item.workProducts.length > 0) {
      const key = item.requirement?.id ?? 'unknown'
      wpByReq[key] = {
        req: item.requirement,
        source: item.source,
        wps: item.workProducts,
      }
    }
  }

  // Build compliance matrix rows
  const matrixOrder = ['DORA', 'NIS2', 'GDPR', 'EU_AI_ACT']
  const byCode: Record<string, ComplianceItem[]> = {}
  for (const item of compliance) {
    const code = item.source?.shortCode ?? 'OTHER'
    if (!byCode[code]) byCode[code] = []
    byCode[code].push(item)
  }

  return (
    <div className="space-y-8">
      {/* Back link */}
      <div>
        <Link href="/product-hub" className="text-sm text-[#003781] hover:underline">
          &larr; Product Hub
        </Link>
      </div>

      {/* Product header */}
      <div
        className="bg-white border border-[#D0D7E3] rounded-xl p-6"
        style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#003781]">{product.name}</h1>
              <span
                className="px-2 py-0.5 text-xs font-medium rounded border"
                style={{ color: crit.color, background: crit.bg, borderColor: crit.border }}
              >
                {product.criticality}
              </span>
              <span className="px-2 py-0.5 text-xs rounded border text-[#4A5568] border-[#D0D7E3] bg-[#F4F6F9]">
                {product.type.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#4A5568]">
              {product.hostingModel && (
                <span><span className="font-medium text-[#1A1A2E]">Hosting:</span> {product.hostingModel}</span>
              )}
              {product.owner && (
                <span><span className="font-medium text-[#1A1A2E]">Owner:</span> {product.owner}</span>
              )}
              {product.legalEntity && (
                <span><span className="font-medium text-[#1A1A2E]">Legal entity:</span> {product.legalEntity}</span>
              )}
              {product.applicationId && (
                <span><span className="font-medium text-[#1A1A2E]">Application ID:</span> {product.applicationId}</span>
              )}
            </div>
            {product.description && (
              <p className="text-[#4A5568] text-sm max-w-2xl mt-1">{product.description}</p>
            )}
          </div>
          <Link
            href={`/product-hub/products/${product.id}/compliance`}
            className="flex-shrink-0 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#003781' }}
          >
            Full Compliance Detail &rarr;
          </Link>
        </div>
      </div>

      {/* Compliance status matrix */}
      <div
        className="bg-white border border-[#D0D7E3] rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
      >
        <div className="px-6 py-4 border-b border-[#D0D7E3] bg-[#F4F6F9]">
          <h2 className="text-sm font-semibold text-[#003781] uppercase tracking-wide">Compliance Status Matrix</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#D0D7E3]">
              <th className="px-5 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Regulation</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Requirement</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Applicable</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Open Gaps</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D0D7E3]">
            {compliance.map(item => {
              const s = statusStyle(item.currentStatus)
              return (
                <tr
                  key={item.applicability.id}
                  className="hover:bg-[#F4F6F9] transition-colors"
                  style={item.currentStatus === 'NON_COMPLIANT' ? { background: 'rgba(228,0,43,0.03)' } : {}}
                >
                  <td className="px-5 py-3">
                    <span className="text-sm font-semibold text-[#003781]">
                      {item.source?.shortCode?.replace(/_/g, ' ') ?? '—'}
                    </span>
                    <p className="text-xs text-[#4A5568]">{item.source?.jurisdiction ?? ''}</p>
                  </td>
                  <td className="px-5 py-3 max-w-xs">
                    <p className="text-sm font-medium text-[#1A1A2E]">{item.requirement?.articleRef}</p>
                    <p className="text-xs text-[#4A5568] truncate">{item.requirement?.title}</p>
                  </td>
                  <td className="px-5 py-3">
                    {item.applicable ? (
                      <span className="text-[#0A7C59] text-sm font-medium">Yes</span>
                    ) : (
                      <span className="text-[#4A5568] text-sm">No</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="px-2.5 py-1 text-xs font-semibold rounded border"
                      style={{ color: s.color, background: s.bg, borderColor: s.border }}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {item.openGaps.length > 0 ? (
                      <span className="text-[#E4002B] font-semibold text-sm">
                        {item.openGaps.length} open
                      </span>
                    ) : (
                      <span className="text-[#4A5568]/50 text-sm">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Work products section */}
      <div
        className="bg-white border border-[#D0D7E3] rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
      >
        <div className="px-6 py-4 border-b border-[#D0D7E3] bg-[#F4F6F9]">
          <h2 className="text-sm font-semibold text-[#003781] uppercase tracking-wide">
            Work Products
            <span className="ml-2 font-normal text-[#4A5568] normal-case">({allWorkProducts.length} total)</span>
          </h2>
        </div>
        <div className="divide-y divide-[#D0D7E3]">
          {Object.entries(wpByReq).map(([reqId, group]) => (
            <div key={reqId} className="px-6 py-4">
              <div className="mb-3">
                <p className="text-xs font-semibold text-[#003781] uppercase tracking-wide">
                  {group.source?.shortCode?.replace(/_/g, ' ')} — {group.req?.articleRef}
                </p>
                <p className="text-xs text-[#4A5568]">{group.req?.title}</p>
              </div>
              <div className="space-y-2">
                {group.wps.map(wp => {
                  const s = statusStyle(wp.status)
                  return (
                    <div
                      key={wp.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-2.5"
                      style={{ borderColor: s.border, background: s.bg }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[#1A1A2E]">{wp.title}</span>
                        <span className="text-xs text-[#4A5568]">{wp.id}</span>
                      </div>
                      <span
                        className="px-2.5 py-0.5 text-xs font-semibold rounded border"
                        style={{ color: s.color, background: '#fff', borderColor: s.border }}
                      >
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {allWorkProducts.length === 0 && (
            <div className="px-6 py-8 text-center text-[#4A5568] text-sm">No work products found.</div>
          )}
        </div>
      </div>

      {/* Open gaps section */}
      <div
        className="bg-white border border-[#D0D7E3] rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
      >
        <div className="px-6 py-4 border-b border-[#D0D7E3] bg-[#F4F6F9] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#003781] uppercase tracking-wide">
            Open Product Gaps
          </h2>
          {allOpenGaps.length > 0 && (
            <span
              className="px-2.5 py-0.5 text-xs font-semibold rounded-full text-white"
              style={{ background: '#E4002B' }}
            >
              {allOpenGaps.length} open
            </span>
          )}
        </div>

        <div className="divide-y divide-[#D0D7E3]">
          {compliance.flatMap(item =>
            item.openGaps.map(gap => {
              const gt = gapTypeStyle(gap.gapType)
              const sv = severityStyle(gap.severity)
              return (
                <div key={gap.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-mono text-[#4A5568]">{gap.id}</span>
                        <span
                          className="px-2 py-0.5 text-xs font-medium rounded border"
                          style={{ color: gt.color, background: gt.bg, borderColor: gt.border }}
                        >
                          {gap.gapType}
                        </span>
                        <span
                          className="px-2 py-0.5 text-xs font-medium rounded border"
                          style={{ color: sv.color, background: sv.bg, borderColor: sv.border }}
                        >
                          {gap.severity}
                        </span>
                        <span className="text-xs text-[#4A5568]">
                          {item.source?.shortCode?.replace(/_/g, ' ')} · {item.requirement?.articleRef}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#1A1A2E] mb-1">{gap.title}</p>
                      <p className="text-sm text-[#4A5568]">{gap.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span
                        className="inline-block px-2.5 py-1 text-xs font-semibold rounded border"
                        style={{ color: '#B45309', background: 'rgba(180,83,9,0.08)', borderColor: 'rgba(180,83,9,0.25)' }}
                      >
                        {gap.status}
                      </span>
                      <p className="text-xs text-[#4A5568] mt-1">Detected {gap.detectedAt}</p>
                      {gap.status === 'OPEN' && (
                        <Link
                          href={`/remediation?productId=${productId}&requirementId=${gap.requirementId}`}
                          className="text-xs mt-1.5 inline-block hover:underline"
                          style={{ color: '#003781' }}
                        >
                          → Case
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          {allOpenGaps.length === 0 && (
            <div className="px-6 py-8 text-center">
              <p className="text-[#0A7C59] font-semibold text-sm">No open gaps — all requirements met.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
