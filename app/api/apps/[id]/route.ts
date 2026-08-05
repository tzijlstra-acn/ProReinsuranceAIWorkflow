import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { applications, cloudResources, policyEvaluations, complianceWorkProducts, documents, documentVersions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getLatestPolicyEvaluations } from '@/lib/policy-engine'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const app = db.select().from(applications).where(eq(applications.id, id)).get()
    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const resources = db.select().from(cloudResources).where(eq(cloudResources.applicationId, id)).all()
    const latestEvals = getLatestPolicyEvaluations(id)
    const workProducts = db.select().from(complianceWorkProducts).where(eq(complianceWorkProducts.applicationId, id)).all()
    const docs = db.select().from(documents).where(eq(documents.applicationId, id)).all()
    const allVersions = db.select().from(documentVersions).all()

    return NextResponse.json({
      ...app,
      resources: resources.map(r => ({ ...r, config: JSON.parse(r.config || '{}'), tags: JSON.parse(r.tags || '{}') })),
      policyEvaluations: latestEvals.map(e => ({ ...e, evidence: JSON.parse(e.evidence || '{}') })),
      workProducts: workProducts.map(w => ({ ...w, evidenceIds: JSON.parse(w.evidenceIds || '[]') })),
      documents: docs.map(d => ({
        ...d,
        versions: allVersions.filter(v => v.documentId === d.id).sort((a, b) => (b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1),
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
