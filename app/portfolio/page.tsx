'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'

// ─── Legacy backup types ──────────────────────────────────────────────────────

interface PortfolioApp {
  id: string
  appId: string
  name: string
  criticality: string
  backupCompliant: boolean
  geoRedundant: boolean
  exceptions: Array<{ type: string; description: string }>
}

// ─── Multi-reg types ──────────────────────────────────────────────────────────

type DDCRStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'NOT_ASSESSED' | 'EXCEPTION_APPROVED'

interface RegulationStatus {
  sourceId: string
  shortCode: string
  name: string
  status: DDCRStatus
  applicable: boolean
}

interface ProductCompliance {
  productId: string
  productName: string
  productType: string
  criticality: string
  owner: string | null
  overallStatus: DDCRStatus
  byRegulation: RegulationStatus[]
}

interface ComplianceResponse {
  products: ProductCompliance[]
  regulations: { id: string; shortCode: string; name: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<DDCRStatus, { label: string; color: string; bg: string; border: string }> = {
  COMPLIANT:         { label: 'Compliant',     color: '#0A7C59', bg: '#F0FAF6', border: '#0A7C59' },
  NON_COMPLIANT:     { label: 'Non-Compliant', color: '#E4002B', bg: '#FFF0F3', border: '#E4002B' },
  NOT_APPLICABLE:    { label: 'N/A',           color: '#4A5568', bg: '#F7F8FA', border: '#D0D7E3' },
  NOT_ASSESSED:      { label: 'Not Assessed',  color: '#B45309', bg: '#FFFBEB', border: '#B45309' },
  EXCEPTION_APPROVED:{ label: 'Exception',     color: '#7C3AED', bg: '#F5F3FF', border: '#7C3AED' },
}

function StatusBadge({ status }: { status: DDCRStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.NOT_ASSESSED
  return (
    <span
      className="px-2 py-0.5 text-xs font-semibold rounded border"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {s.label}
    </span>
  )
}

function criticalityStyle(c: string) {
  if (c === 'CRITICAL' || c === 'Critical') return 'bg-[#E4002B]/10 text-[#E4002B] border-[#E4002B]/30'
  if (c === 'HIGH' || c === 'High') return 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30'
  if (c === 'MEDIUM' || c === 'Medium') return 'bg-[#0066B2]/10 text-[#0066B2] border-[#0066B2]/30'
  return 'bg-[#F4F6F9] text-[#4A5568] border-[#D0D7E3]'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [apps, setApps] = useState<PortfolioApp[]>([])
  const [compliance, setCompliance] = useState<ComplianceResponse | null>(null)
  const [filter, setFilter] = useState<'all' | 'compliant' | 'non-compliant'>('all')
  const [view, setView] = useState<'backup' | 'multi-reg'>('multi-reg')

  useEffect(() => {
    fetch('/api/portfolio').then(r => r.json()).then(setApps)
    fetch('/api/portfolio/compliance').then(r => r.json()).then(setCompliance)
  }, [])

  const filtered = apps.filter(a => {
    if (filter === 'compliant') return a.backupCompliant
    if (filter === 'non-compliant') return !a.backupCompliant
    return true
  })

  const compliantCount = apps.filter(a => a.backupCompliant).length
  const pct = apps.length ? Math.round((compliantCount / apps.length) * 100) : 0

  const multiRegProducts = compliance?.products ?? []
  const regulations = compliance?.regulations ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#003781' }}>Application Portfolio</h1>
          <p className="text-sm mt-1" style={{ color: '#4A5568' }}>
            Multi-regulation compliance status across IT applications
          </p>
        </div>
        {/* View toggle */}
        <div
          className="flex rounded-lg overflow-hidden border"
          style={{ borderColor: '#D0D7E3' }}
        >
          {(['multi-reg', 'backup'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: view === v ? '#003781' : 'white',
                color: view === v ? 'white' : '#4A5568',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {v === 'multi-reg' ? 'Multi-Regulation' : 'DORA Backup (Legacy)'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Multi-Regulation View ──────────────────────────────────────── */}
      {view === 'multi-reg' && (
        <>
          {/* Summary KPIs */}
          {multiRegProducts.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
                <p className="text-[#4A5568] text-sm mb-1">Products</p>
                <p className="text-3xl font-bold" style={{ color: '#003781' }}>{multiRegProducts.length}</p>
                <p className="text-xs mt-1 text-[#4A5568]">in scope</p>
              </div>
              <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
                <p className="text-[#4A5568] text-sm mb-1">Regulations</p>
                <p className="text-3xl font-bold" style={{ color: '#003781' }}>{regulations.length}</p>
                <p className="text-xs mt-1 text-[#4A5568]">monitored</p>
              </div>
              <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
                <p className="text-[#4A5568] text-sm mb-1">Overall Compliant</p>
                <p className="text-3xl font-bold" style={{ color: '#0A7C59' }}>
                  {multiRegProducts.filter(p => p.overallStatus === 'COMPLIANT').length}
                </p>
                <p className="text-xs mt-1 text-[#4A5568]">products</p>
              </div>
              <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
                <p className="text-[#4A5568] text-sm mb-1">Non-Compliant</p>
                <p className="text-3xl font-bold" style={{ color: '#E4002B' }}>
                  {multiRegProducts.filter(p => p.overallStatus === 'NON_COMPLIANT').length}
                </p>
                <p className="text-xs mt-1 text-[#4A5568]">require action</p>
              </div>
            </div>
          )}

          {/* Compliance matrix */}
          <div className="bg-white border border-[#D0D7E3] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #D0D7E3', background: '#F4F6F9' }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A5568' }}>
                Compliance Matrix
              </span>
              <Link href="/ddcr" className="text-xs" style={{ color: '#003781' }}>
                View full DDCR →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #D0D7E3', background: '#F4F6F9' }}>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#4A5568', minWidth: 180 }}>
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#4A5568' }}>
                      Overall
                    </th>
                    {regulations.map(r => (
                      <th key={r.id} className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#4A5568' }}>
                        {r.shortCode}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: '#4A5568' }}>
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#D0D7E3' }}>
                  {multiRegProducts.map(product => (
                    <tr key={product.productId} className="hover:bg-[#F4F6F9] transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <span className="text-sm font-semibold" style={{ color: '#003781' }}>
                            {product.productName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="px-1.5 py-0.5 text-xs rounded border"
                            style={{
                              background: '#F4F6F9',
                              borderColor: '#D0D7E3',
                              color: '#4A5568',
                            }}
                          >
                            {product.criticality}
                          </span>
                          <span className="text-xs" style={{ color: '#4A5568' }}>{product.owner ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={product.overallStatus as DDCRStatus} />
                      </td>
                      {regulations.map(reg => {
                        const regStatus = product.byRegulation.find(r => r.sourceId === reg.id)
                        const status = (regStatus?.status ?? 'NOT_ASSESSED') as DDCRStatus
                        return (
                          <td key={reg.id} className="px-4 py-4">
                            <StatusBadge status={status} />
                          </td>
                        )
                      })}
                      <td className="px-4 py-4">
                        <Link
                          href={`/ddcr/products/${product.productId}`}
                          className="text-xs font-medium"
                          style={{ color: '#003781' }}
                        >
                          DDCR →
                        </Link>
                        {' '}
                        <Link
                          href={`/product-hub/products/${product.productId}`}
                          className="text-xs font-medium"
                          style={{ color: '#4A5568' }}
                        >
                          Hub →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {multiRegProducts.length === 0 && (
                    <tr>
                      <td colSpan={regulations.length + 4} className="px-4 py-8 text-center text-sm" style={{ color: '#4A5568' }}>
                        No products found. Seed the database to populate this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 px-1">
            <span className="text-xs" style={{ color: '#4A5568' }}>Legend:</span>
            {Object.entries(STATUS_STYLE).map(([key, s]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="px-2 py-0.5 text-xs rounded border"
                  style={{ color: s.color, background: s.bg, borderColor: s.border }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Legacy Backup View ─────────────────────────────────────────── */}
      {view === 'backup' && (
        <>
          <p className="text-xs px-1" style={{ color: '#B45309' }}>
            Legacy view — DORA Article 12 backup compliance only. Use Multi-Regulation view for the full compliance picture.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
              <p className="text-[#4A5568] text-sm mb-1">Portfolio Size</p>
              <p className="text-3xl font-bold text-[#1A1A2E]">{apps.length}</p>
              <p className="text-[#4A5568] text-xs mt-1">applications</p>
            </div>
            <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
              <p className="text-[#4A5568] text-sm mb-1">Backup Compliant</p>
              <p className="text-3xl font-bold text-[#0A7C59]">{compliantCount}</p>
              <p className="text-[#4A5568] text-xs mt-1">{pct}% of portfolio</p>
            </div>
            <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
              <p className="text-[#4A5568] text-sm mb-1">Exceptions</p>
              <p className="text-3xl font-bold text-[#E4002B]">{apps.length - compliantCount}</p>
              <p className="text-[#4A5568] text-xs mt-1">pending remediation</p>
            </div>
          </div>

          {/* Compliance bar */}
          <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#1A1A2E] text-sm font-medium">Overall Backup Compliance</span>
              <span className="text-[#0A7C59] font-semibold">{pct}%</span>
            </div>
            <div className="h-3 bg-[#F4F6F9] rounded-full overflow-hidden border border-[#D0D7E3]">
              <div
                className="h-full bg-gradient-to-r from-[#003781] to-[#0A7C59] transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[#4A5568]/70 text-xs mt-2">Target: 100% — DORA Article 12 compliance required</p>
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            {(['all', 'compliant', 'non-compliant'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-md border transition-colors',
                  filter === f
                    ? 'bg-[#003781]/10 text-[#003781] border-[#003781]/30'
                    : 'text-[#4A5568] border-[#D0D7E3] hover:border-[#003781]/30'
                )}
              >
                {f === 'all' ? 'All Apps' : f === 'compliant' ? 'Compliant' : 'Non-Compliant'}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white border border-[#D0D7E3] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D0D7E3] bg-[#F4F6F9]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Application</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Criticality</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Backup Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Geo-Redundant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D0D7E3]">
                {filtered.map(app => (
                  <tr key={app.id} className={clsx(
                    'hover:bg-[#F4F6F9] transition-colors',
                    app.appId === 'APP-X-001' ? 'bg-[#003781]/5' : ''
                  )}>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-[#1A1A2E] text-sm font-medium">{app.name}</span>
                        {app.appId === 'APP-X-001' && (
                          <span className="ml-2 px-1.5 py-0.5 bg-[#003781]/10 text-[#003781] text-xs rounded border border-[#003781]/20">Demo Subject</span>
                        )}
                      </div>
                      <p className="text-[#4A5568]/60 text-xs">{app.appId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 text-xs rounded border', criticalityStyle(app.criticality))}>
                        {app.criticality}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-sm font-medium', app.backupCompliant ? 'text-[#0A7C59]' : 'text-[#E4002B]')}>
                        {app.backupCompliant ? 'Compliant' : 'Non-Compliant'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={app.geoRedundant ? 'text-[#0A7C59]' : 'text-[#4A5568]/40'}>
                        {app.geoRedundant ? 'Yes (GRZ)' : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
