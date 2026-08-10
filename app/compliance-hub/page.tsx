'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RegulatorySource {
  id: string
  shortCode: string
  name: string
  jurisdiction: string
  status: string
  effectiveDate: string | null
  requirementCount: number
  gapCount: number
}

interface Requirement {
  id: string
  articleRef: string
  title: string
  obligationType: string
}

interface ComplianceGap {
  id: string
  title: string
  severity: string
  gapType: string
  status: string
  detectedAt: string
  requirement: Requirement | null
  source: { id: string; shortCode: string; name: string } | null
}

interface ControlChange {
  id: string
  title: string
  changeType: string
  status: string
  proposedAt: string | null
  approvedAt: string | null
  publishedAt: string | null
  gap: { id: string; title: string; source: { shortCode: string } | null } | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function statusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'OPEN': return { bg: '#FEE2E2', text: '#E4002B', label: 'Open' }
    case 'IN_ANALYSIS': return { bg: '#FEF3C7', text: '#B45309', label: 'In Analysis' }
    case 'CHANGE_PROPOSED': return { bg: '#EBF5FF', text: '#003781', label: 'Change Proposed' }
    case 'APPROVED': return { bg: '#D1FAE5', text: '#0A7C59', label: 'Approved' }
    case 'PUBLISHED': return { bg: '#065F46', text: '#ffffff', label: 'Published' }
    case 'CLOSED': return { bg: '#F3F4F6', text: '#6B7280', label: 'Closed' }
    case 'DRAFT': return { bg: '#F3F4F6', text: '#6B7280', label: 'Draft' }
    case 'UNDER_REVIEW': return { bg: '#FEF3C7', text: '#B45309', label: 'Under Review' }
    case 'REJECTED': return { bg: '#FEE2E2', text: '#E4002B', label: 'Rejected' }
    case 'active': return { bg: '#D1FAE5', text: '#0A7C59', label: 'Active' }
    default: return { bg: '#F3F4F6', text: '#6B7280', label: status }
  }
}

