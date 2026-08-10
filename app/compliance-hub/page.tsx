'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RegulatorySource {
  id: string; shortCode: string; name: string; status: string
  requirementCount: number; gapCount: number
}

interface ComplianceGap {
  id: string; title: string; severity: string; gapType: string; status: string
  description: string; detectedAt: string; aiAnalysis: string | null
  requirement: { id: string; articleRef: string; title: string; obligationType: string } | null
  source: { id: string; shortCode: string; name: string } | null
}

interface ProposedChanges {
  summary?: string
  steps?: string[]
  acceptanceCriteria?: string[]
  documentsToUpdate?: string[]
  trigger?: { articleRef: string; clauseText: string; changeNature: string; complianceDeadline: string | null }
  existingControlId?: string | null
  documentUpdates?: { documentId: string; documentTitle: string; proposedContent: string; changeSummary: string }[]
}

interface ControlChange {
  id: string; title: string; changeType: string; status: string
  description: string | null; proposedAt: string | null; approvedAt: string | null
  publishedAt: string | null; approvedBy: string | null; aiGenerated: boolean | null
  requirementId: string | null; proposedChanges: ProposedChanges | null
  gap: {
    id: string; title: string; description: string
    source: { shortCode: string } | null
    requirement: { articleRef: string; title: string; obligationType: string } | null
  } | null
}

interface GapProposal {
  ok: boolean; controlChangeId: string
  trigger: { articleRef: string; clauseText: string; changeNature: string; complianceDeadline: string | null }
  control: {
    isNew: boolean; title: string; description: string; changeType: string
    steps: string[]; acceptanceCriteria: string[]; estimatedEffort: string; triggerRationale: string
    currentState: { title: string; description: string; steps: string[]; acceptanceCriteria: string[] } | null
  }
  documents: {
    documentId: string; documentTitle: string; isNew: boolean
    currentContent: string; proposedContent: string
    changeSummary: string; addedClauses: string[]
  }[]
}

interface ScanResult {
  ok: boolean; newGapsCreated: number; updatesFound: unknown[]
  controlsImpacted: unknown[]; eurLexConnected: boolean; sourcesScanned: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const AUTO_APPROVE_TYPES = new Set(['DOCUMENTATION_UPDATE', 'MONITORING_ENHANCEMENT', 'REPORTING_UPDATE'])
const NEW_CONTROL_TYPES = new Set(['NEW_CONTROL', 'NEW_PROCESS'])

function isAutoApprovable(t: string) { return AUTO_APPROVE_TYPES.has(t) }
function isNewControl(changeType: string, existingControlId: string | null | undefined) {
  return NEW_CONTROL_TYPES.has(changeType) || existingControlId == null
}

function fmtType(t: string) { return t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) }
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SEV_COLOR: Record<string, { fg: string; bg: string }> = {
  CRITICAL: { fg: '#fff', bg: '#7F1D1D' },
  HIGH:     { fg: '#E4002B', bg: '#FEE2E2' },
  MEDIUM:   { fg: '#B45309', bg: '#FEF3C7' },
  LOW:      { fg: '#6B7280', bg: '#F3F4F6' },
}

const SCAN_STEPS = [
  'Connecting to EUR-Lex CELLAR…',
  'Scanning DORA…', 'Scanning NIS2…', 'Scanning GDPR…', 'Scanning Solvency II…',
  'Running o3 delta analysis…', 'Storing findings…',
]

// ── Control flag badge ─────────────────────────────────────────────────────────

function ControlFlag({ isNew }: { isNew: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
      background: isNew ? '#D1FAE5' : '#FEF3C7',
      color: isNew ? '#065F46' : '#92400E',
      border: `1px solid ${isNew ? '#BBF7D0' : '#FDE68A'}`,
    }}>
      {isNew ? 'NEW CONTROL' : 'AMEND EXISTING'}
    </span>
  )
}

// ── Expanded change detail ─────────────────────────────────────────────────────

