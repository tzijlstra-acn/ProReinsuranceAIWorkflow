import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { policyDefinitions } from '@/lib/db/schema'

export async function GET() {
  try {
    return NextResponse.json(db.select().from(policyDefinitions).all())
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
