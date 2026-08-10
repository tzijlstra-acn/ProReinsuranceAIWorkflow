import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import {
  regulatorySources,
  regulatoryRequirements,
  regulatoryVersions,
  internalDocuments,
  requirementDocumentMappings,
  complianceGaps,
  controlChanges,
  regulatoryScanReports,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'

// Map regulation shortCodes to EUR-Lex CELEX numbers
const CELEX_MAP: Record<string, string> = {
  DORA: '32022R2554',
  NIS2: '32022L2555',
  GDPR: '32016R0679',
}

async function queryEurLex(celex: string): Promise<string | null> {
  const sparql = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?work ?date WHERE {
  ?work cdm:resource_legal_based_on_resource_legal <http://publications.europa.eu/resource/celex/${celex}> ;
        cdm:work_date_document ?date .
  FILTER(?date >= "2023-01-01"^^xsd:date)
}
ORDER BY DESC(?date)
LIMIT 15`.trim()

  const url = `https://publications.europa.eu/webapi/rdf/sparql?query=${encodeURIComponent(sparql)}&format=application%2Fsparql-results%2Bjson`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/sparql-results+json' },
    })
    clearTimeout(timer)

    if (!res.ok) return null
    const data = await res.json() as { results?: { bindings?: Array<Record<string, { value: string }>> } }
    const bindings = data?.results?.bindings ?? []
    if (bindings.length === 0) return null

    return bindings
      .map(b => {
        const work = b.work?.value ?? ''
        const date = b.date?.value ?? ''
        const celexMatch = work.match(/celex\/(\w+)/)
        const celexId = celexMatch?.[1] ?? work.split('/').pop() ?? ''
        return `CELEX: ${celexId} | Date: ${date}`
      })
      .join('\n')
  } catch {
    return null
  }
}

