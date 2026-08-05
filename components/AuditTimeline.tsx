'use client'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

interface AuditEvent {
  id: string
  timestamp: string
  actor: string
  action: string
  objectType: string
  outcome: string
  metadata: Record<string, unknown>
}

export function AuditTimeline() {
  const [events, setEvents] = useState<AuditEvent[]>([])

  useEffect(() => {
    const fetchEvents = () => {
      fetch('/api/audit-log')
        .then(r => r.json())
        .then(data => setEvents(Array.isArray(data) ? data.slice(0, 15) : []))
        .catch(() => {})
    }
    fetchEvents()
    const interval = setInterval(fetchEvents, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="w-72 bg-white border-l border-[#D0D7E3] h-full min-h-screen p-4 flex flex-col">
      <h3 className="text-[#4A5568] text-xs font-semibold uppercase tracking-wider mb-4">Audit Timeline</h3>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {events.length === 0 && (
          <p className="text-[#4A5568]/60 text-xs">No events yet — run the demo</p>
        )}
        {events.map(event => (
          <div key={event.id} className="flex gap-2">
            <div className="flex flex-col items-center">
              <div className={clsx(
                'w-2 h-2 rounded-full mt-1 flex-shrink-0',
                event.outcome === 'success' ? 'bg-[#0A7C59]' : 'bg-[#E4002B]'
              )} />
              <div className="w-px flex-1 bg-[#D0D7E3] mt-1" />
            </div>
            <div className="pb-3 min-w-0">
              <p className="text-[#1A1A2E] text-xs font-medium truncate">{event.action.replace(/_/g, ' ').toLowerCase()}</p>
              <p className="text-[#4A5568] text-xs">{event.actor}</p>
              <p className="text-[#4A5568]/60 text-xs">{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