function ChangeDetail({ change }: { change: ControlChange }) {
  const pc = change.proposedChanges
  const newControl = isNewControl(change.changeType, pc?.existingControlId)

  return (
    <div style={{ padding: '14px 16px', background: '#FAFBFC', borderTop: '1px solid #E8EDF4', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Control classification */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <ControlFlag isNew={newControl} />
        <span style={{ fontSize: 11, color: '#9AA3AF' }}>{fmtType(change.changeType)}</span>
        {change.gap?.requirement && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', marginLeft: 'auto' }}>
            {change.gap.requirement.articleRef}
          </span>
        )}
      </div>

      {/* Description */}
      {change.description && (
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Control objective
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#1A1A2E', lineHeight: 1.6 }}>{change.description}</p>
        </div>
      )}

      {/* Gap addressed */}
      {change.gap && (
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gap addressed</p>
          <p style={{ margin: 0, fontSize: 12, color: '#4A5568', lineHeight: 1.5 }}>{change.gap.title}</p>
          {change.gap.requirement && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9AA3AF' }}>
              {change.gap.requirement.obligationType} obligation
            </p>
          )}
        </div>
      )}

      {/* Regulation trigger */}
      {pc?.trigger && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 6, padding: '10px 12px',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Regulation trigger — {pc.trigger.articleRef}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#78350F', fontStyle: 'italic', lineHeight: 1.55 }}>
            &ldquo;{pc.trigger.clauseText}&rdquo;
          </p>
          {pc.trigger.changeNature && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#92400E' }}>Nature: {pc.trigger.changeNature}</p>
          )}
          {pc.trigger.complianceDeadline && (
            <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, color: '#E4002B' }}>
              Deadline: {pc.trigger.complianceDeadline}
            </p>
          )}
        </div>
      )}

      {/* Implementation steps */}
      {pc?.steps && pc.steps.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Implementation steps</p>
          <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pc.steps.map((s, i) => (
              <li key={i} style={{ fontSize: 12, color: '#1A1A2E', lineHeight: 1.55 }}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Acceptance criteria (Evidence / Testing) */}
      {pc?.acceptanceCriteria && pc.acceptanceCriteria.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence &amp; acceptance criteria</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pc.acceptanceCriteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#0A7C59', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 12, color: '#1A1A2E', lineHeight: 1.55 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Policy documents to update */}
      {pc?.documentsToUpdate && pc.documentsToUpdate.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Policy documents to update</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pc.documentsToUpdate.map((d, i) => (
              <span key={i} style={{
                fontSize: 11, color: '#7C3AED', background: 'rgba(124,58,237,0.08)',
                border: '1px solid rgba(124,58,237,0.2)', borderRadius: 4, padding: '2px 8px',
              }}>📄 {d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Dates */}
      <div style={{ display: 'flex', gap: 20, fontSize: 11, color: '#B8C0CC', borderTop: '1px solid #E8EDF4', paddingTop: 10 }}>
        {change.proposedAt && <span>Proposed {fmtDate(change.proposedAt)}</span>}
        {change.approvedAt && <span style={{ color: '#0A7C59' }}>Approved {fmtDate(change.approvedAt)}</span>}
        {change.approvedBy && <span>by {change.approvedBy}</span>}
        {change.publishedAt && <span style={{ color: '#003781' }}>Published {fmtDate(change.publishedAt)}</span>}
        {change.aiGenerated && <span style={{ marginLeft: 'auto', color: '#7C3AED' }}>AI-generated</span>}
      </div>
    </div>
  )
}

// ── Change row ─────────────────────────────────────────────────────────────────

function ChangeRow({ change, signerName, onApproved }: {
  change: ControlChange; signerName: string; onApproved: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localStatus, setLocalStatus] = useState(change.status)
  const auto = isAutoApprovable(change.changeType)
  const newControl = isNewControl(change.changeType, change.proposedChanges?.existingControlId)
  const pending = localStatus === 'DRAFT' || localStatus === 'UNDER_REVIEW' || localStatus === 'CHANGE_PROPOSED'
  const approved = localStatus === 'APPROVED'

  const doApprove = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!signerName.trim() || busy) return
    setBusy(true)
    try {
      await fetch(`/api/compliance-hub/control-changes/${change.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: signerName, action: 'approve' }),
      })
      setLocalStatus('APPROVED')
      onApproved(change.id)
    } finally { setBusy(false) }
  }, [change.id, signerName, busy, onApproved])

  const doPublish = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      await fetch(`/api/compliance-hub/control-changes/${change.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      setLocalStatus('PUBLISHED')
      onApproved(change.id)
    } finally { setBusy(false) }
  }, [change.id, busy, onApproved])

  const reg = change.gap?.source?.shortCode

  return (
    <div style={{
      background: approved ? '#F0FAF6' : '#fff',
      border: `1px solid ${approved ? 'rgba(10,124,89,0.25)' : '#E8EDF4'}`,
      borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: approved ? '#0A7C59' : localStatus === 'PUBLISHED' ? '#003781' : '#B45309',
        }} />

        <ControlFlag isNew={newControl} />

        {reg && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#003781',
            background: 'rgba(0,55,129,0.08)', borderRadius: 4, padding: '2px 7px', flexShrink: 0,
          }}>{reg}</span>
        )}

        <span style={{
          flex: 1, fontSize: 13, fontWeight: 600,
          color: approved ? '#0A7C59' : '#1A1A2E',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{change.title}</span>

        <span style={{ fontSize: 11, color: '#B8C0CC', flexShrink: 0 }}>{fmtType(change.changeType)}</span>

        {auto && pending && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.1)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>AUTO</span>
        )}

        {pending && (
          <button onClick={doApprove} disabled={busy || !signerName.trim()} style={{
            padding: '4px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', flexShrink: 0,
            cursor: busy || !signerName.trim() ? 'not-allowed' : 'pointer',
            background: busy ? '#D0D7E3' : auto ? '#7C3AED' : '#003781', color: '#fff', transition: 'all 0.15s',
          }}>
            {busy ? '…' : auto ? '⚡ Auto' : '✓ Sign off'}
          </button>
        )}
        {approved && (
          <button onClick={doPublish} disabled={busy} style={{
            padding: '4px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', flexShrink: 0,
            cursor: busy ? 'not-allowed' : 'pointer',
            background: busy ? '#D0D7E3' : '#0A7C59', color: '#fff',
          }}>
            {busy ? '…' : '↑ Publish'}
          </button>
        )}
        {!pending && !approved && localStatus !== 'PUBLISHED' && (
          <span style={{ fontSize: 11, color: '#003781', fontWeight: 600, flexShrink: 0 }}>Published</span>
        )}

        <span style={{ fontSize: 11, color: '#C8D0DB', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && <ChangeDetail change={change} />}
    </div>
  )
}

// ── Gap AI recommendation panel ────────────────────────────────────────────────

function GapAiPanel({ gap, signerName }: { gap: ComplianceGap; signerName: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'approved' | 'error'>('idle')
  const [proposal, setProposal] = useState<GapProposal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [localSignerName, setLocalSignerName] = useState(signerName)

  useEffect(() => { setLocalSignerName(signerName) }, [signerName])

  const getRecommendation = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      const res = await fetch(`/api/compliance-hub/gaps/${gap.id}/propose-all`, { method: 'POST' })
      const data = await res.json() as GapProposal & { error?: string }
      if (data.error) throw new Error(data.error)
      setProposal(data)
      setState('ready')
    } catch (err) {
      setError(String(err))
      setState('error')
    }
  }, [gap.id])

  const approve = useCallback(async () => {
    if (!localSignerName.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/compliance-hub/gaps/${gap.id}/approve-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: localSignerName.trim(), action: 'approve' }),
      })
      const data = await res.json() as { error?: string }
      if (data.error) throw new Error(data.error)
      setState('approved')
    } catch (err) {
      setError(String(err))
    } finally { setBusy(false) }
  }, [gap.id, localSignerName, busy])

  if (state === 'idle') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#F4F6F9', borderTop: '1px solid #E8EDF4' }}>
        {gap.aiAnalysis && (
          <p style={{ margin: 0, fontSize: 12, color: '#4A5568', flex: 1, lineHeight: 1.5, fontStyle: 'italic' }}>
            <span style={{ color: '#7C3AED', fontWeight: 700 }}>AI: </span>{gap.aiAnalysis}
          </p>
        )}
        <button onClick={getRecommendation} style={{
          padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6,
          border: 'none', cursor: 'pointer', background: '#7C3AED', color: '#fff',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          🤖 Get AI recommendation
        </button>
      </div>
    )
  }

  if (state === 'loading') {
    return (
      <div style={{ padding: '14px 16px', borderTop: '1px solid #E8EDF4', background: '#F4F6F9', display: 'flex', alignItems: 'center', gap: 8, color: '#7C3AED', fontSize: 13 }}>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        o3 is analysing existing controls and policies…
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ padding: '12px 14px', borderTop: '1px solid #E8EDF4', background: '#FEF2F2', fontSize: 12, color: '#E4002B' }}>
        {error}
        <button onClick={() => setState('idle')} style={{ marginLeft: 10, fontSize: 11, color: '#003781', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Try again
        </button>
      </div>
    )
  }

  if (state === 'approved') {
    return (
      <div style={{ padding: '12px 16px', borderTop: '1px solid #E8EDF4', background: '#F0FAF6', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 16 }}>✓</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0A7C59' }}>Approved &amp; applied — control change saved and gap resolved</span>
      </div>
    )
  }

  if (!proposal) return null
  const { control, trigger, documents } = proposal

  return (
    <div style={{ borderTop: '1px solid #E8EDF4', background: '#FAFBFC' }}>
      {/* Recommendation header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8EDF4', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <ControlFlag isNew={control.isNew} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{control.title}</span>
        <span style={{ fontSize: 11, color: '#9AA3AF' }}>{fmtType(control.changeType)}</span>
        {control.estimatedEffort && (
          <span style={{ fontSize: 11, color: '#4A5568', marginLeft: 'auto' }}>Effort: {control.estimatedEffort}</span>
        )}
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Existing vs proposed */}
        {!control.isNew && control.currentState && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#E4002B' }}>BEFORE — current control</p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>{control.currentState.title}</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4A5568', lineHeight: 1.5 }}>{control.currentState.description}</p>
            </div>
            <div style={{ background: '#F0FAF6', border: '1px solid #BBF7D0', borderRadius: 6, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#0A7C59' }}>AFTER — proposed changes</p>
              <p style={{ margin: 0, fontSize: 12, color: '#1A1A2E', lineHeight: 1.5 }}>{control.description}</p>
            </div>
          </div>
        )}

        {/* New control description */}
        {control.isNew && (
          <div style={{ background: '#F0FAF6', border: '1px solid #BBF7D0', borderRadius: 6, padding: '10px 12px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#0A7C59' }}>NEW CONTROL — what will be created</p>
            <p style={{ margin: 0, fontSize: 12, color: '#1A1A2E', lineHeight: 1.55 }}>{control.description}</p>
          </div>
        )}

        {/* Implementation steps */}
        {control.steps.length > 0 && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Implementation steps</p>
            <ol style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {control.steps.map((s, i) => <li key={i} style={{ fontSize: 12, color: '#1A1A2E', lineHeight: 1.55 }}>{s}</li>)}
            </ol>
          </div>
        )}

        {/* Acceptance criteria */}
        {control.acceptanceCriteria.length > 0 && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence &amp; acceptance criteria</p>
            {control.acceptanceCriteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#0A7C59', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 12, color: '#1A1A2E', lineHeight: 1.55 }}>{c}</span>
              </div>
            ))}
          </div>
        )}

        {/* Policy documents */}
        {documents.length > 0 && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {documents.filter(d => d.isNew).length > 0 ? 'Policy documents (new + amended)' : 'Policy documents to amend'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {documents.map((doc, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 12,
                  background: doc.isNew ? '#F0FAF6' : '#FAFBFC',
                  border: `1px solid ${doc.isNew ? '#BBF7D0' : '#E8EDF4'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📄</span>
                    <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{doc.documentTitle}</span>
                    {doc.isNew && <span style={{ fontSize: 10, fontWeight: 700, color: '#0A7C59', background: '#D1FAE5', borderRadius: 3, padding: '1px 5px' }}>NEW</span>}
                  </div>
                  {doc.changeSummary && <p style={{ margin: '4px 0 0', color: '#4A5568', lineHeight: 1.5 }}>{doc.changeSummary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regulation trigger */}
        {trigger.clauseText && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '10px 12px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#B45309' }}>
              Trigger — {trigger.articleRef} · {trigger.changeNature}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#78350F', fontStyle: 'italic', lineHeight: 1.55 }}>
              &ldquo;{trigger.clauseText}&rdquo;
            </p>
            {trigger.complianceDeadline && (
              <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 700, color: '#E4002B' }}>
                Deadline: {trigger.complianceDeadline}
              </p>
            )}
          </div>
        )}

        {/* Approve bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
          <input
            value={localSignerName}
            onChange={e => setLocalSignerName(e.target.value)}
            placeholder="Your name…"
            style={{
              flex: 1, padding: '7px 10px', fontSize: 13, border: '1px solid #D0D7E3',
              borderRadius: 6, outline: 'none', color: '#1A1A2E', background: '#fff',
            }}
          />
          <button
            onClick={approve}
            disabled={!localSignerName.trim() || busy}
            style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 700, borderRadius: 6,
              border: 'none', cursor: busy || !localSignerName.trim() ? 'not-allowed' : 'pointer',
              background: busy || !localSignerName.trim() ? '#D0D7E3' : '#0A7C59',
              color: '#fff', whiteSpace: 'nowrap',
            }}
          >
            {busy ? '…' : '✓ Approve & apply'}
          </button>
          <button
            onClick={() => setState('idle')}
            style={{
              padding: '7px 12px', fontSize: 12, borderRadius: 6,
              border: '1px solid #D0D7E3', cursor: 'pointer',
              background: '#fff', color: '#9AA3AF',
            }}
          >
            Dismiss
          </button>
        </div>

        {error && <p style={{ margin: 0, fontSize: 12, color: '#E4002B' }}>{error}</p>}
      </div>
    </div>
  )
}

// ── Gap row ────────────────────────────────────────────────────────────────────

function GapRow({ gap, signerName }: { gap: ComplianceGap; signerName: string }) {
  const [expanded, setExpanded] = useState(false)
  const sev = SEV_COLOR[gap.severity] ?? SEV_COLOR.LOW

  return (
    <div style={{ background: '#fff', border: '1px solid #E8EDF4', borderRadius: 8, overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: '#E4002B' }} />
        {gap.source && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#003781', background: 'rgba(0,55,129,0.08)', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>
            {gap.source.shortCode}
          </span>
        )}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A1A2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {gap.title}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: sev.fg, background: sev.bg, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
          {gap.severity}
        </span>
        {gap.requirement && (
          <span style={{ fontSize: 11, color: '#9AA3AF', flexShrink: 0 }}>{gap.requirement.articleRef}</span>
        )}
        <span style={{ fontSize: 11, color: '#C8D0DB', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && <GapAiPanel gap={gap} signerName={signerName} />}
    </div>
  )
}

// ── Scanner section ────────────────────────────────────────────────────────────

function ScannerSection({ onScanComplete }: { onScanComplete: (newGaps: number) => void }) {
  const [scanning, setScanning] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastScanAt, setLastScanAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/compliance-hub/regulatory-intelligence/scan')
      .then(r => r.json())
      .then((d: { reports?: { scannedAt: string }[] }) => {
        if (d.reports && d.reports.length > 0) setLastScanAt(d.reports[0].scannedAt)
      })
      .catch(() => null)
  }, [])

  const runScan = useCallback(async () => {
    setScanning(true)
    setStepIdx(0)
    setResult(null)
    setError(null)

    const timer = setInterval(() => {
      setStepIdx(prev => prev < SCAN_STEPS.length - 1 ? prev + 1 : prev)
    }, 3200)

    try {
      const res = await fetch('/api/compliance-hub/regulatory-intelligence/scan', { method: 'POST' })
      clearInterval(timer)
      const data = await res.json() as ScanResult & { error?: string }
      if (data.error) { setError(data.error); return }
      setResult(data)
      setLastScanAt(new Date().toISOString())
      onScanComplete(data.newGapsCreated)
    } catch (err) {
      clearInterval(timer)
      setError(String(err))
    } finally {
      setScanning(false)
    }
  }, [onScanComplete])

  return (
    <div style={{ border: '1px solid #D0D7E3', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
        background: result ? '#F0FAF6' : '#EFF6FF',
        borderBottom: scanning || result || error ? '1px solid #D0D7E3' : 'none',
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#003781' }}>
            ⚡ Regulatory Intelligence Scanner
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#4A5568' }}>
            EUR-Lex CELLAR + o3 · scans DORA, NIS2, GDPR &amp; Solvency II
            {lastScanAt && !scanning && !result && (
              <span style={{ color: '#9AA3AF' }}> · last run {fmtDate(lastScanAt)}</span>
            )}
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none',
            cursor: scanning ? 'not-allowed' : 'pointer',
            background: scanning ? '#D0D7E3' : result ? '#0A7C59' : '#003781',
            color: '#fff', flexShrink: 0,
          }}
        >
          {scanning ? 'Scanning…' : result ? 'Re-scan' : 'Run Scan'}
        </button>
        {result && (
          <Link
            href="/compliance-hub/regulatory-intelligence"
            style={{ fontSize: 12, color: '#003781', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
          >
            Full report →
          </Link>
        )}
      </div>

      {/* Progress */}
      {scanning && (
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SCAN_STEPS.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i < stepIdx
                  ? <span style={{ color: '#0A7C59', fontWeight: 700 }}>✓</span>
                  : i === stepIdx
                    ? <span style={{ color: '#7C3AED', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                    : <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E8EDF4', display: 'inline-block' }} />
                }
              </span>
              <span style={{ fontSize: 12, color: i <= stepIdx ? '#1A1A2E' : '#B8C0CC', fontWeight: i === stepIdx ? 600 : 400 }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 18px', background: '#FEF2F2', fontSize: 12, color: '#E4002B' }}>
          {error}
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div style={{ padding: '14px 18px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: result.eurLexConnected ? '#0A7C59' : '#B45309' }} />
            <span style={{ fontSize: 12, color: '#4A5568' }}>
              EUR-Lex {result.eurLexConnected ? 'live' : 'unavailable (AI knowledge used)'}
            </span>
          </div>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: result.updatesFound.length > 0 ? '#003781' : '#9AA3AF' }}>{result.updatesFound.length}</span>
            <span style={{ color: '#9AA3AF', marginLeft: 4 }}>regulatory updates</span>
          </div>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: result.newGapsCreated > 0 ? '#E4002B' : '#0A7C59' }}>{result.newGapsCreated}</span>
            <span style={{ color: '#9AA3AF', marginLeft: 4 }}>new gaps</span>
          </div>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: (result.controlsImpacted as unknown[]).length > 0 ? '#B45309' : '#9AA3AF' }}>
              {(result.controlsImpacted as unknown[]).length}
            </span>
            <span style={{ color: '#9AA3AF', marginLeft: 4 }}>controls at risk</span>
          </div>
          {result.newGapsCreated === 0 && (
            <span style={{ fontSize: 12, color: '#0A7C59', fontWeight: 600 }}>✓ No new gaps identified</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, count, countColor }: { title: string; count: number; countColor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{title}</h2>
      <span style={{
        fontSize: 11, fontWeight: 700, color: countColor,
        background: `${countColor}18`, borderRadius: 10, padding: '2px 8px',
      }}>{count}</span>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ComplianceHubPage() {
  const [sources, setSources] = useState<RegulatorySource[]>([])
  const [gaps, setGaps] = useState<ComplianceGap[]>([])
  const [changes, setChanges] = useState<ControlChange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regulationsOpen, setRegulationsOpen] = useState(false)
  const [signerName, setSignerName] = useState('Compliance Officer')

  const loadData = useCallback(() => {
    Promise.all([
      fetch('/api/compliance-hub/regulations').then(r => r.json()),
      fetch('/api/compliance-hub/gaps').then(r => r.json()),
      fetch('/api/compliance-hub/control-changes').then(r => r.json()),
    ])
      .then(([srcData, gapData, chgData]) => {
        if (srcData.error) throw new Error(srcData.error)
        setSources(srcData as RegulatorySource[])
        setGaps(gapData as ComplianceGap[])
        setChanges(chgData as ControlChange[])
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleScanComplete = useCallback((newGaps: number) => {
    if (newGaps > 0) {
      fetch('/api/compliance-hub/gaps').then(r => r.json()).then((d: ComplianceGap[]) => setGaps(d))
    }
  }, [])

  const handleApproved = useCallback((id: string) => {
    fetch('/api/compliance-hub/control-changes').then(r => r.json()).then((d: ControlChange[]) => setChanges(d))
    void id
  }, [])

  const openGaps = gaps.filter(g => g.status === 'OPEN' || g.status === 'IN_ANALYSIS')
  const needsSignOff = changes.filter(c => c.status === 'DRAFT' || c.status === 'UNDER_REVIEW' || c.status === 'CHANGE_PROPOSED')
  const readyToPublish = changes.filter(c => c.status === 'APPROVED')

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 48px' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#003781' }}>Compliance Hub</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9AA3AF' }}>
          Scan regulations · get AI recommendations · sign off
        </p>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '64px 0', color: '#9AA3AF' }}>Loading…</div>}
      {error && <div style={{ padding: 16, borderRadius: 8, background: '#FEE2E2', color: '#E4002B', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Scanner — embedded directly */}
          <ScannerSection onScanComplete={handleScanComplete} />

          {/* Signer name (shown only when there are pending items) */}
          {(needsSignOff.length > 0 || readyToPublish.length > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#9AA3AF', flexShrink: 0 }}>Signing off as</span>
              <input
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                style={{
                  padding: '5px 10px', fontSize: 13, border: '1px solid #D0D7E3',
                  borderRadius: 6, outline: 'none', color: '#1A1A2E', background: '#fff', width: 200,
                }}
              />
            </div>
          )}

          {/* Changes needing sign-off */}
          {needsSignOff.length > 0 && (
            <section>
              <SectionHeader title="Pending sign-off" count={needsSignOff.length} countColor="#B45309" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {needsSignOff.map(c => (
                  <ChangeRow key={c.id} change={c} signerName={signerName} onApproved={handleApproved} />
                ))}
              </div>
            </section>
          )}

          {/* Approved → ready to publish */}
          {readyToPublish.length > 0 && (
            <section>
              <SectionHeader title="Approved — ready to publish" count={readyToPublish.length} countColor="#0A7C59" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {readyToPublish.map(c => (
                  <ChangeRow key={c.id} change={c} signerName={signerName} onApproved={handleApproved} />
                ))}
              </div>
            </section>
          )}

          {/* All clear */}
          {needsSignOff.length === 0 && readyToPublish.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', background: '#F0FAF6', border: '1px solid rgba(10,124,89,0.2)', borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0A7C59' }}>✓ No changes pending</p>
            </div>
          )}

          {/* Open gaps with AI recommendations */}
          {openGaps.length > 0 && (
            <section>
              <SectionHeader title="Open gaps — AI recommendations" count={openGaps.length} countColor="#E4002B" />
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9AA3AF' }}>
                Click a gap and ask AI what to change — existing policy or new control.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {openGaps.map(g => <GapRow key={g.id} gap={g} signerName={signerName} />)}
              </div>
            </section>
          )}

          {/* Regulations — collapsed by default */}
          <section>
            <button
              onClick={() => setRegulationsOpen(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', width: '100%', textAlign: 'left' }}
            >
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#4A5568' }}>
                {sources.length} regulations monitored
              </h2>
              <span style={{ fontSize: 12, color: '#9AA3AF', marginLeft: 'auto' }}>
                {regulationsOpen ? '▲ hide' : '▼ show'}
              </span>
            </button>

            {regulationsOpen && (
              <div style={{ marginTop: 10, background: '#fff', border: '1px solid #E8EDF4', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F4F6F9', borderBottom: '1px solid #E8EDF4' }}>
                      {['Code', 'Name', 'Requirements', 'Gaps'].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: h === 'Code' || h === 'Name' ? 'left' : 'center',
                          fontSize: 11, fontWeight: 700, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((src, i) => (
                      <tr key={src.id} style={{ borderTop: i > 0 ? '1px solid #E8EDF4' : undefined }}>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#003781', background: 'rgba(0,55,129,0.08)', borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace' }}>
                            {src.shortCode}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#1A1A2E', fontWeight: 500 }}>{src.name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#003781', fontWeight: 600 }}>{src.requirementCount}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: src.gapCount > 0 ? '#E4002B' : '#0A7C59' }}>
                          {src.gapCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  )
}
