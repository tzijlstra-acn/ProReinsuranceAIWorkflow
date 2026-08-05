'use client'
import { useEffect, useState } from 'react'
import { FileContentModal, type FileFormat } from './FileContentModal'

interface FileMetadata {
  relativePath: string
  exists: boolean
  format: string
  size: number
  hash: string
  modifiedAt: string
  layer: 'raw' | 'normalized' | 'generated' | 'evidence' | 'infra'
  status: 'baseline' | 'generated'
}

const LAYER_LABELS: Record<FileMetadata['layer'], string> = {
  raw: 'Raw Sources',
  normalized: 'Parsed Data',
  generated: 'Generated',
  evidence: 'Evidence',
  infra: 'Infrastructure',
}

const FORMAT_COLORS: Record<string, string> = {
  html: 'bg-[#0066B2]/10 text-[#0066B2] border-[#0066B2]/30',
  docx: 'bg-[#003781]/10 text-[#003781] border-[#003781]/30',
  csv: 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30',
  json: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30',
  tf: 'bg-[#6B21A8]/10 text-[#6B21A8] border-[#6B21A8]/30',
  jsonl: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatIcon(format: string): string {
  if (format === 'docx') return '📄'
  if (format === 'csv') return '📊'
  if (format === 'html') return '🌐'
  if (format === 'tf') return '🔧'
  if (format === 'json' || format === 'jsonl') return '{}'
  return '📄'
}

function inferSource(path: string): string {
  if (path.includes('eurlex')) return 'EUR-Lex'
  if (path.includes('guidelines') || path.includes('guideline')) return 'Guidelines'
  if (path.includes('azure')) return 'Azure'
  if (path.includes('ddcr')) return 'DDCR'
  if (path.includes('infra') || path.includes('.tf')) return 'IaC'
  return ''
}

function FormatBadge({ format }: { format: string }) {
  const cls = FORMAT_COLORS[format] ?? 'bg-[#F4F6F9] text-[#4A5568] border-[#D0D7E3]'
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded border font-mono ${cls}`}>.{format}</span>
  )
}

export function FileExplorer() {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLayer, setActiveLayer] = useState<FileMetadata['layer']>('raw')
  const [modal, setModal] = useState<{ file: FileMetadata } | null>(null)

  useEffect(() => {
    fetch('/api/files')
      .then(r => r.json() as Promise<{ files?: FileMetadata[] } | FileMetadata[]>)
      .then(data => {
        const files = Array.isArray(data) ? data : (data.files ?? [])
        setFiles(files)
        if (files.length > 0 && !files.find(f => f.layer === 'raw')) {
          setActiveLayer(files[0].layer)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const layers: FileMetadata['layer'][] = ['raw', 'normalized', 'generated', 'evidence', 'infra']

  const countByLayer = (layer: FileMetadata['layer']) => files.filter(f => f.layer === layer).length

  const activeFiles = files.filter(f => f.layer === activeLayer)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-4 border-[#003781] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#D0D7E3] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
      <div className="grid grid-cols-4">
        {/* Left sidebar */}
        <div className="col-span-1 border-r border-[#D0D7E3] py-3">
          <p className="px-4 text-xs font-semibold text-[#4A5568] uppercase mb-2">Layers</p>
          {layers.map(layer => {
            const count = countByLayer(layer)
            const isActive = layer === activeLayer
            return (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#003781]/10 text-[#003781] border-l-2 border-[#003781]'
                    : 'text-[#4A5568] hover:text-[#003781] hover:bg-[#F4F6F9]'
                }`}
              >
                <span className="font-medium">{LAYER_LABELS[layer]}</span>
                <span className="text-xs text-[#4A5568]/60 ml-2">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Right panel */}
        <div className="col-span-3">
          {files.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#4A5568] text-sm">
                No files found. The backend file system API returns an empty list — backend implementation in progress.
              </p>
            </div>
          ) : activeFiles.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#4A5568] text-sm">No files in {LAYER_LABELS[activeLayer]}.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#D0D7E3]">
              {activeFiles.map(file => {
                const fileName = file.relativePath.split('/').pop() ?? file.relativePath
                const source = inferSource(file.relativePath)
                return (
                  <button
                    key={file.relativePath}
                    onClick={() => setModal({ file })}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[#F4F6F9] transition-colors text-left"
                  >
                    {/* Format icon */}
                    <span className="text-lg flex-shrink-0 w-6 text-center">
                      {formatIcon(file.format)}
                    </span>

                    {/* File name + path */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[#1A1A2E] text-sm font-medium">{fileName}</span>
                        <FormatBadge format={file.format} />
                        {source && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-[#F4F6F9] text-[#4A5568] border border-[#D0D7E3]">
                            {source}
                          </span>
                        )}
                      </div>
                      <code className="text-[#4A5568]/60 text-xs font-mono truncate block">{file.relativePath}</code>
                    </div>

                    {/* Meta */}
                    <div className="flex-shrink-0 flex items-center gap-3 text-xs text-[#4A5568]/60">
                      {file.modifiedAt && (
                        <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
                      )}
                      {file.hash && (
                        <code className="font-mono">{file.hash.slice(0, 8)}</code>
                      )}
                      {file.size != null && (
                        <span>{formatBytes(file.size)}</span>
                      )}
                    </div>

                    {/* Status badges */}
                    <div className="flex-shrink-0 flex items-center gap-1.5">
                      {file.status === 'baseline' ? (
                        <span className="px-2 py-0.5 text-xs rounded border bg-[#F4F6F9] text-[#4A5568] border-[#D0D7E3]">
                          BASELINE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded border bg-[#003781]/10 text-[#003781] border-[#003781]/30">
                          GENERATED
                        </span>
                      )}
                      {file.status === 'generated' && !file.exists && (
                        <span className="px-2 py-0.5 text-xs rounded border text-[#E4002B] border-[#E4002B]/30">
                          NOT YET CREATED
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <FileContentModal
          isOpen
          onClose={() => setModal(null)}
          filePath={modal.file.relativePath}
          fileName={modal.file.relativePath.split('/').pop() ?? modal.file.relativePath}
          format={(modal.file.format as FileFormat)}
        />
      )}
    </div>
  )
}
