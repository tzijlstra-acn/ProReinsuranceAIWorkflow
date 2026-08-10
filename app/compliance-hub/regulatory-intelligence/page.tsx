'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RegUpdate {
  source: string; title: string; date: string; type: string
  celexId?: string; summary: string; fromEurLex: boolean
}
interface ControlImpact {
  controlId: string; title: string; requirementId: string | null; reason: string
}
interface PolicyImpact {
  source: string; documentId: string; documentTitle: string; reason: string
}
interface ScanReport {
  id: string; scannedAt: string; status: string; eurLexConnected: boolean
  sourcesScanned: number; updatesFound: RegUpdate[]; newVersionsCreated: number
  newGapsCreated: number; controlsImpacted: ControlImpact[]
  policiesImpacted: PolicyImpact[]; aiSummary: string | null; error: string | null
}
interface ScanResult {
  ok: boolean; scanId: string; scannedAt: string; eurLexConnected: boolean
  sourcesScanned: number; updatesFound: RegUpdate[]; newVersionsCreated: number
  newGapsCreated: number; controlsImpacted: ControlImpact[]; policiesImpacted: PolicyImpact[]
}
interface ScanGap {
  id: string; title: string; severity: string; gapType: string; status: string
  detectedAt: string; description: string; aiAnalysis: string | null
  sourceShortCode: string; requirementRef: string; requirementTitle: string
}
interface DocUpdate {
  documentId: string; documentTitle: string; currentContent: string
  proposedContent: string; changeSummary: string; addedClauses: string[]
}
interface ControlProposal {
  title: string; description: string; changeType: string; estimatedEffort: string
  proposedChanges: {
    summary: string; steps: string[]; documentsToUpdate: string[]
    technicalChanges: string; acceptanceCriteria: string[]
  }
}
interface GapProposal {
  controlChangeId: string
  gap: { id: string; title: string; severity: string; gapType: string; sourceShortCode: string; requirementRef: string; requirementTitle: string; aiAnalysis: string | null }
  controlProposal: ControlProposal
  documentUpdates: DocUpdate[]
}
// Raw gap shape from the API (ComplianceGapWithDetail)
interface ApiGap {
  id: string; title: string; severity: string; gapType: string; status: string
  detectedAt: string; description: string; aiAnalysis: string | null
  requirement: { id: string; articleRef: string; title: string } | null
  source: { id: string; shortCode: string; name: string } | null
}

type ReviewState = 'idle' | 'generating' | 'ready' | 'approved' | 'rejected'

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const MR_MIDNIGHT = '#003781'
const MR_GREEN = '#0A7C59'
const MR_RED = '#E4002B'
const MR_AMBER = '#B45309'
const MR_VIOLET = '#7C3AED'

const SEV: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: MR_RED,    bg: '#FEE2E2' },
  HIGH:     { color: MR_AMBER,  bg: '#FEF3C7' },
  MEDIUM:   { color: MR_MIDNIGHT, bg: '#EBF5FF' },
  LOW:      { color: '#6B7280', bg: '#F3F4F6' },
}
const SRC: Record<string, string> = { DORA: '#003781', NIS2: '#7C3AED', GDPR: '#0A7C59' }
const UPD_TYPE: Record<string, { label: string; color: string; bg: string }> = {
  RTS:              { label: 'RTS',              color: '#003781', bg: '#EBF5FF' },
  ITS:              { label: 'ITS',              color: '#003781', bg: '#EBF5FF' },
  IMPLEMENTING_ACT: { label: 'Implementing Act', color: '#7C3AED', bg: '#F5F3FF' },
  DELEGATED_ACT:    { label: 'Delegated Act',    color: '#7C3AED', bg: '#F5F3FF' },
  AMENDMENT:        { label: 'Amendment',        color: '#B45309', bg: '#FEF3C7' },
  CORRIGENDUM:      { label: 'Corrigendum',      color: '#6B7280', bg: '#F3F4F6' },
  GUIDANCE:         { label: 'Guidance',         color: '#0A7C59', bg: '#F0FAF6' },
  OTHER:            { label: 'Other',            color: '#6B7280', bg: '#F3F4F6' },
}

