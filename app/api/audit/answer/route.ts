import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { regulationSources, portfolioApps, deployments, documentVersions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'
import { getCurrentState } from '@/lib/state-machine'
import { Paths, fileExists, readTransformLog, readJsonFile } from '@/lib/fs-service'

// ─── Citation definitions ─────────────────────────────────────────────────────

const CITATION_DEFS: Array<{
  pathKey: string
  label: string
  path: string
  format: string
  fsPath: string
}> = [
  {
    pathKey: 'guidelineV2',
    label: 'Backup & Restore Guideline v2',
    path: 'data/generated/guidelines/Backup_Restore_Guideline_v2.docx',
    format: 'docx',
    fsPath: Paths.generated.guidelineV2,
  },
  {
    pathKey: 'controlsAfter',
    label: 'Control Catalogue — Updated',
    path: 'data/generated/control-catalog/control_activities_after.csv',
    format: 'csv',
    fsPath: Paths.generated.controlsAfter,
  },
  {
    pathKey: 'backupTf',
    label: 'Backup Infrastructure (Terraform)',
    path: 'infra/it-app-x/backup.tf',
    format: 'tf',
    fsPath: Paths.generated.backupTf,
  },
  {
    pathKey: 'policyEvalAfter',
    label: 'Policy Evaluation Result',
    path: 'data/generated/azure/policy_evaluation_after.json',
    format: 'json',
    fsPath: Paths.generated.policyEvalAfter,
  },
  {
    pathKey: 'ddcrAfter',
    label: 'DDCR Export — Updated',
    path: 'data/generated/ddcr/ddcr_export_after.csv',
    format: 'csv',
    fsPath: Paths.generated.ddcrAfter,
  },
  {
    pathKey: 'sddV2',
    label: 'System Design Document v2',
    path: 'data/generated/product-hub/IT_App_X_SDD_v2.docx',
    format: 'docx',
    fsPath: Paths.generated.sddV2,
  },
  {
    pathKey: 'omV2',
    label: 'Operating Manual v2',
    path: 'data/generated/product-hub/IT_App_X_Operating_Manual_v2.docx',
    format: 'docx',
    fsPath: Paths.generated.omV2,
  },
  {
    pathKey: 'auditResponse',
    label: 'DORA Article 12 Audit Response',
    path: 'data/generated/evidence/DORA_Article_12_Audit_Response.docx',
    format: 'docx',
    fsPath: Paths.generated.auditResponse,
  },
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { question?: string }
    const question = body.question || 'How does IT App X fulfil the DORA Article 12 backup requirements?'

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

    // ── Build citations from actually-existing files ─────────────────────────
    const citations = CITATION_DEFS
      .filter(c => fileExists(c.fsPath))
      .map(c => ({ label: c.label, path: c.path, format: c.format }))

    // ── Transform log summary (last 10 entries) ──────────────────────────────
    const transformLog = readTransformLog()
    const recentLog = transformLog.slice(-10)
    const transformSummary = recentLog.length > 0
      ? recentLog.map(e =>
          `  [${e.timestamp.slice(0, 10)}] ${e.operation}: ${e.sourceFile} → ${e.targetFile} (actor: ${e.actor})`
        ).join('\n')
      : '  No transformation log entries yet.'

    // ── Evidence manifest summary ────────────────────────────────────────────
    let manifestSummary = ''
    if (fileExists(Paths.generated.evidenceManifest)) {
      try {
        const manifest = readJsonFile<Record<string, unknown>>(Paths.generated.evidenceManifest)
        const entries = Array.isArray(manifest.entries) ? manifest.entries : []
        manifestSummary = `Evidence manifest present with ${entries.length} entries.`
      } catch {
        manifestSummary = 'Evidence manifest present (could not parse).'
      }
    }

    // ── Build context for AI prompt ──────────────────────────────────────────
    const evidenceContext = citations.length > 0
      ? `\n\nGenerated evidence files available:\n${citations.map(c => `  - ${c.label} (${c.format}): ${c.path}`).join('\n')}`
      : '\n\nNo generated evidence files found yet — the pipeline may not have run.'

    const transformContext = `\n\nTransformation log (last ${recentLog.length} entries):\n${transformSummary}`
    const manifestContext = manifestSummary ? `\n\n${manifestSummary}` : ''

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
      additionalContext: evidenceContext + transformContext + manifestContext,
    })

    return NextResponse.json({ question, answer, citations })
  } catch (err) {
    console.error('[Audit Answer]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
