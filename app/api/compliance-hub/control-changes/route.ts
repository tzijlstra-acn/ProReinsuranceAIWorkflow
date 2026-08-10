import { NextRequest, NextResponse } from 'next/server'
import { getControlChanges } from '@/lib/domain/compliance-hub'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const changes = getControlChanges(status)
    return NextResponse.json(changes)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
