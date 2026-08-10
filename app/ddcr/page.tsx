'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DdcrItem {
  id: string
  entityType: 'APPLICATION' | 'PROJECT'
  entityId: string
  entityName: string
  tower: string
  orgUnit: string | null
  section: string | null
  program: string | null
  responsibleRole: string
  actionOwner: string | null
  regulatoryFramework: string
  requirementRef: string
  requirementTitle: string | null
  applicabilityStatus: string
  applicabilityRationale: string | null
  executionStatus: string
  verificationStatus: string
  reportingStatus: string
  nextAction: string | null
  practicalGuidance: string | null
  dueDate: string | null
  sourceSystem: string
  sourceSystemUrl: string | null
  sourceSystemRef: string | null
  evidenceReferences: Array<{ id: string; label: string; type: string; url?: string }>
  lastUpdated: string | null
  createdAt: string | null
}

interface SummaryData {
  total: number
  byReportingStatus: {
    NON_COMPLIANT: number
    PARTIALLY_COMPLIANT: number
    COMPLIANT: number
    NOT_ASSESSED: number
    EXCEPTION_APPROVED: number
  }
  byExecutionStatus: {
    ACTION_REQUIRED: number
    OVERDUE: number
    IN_PROGRESS: number
    COMPLETED: number
    NO_ACTION_REQUIRED: number
  }
  byTower: Record<string, number>
  bySourceSystem: Record<string, number>
  overdueCount: number
  actionRequiredCount: number
  compliantCount: number
  evidenceIncompleteCount: number
}

interface TowerStat {
  tower: string
  total: number
  compliant: number
  nonCompliant: number
  partiallyCompliant: number
  overdue: number
  actionRequired: number
  inProgress: number
}

interface AskAnswer {
  answer: string
  sections: Array<{ heading: string; content: string }>
  sources: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REPORTING_CFG: Record<string, { label: string; color: string; bg: string }> = {
  NON_COMPLIANT:       { label: 'Non-Compliant',       color: '#E4002B', bg: '#FFF0F3' },
  PARTIALLY_COMPLIANT: { label: 'Partially Compliant', color: '#B45309', bg: '#FEF3C7' },
  COMPLIANT:           { label: 'Compliant',           color: '#0A7C59', bg: '#F0FAF6' },
  NOT_ASSESSED:        { label: 'Not Assessed',        color: '#6B7280', bg: '#F3F4F6' },
  EXCEPTION_APPROVED:  { label: 'Exception Approved',  color: '#7C3AED', bg: '#F5F3FF' },
}

const EXECUTION_CFG: Record<string, { label: string; color: string; bg: string }> = {
  OVERDUE:            { label: 'Overdue',          color: '#E4002B', bg: '#FFF0F3' },
  ACTION_REQUIRED:    { label: 'Action Required',  color: '#B45309', bg: '#FEF3C7' },
  IN_PROGRESS:        { label: 'In Progress',      color: '#003781', bg: '#EBF5FF' },
  COMPLETED:          { label: 'Completed',        color: '#0A7C59', bg: '#F0FAF6' },
  NO_ACTION_REQUIRED: { label: 'No Action Req.',  color: '#6B7280', bg: '#F3F4F6' },
}

const SOURCE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  PRODUCT_HUB:        { label: 'Product Hub',       color: '#003781', bg: '#EBF5FF' },
  SERVICENOW:         { label: 'ServiceNow',         color: '#059669', bg: '#ECFDF5' },
  PROJECT_MANAGEMENT: { label: 'Project Management', color: '#7C3AED', bg: '#F5F3FF' },
  GRC:                { label: 'GRC Platform',       color: '#B45309', bg: '#FEF3C7' },
  LEANIX:             { label: 'LeanIX',             color: '#0891B2', bg: '#E0F2FE' },
  CODE_SCANNING:      { label: 'Code Scanning',      color: '#6B7280', bg: '#F3F4F6' },
}

const ROLES = [
  'IT Product Manager',
  'Program Manager',
  'Project Manager',
  'Security Engineer',
  'Risk Manager',
  'Enterprise Architect',
  'PMO',
]

