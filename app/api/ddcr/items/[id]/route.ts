import { NextRequest, NextResponse } from 'next/server'
import { getDdcrItem } from '@/lib/domain/ddcr/items'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { item, history } = getDdcrItem(id)
    if (!item) {
      return NextResponse.json({ error: 'DDCR item not found' }, { status: 404 })
    }
    return NextResponse.json({ item, history })
  } catch (err) {
    console.error('[DDCR Item GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
