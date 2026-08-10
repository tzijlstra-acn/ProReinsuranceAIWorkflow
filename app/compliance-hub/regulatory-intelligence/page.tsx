'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RegUpdate {
  source: string
  title: string
  date: string
  type: string
  celexId?: string
  summary: string
  fromEurLex: boolean
}

interface ControlImpact {
  controlId: string
  title: string
  requirementId: string | null
  reason: string
}

interface PolicyImpact {
  source: string
  documentId: string
  documentTitle: string
  reason: string
}

interface ScanReport {
  id: string
  scannedAt: string
  status: string
  eurLexConnected: boolean
  sourcesScanned: number
  updatesFound: RegUpdate[]
  newVersionsCreated: number
  newGapsCreated: number
  controlsImpacted: ControlImpact[]
  policiesImpacted: PolicyImpact[]
  aiSummary: string | null
  error: string | null
}

interface ScanResult {
  ok: boolean
  scanId: string
  scannedAt: string
  eurLexConnected: boolean
  sourcesScanned: number
  updatesFound: RegUpdate[]
  newVersionsCreated: number
  newGapsCreated: number
  controlsImpacted: ControlImpact[]
  policiesImpacted: PolicyImpact[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MR_MIDNIGHT = '#003781'
const MR_GREEN = '#0A7C59'
const MR_RED = '#E4002B'
const MR_AMBER = '#B45309'
const MR_VIOLET = '#7C3AED'

const SCAN_STEPS = [
  'Connecting to EUR-Lex CELLAR…',
  'Scanning DORA (32022R2554)…',
  'Scanning NIS2 (32022L2555)…',
  'Scanning GDPR (32016R0679)…',
  'Running AI delta analysis…',
  'Checking control impact…',
  'Storing findings…',
]

const UPDATE_TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  RTS:              { label: 'RTS',              color: '#003781', bg: '#EBF5FF' },
  ITS:              { label: 'ITS',              color: '#003781', bg: '#EBF5FF' },
  IMPLEMENTING_ACT: { label: 'Implementing Act', color: '#7C3AED', bg: '#F5F3FF' },
  DELEGATED_ACT:    { label: 'Delegated Act',    color: '#7C3AED', bg: '#F5F3FF' },
  AMENDMENT:        { label: 'Amendment',        color: '#B45309', bg: '#FEF3C7' },
  CORRIGENDUM:      { label: 'Corrigendum',      color: '#6B7280', bg: '#F3F4F6' },
  GUIDANCE:         { label: 'Guidance',         color: '#0A7C59', bg: '#F0FAF6' },
  OTHER:            { label: 'Other',            color: '#6B7280', bg: '#F3F4F6' },
}

const SOURCE_COLOR: Record<string, string> = {
  DORA: '#003781',
  NIS2: '#7C3AED',
  GDPR: '#0A7C59',
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="animate-spin" style={{ width: size, height: size }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function TypeBadge({ type }: { type: string }) {
  const s = UPDATE_TYPE_STYLE[type] ?? UPDATE_TYPE_STYLE.OTHER
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function SourceChip({ source }: { source: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: SOURCE_COLOR[source] ?? '#6B7280', color: 'white' }}
    >
      {source}
    </span>
  )
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

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/compliance-hub/regulatory-intelligence/scan')
      const json = await res.json()
      setHistory(json.reports ?? [])
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false)
    }
  }

  async function runScan() {
    setScanning(true)
    setStepIdx(0)
    setResult(null)
    setScanError(null)

    // Animate through steps while scan runs
    const stepTimer = setInterval(() => {
      setStepIdx(prev => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev))
    }, 3500)

    try {
      const res = await fetch('/api/compliance-hub/regulatory-intelligence/scan', {
        method: 'POST',
      })
      clearInterval(stepTimer)
      const json = await res.json()
      if (!res.ok || json.error) {
        setScanError(json.error ?? 'Scan failed')
      } else {
        setResult(json as ScanResult)
        setActiveTab('updates')
        await loadHistory()
      }
    } catch (err) {
      clearInterval(stepTimer)
      setScanError(String(err))
    } finally {
      setScanning(false)
      setStepIdx(SCAN_STEPS.length - 1)
    }
  }

  const lastScan = history[0]

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/compliance-hub"
              className="text-xs"
              style={{ color: '#6B7280', textDecoration: 'none' }}
            >
              Compliance Hub
            </Link>
            <span style={{ color: '#D1D5DB' }}>›</span>
            <span className="text-xs font-semibold" style={{ color: MR_MIDNIGHT }}>
              Regulatory Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: MR_MIDNIGHT }}>
            Regulatory Intelligence Scanner
          </h1>
          <p className="text-sm mt-1" style={{ color: '#4A5568' }}>
            Live EUR-Lex API + o3 AI analysis · Checks all controls &amp; policies · Identifies new gaps
          </p>
        </div>

        {/* Scan trigger */}
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-opacity"
          style={{
            background: scanning ? '#9CA3AF' : MR_VIOLET,
            color: 'white',
            border: 'none',
            cursor: scanning ? 'not-allowed' : 'pointer',
            opacity: scanning ? 0.8 : 1,
          }}
        >
          {scanning ? (
            <>
              <Spinner size={16} />
              Scanning…
            </>
          ) : (
            <>
              <span style={{ fontSize: 16 }}>⚡</span>
              Run Intelligence Scan
            </>
          )}
        </button>
      </div>

      {/* ── How it works callout ── */}
      <div
        className="rounded-xl p-4 text-sm"
        style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', color: '#4C1D95' }}
      >
        <strong>How it works:</strong> Each scan calls the EUR-Lex CELLAR SPARQL API to retrieve
        published implementing acts, delegated regulations, and RTS/ITS for DORA, NIS2, and GDPR.
        The o3 AI model then analyses these against all existing requirements, control changes, and
        internal policies — identifying real compliance gaps that are stored in the database.
        Results are not pre-populated: every gap is generated fresh by AI against live regulation data.
      </div>

      {/* ── Scanning progress ── */}
      {scanning && (
        <div
          className="rounded-xl p-5"
          style={{ background: 'white', border: '1px solid #D0D7E3' }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: MR_MIDNIGHT }}>
            Running scan — this may take 60–120 seconds while o3 analyses all regulations…
          </p>
          <div className="space-y-2.5">
            {SCAN_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex-shrink-0" style={{ width: 20, height: 20 }}>
                  {i < stepIdx ? (
                    <svg viewBox="0 0 20 20" fill={MR_GREEN} className="w-5 h-5">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : i === stepIdx ? (
                    <span style={{ color: MR_VIOLET }}><Spinner size={18} /></span>
                  ) : (
                    <div className="w-5 h-5 rounded-full" style={{ background: '#E5E7EB' }} />
                  )}
                </div>
                <span
                  className="text-sm"
                  style={{ color: i <= stepIdx ? MR_MIDNIGHT : '#9CA3AF', fontWeight: i === stepIdx ? 600 : 400 }}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {scanError && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: '#FEE2E2', color: MR_RED, border: '1px solid #FECACA' }}
        >
          <strong>Scan failed:</strong> {scanError}
        </div>
      )}

      {/* ── Scan results ── */}
      {result && (
        <div className="space-y-6">
          {/* Connection status + KPI row */}
          <div
            className="rounded-xl p-4 flex items-center gap-3 text-sm"
            style={{
              background: result.eurLexConnected ? '#F0FAF6' : '#FFFBEB',
              border: `1px solid ${result.eurLexConnected ? '#BBF7D0' : '#FDE68A'}`,
            }}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: result.eurLexConnected ? MR_GREEN : MR_AMBER }}
            />
            <span style={{ color: result.eurLexConnected ? '#065F46' : '#92400E' }}>
              {result.eurLexConnected
                ? 'EUR-Lex CELLAR: Connected — live API data used in analysis'
                : 'EUR-Lex CELLAR: Unreachable — o3 regulatory knowledge used (labeled as AI Watch)'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiTile label="Regulations Scanned" value={result.sourcesScanned} />
            <KpiTile
              label="Updates Found"
              value={result.updatesFound.length}
              color={result.updatesFound.length > 0 ? MR_MIDNIGHT : '#6B7280'}
              sub="Implementing acts, RTS/ITS, etc."
            />
            <KpiTile
              label="New Gaps Created"
              value={result.newGapsCreated}
              color={result.newGapsCreated > 0 ? MR_RED : MR_GREEN}
              sub="Stored in Compliance Hub"
            />
            <KpiTile
              label="Controls Impacted"
              value={result.controlsImpacted.length}
              color={result.controlsImpacted.length > 0 ? MR_AMBER : '#6B7280'}
              sub="Published controls at risk"
            />
          </div>

          {/* Tab bar */}
          <div style={{ borderBottom: '1px solid #D0D7E3' }}>
            <div className="flex gap-0">
              {(['updates', 'controls', 'policies'] as const).map(tab => {
                const counts = {
                  updates: result.updatesFound.length,
                  controls: result.controlsImpacted.length,
                  policies: result.policiesImpacted.length,
                }
                const labels = { updates: 'Regulatory Updates', controls: 'Controls at Risk', policies: 'Policies to Review' }
                const active = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors"
                    style={{
                      borderColor: active ? MR_VIOLET : 'transparent',
                      color: active ? MR_VIOLET : '#6B7280',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {labels[tab]}
                    <span
                      className="ml-1.5 inline-flex items-center justify-center text-xs font-bold rounded-full"
                      style={{
                        background: active ? MR_VIOLET : '#E5E7EB',
                        color: active ? 'white' : '#6B7280',
                        minWidth: 20,
                        height: 20,
                        padding: '0 5px',
                      }}
                    >
                      {counts[tab]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Updates tab */}
          {activeTab === 'updates' && (
            <div className="space-y-3">
              {result.updatesFound.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: '#6B7280' }}>
                  No regulatory updates found in this scan.
                </p>
              ) : (
                result.updatesFound.map((u, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-4"
                    style={{ border: '1px solid #D0D7E3' }}
                  >
                    <div className="flex items-start gap-3 flex-wrap">
                      <SourceChip source={u.source} />
                      <TypeBadge type={u.type} />
                      {!u.fromEurLex && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ background: '#FEF3C7', color: '#92400E' }}
                        >
                          AI Watch
                        </span>
                      )}
                      {u.fromEurLex && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ background: '#F0FAF6', color: '#065F46' }}
                        >
                          EUR-Lex
                        </span>
                      )}
                      <span className="text-xs ml-auto" style={{ color: '#9CA3AF' }}>
                        {u.date}
                        {u.celexId && <span className="ml-2 font-mono">{u.celexId}</span>}
                      </span>
                    </div>
                    <p className="text-sm font-semibold mt-2" style={{ color: MR_MIDNIGHT }}>{u.title}</p>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#4A5568' }}>{u.summary}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Controls tab */}
          {activeTab === 'controls' && (
            <div className="space-y-3">
              {result.controlsImpacted.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: MR_GREEN }}>
                  No published controls are at risk from the identified updates.
                </p>
              ) : (
                result.controlsImpacted.map((c, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-4"
                    style={{ border: '1px solid #FDE68A', background: '#FFFBEB' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold"
                        style={{ background: MR_AMBER + '20', color: MR_AMBER }}
                      >
                        {c.controlId}
                      </span>
                      <Link
                        href={`/compliance-hub`}
                        className="text-xs ml-auto"
                        style={{ color: MR_MIDNIGHT, textDecoration: 'none' }}
                      >
                        View in Hub →
                      </Link>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: MR_MIDNIGHT }}>{c.title}</p>
                    <p className="text-xs mt-1" style={{ color: '#92400E' }}>{c.reason}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Policies tab */}
          {activeTab === 'policies' && (
            <div className="space-y-3">
              {result.policiesImpacted.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: MR_GREEN }}>
                  No internal policies flagged for review.
                </p>
              ) : (
                result.policiesImpacted.map((p, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-4"
                    style={{ border: '1px solid #D0D7E3' }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <SourceChip source={p.source} />
                      <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{p.documentId}</span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: MR_MIDNIGHT }}>{p.documentTitle}</p>
                    <p className="text-xs mt-1" style={{ color: '#4A5568' }}>{p.reason}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Scan history ── */}
      <section>
        <h2 className="text-base font-semibold mb-3" style={{ color: MR_MIDNIGHT }}>
          Scan History
        </h2>
        {loadingHistory ? (
          <div className="flex items-center gap-2 py-6 text-sm" style={{ color: '#6B7280' }}>
            <Spinner size={16} /> Loading…
          </div>
        ) : history.length === 0 ? (
          <div
            className="rounded-xl p-6 text-sm text-center"
            style={{ background: '#F9FAFB', border: '1px solid #D0D7E3', color: '#6B7280' }}
          >
            No scans yet. Run your first scan above.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(scan => (
              <div
                key={scan.id}
                className="bg-white rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap"
                style={{ border: '1px solid #D0D7E3' }}
              >
                <div
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    background: scan.status === 'COMPLETE' ? '#D1FAE5' : scan.status === 'FAILED' ? '#FEE2E2' : '#FEF3C7',
                    color: scan.status === 'COMPLETE' ? MR_GREEN : scan.status === 'FAILED' ? MR_RED : MR_AMBER,
                  }}
                >
                  {scan.status}
                </div>
                <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>
                  {new Date(scan.scannedAt).toLocaleString('en-GB')}
                </span>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                  style={{ background: scan.eurLexConnected ? '#F0FAF6' : '#FFFBEB', color: scan.eurLexConnected ? '#065F46' : '#92400E' }}
                >
                  {scan.eurLexConnected ? '● EUR-Lex Live' : '● AI Watch'}
                </span>
                <span className="text-xs" style={{ color: '#4A5568' }}>
                  {scan.sourcesScanned} regs
                </span>
                <span className="text-xs" style={{ color: '#4A5568' }}>
                  {(scan.updatesFound as RegUpdate[]).length} updates
                </span>
                <span className="text-xs font-semibold" style={{ color: scan.newGapsCreated > 0 ? MR_RED : '#6B7280' }}>
                  {scan.newGapsCreated} new gaps
                </span>
                {scan.error && (
                  <span className="text-xs" style={{ color: MR_RED }}>
                    {scan.error.slice(0, 80)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Last scan overview (if no live result) ── */}
      {!result && !scanning && lastScan && lastScan.status === 'COMPLETE' && (
        <section>
          <h2 className="text-base font-semibold mb-3" style={{ color: MR_MIDNIGHT }}>
            Latest Scan Overview
          </h2>
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ background: 'white', border: '1px solid #D0D7E3' }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: MR_MIDNIGHT }}>
                {new Date(lastScan.scannedAt).toLocaleString('en-GB')}
              </span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ background: lastScan.eurLexConnected ? '#F0FAF6' : '#FFFBEB', color: lastScan.eurLexConnected ? '#065F46' : '#92400E' }}
              >
                {lastScan.eurLexConnected ? '● EUR-Lex Live' : '● AI Watch'}
              </span>
            </div>
            {lastScan.aiSummary && (
              <p className="text-sm" style={{ color: '#4A5568' }}>{lastScan.aiSummary}</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiTile label="Regs Scanned" value={lastScan.sourcesScanned} />
              <KpiTile
                label="Updates Found"
                value={(lastScan.updatesFound as RegUpdate[]).length}
                color={(lastScan.updatesFound as RegUpdate[]).length > 0 ? MR_MIDNIGHT : '#6B7280'}
              />
              <KpiTile
                label="Gaps Created"
                value={lastScan.newGapsCreated}
                color={lastScan.newGapsCreated > 0 ? MR_RED : MR_GREEN}
              />
              <KpiTile
                label="Controls at Risk"
                value={(lastScan.controlsImpacted as ControlImpact[]).length}
                color={(lastScan.controlsImpacted as ControlImpact[]).length > 0 ? MR_AMBER : '#6B7280'}
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Link
                href="/compliance-hub"
                className="text-sm font-semibold"
                style={{ color: MR_MIDNIGHT, textDecoration: 'none' }}
              >
                View all gaps in Compliance Hub →
              </Link>
              <Link
                href="/compliance-hub/regulatory-updates"
                className="text-sm font-semibold"
                style={{ color: MR_VIOLET, textDecoration: 'none' }}
              >
                Review regulatory versions →
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
