'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EvidencePackage {
  id: string
  status: string
  assembledAt: string | null
  approvedAt: string | null
  approvedBy: string | null
  verificationResultIds: string[]
  product: { id: string; name: string } | null
  requirement: { id: string; articleRef: string; title: string; obligationType: string } | null
  source: { id: string; shortCode: string; name: string } | null
}

interface LogbookEntry {
  id: string
  type: 'STATUS_CHANGE' | 'CONTROL_CHANGE' | 'GAP_DETECTED' | 'GAP_RESOLVED' | 'EVIDENCE_ASSEMBLED' | 'VERIFICATION'
  timestamp: string
  title: string
  detail: string
  actor: string | null
  productName: string | null
  regulation: string | null
  articleRef: string | null
  severity?: string
  status?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (d > 365) return `${Math.floor(d / 365)}y ago`
  if (d > 30) return `${Math.floor(d / 30)}mo ago`
  if (d > 1) return `${d}d ago`
  if (h > 1) return `${h}h ago`
  return 'Today'
}

// ── Status / event config ──────────────────────────────────────────────────────

const EP_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  COMPLETE:   { label: 'Complete',   color: '#0A7C59', bg: '#F0FAF6', border: 'rgba(10,124,89,0.25)' },
  APPROVED:   { label: 'Approved',   color: '#0A7C59', bg: '#F0FAF6', border: 'rgba(10,124,89,0.25)' },
  ASSEMBLING: { label: 'Assembling', color: '#B45309', bg: '#FFFBEB', border: 'rgba(180,83,9,0.25)' },
  REJECTED:   { label: 'Rejected',   color: '#E4002B', bg: '#FFF0F3', border: 'rgba(228,0,43,0.25)' },
}

const EVENT_CONFIG: Record<LogbookEntry['type'], { icon: string; color: string; bg: string }> = {
  STATUS_CHANGE:     { icon: '⇄', color: '#003781', bg: '#EBF5FF' },
  CONTROL_CHANGE:    { icon: '⚙', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  GAP_DETECTED:      { icon: '⚠', color: '#B45309', bg: '#FFFBEB' },
  GAP_RESOLVED:      { icon: '✓', color: '#0A7C59', bg: '#F0FAF6' },
  EVIDENCE_ASSEMBLED:{ icon: '🗂', color: '#003781', bg: '#EBF5FF' },
  VERIFICATION:      { icon: '✔', color: '#0A7C59', bg: '#F0FAF6' },
}

const STATUS_COLOR: Record<string, string> = {
  COMPLIANT:    '#0A7C59',
  NON_COMPLIANT:'#E4002B',
  OPEN:         '#B45309',
  RESOLVED:     '#0A7C59',
  PASSED:       '#0A7C59',
  FAILED:       '#E4002B',
  PUBLISHED:    '#003781',
  APPROVED:     '#0A7C59',
}

const LOG_FILTERS = ['All', 'Status changes', 'Gaps', 'Control changes', 'Evidence', 'Verification'] as const
type LogFilter = typeof LOG_FILTERS[number]

function matchesFilter(e: LogbookEntry, f: LogFilter): boolean {
  if (f === 'All') return true
  if (f === 'Status changes') return e.type === 'STATUS_CHANGE'
  if (f === 'Gaps') return e.type === 'GAP_DETECTED' || e.type === 'GAP_RESOLVED'
  if (f === 'Control changes') return e.type === 'CONTROL_CHANGE'
  if (f === 'Evidence') return e.type === 'EVIDENCE_ASSEMBLED'
  if (f === 'Verification') return e.type === 'VERIFICATION'
  return true
}

const SUGGESTED = [
  'Which products are currently non-compliant?',
  'What evidence do we have for DORA Art. 12?',
  'Are there any open gaps that need attention?',
  'Which control changes were published recently?',
  'Which products have complete evidence packages?',
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        color: active ? '#003781' : '#4A5568',
        borderBottom: active ? '2px solid #003781' : '2px solid transparent',
        marginBottom: -1,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function Badge({ text, color, bg, border }: { text: string; color: string; bg: string; border?: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color, background: bg,
      border: `1px solid ${border ?? 'transparent'}`,
      borderRadius: 4, padding: '2px 7px',
    }}>{text}</span>
  )
}

