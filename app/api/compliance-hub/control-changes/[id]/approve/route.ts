import { NextRequest, NextResponse } from 'next/server'
import { getControlChange, approveControlChange, publishControlChange } from '@/lib/domain/compliance-hub'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { approvedBy?: string; action?: 'approve' | 'publish' }
    const { approvedBy, action } = body

    const change = getControlChange(id)
    if (!change) return NextResponse.json({ error: 'Control change not found' }, { status: 404 })

    if (action === 'approve') {
      if (!approvedBy) {
        return NextResponse.json({ error: 'approvedBy is required for approve action' }, { status: 400 })
      }
      approveControlChange(id, approvedBy)
    } else if (action === 'publish') {
      publishControlChange(id)
    } else {
      return NextResponse.json({ error: 'action must be "approve" or "publish"' }, { status: 400 })
    }

    const updated = getControlChange(id)
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
