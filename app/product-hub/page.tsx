'use client'
import { useEffect, useState } from 'react'
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

interface ComplianceItem {
  applicability: {
    id: string
    productId: string
    requirementId: string
    sourceId: string
    applicable: boolean
    applicabilityReason: string | null
    assessedAt: string
    assessedBy: string | null
  }
  requirement: {
    id: string
    sourceId: string
    articleRef: string
    title: string
    obligationType: string
  } | null
  source: {
    id: string
    shortCode: string
    name: string
  } | null
  applicable: boolean
  currentStatus: string
  openGaps: { id: string; status: string }[]
  workProducts: { id: string }[]
}

const REG_LABELS: Record<string, string> = {
  DORA: 'DORA',
  NIS2: 'NIS2',
  GDPR: 'GDPR',
  EU_AI_ACT: 'EU AI Act',
}

function statusStyle(status: string): { color: string; bg: string; border: string; label: string } {
  switch (status) {
    case 'COMPLIANT':
      return { color: '#0A7C59', bg: '#0A7C59/10', border: '#0A7C59/30', label: 'Compliant' }
    case 'NON_COMPLIANT':
      return { color: '#E4002B', bg: '#E4002B/10', border: '#E4002B/30', label: 'Non-Compliant' }
    case 'NOT_APPLICABLE':
      return { color: '#4A5568', bg: '#4A5568/10', border: '#4A5568/30', label: 'Not Applicable' }
    case 'IN_REMEDIATION':
      return { color: '#B45309', bg: '#B45309/10', border: '#B45309/30', label: 'In Remediation' }
    default:
      return { color: '#4A5568', bg: '#4A5568/10', border: '#4A5568/30', label: status.replace(/_/g, ' ') }
  }
}

function criticalityStyle(c: string) {
  switch (c.toUpperCase()) {
    case 'CRITICAL': return { color: '#E4002B', bg: 'rgba(228,0,43,0.08)', border: 'rgba(228,0,43,0.25)' }
    case 'HIGH': return { color: '#B45309', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.25)' }
    case 'MEDIUM': return { color: '#003781', bg: 'rgba(0,55,129,0.08)', border: 'rgba(0,55,129,0.25)' }
    default: return { color: '#4A5568', bg: 'rgba(74,85,104,0.08)', border: 'rgba(74,85,104,0.25)' }
  }
}

function deriveOverallStatus(items: ComplianceItem[]): string {
  if (items.some(i => i.applicable && i.currentStatus === 'NON_COMPLIANT')) return 'NON_COMPLIANT'
  if (items.some(i => i.applicable && i.currentStatus === 'IN_REMEDIATION')) return 'IN_REMEDIATION'
  if (items.some(i => i.applicable && i.currentStatus === 'COMPLIANT')) return 'COMPLIANT'
  return 'NOT_ASSESSED'
}

