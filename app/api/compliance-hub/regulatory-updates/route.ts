import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulatoryVersions, regulatorySources } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const pendingVersions = db
      .select()
      .from(regulatoryVersions)
      .where(eq(regulatoryVersions.isActive, false))
      .all()

    const pending = pendingVersions.map(v => {
      const source = db
        .select()
        .from(regulatorySources)
        .where(eq(regulatorySources.id, v.sourceId))
        .get()

      return {
        id: v.id,
        sourceId: v.sourceId,
        shortCode: source?.shortCode ?? '',
        sourceName: source?.name ?? '',
        version: v.version,
        publishedAt: v.publishedAt,
        changeType: v.changeType,
        changeSummary: v.changeSummary ?? '',
      }
    })

    return NextResponse.json({ pending })
  } catch (err) {
    console.error('[Regulatory Updates GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