// ── Evidence Packages Tab ──────────────────────────────────────────────────────

function EvidenceTab({ packages }: { packages: EvidencePackage[] }) {
  if (packages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', color: '#9AA3AF' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🗂</div>
        <p style={{ fontSize: 15, fontWeight: 600 }}>No evidence packages yet</p>
        <p style={{ fontSize: 13, marginTop: 6 }}>Evidence packages appear here once verification criteria are met.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16, padding: 24 }}>
      {packages.map(ep => {
        const s = EP_STATUS[ep.status] ?? EP_STATUS.ASSEMBLING
        return (
          <div key={ep.id} style={{
            background: '#fff',
            border: `1px solid ${s.border}`,
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 1px 4px rgba(0,56,129,0.06)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                {ep.source && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#003781',
                    background: 'rgba(0,55,129,0.08)', borderRadius: 4, padding: '2px 7px',
                    marginBottom: 6, display: 'inline-block',
                  }}>{ep.source.shortCode}</span>
                )}
                {ep.requirement && (
                  <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700, color: '#1A1A2E', lineHeight: 1.4 }}>
                    {ep.requirement.articleRef}
                  </p>
                )}
                {ep.requirement && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4A5568' }}>{ep.requirement.title}</p>
                )}
              </div>
              <Badge text={s.label} color={s.color} bg={s.bg} border={s.border} />
            </div>

            {ep.product && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9AA3AF' }}>Product</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{ep.product.name}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#4A5568' }}>
              <div>
                <span style={{ color: '#9AA3AF', display: 'block', fontSize: 11, marginBottom: 2 }}>Verifications</span>
                <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{ep.verificationResultIds.length}</span>
              </div>
              {ep.approvedBy && (
                <div>
                  <span style={{ color: '#9AA3AF', display: 'block', fontSize: 11, marginBottom: 2 }}>Approved by</span>
                  <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{ep.approvedBy}</span>
                </div>
              )}
              {ep.approvedAt && (
                <div>
                  <span style={{ color: '#9AA3AF', display: 'block', fontSize: 11, marginBottom: 2 }}>Date</span>
                  <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{fmtDate(ep.approvedAt)}</span>
                </div>
              )}
            </div>

            {ep.product && (
              <div style={{ borderTop: '1px solid #F0F4F8', paddingTop: 10 }}>
                <Link
                  href={`/ddcr/products/${ep.product.id}`}
                  style={{ fontSize: 12, fontWeight: 600, color: '#003781', textDecoration: 'none' }}
                >
                  View in DDCR →
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Logbook Tab ────────────────────────────────────────────────────────────────

function LogbookTab({ entries, loading }: { entries: LogbookEntry[]; loading: boolean }) {
  const [filter, setFilter] = useState<LogFilter>('All')
  const [search, setSearch] = useState('')

  const shown = entries
    .filter(e => matchesFilter(e, filter))
    .filter(e => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        e.title.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        (e.productName?.toLowerCase().includes(q) ?? false) ||
        (e.regulation?.toLowerCase().includes(q) ?? false)
      )
    })

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#9AA3AF' }}>Loading logbook…</div>
    )
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {LOG_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', fontSize: 12, fontWeight: 600,
              borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${f === filter ? '#003781' : '#D0D7E3'}`,
              background: f === filter ? '#003781' : '#fff',
              color: f === filter ? '#fff' : '#4A5568',
              transition: 'all 0.15s',
            }}>{f}</button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            marginLeft: 'auto', padding: '5px 12px', fontSize: 13,
            border: '1px solid #D0D7E3', borderRadius: 6, outline: 'none',
            background: '#fff', color: '#1A1A2E', width: 180,
          }}
        />
        <span style={{ fontSize: 12, color: '#9AA3AF', whiteSpace: 'nowrap' }}>
          {shown.length} {shown.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9AA3AF' }}>
          <p style={{ fontSize: 14 }}>No entries match this filter.</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 19, top: 0, bottom: 0,
            width: 2, background: '#E8EDF4', borderRadius: 1,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {shown.map((entry, idx) => {
              const cfg = EVENT_CONFIG[entry.type]
              const statusCol = entry.status ? STATUS_COLOR[entry.status] : undefined
              const showDate = idx === 0 || shown[idx - 1].timestamp.slice(0, 10) !== entry.timestamp.slice(0, 10)

              return (
                <div key={entry.id}>
                  {showDate && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      marginBottom: 8, marginTop: idx === 0 ? 0 : 16, paddingLeft: 42,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {fmtDate(entry.timestamp)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: 16 }}>
                    {/* Dot */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: cfg.bg, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, position: 'relative', zIndex: 1,
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 2px #E8EDF4',
                    }}>{cfg.icon}</div>

                    {/* Content */}
                    <div style={{
                      flex: 1, background: '#fff',
                      border: '1px solid #E8EDF4', borderRadius: 10,
                      padding: '12px 16px',
                      boxShadow: '0 1px 3px rgba(0,56,129,0.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', lineHeight: 1.4 }}>
                          {entry.title}
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          {entry.status && (
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: statusCol ?? '#4A5568',
                              background: statusCol ? `${statusCol}18` : '#F4F6F9',
                              borderRadius: 4, padding: '2px 6px',
                            }}>{entry.status.replace(/_/g, ' ')}</span>
                          )}
                          {entry.regulation && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: '#7C3AED',
                              background: 'rgba(124,58,237,0.08)', borderRadius: 4, padding: '2px 6px',
                            }}>{entry.regulation}</span>
                          )}
                          <span style={{ fontSize: 11, color: '#B8C0CC', whiteSpace: 'nowrap' }}>
                            {timeAgo(entry.timestamp)}
                          </span>
                        </div>
                      </div>

                      {entry.detail && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#4A5568', lineHeight: 1.55 }}>
                          {entry.detail}
                        </p>
                      )}

                      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                        {entry.productName && (
                          <span style={{ fontSize: 11, color: '#9AA3AF' }}>
                            📦 {entry.productName}
                          </span>
                        )}
                        {entry.articleRef && (
                          <span style={{ fontSize: 11, color: '#9AA3AF' }}>
                            📄 {entry.articleRef}
                          </span>
                        )}
                        {entry.actor && (
                          <span style={{ fontSize: 11, color: '#9AA3AF' }}>
                            👤 {entry.actor}
                          </span>
                        )}
                        {entry.severity && (
                          <span style={{ fontSize: 11, color: entry.severity === 'HIGH' || entry.severity === 'CRITICAL' ? '#B45309' : '#9AA3AF' }}>
                            ⚡ {entry.severity}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: '#C8D0DB', marginLeft: 'auto' }}>
                          {fmtTime(entry.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ask AI Tab ─────────────────────────────────────────────────────────────────

function AskAiTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: text }
    const placeholder: ChatMessage = { role: 'assistant', content: '', loading: true }
    setMessages(prev => [...prev, userMsg, placeholder])
    setInput('')
    setLoading(true)

    try {
      const history = messages.filter(m => !m.loading).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/evidence-centre/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data = await res.json() as { answer?: string; error?: string }
      const answer = data.error ? `Error: ${data.error}` : (data.answer ?? 'No response.')
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: answer }
        return copy
      })
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: `Error: ${String(err)}` }
        return copy
      })
    } finally {
      setLoading(false)
    }
  }, [loading, messages])

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0' }}>
        {isEmpty ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #003781, #0A7C59)',
                margin: '0 auto 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>🤖</div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A1A2E' }}>
                Ask about your compliance data
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9AA3AF', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
                I have access to all products, requirements, gaps, evidence packages and status history.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 620, margin: '0 auto' }}>
              {SUGGESTED.map(q => (
                <button key={q} onClick={() => send(q)} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: '#fff', border: '1px solid #D0D7E3',
                  borderRadius: 10, cursor: 'pointer', fontSize: 13,
                  color: '#4A5568', lineHeight: 1.5,
                  transition: 'border-color 0.15s, color 0.15s',
                  gridColumn: q.length > 45 ? 'span 2' : 'span 1',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#003781'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#003781'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#D0D7E3'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#4A5568'
                }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 780, margin: '0 auto' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? '#003781' : 'linear-gradient(135deg, #003781, #0A7C59)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#fff', fontWeight: 700,
                }}>
                  {msg.role === 'user' ? 'U' : '🤖'}
                </div>
                <div style={{
                  maxWidth: '78%',
                  background: msg.role === 'user' ? '#003781' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#1A1A2E',
                  border: msg.role === 'user' ? 'none' : '1px solid #E8EDF4',
                  borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  padding: '12px 16px',
                  fontSize: 13, lineHeight: 1.65,
                  boxShadow: msg.role === 'assistant' ? '0 1px 3px rgba(0,56,129,0.06)' : 'none',
                }}>
                  {msg.loading ? (
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
                      {[0, 1, 2].map(j => (
                        <span key={j} style={{
                          width: 7, height: 7, borderRadius: '50%', background: '#003781',
                          animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                          display: 'inline-block',
                        }} />
                      ))}
                    </div>
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{
        padding: '16px 24px 24px',
        borderTop: isEmpty ? 'none' : '1px solid #E8EDF4',
        background: '#fff',
        flexShrink: 0,
      }}>
        <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
        <div style={{ display: 'flex', gap: 10, maxWidth: 780, margin: '0 auto' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder="Ask about compliance data, gaps, evidence…"
            disabled={loading}
            style={{
              flex: 1, padding: '12px 16px', fontSize: 14,
              border: '1px solid #D0D7E3', borderRadius: 10, outline: 'none',
              background: '#fff', color: '#1A1A2E',
              transition: 'border-color 0.15s',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{
              padding: '12px 20px', fontSize: 14, fontWeight: 600,
              borderRadius: 10, border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              background: loading || !input.trim() ? '#D0D7E3' : '#003781',
              color: loading || !input.trim() ? '#9AA3AF' : '#fff',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Thinking…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type ActiveTab = 'evidence' | 'logbook' | 'ask'

export default function EvidenceCentrePage() {
  const [tab, setTab] = useState<ActiveTab>('evidence')
  const [packages, setPackages] = useState<EvidencePackage[]>([])
  const [logEntries, setLogEntries] = useState<LogbookEntry[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [pkgLoading, setPkgLoading] = useState(true)

  useEffect(() => {
    fetch('/api/evidence-packages')
      .then(r => r.json())
      .then((data: EvidencePackage[]) => setPackages(Array.isArray(data) ? data : []))
      .catch(() => null)
      .finally(() => setPkgLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'logbook' || logEntries.length > 0) return
    setLogLoading(true)
    fetch('/api/evidence-centre/logbook')
      .then(r => r.json())
      .then((data: { entries: LogbookEntry[] }) => setLogEntries(data.entries ?? []))
      .catch(() => null)
      .finally(() => setLogLoading(false))
  }, [tab, logEntries.length])

  const completeCount = packages.filter(p => p.status === 'COMPLETE' || p.status === 'APPROVED').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Header */}
      <div style={{
        padding: '24px 24px 0',
        borderBottom: '1px solid #E8EDF4',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#003781' }}>Evidence Centre</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9AA3AF' }}>
              Compliance evidence, audit trail and AI assistant
            </p>
          </div>
          {!pkgLoading && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                background: '#F0FAF6', border: '1px solid rgba(10,124,89,0.2)',
                borderRadius: 8, padding: '8px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0A7C59' }}>{completeCount}</div>
                <div style={{ fontSize: 11, color: '#0A7C59' }}>Complete</div>
              </div>
              <div style={{
                background: '#F4F6F9', border: '1px solid #D0D7E3',
                borderRadius: 8, padding: '8px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#003781' }}>{packages.length}</div>
                <div style={{ fontSize: 11, color: '#9AA3AF' }}>Total packages</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E8EDF4', marginBottom: -1 }}>
          <Tab label="Evidence Packages" active={tab === 'evidence'} onClick={() => setTab('evidence')} />
          <Tab label="Logbook" active={tab === 'logbook'} onClick={() => setTab('logbook')} />
          <Tab label="Ask AI" active={tab === 'ask'} onClick={() => setTab('ask')} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: tab === 'ask' ? 'hidden' : 'auto', background: '#F8FAFC' }}>
        {tab === 'evidence' && (
          pkgLoading
            ? <div style={{ padding: 32, textAlign: 'center', color: '#9AA3AF' }}>Loading…</div>
            : <EvidenceTab packages={packages} />
        )}
        {tab === 'logbook' && (
          <LogbookTab entries={logEntries} loading={logLoading} />
        )}
        {tab === 'ask' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
            <AskAiTab />
          </div>
        )}
      </div>
    </div>
  )
}