export async function POST() {
  const scanId = `SCAN-${Date.now()}`
  const scannedAt = new Date().toISOString()
  let eurLexConnected = false

  try {
    const ai = getAiProvider()
    const sources = db.select().from(regulatorySources).all().filter(s => s.status === 'active')

    const updatesFound: Array<{
      source: string; title: string; date: string; type: string
      celexId?: string; summary: string; fromEurLex: boolean
    }> = []
    const controlsImpacted: Array<{ controlId: string; title: string; requirementId: string | null; reason: string }> = []
    const policiesImpacted: Array<{ source: string; documentId: string; documentTitle: string; reason: string }> = []
    let newVersionsCreated = 0
    let newGapsCreated = 0
    const allImpactedReqIds: string[] = []

    for (const source of sources) {
      const celex = CELEX_MAP[source.shortCode]
      if (!celex) continue

      // All requirements for this source
      const requirements = db
        .select()
        .from(regulatoryRequirements)
        .where(eq(regulatoryRequirements.sourceId, source.id))
        .all()

      // Relevant internal documents via requirement_document_mappings
      const reqIds = requirements.map(r => r.id)
      const mappings = reqIds.length > 0
        ? db.select().from(requirementDocumentMappings).all().filter(m => reqIds.includes(m.requirementId))
        : []
      const relevantDocIds = [...new Set(mappings.map(m => m.documentId))]
      const allDocs = db.select().from(internalDocuments).all()
      const docs = relevantDocIds.length > 0
        ? allDocs.filter(d => relevantDocIds.includes(d.id))
        : allDocs.slice(0, 10)

      // Call EUR-Lex CELLAR SPARQL (real API — may be unreachable)
      const eurLexData = await queryEurLex(celex)
      if (eurLexData) eurLexConnected = true

      // AI intelligence scan — always runs regardless of EUR-Lex availability
      const scanResult = await ai.scanRegulatoryIntelligence(
        source.name,
        source.shortCode,
        celex,
        requirements.map(r => ({ id: r.id, articleRef: r.articleRef, title: r.title, description: r.description })),
        docs.map(d => ({ id: d.id, title: d.title, type: d.type, content: d.content })),
        eurLexData ?? undefined
      )

      const now = new Date().toISOString()

      // Store new regulatory versions (one per update if not already in DB)
      for (const update of scanResult.recentUpdates) {
        const versionKey = update.celexId ?? update.title.slice(0, 60)
        const alreadyExists = db.select().from(regulatoryVersions).all()
          .some(v => v.sourceId === source.id && v.version === versionKey)

        if (!alreadyExists) {
          db.insert(regulatoryVersions).values({
            id: `VER-SCAN-${Date.now()}-${newVersionsCreated}`,
            sourceId: source.id,
            version: versionKey,
            publishedAt: update.date,
            changeType: update.type,
            changeSummary: update.summary,
            isActive: false,
          }).run()
          newVersionsCreated++
        }

        updatesFound.push({
          source: source.shortCode,
          title: update.title,
          date: update.date,
          type: update.type,
          celexId: update.celexId,
          summary: update.summary,
          fromEurLex: update.sourceDataAvailable,
        })
      }

      // Store new compliance gaps
      for (let i = 0; i < scanResult.newGaps.length; i++) {
        const gap = scanResult.newGaps[i]
        // Only insert if requirementId is valid
        if (!requirements.find(r => r.id === gap.requirementId)) continue

        db.insert(complianceGaps).values({
          id: `GAP-SCAN-${Date.now()}-${newGapsCreated}`,
          requirementId: gap.requirementId,
          sourceId: source.id,
          title: gap.title,
          description: gap.description,
          severity: gap.severity,
          gapType: gap.gap_type,
          status: 'OPEN',
          detectedAt: now,
          affectedDocumentIds: '[]',
          aiAnalysis: gap.aiAnalysis,
          createdAt: now,
        }).run()
        newGapsCreated++
      }

      allImpactedReqIds.push(...scanResult.impactedRequirementIds)

      // Collect policies needing review
      for (const policy of scanResult.policiesNeedingReview) {
        policiesImpacted.push({
          source: source.shortCode,
          documentId: policy.documentId,
          documentTitle: policy.documentTitle,
          reason: policy.reason,
        })
      }
    }

    // Cross-reference published controls with impacted requirements
    if (allImpactedReqIds.length > 0) {
      const publishedControls = db.select().from(controlChanges).all()
        .filter(c => c.status === 'PUBLISHED' && allImpactedReqIds.includes(c.requirementId ?? ''))

      for (const ctrl of publishedControls) {
        controlsImpacted.push({
          controlId: ctrl.id,
          title: ctrl.title,
          requirementId: ctrl.requirementId,
          reason: 'Published control may be insufficient for newly identified regulatory requirements — review recommended',
        })
      }
    }

    // Persist scan report
    db.insert(regulatoryScanReports).values({
      id: scanId,
      scannedAt,
      status: 'COMPLETE',
      eurLexConnected,
      sourcesScanned: sources.filter(s => CELEX_MAP[s.shortCode]).length,
      updatesFound: JSON.stringify(updatesFound),
      newVersionsCreated,
      newGapsCreated,
      controlsImpacted: JSON.stringify(controlsImpacted),
      policiesImpacted: JSON.stringify(policiesImpacted),
      aiSummary: `Intelligence scan complete. ${sources.length} regulations scanned · ${updatesFound.length} regulatory updates identified · ${newGapsCreated} new gaps created · EUR-Lex API ${eurLexConnected ? 'connected' : 'unavailable (AI knowledge used)'}.`,
    }).run()

    return NextResponse.json({
      ok: true,
      scanId,
      scannedAt,
      eurLexConnected,
      sourcesScanned: sources.length,
      updatesFound,
      newVersionsCreated,
      newGapsCreated,
      controlsImpacted,
      policiesImpacted,
    })
  } catch (err) {
    try {
      db.insert(regulatoryScanReports).values({
        id: scanId,
        scannedAt,
        status: 'FAILED',
        eurLexConnected,
        sourcesScanned: 0,
        updatesFound: '[]',
        newVersionsCreated: 0,
        newGapsCreated: 0,
        controlsImpacted: '[]',
        policiesImpacted: '[]',
        error: String(err),
      }).run()
    } catch { /* ignore secondary DB failure */ }

    console.error('[Regulatory Intelligence Scan]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const reports = db.select().from(regulatoryScanReports).all()
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
      .slice(0, 10)

    return NextResponse.json({
      reports: reports.map(r => ({
        ...r,
        updatesFound: JSON.parse(r.updatesFound ?? '[]'),
        controlsImpacted: JSON.parse(r.controlsImpacted ?? '[]'),
        policiesImpacted: JSON.parse(r.policiesImpacted ?? '[]'),
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
