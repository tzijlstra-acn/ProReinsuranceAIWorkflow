import { NextRequest, NextResponse } from 'next/server'
import { getRemediationCase, updateRemediationCaseStatus } from '@/lib/domain/remediation'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = getRemediationCase(id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as { status: string; notes?: string }
    const { status, notes } = body
    if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })

    updateRemediationCaseStatus(id, status, notes)
    const updated = getRemediationCase(id)
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
