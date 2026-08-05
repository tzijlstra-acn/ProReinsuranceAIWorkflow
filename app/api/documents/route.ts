import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { documents, documentVersions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const docs = db.select().from(documents).where(eq(documents.applicationId, 'APP-X-001')).all()
    const versions = db.select().from(documentVersions).all()
    return NextResponse.json(docs.map(d => ({
      ...d,
      versions: versions
        .filter(v => v.documentId === d.id)
        .sort((a, b) => (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1),
    })))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
