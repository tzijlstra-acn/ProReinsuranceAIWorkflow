import { NextResponse } from 'next/server'
import { getDdcrTowers } from '@/lib/domain/ddcr/items'

export async function GET() {
  try {
    const towers = getDdcrTowers()
    return NextResponse.json({ towers })
  } catch (err) {
    console.error('[DDCR Towers GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
