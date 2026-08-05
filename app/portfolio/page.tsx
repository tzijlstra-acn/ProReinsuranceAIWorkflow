'use client'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

interface PortfolioApp {
  id: string
  appId: string
  name: string
  criticality: string
  backupCompliant: boolean
  geoRedundant: boolean
  exceptions: Array<{ type: string; description: string }>
}

export default function PortfolioPage() {
  const [apps, setApps] = useState<PortfolioApp[]>([])
  const [filter, setFilter] = useState<'all' | 'compliant' | 'non-compliant'>('all')

  useEffect(() => {
    fetch('/api/portfolio').then(r => r.json()).then(setApps)
  }, [])

  const filtered = apps.filter(a => {
    if (filter === 'compliant') return a.backupCompliant
    if (filter === 'non-compliant') return !a.backupCompliant
    return true
  })

  const compliantCount = apps.filter(a => a.backupCompliant).length
  const pct = apps.length ? Math.round((compliantCount / apps.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#003781]">Application Portfolio</h1>
        <p className="text-[#4A5568] text-sm mt-1">DORA Article 12 — Backup Compliance Dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
          <p className="text-[#4A5568] text-sm mb-1">Portfolio Size</p>
          <p className="text-3xl font-bold text-[#1A1A2E]">{apps.length}</p>
          <p className="text-[#4A5568] text-xs mt-1">applications</p>
        </div>
        <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
          <p className="text-[#4A5568] text-sm mb-1">Backup Compliant</p>
          <p className="text-3xl font-bold text-[#0A7C59]">{compliantCount}</p>
          <p className="text-[#4A5568] text-xs mt-1">{pct}% of portfolio</p>
        </div>
        <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
          <p className="text-[#4A5568] text-sm mb-1">Exceptions</p>
          <p className="text-3xl font-bold text-[#E4002B]">{apps.length - compliantCount}</p>
          <p className="text-[#4A5568] text-xs mt-1">pending remediation</p>
        </div>
      </div>

      {/* Compliance bar */}
      <div className="bg-white border border-[#D0D7E3] rounded-lg p-5" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#1A1A2E] text-sm font-medium">Overall Backup Compliance</span>
          <span className="text-[#0A7C59] font-semibold">{pct}%</span>
        </div>
        <div className="h-3 bg-[#F4F6F9] rounded-full overflow-hidden border border-[#D0D7E3]">
          <div
            className="h-full bg-gradient-to-r from-[#003781] to-[#0A7C59] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[#4A5568]/70 text-xs mt-2">Target: 100% — DORA Article 12 compliance required</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'compliant', 'non-compliant'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-md border transition-colors',
              filter === f
                ? 'bg-[#003781]/10 text-[#003781] border-[#003781]/30'
                : 'text-[#4A5568] border-[#D0D7E3] hover:border-[#003781]/30'
            )}
          >
            {f === 'all' ? 'All Apps' : f === 'compliant' ? 'Compliant' : 'Non-Compliant'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D0D7E3] rounded-lg overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,56,129,0.08)' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#D0D7E3] bg-[#F4F6F9]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Application</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Criticality</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Backup Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#4A5568] uppercase">Geo-Redundant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D0D7E3]">
            {filtered.map(app => (
              <tr key={app.id} className={clsx(
                'hover:bg-[#F4F6F9] transition-colors',
                app.appId === 'APP-X-001' ? 'bg-[#003781]/5' : ''
              )}>
                <td className="px-4 py-3">
                  <div>
                    <span className="text-[#1A1A2E] text-sm font-medium">{app.name}</span>
                    {app.appId === 'APP-X-001' && (
                      <span className="ml-2 px-1.5 py-0.5 bg-[#003781]/10 text-[#003781] text-xs rounded border border-[#003781]/20">Demo Subject</span>
                    )}
                  </div>
                  <p className="text-[#4A5568]/60 text-xs">{app.appId}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx(
                    'px-2 py-0.5 text-xs rounded border',
                    app.criticality === 'Critical' ? 'bg-[#E4002B]/10 text-[#E4002B] border-[#E4002B]/30' :
                    app.criticality === 'High' ? 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30' :
                    app.criticality === 'Medium' ? 'bg-[#0066B2]/10 text-[#0066B2] border-[#0066B2]/30' :
                    'bg-[#F4F6F9] text-[#4A5568] border-[#D0D7E3]'
                  )}>
                    {app.criticality}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx(
                    'text-sm font-medium',
                    app.backupCompliant ? 'text-[#0A7C59]' : 'text-[#E4002B]'
                  )}>
                    {app.backupCompliant ? 'Compliant' : 'Non-Compliant'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={app.geoRedundant ? 'text-[#0A7C59]' : 'text-[#4A5568]/40'}>
                    {app.geoRedundant ? 'Yes (GRZ)' : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
