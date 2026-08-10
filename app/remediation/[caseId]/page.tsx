'use client'
import { use, useEffect, useState } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RemediationCase {
  id: string
  productId: string
  requirementId: string
  sourceId: string
  title: string
  description: string | null
  status: string
  priority: string
  assignedTo: string | null
  dueDate: string | null
  productGapIds: string[]
  createdAt: string | null
  resolvedAt: string | null
  resolutionNotes: string | null
  product: { id: string; name: string; type: string; criticality: string } | null
  requirement: { id: string; articleRef: string; title: string; description: string } | null
  source: { id: string; shortCode: string; name: string } | null
}

interface VerificationResult {
  results?: { status: string }[]
}

interface SuggestionStep {
  step: number
  action: string
  effort: string
  description: string
}

interface AISuggestion {
  summary: string
  steps: SuggestionStep[]
  timelineWeeks: number
  blockers: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function priorityStyle(p: string): { bg: string; text: string; label: string } {
  switch (p) {
    case 'CRITICAL': return { bg: '#FEE2E2', text: '#E4002B', label: 'Critical' }
    case 'HIGH':     return { bg: '#FEF3C7', text: '#B45309', label: 'High' }
    case 'MEDIUM':   return { bg: '#EBF5FF', text: '#003781', label: 'Medium' }
    case 'LOW':      return { bg: '#F3F4F6', text: '#6B7280', label: 'Low' }
    default:         return { bg: '#F3F4F6', text: '#6B7280', label: p }
  }
}

function statusStyle(s: string): { bg: string; text: string; label: string } {
  switch (s) {
    case 'OPEN':        return { bg: '#F3F4F6', text: '#6B7280', label: 'Open' }
    case 'IN_PROGRESS': return { bg: '#EBF5FF', text: '#003781', label: 'In Progress' }
    case 'BLOCKED':     return { bg: '#FEE2E2', text: '#E4002B', label: 'Blocked' }
    case 'RESOLVED':    return { bg: '#D1FAE5', text: '#0A7C59', label: 'Resolved' }
    case 'CLOSED':      return { bg: '#F3F4F6', text: '#6B7280', label: 'Closed' }
    default:            return { bg: '#F3F4F6', text: '#6B7280', label: s.replace(/_/g, ' ') }
  }
}

function Badge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <span style={{
      backgroundColor: bg,
      color: text,
      padding: '3px 12px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 10,
      padding: '20px 24px',
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 16 }}>{title}</h2>
      {children}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
      <span style={{ width: 140, flexShrink: 0, fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#374151' }}>{value}</span>
    </div>
  )
}

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED', 'CLOSED']

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RemediationCaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params)
  const [rc, setRc] = useState<RemediationCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [newStatus, setNewStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/remediation/cases/${caseId}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.json()
      })
      .then(data => {
        if (data) {
          setRc(data)
          setNewStatus(data.status)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [caseId])

  async function handleStatusUpdate() {
    if (!newStatus) return
    setUpdating(true)
    setUpdateError(null)
    setUpdateSuccess(false)
    try {
      const res = await fetch(`/api/remediation/cases/${caseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes: notes || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        setUpdateError(err.error ?? 'Update failed')
      } else {
        const updated = await res.json()
        setRc(updated)
        setUpdateSuccess(true)
        setTimeout(() => setUpdateSuccess(false), 3000)
      }
    } catch (e) {
      setUpdateError(String(e))
    } finally {
      setUpdating(false)
    }
  }

  async function handleRunVerification() {
    if (!rc) return
    setVerificationLoading(true)
    setVerificationError(null)
    try {
      const res = await fetch('/api/verification/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: rc.productId, requirementId: rc.requirementId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verification failed')
      setVerificationResult(data)
    } catch (err) {
      setVerificationError(String(err))
    } finally {
      setVerificationLoading(false)
    }
  }

  async function handleSuggest() {
    setSuggestLoading(true)
    setSuggestError(null)
    try {
      const res = await fetch(`/api/remediation/cases/${caseId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Suggestion failed')
      setSuggestion(data)
    } catch (err) {
      setSuggestError(String(err))
    } finally {
      setSuggestLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div style={{ height: 20, width: 180, background: '#F4F6F9', borderRadius: 6 }} />
        <div style={{ height: 120, background: '#F4F6F9', borderRadius: 10 }} />
      </div>
    )
  }

  if (notFound || !rc) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#E4002B', fontWeight: 500 }}>Remediation case not found.</p>
        <Link href="/remediation" style={{ color: '#003781', fontSize: 13, marginTop: 8, display: 'inline-block' }}>
          &larr; Remediation Cases
        </Link>
      </div>
    )
  }

  const pri = priorityStyle(rc.priority)
  const sts = statusStyle(rc.status)

  return (
    <div className="space-y-5 p-6">
      {/* Back link */}
      <Link
        href="/remediation"
        style={{ color: '#003781', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
        onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
      >
        &larr; Remediation Cases
      </Link>

      {/* Header card */}
      <div style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 10,
        padding: '24px 28px',
        borderLeft: '4px solid #003781',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{rc.id}</span>
          <Badge bg={pri.bg} text={pri.text} label={pri.label} />
          <Badge bg={sts.bg} text={sts.text} label={sts.label} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#003781', marginBottom: 16 }}>{rc.title}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px' }}>
          <div>
            <MetaRow
              label="Product"
              value={rc.product
                ? <Link href={`/product-hub/products/${rc.product.id}`} style={{ color: '#003781', textDecoration: 'none', fontWeight: 500 }}>{rc.product.name}</Link>
                : rc.productId}
            />
            <MetaRow
              label="Regulation"
              value={rc.source
                ? <span style={{ background: 'rgba(0,55,129,0.08)', color: '#003781', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{rc.source.shortCode}</span>
                : rc.sourceId}
            />
            <MetaRow
              label="Requirement"
              value={rc.requirement
                ? <span><span style={{ color: '#6B7280', marginRight: 4 }}>{rc.requirement.articleRef}</span>{rc.requirement.title}</span>
                : rc.requirementId}
            />
          </div>
          <div>
            <MetaRow label="Assigned To" value={rc.assignedTo ?? '—'} />
            <MetaRow label="Due Date" value={formatDate(rc.dueDate)} />
            <MetaRow label="Created" value={formatDate(rc.createdAt)} />
            {rc.resolvedAt && <MetaRow label="Resolved" value={formatDate(rc.resolvedAt)} />}
          </div>
        </div>
      </div>

      {/* Description */}
      {rc.description && (
        <SectionCard title="Description">
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{rc.description}</p>
        </SectionCard>
      )}

      {/* Resolution notes (if present) */}
      {rc.resolutionNotes && (
        <SectionCard title="Resolution Notes">
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{rc.resolutionNotes}</p>
        </SectionCard>
      )}

      {/* Status update panel */}
      <SectionCard title="Update Status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
          <div>
            <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 6 }}>
              New Status
            </label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                fontSize: 13,
                color: '#374151',
                background: '#fff',
                outline: 'none',
              }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add resolution notes or context..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                fontSize: 13,
                color: '#374151',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {updateError && (
            <p style={{ fontSize: 12, color: '#E4002B' }}>{updateError}</p>
          )}
          {updateSuccess && (
            <p style={{ fontSize: 12, color: '#0A7C59', fontWeight: 500 }}>Status updated successfully.</p>
          )}
          <div>
            <button
              onClick={handleStatusUpdate}
              disabled={updating || newStatus === rc.status}
              style={{
                padding: '8px 20px',
                background: updating || newStatus === rc.status ? '#D1D5DB' : '#003781',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: updating || newStatus === rc.status ? 'not-allowed' : 'pointer',
              }}
            >
              {updating ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Linked product gaps */}
      {rc.productGapIds.length > 0 && (
        <SectionCard title={`Linked Product Gaps (${rc.productGapIds.length})`}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rc.productGapIds.map(gapId => (
              <li key={gapId} style={{
                padding: '8px 14px',
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 6,
                fontSize: 13,
                color: '#374151',
                fontFamily: 'monospace',
              }}>
                {gapId}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {(rc.status === 'IN_PROGRESS' || rc.status === 'OPEN') && (
        <SectionCard title="Verification">
          <button
            onClick={handleRunVerification}
            disabled={verificationLoading}
            style={{
              padding: '8px 20px',
              background: verificationLoading ? '#D1D5DB' : '#003781',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: verificationLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {verificationLoading ? 'Running…' : 'Run Verification'}
          </button>
          {verificationError && (
            <p style={{ fontSize: 12, color: '#E4002B', marginTop: 8 }}>{verificationError}</p>
          )}
          {verificationResult?.results && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#0A7C59', fontWeight: 600 }}>
                {verificationResult.results.filter(r => r.status === 'PASSED').length} Passed
              </span>
              <span style={{ fontSize: 13, color: '#E4002B', fontWeight: 600 }}>
                {verificationResult.results.filter(r => r.status === 'FAILED').length} Failed
              </span>
              <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>
                {verificationResult.results.filter(r => r.status === 'INCONCLUSIVE').length} Inconclusive
              </span>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <Link
              href={`/ddcr/products/${rc.productId}`}
              style={{ fontSize: 12, color: '#003781', textDecoration: 'none' }}
              onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              → View in DDCR
            </Link>
          </div>
        </SectionCard>
      )}

      {(rc.status === 'OPEN' || rc.status === 'BLOCKED') && (
        <SectionCard title="AI: Suggest Remediation Steps">
          <button
            onClick={handleSuggest}
            disabled={suggestLoading}
            style={{
              padding: '8px 20px',
              background: suggestLoading ? '#D1D5DB' : '#7C3AED',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: suggestLoading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {suggestLoading ? (
              <>
                <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: 0.75 }} />
                </svg>
                Generating…
              </>
            ) : (
              <><span>✦</span> AI: Suggest Remediation Steps</>
            )}
          </button>
          {suggestError && (
            <p style={{ fontSize: 12, color: '#E4002B', marginTop: 8 }}>{suggestError}</p>
          )}
          {suggestion && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 16 }}>{suggestion.summary}</p>
              {suggestion.steps && suggestion.steps.length > 0 && (
                <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {suggestion.steps.map((step, i) => (
                    <li key={i} style={{ padding: '12px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#7C3AED', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {step.step ?? i + 1}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{step.action}</span>
                        {step.effort && (
                          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>{step.effort}</span>
                        )}
                      </div>
                      {step.description && (
                        <p style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.5, marginLeft: 30, marginBottom: 0 }}>{step.description}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {suggestion.timelineWeeks > 0 && (
                <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600 }}>Estimated timeline: </span>{suggestion.timelineWeeks} weeks
                </p>
              )}
              {suggestion.blockers && suggestion.blockers.length > 0 && (
                <div style={{ padding: '12px 16px', background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.25)', borderRadius: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#B45309', marginBottom: 8 }}>Potential Blockers</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {suggestion.blockers.map((b, i) => (
                      <li key={i} style={{ fontSize: 12, color: '#92400E' }}>• {b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Quick Links">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href={`/product-hub/products/${rc.productId}`}
            style={{ fontSize: 12, color: '#4A5568', textDecoration: 'none', padding: '5px 12px', border: '1px solid #D1D5DB', borderRadius: 20, background: '#F9FAFB' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#003781'; e.currentTarget.style.color = '#003781' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#4A5568' }}
          >
            → Product Hub
          </Link>
          <Link
            href={`/ddcr/products/${rc.productId}`}
            style={{ fontSize: 12, color: '#4A5568', textDecoration: 'none', padding: '5px 12px', border: '1px solid #D1D5DB', borderRadius: 20, background: '#F9FAFB' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#003781'; e.currentTarget.style.color = '#003781' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#4A5568' }}
          >
            → DDCR
          </Link>
          <Link
            href="/evidence-centre"
            style={{ fontSize: 12, color: '#4A5568', textDecoration: 'none', padding: '5px 12px', border: '1px solid #D1D5DB', borderRadius: 20, background: '#F9FAFB' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#003781'; e.currentTarget.style.color = '#003781' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#4A5568' }}
          >
            → Evidence Centre
          </Link>
        </div>
      </SectionCard>
    </div>
  )
}