export default function ProductHubPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [complianceMap, setComplianceMap] = useState<Record<string, ComplianceItem[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/product-hub/products')
      .then(r => r.json())
      .then(async (prods: Product[]) => {
        setProducts(prods)
        const map: Record<string, ComplianceItem[]> = {}
        await Promise.all(
          prods.map(async p => {
            const res = await fetch(`/api/product-hub/products/${p.id}/compliance`)
            map[p.id] = await res.json()
          })
        )
        setComplianceMap(map)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#003781]">Product Hub</h1>
          <p className="text-[#4A5568] text-sm mt-1">Loading product compliance data…</p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-[#F4F6F9] rounded-lg border border-[#D0D7E3]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#003781]">Product Hub</h1>
        <p className="text-[#4A5568] text-sm mt-1">
          Approved control changes &rarr; product gap analysis &rarr; remediation tracking
        </p>
      </div>

      {/* Product cards */}
      <div className="space-y-6">
        {products.map(product => {
          const items: ComplianceItem[] = complianceMap[product.id] ?? []
          const overallStatus = deriveOverallStatus(items)
          const overall = statusStyle(overallStatus)
          const totalOpenGaps = items.reduce((s, i) => s + i.openGaps.length, 0)
          const crit = criticalityStyle(product.criticality)

          // Build per-regulation map: shortCode -> worst status
          const regStatus: Record<string, string> = {}
          for (const item of items) {
            const code = item.source?.shortCode ?? 'UNKNOWN'
            if (!regStatus[code]) {
              regStatus[code] = item.currentStatus
            } else {
              // NON_COMPLIANT wins over everything
              if (item.currentStatus === 'NON_COMPLIANT') regStatus[code] = 'NON_COMPLIANT'
              else if (item.currentStatus === 'IN_REMEDIATION' && regStatus[code] !== 'NON_COMPLIANT') regStatus[code] = 'IN_REMEDIATION'
            }
          }

          const regOrder = ['DORA', 'NIS2', 'GDPR', 'EU_AI_ACT']

          return (
            <div
              key={product.id}
              className="bg-white border border-[#D0D7E3] rounded-xl overflow-hidden"
              style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
            >
              {/* Overall status bar */}
              <div
                className="px-6 py-3 flex items-center justify-between"
                style={{ background: overall.color, color: '#fff' }}
              >
                <span className="text-sm font-semibold tracking-wide">
                  OVERALL COMPLIANCE STATUS: {overall.label.toUpperCase()}
                </span>
                {overallStatus === 'NON_COMPLIANT' && (
                  <span className="text-xs font-medium opacity-80">
                    Action required — {totalOpenGaps} open gap{totalOpenGaps !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Product info */}
              <div className="px-6 py-5 border-b border-[#D0D7E3]">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-bold text-[#003781]">{product.name}</h2>
                      <span
                        className="px-2 py-0.5 text-xs font-medium rounded border"
                        style={{ color: crit.color, background: crit.bg, borderColor: crit.border }}
                      >
                        {product.criticality}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded border text-[#4A5568] border-[#D0D7E3] bg-[#F4F6F9]">
                        {product.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[#4A5568] text-sm">
                      {product.hostingModel && (
                        <span>
                          <span className="font-medium">Hosting:</span> {product.hostingModel}
                        </span>
                      )}
                      {product.owner && (
                        <span>
                          <span className="font-medium">Owner:</span> {product.owner}
                        </span>
                      )}
                      {product.legalEntity && (
                        <span>
                          <span className="font-medium">Entity:</span> {product.legalEntity}
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-[#4A5568] text-sm mt-2 max-w-2xl">{product.description}</p>
                    )}
                  </div>
                  <Link
                    href={`/product-hub/products/${product.id}`}
                    className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: '#003781' }}
                  >
                    View Detail &rarr;
                  </Link>
                </div>
              </div>

              {/* Per-regulation status grid */}
              <div className="px-6 py-5 border-b border-[#D0D7E3]">
                <p className="text-xs font-medium text-[#4A5568] uppercase tracking-wide mb-3">
                  Compliance by Regulation
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {regOrder.map(code => {
                    const st = regStatus[code] ?? 'NOT_ASSESSED'
                    const s = statusStyle(st)
                    return (
                      <div
                        key={code}
                        className="rounded-lg border p-3"
                        style={{
                          borderColor: s.color,
                          background: st === 'NON_COMPLIANT'
                            ? 'rgba(228,0,43,0.05)'
                            : st === 'COMPLIANT'
                            ? 'rgba(10,124,89,0.05)'
                            : 'rgba(74,85,104,0.04)',
                        }}
                      >
                        <p className="text-xs font-bold text-[#003781] mb-1">
                          {REG_LABELS[code] ?? code}
                        </p>
                        <p className="text-sm font-semibold" style={{ color: s.color }}>
                          {s.label}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer: gaps summary */}
              <div className="px-6 py-4 bg-[#F4F6F9] flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: totalOpenGaps > 0 ? '#E4002B' : '#0A7C59' }}
                    />
                    <span className="text-sm text-[#4A5568]">
                      <span className="font-semibold text-[#1A1A2E]">{totalOpenGaps}</span> open product gap{totalOpenGaps !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#4A5568' }} />
                    <span className="text-sm text-[#4A5568]">
                      <span className="font-semibold text-[#1A1A2E]">{items.filter(i => i.applicable).length}</span> applicable regulation{items.filter(i => i.applicable).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/product-hub/products/${product.id}/compliance`}
                  className="text-sm font-medium hover:underline"
                  style={{ color: '#003781' }}
                >
                  View compliance detail &rarr;
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {products.length === 0 && !loading && (
        <div className="text-center py-16 text-[#4A5568]">
          <p className="text-lg">No products found in the registry.</p>
        </div>
      )}
    </div>
  )
}
