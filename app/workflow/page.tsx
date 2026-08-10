'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenGap {
  id: string
  title: string
  severity: string
  status: string
  sourceId: string
  source: { shortCode: string } | null
  requirement: { articleRef: string; title: string } | null
  linkedControlChange: { id: string; status: string; title: string } | null
}

interface PendingControlChange {
  id: string
  title: string
  status: string
  changeType: string
  gapId: string
  requirementId: string
  aiGenerated: boolean
  proposedAt: string | null
  approvedAt: string | null
}

interface ActiveCase {
  id: string
  title: string
  status: string
  priority: string
  assignedTo: string | null
  dueDate: string | null
  productId: string
  requirementId: string
  product: { name: string; criticality: string } | null
  requirement: { articleRef: string; title: string } | null
  source: { shortCode: string } | null
}

interface PendingDdcrProduct {
  productId: string
  productName: string
  requirementId: string | null
  requirementTitle: string
  sourceShortCode: string
  evidencePackageStatus: string | null
  latestVerificationStatus: string | null
  ddcrStatus: string
  sourceId: string | null
}

interface WorkflowState {
  complianceTeam: {
    openGaps: OpenGap[]
    controlChanges: PendingControlChange[]
  }
  productTeam: {
    activeCases: ActiveCase[]
  }
  ddcrTeam: {
    pendingProducts: PendingDdcrProduct[]
    compliantCount: number
  }
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function severityStyle(s: string) {
  if (s === 'CRITICAL') return { background: '#7F1D1D', color: '#fff' }
  if (s === 'HIGH') return { background: '#FEE2E2', color: '#E4002B' }
  if (s === 'MEDIUM') return { background: '#FEF3C7', color: '#B45309' }
  return { background: '#F3F4F6', color: '#6B7280' }
}

function gapStatusStyle(s: string): { background: string; color: string; label: string } {
  if (s === 'OPEN') return { background: '#FEE2E2', color: '#E4002B', label: 'Open' }
  if (s === 'IN_ANALYSIS') return { background: '#FEF3C7', color: '#B45309', label: 'In Analysis' }
  if (s === 'CHANGE_PROPOSED') return { background: '#EBF5FF', color: '#003781', label: 'Change Proposed' }
  return { background: '#F3F4F6', color: '#6B7280', label: s }
}

function changeStatusStyle(s: string): { background: string; color: string; label: string } {
  if (s === 'DRAFT') return { background: '#F3F4F6', color: '#6B7280', label: 'Draft' }
  if (s === 'PROPOSED') return { background: '#FEF3C7', color: '#B45309', label: 'Proposed' }
  if (s === 'UNDER_REVIEW') return { background: '#FEF3C7', color: '#B45309', label: 'Under Review' }
  if (s === 'APPROVED') return { background: '#D1FAE5', color: '#0A7C59', label: 'Approved' }
  if (s === 'PUBLISHED') return { background: '#065F46', color: '#fff', label: 'Published' }
  return { background: '#F3F4F6', color: '#6B7280', label: s }
}

function caseStatusStyle(s: string): { background: string; color: string; label: string } {
  if (s === 'OPEN') return { background: '#FEE2E2', color: '#E4002B', label: 'Open' }
  if (s === 'IN_PROGRESS') return { background: '#FEF3C7', color: '#B45309', label: 'In Progress' }
  if (s === 'BLOCKED') return { background: '#7F1D1D', color: '#fff', label: 'Blocked' }
  if (s === 'RESOLVED') return { background: '#D1FAE5', color: '#0A7C59', label: 'Resolved' }
  return { background: '#F3F4F6', color: '#6B7280', label: s }
}

function epStatusStyle(s: string | null): { background: string; color: string; label: string } {
  if (s === 'COMPLETE') return { background: '#D1FAE5', color: '#0A7C59', label: 'Evidence Complete' }
  if (s === 'ASSEMBLING') return { background: '#FEF3C7', color: '#B45309', label: 'Assembling' }
  if (s === 'REJECTED') return { background: '#FEE2E2', color: '#E4002B', label: 'Rejected' }
  return { background: '#F3F4F6', color: '#6B7280', label: '—' }
}

function vrStatusStyle(s: string | null): { background: string; color: string; label: string } {
  if (s === 'PASSED') return { background: '#D1FAE5', color: '#0A7C59', label: 'Passed' }
  if (s === 'FAILED') return { background: '#FEE2E2', color: '#E4002B', label: 'Failed' }
  if (s === 'INCONCLUSIVE') return { background: '#F3F4F6', color: '#6B7280', label: 'Inconclusive' }
  return { background: '#F3F4F6', color: '#6B7280', label: '—' }
}

function ddcrStatusStyle(s: string): { background: string; color: string; label: string } {
  if (s === 'COMPLIANT') return { background: '#D1FAE5', color: '#0A7C59', label: 'Compliant' }
  if (s === 'NON_COMPLIANT') return { background: '#FEE2E2', color: '#E4002B', label: 'Non-Compliant' }
  if (s === 'PENDING') return { background: '#FEF3C7', color: '#B45309', label: 'Pending' }
  return { background: '#F3F4F6', color: '#6B7280', label: s }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function Pill({
  label,
  background,
  color,
  rounded = true,
}: {
  label: string
  background: string
  color: string
  rounded?: boolean
}) {
  return (
    <span
      style={{
        background,
        color,
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: rounded ? 999 : 4,
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function Btn({
  onClick,
  busy,
  disabled,
  bg,
  color,
  border,
  children,
}: {
  onClick: () => void
  busy?: boolean
  disabled?: boolean
  bg: string
  color: string
  border?: string
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      style={{
        background: bg,
        color,
        border: border ?? 'none',
        fontSize: 11,
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: 6,
        cursor: busy || disabled ? 'not-allowed' : 'pointer',
        opacity: busy || disabled ? 0.65 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {busy && <Spinner size={10} />}
      {children}
    </button>
  )
}

function InlineError({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <p style={{ color: '#E4002B', fontSize: 10, marginTop: 4 }}>{msg}</p>
  )
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>
      {label}
    </div>
  )
}

const CARD: React.CSSProperties = {
  background: 'white',
  border: '1px solid #D0D7E3',
  borderRadius: 10,
  padding: 14,
  boxShadow: '0 1px 3px rgba(0,56,129,0.06)',
}

// ─── Handoff arrow ────────────────────────────────────────────────────────────

function HandoffArrow({ color, line1, line2 }: { color: string; line1: string; line2: string }) {
  return (
    <div
      style={{
        width: 52,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 2px',
        gap: 5,
        minHeight: 120,
      }}
    >
      <div style={{ flex: 1, width: 1, background: '#D0D7E3' }} />
      <span style={{ fontSize: 22, color, lineHeight: 1 }}>→</span>
      <p
        style={{
          color,
          fontSize: 9,
          fontWeight: 700,
          textAlign: 'center',
          margin: 0,
          lineHeight: 1.5,
          maxWidth: 46,
          wordBreak: 'break-word',
        }}
      >
        {line1}
        <br />
        {line2}
      </p>
      <div style={{ flex: 1, width: 1, background: '#D0D7E3' }} />
    </div>
  )
}

// ─── Column wrapper ───────────────────────────────────────────────────────────

function Column({
  headerBg,
  columnBg,
  title,
  badge,
  children,
}: {
  headerBg: string
  columnBg: string
  title: string
  badge: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: columnBg,
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #D0D7E3',
      }}
    >
      <div
        style={{
          background: headerBg,
          padding: '11px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{title}</span>
        <span
          style={{
            background: 'rgba(255,255,255,0.22)',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 999,
            padding: '2px 9px',
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </span>
      </div>
      <div
        style={{
          padding: 10,
          flex: 1,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 280px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 2px 2px',
        marginTop: 4,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span
        style={{
          background: '#E5E7EB',
          color: '#374151',
          fontSize: 9,
          fontWeight: 700,
          borderRadius: 999,
          padding: '1px 6px',
        }}
      >
        {count}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkflowPage() {
  const [data, setData] = useState<WorkflowState | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState<Record<string, string>>({})
  const [approverInputs, setApproverInputs] = useState<Record<string, string>>({})
  const [verifyCounts, setVerifyCounts] = useState<Record<string, number>>({})

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow/state')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json as WorkflowState)
    } catch (e) {
      setFetchErr(String(e))
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(p => ({ ...p, [key]: true }))
    setErr(p => ({ ...p, [key]: '' }))
    try {
      await fn()
      await refresh()
    } catch (e) {
      setErr(p => ({ ...p, [key]: String(e) }))
    } finally {
      setBusy(p => ({ ...p, [key]: false }))
    }
  }

  function setApprover(changeId: string, value: string) {
    setApproverInputs(p => ({ ...p, [changeId]: value }))
  }

  // ── Compliance actions ──────────────────────────────────────────────────────

  function approveChange(changeId: string) {
    const name = approverInputs[changeId]?.trim()
    if (!name) {
      setErr(p => ({ ...p, [`apv-${changeId}`]: 'Enter approver name first' }))
      return
    }
    act(`apv-${changeId}`, async () => {
      const res = await fetch(`/api/compliance-hub/control-changes/${changeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approvedBy: name }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
    })
  }

  function publishChange(changeId: string) {
    act(`pub-${changeId}`, async () => {
      const res = await fetch(`/api/compliance-hub/control-changes/${changeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
    })
  }

  // ── Product actions ─────────────────────────────────────────────────────────

  function startCase(id: string) {
    act(`start-${id}`, async () => {
      const res = await fetch(`/api/remediation/cases/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
    })
  }

  function resolveCase(id: string) {
    act(`res-${id}`, async () => {
      const res = await fetch(`/api/remediation/cases/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED', notes: 'Remediation completed — ready for verification' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
    })
  }

  function runVerification(caseId: string, productId: string, requirementId: string) {
    act(`vfy-${caseId}`, async () => {
      const res = await fetch('/api/verification/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, requirementId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setVerifyCounts(p => ({ ...p, [caseId]: Array.isArray(json.results) ? json.results.length : 0 }))
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '80px 0', color: '#4A5568', fontSize: 14 }}>
        <Spinner size={18} />
        Loading workflow…
      </div>
    )
  }

  if (fetchErr) {
    return (
      <div style={{ background: '#FEE2E2', color: '#E4002B', border: '1px solid #FECACA', borderRadius: 8, padding: 16, fontSize: 13 }}>
        {fetchErr}
      </div>
    )
  }

  if (!data) return null

  const { complianceTeam, productTeam, ddcrTeam } = data
  const gapCount = complianceTeam.openGaps.length
  const changeCount = complianceTeam.controlChanges.length
  const caseCount = productTeam.activeCases.length
  const pendingCount = ddcrTeam.pendingProducts.length
  const compliantCount = ddcrTeam.compliantCount

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#003781', margin: 0 }}>Compliance Workflow</h1>
        <p style={{ fontSize: 13, color: '#4A5568', margin: '4px 0 0' }}>
          End-to-end view · Compliance → Product → DDCR
        </p>
      </div>

      {/* Three-column pipeline */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>

        {/* ── Column 1: Compliance Team ─────────────────────────────────────── */}
        <Column
          headerBg="#003781"
          columnBg="#EBF5FF"
          title="Compliance Team"
          badge={`${gapCount} gap${gapCount !== 1 ? 's' : ''} · ${changeCount} pending change${changeCount !== 1 ? 's' : ''}`}
        >
          {/* Section A: Open Gaps */}
          <SectionLabel label="Open Gaps" count={gapCount} />

          {gapCount === 0 && <EmptyColumn label="All clear — no items in queue" />}

          {complianceTeam.openGaps.map(gap => {
            const gSt = gapStatusStyle(gap.status)
            const sev = severityStyle(gap.severity)
            return (
              <div key={gap.id} style={CARD}>
                {/* Top row: severity + source + status */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  <Pill label={gap.severity} background={sev.background} color={sev.color} rounded={false} />
                  {gap.source && (
                    <Pill label={gap.source.shortCode} background="#EBF5FF" color="#003781" rounded={false} />
                  )}
                  {gap.requirement && (
                    <Pill label={gap.requirement.articleRef} background="#F4F6F9" color="#4A5568" rounded={false} />
                  )}
                  <Pill label={gSt.label} background={gSt.background} color={gSt.color} />
                </div>

                {/* Gap title */}
                <p style={{ fontSize: 12, fontWeight: 600, color: '#003781', margin: '0 0 4px' }}>{gap.title}</p>

                {gap.requirement && (
                  <p style={{ fontSize: 10, color: '#4A5568', margin: '0 0 8px' }}>{gap.requirement.title}</p>
                )}

                {/* Linked control change */}
                {gap.linkedControlChange ? (
                  <div
                    style={{
                      background: '#F4F6F9',
                      border: '1px solid #D0D7E3',
                      borderRadius: 6,
                      padding: '6px 8px',
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#4A5568', fontWeight: 600 }}>
                        Control Change
                      </span>
                      {(() => {
                        const cs = changeStatusStyle(gap.linkedControlChange.status)
                        return <Pill label={cs.label} background={cs.background} color={cs.color} />
                      })()}
                    </div>
                    <p style={{ fontSize: 11, color: '#003781', margin: '3px 0 0', fontWeight: 500 }}>
                      {gap.linkedControlChange.title}
                    </p>
                    <Link
                      href={`/compliance-hub/changes/${gap.linkedControlChange.id}`}
                      style={{ fontSize: 10, color: '#003781', marginTop: 2, display: 'inline-block' }}
                    >
                      View change →
                    </Link>
                  </div>
                ) : null}

                <Link
                  href={`/compliance-hub/gaps/${gap.id}`}
                  style={{ fontSize: 10, color: '#003781', fontWeight: 600 }}
                >
                  View gap →
                </Link>
              </div>
            )
          })}

          {/* Section B: Pending Control Changes */}
          <SectionLabel label="Pending Control Changes" count={changeCount} />

          {changeCount === 0 && (
            <div style={{ padding: '12px 2px', textAlign: 'center', color: '#9CA3AF', fontSize: 11, fontStyle: 'italic' }}>
              No pending changes
            </div>
          )}

          {complianceTeam.controlChanges.map(cc => {
            const cs = changeStatusStyle(cc.status)
            const canApprove = cc.status === 'DRAFT' || cc.status === 'PROPOSED' || cc.status === 'UNDER_REVIEW'
            const canPublish = cc.status === 'APPROVED'
            const apvKey = `apv-${cc.id}`
            const pubKey = `pub-${cc.id}`

            return (
              <div key={cc.id} style={CARD}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  <Pill label={cs.label} background={cs.background} color={cs.color} />
                  <Pill
                    label={cc.changeType.replace(/_/g, ' ')}
                    background="#F4F6F9"
                    color="#4A5568"
                    rounded={false}
                  />
                  {cc.aiGenerated && (
                    <Pill label="AI" background="#F5F3FF" color="#7C3AED" rounded={false} />
                  )}
                </div>

                <p style={{ fontSize: 12, fontWeight: 600, color: '#003781', margin: '0 0 6px' }}>{cc.title}</p>

                {cc.proposedAt && (
                  <p style={{ fontSize: 10, color: '#4A5568', margin: '0 0 8px' }}>
                    Proposed {formatDate(cc.proposedAt)}
                    {cc.approvedAt ? ` · Approved ${formatDate(cc.approvedAt)}` : ''}
                  </p>
                )}

                {canPublish && (
                  <div>
                    <Btn
                      onClick={() => publishChange(cc.id)}
                      busy={busy[pubKey]}
                      bg="#0A7C59"
                      color="white"
                    >
                      {busy[pubKey] ? 'Publishing…' : 'Publish →'}
                    </Btn>
                    <InlineError msg={err[pubKey]} />
                  </div>
                )}

                {canApprove && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Approver name"
                        value={approverInputs[cc.id] ?? ''}
                        onChange={e => setApprover(cc.id, e.target.value)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 5,
                          border: '1px solid #D0D7E3',
                          flex: 1,
                          minWidth: 0,
                          outline: 'none',
                        }}
                      />
                      <Btn
                        onClick={() => approveChange(cc.id)}
                        busy={busy[apvKey]}
                        bg="#003781"
                        color="white"
                      >
                        {busy[apvKey] ? '…' : 'Approve →'}
                      </Btn>
                    </div>
                    <InlineError msg={err[apvKey]} />
                  </div>
                )}

                {cc.status === 'PUBLISHED' && (
                  <div
                    style={{
                      background: '#D1FAE5',
                      color: '#0A7C59',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 6,
                      marginTop: 4,
                    }}
                  >
                    ✓ Published — ready for product team →
                  </div>
                )}

                <Link
                  href={`/compliance-hub/changes/${cc.id}`}
                  style={{ fontSize: 10, color: '#003781', fontWeight: 600, marginTop: 6, display: 'inline-block' }}
                >
                  View change →
                </Link>
              </div>
            )
          })}
        </Column>

        {/* ── Handoff 1 → 2 ─────────────────────────────────────────────────── */}
        <HandoffArrow
          color="#B45309"
          line1="Published changes → remediation cases"
          line2="→ Product Team"
        />

        {/* ── Column 2: Product Team ────────────────────────────────────────── */}
        <Column
          headerBg="#B45309"
          columnBg="#FFFBEB"
          title="Product Team"
          badge={`${caseCount} active case${caseCount !== 1 ? 's' : ''}`}
        >
          {caseCount === 0 && <EmptyColumn label="All clear — no items in queue" />}

          {productTeam.activeCases.map(c => {
            const prio = severityStyle(c.priority)
            const cs = caseStatusStyle(c.status)
            const startKey = `start-${c.id}`
            const resKey = `res-${c.id}`
            const vfyKey = `vfy-${c.id}`

            return (
              <div key={c.id} style={CARD}>
                {/* Priority + status */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  <Pill label={c.priority} background={prio.background} color={prio.color} rounded={false} />
                  {c.source && (
                    <Pill label={c.source.shortCode} background="#FFFBEB" color="#B45309" rounded={false} />
                  )}
                  <Pill label={cs.label} background={cs.background} color={cs.color} />
                </div>

                {/* Case title */}
                <p style={{ fontSize: 12, fontWeight: 600, color: '#1C1917', margin: '0 0 5px' }}>{c.title}</p>

                {/* Product + requirement */}
                {c.product && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                    <Pill label={c.product.name} background="#FEF3C7" color="#92400E" rounded={false} />
                    <Pill label={c.product.criticality} background="#F3F4F6" color="#6B7280" rounded={false} />
                  </div>
                )}

                {c.requirement && (
                  <p style={{ fontSize: 10, color: '#4A5568', margin: '0 0 6px', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600 }}>{c.requirement.articleRef}</span>
                    {' '}{c.requirement.title}
                  </p>
                )}

                {c.assignedTo && (
                  <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 4px' }}>
                    Assigned to {c.assignedTo}
                    {c.dueDate ? ` · Due ${formatDate(c.dueDate)}` : ''}
                  </p>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {c.status === 'OPEN' && (
                    <Btn onClick={() => startCase(c.id)} busy={busy[startKey]} bg="#B45309" color="white">
                      {busy[startKey] ? 'Starting…' : 'Start Work'}
                    </Btn>
                  )}

                  {c.status === 'IN_PROGRESS' && (
                    <>
                      <Btn onClick={() => resolveCase(c.id)} busy={busy[resKey]} bg="#B45309" color="white">
                        {busy[resKey] ? 'Resolving…' : 'Mark Resolved'}
                      </Btn>
                      <Btn
                        onClick={() => runVerification(c.id, c.productId, c.requirementId)}
                        busy={busy[vfyKey]}
                        bg="white"
                        color="#003781"
                        border="1px solid #003781"
                      >
                        {busy[vfyKey] ? 'Running…' : 'Run Verification →'}
                      </Btn>
                    </>
                  )}
                </div>

                {err[startKey] && <InlineError msg={err[startKey]} />}
                {err[resKey] && <InlineError msg={err[resKey]} />}
                {err[vfyKey] && <InlineError msg={err[vfyKey]} />}

                {typeof verifyCounts[c.id] === 'number' && (
                  <p style={{ fontSize: 10, color: '#0A7C59', fontWeight: 600, marginTop: 4 }}>
                    ✓ {verifyCounts[c.id]} verification check{verifyCounts[c.id] !== 1 ? 's' : ''} run
                  </p>
                )}

                <Link
                  href={`/remediation/${c.id}`}
                  style={{ fontSize: 10, color: '#B45309', fontWeight: 600, marginTop: 6, display: 'inline-block' }}
                >
                  View case →
                </Link>
              </div>
            )
          })}
        </Column>

        {/* ── Handoff 2 → 3 ─────────────────────────────────────────────────── */}
        <HandoffArrow
          color="#0A7C59"
          line1="Verification + evidence"
          line2="→ DDCR Team"
        />

        {/* ── Column 3: DDCR Team ───────────────────────────────────────────── */}
        <Column
          headerBg="#0A7C59"
          columnBg="#F0FAF6"
          title="DDCR Team"
          badge={`${compliantCount} compliant · ${pendingCount} pending`}
        >
          {/* Compliant count stat */}
          <div
            style={{
              background: '#D1FAE5',
              border: '1px solid #A7F3D0',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 20, color: '#0A7C59' }}>✓</span>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0A7C59', margin: 0 }}>{compliantCount}</p>
              <p style={{ fontSize: 10, color: '#065F46', margin: 0 }}>requirements COMPLIANT</p>
            </div>
          </div>

          {/* Info callout */}
          <div
            style={{
              background: '#F0FAF6',
              border: '1px solid #A7F3D0',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 10,
              color: '#065F46',
              lineHeight: 1.5,
            }}
          >
            DDCR is a read-only reporting cockpit. Status updates are received from Product Hub, ServiceNow and other source systems.
          </div>

          <SectionLabel label="Items" count={pendingCount} />

          {pendingCount === 0 && <EmptyColumn label="All clear — no items in queue" />}

          {ddcrTeam.pendingProducts.map(item => {
            const ddcrSt = ddcrStatusStyle(item.ddcrStatus)
            const epSt = epStatusStyle(item.evidencePackageStatus)
            const vrSt = vrStatusStyle(item.latestVerificationStatus)

            return (
              <div key={`${item.productId}-${item.requirementId}`} style={CARD}>
                {/* Product + source */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  <Pill label={item.sourceShortCode} background="#F0FAF6" color="#0A7C59" rounded={false} />
                  <Pill label={ddcrSt.label} background={ddcrSt.background} color={ddcrSt.color} />
                </div>

                <p style={{ fontSize: 12, fontWeight: 600, color: '#1C1917', margin: '0 0 3px' }}>
                  {item.productName}
                </p>
                <p style={{ fontSize: 10, color: '#4A5568', margin: '0 0 8px', lineHeight: 1.4 }}>
                  {item.requirementTitle}
                </p>

                {/* Evidence + verification status (read-only) */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {item.evidencePackageStatus !== null && (
                    <Pill
                      label={epSt.label}
                      background={epSt.background}
                      color={epSt.color}
                      rounded={false}
                    />
                  )}
                  {item.latestVerificationStatus !== null && (
                    <Pill
                      label={`Verification: ${vrSt.label}`}
                      background={vrSt.background}
                      color={vrSt.color}
                      rounded={false}
                    />
                  )}
                </div>

                <Link
                  href="/ddcr"
                  style={{ fontSize: 10, color: '#0A7C59', fontWeight: 600, display: 'inline-block' }}
                >
                  View in DDCR →
                </Link>
              </div>
            )
          })}
        </Column>
      </div>
    </div>
  )
}
