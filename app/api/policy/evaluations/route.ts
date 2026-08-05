import { NextResponse } from 'next/server'
import { getLatestPolicyEvaluations } from '@/lib/policy-engine'

export async function GET() {
  try {
    const latest = getLatestPolicyEvaluations('APP-X-001')
    return NextResponse.json(latest.map(e => ({ ...e, evidence: JSON.parse(e.evidence || '{}') })))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