function severityBadge(severity: string): { bg: string; text: string } {
  switch (severity) {
    case 'CRITICAL': return { bg: '#7F1D1D', text: '#ffffff' }
    case 'HIGH': return { bg: '#FEE2E2', text: '#E4002B' }
    case 'MEDIUM': return { bg: '#FEF3C7', text: '#B45309' }
    case 'LOW': return { bg: '#F3F4F6', text: '#6B7280' }
    default: return { bg: '#F3F4F6', text: '#6B7280' }
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function KpiCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div
      className="bg-white rounded-lg p-5 flex flex-col gap-1"
      style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#4A5568' }}>{label}</span>
      <span className="text-3xl font-bold" style={{ color: '#003781' }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: '#4A5568' }}>{sub}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ComplianceHubPage() {
  const [sources, setSources] = useState<RegulatorySource[]>([])
  const [gaps, setGaps] = useState<ComplianceGap[]>([])
  const [changes, setChanges] = useState<ControlChange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [srcRes, gapRes, chgRes] = await Promise.all([
          fetch('/api/compliance-hub/regulations'),
          fetch('/api/compliance-hub/gaps'),
          fetch('/api/compliance-hub/control-changes'),
        ])
        const [srcData, gapData, chgData] = await Promise.all([
          srcRes.json(),
          gapRes.json(),
          chgRes.json(),
        ])
        if (srcData.error) throw new Error(srcData.error)
        if (gapData.error) throw new Error(gapData.error)
        if (chgData.error) throw new Error(chgData.error)
        setSources(srcData as RegulatorySource[])
        setGaps(gapData as ComplianceGap[])
        setChanges(chgData as ControlChange[])
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const openGaps = gaps.filter(g => g.status !== 'CLOSED').length
  const approvedChanges = changes.filter(c => c.status === 'APPROVED').length
  const publishedChanges = changes.filter(c => c.status === 'PUBLISHED').length

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#003781' }}>Compliance Hub</h1>
        <p className="text-sm mt-1" style={{ color: '#4A5568' }}>
          Regulatory change &rarr; internal gap analysis &rarr; approved control changes
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-12 justify-center" style={{ color: '#4A5568' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading…
        </div>
      )}

      {error && (
        <div className="rounded-lg p-4 text-sm" style={{ background: '#FEE2E2', color: '#E4002B', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Regulations monitored" value={sources.length} sub="EU regulatory framework" />
            <KpiCard label="Open gaps" value={openGaps} sub="Awaiting remediation" />
            <KpiCard label="Approved changes" value={approvedChanges} sub="Control changes approved" />
            <KpiCard label="Published changes" value={publishedChanges} sub="Live in control catalogue" />
          </div>

          {/* Regulatory Intelligence Scanner panel */}
          <div
            className="rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap"
            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="text-base mt-0.5" style={{ color: '#003781' }}>⚡</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#003781' }}>Regulatory Intelligence Scanner</p>
                <p className="text-xs mt-0.5" style={{ color: '#1E40AF' }}>
                  Live EUR-Lex CELLAR API + o3 AI — scans DORA, NIS2 &amp; GDPR for implementing acts, RTS/ITS, and new guidance. Checks against all controls and policies.
                </p>
              </div>
            </div>
            <Link
              href="/compliance-hub/regulatory-intelligence"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded flex-shrink-0"
              style={{ background: '#003781', color: 'white', textDecoration: 'none' }}
            >
              ⚡ Open Scanner →
            </Link>
          </div>

          {/* Regulations table */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: '#003781' }}>Regulations</h2>
              <Link
                href="/compliance-hub/regulations"
                className="text-xs font-medium px-3 py-1.5 rounded"
                style={{ color: '#003781', border: '1px solid #D0D7E3', background: 'white' }}
              >
                View all regulations
              </Link>
            </div>
            <div
              className="bg-white rounded-lg overflow-hidden"
              style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F4F6F9', borderBottom: '1px solid #D0D7E3' }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5568' }}>Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5568' }}>Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5568' }}>Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5568' }}>Requirements</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A5568' }}>Gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((src, i) => {
                    const badge = statusBadge(src.status)
                    return (
                      <tr
                        key={src.id}
                        style={{ borderTop: i > 0 ? '1px solid #D0D7E3' : undefined }}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#EBF5FF', color: '#003781' }}>
                            {src.shortCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#003781' }}>
                          <Link href="/compliance-hub/regulations" className="hover:underline">{src.name}</Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: badge.bg, color: badge.text }}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-medium" style={{ color: '#003781' }}>
                          {src.requirementCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="font-medium"
                            style={{ color: src.gapCount > 0 ? '#E4002B' : '#0A7C59' }}
                          >
                            {src.gapCount}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Gaps section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: '#003781' }}>Compliance Gaps</h2>
            </div>
            <div className="space-y-3">
              {gaps.length === 0 && (
                <p className="text-sm py-6 text-center" style={{ color: '#4A5568' }}>No compliance gaps found.</p>
              )}
              {gaps.map(gap => {
                const badge = statusBadge(gap.status)
                const sev = severityBadge(gap.severity)
                return (
                  <Link
                    key={gap.id}
                    href={`/compliance-hub/gaps/${gap.id}`}
                    className="block bg-white rounded-lg p-4 hover:border-[#003781] transition-colors"
                    style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {gap.source && (
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#EBF5FF', color: '#003781' }}>
                              {gap.source.shortCode}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: sev.bg, color: sev.text }}>
                            {gap.severity}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                            {gap.gapType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="font-semibold text-sm" style={{ color: '#003781' }}>{gap.title}</p>
                        {gap.requirement && (
                          <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>
                            {gap.requirement.articleRef} — {gap.requirement.title}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.text }}>
                          {badge.label}
                        </span>
                        <span className="text-xs" style={{ color: '#4A5568' }}>{formatDate(gap.detectedAt)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* Recent control changes */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: '#003781' }}>Recent Control Changes</h2>
            </div>
            <div className="space-y-3">
              {changes.length === 0 && (
                <p className="text-sm py-6 text-center" style={{ color: '#4A5568' }}>No control changes found.</p>
              )}
              {changes.map(change => {
                const badge = statusBadge(change.status)
                return (
                  <Link
                    key={change.id}
                    href={`/compliance-hub/changes/${change.id}`}
                    className="block bg-white rounded-lg p-4 hover:border-[#003781] transition-colors"
                    style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {change.gap?.source && (
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#EBF5FF', color: '#003781' }}>
                              {change.gap.source.shortCode}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                            {change.changeType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="font-semibold text-sm" style={{ color: '#003781' }}>{change.title}</p>
                        {change.gap && (
                          <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>Gap: {change.gap.title}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.text }}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
