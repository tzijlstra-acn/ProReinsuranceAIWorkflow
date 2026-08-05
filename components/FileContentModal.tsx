'use client'
import { useEffect, useState, useCallback } from 'react'

export type FileFormat = 'html' | 'docx' | 'csv' | 'json' | 'tf' | 'jsonl'

interface FileContentModalProps {
  isOpen: boolean
  onClose: () => void
  filePath: string
  fileName: string
  format: FileFormat
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

type TokenType = 'keyword' | 'string' | 'comment' | 'normal'

function tokenizeTfLine(line: string): Array<{ text: string; type: TokenType }> {
  if (line.trimStart().startsWith('#')) {
    return [{ text: line, type: 'comment' }]
  }

  const TF_KEYWORDS = ['resource', 'variable', 'output', 'provider', 'module', 'terraform', 'locals', 'data', 'source', 'backend', 'required_providers']
  const tokens: Array<{ text: string; type: TokenType }> = []
  let i = 0

  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1
      while (j < line.length && line[j] !== '"') j++
      tokens.push({ text: line.slice(i, j + 1), type: 'string' })
      i = j + 1
      continue
    }
    if (line[i] === '#') {
      tokens.push({ text: line.slice(i), type: 'comment' })
      break
    }
    let matched = false
    for (const kw of TF_KEYWORDS) {
      if (line.slice(i, i + kw.length) === kw && (i + kw.length >= line.length || !/\w/.test(line[i + kw.length]))) {
        tokens.push({ text: kw, type: 'keyword' })
        i += kw.length
        matched = true
        break
      }
    }
    if (matched) continue
    const lastToken = tokens[tokens.length - 1]
    if (lastToken?.type === 'normal') {
      lastToken.text += line[i]
    } else {
      tokens.push({ text: line[i], type: 'normal' })
    }
    i++
  }

  return tokens
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

