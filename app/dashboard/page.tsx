'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RegulationRef {
  id: string
  shortCode: string
  name: string
  pendingUpdates: number
}

interface MatrixRegulation {
  sourceId: string
  shortCode: string
  status: string
}

interface MatrixProduct {
  productId: string
  productName: string
  regulations: MatrixRegulation[]
}

interface DashboardSummary {
  products: {
    total: number
    byStatus: {
      COMPLIANT: number
      NON_COMPLIANT: number
      PENDING: number
      NOT_APPLICABLE: number
    }
  }
  regulations: RegulationRef[]
  complianceGaps: {
    total: number
    bySeverity: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number }
    open: number
  }
  pendingRegulatoryUpdates: number
  matrix: MatrixProduct[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MR_MIDNIGHT = '#003781'
const MR_GREEN = '#0A7C59'
const MR_RED = '#E4002B'
const MR_AMBER = '#B45309'

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  COMPLIANT: { label: 'Compliant', color: MR_GREEN, bg: '#F0FAF6', dot: MR_GREEN },
  NON_COMPLIANT: { label: 'Non-Compliant', color: MR_RED, bg: '#FFF0F3', dot: MR_RED },
  PENDING: { label: 'Pending', color: MR_AMBER, bg: '#FFFBEB', dot: MR_AMBER },
  NOT_APPLICABLE: { label: 'N/A', color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
  EXCEPTION_APPROVED: { label: 'Exception', color: MR_AMBER, bg: '#FFFBEB', dot: MR_AMBER },
}

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function KpiCard({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: number | string
  color?: string
  sub?: string
}) {
  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col gap-1"
      style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
    >
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5568' }}>
        {label}
      </span>
      <span className="text-3xl font-bold leading-none mt-1" style={{ color: color ?? MR_MIDNIGHT }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs mt-0.5" style={{ color: '#4A5568' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta(status)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}
    >
      <span
        className="inline-block rounded-full flex-shrink-0"
        style={{ width: 6, height: 6, background: meta.dot }}
      />
      {meta.label}
    </span>
  )
}

function SeverityBar({
  label,
  count,
  max,
  color,
  bg,
}: {
  label: string
  count: number
  max: number
  color: string
  bg: string
}) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-20 text-xs font-semibold flex-shrink-0"
        style={{ color }}
      >
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
        {count > 0 && (
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        )}
      </div>
      <span className="text-sm font-bold w-6 text-right flex-shrink-0" style={{ color }}>
        {count}
      </span>
      <span className="text-xs flex-shrink-0" style={{ color: '#9CA3AF', background: bg, padding: '0 6px', borderRadius: 4 }}>
        {label.toUpperCase()}
      </span>
    </div>
  )
}

