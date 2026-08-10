import { NextRequest, NextResponse } from 'next/server'
import { getProduct } from '@/lib/domain/product-hub'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const product = getProduct(id)
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(product)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