function TfViewer({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="font-mono text-xs overflow-auto">
      {lines.map((line, i) => {
        const tokens = tokenizeTfLine(line)
        return (
          <div key={i} className="flex gap-3 min-h-[1.4rem] hover:bg-[#F4F6F9]">
            <span className="w-10 flex-shrink-0 text-right text-[#D0D7E3] select-none pr-2 border-r border-[#D0D7E3]">
              {i + 1}
            </span>
            <span className="whitespace-pre">
              {tokens.map((tok, j) => {
                if (tok.type === 'keyword') {
                  return <span key={j} style={{ color: '#003781', fontWeight: 'bold' }}>{tok.text}</span>
                }
                if (tok.type === 'string') {
                  return <span key={j} style={{ color: '#0A7C59' }}>{tok.text}</span>
                }
                if (tok.type === 'comment') {
                  return <span key={j} style={{ color: '#9CA3AF', fontStyle: 'italic' }}>{tok.text}</span>
                }
                return <span key={j}>{tok.text}</span>
              })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PlainCodeViewer({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="font-mono text-xs overflow-auto">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-3 min-h-[1.4rem] hover:bg-[#F4F6F9]">
          <span className="w-10 flex-shrink-0 text-right text-[#D0D7E3] select-none pr-2 border-r border-[#D0D7E3]">
            {i + 1}
          </span>
          <span className="whitespace-pre text-[#4A5568]">{line || ' '}</span>
        </div>
      ))}
    </div>
  )
}

function JsonViewer({ content }: { content: string }) {
  const html = highlightJson(content)
  return (
    <pre
      className="text-xs font-mono whitespace-pre-wrap text-[#4A5568] overflow-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function DocxViewer({ content }: { content: string }) {
  const paragraphs = content.split('\n').filter(Boolean)
  return (
    <div className="space-y-2">
      <div className="bg-[#B45309]/10 border border-[#B45309]/30 rounded px-3 py-2 text-xs text-[#B45309]">
        Showing extracted text — download for original DOCX
      </div>
      {paragraphs.map((para, i) => (
        <p key={i} className="text-[#4A5568] text-sm leading-relaxed">{para}</p>
      ))}
    </div>
  )
}

function ContentViewer({ format, content }: { format: FileFormat; content: string }) {
  if (format === 'tf') return <TfViewer content={content} />
  if (format === 'json' || format === 'jsonl') return <JsonViewer content={content} />
  if (format === 'docx') return <DocxViewer content={content} />
  return <PlainCodeViewer content={content} />
}

export function FileContentModal({ isOpen, onClose, filePath, fileName, format }: FileContentModalProps) {
  const [content, setContent] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<FileMetadata | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchContent = useCallback(async () => {
    if (!filePath) return
    setLoadingContent(true)
    setError(null)
    try {
      const [contentRes, filesRes] = await Promise.all([
        fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`),
        fetch('/api/files'),
      ])

      // Content API returns { format, content } envelope
      const contentJson = await contentRes.json() as { format?: string; content?: unknown; error?: string }
      if (contentJson.error) {
        setError(contentJson.error)
      } else {
        const raw = contentJson.content
        if (typeof raw === 'string') {
          setContent(raw)
        } else if (raw !== undefined) {
          setContent(JSON.stringify(raw, null, 2))
        } else {
          setContent('')
        }
      }

      // Files API returns { files: [...] } or [] (stub fallback)
      const filesJson = await filesRes.json() as { files?: FileMetadata[] } | FileMetadata[]
      const files = Array.isArray(filesJson) ? filesJson : (filesJson.files ?? [])
      const meta = files.find(f => f.relativePath === filePath)
      if (meta) setMetadata(meta)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingContent(false)
    }
  }, [filePath])

  useEffect(() => {
    if (isOpen) {
      fetchContent()
    } else {
      setContent(null)
      setMetadata(null)
      setError(null)
    }
  }, [isOpen, fetchContent])

  const handleDownload = () => {
    if (!content) return
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl border border-[#D0D7E3] w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ boxShadow: '0 20px 60px rgba(0,56,129,0.15)' }}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#D0D7E3]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[#1A1A2E] font-semibold text-sm truncate">{fileName}</span>
              <FormatBadge format={format} />
            </div>
            <div className="flex items-center gap-4 text-xs text-[#4A5568]">
              {metadata?.size != null && (
                <span>{formatBytes(metadata.size)}</span>
              )}
              {metadata?.hash && (
                <code className="font-mono">{metadata.hash.slice(0, 8)}</code>
              )}
              {metadata?.modifiedAt && (
                <span>{new Date(metadata.modifiedAt).toLocaleDateString()}</span>
              )}
            </div>
            <code className="text-xs text-[#4A5568]/70 font-mono mt-1 block">{filePath}</code>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-4 p-1.5 rounded-md hover:bg-[#F4F6F9] text-[#4A5568] hover:text-[#1A1A2E] transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-5 min-h-0">
          {loadingContent && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-4 border-[#003781] border-t-transparent animate-spin" />
            </div>
          )}
          {error && !loadingContent && (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-[#E4002B] text-sm">{error}</p>
              <button
                onClick={fetchContent}
                className="px-3 py-1.5 text-xs bg-[#E4002B]/10 hover:bg-[#E4002B]/20 text-[#E4002B] border border-[#E4002B]/30 rounded-md transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {content != null && !loadingContent && !error && (
            <ContentViewer format={format} content={content} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[#D0D7E3]">
          <button
            onClick={handleDownload}
            disabled={!content}
            className="px-4 py-2 text-sm bg-[#F4F6F9] hover:bg-[#D0D7E3] text-[#4A5568] rounded-md border border-[#D0D7E3] transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download raw file
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-[#003781] hover:bg-[#0066B2] text-white rounded-md font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function FormatBadge({ format }: { format: FileFormat }) {
  const FORMAT_COLORS: Record<FileFormat, string> = {
    html: 'bg-[#0066B2]/10 text-[#0066B2] border-[#0066B2]/30',
    docx: 'bg-[#003781]/10 text-[#003781] border-[#003781]/30',
    csv: 'bg-[#0A7C59]/10 text-[#0A7C59] border-[#0A7C59]/30',
    json: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30',
    tf: 'bg-[#6B21A8]/10 text-[#6B21A8] border-[#6B21A8]/30',
    jsonl: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30',
  }
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded border font-mono ${FORMAT_COLORS[format]}`}>
      .{format}
    </span>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
