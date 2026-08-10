import { NextRequest, NextResponse } from 'next/server'
import { getProductWorkProducts } from '@/lib/domain/product-hub'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const workProducts = getProductWorkProducts(id)
    return NextResponse.json(workProducts)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
