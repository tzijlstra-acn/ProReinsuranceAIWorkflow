'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Archive,
  RefreshCw,
  Eye,
  Copy,
  FolderOpen,
  ExternalLink,
  ArrowLeftRight,
  X,
  Check,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { clsx } from 'clsx'

// ---------------------------------------------------------------------------
// Evidence Package types (new domain)
// ---------------------------------------------------------------------------

interface EvidencePackage {
  id: string
  status: string
  assembledAt: string | null
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string | null
  verificationResultIds: string[]
  evidenceArtifactIds: string[]
  product: { id: string; name: string } | null
  requirement: { id: string; articleRef: string; title: string; obligationType: string } | null
  source: { id: string; shortCode: string; name: string } | null
}

const EP_STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETE:    { label: 'Complete',    color: '#0A7C59', bg: '#F0FAF6' },
  ASSEMBLING:  { label: 'Assembling',  color: '#B45309', bg: '#FFFBEB' },
  APPROVED:    { label: 'Approved',    color: '#0A7C59', bg: '#F0FAF6' },
  REJECTED:    { label: 'Rejected',    color: '#E4002B', bg: '#FFF0F3' },
  DRAFT:       { label: 'Draft',       color: '#4A5568', bg: '#F4F6F9' },
}

function EvidencePackageCard({ ep }: { ep: EvidencePackage }) {
  const s = EP_STATUS_STYLE[ep.status] ?? EP_STATUS_STYLE.DRAFT
  return (
    <div
      className="bg-white rounded-lg border p-4"
      style={{ borderColor: '#D0D7E3', boxShadow: '0 1px 3px rgba(0,56,129,0.06)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: s.color }} />
          <span className="font-semibold text-sm" style={{ color: '#003781' }}>{ep.id}</span>
        </div>
        <span
          className="px-2 py-0.5 text-xs font-semibold rounded flex-shrink-0"
          style={{ color: s.color, background: s.bg }}
        >
          {s.label}
        </span>
      </div>
      {ep.requirement && (
        <p className="text-sm font-medium mb-0.5" style={{ color: '#1A1A2E' }}>
          {ep.requirement.articleRef} — {ep.requirement.title}
        </p>
      )}
      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: '#4A5568' }}>
        {ep.source && <span className="px-1.5 py-0.5 rounded" style={{ background: '#F4F6F9' }}>{ep.source.shortCode}</span>}
        {ep.product && <span>{ep.product.name}</span>}
        <span>{ep.verificationResultIds.length} verifications</span>
      </div>
      {ep.approvedAt && ep.approvedBy && (
        <p className="text-xs mt-2" style={{ color: '#4A5568' }}>
          Approved by <span className="font-medium">{ep.approvedBy}</span>
          {' '}on {new Date(ep.approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {ep.product && (
          <Link
            href={`/ddcr/products/${ep.product.id}`}
            className="text-xs font-medium"
            style={{ color: '#003781' }}
          >
            View in DDCR →
          </Link>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileEntry {
  path: string
  relativePath: string
  exists: boolean
  format: string
  size?: number
  hash?: string
  modifiedAt?: string
  layer: string
  status: string
}

interface EvidenceRoot {
  root: string
  platform: string
}

interface ContentPayload {
  format: string
  content: unknown
}

type DiffLine = { type: 'same' | 'add' | 'remove'; text: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROUPS = [
  'All',
  'Regulatory Sources',
  'Guidelines & Controls',
  'Infrastructure as Code',
  'Azure Configuration',
  'Policy Evaluations',
  'DDCR Records',
  'Product Hub Documents',
  'Audit Evidence',
  'Event Records',
  'Parsed Data',
]

const FRIENDLY_NAMES: Record<string, { name: string; sourceSystem: string; workflowStep: number | null }> = {
  'dora_article_12.html': { name: 'DORA Article 12 — EUR-Lex Snapshot', sourceSystem: 'EUR-Lex', workflowStep: 1 },
  'Backup_Restore_Guideline_v1.docx': { name: 'Backup & Restore Guideline v1', sourceSystem: 'Product Hub', workflowStep: 1 },
  'Backup_Restore_Guideline_v2.docx': { name: 'Backup & Restore Guideline v2 (Generated)', sourceSystem: 'Maya / Mitra', workflowStep: 1 },
  'Backup_Restore_Guideline_v2_template.txt': { name: 'Guideline v2 Template (Baseline)', sourceSystem: 'Internal', workflowStep: 1 },
  'control_activities_before.csv': { name: 'Control Catalogue — Baseline Export', sourceSystem: 'Control Catalogue', workflowStep: 1 },
  'control_activities_after.csv': { name: 'Control Catalogue — Updated Export', sourceSystem: 'Maya / Mitra', workflowStep: 1 },
  'backup_policy_definition.json': { name: 'Azure Policy: VM Backup Enabled', sourceSystem: 'Azure Policy', workflowStep: 3 },
  'backup_geo_policy_definition.json': { name: 'Azure Policy: Backup Geo-Redundant (GRZ)', sourceSystem: 'Azure Policy', workflowStep: 3 },
  'it_app_x_resources_before.json': { name: 'IT App X — Azure Resources (Before)', sourceSystem: 'Azure APIs', workflowStep: 3 },
  'it_app_x_resources_after.json': { name: 'IT App X — Azure Resources (After)', sourceSystem: 'Azure APIs', workflowStep: 3 },
  'policy_evaluation_after.json': { name: 'Policy Evaluation Result — Post Deployment', sourceSystem: 'Azure Policy', workflowStep: 3 },
  'ddcr_export_before.csv': { name: 'DDCR Export — Baseline', sourceSystem: 'DDCR', workflowStep: 4 },
  'ddcr_export_after.csv': { name: 'DDCR Export — Updated', sourceSystem: 'DDCR', workflowStep: 4 },
  'IT_App_X_SDD_v1.docx': { name: 'System Design Document v1', sourceSystem: 'Product Hub', workflowStep: 5 },
  'IT_App_X_SDD_v2.docx': { name: 'System Design Document v2 (Generated)', sourceSystem: 'Maya Doc Gen', workflowStep: 5 },
  'IT_App_X_Operating_Manual_v1.docx': { name: 'Operating Manual v1', sourceSystem: 'Product Hub', workflowStep: 5 },
  'IT_App_X_Operating_Manual_v2.docx': { name: 'Operating Manual v2 (Generated)', sourceSystem: 'Maya Doc Gen', workflowStep: 5 },
  'DORA_Article_12_Audit_Response.docx': { name: 'Audit Response — DORA Article 12', sourceSystem: 'RQMT / HCL', workflowStep: 6 },
  'evidence_manifest.json': { name: 'Evidence Manifest', sourceSystem: 'AoC Control Line', workflowStep: 6 },
  'transformation_log.jsonl': { name: 'Transformation Event Log', sourceSystem: 'AoC Control Line', workflowStep: null },
  'backup.tf': { name: 'Backup Infrastructure — Terraform', sourceSystem: 'IaC / Copilot', workflowStep: 2 },
  'main.tf': { name: 'Main Infrastructure — Terraform (Baseline)', sourceSystem: 'IaC', workflowStep: 2 },
  'variables.tf': { name: 'Terraform Variables (Baseline)', sourceSystem: 'IaC', workflowStep: 2 },
}

// Pairs where "compare" is available — keyed by filename
const COMPARE_PAIRS: Array<{ v1: string; v2: string }> = [
  { v1: 'Backup_Restore_Guideline_v1.docx', v2: 'Backup_Restore_Guideline_v2.docx' },
  { v1: 'IT_App_X_SDD_v1.docx', v2: 'IT_App_X_SDD_v2.docx' },
  { v1: 'IT_App_X_Operating_Manual_v1.docx', v2: 'IT_App_X_Operating_Manual_v2.docx' },
  { v1: 'control_activities_before.csv', v2: 'control_activities_after.csv' },
  { v1: 'it_app_x_resources_before.json', v2: 'it_app_x_resources_after.json' },
  { v1: 'ddcr_export_before.csv', v2: 'ddcr_export_after.csv' },
]

const FORMAT_COLORS: Record<string, string> = {
  docx: 'bg-blue-100 text-blue-800',
  json: 'bg-yellow-100 text-yellow-800',
  jsonl: 'bg-gray-100 text-gray-600',
  csv: 'bg-green-100 text-green-800',
  tf: 'bg-purple-100 text-purple-800',
  html: 'bg-orange-100 text-orange-800',
  txt: 'bg-gray-100 text-gray-600',
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getGroup(relativePath: string): string {
  const p = relativePath.replace(/\\/g, '/')
  if (p.includes('data/raw/eurlex/')) return 'Regulatory Sources'
  if (
    p.includes('data/raw/guidelines/') || p.includes('data/generated/guidelines/') ||
    p.includes('data/raw/control-catalog/') || p.includes('data/generated/control-catalog/')
  ) return 'Guidelines & Controls'
  if (p.startsWith('infra/')) return 'Infrastructure as Code'
  // Policy evaluations must come before generic azure check
  if (p.includes('policy_evaluation')) return 'Policy Evaluations'
  if (p.includes('data/raw/azure/') || p.includes('data/generated/azure/')) return 'Azure Configuration'
  if (p.includes('data/raw/ddcr/') || p.includes('data/generated/ddcr/')) return 'DDCR Records'
  if (p.includes('data/raw/product-hub/') || p.includes('data/generated/product-hub/')) return 'Product Hub Documents'
  if (p.includes('data/generated/evidence/')) return 'Audit Evidence'
  if (p.includes('data/evidence/')) return 'Event Records'
  if (p.includes('data/normalized/')) return 'Parsed Data'
  return 'Other'
}

function getFilename(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath
}

function getFriendlyInfo(filename: string): { name: string; sourceSystem: string; workflowStep: number | null } {
  if (filename in FRIENDLY_NAMES) return FRIENDLY_NAMES[filename]
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
  return { name: base, sourceSystem: 'Unknown', workflowStep: null }
}

function extractVersion(filename: string): string {
  const vMatch = filename.match(/_v(\d+)\./i)
  if (vMatch) return `v${vMatch[1]}`
  if (/_before\./i.test(filename)) return 'Before'
  if (/_after\./i.test(filename)) return 'After'
  return '—'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getComparePair(
  filename: string,
  files: FileEntry[]
): { v1: FileEntry; v2: FileEntry } | null {
  for (const pair of COMPARE_PAIRS) {
    if (filename === pair.v1 || filename === pair.v2) {
      const v1 = files.find(f => getFilename(f.relativePath) === pair.v1 && f.exists)
      const v2 = files.find(f => getFilename(f.relativePath) === pair.v2 && f.exists)
      if (v1 && v2) return { v1, v2 }
    }
  }
  return null
}

// One-pass JSON tokenizer for syntax highlighting (no dangerouslySetInnerHTML needed)
type JsonToken =
  | { kind: 'key'; text: string }
  | { kind: 'string'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'keyword'; text: string }
  | { kind: 'plain'; text: string }

function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let i = 0

  while (i < json.length) {
    const ch = json[i]

    if (ch === '"') {
      // String token
      let j = i + 1
      while (j < json.length) {
        if (json[j] === '\\') { j += 2; continue }
        if (json[j] === '"') { j++; break }
        j++
      }
      const str = json.slice(i, j)
      // Peek past whitespace to see if followed by ':'
      let k = j
      while (k < json.length && (json[k] === ' ' || json[k] === '\t')) k++
      if (json[k] === ':') {
        tokens.push({ kind: 'key', text: str })
      } else {
        tokens.push({ kind: 'string', text: str })
      }
      i = j
      continue
    }

    if ((ch >= '0' && ch <= '9') || (ch === '-' && i + 1 < json.length && json[i + 1] >= '0' && json[i + 1] <= '9')) {
      let j = i
      if (json[j] === '-') j++
      while (j < json.length && ((json[j] >= '0' && json[j] <= '9') || json[j] === '.' || json[j] === 'e' || json[j] === 'E' || json[j] === '+' || json[j] === '-')) j++
      tokens.push({ kind: 'number', text: json.slice(i, j) })
      i = j
      continue
    }

    const slice4 = json.slice(i, i + 4)
    const slice5 = json.slice(i, i + 5)
    if (slice4 === 'true' || slice4 === 'null') {
      tokens.push({ kind: 'keyword', text: slice4 })
      i += 4
      continue
    }
    if (slice5 === 'false') {
      tokens.push({ kind: 'keyword', text: 'false' })
      i += 5
      continue
    }

    tokens.push({ kind: 'plain', text: ch })
    i++
  }

  return tokens
}

function parseCsvRows(csv: string): string[][] {
  return csv
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; continue }
          inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
          fields.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
      fields.push(current.trim())
      return fields
    })
}

function computeDiff(v1Text: string, v2Text: string): { left: DiffLine[]; right: DiffLine[] } {
  const v1Lines = v1Text.split('\n')
  const v2Lines = v2Text.split('\n')
  const v2Set = new Set(v2Lines)
  const v1Set = new Set(v1Lines)
  const left: DiffLine[] = v1Lines.map(text => ({ type: v2Set.has(text) ? 'same' : 'remove', text }))
  const right: DiffLine[] = v2Lines.map(text => ({ type: v1Set.has(text) ? 'same' : 'add', text }))
  return { left, right }
}

async function openInOs(filePath: string, action: 'open' | 'reveal'): Promise<string | null> {
  const res = await fetch('/api/os/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, action }),
  })
  const data = await res.json() as { ok: boolean; fallback?: boolean; absolutePath?: string }
  if (!data.ok && data.fallback && data.absolutePath) {
    return data.absolutePath // caller can display this
  }
  return null
}

// ---------------------------------------------------------------------------
// Content renderer sub-components
// ---------------------------------------------------------------------------

function JsonHighlighted({ json }: { json: string }) {
  const tokens = tokenizeJson(json)
  return (
    <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
      {tokens.map((token, idx) => {
        if (token.kind === 'key') return <span key={idx} style={{ color: '#0f1e32', fontWeight: 600 }}>{token.text}</span>
        if (token.kind === 'string') return <span key={idx} style={{ color: '#3350b8' }}>{token.text}</span>
        if (token.kind === 'number' || token.kind === 'keyword') return <span key={idx} style={{ color: '#175788' }}>{token.text}</span>
        return <span key={idx} style={{ color: '#4A5568' }}>{token.text}</span>
      })}
    </pre>
  )
}

function CsvTable({ csv }: { csv: string }) {
  const rows = parseCsvRows(csv)
  if (rows.length === 0) return <p className="text-sm text-[#4A5568]">Empty file</p>
  const headers = rows[0]
  const data = rows.slice(1)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: '#0f1e32' }}>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-white whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 border-t border-gray-100 text-[#1A1A2E]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeWithLineNumbers({ text, language }: { text: string; language: string }) {
  const lines = text.split('\n')
  return (
    <div className="font-mono text-xs overflow-x-auto">
      <div className="text-right text-[#A0ADB9] text-xs px-2 pb-1 border-b border-gray-100 mb-1">{language}</div>
      {lines.map((line, i) => (
        <div key={i} className="flex hover:bg-gray-50">
          <span className="select-none w-10 text-right pr-3 text-[#A0ADB9] flex-shrink-0 leading-5">{i + 1}</span>
          <span className="text-[#1A1A2E] leading-5 whitespace-pre">{line}</span>
        </div>
      ))}
    </div>
  )
}

function DocxContent({ text }: { text: string }) {
  const paragraphs = text.split('\n').filter(p => p.trim().length > 0)
  return (
    <div className="space-y-2 text-sm">
      {paragraphs.map((para, i) => {
        // Simple heading detection
        if (/^#{1,4}\s/.test(para)) {
          const level = para.match(/^(#+)/)?.[1].length ?? 1
          const content = para.replace(/^#+\s/, '')
          const sizes = ['text-xl font-bold', 'text-lg font-semibold', 'text-base font-semibold', 'text-sm font-semibold']
          return <p key={i} className={clsx(sizes[Math.min(level - 1, 3)], 'text-[#0f1e32] mt-4 mb-1')}>{content}</p>
        }
        return <p key={i} className="text-[#4A5568] leading-relaxed">{para}</p>
      })}
    </div>
  )
}

function JsonlContent({ entries }: { entries: Record<string, unknown>[] }) {
  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div key={i} className="bg-gray-50 rounded p-3">
          <JsonHighlighted json={JSON.stringify(entry, null, 2)} />
        </div>
      ))}
    </div>
  )
}

function ContentRenderer({ payload }: { payload: ContentPayload }) {
  const { format, content } = payload

  if (format === 'json') {
    return <JsonHighlighted json={JSON.stringify(content, null, 2)} />
  }
  if (format === 'jsonl') {
    return <JsonlContent entries={content as Record<string, unknown>[]} />
  }
  if (format === 'csv') {
    return <CsvTable csv={content as string} />
  }
  if (format === 'docx') {
    return <DocxContent text={content as string} />
  }
  if (format === 'html') {
    return <CodeWithLineNumbers text={content as string} language="HTML" />
  }
  if (format === 'tf') {
    return <CodeWithLineNumbers text={content as string} language="Terraform" />
  }
  return <CodeWithLineNumbers text={content as string} language={format.toUpperCase()} />
}

// ---------------------------------------------------------------------------
// File Drawer (slide-over)
// ---------------------------------------------------------------------------

function FileDrawer({
  file,
  onClose,
}: {
  file: FileEntry
  onClose: () => void
}) {
  const [payload, setPayload] = useState<ContentPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/files/content?path=${encodeURIComponent(file.relativePath)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setPayload(data as ContentPayload)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [file.relativePath])

  const filename = getFilename(file.relativePath)
  const info = getFriendlyInfo(filename)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[600px] max-w-full bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#D0D7E3] flex-shrink-0">
          <div className="pr-4">
            <p className="text-xs text-[#4A5568] mb-1">{file.relativePath}</p>
            <h2 className="text-base font-semibold text-[#0f1e32] leading-snug">{info.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={clsx('px-2 py-0.5 rounded text-xs font-medium uppercase', FORMAT_COLORS[file.format] ?? 'bg-gray-100 text-gray-600')}>
                {file.format}
              </span>
              <span className={clsx('px-2 py-0.5 rounded text-xs font-medium',
                file.status === 'baseline' ? 'bg-[#EBF5FF] text-[#003781]' : 'bg-amber-50 text-amber-700'
              )}>
                {file.status === 'baseline' ? 'Baseline' : 'Generated'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-[#4A5568] flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading && (
            <div className="flex items-center justify-center h-32 text-[#4A5568]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading content…
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">{error}</div>
          )}
          {payload && !loading && <ContentRenderer payload={payload} />}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Compare Modal
// ---------------------------------------------------------------------------

function CompareModal({
  v1File,
  v2File,
  onClose,
}: {
  v1File: FileEntry
  v2File: FileEntry
  onClose: () => void
}) {
  const [diff, setDiff] = useState<{ left: DiffLine[]; right: DiffLine[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const v1Info = getFriendlyInfo(getFilename(v1File.relativePath))
  const v2Info = getFriendlyInfo(getFilename(v2File.relativePath))

  useEffect(() => {
    async function fetchBoth() {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/files/content?path=${encodeURIComponent(v1File.relativePath)}`).then(r => r.json()) as Promise<ContentPayload & { error?: string }>,
          fetch(`/api/files/content?path=${encodeURIComponent(v2File.relativePath)}`).then(r => r.json()) as Promise<ContentPayload & { error?: string }>,
        ])
        if (r1.error || r2.error) {
          setError(r1.error ?? r2.error ?? 'Failed to load content')
          return
        }
        const text1 = typeof r1.content === 'string' ? r1.content : JSON.stringify(r1.content, null, 2)
        const text2 = typeof r2.content === 'string' ? r2.content : JSON.stringify(r2.content, null, 2)
        setDiff(computeDiff(text1, text2))
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    fetchBoth()
  }, [v1File.relativePath, v2File.relativePath])

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-4 bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D0D7E3] flex-shrink-0">
          <div>
            <h2 className="font-semibold text-[#0f1e32]">Version Comparison</h2>
            <div className="flex items-center gap-2 text-xs text-[#4A5568] mt-1">
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{v1File.hash}</span>
              <ArrowLeftRight className="w-3 h-3" />
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{v2File.hash}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-[#4A5568]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-6 py-2 border-b border-[#D0D7E3] text-xs text-[#4A5568] flex-shrink-0 bg-gray-50">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#d7f3e8] border border-green-200 inline-block" />Added in v2</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#fde8e8] border border-red-200 inline-block" />Removed from v1</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center flex-1 text-[#4A5568]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Comparing…
          </div>
        )}
        {error && (
          <div className="m-6 bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">{error}</div>
        )}

        {diff && !loading && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left — v1 */}
            <div className="flex-1 overflow-auto border-r border-[#D0D7E3]">
              <div className="sticky top-0 bg-[#F4F6F9] px-4 py-2 text-xs font-semibold text-[#0f1e32] border-b border-[#D0D7E3]">
                {v1Info.name}
              </div>
              <div className="font-mono text-xs p-4 space-y-px">
                {diff.left.map((line, i) => (
                  <div
                    key={i}
                    className="flex leading-5 rounded-sm"
                    style={line.type === 'remove' ? { backgroundColor: '#fde8e8' } : undefined}
                  >
                    <span className="select-none w-8 text-right pr-3 text-[#A0ADB9] flex-shrink-0">{i + 1}</span>
                    <span className="whitespace-pre-wrap break-all" style={{ color: line.type === 'remove' ? '#b91c1c' : '#4A5568' }}>
                      {line.type === 'remove' ? '− ' : '  '}{line.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — v2 */}
            <div className="flex-1 overflow-auto">
              <div className="sticky top-0 bg-[#F4F6F9] px-4 py-2 text-xs font-semibold text-[#0f1e32] border-b border-[#D0D7E3]">
                {v2Info.name}
              </div>
              <div className="font-mono text-xs p-4 space-y-px">
                {diff.right.map((line, i) => (
                  <div
                    key={i}
                    className="flex leading-5 rounded-sm"
                    style={line.type === 'add' ? { backgroundColor: '#d7f3e8' } : undefined}
                  >
                    <span className="select-none w-8 text-right pr-3 text-[#A0ADB9] flex-shrink-0">{i + 1}</span>
                    <span className="whitespace-pre-wrap break-all" style={{ color: line.type === 'add' ? '#166534' : '#4A5568' }}>
                      {line.type === 'add' ? '+ ' : '  '}{line.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// File Card
// ---------------------------------------------------------------------------

function FileCard({
  file,
  allFiles,
  onView,
  onCompare,
}: {
  file: FileEntry
  allFiles: FileEntry[]
  onView: (f: FileEntry) => void
  onCompare: (v1: FileEntry, v2: FileEntry) => void
}) {
  const [copied, setCopied] = useState(false)
  const [fallbackPath, setFallbackPath] = useState<string | null>(null)

  const filename = getFilename(file.relativePath)
  const info = getFriendlyInfo(filename)
  const version = extractVersion(filename)
  const comparePair = getComparePair(filename, allFiles)

  async function handleOpen(action: 'open' | 'reveal') {
    const fb = await openInOs(file.path, action)
    if (fb) setFallbackPath(fb)
  }

  function handleCopy() {
    navigator.clipboard.writeText(file.path).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-lg border border-[#D0D7E3] p-4 hover:border-[#3350b8]/40 transition-colors">
      {/* Badges row */}
      <div className="flex items-center gap-2 mb-2">
        <span className={clsx('px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide', FORMAT_COLORS[file.format] ?? 'bg-gray-100 text-gray-600')}>
          {file.format}
        </span>
        <span className={clsx('px-2 py-0.5 rounded text-xs font-medium',
          file.status === 'baseline' ? 'bg-[#EBF5FF] text-[#003781]' : 'bg-amber-50 text-amber-700'
        )}>
          {file.status === 'baseline' ? 'Baseline' : 'Generated'}
        </span>
        {info.workflowStep !== null && (
          <span className="ml-auto px-2 py-0.5 rounded text-xs bg-[#0f1e32]/8 text-[#0f1e32]">
            Step {info.workflowStep}
          </span>
        )}
      </div>

      {/* Friendly name */}
      <p className="font-semibold text-sm text-[#0f1e32] leading-snug mb-0.5">{info.name}</p>

      {/* Filename */}
      <p className="text-xs text-[#4A5568] mb-2">
        <span className="text-[#A0ADB9]">Filename: </span>{filename}
      </p>

      {/* Source + Step row */}
      <div className="flex items-center gap-4 text-xs text-[#4A5568] mb-2">
        <span><span className="text-[#A0ADB9]">Source: </span>{info.sourceSystem}</span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-[#4A5568] mb-2">
        <span><span className="text-[#A0ADB9]">Version: </span>{version}</span>
        {file.hash && <><span className="text-[#D0D7E3]">|</span><span><span className="text-[#A0ADB9]">Hash: </span><span className="font-mono">{file.hash}</span></span></>}
        {file.modifiedAt && <><span className="text-[#D0D7E3]">|</span><span><span className="text-[#A0ADB9]">Modified: </span>{formatDate(file.modifiedAt)}</span></>}
        {file.size !== undefined && <><span className="text-[#D0D7E3]">|</span><span>{formatBytes(file.size)}</span></>}
      </div>

      {/* Path */}
      <p className="text-xs font-mono text-[#A0ADB9] truncate mb-3" title={file.relativePath}>
        {file.relativePath}
      </p>

      {/* Fallback path notice */}
      {fallbackPath && (
        <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          Could not open OS file manager. Path: <span className="font-mono break-all">{fallbackPath}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onView(file)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-white transition-colors"
          style={{ backgroundColor: '#3350b8' }}
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
        <button
          onClick={() => handleOpen('open')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#D0D7E3] text-[#4A5568] hover:border-[#3350b8] hover:text-[#3350b8] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open file
        </button>
        <button
          onClick={() => handleOpen('reveal')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#D0D7E3] text-[#4A5568] hover:border-[#3350b8] hover:text-[#3350b8] transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Reveal
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#D0D7E3] text-[#4A5568] hover:border-[#3350b8] hover:text-[#3350b8] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy path'}
        </button>
        {comparePair && (
          <button
            onClick={() => onCompare(comparePair.v1, comparePair.v2)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border border-[#D0D7E3] text-[#4A5568] hover:border-[#3350b8] hover:text-[#3350b8] transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Compare versions
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EvidenceCentrePage() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [evidenceRoot, setEvidenceRoot] = useState<EvidenceRoot | null>(null)
  const [selectedGroup, setSelectedGroup] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewingFile, setViewingFile] = useState<FileEntry | null>(null)
  const [comparingPair, setComparingPair] = useState<{ v1: FileEntry; v2: FileEntry } | null>(null)
  const [rootFallback, setRootFallback] = useState<string | null>(null)
  const [qaOpen, setQaOpen] = useState(false)
  const [qaQuestion, setQaQuestion] = useState('')
  const [qaAnswer, setQaAnswer] = useState<string | null>(null)
  const [qaCitations, setQaCitations] = useState<Array<{ label: string; path: string; format: string }>>([])
  const [qaLoading, setQaLoading] = useState(false)
  const [evidencePackages, setEvidencePackages] = useState<EvidencePackage[]>([])

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files')
      const data = await res.json() as { files: FileEntry[] }
      setFiles(data.files)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load evidence root once
  useEffect(() => {
    fetch('/api/evidence-root')
      .then(r => r.json())
      .then(data => setEvidenceRoot(data as EvidenceRoot))
      .catch(() => null)
  }, [])

  // Load domain evidence packages
  useEffect(() => {
    fetch('/api/evidence-packages')
      .then(r => r.json())
      .then((data: EvidencePackage[]) => setEvidencePackages(Array.isArray(data) ? data : []))
      .catch(() => null)
  }, [])

  // Initial fetch + 5-second polling
  useEffect(() => {
    fetchFiles()
    const id = setInterval(fetchFiles, 5000)
    return () => clearInterval(id)
  }, [fetchFiles])

  const existingFiles = files.filter(f => f.exists)

  const searchedFiles = searchQuery.trim()
    ? existingFiles.filter(f => {
        const filename = getFilename(f.relativePath)
        const info = getFriendlyInfo(filename)
        const q = searchQuery.toLowerCase()
        return (
          info.name.toLowerCase().includes(q) ||
          filename.toLowerCase().includes(q) ||
          info.sourceSystem.toLowerCase().includes(q)
        )
      })
    : existingFiles

  const filteredFiles =
    selectedGroup === 'All'
      ? searchedFiles
      : searchedFiles.filter(f => getGroup(f.relativePath) === selectedGroup)

  const keyEvidenceFiles = existingFiles.filter(f =>
    ['docx', 'csv', 'html'].includes(f.format) && f.status !== 'baseline'
  )

  const askEvidence = async () => {
    if (!qaQuestion.trim()) return
    setQaLoading(true)
    setQaAnswer(null)
    setQaCitations([])
    try {
      const res = await fetch('/api/audit/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: qaQuestion }),
      })
      const data = await res.json()
      if (data.error) {
        setQaAnswer(data.error)
      } else {
        const auditAnswer = data.answer
        let displayText = ''
        if (typeof auditAnswer === 'string') {
          displayText = auditAnswer
        } else if (auditAnswer?.directResponse) {
          const parts: string[] = [auditAnswer.directResponse]
          if (Array.isArray(auditAnswer.sections)) {
            for (const s of auditAnswer.sections as Array<{ heading: string; content: string }>) {
              parts.push(`\n${s.heading}\n${s.content}`)
            }
          }
          displayText = parts.join('\n')
        } else {
          displayText = 'No answer returned'
        }
        setQaAnswer(displayText)
        setQaCitations(data.citations ?? [])
      }
    } finally {
      setQaLoading(false)
    }
  }

  // Build grouped structure for the main content area
  const groupedFiles: Record<string, FileEntry[]> = {}
  for (const f of filteredFiles) {
    const g = getGroup(f.relativePath)
    if (!groupedFiles[g]) groupedFiles[g] = []
    groupedFiles[g].push(f)
  }

  // Group counts for sidebar badges
  const groupCounts: Record<string, number> = {}
  for (const f of existingFiles) {
    const g = getGroup(f.relativePath)
    groupCounts[g] = (groupCounts[g] ?? 0) + 1
  }

  async function handleOpenEvidenceFolder() {
    if (!evidenceRoot) return
    const fb = await openInOs(evidenceRoot.root, 'open')
    if (fb) setRootFallback(fb)
  }

  const displayedGroups = selectedGroup === 'All'
    ? GROUPS.filter(g => g !== 'All' && groupedFiles[g]?.length)
    : [selectedGroup]

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f1e32' }}>Evidence Centre</h1>
          <p className="text-sm text-[#4A5568] mt-1">
            All artefacts across the AoC pipeline
            {!loading && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[#0f1e32]/8 text-[#0f1e32] text-xs font-medium">
                {existingFiles.length} files
              </span>
            )}
          </p>
          {rootFallback && (
            <p className="text-xs text-amber-700 mt-1">
              Could not open folder. Path: <span className="font-mono">{rootFallback}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            className="px-3 py-2 text-sm rounded-md border border-[#D0D7E3] text-[#0f1e32] outline-none focus:border-[#3350b8]"
            style={{ width: '180px', background: 'white' }}
          />
          <button
            onClick={fetchFiles}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border border-[#D0D7E3] text-[#4A5568] hover:text-[#003781] hover:border-[#003781] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleOpenEvidenceFolder}
            disabled={!evidenceRoot}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#3350b8' }}
          >
            <Archive className="w-4 h-4" />
            Open evidence folder
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0">
          <p className="text-xs font-semibold text-[#A0ADB9] uppercase tracking-wide mb-2 px-1">Filter by group</p>
          <nav className="space-y-0.5">
            {GROUPS.map(group => {
              const count = group === 'All' ? existingFiles.length : (groupCounts[group] ?? 0)
              return (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left',
                    selectedGroup === group
                      ? 'text-white font-medium'
                      : 'text-[#4A5568] hover:text-[#0f1e32] hover:bg-[#F4F6F9]'
                  )}
                  style={selectedGroup === group ? { backgroundColor: '#0f1e32' } : undefined}
                >
                  <span>{group}</span>
                  {count > 0 && (
                    <span className={clsx('text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                      selectedGroup === group ? 'bg-white/20 text-white' : 'bg-[#D0D7E3] text-[#4A5568]'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* Domain Evidence Packages — shown in "All" view */}
          {selectedGroup === 'All' && !searchQuery && evidencePackages.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold" style={{ color: '#0f1e32' }}>Compliance Evidence Packages</h2>
                <span className="text-xs" style={{ color: '#A0ADB9' }}>{evidencePackages.length} {evidencePackages.length === 1 ? 'package' : 'packages'}</span>
                <div className="flex-1 h-px" style={{ background: '#0A7C59', opacity: 0.3 }} />
                <Link href="/ddcr" className="text-xs" style={{ color: '#003781' }}>Open DDCR →</Link>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {evidencePackages.map(ep => (
                  <EvidencePackageCard key={ep.id} ep={ep} />
                ))}
              </div>
            </section>
          )}

          {/* Key Evidence hero section — shown only in "All" view when files exist */}
          {selectedGroup === 'All' && !searchQuery && keyEvidenceFiles.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-[#0f1e32]">Generated Artefacts</h2>
                <span className="text-xs text-[#A0ADB9]">{keyEvidenceFiles.length} key {keyEvidenceFiles.length === 1 ? 'document' : 'documents'}</span>
                <div className="flex-1 h-px bg-[#3350b8]/20" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {keyEvidenceFiles.map(f => (
                  <FileCard
                    key={f.relativePath}
                    file={f}
                    allFiles={existingFiles}
                    onView={setViewingFile}
                    onCompare={(v1, v2) => setComparingPair({ v1, v2 })}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Group-based file listing */}
          {loading ? (
            <div className="flex items-center justify-center h-48 text-[#4A5568]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading files…
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#4A5568]">
              <Archive className="w-10 h-10 mb-3 text-[#D0D7E3]" />
              <p className="font-medium">No files found</p>
              <p className="text-sm mt-1">{searchQuery ? 'Try a different search term' : 'Run pipeline stages to generate artefacts'}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {displayedGroups.map(group => {
                const groupFiles = groupedFiles[group]
                if (!groupFiles?.length) return null
                return (
                  <section key={group}>
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-sm font-semibold text-[#0f1e32]">{group}</h2>
                      <span className="text-xs text-[#A0ADB9]">{groupFiles.length} {groupFiles.length === 1 ? 'file' : 'files'}</span>
                      {group === 'Parsed Data' && (
                        <span className="text-xs text-[#A0ADB9] italic">Intermediate parsed data — generated during workflow.</span>
                      )}
                      <div className="flex-1 h-px bg-[#D0D7E3]" />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {groupFiles.map(f => (
                        <FileCard
                          key={f.relativePath}
                          file={f}
                          allFiles={existingFiles}
                          onView={setViewingFile}
                          onCompare={(v1, v2) => setComparingPair({ v1, v2 })}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {/* AI Q&A panel */}
          <section className="border border-[#D0D7E3] rounded-lg overflow-hidden">
            <button
              onClick={() => setQaOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-left transition-colors hover:bg-[#F4F6F9]"
              style={{ color: '#0f1e32', background: '#F4F6F9' }}
            >
              <span>Ask about the evidence</span>
              <span className="text-[#A0ADB9] text-xs">{qaOpen ? '▲ Hide' : '▼ Expand'}</span>
            </button>
            {qaOpen && (
              <div className="p-5 space-y-4 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qaQuestion}
                    onChange={e => setQaQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !qaLoading && askEvidence()}
                    placeholder="Ask about compliance, controls, evidence…"
                    className="flex-1 px-3 py-2 text-sm rounded border border-[#D0D7E3] outline-none focus:border-[#3350b8]"
                    style={{ background: 'white' }}
                  />
                  <button
                    onClick={askEvidence}
                    disabled={qaLoading || !qaQuestion.trim()}
                    className="px-4 py-2 text-sm font-semibold rounded text-white disabled:opacity-50 transition-colors"
                    style={{ background: '#3350b8', border: 'none', cursor: qaLoading ? 'wait' : 'pointer' }}
                  >
                    {qaLoading ? 'Analysing…' : 'Ask'}
                  </button>
                </div>
                {qaAnswer && (
                  <div className="p-4 rounded space-y-3 bg-[#F4F6F9] border border-[#D0D7E3]">
                    <p className="text-sm text-[#0f1e32]" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {qaAnswer}
                    </p>
                    {qaCitations.length > 0 && (
                      <div className="pt-2 border-t border-[#D0D7E3]">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#A0ADB9] mb-2">Evidence documents</p>
                        <div className="flex flex-wrap gap-2">
                          {qaCitations.map(c => (
                            <span
                              key={c.path}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white border border-[#D0D7E3] text-[#0f1e32]"
                            >
                              <span className="text-[#A0ADB9]">{c.format.toUpperCase()}</span>
                              {c.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* File viewer drawer */}
      {viewingFile && (
        <FileDrawer
          file={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}

      {/* Compare modal */}
      {comparingPair && (
        <CompareModal
          v1File={comparingPair.v1}
          v2File={comparingPair.v2}
          onClose={() => setComparingPair(null)}
        />
      )}
    </div>
  )
}
