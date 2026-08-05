import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulationSources, portfolioApps, deployments, documentVersions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'
import { getCurrentState } from '@/lib/state-machine'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { question?: string }
    const question = body.question || 'How does GT fulfil the data backup requirements associated with DORA Article 12?'

    const regulation = db.select().from(regulationSources).where(eq(regulationSources.id, 'DORA-ART-12')).get()
    if (!regulation) return NextResponse.json({ error: 'Regulation not found' }, { status: 404 })

    const fixture = JSON.parse(regulation.fixture)

    const allPortfolioApps = db.select().from(portfolioApps).all()
    const compliantCount = allPortfolioApps.filter(a => a.backupCompliant).length
    const nonCompliantApps = allPortfolioApps.filter(a => !a.backupCompliant)

    const latestDeployment = db.select().from(deployments)
      .where(eq(deployments.applicationId, 'APP-X-001'))
      .orderBy(desc(deployments.simulatedAt))
      .limit(1).get()

    const allVersions = db.select().from(documentVersions).all()
    const sddVersion = allVersions.find(v => v.documentId === 'DOC-SDD-001' && v.status === 'approved')?.version ?? '2.4'
    const omVersion = allVersions.find(v => v.documentId === 'DOC-OM-001' && v.status === 'approved')?.version ?? '1.8'

    const ai = getAiProvider()
    const answer = await ai.answerAuditQuestion(question, {
      regulation: fixture,
      portfolioCompliantCount: compliantCount,
      portfolioTotalCount: allPortfolioApps.length,
      exceptions: nonCompliantApps.map(a => a.name),
      deploymentSha: latestDeployment?.id?.slice(0, 8) ?? 'not-deployed',
      deploymentDate: latestDeployment?.simulatedAt?.split('T')[0] ?? 'pending',
      sddVersion,
      omVersion,
    })

    return NextResponse.json({ question, answer })
  } catch (err) {
    console.error('[Audit Answer]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