function QuickLink({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg px-4 py-3 group transition-colors"
      style={{ border: '1px solid #D0D7E3', background: 'white' }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: MR_MIDNIGHT }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>{sub}</p>
      </div>
      <span className="text-base font-light transition-transform group-hover:translate-x-0.5" style={{ color: MR_MIDNIGHT }}>
        →
      </span>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard/summary')
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setData(json as DashboardSummary)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const gapSeverities = data
    ? [
        { label: 'Critical', count: data.complianceGaps.bySeverity.CRITICAL, color: MR_RED, bg: '#FEE2E2' },
        { label: 'High', count: data.complianceGaps.bySeverity.HIGH, color: MR_AMBER, bg: '#FEF3C7' },
        { label: 'Medium', count: data.complianceGaps.bySeverity.MEDIUM, color: '#003781', bg: '#EBF5FF' },
        { label: 'Low', count: data.complianceGaps.bySeverity.LOW, color: '#6B7280', bg: '#F3F4F6' },
      ]
    : []

  const maxGapCount = gapSeverities.length
    ? Math.max(...gapSeverities.map(s => s.count), 1)
    : 1

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: MR_MIDNIGHT }}>
            Compliance Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#4A5568' }}>
            Munich Re &middot; Multi-Regulation Overview &middot; As of {today}
          </p>
        </div>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16" style={{ color: '#4A5568' }}>
          <Spinner />
          <span>Loading compliance data…</span>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{ background: '#FEE2E2', color: MR_RED, border: '1px solid #FECACA' }}
        >
          {error}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {!loading && !error && data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard
              label="Total Products"
              value={data.products.total}
              sub="In scope"
            />
            <KpiCard
              label="Compliant"
              value={data.products.byStatus.COMPLIANT}
              color={MR_GREEN}
              sub="Fully compliant"
            />
            <KpiCard
              label="Non-Compliant"
              value={data.products.byStatus.NON_COMPLIANT}
              color={MR_RED}
              sub="Remediation required"
            />
            <KpiCard
              label="Open Gaps"
              value={data.complianceGaps.open}
              color={MR_AMBER}
              sub="Awaiting remediation"
            />
            <KpiCard
              label="Pending Reg. Updates"
              value={data.pendingRegulatoryUpdates}
              color={data.pendingRegulatoryUpdates > 0 ? MR_MIDNIGHT : '#6B7280'}
              sub="Regulatory versions"
            />
          </div>

          {/* Compliance Matrix */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: MR_MIDNIGHT }}>
                Multi-Regulation Status Matrix
              </h2>
              <span className="text-xs px-2 py-1 rounded" style={{ color: '#4A5568', background: '#F4F6F9', border: '1px solid #D0D7E3' }}>
                {data.matrix.length} product{data.matrix.length !== 1 ? 's' : ''}
                {' · '}
                {data.regulations.length} regulation{data.regulations.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div
              className="bg-white rounded-xl overflow-hidden"
              style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
            >
              {data.matrix.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: '#4A5568' }}>
                  No products found. Seed the database to populate the matrix.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr style={{ background: MR_MIDNIGHT }}>
                        <th
                          className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white"
                          style={{ minWidth: 180 }}
                        >
                          Product
                        </th>
                        {data.regulations.map(reg => (
                          <th
                            key={reg.id}
                            className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white"
                          >
                            <span className="font-mono">{reg.shortCode}</span>
                            {reg.pendingUpdates > 0 && (
                              <span
                                className="ml-1.5 inline-block px-1 py-0.5 rounded text-xs leading-none"
                                style={{ background: '#F59E0B', color: 'white', fontSize: 9 }}
                              >
                                {reg.pendingUpdates} pending
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.matrix.map((product, i) => (
                        <tr
                          key={product.productId}
                          style={{
                            borderTop: '1px solid #D0D7E3',
                            background: i % 2 === 0 ? 'white' : '#F9FAFB',
                          }}
                        >
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-sm" style={{ color: MR_MIDNIGHT }}>
                              {product.productName}
                            </p>
                            <p className="text-xs mt-0.5 font-mono" style={{ color: '#4A5568' }}>
                              {product.productId}
                            </p>
                          </td>
                          {product.regulations.map(reg => (
                            <td key={reg.sourceId} className="px-4 py-3.5 text-center">
                              <StatusPill status={reg.status} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Bottom two-panel row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Compliance Gaps */}
            <section>
              <h2 className="text-base font-semibold mb-3" style={{ color: MR_MIDNIGHT }}>
                Compliance Gaps
              </h2>
              <div
                className="bg-white rounded-xl p-5 space-y-4"
                style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
              >
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-2xl font-bold" style={{ color: MR_MIDNIGHT }}>
                    {data.complianceGaps.total}
                  </span>
                  <span className="text-sm" style={{ color: '#4A5568' }}>
                    total gaps &middot;{' '}
                    <span style={{ color: MR_AMBER, fontWeight: 600 }}>
                      {data.complianceGaps.open} open
                    </span>
                  </span>
                </div>
                <div className="space-y-3 pt-1">
                  {gapSeverities.map(s => (
                    <SeverityBar
                      key={s.label}
                      label={s.label}
                      count={s.count}
                      max={maxGapCount}
                      color={s.color}
                      bg={s.bg}
                    />
                  ))}
                </div>
                {data.complianceGaps.total === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: '#0A7C59' }}>
                    No compliance gaps detected.
                  </p>
                )}
              </div>
            </section>

            {/* Right: Quick Access */}
            <section>
              <h2 className="text-base font-semibold mb-3" style={{ color: MR_MIDNIGHT }}>
                Quick Access
              </h2>
              <div className="space-y-2">
                <QuickLink
                  href="/compliance-hub"
                  label="Compliance Hub"
                  sub="Gap analysis, regulations and control changes"
                />
                <QuickLink
                  href="/product-hub"
                  label="Product Hub"
                  sub="Product compliance status and work products"
                />
                <QuickLink
                  href="/ddcr"
                  label="DDCR"
                  sub="Digital Disclosure and Compliance Reporting"
                />
                <QuickLink
                  href="/evidence-centre"
                  label="Evidence Centre"
                  sub="Evidence packages and audit artifacts"
                />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
