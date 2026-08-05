'use client'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

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

// Map real backend operation names to display colors
function opColor(op: string): string {
  if (op.includes('PARSE') || op.includes('EXTRACT')) return '#0A7C59'
  if (op.includes('CREATE') || op.includes('WRITE') || op.includes('GENERATE')) return '#003781'
  if (op.includes('READ') || op.includes('FETCH') || op.includes('INGEST')) return '#0066B2'
  if (op.includes('UPDATE') || op.includes('MERGE')) return '#B45309'
  if (op.includes('EVIDENCE') || op.includes('STORE')) return '#6B21A8'
  return '#4A5568'
}

export function ExecutionTimeline() {
  const [entries, setEntries] = useState<TransformLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/transform-log')
      .then(r => r.json() as Promise<{ entries?: TransformLogEntry[] } | TransformLogEntry[]>)
      .then(data => {
        const list = Array.isArray(data) ? data : (data.entries ?? [])
        const sorted = [...list]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 50)
        setEntries(sorted)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 rounded-full border-4 border-[#003781] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-[#E4002B] text-sm py-4">{error}</div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-[#D0D7E3] rounded-lg p-8 text-center" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <p className="text-[#4A5568] text-sm">
          No operations recorded yet — run the demo to see the execution timeline.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map(entry => {
        const borderColor = opColor(entry.operation)
        return (
          <div
            key={entry.transformationId}
            className="bg-white rounded-lg border border-[#D0D7E3] overflow-hidden flex"
            style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}
          >
            {/* Colored left border */}
            <div className="w-1 flex-shrink-0" style={{ backgroundColor: borderColor }} />

            <div className="p-4 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-1">
                <span
                  className={clsx('text-xs font-semibold')}
                  style={{ color: borderColor }}
                >
                  {entry.operation}
                </span>
                <span className="text-[#4A5568]/60 text-xs flex-shrink-0">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="space-y-0.5 text-xs text-[#4A5568]">
                {entry.sourceFile && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#4A5568]/50">Source:</span>
                    <code className="font-mono truncate">{entry.sourceFile}</code>
                  </div>
                )}
                {entry.targetFile && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#4A5568]/50">Target:</span>
                    <code className="font-mono truncate">{entry.targetFile}</code>
                  </div>
                )}
                {entry.transformationId && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#4A5568]/50">ID:</span>
                    <code className="font-mono">{entry.transformationId.slice(0, 8)}</code>
                  </div>
                )}
                {entry.approvedBy && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#4A5568]/50">Approved by:</span>
                    <span>{entry.approvedBy}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
