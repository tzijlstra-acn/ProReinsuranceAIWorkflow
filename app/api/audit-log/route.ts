import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { auditEvents } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  try {
    const events = db.select().from(auditEvents).orderBy(desc(auditEvents.timestamp)).limit(100).all()
    return NextResponse.json(events.map(e => ({ ...e, metadata: JSON.parse(e.metadata || '{}') })))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