const STATUS_SORT_ORDER: Record<string, number> = {
  NON_COMPLIANT: 0, PARTIALLY_COMPLIANT: 1, NOT_ASSESSED: 2, EXCEPTION_APPROVED: 3, COMPLIANT: 4,
}

const EXEC_SORT_ORDER: Record<string, number> = {
  OVERDUE: 0, ACTION_REQUIRED: 1, IN_PROGRESS: 2, COMPLETED: 3, NO_ACTION_REQUIRED: 4,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function repCfg(status: string) {
  return REPORTING_CFG[status] ?? { label: status, color: '#6B7280', bg: '#F3F4F6' }
}

function execCfg(status: string) {
  return EXECUTION_CFG[status] ?? { label: status, color: '#6B7280', bg: '#F3F4F6' }
}

function srcCfg(source: string) {
  return SOURCE_CFG[source] ?? { label: source, color: '#6B7280', bg: '#F3F4F6' }
}

function worstReportingStatus(statuses: string[]): string {
  return statuses.reduce((worst, s) =>
    (STATUS_SORT_ORDER[s] ?? 5) < (STATUS_SORT_ORDER[worst] ?? 5) ? s : worst,
    statuses[0] ?? 'NOT_ASSESSED'
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill / badge components
// ─────────────────────────────────────────────────────────────────────────────

function ReportingPill({ status }: { status: string }) {
  const cfg = repCfg(status)
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}40`, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function ExecutionPill({ status }: { status: string }) {
  const cfg = execCfg(status)
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}40`, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  const cfg = srcCfg(source)
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}30`, whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {cfg.label}
    </span>
  )
}

function EntityTypeBadge({ type }: { type: 'APPLICATION' | 'PROJECT' }) {
  const color = type === 'APPLICATION' ? '#003781' : '#7C3AED'
  const bg = type === 'APPLICATION' ? '#EBF5FF' : '#F5F3FF'
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 4,
      fontSize: 9, fontWeight: 700, color, background: bg,
      border: `1px solid ${color}30`, whiteSpace: 'nowrap', textTransform: 'uppercase',
    }}>
      {type}
    </span>
  )
}

function SourceLink({ url, label = 'View in source' }: { url: string | null; label?: string }) {
  if (!url) return <span style={{ color: '#A0ADB9', fontSize: 12 }}>—</span>
  if (url.startsWith('/')) {
    return (
      <Link href={url} style={{ fontSize: 12, color: '#003781', fontWeight: 600, textDecoration: 'none' }}>
        {label} →
      </Link>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 12, color: '#003781', fontWeight: 600, textDecoration: 'none' }}>
      {label} →
    </a>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout primitives
// ─────────────────────────────────────────────────────────────────────────────

function KpiTile({ label, value, color = '#003781', loading = false }: {
  label: string; value: number; color?: string; loading?: boolean
}) {
  return (
    <div style={{
      background: 'white', border: '1px solid #D0D7E3', borderRadius: 10,
      padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,56,129,0.06)', flex: 1, minWidth: 0,
    }}>
      <p style={{ fontSize: 26, fontWeight: 700, color, margin: 0, lineHeight: 1.1 }}>
        {loading ? '—' : value}
      </p>
      <p style={{ fontSize: 12, color: '#4A5568', margin: '4px 0 0' }}>{label}</p>
    </div>
  )
}

function TabLoader() {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: '#4A5568', fontSize: 14 }}>
      Loading…
    </div>
  )
}

function TabError({ msg }: { msg: string }) {
  return (
    <div style={{
      background: '#FFF0F3', border: '1px solid #E4002B40',
      borderRadius: 8, padding: '12px 16px', color: '#E4002B', fontSize: 13,
    }}>
      {msg}
    </div>
  )
}

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700,
  color: 'white', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ items, loading, error }: {
  items: DdcrItem[] | null; loading: boolean; error: string | null
}) {
  if (loading) return <TabLoader />
  if (error) return <TabError msg={error} />
  if (!items) return null

  // Source system breakdown
  const sourceBreakdown: Record<string, {
    total: number; compliant: number; nonCompliant: number; actionRequired: number; overdue: number
  }> = {}

  for (const item of items) {
    if (!sourceBreakdown[item.sourceSystem]) {
      sourceBreakdown[item.sourceSystem] = { total: 0, compliant: 0, nonCompliant: 0, actionRequired: 0, overdue: 0 }
    }
    const s = sourceBreakdown[item.sourceSystem]
    s.total++
    if (item.reportingStatus === 'COMPLIANT') s.compliant++
    if (item.reportingStatus === 'NON_COMPLIANT') s.nonCompliant++
    if (item.executionStatus === 'ACTION_REQUIRED') s.actionRequired++
    if (item.executionStatus === 'OVERDUE') s.overdue++
  }

  const actionItems = items
    .filter(i => i.executionStatus === 'ACTION_REQUIRED' || i.executionStatus === 'OVERDUE')
    .slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Business rule callout */}
      <div style={{
        background: '#EBF5FF', border: '1px solid #C7D2E8', borderRadius: 8,
        padding: '10px 14px', fontSize: 13, color: '#003781',
      }}>
        <strong>Business rule:</strong> Product Hub tells the team what needs to be done. DDCR shows whether it has been done.
      </div>

      {/* Source system breakdown table */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#003781', margin: '0 0 10px' }}>
          By Source System
        </h2>
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#003781' }}>
                {['Source System', 'Items', 'Compliant', 'Non-Compliant', 'Action Required', 'Overdue'].map(h => (
                  <th key={h} style={TH_STYLE}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(sourceBreakdown).map(([sys, stats], idx) => (
                <tr key={sys} style={{ background: idx % 2 === 0 ? 'white' : '#F9FAFB', borderTop: '1px solid #D0D7E3' }}>
                  <td style={{ padding: '10px 14px' }}><SourceBadge source={sys} /></td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#003781' }}>{stats.total}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: stats.compliant > 0 ? '#0A7C59' : '#4A5568', fontWeight: stats.compliant > 0 ? 600 : 400 }}>{stats.compliant}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: stats.nonCompliant > 0 ? '#E4002B' : '#4A5568', fontWeight: stats.nonCompliant > 0 ? 600 : 400 }}>{stats.nonCompliant}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: stats.actionRequired > 0 ? '#B45309' : '#4A5568', fontWeight: stats.actionRequired > 0 ? 600 : 400 }}>{stats.actionRequired}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: stats.overdue > 0 ? '#E4002B' : '#4A5568', fontWeight: stats.overdue > 0 ? 600 : 400 }}>{stats.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Action-required items table */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#003781', margin: '0 0 10px' }}>
          Items Requiring Action
          <span style={{ fontSize: 12, fontWeight: 400, color: '#4A5568', marginLeft: 8 }}>Top 10</span>
        </h2>

        {actionItems.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center', color: '#4A5568', fontSize: 13,
            fontStyle: 'italic', background: '#F9FAFB', borderRadius: 8, border: '1px solid #D0D7E3',
          }}>
            No items currently require action.
          </div>
        ) : (
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.06)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#003781' }}>
                  {['Entity', 'Framework', 'Requirement', 'Reporting Status', 'Execution', 'Owner', 'Due Date', 'Source', 'Action'].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actionItems.map((item, idx) => (
                  <tr key={item.id} style={{ background: idx % 2 === 0 ? 'white' : '#F9FAFB', borderTop: '1px solid #D0D7E3' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <EntityTypeBadge type={item.entityType} />
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#003781', margin: '3px 0 0' }}>{item.entityName}</p>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#4A5568', whiteSpace: 'nowrap' }}>{item.regulatoryFramework}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#4A5568' }}>{item.requirementRef}</span>
                      {item.requirementTitle && (
                        <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0', maxWidth: 180 }}>{item.requirementTitle}</p>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}><ReportingPill status={item.reportingStatus} /></td>
                    <td style={{ padding: '10px 14px' }}><ExecutionPill status={item.executionStatus} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#4A5568' }}>{item.actionOwner ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#4A5568', whiteSpace: 'nowrap' }}>{formatDate(item.dueDate)}</td>
                    <td style={{ padding: '10px 14px' }}><SourceBadge source={item.sourceSystem} /></td>
                    <td style={{ padding: '10px 14px' }}><SourceLink url={item.sourceSystemUrl} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: My Actions
// ─────────────────────────────────────────────────────────────────────────────

type ExecFilter = 'ALL' | 'ACTION_REQUIRED' | 'OVERDUE' | 'IN_PROGRESS' | 'COMPLETED'

function MyActionsTab({ items, loading, error }: {
  items: DdcrItem[] | null; loading: boolean; error: string | null
}) {
  const [selectedRole, setSelectedRole] = useState(ROLES[0])
  const [filter, setFilter] = useState<ExecFilter>('ALL')

  if (loading) return <TabLoader />
  if (error) return <TabError msg={error} />
  if (!items) return null

  const roleItems = items.filter(i => i.responsibleRole === selectedRole)
  const filtered = roleItems.filter(i => filter === 'ALL' || i.executionStatus === filter)
  const sorted = [...filtered].sort((a, b) =>
    (EXEC_SORT_ORDER[a.executionStatus] ?? 5) - (EXEC_SORT_ORDER[b.executionStatus] ?? 5)
  )

  const filterOptions: Array<{ key: ExecFilter; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTION_REQUIRED', label: 'Action Required' },
    { key: 'OVERDUE', label: 'Overdue' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'COMPLETED', label: 'Completed' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Controls row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Role
          </label>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            style={{
              fontSize: 13, padding: '6px 10px', border: '1px solid #D0D7E3', borderRadius: 6,
              background: 'white', color: '#003781', fontWeight: 600, cursor: 'pointer', outline: 'none',
            }}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {filterOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                border: filter === opt.key ? '1px solid #003781' : '1px solid #D0D7E3',
                background: filter === opt.key ? '#003781' : 'white',
                color: filter === opt.key ? 'white' : '#4A5568',
                fontWeight: filter === opt.key ? 700 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          padding: '32px', textAlign: 'center', color: '#4A5568', fontSize: 13,
          fontStyle: 'italic', background: '#F9FAFB', borderRadius: 8, border: '1px solid #D0D7E3',
        }}>
          No items for {selectedRole}{filter !== 'ALL' ? ` — ${filter.replace('_', ' ')}` : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => {
            const eCfg = execCfg(item.executionStatus)
            const isMuted = item.executionStatus === 'COMPLETED' || item.executionStatus === 'NO_ACTION_REQUIRED'
            const borderColor = item.executionStatus === 'OVERDUE' ? '#E4002B40'
              : item.executionStatus === 'ACTION_REQUIRED' ? '#B4530940'
              : '#D0D7E3'

            return (
              <div key={item.id} style={{
                background: 'white', border: `1px solid ${borderColor}`, borderRadius: 10,
                padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,56,129,0.06)',
                opacity: isMuted ? 0.72 : 1,
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <EntityTypeBadge type={item.entityType} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#003781' }}>{item.entityName}</span>
                  <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 2 }}>{item.tower}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, background: '#F3F4F6', color: '#4A5568', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                    {item.regulatoryFramework}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', background: '#F4F6F9', color: '#4A5568', padding: '2px 7px', borderRadius: 4 }}>
                    {item.requirementRef}
                  </span>
                  <ReportingPill status={item.reportingStatus} />
                  <ExecutionPill status={item.executionStatus} />
                  <SourceBadge source={item.sourceSystem} />
                </div>

                {item.requirementTitle && (
                  <p style={{ fontSize: 12, color: '#4A5568', margin: '0 0 6px' }}>{item.requirementTitle}</p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#4A5568', marginBottom: 8 }}>
                  {item.actionOwner && (
                    <span><strong style={{ color: '#003781' }}>Owner:</strong> {item.actionOwner}</span>
                  )}
                  {item.dueDate && (
                    <span>
                      <strong style={{ color: item.executionStatus === 'OVERDUE' ? '#E4002B' : '#003781' }}>Due:</strong> {formatDate(item.dueDate)}
                    </span>
                  )}
                </div>

                {item.nextAction && (
                  <div style={{ background: '#F4F6F9', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#003781', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Next Action
                    </p>
                    <p style={{ fontSize: 12, color: '#4A5568', margin: 0 }}>{item.nextAction}</p>
                  </div>
                )}

                {item.practicalGuidance && (
                  <div style={{ background: '#EBF5FF', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#003781', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Practical Guidance
                    </p>
                    <p style={{ fontSize: 12, color: '#4A5568', margin: 0 }}>{item.practicalGuidance}</p>
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  <SourceLink url={item.sourceSystemUrl} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Applications
// ─────────────────────────────────────────────────────────────────────────────

function ApplicationsTab({ items, loading, error }: {
  items: DdcrItem[] | null; loading: boolean; error: string | null
}) {
  if (loading) return <TabLoader />
  if (error) return <TabError msg={error} />
  if (!items) return null

  const appItems = items.filter(i => i.entityType === 'APPLICATION')

  const grouped: Record<string, DdcrItem[]> = {}
  for (const item of appItems) {
    if (!grouped[item.entityId]) grouped[item.entityId] = []
    grouped[item.entityId].push(item)
  }

  if (Object.keys(grouped).length === 0) {
    return (
      <div style={{
        padding: '32px', textAlign: 'center', color: '#4A5568', fontSize: 13,
        fontStyle: 'italic', background: '#F9FAFB', borderRadius: 8, border: '1px solid #D0D7E3',
      }}>
        No application entities found.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(grouped).map(([entityId, entityItems]) => {
        const worst = worstReportingStatus(entityItems.map(i => i.reportingStatus))
        const wCfg = repCfg(worst)
        const appName = entityItems[0].entityName
        const tower = entityItems[0].tower

        return (
          <div key={entityId} style={{
            background: 'white', border: `1px solid ${wCfg.color}40`,
            borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,56,129,0.06)',
          }}>
            <div style={{
              background: wCfg.bg, padding: '12px 16px', borderBottom: `1px solid ${wCfg.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#003781', margin: 0 }}>{appName}</p>
                <p style={{ fontSize: 11, color: '#4A5568', margin: '2px 0 0' }}>{tower} &middot; {entityId}</p>
              </div>
              <ReportingPill status={worst} />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Framework', 'Requirement', 'Reporting', 'Execution', 'Source'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700,
                      color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em',
                      borderBottom: '1px solid #D0D7E3',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entityItems.map((item, idx) => (
                  <tr key={item.id} style={{ background: idx % 2 === 0 ? 'white' : '#FAFAFA', borderTop: idx > 0 ? '1px solid #E5E7EB' : undefined }}>
                    <td style={{ padding: '8px 14px', fontSize: 11, color: '#4A5568', whiteSpace: 'nowrap' }}>{item.regulatoryFramework}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#4A5568' }}>{item.requirementRef}</span>
                      {item.requirementTitle && (
                        <p style={{ fontSize: 10, color: '#6B7280', margin: '1px 0 0', maxWidth: 200 }}>{item.requirementTitle}</p>
                      )}
                    </td>
                    <td style={{ padding: '8px 14px' }}><ReportingPill status={item.reportingStatus} /></td>
                    <td style={{ padding: '8px 14px' }}><ExecutionPill status={item.executionStatus} /></td>
                    <td style={{ padding: '8px 14px' }}><SourceBadge source={item.sourceSystem} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Towers (self-contained — fetches its own data)
// ─────────────────────────────────────────────────────────────────────────────

function TowersTab() {
  const [towers, setTowers] = useState<TowerStat[] | null>(null)
  const [items, setItems] = useState<DdcrItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTower, setSelectedTower] = useState<string | null>(null)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      setError(null)
      try {
        const [tRes, iRes] = await Promise.all([
          fetch('/api/ddcr/items/towers'),
          fetch('/api/ddcr/items'),
        ])
        if (!tRes.ok) throw new Error(`Towers HTTP ${tRes.status}`)
        if (!iRes.ok) throw new Error(`Items HTTP ${iRes.status}`)
        const [towersData, itemsData] = await Promise.all([tRes.json(), iRes.json()])
        setTowers(towersData as TowerStat[])
        setItems(itemsData as DdcrItem[])
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) return <TabLoader />
  if (error) return <TabError msg={error} />
  if (!towers || !items) return null

  const filteredItems = selectedTower ? items.filter(i => i.tower === selectedTower) : items

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Tower cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {towers.map(t => {
          const total = t.total || 1
          const compliantPct = Math.round((t.compliant / total) * 100)
          const partialPct = Math.round((t.partiallyCompliant / total) * 100)
          const nonCompliantPct = Math.max(0, 100 - compliantPct - partialPct)
          const isSelected = selectedTower === t.tower

          return (
            <button
              key={t.tower}
              onClick={() => setSelectedTower(isSelected ? null : t.tower)}
              style={{
                background: 'white', textAlign: 'left', cursor: 'pointer',
                border: isSelected ? '2px solid #003781' : '1px solid #D0D7E3',
                borderRadius: 10, padding: '14px 16px',
                boxShadow: isSelected ? '0 0 0 3px #00378120' : '0 1px 3px rgba(0,56,129,0.06)',
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 700, color: '#003781', margin: '0 0 8px' }}>{t.tower}</p>

              <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: '#F3F4F6', display: 'flex', marginBottom: 8 }}>
                <div style={{ width: `${compliantPct}%`, background: '#0A7C59' }} />
                <div style={{ width: `${partialPct}%`, background: '#B45309' }} />
                <div style={{ width: `${nonCompliantPct}%`, background: '#E4002B' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#4A5568', flexWrap: 'wrap' }}>
                <span><strong style={{ color: '#003781' }}>{t.total}</strong> total</span>
                {t.overdue > 0 && <span style={{ color: '#E4002B', fontWeight: 600 }}>{t.overdue} overdue</span>}
                {t.actionRequired > 0 && <span style={{ color: '#B45309', fontWeight: 600 }}>{t.actionRequired} action req.</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Filtered items table */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#003781', margin: '0 0 10px' }}>
          {selectedTower ? `Items — ${selectedTower}` : 'All Items'}
          <span style={{ fontSize: 12, fontWeight: 400, color: '#4A5568', marginLeft: 8 }}>
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          </span>
          {selectedTower && (
            <button
              onClick={() => setSelectedTower(null)}
              style={{ marginLeft: 10, fontSize: 11, color: '#003781', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 400 }}
            >
              Clear filter
            </button>
          )}
        </h3>

        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.06)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#003781' }}>
                {['Entity', 'Framework', 'Requirement', 'Tower', 'Reporting', 'Execution', 'Owner', 'Source'].map(h => (
                  <th key={h} style={TH_STYLE}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 50).map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? 'white' : '#F9FAFB', borderTop: '1px solid #D0D7E3' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <EntityTypeBadge type={item.entityType} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#003781', margin: '3px 0 0' }}>{item.entityName}</p>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#4A5568', whiteSpace: 'nowrap' }}>{item.regulatoryFramework}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: '#4A5568' }}>{item.requirementRef}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#4A5568' }}>{item.tower}</td>
                  <td style={{ padding: '10px 14px' }}><ReportingPill status={item.reportingStatus} /></td>
                  <td style={{ padding: '10px 14px' }}><ExecutionPill status={item.executionStatus} /></td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#4A5568' }}>{item.actionOwner ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}><SourceBadge source={item.sourceSystem} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length > 50 && (
            <div style={{ padding: '10px 14px', background: '#F9FAFB', borderTop: '1px solid #D0D7E3', fontSize: 12, color: '#4A5568', textAlign: 'center' }}>
              Showing 50 of {filteredItems.length} items
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: History
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTab({ items, loading, error }: {
  items: DdcrItem[] | null; loading: boolean; error: string | null
}) {
  if (loading) return <TabLoader />
  if (error) return <TabError msg={error} />
  if (!items) return null

  const sorted = [...items]
    .filter(i => i.lastUpdated)
    .sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())

  if (sorted.length === 0) {
    return (
      <div style={{
        padding: '32px', textAlign: 'center', color: '#4A5568', fontSize: 13,
        fontStyle: 'italic', background: '#F9FAFB', borderRadius: 8, border: '1px solid #D0D7E3',
      }}>
        No items with update timestamps found.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
        Items sorted by most recently updated. For detailed change history, open the individual item in its source system.
      </p>
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.06)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#003781' }}>
              {['Last Updated', 'Entity', 'Framework', 'Requirement', 'Reporting', 'Execution', 'Source'].map(h => (
                <th key={h} style={TH_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 50).map((item, idx) => (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? 'white' : '#F9FAFB', borderTop: '1px solid #D0D7E3' }}>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#4A5568', whiteSpace: 'nowrap' }}>{formatDate(item.lastUpdated)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <EntityTypeBadge type={item.entityType} />
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#003781', margin: '3px 0 0' }}>{item.entityName}</p>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#4A5568', whiteSpace: 'nowrap' }}>{item.regulatoryFramework}</td>
                <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'monospace', color: '#4A5568' }}>{item.requirementRef}</td>
                <td style={{ padding: '10px 14px' }}><ReportingPill status={item.reportingStatus} /></td>
                <td style={{ padding: '10px 14px' }}><ExecutionPill status={item.executionStatus} /></td>
                <td style={{ padding: '10px 14px' }}><SourceBadge source={item.sourceSystem} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > 50 && (
          <div style={{ padding: '10px 14px', background: '#F9FAFB', borderTop: '1px solid #D0D7E3', fontSize: 12, color: '#4A5568', textAlign: 'center' }}>
            Showing 50 of {sorted.length} items
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Ask DDCR
// ─────────────────────────────────────────────────────────────────────────────

function AskDdcrTab({ towerOptions }: { towerOptions: string[] }) {
  const [question, setQuestion] = useState('')
  const [towerFilter, setTowerFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<AskAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch('/api/ddcr/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          context: towerFilter ? { tower: towerFilter } : undefined,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as AskAnswer
      setAnswer(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAsk()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>

      {/* Disclaimer */}
      <div style={{
        background: '#FEF3C7', border: '1px solid #B4530940', borderRadius: 8,
        padding: '10px 14px', fontSize: 12, color: '#92400E',
      }}>
        <strong>Read-only assistant.</strong> Ask DDCR cannot change compliance status, close actions, or write back to source systems.
        All status updates must originate from Product Hub, ServiceNow, or other connected source systems.
      </div>

      {/* Context filter */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Context — Tower (optional)
        </label>
        <select
          value={towerFilter}
          onChange={e => setTowerFilter(e.target.value)}
          style={{
            fontSize: 13, padding: '6px 10px', border: '1px solid #D0D7E3', borderRadius: 6,
            background: 'white', color: '#003781', cursor: 'pointer', outline: 'none', minWidth: 200,
          }}
        >
          <option value="">All towers</option>
          {towerOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Question input */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Question
        </label>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about compliance status, requirements, action owners, overdue items…"
          rows={4}
          style={{
            width: '100%', fontSize: 13, padding: '10px 12px', border: '1px solid #D0D7E3',
            borderRadius: 8, resize: 'vertical', outline: 'none', fontFamily: 'inherit',
            color: '#003781', boxSizing: 'border-box',
          }}
        />
        <p style={{ fontSize: 11, color: '#A0ADB9', margin: '4px 0 0' }}>Press Ctrl+Enter to submit</p>
      </div>

      <button
        onClick={handleAsk}
        disabled={loading || !question.trim()}
        style={{
          alignSelf: 'flex-start', border: 'none', borderRadius: 8,
          padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
          background: loading || !question.trim() ? '#D0D7E3' : '#003781',
          color: 'white',
        }}
      >
        {loading ? 'Thinking…' : 'Ask DDCR'}
      </button>

      {error && <TabError msg={error} />}

      {answer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {answer.answer && (
            <div style={{
              background: '#F9FAFB', border: '1px solid #D0D7E3', borderRadius: 10,
              padding: '16px 18px', fontSize: 13, color: '#1C1917', lineHeight: 1.7,
            }}>
              {answer.answer}
            </div>
          )}

          {answer.sections?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {answer.sections.map((section, idx) => (
                <div key={idx} style={{ background: 'white', border: '1px solid #D0D7E3', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#EBF5FF', padding: '8px 14px', borderBottom: '1px solid #C7D2E8' }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: '#003781', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {section.heading}
                    </h4>
                  </div>
                  <div style={{ padding: '12px 14px', fontSize: 13, color: '#4A5568', lineHeight: 1.7 }}>
                    {section.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {answer.sources?.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                Sources
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {answer.sources.map((src, idx) => (
                  <span key={idx} style={{
                    fontSize: 11, background: '#F3F4F6', border: '1px solid #D0D7E3',
                    borderRadius: 4, padding: '3px 8px', color: '#4A5568', fontFamily: 'monospace',
                  }}>
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'my-actions' | 'applications' | 'towers' | 'history' | 'ask'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview',     label: 'Overview' },
  { id: 'my-actions',   label: 'My Actions' },
  { id: 'applications', label: 'Applications' },
  { id: 'towers',       label: 'Towers' },
  { id: 'history',      label: 'History' },
  { id: 'ask',          label: 'Ask DDCR' },
]

const ITEM_TABS: Tab[] = ['overview', 'my-actions', 'applications', 'history']

export default function DDCRPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [items, setItems] = useState<DdcrItem[] | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [itemsLoaded, setItemsLoaded] = useState(false)

  // Fetch summary on mount
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/ddcr/items/summary')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setSummary(await res.json() as SummaryData)
      } catch {
        // Non-fatal — KPI tiles show 0
      } finally {
        setSummaryLoading(false)
      }
    }
    fetchSummary()
  }, [])

  // Lazy-load items when a tab that needs them becomes active
  useEffect(() => {
    if (itemsLoaded || !ITEM_TABS.includes(activeTab)) return
    const fetchItems = async () => {
      setItemsLoading(true)
      setItemsError(null)
      try {
        const res = await fetch('/api/ddcr/items')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setItems(await res.json() as DdcrItem[])
        setItemsLoaded(true)
      } catch (e) {
        setItemsError(String(e))
      } finally {
        setItemsLoading(false)
      }
    }
    fetchItems()
  }, [activeTab, itemsLoaded])

  const towerOptions = Array.from(new Set((items ?? []).map(i => i.tower).filter(Boolean)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#003781', margin: 0 }}>
          DDCR — Compliance Reporting Cockpit
        </h1>
        <p style={{ fontSize: 13, color: '#4A5568', margin: '4px 0 0', lineHeight: 1.6 }}>
          Federated view across Product Hub, ServiceNow, GRC, LeanIX, Code Scanning and Project Management
        </p>
      </div>

      {/* KPI bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiTile label="Total Items"      value={summary?.total ?? 0}              loading={summaryLoading} />
        <KpiTile label="Overdue"          value={summary?.overdueCount ?? 0}       loading={summaryLoading} color="#E4002B" />
        <KpiTile label="Action Required"  value={summary?.actionRequiredCount ?? 0} loading={summaryLoading} color="#B45309" />
        <KpiTile label="Compliant"        value={summary?.compliantCount ?? 0}     loading={summaryLoading} color="#0A7C59" />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #D0D7E3', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 18px', fontSize: 13, whiteSpace: 'nowrap',
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#003781' : '#6B7280',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #003781' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab items={items} loading={itemsLoading} error={itemsError} />
      )}
      {activeTab === 'my-actions' && (
        <MyActionsTab items={items} loading={itemsLoading} error={itemsError} />
      )}
      {activeTab === 'applications' && (
        <ApplicationsTab items={items} loading={itemsLoading} error={itemsError} />
      )}
      {activeTab === 'towers' && <TowersTab />}
      {activeTab === 'history' && (
        <HistoryTab items={items} loading={itemsLoading} error={itemsError} />
      )}
      {activeTab === 'ask' && <AskDdcrTab towerOptions={towerOptions} />}
    </div>
  )
}
