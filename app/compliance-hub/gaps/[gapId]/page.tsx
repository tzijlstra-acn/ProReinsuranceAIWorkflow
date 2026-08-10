'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { use } from 'react'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Requirement {
  id: string
  articleRef: string
  title: string
  description: string
  obligationType: string
  obligationLevel: string
}

interface ComplianceGap {
  id: string
  requirementId: string
  sourceId: string
  title: string
  description: string
  severity: string
  gapType: string
  status: string
  detectedAt: string
  affectedDocumentIds: string[]
  aiAnalysis: string | null
  createdAt: string | null
  requirement: Requirement | null
  source: { id: string; shortCode: string; name: string } | null
}

interface ControlChange {
  id: string
  gapId: string
  title: string
  status: string
  changeType: string
  proposedAt: string | null
  approvedAt: string | null
  publishedAt: string | null
}

interface LinkedRemediationCase {
  id: string
  title: string
  status: string
}

interface ProductOption {
  id: string
  name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
    case 'IN_PROGRESS': return { bg: '#EBF5FF', text: '#003781', label: 'In Progress' }
    case 'BLOCKED': return { bg: '#FEE2E2', text: '#E4002B', label: 'Blocked' }
    case 'RESOLVED': return { bg: '#D1FAE5', text: '#0A7C59', label: 'Resolved' }
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

// ─────────────────────────────────────────────────────────────────────────────
// Status timeline
// ─────────────────────────────────────────────────────────────────────────────

const GAP_STATUSES = ['OPEN', 'IN_ANALYSIS', 'CHANGE_PROPOSED', 'APPROVED', 'CLOSED'] as const

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = GAP_STATUSES.indexOf(currentStatus as typeof GAP_STATUSES[number])
  return (
    <div className="flex items-center gap-0">
      {GAP_STATUSES.map((s, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        const isUpcoming = i > currentIdx
        const badge = statusBadge(s)

        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2"
                style={{
                  background: isCurrent ? badge.bg : isPast ? '#0A7C59' : '#F4F6F9',
                  borderColor: isCurrent ? badge.text : isPast ? '#0A7C59' : '#D0D7E3',
                  color: isCurrent ? badge.text : isPast ? '#ffffff' : '#4A5568',
                }}
              >
                {isPast ? '✓' : i + 1}
              </div>
              <span
                className="text-xs mt-1 text-center max-w-[70px] leading-tight"
                style={{ color: isCurrent ? badge.text : isUpcoming ? '#D0D7E3' : '#0A7C59', fontWeight: isCurrent ? 600 : 400 }}
              >
                {s.replace(/_/g, ' ')}
              </span>
            </div>
            {i < GAP_STATUSES.length - 1 && (
              <div
                className="w-10 h-0.5 mb-5 mx-0.5"
                style={{ background: isPast ? '#0A7C59' : '#D0D7E3' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function GapDetailPage({ params }: { params: Promise<{ gapId: string }> }) {
  const { gapId } = use(params)
  const router = useRouter()

  const [gap, setGap] = useState<ComplianceGap | null>(null)
  const [linkedChange, setLinkedChange] = useState<ControlChange | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [linkedCases, setLinkedCases] = useState<LinkedRemediationCase[]>([])
  const [showRemediationForm, setShowRemediationForm] = useState(false)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [remediationProductId, setRemediationProductId] = useState('')
  const [remediationPriority, setRemediationPriority] = useState('')
  const [creatingCase, setCreatingCase] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function handleGenerateChange() {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch(`/api/compliance-hub/gaps/${gapId}/generate-change`, { method: 'POST' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? 'Generation failed')
      router.push(`/compliance-hub/changes/${data.controlChange.id}`)
    } catch (err) {
      setGenError(String(err))
      setGenerating(false)
    }
  }

  async function handleOpenRemediationForm() {
    if (!gap) return
    setShowRemediationForm(true)
    setRemediationPriority(gap.severity)
    if (products.length === 0) {
      const res = await fetch('/api/product-hub/products')
      const data = await res.json()
      if (Array.isArray(data)) {
        setProducts(data)
        if (data.length > 0) setRemediationProductId(data[0].id)
      }
    }
  }

  async function handleCreateCase() {
    if (!gap || !remediationProductId) return
    setCreatingCase(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/remediation/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: remediationProductId,
          requirementId: gap.requirementId,
          sourceId: gap.sourceId,
          title: 'Remediate: ' + gap.title,
          description: gap.description,
          priority: remediationPriority,
          assignedTo: '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Creation failed')
      window.location.href = `/remediation/${data.id}`
    } catch (err) {
      setCreateError(String(err))
      setCreatingCase(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/compliance-hub/gaps/${gapId}`)
        const data = await res.json() as ComplianceGap | { error: string }
        if ('error' in data) throw new Error(String(data.error))
        setGap(data)

        // Load linked remediation cases
        const casesRes = await fetch(`/api/remediation/cases?requirementId=${data.requirementId}`)
        const casesData = await casesRes.json()
        if (Array.isArray(casesData)) setLinkedCases(casesData)

        // Load control changes to find one linked to this gap
        const chgRes = await fetch('/api/compliance-hub/control-changes')
        const chgData = await chgRes.json() as ControlChange[]
        if (Array.isArray(chgData)) {
          const linked = chgData.find(c => c.gapId === gapId) ?? null
          setLinkedChange(linked)
        }
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [gapId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center" style={{ color: '#4A5568' }}>
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading gap…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg p-4 text-sm max-w-2xl" style={{ background: '#FEE2E2', color: '#E4002B', border: '1px solid #FECACA' }}>
        {error}
      </div>
    )
  }

  if (!gap) return null

  const badge = statusBadge(gap.status)
  const sev = severityBadge(gap.severity)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: '#4A5568' }}>
        <Link href="/compliance-hub" className="hover:underline">Compliance Hub</Link>
        <span style={{ color: '#D0D7E3' }}>/</span>
        <span style={{ color: '#003781' }}>Gap: {gap.id}</span>
      </div>

      {/* Header card */}
      <div
        className="bg-white rounded-xl p-6"
        style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {gap.source && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#EBF5FF', color: '#003781' }}>
                  {gap.source.shortCode}
                </span>
              )}
              <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                {gap.id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: sev.bg, color: sev.text }}>
                {gap.severity}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                {gap.gapType.replace(/_/g, ' ')}
              </span>
            </div>
            <h1 className="text-xl font-bold" style={{ color: '#003781' }}>{gap.title}</h1>
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: badge.bg, color: badge.text }}>
              {badge.label}
            </span>
            <p className="text-xs mt-2" style={{ color: '#4A5568' }}>Detected {formatDate(gap.detectedAt)}</p>

            {/* AI: Generate Control Change — only when OPEN or IN_ANALYSIS and no linked change yet */}
            {(gap.status === 'OPEN' || gap.status === 'IN_ANALYSIS') && !linkedChange && (
              <div className="mt-3">
                <button
                  disabled={generating}
                  onClick={handleGenerateChange}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded transition-opacity"
                  style={{
                    background: '#7C3AED',
                    color: 'white',
                    border: 'none',
                    opacity: generating ? 0.7 : 1,
                    cursor: generating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generating ? (
                    <>
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Generating…
                    </>
                  ) : (
                    <>
                      <span>✦</span>
                      AI: Generate Control Change
                    </>
                  )}
                </button>
                {genError && (
                  <p className="text-xs mt-1 text-right" style={{ color: '#E4002B' }}>{genError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-sm mt-4 leading-relaxed" style={{ color: '#4A5568' }}>{gap.description}</p>
      </div>

      {/* Status timeline */}
      <div
        className="bg-white rounded-xl p-6"
        style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#003781' }}>Status Timeline</h2>
        <StatusTimeline currentStatus={gap.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Requirement details */}
        {gap.requirement && (
          <div
            className="bg-white rounded-xl p-5"
            style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#003781' }}>Linked Requirement</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                  {gap.requirement.articleRef}
                </span>
                <span className="font-mono text-xs" style={{ color: '#4A5568' }}>{gap.requirement.id}</span>
              </div>
              <p className="text-sm font-medium" style={{ color: '#003781' }}>{gap.requirement.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#4A5568' }}>{gap.requirement.description}</p>
              <div className="flex items-center gap-3 text-xs pt-1" style={{ color: '#4A5568' }}>
                <span>
                  <span className="font-medium">Type: </span>
                  {gap.requirement.obligationType.replace(/_/g, ' ')}
                </span>
                <span>
                  <span className="font-medium">Level: </span>
                  {gap.requirement.obligationLevel}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Affected documents */}
        <div
          className="bg-white rounded-xl p-5"
          style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#003781' }}>Affected Documents</h2>
          {gap.affectedDocumentIds.length === 0 ? (
            <p className="text-sm" style={{ color: '#4A5568' }}>No documents affected.</p>
          ) : (
            <ul className="space-y-1.5">
              {gap.affectedDocumentIds.map(docId => (
                <li key={docId} className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#4A5568' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-mono text-xs" style={{ color: '#4A5568' }}>{docId}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      {gap.aiAnalysis && (
        <div
          className="bg-white rounded-xl p-6"
          style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#003781' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h2 className="text-sm font-semibold" style={{ color: '#003781' }}>AI Analysis</h2>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4A5568' }}>{gap.aiAnalysis}</p>
        </div>
      )}

      {/* Linked control change */}
      {linkedChange && (
        <div
          className="bg-white rounded-xl p-6"
          style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#003781' }}>Linked Control Change</h2>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                  {linkedChange.id}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                  {linkedChange.changeType.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm font-medium" style={{ color: '#003781' }}>{linkedChange.title}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {(() => {
                const chgBadge = statusBadge(linkedChange.status)
                return (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: chgBadge.bg, color: chgBadge.text }}>
                    {chgBadge.label}
                  </span>
                )
              })()}
              <Link
                href={`/compliance-hub/changes/${linkedChange.id}`}
                className="text-xs font-medium px-3 py-1.5 rounded hover:border-[#003781] transition-colors"
                style={{ border: '1px solid #D0D7E3', color: '#003781' }}
              >
                View change
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Remediation */}
      {gap.status !== 'CLOSED' && (
        <div
          className="bg-white rounded-xl p-6"
          style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: '#003781' }}>Remediation</h2>
          {linkedCases.length > 0 && (
            <div className="mb-4 space-y-2">
              {linkedCases.map(rc => {
                const rcBadge = statusBadge(rc.status)
                return (
                  <div
                    key={rc.id}
                    className="flex items-center justify-between rounded-lg px-4 py-2.5"
                    style={{ background: '#F4F6F9', border: '1px solid #D0D7E3' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs flex-shrink-0" style={{ color: '#4A5568' }}>{rc.id}</span>
                      <span className="text-sm truncate" style={{ color: '#003781' }}>{rc.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: rcBadge.bg, color: rcBadge.text }}>
                        {rcBadge.label}
                      </span>
                      <Link
                        href={`/remediation/${rc.id}`}
                        className="text-xs font-medium px-2 py-1 rounded hover:underline"
                        style={{ color: '#003781', border: '1px solid #D0D7E3' }}
                      >
                        View
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {!showRemediationForm ? (
            <button
              onClick={handleOpenRemediationForm}
              className="text-sm font-medium hover:underline"
              style={{ color: '#003781', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              → Open New Remediation Case
            </button>
          ) : (
            <div className="space-y-3 mt-1">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#4A5568' }}>Product</label>
                <select
                  value={remediationProductId}
                  onChange={e => setRemediationProductId(e.target.value)}
                  className="w-full rounded px-3 py-2 text-sm"
                  style={{ border: '1px solid #D0D7E3', color: '#1A1A2E', outline: 'none', background: '#fff' }}
                >
                  {products.length === 0 && <option value="">Loading products…</option>}
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#4A5568' }}>Priority</label>
                <select
                  value={remediationPriority}
                  onChange={e => setRemediationPriority(e.target.value)}
                  className="w-full rounded px-3 py-2 text-sm"
                  style={{ border: '1px solid #D0D7E3', color: '#1A1A2E', outline: 'none', background: '#fff' }}
                >
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {createError && (
                <p className="text-xs" style={{ color: '#E4002B' }}>{createError}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateCase}
                  disabled={creatingCase || !remediationProductId}
                  className="text-sm font-medium px-4 py-2 rounded"
                  style={{
                    background: creatingCase || !remediationProductId ? '#D0D7E3' : '#003781',
                    color: '#fff',
                    border: 'none',
                    cursor: creatingCase || !remediationProductId ? 'not-allowed' : 'pointer',
                  }}
                >
                  {creatingCase ? 'Creating…' : 'Create Case'}
                </button>
                <button
                  onClick={() => { setShowRemediationForm(false); setCreateError(null) }}
                  className="text-sm"
                  style={{ color: '#4A5568', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
