'use client'
import { useState, useEffect, useCallback } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { FileContentModal } from './FileContentModal'

export type FileFormat = 'html' | 'docx' | 'csv' | 'json' | 'tf' | 'jsonl'

export interface SourceFile {
  label: string
  path: string
  format: FileFormat
  description: string
}

export interface GeneratedFile {
  label: string
  path: string
  format: FileFormat
  exists: boolean
  description: string
}

interface FileMetadata {
  relativePath: string
  exists: boolean
  format: string
  size: number
  hash: string
  modifiedAt: string
  layer: string
  status: string
}

interface TransformLogEntry {
  transformationId: string
  timestamp: string
  operation: string
  sourceFile?: string
  sourceSystem?: string
  targetFile?: string
  sourceHash?: string
  targetHash?: string
  actor?: string
  correlationId?: string
  approvedBy?: string
}

interface StageTabViewProps {
  stageNumber: number
  originalSources: SourceFile[]
  parsedDataPaths: string[]
  generatedFiles: GeneratedFile[]
  diffView?: React.ReactNode
  evidenceFilter?: string
}

const FORMAT_COLORS: Record<string, string> = {
  html: 'bg-[#0066B2]/10 text-[#0066B2] border-[#0066B2]/30',
  docx: 'bg-[#003781]/10 text-[#003781] border-[#003781]/30',
  csv: 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30',
  json: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30',
  tf: 'bg-[#6B21A8]/10 text-[#6B21A8] border-[#6B21A8]/30',
  jsonl: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30',
}

function FormatBadge({ format }: { format: string }) {
  const cls = FORMAT_COLORS[format] ?? 'bg-[#F4F6F9] text-[#4A5568] border-[#D0D7E3]'
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded border font-mono ${cls}`}>.{format}</span>
  )
}

const OP_COLORS: Record<string, string> = {
  SOURCE_READ: 'text-[#0066B2]',
  DATA_PARSED: 'text-[#0A7C59]',
  FILE_CREATED: 'text-[#003781]',
  RECORD_UPDATED: 'text-[#B45309]',
  EVIDENCE_STORED: 'text-[#6B21A8]',
}

function highlightJson(raw: string): string {
  let pretty = raw
  try { pretty = JSON.stringify(JSON.parse(raw), null, 2) } catch { /* use as-is */ }
  const escaped = pretty
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/"([^"]+)"(\s*:)/g, '<span style="color:#003781">"$1"</span>$2')
    .replace(/(\:\s*)"([^"]*)"/g, '$1<span style="color:#0A7C59">"$2"</span>')
    .replace(/(\:\s*)(true|false|null)/g, '$1<span style="color:#0066B2">$2</span>')
    .replace(/(\:\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, '$1<span style="color:#0066B2">$2</span>')
}

function CsvPreview({ content }: { content: string }) {
  const rows = content.trim().split('\n').slice(0, 11).map(r => r.split(','))
  if (rows.length === 0) return <p className="text-[#4A5568] text-xs">No data</p>
  const [header, ...dataRows] = rows
  return (
    <div className="overflow-auto">
      <table className="text-xs min-w-full border-collapse">
        <thead>
          <tr className="bg-[#F4F6F9]">
            {header?.map((h, i) => (
              <th key={i} className="px-2 py-1 text-left text-[#1A1A2E] border border-[#D0D7E3] font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} className="hover:bg-[#F4F6F9]/50">
              {row.map((cell, ci) => (
                <td key={ci} className="px-2 py-1 text-[#4A5568] border border-[#D0D7E3]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GeneratedFilePreview({ file, content }: { file: GeneratedFile; content: string }) {
  if (file.format === 'csv') return <CsvPreview content={content} />
  if (file.format === 'json' || file.format === 'jsonl') {
    return (
      <pre
        className="text-xs font-mono whitespace-pre-wrap text-[#4A5568] overflow-auto max-h-64"
        dangerouslySetInnerHTML={{ __html: highlightJson(content) }}
      />
    )
  }
  if (file.format === 'docx') {
    return (
      <div className="space-y-1.5 max-h-64 overflow-auto">
        {content.split('\n').filter(Boolean).map((p, i) => (
          <p key={i} className="text-[#4A5568] text-xs">{p}</p>
        ))}
      </div>
    )
  }
  // tf, html, etc — code block
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap text-[#4A5568] overflow-auto max-h-64 bg-[#F4F6F9] p-3 rounded">
      {content}
    </pre>
  )
}

function EvidenceRow({ entry }: { entry: TransformLogEntry }) {
  const opClass = OP_COLORS[entry.operation] ?? 'text-[#4A5568]'
  const displayHash = entry.targetHash ?? entry.sourceHash
  return (
    <tr className="hover:bg-[#F4F6F9]/50">
      <td className="px-3 py-2 border border-[#D0D7E3] font-mono text-[#4A5568]">
        {new Date(entry.timestamp).toLocaleString()}
      </td>
      <td className={`px-3 py-2 border border-[#D0D7E3] font-medium ${opClass}`}>
        {entry.operation}
      </td>
      <td className="px-3 py-2 border border-[#D0D7E3] font-mono text-[#4A5568] max-w-[160px] truncate">
        {entry.sourceFile ?? '-'}
      </td>
      <td className="px-3 py-2 border border-[#D0D7E3] font-mono text-[#4A5568] max-w-[160px] truncate">
        {entry.targetFile ?? '-'}
      </td>
      <td className="px-3 py-2 border border-[#D0D7E3] font-mono text-[#4A5568]">
        {displayHash ? displayHash.slice(0, 8) : '-'}
      </td>
      <td className="px-3 py-2 border border-[#D0D7E3] font-mono text-[#4A5568]">
        {entry.transformationId ? entry.transformationId.slice(0, 8) : '-'}
      </td>
    </tr>
  )
}

