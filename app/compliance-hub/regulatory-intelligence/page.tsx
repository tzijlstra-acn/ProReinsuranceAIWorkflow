'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Scan result types
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
interface ApiGap {
  id: string; title: string; severity: string; gapType: string; status: string
  detectedAt: string; description: string; aiAnalysis: string | null
  requirement: { id: string; articleRef: string; title: string } | null
  source: { id: string; shortCode: string; name: string } | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Linked proposal types (from propose-all)
// ─────────────────────────────────────────────────────────────────────────────

interface RegTrigger {
  articleRef: string
  clauseText: string
  changeNature: string
  complianceDeadline: string | null
}
interface LinkedControl {
  isNew: boolean
  currentState: { title: string; description: string; steps: string[]; acceptanceCriteria: string[] } | null
  title: string; description: string; changeType: string
  steps: string[]; acceptanceCriteria: string[]; estimatedEffort: string
  triggerRationale: string
}
interface LinkedDoc {
  documentId: string; documentTitle: string; isNew: boolean; section: string
  currentContent: string; proposedContent: string
  changeSummary: string; addedClauses: string[]; triggerRationale: string
}
interface LinkedGapProposal {
  controlChangeId: string
  trigger: RegTrigger
  control: LinkedControl
  documents: LinkedDoc[]
}

interface GapEntry {
  gap: ScanGap
  proposal: LinkedGapProposal | null
  state: 'pending' | 'analysing' | 'ready' | 'approved' | 'rejected'
  approver: string
  busy: boolean
  error: string | null
}

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
// Linked proposal review card
// ─────────────────────────────────────────────────────────────────────────────

function LinkedDocSection({ doc, idx }: { doc: LinkedDoc; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const clip = (text: string) => !expanded && text.length > 500 ? text.slice(0, 500) + '…' : text
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${doc.isNew ? '#BBF7D0' : '#D0D7E3'}` }}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-start justify-between gap-3 flex-wrap" style={{ background: doc.isNew ? '#F0FAF6' : '#F9FAFB', borderBottom: `1px solid ${doc.isNew ? '#BBF7D0' : '#D0D7E3'}` }}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold" style={{ color: '#6B7280' }}>③{idx > 0 ? `+${idx}` : ''}</span>
            <span className="text-xs font-semibold" style={{ color: MR_MIDNIGHT }}>📄 {doc.documentTitle}</span>
            {doc.isNew && (
              <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: '#D1FAE5', color: MR_GREEN }}>NEW DOCUMENT</span>
            )}
            {!doc.isNew && doc.section && (
              <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: '#EBF5FF', color: MR_MIDNIGHT }}>{doc.section}</span>
            )}
          </div>
          {doc.triggerRationale && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280' }}>
              <span style={{ color: MR_AMBER, fontWeight: 700 }}>Why: </span>{doc.triggerRationale}
            </p>
          )}
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-xs flex-shrink-0" style={{ color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
          {expanded ? 'Collapse' : 'Show full diff'}
        </button>
      </div>
      {/* changeSummary strip */}
      {doc.changeSummary && (
        <div className="px-4 py-2 text-xs" style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A', color: '#92400E' }}>
          <strong>{doc.isNew ? 'New document:' : 'What changes:'}</strong> {doc.changeSummary}
        </div>
      )}
      {/* Before / After */}
      <div className="grid grid-cols-2 divide-x" style={{ divideColor: '#D0D7E3' } as React.CSSProperties}>
        <div className="p-3">
          <p className="text-xs font-bold mb-2" style={{ color: doc.isNew ? '#6B7280' : MR_RED }}>
            {doc.isNew ? 'BEFORE — no document' : 'BEFORE — current content'}
          </p>
          {doc.isNew || !doc.currentContent ? (
            <p className="text-xs italic" style={{ color: '#9CA3AF' }}>No existing document — this will create a new policy document.</p>
          ) : (
            <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: '#374151', maxHeight: expanded ? 'none' : 200, overflow: 'hidden' }}>
              {clip(doc.currentContent)}
            </pre>
          )}
        </div>
        <div className="p-3" style={{ background: '#F0FAF6' }}>
          <p className="text-xs font-bold mb-2" style={{ color: MR_GREEN }}>
            {doc.isNew ? 'AFTER — proposed new document' : 'AFTER — proposed changes'}
          </p>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: '#374151', maxHeight: expanded ? 'none' : 200, overflow: 'hidden' }}>
            {clip(doc.proposedContent)}
          </pre>
        </div>
      </div>
      {/* Added clauses */}
      {doc.addedClauses.length > 0 && (
        <div className="px-4 py-2 space-y-0.5" style={{ background: '#F0FAF6', borderTop: '1px solid #BBF7D0' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: MR_GREEN }}>{doc.isNew ? 'Clauses in new document:' : 'Added / changed clauses:'}</p>
          {doc.addedClauses.map((c, i) => (
            <div key={i} className="flex gap-1.5 text-xs" style={{ color: '#065F46' }}>
              <span className="flex-shrink-0 font-bold">+</span><span>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LinkedProposalCard({
  entry,
  onApproverChange,
  onApprove,
  onReject,
}: {
  entry: GapEntry
  onApproverChange: (v: string) => void
  onApprove: () => void
  onReject: () => void
}) {
  const { gap, proposal, state, approver, busy, error } = entry

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
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #D0D7E3' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <SourceChip s={gap.sourceShortCode} />
          <SevBadge v={gap.severity} />
          <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: '#F3F4F6', color: '#374151' }}>{gap.requirementRef}</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#6B7280' }}>{gap.gapType}</span>
          {state === 'analysing' && (
            <span className="flex items-center gap-1 text-xs" style={{ color: MR_VIOLET }}>
              <Spinner size={12} /> Analysing with o3…
            </span>
          )}
        </div>
        <h3 className="text-sm font-bold mt-2" style={{ color: MR_MIDNIGHT }}>{gap.title}</h3>
        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{gap.requirementTitle}</p>
        {gap.aiAnalysis && (
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#374151' }}>
            <span className="font-semibold" style={{ color: MR_VIOLET }}>AI: </span>{gap.aiAnalysis}
          </p>
        )}
        {error && <p className="text-xs mt-2" style={{ color: MR_RED }}>Error: {error}</p>}
      </div>

      {/* Proposal blocks — only when ready */}
      {state === 'ready' && proposal && (
        <div className="p-5 space-y-4">

          {/* ① Regulation trigger */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #FDE68A' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: '#FEF3C7', borderBottom: '1px solid #FDE68A' }}>
              <span className="text-xs font-bold" style={{ color: MR_AMBER }}>①</span>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: MR_AMBER }}>Regulation Trigger</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: '#FDE68A', color: '#78350F' }}>{proposal.trigger.articleRef}</span>
              {proposal.trigger.changeNature && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'white', color: MR_AMBER, border: '1px solid #FDE68A' }}>{proposal.trigger.changeNature}</span>
              )}
            </div>
            <div className="px-4 py-3" style={{ background: '#FFFBEB' }}>
              <blockquote className="text-sm leading-relaxed italic border-l-2 pl-3 my-0" style={{ borderColor: MR_AMBER, color: '#78350F' }}>
                &ldquo;{proposal.trigger.clauseText}&rdquo;
              </blockquote>
              {proposal.trigger.complianceDeadline && (
                <p className="text-xs mt-2 font-semibold" style={{ color: MR_RED }}>
                  Compliance deadline: {proposal.trigger.complianceDeadline}
                </p>
              )}
            </div>
          </div>

          {/* ② Control change */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #BFDBFE' }}>
            <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" style={{ background: '#EBF5FF', borderBottom: '1px solid #BFDBFE' }}>
              <span className="text-xs font-bold" style={{ color: MR_MIDNIGHT }}>②</span>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: MR_MIDNIGHT }}>Control Change</span>
              <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: proposal.control.isNew ? '#D1FAE5' : '#FEF3C7', color: proposal.control.isNew ? MR_GREEN : MR_AMBER, border: `1px solid ${proposal.control.isNew ? '#BBF7D0' : '#FDE68A'}` }}>
                {proposal.control.isNew ? 'NEW CONTROL' : 'AMEND EXISTING'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'white', color: '#6B7280', border: '1px solid #BFDBFE' }}>
                {proposal.control.changeType.replace(/_/g, ' ')}
              </span>
            </div>
            {proposal.control.triggerRationale && (
              <div className="px-4 py-2 text-xs" style={{ background: '#F0F7FF', borderBottom: '1px solid #BFDBFE' }}>
                <span style={{ color: MR_AMBER, fontWeight: 700 }}>Because of ①: </span>
                <span style={{ color: '#374151' }}>{proposal.control.triggerRationale}</span>
              </div>
            )}
            <div className="grid grid-cols-2 divide-x" style={{ divideColor: '#BFDBFE' } as React.CSSProperties}>
              {/* BEFORE */}
              <div className="p-4">
                <p className="text-xs font-bold mb-2" style={{ color: proposal.control.isNew ? '#6B7280' : MR_RED }}>
                  {proposal.control.isNew ? 'BEFORE — no control' : 'BEFORE — current control'}
                </p>
                {proposal.control.currentState ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold" style={{ color: MR_MIDNIGHT }}>{proposal.control.currentState.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>{proposal.control.currentState.description}</p>
                    {proposal.control.currentState.steps.length > 0 && (
                      <>
                        <p className="text-xs font-semibold mt-1" style={{ color: '#6B7280' }}>Current steps:</p>
                        <ol className="space-y-0.5 list-decimal list-inside">
                          {proposal.control.currentState.steps.slice(0, 5).map((s, i) => (
                            <li key={i} className="text-xs" style={{ color: '#4A5568' }}>{s}</li>
                          ))}
                        </ol>
                      </>
                    )}
                    {proposal.control.currentState.acceptanceCriteria.length > 0 && (
                      <>
                        <p className="text-xs font-semibold mt-1" style={{ color: '#6B7280' }}>Current criteria:</p>
                        {proposal.control.currentState.acceptanceCriteria.slice(0, 4).map((c, i) => (
                          <div key={i} className="flex gap-1 text-xs" style={{ color: '#4A5568' }}>
                            <span className="flex-shrink-0">•</span><span>{c}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs italic" style={{ color: '#9CA3AF' }}>No control currently exists for this requirement.</p>
                )}
              </div>
              {/* AFTER */}
              <div className="p-4" style={{ background: '#F7FBFF' }}>
                <p className="text-xs font-bold mb-2" style={{ color: MR_GREEN }}>
                  {proposal.control.isNew ? 'AFTER — new control' : 'AFTER — amended control'}
                </p>
                <p className="text-sm font-semibold mb-1" style={{ color: MR_MIDNIGHT }}>{proposal.control.title}</p>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#374151' }}>{proposal.control.description}</p>
                {proposal.control.steps.length > 0 && (
                  <>
                    <p className="text-xs font-semibold mb-1" style={{ color: MR_MIDNIGHT }}>
                      {proposal.control.isNew ? 'Implementation steps:' : 'Updated steps (full set):'}
                    </p>
                    <ol className="space-y-1 list-decimal list-inside mb-2">
                      {proposal.control.steps.slice(0, 6).map((step, i) => (
                        <li key={i} className="text-xs leading-relaxed" style={{ color: '#374151' }}>{step}</li>
                      ))}
                    </ol>
                  </>
                )}
                {proposal.control.estimatedEffort && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>Effort: <strong>{proposal.control.estimatedEffort}</strong></p>
                )}
              </div>
            </div>
            {proposal.control.acceptanceCriteria.length > 0 && (
              <div className="px-4 py-3 space-y-1" style={{ background: '#F0FAF6', borderTop: '1px solid #BBF7D0' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: MR_GREEN }}>
                  {proposal.control.isNew ? 'Acceptance criteria:' : 'Updated acceptance criteria (full set):'}
                </p>
                {proposal.control.acceptanceCriteria.map((c, i) => (
                  <div key={i} className="flex gap-1.5 text-xs" style={{ color: '#065F46' }}>
                    <span className="flex-shrink-0">✓</span><span>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ③ Document changes */}
          {proposal.documents.length > 0 ? (
            <div className="space-y-3">
              {proposal.documents.map((doc, i) => (
                <LinkedDocSection key={doc.documentId} doc={doc} idx={i} />
              ))}
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
              onChange={e => onApproverChange(e.target.value)}
              className="text-sm px-3 py-1.5 rounded flex-1 min-w-40"
              style={{ border: '1px solid #D0D7E3', background: 'white', color: MR_MIDNIGHT, outline: 'none' }}
            />
            <button
              onClick={onReject}
              disabled={busy}
              className="text-sm font-semibold px-4 py-1.5 rounded"
              style={{ background: 'white', color: MR_RED, border: `1px solid ${MR_RED}`, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              Reject
            </button>
            <button
              onClick={onApprove}
              disabled={!approver.trim() || busy}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded"
              style={{
                background: !approver.trim() || busy ? '#9CA3AF' : MR_GREEN,
                color: 'white', border: 'none',
                cursor: !approver.trim() || busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? <><Spinner size={14} /> Applying…</> : <>✓ Approve &amp; Apply All</>}
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

  // Impact analysis phase
  const [analysisPhase, setAnalysisPhase] = useState<'none' | 'loading' | 'running' | 'done'>('none')
  const [analysisProgress, setAnalysisProgress] = useState('')
  const [gapEntries, setGapEntries] = useState<GapEntry[]>([])

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

  async function runScan() {
    setScanning(true)
    setStepIdx(0)
    setResult(null)
    setScanError(null)
    setAnalysisPhase('none')
    setGapEntries([])

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
        await loadHistory()
      }
    } catch (err) {
      clearInterval(stepTimer)
      setScanError(String(err))
    } finally {
      setScanning(false)
    }
  }

  async function runImpactAnalysis() {
    setAnalysisPhase('loading')
    setAnalysisProgress('Loading gaps from this scan…')

    try {
      const res = await fetch('/api/compliance-hub/gaps')
      const allGaps = await res.json() as ApiGap[]
      const recent = allGaps
        .filter(g => Date.now() - new Date(g.detectedAt).getTime() < 10 * 60 * 1000)
        .map(g => ({
          id: g.id, title: g.title, severity: g.severity, gapType: g.gapType, status: g.status,
          detectedAt: g.detectedAt, description: g.description, aiAnalysis: g.aiAnalysis,
          sourceShortCode: g.source?.shortCode ?? '',
          requirementRef: g.requirement?.articleRef ?? '',
          requirementTitle: g.requirement?.title ?? '',
        }))

      if (recent.length === 0) {
        setAnalysisPhase('done')
        setAnalysisProgress('No recent gaps found.')
        return
      }

      const initialEntries: GapEntry[] = recent.map(gap => ({
        gap, proposal: null, state: 'pending', approver: '', busy: false, error: null,
      }))
      setGapEntries(initialEntries)
      setAnalysisPhase('running')

      for (let i = 0; i < initialEntries.length; i++) {
        const entry = initialEntries[i]
        setAnalysisProgress(`o3 is analysing gap ${i + 1} of ${initialEntries.length}: "${entry.gap.title}"…`)

        setGapEntries(prev => prev.map((e, idx) => idx === i ? { ...e, state: 'analysing' } : e))

        try {
          const pRes = await fetch(`/api/compliance-hub/gaps/${entry.gap.id}/propose-all`, { method: 'POST' })
          const pJson = await pRes.json() as LinkedGapProposal & { error?: string }
          if (!pRes.ok || pJson.error) throw new Error(pJson.error ?? 'Proposal failed')
          setGapEntries(prev => prev.map((e, idx) => idx === i ? { ...e, state: 'ready', proposal: pJson } : e))
        } catch (err) {
          setGapEntries(prev => prev.map((e, idx) => idx === i ? { ...e, state: 'ready', error: String(err) } : e))
        }
      }
    } catch (err) {
      setScanError(String(err))
    } finally {
      setAnalysisPhase('done')
      setAnalysisProgress('')
    }
  }

  function setEntryApprover(idx: number, v: string) {
    setGapEntries(prev => prev.map((e, i) => i === idx ? { ...e, approver: v } : e))
  }

  async function approveEntry(idx: number) {
    const entry = gapEntries[idx]
    setGapEntries(prev => prev.map((e, i) => i === idx ? { ...e, busy: true, error: null } : e))
    try {
      const res = await fetch(`/api/compliance-hub/gaps/${entry.gap.id}/approve-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: entry.approver.trim(), action: 'approve' }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? 'Approval failed')
      setGapEntries(prev => prev.map((e, i) => i === idx ? { ...e, state: 'approved', busy: false } : e))
    } catch (err) {
      setGapEntries(prev => prev.map((e, i) => i === idx ? { ...e, error: String(err), busy: false } : e))
    }
  }

  async function rejectEntry(idx: number) {
    const entry = gapEntries[idx]
    setGapEntries(prev => prev.map((e, i) => i === idx ? { ...e, busy: true, error: null } : e))
    try {
      const res = await fetch(`/api/compliance-hub/gaps/${entry.gap.id}/approve-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? 'Reject failed')
      setGapEntries(prev => prev.map((e, i) => i === idx ? { ...e, state: 'rejected', busy: false } : e))
    } catch (err) {
      setGapEntries(prev => prev.map((e, i) => i === idx ? { ...e, error: String(err), busy: false } : e))
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
            Live EUR-Lex API + o3 · Two phases: scan finds gaps, impact analysis shows exactly what to change and why
          </p>
        </div>
        <button
          onClick={runScan} disabled={scanning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm"
          style={{ background: scanning ? '#9CA3AF' : MR_VIOLET, color: 'white', border: 'none', cursor: scanning ? 'not-allowed' : 'pointer' }}
        >
          {scanning ? <><Spinner size={16} />Scanning…</> : <>⚡ Run Regulatory Scan</>}
        </button>
      </div>

      {/* ── Explainer ── */}
      <div className="rounded-xl p-4" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
        <p className="text-sm" style={{ color: '#4C1D95' }}>
          <strong>Two-phase process:</strong>{' '}
          <span className="font-semibold" style={{ color: MR_AMBER }}>Phase 1 — Regulatory Scan</span> queries EUR-Lex CELLAR + o3 to identify new regulatory developments and create compliance gaps.{' '}
          <span className="font-semibold" style={{ color: MR_MIDNIGHT }}>Phase 2 — Impact Analysis</span> runs a separate o3 analysis per gap, producing an explicit causal chain: the regulation trigger → the control change required → which policy section changes and why. Review and approve each linked proposal before it is applied.
        </p>
      </div>

      {/* ── Scan progress ── */}
      {scanning && (
        <div className="rounded-xl p-5" style={{ background: 'white', border: '1px solid #D0D7E3' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: MR_MIDNIGHT }}>Phase 1 running — o3 is scanning all regulations…</p>
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

      {/* ── Scan error ── */}
      {scanError && (
        <div className="rounded-xl p-4 text-sm" style={{ background: '#FEE2E2', color: MR_RED, border: '1px solid #FECACA' }}>
          <strong>Error:</strong> {scanError}
        </div>
      )}

      {/* ── Phase 1 results ── */}
      {result && (
        <div className="space-y-6">
          {/* EUR-Lex connection status */}
          <div className="rounded-xl p-4 flex items-center gap-3 text-sm"
            style={{ background: result.eurLexConnected ? '#F0FAF6' : '#FFFBEB', border: `1px solid ${result.eurLexConnected ? '#BBF7D0' : '#FDE68A'}` }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: result.eurLexConnected ? MR_GREEN : MR_AMBER }} />
            <span style={{ color: result.eurLexConnected ? '#065F46' : '#92400E' }}>
              {result.eurLexConnected
                ? 'EUR-Lex CELLAR: Connected — live API data included in analysis'
                : 'EUR-Lex CELLAR: Unreachable — o3 regulatory knowledge used (labeled AI Watch)'}
            </span>
          </div>

          {/* Phase 1 KPI row */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#6B7280' }}>Phase 1 Results — Regulatory Scan</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiTile label="Regulations Scanned" value={result.sourcesScanned} />
              <KpiTile label="Updates Found" value={result.updatesFound.length} color={result.updatesFound.length > 0 ? MR_MIDNIGHT : '#6B7280'} sub="Acts, RTS/ITS, guidance" />
              <KpiTile label="New Gaps" value={result.newGapsCreated} color={result.newGapsCreated > 0 ? MR_RED : MR_GREEN} sub="Ready for impact analysis" />
              <KpiTile label="Controls at Risk" value={result.controlsImpacted.length} color={result.controlsImpacted.length > 0 ? MR_AMBER : '#6B7280'} sub="Published controls" />
            </div>
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

      {/* ── Phase 2: Impact Analysis ── */}
      {result && result.newGapsCreated > 0 && (
        <section>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #D0D7E3' }}>
            {/* Phase 2 header */}
            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap" style={{ background: analysisPhase === 'done' ? '#F0FAF6' : '#F9FAFB', borderBottom: analysisPhase !== 'none' ? '1px solid #D0D7E3' : 'none' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ background: MR_MIDNIGHT, color: 'white' }}>Phase 2</span>
                  <h2 className="text-base font-semibold" style={{ color: MR_MIDNIGHT }}>Impact Analysis</h2>
                  {analysisPhase === 'done' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={{ background: '#D1FAE5', color: MR_GREEN }}>Complete</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: '#4A5568' }}>
                  {analysisPhase === 'none'
                    ? `${result.newGapsCreated} gap${result.newGapsCreated !== 1 ? 's' : ''} found. Run impact analysis to see the exact regulation trigger, control change, and policy updates — all explicitly linked — before you approve.`
                    : analysisPhase === 'loading'
                      ? 'Loading gaps…'
                      : analysisPhase === 'running'
                        ? analysisProgress
                        : `Analysis complete — ${gapEntries.length} gap${gapEntries.length !== 1 ? 's' : ''} ready for review.`
                  }
                </p>
              </div>
              {analysisPhase === 'none' && (
                <button
                  onClick={runImpactAnalysis}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm flex-shrink-0"
                  style={{ background: MR_MIDNIGHT, color: 'white', border: 'none', cursor: 'pointer' }}
                >
                  Run Impact Analysis →
                </button>
              )}
              {(analysisPhase === 'loading' || analysisPhase === 'running') && (
                <span className="flex items-center gap-2 text-sm flex-shrink-0" style={{ color: MR_VIOLET }}>
                  <Spinner size={16} /> Analysing with o3…
                </span>
              )}
            </div>

            {/* Progress list while running */}
            {analysisPhase === 'running' && gapEntries.length > 0 && (
              <div className="px-5 py-4 space-y-2" style={{ background: 'white' }}>
                {gapEntries.map((e, i) => (
                  <div key={e.gap.id} className="flex items-center gap-3">
                    <div className="w-4 h-4 flex-shrink-0">
                      {e.state === 'ready' || e.state === 'approved' || e.state === 'rejected'
                        ? <svg viewBox="0 0 20 20" fill={MR_GREEN} className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        : e.state === 'analysing'
                          ? <span style={{ color: MR_VIOLET }}><Spinner size={16} /></span>
                          : <div className="w-4 h-4 rounded-full" style={{ background: '#E5E7EB' }} />
                      }
                    </div>
                    <span className="text-xs" style={{ color: e.state === 'pending' ? '#9CA3AF' : MR_MIDNIGHT, fontWeight: e.state === 'analysing' ? 600 : 400 }}>
                      Gap {i + 1}: {e.gap.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Proposal cards */}
          {(analysisPhase === 'running' || analysisPhase === 'done') && gapEntries.length > 0 && (
            <div className="space-y-4 mt-4">
              {gapEntries.map((entry, idx) => (
                <LinkedProposalCard
                  key={entry.gap.id}
                  entry={entry}
                  onApproverChange={v => setEntryApprover(idx, v)}
                  onApprove={() => approveEntry(idx)}
                  onReject={() => rejectEntry(idx)}
                />
              ))}
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
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
