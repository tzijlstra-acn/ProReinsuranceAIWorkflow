import { NextRequest, NextResponse } from 'next/server'
import { getRemediationCases, createRemediationCase } from '@/lib/domain/remediation'

export function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId') ?? undefined
    const status = searchParams.get('status') ?? undefined
    const cases = getRemediationCases({ productId, status })
    return NextResponse.json(cases)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      productId: string
      requirementId: string
      sourceId: string
      title: string
      description?: string
      priority?: string
      assignedTo?: string
      dueDate?: string
    }
    const { productId, requirementId, sourceId, title } = body
    if (!productId || !requirementId || !sourceId || !title) {
      return NextResponse.json({ error: 'productId, requirementId, sourceId, and title are required' }, { status: 400 })
    }
    const created = createRemediationCase(body)
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
