'use client'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

interface TraceNode {
  stage: number
  label: string
  entity: string
  type: string
  status: 'complete' | 'pending'
  data: unknown
}

export default function TraceabilityPage() {
  const [chain, setChain] = useState<TraceNode[]>([])
  const [selected, setSelected] = useState<TraceNode | null>(null)

  useEffect(() => {
    fetch('/api/traceability').then(r => r.json()).then(d => setChain(d.chain ?? []))
  }, [])

  const typeIcon: Record<string, string> = {
    regulation: '⚖️',
    guideline: '📋',
    control: '🛡️',
    iac: '🔧',
    deployment: '🚀',
    policy: '✅',
    ddcr: '📊',
    document: '📝',
    audit: '🔍',
  }

  const typeColor: Record<string, string> = {
    regulation: 'border-[#003781] bg-[#003781]/10',
    guideline: 'border-[#0066B2] bg-[#0066B2]/10',
    control: 'border-blue-500 bg-blue-50',
    iac: 'border-cyan-500 bg-cyan-50',
    deployment: 'border-teal-500 bg-teal-50',
    policy: 'border-[#0A7C59] bg-[#0A7C59]/10',
    ddcr: 'border-green-600 bg-green-50',
    document: 'border-[#B45309] bg-[#B45309]/10',
    audit: 'border-orange-500 bg-orange-50',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#003781]">Traceability Chain</h1>
        <p className="text-[#4A5568] text-sm mt-1">
          DORA Article 12 → Standard → Control → IaC → Deployment → Policy → DDCR → Documentation → Audit Evidence
        </p>
      </div>

      <div className="flex gap-6">
        {/* Chain visualization */}
        <div className="flex-1 space-y-2">
          {chain.map((node, i) => (
            <div key={i} className="flex items-stretch gap-3">
              {/* Connector */}
              <div className="flex flex-col items-center w-8 flex-shrink-0">
                {i > 0 && <div className="w-px flex-1 bg-[#D0D7E3]" />}
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 border-2 z-10',
                  node.status === 'complete' ? 'border-[#0A7C59] bg-[#0A7C59]/10' : 'border-[#D0D7E3] bg-[#F4F6F9]'
                )}>
                  {node.status === 'complete' ? '✓' : typeIcon[node.type] ?? '○'}
                </div>
                {i < chain.length - 1 && <div className="w-px flex-1 bg-[#D0D7E3]" />}
              </div>

              {/* Card */}
              <button
                onClick={() => setSelected(selected?.entity === node.entity ? null : node)}
                className={clsx(
                  'flex-1 text-left p-4 rounded-lg border-2 transition-all mb-2',
                  typeColor[node.type] ?? 'border-[#D0D7E3] bg-white',
                  selected?.entity === node.entity ? 'ring-2 ring-[#003781]' : 'hover:ring-1 hover:ring-[#D0D7E3]',
                  node.status !== 'complete' ? 'opacity-50' : ''
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[#4A5568] text-xs">Stage {node.stage} — {node.label}</span>
                    <p className="text-[#1A1A2E] text-sm font-medium mt-0.5">{node.entity}</p>
                  </div>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded',
                    node.status === 'complete' ? 'text-[#0A7C59]' : 'text-[#4A5568]/60'
                  )}>
                    {node.status}
                  </span>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-96 bg-white border border-[#D0D7E3] rounded-lg p-5 self-start sticky top-20" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#1A1A2E] font-semibold text-sm">{selected.label}</h3>
              <button onClick={() => setSelected(null)} className="text-[#4A5568] hover:text-[#1A1A2E] text-lg">×</button>
            </div>
            <p className="text-[#4A5568] text-sm mb-3">{selected.entity}</p>
            <div className="bg-[#F4F6F9] rounded-md p-3 border border-[#D0D7E3]">
              <pre className="text-xs text-[#4A5568] overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(selected.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
