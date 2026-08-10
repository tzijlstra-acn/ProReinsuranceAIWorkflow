import { NextRequest, NextResponse } from 'next/server'
import { getRemediationCase } from '@/lib/domain/remediation'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const c = getRemediationCase(id)
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(c)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
