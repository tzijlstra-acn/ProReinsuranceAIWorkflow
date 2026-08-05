import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { applications, cloudResources } from '@/lib/db/schema'

export async function GET() {
  try {
    const apps = db.select().from(applications).all()
    const allResources = db.select().from(cloudResources).all()

    return NextResponse.json(apps.map(app => ({
      ...app,
      resources: allResources
        .filter(r => r.applicationId === app.id)
        .map(r => ({ ...r, config: JSON.parse(r.config || '{}'), tags: JSON.parse(r.tags || '{}') })),
    })))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
