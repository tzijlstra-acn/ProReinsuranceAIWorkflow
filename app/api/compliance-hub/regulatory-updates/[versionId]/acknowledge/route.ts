import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulatoryVersions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params

    const version = db
      .select()
      .from(regulatoryVersions)
      .where(eq(regulatoryVersions.id, versionId))
      .get()
    if (!version) {
      return NextResponse.json({ error: 'Regulatory version not found' }, { status: 404 })
    }

    db.update(regulatoryVersions)
      .set({ isActive: true })
      .where(eq(regulatoryVersions.id, versionId))
      .run()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Regulatory Updates Acknowledge]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
