import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { portfolioApps } from '@/lib/db/schema'

export async function GET() {
  try {
    const apps = db.select().from(portfolioApps).all()
    return NextResponse.json(apps.map(a => ({
      ...a,
      exceptions: JSON.parse(a.exceptions || '[]'),
    })))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
