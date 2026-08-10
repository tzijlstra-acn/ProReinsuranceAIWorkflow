'use client'
import { useEffect, useState } from 'react'
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
  product: { id: string; name: string } | null
  requirement: { id: string; articleRef: string; title: string } | null
  source: { id: string; shortCode: string; name: string } | null
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
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

const STATUS_FILTERS = ['ALL', 'OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED', 'CLOSED'] as const

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function RemediationCasesPage() {
  const [cases, setCases] = useState<RemediationCase[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  useEffect(() => {
    fetch('/api/remediation/cases')
      .then(r => r.json())
      .then(data => {
        setCases(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = statusFilter === 'ALL'
    ? cases
    : cases.filter(c => c.status === statusFilter)

  const kpi = {
    open:       cases.filter(c => c.status === 'OPEN').length,
    inProgress: cases.filter(c => c.status === 'IN_PROGRESS').length,
    blocked:    cases.filter(c => c.status === 'BLOCKED').length,
    resolved:   cases.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length,
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#003781' }}>Remediation Cases</h1>
        <p style={{ color: '#6B7280', marginTop: 4, fontSize: 14 }}>
          Active compliance remediation work across all products
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Open',        value: kpi.open,       color: '#6B7280', bg: '#F3F4F6' },
          { label: 'In Progress', value: kpi.inProgress,  color: '#003781', bg: '#EBF5FF' },
          { label: 'Blocked',     value: kpi.blocked,     color: '#E4002B', bg: '#FEE2E2' },
          { label: 'Resolved',    value: kpi.resolved,    color: '#0A7C59', bg: '#D1FAE5' },
        ].map(k => (
          <div
            key={k.label}
            style={{
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              padding: '20px 24px',
              borderTop: `4px solid ${k.color}`,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => {
          const active = statusFilter === f
          return (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: active ? '1.5px solid #003781' : '1.5px solid #E5E7EB',
                background: active ? '#003781' : '#fff',
                color: active ? '#fff' : '#374151',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {f === 'ALL' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No cases found.</div>
      ) : (
        <div style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                {['Priority', 'Title', 'Product', 'Regulation', 'Requirement', 'Status', 'Due Date', 'Assigned To'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: '#6B7280',
                    fontWeight: 600,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const pri = priorityStyle(c.priority)
                const sts = statusStyle(c.status)
                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: idx < filtered.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <Badge bg={pri.bg} text={pri.text} label={pri.label} />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Link
                        href={`/remediation/${c.id}`}
                        style={{ color: '#003781', fontWeight: 600, textDecoration: 'none' }}
                        onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {c.title}
                      </Link>
                      <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>{c.id}</div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>
                      {c.product?.name ?? c.productId}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {c.source ? (
                        <span style={{
                          background: 'rgba(0,55,129,0.08)',
                          color: '#003781',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                          fontSize: 12,
                        }}>
                          {c.source.shortCode}
                        </span>
                      ) : c.sourceId}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151', maxWidth: 200 }}>
                      {c.requirement ? (
                        <span title={c.requirement.title}>
                          <span style={{ color: '#6B7280', fontSize: 11 }}>{c.requirement.articleRef} — </span>
                          {c.requirement.title.length > 40
                            ? c.requirement.title.slice(0, 40) + '…'
                            : c.requirement.title}
                        </span>
                      ) : c.requirementId}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <Badge bg={sts.bg} text={sts.text} label={sts.label} />
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {formatDate(c.dueDate)}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#6B7280' }}>
                      {c.assignedTo ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
