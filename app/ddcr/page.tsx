'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, MinusCircle, Clock, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DDCRStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'EXCEPTION_APPROVED' | 'PENDING'

interface RegulationSummary {
  sourceId: string
  shortCode: string
  name: string
  status: DDCRStatus
  evidencePackageId: string | null
  requirementCount: number
  nonCompliantCount: number
  compliantCount: number
  notApplicableCount: number
}

interface RequirementSummary {
  requirementId: string | null
  sourceId: string | null
  status: DDCRStatus
  effectiveAt: string
  evidencePackageId: string | null
  notes: string | null
  title: string
  articleRef: string
  obligationType: string
  obligationLevel: string
  shortCode: string
}

interface ProductSummary {
  productId: string
  productName: string
  productType: string
  criticality: string
  overallStatus: DDCRStatus
  applicableRequirementCount: number
  nonCompliantRequirementCount: number
  byRegulation: RegulationSummary[]
  byRequirement: RequirementSummary[]
}

interface SummaryResponse {
  products: ProductSummary[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DDCRStatus, { label: string; color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  COMPLIANT: {
    label: 'COMPLIANT',
    color: '#0A7C59',
    bg: '#F0FAF6',
    icon: ({ className }) => <CheckCircle2 className={className} />,
  },
  NON_COMPLIANT: {
    label: 'NON-COMPLIANT',
    color: '#E4002B',
    bg: '#FFF0F3',
    icon: ({ className }) => <AlertCircle className={className} />,
  },
  NOT_APPLICABLE: {
    label: 'N/A',
    color: '#4A5568',
    bg: '#F7F8FA',
    icon: ({ className }) => <MinusCircle className={className} />,
  },
  EXCEPTION_APPROVED: {
    label: 'EXCEPTION',
    color: '#B45309',
    bg: '#FFFBEB',
    icon: ({ className }) => <Clock className={className} />,
  },
  PENDING: {
    label: 'PENDING',
    color: '#B45309',
    bg: '#FFFBEB',
    icon: ({ className }) => <Clock className={className} />,
  },
}

function StatusBadge({
  status,
  size = 'sm',
}: {
  status: DDCRStatus
  size?: 'sm' | 'lg'
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold rounded-md',
        size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}
    >
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      {cfg.label}
    </span>
  )
}

function ObligationTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    TECHNICAL_CONTROL: '#EBF5FF',
    PROCESS: '#F3E8FF',
    DOCUMENTATION: '#ECFDF5',
    GOVERNANCE: '#FFF7ED',
    REPORTING: '#F0F9FF',
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: colors[type] ?? '#F4F6F9', color: '#4A5568' }}
    >
      {type.replace('_', ' ')}
    </span>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function requirementSummaryText(reg: RegulationSummary): string {
  if (reg.notApplicableCount > 0 && reg.requirementCount === 0) return 'n/a'
  if (reg.nonCompliantCount > 0) {
    return `${reg.nonCompliantCount}/${reg.requirementCount} non-compliant`
  }
  if (reg.compliantCount === reg.requirementCount && reg.requirementCount > 0) {
    return `${reg.requirementCount}/${reg.requirementCount} compliant`
  }
  return `${reg.requirementCount} requirement${reg.requirementCount !== 1 ? 's' : ''}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function DDCRPage() {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ddcr/summary')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as SummaryResponse
      setData(json)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // For this view we focus on PROD-APP-X (first / primary product)
  const product = data?.products[0] ?? null

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold" style={{ color: '#003781' }}>
              DDCR
            </h1>
            <span className="text-lg font-normal text-[#4A5568]">
              Digital Disclosure &amp; Compliance Reporting
            </span>
          </div>
          <p className="text-sm text-[#4A5568]">
            Regulatory compliance status for IT App X across all applicable regulations.
            The evidence gate determines whether compliance can be asserted.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border border-[#D0D7E3] text-[#4A5568] hover:text-[#003781] hover:border-[#003781] transition-colors flex-shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* ── Loading / error states ───────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center h-48 text-[#4A5568]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading compliance data…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          <span className="font-semibold">Error loading data: </span>{error}
        </div>
      )}

      {product && (
        <>
          {/* ── Product status card ───────────────────────────────────────── */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: product.overallStatus === 'NON_COMPLIANT' ? '#E4002B40' : '#D0D7E3',
              boxShadow: '0 1px 3px rgba(0,56,129,0.08)',
            }}
          >
            {/* Status banner */}
            <div
              className="px-6 py-4"
              style={{
                backgroundColor: STATUS_CONFIG[product.overallStatus].bg,
                borderBottom: `1px solid ${STATUS_CONFIG[product.overallStatus].color}30`,
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={product.overallStatus} size="lg" />
                  <div>
                    <p className="font-bold text-lg" style={{ color: '#003781' }}>
                      {product.productName}
                    </p>
                    <p className="text-sm" style={{ color: '#4A5568' }}>
                      {product.productType.replace('_', ' ')} &middot; {product.criticality} criticality
                    </p>
                  </div>
                </div>
                <Link
                  href={`/ddcr/products/${product.productId}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: '#003781', textDecoration: 'none' }}
                >
                  View full detail
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Stats row */}
            <div className="px-6 py-4 bg-white">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat
                  value={String(product.applicableRequirementCount)}
                  label="Applicable requirements"
                />
                <Stat
                  value={String(product.nonCompliantRequirementCount)}
                  label="Non-compliant"
                  valueColor="#E4002B"
                />
                <Stat
                  value={String(
                    product.byRequirement.filter(r => r.status === 'COMPLIANT').length
                  )}
                  label="Compliant"
                  valueColor="#0A7C59"
                />
                <Stat
                  value={String(
                    product.byRequirement.filter(r => r.status === 'NOT_APPLICABLE').length
                  )}
                  label="Not applicable"
                  valueColor="#4A5568"
                />
              </div>
            </div>
          </div>

          {/* ── Regulation-level status table ─────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: '#003781' }}>
              Regulation-level Status
            </h2>
            <div
              className="rounded-xl overflow-hidden border"
              style={{ borderColor: '#D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
            >
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#003781' }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Regulation
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Requirements
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Evidence
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.byRegulation.map((reg, idx) => (
                    <tr
                      key={reg.sourceId ?? idx}
                      className="border-t"
                      style={{ borderColor: '#D0D7E3', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-sm" style={{ color: '#003781' }}>
                          {reg.shortCode}
                        </p>
                        <p className="text-xs text-[#4A5568] mt-0.5 max-w-xs">{reg.name}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={reg.status} />
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#4A5568]">
                        {reg.requirementCount === 0 && reg.notApplicableCount > 0
                          ? <span className="text-[#4A5568]">n/a</span>
                          : <span
                              style={{
                                color: reg.nonCompliantCount > 0 ? '#E4002B'
                                  : reg.compliantCount === reg.requirementCount && reg.requirementCount > 0 ? '#0A7C59'
                                  : '#4A5568',
                              }}
                            >
                              {requirementSummaryText(reg)}
                            </span>
                        }
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        {reg.evidencePackageId ? (
                          <span
                            className="font-mono text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: '#F0FAF6', color: '#0A7C59', border: '1px solid #0A7C5940' }}
                          >
                            {reg.evidencePackageId}
                          </span>
                        ) : (
                          <span className="text-[#A0ADB9]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Requirement-level detail table ────────────────────────────── */}
          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: '#003781' }}>
              Requirement-level Detail
            </h2>
            <div
              className="rounded-xl overflow-hidden border"
              style={{ borderColor: '#D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
            >
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#003781' }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Requirement
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Article
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Type
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Evidence
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">
                      Effective
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.byRequirement.map((req, idx) => (
                    <tr
                      key={req.requirementId ?? idx}
                      className="border-t"
                      style={{ borderColor: '#D0D7E3', backgroundColor: idx % 2 === 0 ? 'white' : '#F9FAFB' }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-sm" style={{ color: '#003781' }}>
                          {req.title}
                        </p>
                        <p className="text-xs text-[#4A5568] mt-0.5">
                          <span className="font-mono">{req.shortCode}</span>
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-[#4A5568] whitespace-nowrap">
                        {req.articleRef || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {req.obligationType
                          ? <ObligationTypeBadge type={req.obligationType} />
                          : <span className="text-[#A0ADB9] text-xs">—</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        {req.evidencePackageId ? (
                          <span
                            className="font-mono text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: '#F0FAF6', color: '#0A7C59', border: '1px solid #0A7C5940' }}
                          >
                            {req.evidencePackageId}
                          </span>
                        ) : (
                          <span className="text-[#A0ADB9]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#4A5568] whitespace-nowrap">
                        {req.effectiveAt ? formatDate(req.effectiveAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Compliance rule box ───────────────────────────────────────── */}
          <div
            className="rounded-xl p-5 border"
            style={{
              backgroundColor: '#FFF0F3',
              borderColor: '#E4002B40',
              boxShadow: '0 1px 3px rgba(0,56,129,0.08)',
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#E4002B' }} />
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: '#E4002B' }}>
                  Compliance Rule
                </p>
                <p className="text-sm" style={{ color: '#4A5568', lineHeight: '1.6' }}>
                  <strong style={{ color: '#003781' }}>IT App X overall status = COMPLIANT</strong>{' '}
                  only when <strong>ALL applicable requirements</strong> are COMPLIANT or covered by
                  an <strong>APPROVED EXCEPTION</strong>. Currently{' '}
                  <strong style={{ color: '#E4002B' }}>
                    {product.nonCompliantRequirementCount} mandatory requirement
                    {product.nonCompliantRequirementCount !== 1 ? 's are' : ' is'} non-compliant
                  </strong>
                  {' '}— the product cannot assert COMPLIANT status until all evidence gates pass.
                </p>
                <p className="text-xs mt-2 text-[#4A5568]">
                  Non-compliant requirements: {
                    product.byRequirement
                      .filter(r => r.status === 'NON_COMPLIANT')
                      .map(r => `${r.shortCode} — ${r.title}`)
                      .join('; ') || 'none'
                  }
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  valueColor = '#003781',
}: {
  value: string
  label: string
  valueColor?: string
}) {
  return (
    <div>
      <p className="text-2xl font-bold" style={{ color: valueColor }}>
        {value}
      </p>
      <p className="text-xs text-[#4A5568] mt-0.5">{label}</p>
    </div>
  )
}
