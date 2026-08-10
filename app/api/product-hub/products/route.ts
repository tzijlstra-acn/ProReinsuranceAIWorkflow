import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/domain/product-hub'

export function GET() {
  try {
    const prods = getProducts()
    return NextResponse.json(prods)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