export function StageTabView({ stageNumber, originalSources, parsedDataPaths, generatedFiles, diffView, evidenceFilter }: StageTabViewProps) {
  const [activeTab, setActiveTab] = useState('sources')
  const [allMetadata, setAllMetadata] = useState<FileMetadata[]>([])
  const [parsedContents, setParsedContents] = useState<Record<string, string>>({})
  const [generatedContents, setGeneratedContents] = useState<Record<string, string>>({})
  const [transformLog, setTransformLog] = useState<TransformLogEntry[]>([])
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [modal, setModal] = useState<{ path: string; name: string; format: FileFormat } | null>(null)

  const hasExistingGenerated = generatedFiles.some(f => f.exists)

  // Fetch file metadata once
  useEffect(() => {
    fetch('/api/files')
      .then(r => r.json() as Promise<{ files?: FileMetadata[] } | FileMetadata[]>)
      .then(data => {
        const files = Array.isArray(data) ? data : (data.files ?? [])
        setAllMetadata(files)
      })
      .catch(() => { /* silently ignore */ })
  }, [])

  const fetchTransformLog = useCallback(async () => {
    try {
      const res = await fetch('/api/transform-log')
      const data = await res.json() as { entries?: TransformLogEntry[] } | TransformLogEntry[]
      const entries = Array.isArray(data) ? data : (data.entries ?? [])
      setTransformLog(entries)
    } catch { /* silently ignore */ }
  }, [])

  const fetchFileContent = async (path: string): Promise<string> => {
    const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`)
    const data = await res.json() as { format?: string; content?: unknown; error?: string }
    if (data.error) return ''
    const raw = data.content
    if (typeof raw === 'string') return raw
    if (raw !== undefined) return JSON.stringify(raw, null, 2)
    return ''
  }

  const fetchParsedContents = useCallback(async () => {
    for (const path of parsedDataPaths) {
      if (parsedContents[path] !== undefined) continue
      setLoadingStates(prev => ({ ...prev, [path]: true }))
      try {
        const text = await fetchFileContent(path)
        setParsedContents(prev => ({ ...prev, [path]: text }))
      } catch {
        setParsedContents(prev => ({ ...prev, [path]: '' }))
      } finally {
        setLoadingStates(prev => ({ ...prev, [path]: false }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedDataPaths, parsedContents])

  const fetchGeneratedContents = useCallback(async () => {
    for (const file of generatedFiles) {
      if (!file.exists) continue
      if (generatedContents[file.path] !== undefined) continue
      setLoadingStates(prev => ({ ...prev, [file.path]: true }))
      try {
        const text = await fetchFileContent(file.path)
        setGeneratedContents(prev => ({ ...prev, [file.path]: text }))
      } catch {
        setGeneratedContents(prev => ({ ...prev, [file.path]: '' }))
      } finally {
        setLoadingStates(prev => ({ ...prev, [file.path]: false }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedFiles, generatedContents])

  useEffect(() => {
    if (activeTab === 'parsed') fetchParsedContents()
    if (activeTab === 'generated') fetchGeneratedContents()
    if (activeTab === 'evidence') fetchTransformLog()
  }, [activeTab, fetchParsedContents, fetchGeneratedContents, fetchTransformLog])

  const getMetadata = (path: string) => allMetadata.find(m => m.relativePath === path)

  const downloadFile = async (path: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const text = await fetchFileContent(path)
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silently ignore */ }
  }

  const filteredLog = transformLog
    .filter(e => {
      if (evidenceFilter) return e.correlationId?.includes(`stage-${stageNumber}`) ?? true
      return true
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50)

  const tabTriggerClass = (value: string, disabled?: boolean) => {
    if (disabled) return 'px-4 py-2 text-xs font-medium text-[#4A5568]/40 cursor-not-allowed rounded-t-md'
    if (activeTab === value) return 'px-4 py-2 text-xs font-medium bg-[#003781] text-white rounded-t-md'
    return 'px-4 py-2 text-xs font-medium text-[#4A5568] hover:text-[#003781] rounded-t-md transition-colors'
  }

  return (
    <div className="bg-white border border-[#D0D7E3] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex border-b border-[#D0D7E3] bg-[#F4F6F9] px-2 pt-2 gap-1">
          <Tabs.Trigger value="sources" className={tabTriggerClass('sources')}>
            Original Source
          </Tabs.Trigger>
          <Tabs.Trigger value="parsed" className={tabTriggerClass('parsed')}>
            Parsed Data
          </Tabs.Trigger>
          <Tabs.Trigger value="generated" className={tabTriggerClass('generated')}>
            New Version
          </Tabs.Trigger>
          <Tabs.Trigger
            value="changes"
            disabled={!hasExistingGenerated}
            className={tabTriggerClass('changes', !hasExistingGenerated)}
          >
            Changes
          </Tabs.Trigger>
          <Tabs.Trigger value="evidence" className={tabTriggerClass('evidence')}>
            Evidence
          </Tabs.Trigger>
        </Tabs.List>

        {/* Tab 1: Original Source */}
        <Tabs.Content value="sources" className="p-5 space-y-3">
          {originalSources.map(src => {
            const meta = getMetadata(src.path)
            return (
              <div key={src.path} className="border border-[#D0D7E3] rounded-lg overflow-hidden">
                <button
                  onClick={() => setModal({ path: src.path, name: src.label, format: src.format })}
                  className="w-full text-left p-4 hover:bg-[#F4F6F9] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#1A1A2E] font-medium text-sm">{src.label}</span>
                        <FormatBadge format={src.format} />
                      </div>
                      <p className="text-[#4A5568] text-xs mb-2">{src.description}</p>
                      <code className="text-[#4A5568]/60 text-xs font-mono block">{src.path}</code>
                      {meta && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-[#4A5568]/60">
                          {meta.size != null && <span>{formatBytes(meta.size)}</span>}
                          {meta.hash && <code className="font-mono">{meta.hash.slice(0, 8)}</code>}
                          {meta.modifiedAt && <span>{new Date(meta.modifiedAt).toLocaleDateString()}</span>}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => downloadFile(src.path, src.label, e)}
                      className="p-1.5 rounded-md bg-[#F4F6F9] hover:bg-[#D0D7E3] text-[#4A5568] border border-[#D0D7E3] flex-shrink-0"
                      title="Download"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </button>
              </div>
            )
          })}
          {originalSources.length === 0 && (
            <p className="text-[#4A5568] text-sm text-center py-8">No source files configured.</p>
          )}
        </Tabs.Content>

        {/* Tab 2: Parsed Data */}
        <Tabs.Content value="parsed" className="p-5 space-y-4">
          {parsedDataPaths.map(path => {
            const content = parsedContents[path]
            const isLoading = loadingStates[path]
            return (
              <div key={path} className="border border-[#0A7C59]/30 rounded-lg overflow-hidden">
                <div className="bg-[#0A7C59]/5 px-4 py-2 border-b border-[#0A7C59]/20">
                  <code className="text-xs text-[#0A7C59] font-mono">{path}</code>
                </div>
                <div className="p-4">
                  {isLoading && (
                    <div className="flex items-center gap-2 text-[#4A5568] text-xs">
                      <div className="w-4 h-4 rounded-full border-2 border-[#003781] border-t-transparent animate-spin" />
                      Loading...
                    </div>
                  )}
                  {!isLoading && !content && (
                    <p className="text-[#4A5568] text-sm">Run &apos;Read sources&apos; first to generate normalized data</p>
                  )}
                  {!isLoading && content && (
                    <pre
                      className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-64"
                      dangerouslySetInnerHTML={{ __html: highlightJson(content) }}
                    />
                  )}
                </div>
              </div>
            )
          })}
          {parsedDataPaths.length === 0 && (
            <p className="text-[#4A5568] text-sm text-center py-8">No parsed data paths configured.</p>
          )}
        </Tabs.Content>

        {/* Tab 3: New Version */}
        <Tabs.Content value="generated" className="p-5 space-y-4">
          {generatedFiles.map(file => {
            if (!file.exists) {
              return (
                <div key={file.path} className="border border-dashed border-[#D0D7E3] rounded-lg p-6 bg-[#F4F6F9]">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🔒</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#1A1A2E] text-sm font-medium">{file.label}</span>
                        <FormatBadge format={file.format} />
                      </div>
                      <p className="text-[#4A5568] text-xs mt-1">{file.description}</p>
                    </div>
                  </div>
                  <p className="text-[#4A5568]/60 text-xs font-mono">{file.path}</p>
                  <p className="text-[#4A5568] text-xs mt-2">This file will be created when you complete this step</p>
                </div>
              )
            }

            const content = generatedContents[file.path] ?? ''
            const isLoading = loadingStates[file.path]

            return (
              <div key={file.path} className="border border-[#003781]/20 rounded-lg overflow-hidden">
                <div className="bg-[#003781]/5 px-4 py-3 border-b border-[#003781]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[#1A1A2E] text-sm font-medium">{file.label}</span>
                    <FormatBadge format={file.format} />
                  </div>
                  <button
                    onClick={() => setModal({ path: file.path, name: file.label, format: file.format })}
                    className="text-xs text-[#003781] hover:text-[#0066B2]"
                  >
                    View full →
                  </button>
                </div>
                <div className="p-4">
                  {isLoading && (
                    <div className="flex items-center gap-2 text-[#4A5568] text-xs">
                      <div className="w-4 h-4 rounded-full border-2 border-[#003781] border-t-transparent animate-spin" />
                      Loading...
                    </div>
                  )}
                  {!isLoading && content && (
                    <GeneratedFilePreview file={file} content={content} />
                  )}
                  {!isLoading && !content && (
                    <p className="text-[#4A5568] text-xs">File content unavailable</p>
                  )}
                </div>
              </div>
            )
          })}
          {generatedFiles.length === 0 && (
            <p className="text-[#4A5568] text-sm text-center py-8">No generated files configured.</p>
          )}
        </Tabs.Content>

        {/* Tab 4: Changes */}
        <Tabs.Content value="changes" className="p-5">
          {!hasExistingGenerated ? (
            <div className="text-center py-8">
              <p className="text-[#4A5568]/60 text-sm">No changes to show yet — complete this step first</p>
            </div>
          ) : diffView ? (
            diffView
          ) : (
            <p className="text-[#4A5568] text-sm text-center py-8">No diff configured</p>
          )}
        </Tabs.Content>

        {/* Tab 5: Evidence */}
        <Tabs.Content value="evidence" className="p-5">
          {filteredLog.length === 0 ? (
            <p className="text-[#4A5568] text-sm text-center py-8">
              No evidence recorded yet — run this step to generate evidence
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F6F9]">
                    <th className="px-3 py-2 text-left text-[#1A1A2E] font-medium border border-[#D0D7E3]">Timestamp</th>
                    <th className="px-3 py-2 text-left text-[#1A1A2E] font-medium border border-[#D0D7E3]">Operation</th>
                    <th className="px-3 py-2 text-left text-[#1A1A2E] font-medium border border-[#D0D7E3]">Source</th>
                    <th className="px-3 py-2 text-left text-[#1A1A2E] font-medium border border-[#D0D7E3]">Target</th>
                    <th className="px-3 py-2 text-left text-[#1A1A2E] font-medium border border-[#D0D7E3]">Hash</th>
                    <th className="px-3 py-2 text-left text-[#1A1A2E] font-medium border border-[#D0D7E3]">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.map(entry => (
                    <EvidenceRow key={entry.transformationId} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {modal && (
        <FileContentModal
          isOpen
          onClose={() => setModal(null)}
          filePath={modal.path}
          fileName={modal.name}
          format={modal.format}
        />
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
