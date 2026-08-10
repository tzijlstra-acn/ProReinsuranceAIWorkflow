'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { use } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Requirement {
  id: string
  articleRef: string
  title: string
  obligationType: string
}

interface GapSummary {
  id: string
  title: string
  severity: string
  status: string
  source: { id: string; shortCode: string; name: string } | null
  requirement: Requirement | null
}

interface ControlChange {
  id: string
  gapId: string
  requirementId: string
  title: string
  description: string
  changeType: string
  status: string
  proposedAt: string | null
  approvedAt: string | null
  approvedBy: string | null
  publishedAt: string | null
  proposedChanges: Record<string, unknown> | null
  aiGenerated: boolean
  createdAt: string | null
  gap: GapSummary | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
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
    case 'PROPOSED': return { bg: '#EBF5FF', text: '#003781', label: 'Proposed' }
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
// Proposed changes renderer
// ─────────────────────────────────────────────────────────────────────────────

function formatKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase())
}

function ProposedChangesRenderer({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#003781' }}>
                {formatKey(key)}
              </h3>
              <ul className="space-y-1.5 pl-3">
                {value.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#4A5568' }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#003781' }} />
                    <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        if (typeof value === 'object' && value !== null) {
          return (
            <div key={key}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#003781' }}>
                {formatKey(key)}
              </h3>
              <div className="rounded-lg p-3 text-xs font-mono overflow-x-auto" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                <pre>{JSON.stringify(value, null, 2)}</pre>
              </div>
            </div>
          )
        }
        return (
          <div key={key}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#003781' }}>
              {formatKey(key)}
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#4A5568' }}>
              {String(value)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────────────────────────

function ChangeTimeline({ change }: { change: ControlChange }) {
  const steps = [
    {
      label: 'Proposed',
      date: change.proposedAt,
      done: !!change.proposedAt,
      detail: null,
    },
    {
      label: 'Approved',
      date: change.approvedAt,
      done: !!change.approvedAt,
      detail: change.approvedBy ? `by ${change.approvedBy}` : null,
    },
    {
      label: 'Published',
      date: change.publishedAt,
      done: !!change.publishedAt,
      detail: null,
    },
  ]

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-start gap-4">
          {/* Left column: icon + connector */}
          <div className="flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2"
              style={{
                background: step.done ? '#0A7C59' : '#F4F6F9',
                borderColor: step.done ? '#0A7C59' : '#D0D7E3',
                color: step.done ? '#ffffff' : '#4A5568',
              }}
            >
              {step.done ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="w-0.5 flex-1 min-h-[20px]" style={{ background: step.done ? '#0A7C59' : '#D0D7E3' }} />
            )}
          </div>
          {/* Right column: text */}
          <div className="flex-1 pb-5">
            <p className="text-sm font-medium" style={{ color: step.done ? '#003781' : '#4A5568' }}>{step.label}</p>
            {step.done && step.date && (
              <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>{formatDateTime(step.date)}</p>
            )}
            {step.done && step.detail && (
              <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>{step.detail}</p>
            )}
            {!step.done && (
              <p className="text-xs mt-0.5" style={{ color: '#D0D7E3' }}>Pending</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Approve / Publish actions
// ─────────────────────────────────────────────────────────────────────────────

function ActionPanel({
  change,
  onActionComplete,
}: {
  change: ControlChange
  onActionComplete: () => void
}) {
  const [approverName, setApproverName] = useState('')
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const canApprove = ['DRAFT', 'PROPOSED', 'UNDER_REVIEW'].includes(change.status)
  const canPublish = change.status === 'APPROVED'

  if (!canApprove && !canPublish) return null

  async function handleAction(action: 'approve' | 'publish') {
    if (action === 'approve' && !approverName.trim()) {
      setActionError('Please enter your name to approve.')
      return
    }
    setWorking(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/compliance-hub/control-changes/${change.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedBy: action === 'approve' ? approverName.trim() : undefined,
        }),
      })
      const data = await res.json() as { error?: string }
      if (data.error) throw new Error(data.error)
      onActionComplete()
    } catch (err) {
      setActionError(String(err))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div
      className="bg-white rounded-xl p-5"
      style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
    >
      <h2 className="text-sm font-semibold mb-4" style={{ color: '#003781' }}>Actions</h2>

      {actionError && (
        <div className="mb-3 rounded p-3 text-xs" style={{ background: '#FEE2E2', color: '#E4002B', border: '1px solid #FECACA' }}>
          {actionError}
        </div>
      )}

      {canApprove && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4A5568' }}>Approver name</label>
            <input
              type="text"
              value={approverName}
              onChange={e => setApproverName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2 text-sm rounded border outline-none"
              style={{ border: '1px solid #D0D7E3', color: '#003781' }}
              onFocus={e => (e.target.style.borderColor = '#003781')}
              onBlur={e => (e.target.style.borderColor = '#D0D7E3')}
            />
          </div>
          <button
            onClick={() => handleAction('approve')}
            disabled={working}
            className="w-full py-2 px-4 rounded text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: '#0A7C59' }}
          >
            {working ? 'Processing…' : 'Approve control change'}
          </button>
        </div>
      )}

      {canPublish && (
        <button
          onClick={() => handleAction('publish')}
          disabled={working}
          className="w-full py-2 px-4 rounded text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: '#003781' }}
        >
          {working ? 'Processing…' : 'Publish to control catalogue'}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ControlChangeDetailPage({ params }: { params: Promise<{ changeId: string }> }) {
  const { changeId } = use(params)

  const [change, setChange] = useState<ControlChange | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/compliance-hub/control-changes`)
      const allChanges = await res.json() as ControlChange[] | { error: string }
      if ('error' in allChanges) throw new Error(String(allChanges.error))

      const found = allChanges.find(c => c.id === changeId) ?? null
      if (!found) throw new Error(`Control change "${changeId}" not found`)
      setChange(found)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [changeId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center" style={{ color: '#4A5568' }}>
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading control change…
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

  if (!change) return null

  const badge = statusBadge(change.status)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: '#4A5568' }}>
        <Link href="/compliance-hub" className="hover:underline">Compliance Hub</Link>
        <span style={{ color: '#D0D7E3' }}>/</span>
        <span style={{ color: '#003781' }}>Change: {change.id}</span>
      </div>

      {/* Header */}
      <div
        className="bg-white rounded-xl p-6"
        style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {change.gap?.source && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#EBF5FF', color: '#003781' }}>
                  {change.gap.source.shortCode}
                </span>
              )}
              <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                {change.id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                {change.changeType.replace(/_/g, ' ')}
              </span>
              {change.aiGenerated && (
                <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: '#F3E8FF', color: '#7C3AED' }}>
                  AI Generated
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold" style={{ color: '#003781' }}>{change.title}</h1>
          </div>
          <span
            className="flex-shrink-0 text-sm px-3 py-1.5 rounded-full font-semibold"
            style={{ background: badge.bg, color: badge.text }}
          >
            {badge.label}
          </span>
        </div>

        <p className="text-sm mt-4 leading-relaxed" style={{ color: '#4A5568' }}>{change.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: details + proposed changes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Linked gap */}
          {change.gap && (
            <div
              className="bg-white rounded-xl p-5"
              style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
            >
              <h2 className="text-sm font-semibold mb-3" style={{ color: '#003781' }}>Linked Compliance Gap</h2>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: '#F4F6F9', color: '#4A5568' }}>
                      {change.gap.id}
                    </span>
                    {(() => {
                      const sev = severityBadge(change.gap!.severity)
                      return (
                        <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: sev.bg, color: sev.text }}>
                          {change.gap!.severity}
                        </span>
                      )
                    })()}
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#003781' }}>{change.gap.title}</p>
                  {change.gap.requirement && (
                    <p className="text-xs mt-1" style={{ color: '#4A5568' }}>
                      {change.gap.requirement.articleRef} — {change.gap.requirement.title}
                    </p>
                  )}
                </div>
                <Link
                  href={`/compliance-hub/gaps/${change.gap.id}`}
                  className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded hover:border-[#003781] transition-colors"
                  style={{ border: '1px solid #D0D7E3', color: '#003781' }}
                >
                  View gap
                </Link>
              </div>
            </div>
          )}

          {/* Proposed changes */}
          {change.proposedChanges && Object.keys(change.proposedChanges).length > 0 && (
            <div
              className="bg-white rounded-xl p-5"
              style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: '#003781' }}>Proposed Changes</h2>
              <ProposedChangesRenderer data={change.proposedChanges} />
            </div>
          )}
        </div>

        {/* Right column: timeline + actions */}
        <div className="space-y-6">
          {/* Timeline */}
          <div
            className="bg-white rounded-xl p-5"
            style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#003781' }}>Timeline</h2>
            <ChangeTimeline change={change} />
          </div>

          {/* Actions */}
          <ActionPanel change={change} onActionComplete={load} />
        </div>
      </div>
    </div>
  )
}