const SCAN_STEPS = [
  'Connecting to EUR-Lex CELLAR…',
  'Scanning DORA (32022R2554)…',
  'Scanning NIS2 (32022L2555)…',
  'Scanning GDPR (32016R0679)…',
  'Running AI delta analysis…',
  'Checking control impact…',
  'Storing findings…',
]

// ─────────────────────────────────────────────────────────────────────────────
// Tiny shared components
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="animate-spin" style={{ width: size, height: size }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
function SourceChip({ s }: { s: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: SRC[s] ?? '#6B7280', color: 'white' }}>{s}</span>
}
function SevBadge({ v }: { v: string }) {
  const s = SEV[v] ?? SEV.LOW
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ background: s.bg, color: s.color }}>{v}</span>
}
function TypeBadge({ t }: { t: string }) {
  const s = UPD_TYPE[t] ?? UPD_TYPE.OTHER
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: s.bg, color: s.color }}>{s.label}</span>
}
function KpiTile({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-1" style={{ border: '1px solid #D0D7E3' }}>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>{label}</span>
      <span className="text-2xl font-bold leading-none mt-0.5" style={{ color: color ?? MR_MIDNIGHT }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: '#9CA3AF' }}>{sub}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Document before/after diff
// ─────────────────────────────────────────────────────────────────────────────

function DocDiff({ u }: { u: DocUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const clip = (text: string) => !expanded && text.length > 400 ? text.slice(0, 400) + '…' : text

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #D0D7E3' }}>
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: '#F9FAFB', borderBottom: '1px solid #D0D7E3' }}>
        <span className="text-xs font-semibold" style={{ color: MR_MIDNIGHT }}>📄 {u.documentTitle}</span>
        <button onClick={() => setExpanded(e => !e)} className="text-xs" style={{ color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
          {expanded ? 'Collapse' : 'Show full diff'}
        </button>
      </div>
      {u.changeSummary && (
        <div className="px-3 py-2 text-xs" style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A', color: '#92400E' }}>
          <strong>What changes:</strong> {u.changeSummary}
        </div>
      )}
      <div className="grid grid-cols-2 divide-x" style={{ divideColor: '#D0D7E3' } as React.CSSProperties}>
        <div className="p-3">
          <p className="text-xs font-bold mb-2" style={{ color: MR_RED }}>BEFORE — current</p>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: '#374151', maxHeight: expanded ? 'none' : 200, overflow: 'hidden' }}>
            {clip(u.currentContent)}
          </pre>
        </div>
        <div className="p-3" style={{ background: '#F0FAF6' }}>
          <p className="text-xs font-bold mb-2" style={{ color: MR_GREEN }}>AFTER — proposed</p>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: '#374151', maxHeight: expanded ? 'none' : 200, overflow: 'hidden' }}>
            {clip(u.proposedContent)}
          </pre>
        </div>
      </div>
      {u.addedClauses.length > 0 && (
        <div className="px-3 py-2 space-y-0.5" style={{ background: '#F0FAF6', borderTop: '1px solid #BBF7D0' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: MR_GREEN }}>Added / changed clauses:</p>
          {u.addedClauses.map((c, i) => (
            <div key={i} className="flex gap-1.5 text-xs" style={{ color: '#065F46' }}>
              <span className="flex-shrink-0 font-bold">+</span><span>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Control before/after diff
// ─────────────────────────────────────────────────────────────────────────────

function ControlDiff({ p }: { p: ControlProposal }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #D0D7E3' }}>
      <div className="px-3 py-2" style={{ background: '#F9FAFB', borderBottom: '1px solid #D0D7E3' }}>
        <span className="text-xs font-semibold" style={{ color: MR_MIDNIGHT }}>🔧 Control Change</span>
      </div>
      <div className="grid grid-cols-2 divide-x" style={{ divideColor: '#D0D7E3' } as React.CSSProperties}>
        <div className="p-3">
          <p className="text-xs font-bold mb-2" style={{ color: MR_RED }}>BEFORE — current</p>
          <p className="text-xs italic" style={{ color: '#9CA3AF' }}>No control exists for this gap.</p>
        </div>
        <div className="p-3" style={{ background: '#F0FAF6' }}>
          <p className="text-xs font-bold mb-2" style={{ color: MR_GREEN }}>AFTER — proposed</p>
          <p className="text-sm font-semibold mb-1" style={{ color: MR_MIDNIGHT }}>{p.title}</p>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold mb-2" style={{ background: '#EBF5FF', color: MR_MIDNIGHT }}>{p.changeType}</span>
          <p className="text-xs mb-2" style={{ color: '#374151' }}>{p.description}</p>
          {p.proposedChanges.steps.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-1" style={{ color: MR_MIDNIGHT }}>Implementation steps:</p>
              <ol className="space-y-0.5 list-decimal list-inside">
                {p.proposedChanges.steps.slice(0, 5).map((step, i) => (
                  <li key={i} className="text-xs" style={{ color: '#374151' }}>{step}</li>
                ))}
              </ol>
            </>
          )}
          {p.estimatedEffort && (
            <p className="text-xs mt-2" style={{ color: '#6B7280' }}>Effort: <strong>{p.estimatedEffort}</strong></p>
          )}
        </div>
      </div>
      {p.proposedChanges.acceptanceCriteria.length > 0 && (
        <div className="px-3 py-2 space-y-0.5" style={{ background: '#F0FAF6', borderTop: '1px solid #BBF7D0' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: MR_GREEN }}>Acceptance criteria:</p>
          {p.proposedChanges.acceptanceCriteria.map((c, i) => (
            <div key={i} className="flex gap-1.5 text-xs" style={{ color: '#065F46' }}>
              <span className="flex-shrink-0">✓</span><span>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-contained gap review card
// ─────────────────────────────────────────────────────────────────────────────

function GapReviewCard({ gap }: { gap: ScanGap }) {
  const [state, setState] = useState<ReviewState>('idle')
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState<GapProposal | null>(null)
  const [approver, setApprover] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function propose() {
    setState('generating')
    setError(null)
    try {
      const res = await fetch(`/api/compliance-hub/gaps/${gap.id}/propose-all`, { method: 'POST' })
      const json = await res.json() as GapProposal & { error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to generate proposal')
      setProposal(json)
      setState('ready')
    } catch (err) {
      setError(String(err))
      setState('idle')
    }
  }

  async function approve() {
    if (!approver.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/compliance-hub/gaps/${gap.id}/approve-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: approver.trim(), action: 'approve' }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? 'Approval failed')
      setState('approved')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/compliance-hub/gaps/${gap.id}/approve-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? 'Reject failed')
      setState('rejected')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Resolved states ──
  if (state === 'approved') {
    return (
      <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: '#F0FAF6', border: '1px solid #BBF7D0' }}>
        <svg viewBox="0 0 20 20" fill={MR_GREEN} className="w-5 h-5 flex-shrink-0">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: MR_GREEN }}>Approved &amp; applied</p>
          <p className="text-xs" style={{ color: '#065F46' }}>{gap.title} — control published, documents updated</p>
        </div>
      </div>
    )
  }

  if (state === 'rejected') {
    return (
      <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: '#F9FAFB', border: '1px solid #D0D7E3' }}>
        <span style={{ color: '#6B7280', fontSize: 18 }}>✕</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#6B7280' }}>Rejected</p>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>{gap.title} — changes discarded, gap remains open</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #D0D7E3', boxShadow: '0 1px 4px rgba(0,56,129,0.06)' }}>
      {/* Gap header */}
      <div className="px-5 py-4" style={{ borderBottom: state === 'ready' ? '1px solid #D0D7E3' : 'none' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <SourceChip s={gap.sourceShortCode} />
            <SevBadge v={gap.severity} />
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: '#F3F4F6', color: '#374151' }}>{gap.requirementRef}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#6B7280' }}>{gap.gapType}</span>
          </div>
          <div className="flex items-center gap-2">
            {state === 'idle' && (
              <button onClick={propose}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded"
                style={{ background: MR_VIOLET, color: 'white', border: 'none', cursor: 'pointer' }}>
                ✦ Generate Proposal
              </button>
            )}
            {state === 'generating' && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: MR_VIOLET }}>
                <Spinner size={14} /> Generating with o3…
              </span>
            )}
            {state === 'ready' && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#D1FAE5', color: '#065F46' }}>Proposal ready</span>
            )}
          </div>
        </div>

        <h3 className="text-sm font-bold mt-2.5" style={{ color: MR_MIDNIGHT }}>{gap.title}</h3>
        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{gap.requirementTitle}</p>
        {gap.aiAnalysis && (
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#374151' }}>
            <span className="font-semibold" style={{ color: MR_VIOLET }}>AI: </span>{gap.aiAnalysis}
          </p>
        )}
        {error && <p className="text-xs mt-2" style={{ color: MR_RED }}>{error}</p>}
      </div>

      {/* Before / After proposal */}
      {state === 'ready' && proposal && (
        <div className="p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>
            Proposed changes — review before approving
          </p>

          {/* Control diff */}
          <ControlDiff p={proposal.controlProposal} />

          {/* Document diffs */}
          {proposal.documentUpdates.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold" style={{ color: MR_MIDNIGHT }}>
                Policy / document updates ({proposal.documentUpdates.length}):
              </p>
              {proposal.documentUpdates.map(u => <DocDiff key={u.documentId} u={u} />)}
            </div>
          ) : (
            <div className="rounded-lg px-4 py-3 text-xs" style={{ background: '#F9FAFB', border: '1px solid #D0D7E3', color: '#6B7280' }}>
              No mapped policy documents — only the control change will be applied.
            </div>
          )}

          {/* Approve / Reject bar */}
          <div className="rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap" style={{ background: '#F9FAFB', border: '1px solid #D0D7E3' }}>
            <input
              type="text"
              placeholder="Approver name…"
              value={approver}
              onChange={e => setApprover(e.target.value)}
              className="text-sm px-3 py-1.5 rounded flex-1 min-w-40"
              style={{ border: '1px solid #D0D7E3', background: 'white', color: MR_MIDNIGHT, outline: 'none' }}
            />
            <button
              onClick={reject}
              disabled={busy}
              className="text-sm font-semibold px-4 py-1.5 rounded"
              style={{ background: 'white', color: MR_RED, border: `1px solid ${MR_RED}`, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              Reject
            </button>
            <button
              onClick={approve}
              disabled={!approver.trim() || busy}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded"
              style={{
                background: !approver.trim() || busy ? '#9CA3AF' : MR_GREEN,
                color: 'white', border: 'none',
                cursor: !approver.trim() || busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? <><Spinner size={14} /> Applying…</> : <>✓ Approve &amp; Apply</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RegulatoryIntelligencePage() {
  const [scanning, setScanning] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [history, setHistory] = useState<ScanReport[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [activeTab, setActiveTab] = useState<'updates' | 'controls' | 'policies'>('updates')
  const [scanGaps, setScanGaps] = useState<ScanGap[]>([])
  const [loadingGaps, setLoadingGaps] = useState(false)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/compliance-hub/regulatory-intelligence/scan')
      const json = await res.json() as { reports?: ScanReport[] }
      setHistory(json.reports ?? [])
    } catch { /* ignore */ } finally {
      setLoadingHistory(false)
    }
  }

  async function loadScanGaps() {
    setLoadingGaps(true)
    try {
      // API returns ComplianceGapWithDetail[] directly (not wrapped)
      const res = await fetch('/api/compliance-hub/gaps')
      const allGaps = await res.json() as ApiGap[]
      // Keep only gaps created in the last 10 minutes
      const recent = allGaps
        .filter(g => Date.now() - new Date(g.detectedAt).getTime() < 10 * 60 * 1000)
        .map(g => ({
          id: g.id,
          title: g.title,
          severity: g.severity,
          gapType: g.gapType,
          status: g.status,
          detectedAt: g.detectedAt,
          description: g.description,
          aiAnalysis: g.aiAnalysis,
          sourceShortCode: g.source?.shortCode ?? '',
          requirementRef: g.requirement?.articleRef ?? '',
          requirementTitle: g.requirement?.title ?? '',
        }))
      setScanGaps(recent)
    } catch { /* ignore */ } finally {
      setLoadingGaps(false)
    }
  }

  async function runScan() {
    setScanning(true)
    setStepIdx(0)
    setResult(null)
    setScanError(null)
    setScanGaps([])

    const stepTimer = setInterval(() => {
      setStepIdx(prev => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev))
    }, 3500)

    try {
      const res = await fetch('/api/compliance-hub/regulatory-intelligence/scan', { method: 'POST' })
      clearInterval(stepTimer)
      const json = await res.json() as ScanResult & { error?: string }
      if (!res.ok || json.error) {
        setScanError(json.error ?? 'Scan failed')
      } else {
        setResult(json)
        setActiveTab('updates')
        await Promise.all([loadHistory(), json.newGapsCreated > 0 ? loadScanGaps() : Promise.resolve()])
      }
    } catch (err) {
      clearInterval(stepTimer)
      setScanError(String(err))
    } finally {
      setScanning(false)
    }
  }

  const lastScan = history[0]

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/compliance-hub" className="text-xs" style={{ color: '#6B7280', textDecoration: 'none' }}>Compliance Hub</Link>
            <span style={{ color: '#D1D5DB' }}>›</span>
            <span className="text-xs font-semibold" style={{ color: MR_MIDNIGHT }}>Regulatory Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: MR_MIDNIGHT }}>Regulatory Intelligence Scanner</h1>
          <p className="text-sm mt-1" style={{ color: '#4A5568' }}>
            Live EUR-Lex API + o3 · Checks all controls &amp; policies · Before/after review before you approve
          </p>
        </div>
        <button
          onClick={runScan} disabled={scanning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm"
          style={{ background: scanning ? '#9CA3AF' : MR_VIOLET, color: 'white', border: 'none', cursor: scanning ? 'not-allowed' : 'pointer' }}
        >
          {scanning ? <><Spinner size={16} />Scanning…</> : <>⚡ Run Intelligence Scan</>}
        </button>
      </div>

      {/* ── Explainer ── */}
      <div className="rounded-xl p-4 text-sm" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', color: '#4C1D95' }}>
        <strong>How it works:</strong> Each scan queries EUR-Lex CELLAR for live implementing acts, RTS/ITS, and guidance.
        o3 analyses them against all existing requirements, controls, and policies — generating real gaps.
        For each gap: generate a proposal to see the exact <em>before/after</em> for the control and every affected
        policy document before you approve.
      </div>

      {/* ── Scan progress ── */}
      {scanning && (
        <div className="rounded-xl p-5" style={{ background: 'white', border: '1px solid #D0D7E3' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: MR_MIDNIGHT }}>Running — o3 is analysing all regulations…</p>
          <div className="space-y-2.5">
            {SCAN_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5">
                  {i < stepIdx
                    ? <svg viewBox="0 0 20 20" fill={MR_GREEN} className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    : i === stepIdx
                      ? <span style={{ color: MR_VIOLET }}><Spinner size={18} /></span>
                      : <div className="w-5 h-5 rounded-full" style={{ background: '#E5E7EB' }} />
                  }
                </div>
                <span className="text-sm" style={{ color: i <= stepIdx ? MR_MIDNIGHT : '#9CA3AF', fontWeight: i === stepIdx ? 600 : 400 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {scanError && (
        <div className="rounded-xl p-4 text-sm" style={{ background: '#FEE2E2', color: MR_RED, border: '1px solid #FECACA' }}>
          <strong>Scan failed:</strong> {scanError}
        </div>
      )}

      {/* ── Scan results ── */}
      {result && (
        <div className="space-y-6">
          {/* Connection status */}
          <div className="rounded-xl p-4 flex items-center gap-3 text-sm"
            style={{ background: result.eurLexConnected ? '#F0FAF6' : '#FFFBEB', border: `1px solid ${result.eurLexConnected ? '#BBF7D0' : '#FDE68A'}` }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: result.eurLexConnected ? MR_GREEN : MR_AMBER }} />
            <span style={{ color: result.eurLexConnected ? '#065F46' : '#92400E' }}>
              {result.eurLexConnected
                ? 'EUR-Lex CELLAR: Connected — live API data included in analysis'
                : 'EUR-Lex CELLAR: Unreachable — o3 regulatory knowledge used (labeled AI Watch)'}
            </span>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiTile label="Regulations Scanned" value={result.sourcesScanned} />
            <KpiTile label="Updates Found" value={result.updatesFound.length} color={result.updatesFound.length > 0 ? MR_MIDNIGHT : '#6B7280'} sub="Acts, RTS/ITS, guidance" />
            <KpiTile label="New Gaps" value={result.newGapsCreated} color={result.newGapsCreated > 0 ? MR_RED : MR_GREEN} sub="Stored — review below" />
            <KpiTile label="Controls at Risk" value={result.controlsImpacted.length} color={result.controlsImpacted.length > 0 ? MR_AMBER : '#6B7280'} sub="Published controls" />
          </div>

          {/* Tab bar */}
          <div style={{ borderBottom: '1px solid #D0D7E3' }}>
            <div className="flex">
              {(['updates', 'controls', 'policies'] as const).map(tab => {
                const counts = { updates: result.updatesFound.length, controls: result.controlsImpacted.length, policies: result.policiesImpacted.length }
                const labels = { updates: 'Regulatory Updates', controls: 'Controls at Risk', policies: 'Policies to Review' }
                const active = activeTab === tab
                return (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors"
                    style={{ borderColor: active ? MR_VIOLET : 'transparent', color: active ? MR_VIOLET : '#6B7280', background: 'transparent', cursor: 'pointer' }}>
                    {labels[tab]}
                    <span className="ml-1.5 inline-flex items-center justify-center text-xs font-bold rounded-full"
                      style={{ background: active ? MR_VIOLET : '#E5E7EB', color: active ? 'white' : '#6B7280', minWidth: 20, height: 20, padding: '0 5px' }}>
                      {counts[tab]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {activeTab === 'updates' && (
            <div className="space-y-3">
              {result.updatesFound.length === 0
                ? <p className="text-sm text-center py-8" style={{ color: '#6B7280' }}>No regulatory updates found.</p>
                : result.updatesFound.map((u, i) => (
                  <div key={i} className="bg-white rounded-xl p-4" style={{ border: '1px solid #D0D7E3' }}>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <SourceChip s={u.source} />
                      <TypeBadge t={u.type} />
                      {u.fromEurLex
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#F0FAF6', color: '#065F46' }}>EUR-Lex</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>AI Watch</span>
                      }
                      <span className="text-xs ml-auto" style={{ color: '#9CA3AF' }}>
                        {u.date}{u.celexId && <span className="ml-2 font-mono">{u.celexId}</span>}
                      </span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: MR_MIDNIGHT }}>{u.title}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: '#4A5568' }}>{u.summary}</p>
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-3">
              {result.controlsImpacted.length === 0
                ? <p className="text-sm text-center py-8" style={{ color: MR_GREEN }}>No published controls at risk.</p>
                : result.controlsImpacted.map((c, i) => (
                  <div key={i} className="bg-white rounded-xl p-4" style={{ border: '1px solid #FDE68A', background: '#FFFBEB' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: MR_AMBER + '20', color: MR_AMBER }}>{c.controlId}</span>
                      <Link href="/compliance-hub" className="text-xs ml-auto" style={{ color: MR_MIDNIGHT, textDecoration: 'none' }}>View in Hub →</Link>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: MR_MIDNIGHT }}>{c.title}</p>
                    <p className="text-xs mt-1" style={{ color: '#92400E' }}>{c.reason}</p>
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === 'policies' && (
            <div className="space-y-3">
              {result.policiesImpacted.length === 0
                ? <p className="text-sm text-center py-8" style={{ color: MR_GREEN }}>No policies flagged.</p>
                : result.policiesImpacted.map((p, i) => (
                  <div key={i} className="bg-white rounded-xl p-4" style={{ border: '1px solid #D0D7E3' }}>
                    <div className="flex items-center gap-2 mb-1"><SourceChip s={p.source} /><span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{p.documentId}</span></div>
                    <p className="text-sm font-semibold" style={{ color: MR_MIDNIGHT }}>{p.documentTitle}</p>
                    <p className="text-xs mt-1" style={{ color: '#4A5568' }}>{p.reason}</p>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ── Before / After Review Section ── */}
      {(result && (scanGaps.length > 0 || loadingGaps)) && (
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: MR_MIDNIGHT }}>Review &amp; Approve Changes</h2>
              <p className="text-xs mt-0.5" style={{ color: '#4A5568' }}>
                Click <strong>Generate Proposal</strong> on any gap to see the exact before/after for the control and every
                affected policy document. Review, then approve or reject.
              </p>
            </div>
            {!loadingGaps && scanGaps.length > 0 && (
              <span className="text-xs px-2 py-1 rounded flex-shrink-0" style={{ background: '#F4F6F9', border: '1px solid #D0D7E3', color: '#4A5568' }}>
                {scanGaps.length} gap{scanGaps.length !== 1 ? 's' : ''} from this scan
              </span>
            )}
          </div>

          {loadingGaps ? (
            <div className="flex items-center gap-2 py-4 text-sm" style={{ color: '#6B7280' }}><Spinner size={16} /> Loading gaps…</div>
          ) : (
            <div className="space-y-3">
              {scanGaps.map(gap => <GapReviewCard key={gap.id} gap={gap} />)}
            </div>
          )}
        </section>
      )}

      {/* ── Scan history ── */}
      <section>
        <h2 className="text-base font-semibold mb-3" style={{ color: MR_MIDNIGHT }}>Scan History</h2>
        {loadingHistory ? (
          <div className="flex items-center gap-2 py-6 text-sm" style={{ color: '#6B7280' }}><Spinner size={16} /> Loading…</div>
        ) : history.length === 0 ? (
          <div className="rounded-xl p-6 text-sm text-center" style={{ background: '#F9FAFB', border: '1px solid #D0D7E3', color: '#6B7280' }}>No scans yet. Run your first scan above.</div>
        ) : (
          <div className="space-y-2">
            {history.map(scan => (
              <div key={scan.id} className="bg-white rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap" style={{ border: '1px solid #D0D7E3' }}>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                  style={{ background: scan.status === 'COMPLETE' ? '#D1FAE5' : scan.status === 'FAILED' ? '#FEE2E2' : '#FEF3C7', color: scan.status === 'COMPLETE' ? MR_GREEN : scan.status === 'FAILED' ? MR_RED : MR_AMBER }}>
                  {scan.status}
                </span>
                <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{new Date(scan.scannedAt).toLocaleString('en-GB')}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                  style={{ background: scan.eurLexConnected ? '#F0FAF6' : '#FFFBEB', color: scan.eurLexConnected ? '#065F46' : '#92400E' }}>
                  {scan.eurLexConnected ? '● EUR-Lex Live' : '● AI Watch'}
                </span>
                <span className="text-xs" style={{ color: '#4A5568' }}>{scan.sourcesScanned} regs</span>
                <span className="text-xs" style={{ color: '#4A5568' }}>{(scan.updatesFound as RegUpdate[]).length} updates</span>
                <span className="text-xs font-semibold" style={{ color: scan.newGapsCreated > 0 ? MR_RED : '#6B7280' }}>{scan.newGapsCreated} new gaps</span>
                {scan.error && <span className="text-xs" style={{ color: MR_RED }}>{scan.error.slice(0, 80)}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Last scan overview (when no live result) ── */}
      {!result && !scanning && lastScan?.status === 'COMPLETE' && (
        <section>
          <h2 className="text-base font-semibold mb-3" style={{ color: MR_MIDNIGHT }}>Latest Scan Overview</h2>
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'white', border: '1px solid #D0D7E3' }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: MR_MIDNIGHT }}>{new Date(lastScan.scannedAt).toLocaleString('en-GB')}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ background: lastScan.eurLexConnected ? '#F0FAF6' : '#FFFBEB', color: lastScan.eurLexConnected ? '#065F46' : '#92400E' }}>
                {lastScan.eurLexConnected ? '● EUR-Lex Live' : '● AI Watch'}
              </span>
            </div>
            {lastScan.aiSummary && <p className="text-sm" style={{ color: '#4A5568' }}>{lastScan.aiSummary}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiTile label="Regs Scanned" value={lastScan.sourcesScanned} />
              <KpiTile label="Updates Found" value={(lastScan.updatesFound as RegUpdate[]).length} color={(lastScan.updatesFound as RegUpdate[]).length > 0 ? MR_MIDNIGHT : '#6B7280'} />
              <KpiTile label="Gaps Created" value={lastScan.newGapsCreated} color={lastScan.newGapsCreated > 0 ? MR_RED : MR_GREEN} />
              <KpiTile label="Controls at Risk" value={(lastScan.controlsImpacted as ControlImpact[]).length} color={(lastScan.controlsImpacted as ControlImpact[]).length > 0 ? MR_AMBER : '#6B7280'} />
            </div>
            <div className="flex items-center gap-4 pt-1">
              <Link href="/compliance-hub" className="text-sm font-semibold" style={{ color: MR_MIDNIGHT, textDecoration: 'none' }}>View all gaps in Compliance Hub →</Link>
              <Link href="/compliance-hub/regulatory-updates" className="text-sm font-semibold" style={{ color: MR_VIOLET, textDecoration: 'none' }}>Review regulatory versions →</Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
