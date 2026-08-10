import { NextResponse } from 'next/server'
import { getDdcrSummary } from '@/lib/domain/ddcr/items'

export async function GET() {
  try {
    const summary = getDdcrSummary()
    return NextResponse.json(summary)
  } catch (err) {
    console.error('[DDCR Summary GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
