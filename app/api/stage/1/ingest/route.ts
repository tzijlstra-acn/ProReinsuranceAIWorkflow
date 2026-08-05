import { NextResponse } from 'next/server'
import { extractDoraArticle12 } from '@/lib/html-service'
import { extractDocxText } from '@/lib/docx-service'
import { parseCsv } from '@/lib/csv-service'
import {
  Paths,
  writeJsonFile,
  hashFile,
  appendTransformLog,
  hashString,
  readJsonFile,
} from '@/lib/fs-service'
import { randomUUID } from 'crypto'

export async function POST() {
  const correlationId = randomUUID()
  const timestamp = new Date().toISOString()
  const results: Array<{ type: string; file: string }> = []

  try {
    // 1. Parse EUR-Lex HTML
    const eurlex = extractDoraArticle12(Paths.raw.eurlex)
    const eurlexNorm = {
      source: Paths.raw.eurlex,
      sourceHash: hashFile(Paths.raw.eurlex),
      extractedAt: timestamp,
      articleId: 'Article 12',
      title: 'Backup policies and procedures, restoration and recovery procedures and methods',
      text: eurlex.text,
      paragraphs: eurlex.paragraphs,
    }
    writeJsonFile(Paths.normalized.eurlex, eurlexNorm)
    appendTransformLog({
      timestamp,
      transformationId: randomUUID(),
      sourceSystem: 'EUR-Lex (local snapshot)',
      sourceFile: Paths.raw.eurlex,
      sourceVersion: 'snapshot-2025',
      sourceHash: hashFile(Paths.raw.eurlex),
      targetFile: Paths.normalized.eurlex,
      targetVersion: '1',
      targetHash: hashString(JSON.stringify(eurlexNorm)),
      operation: 'HTML_PARSE',
      actor: 'system',
      correlationId,
    })
    results.push({ type: 'eurlex', file: Paths.normalized.eurlex })

    // 2. Parse Guideline v1 DOCX
    const guidelineText = await extractDocxText(Paths.raw.guidelineV1)
    const guidelineNorm = {
      source: Paths.raw.guidelineV1,
      sourceHash: hashFile(Paths.raw.guidelineV1),
      extractedAt: timestamp,
      version: '1.0',
      text: guidelineText,
      sections: guidelineText.split('\n').filter((l) => l.trim()),
    }
    writeJsonFile(Paths.normalized.guideline, guidelineNorm)
    appendTransformLog({
      timestamp,
      transformationId: randomUUID(),
      sourceSystem: 'Product Hub (raw)',
      sourceFile: Paths.raw.guidelineV1,
      sourceVersion: 'v1.0',
      sourceHash: hashFile(Paths.raw.guidelineV1),
      targetFile: Paths.normalized.guideline,
      targetVersion: '1',
      targetHash: hashString(JSON.stringify(guidelineNorm)),
      operation: 'DOCX_EXTRACT',
      actor: 'system',
      correlationId,
    })
    results.push({ type: 'guideline', file: Paths.normalized.guideline })

    // 3. Parse Control CSV
    const controls = parseCsv<Record<string, string>>(Paths.raw.controlsBefore)
    const controlsNorm = {
      source: Paths.raw.controlsBefore,
      sourceHash: hashFile(Paths.raw.controlsBefore),
      extractedAt: timestamp,
      controls,
    }
    writeJsonFile(Paths.normalized.controls, controlsNorm)
    appendTransformLog({
      timestamp,
      transformationId: randomUUID(),
      sourceSystem: 'Control Catalog (CSV)',
      sourceFile: Paths.raw.controlsBefore,
      sourceVersion: 'export-2025-01',
      sourceHash: hashFile(Paths.raw.controlsBefore),
      targetFile: Paths.normalized.controls,
      targetVersion: '1',
      targetHash: hashString(JSON.stringify(controlsNorm)),
      operation: 'CSV_PARSE',
      actor: 'system',
      correlationId,
    })
    results.push({ type: 'controls', file: Paths.normalized.controls })

    // 4. Parse Azure policy definitions
    const policyDef = readJsonFile<unknown>(Paths.raw.azurePolicyDef)
    const geoPolicyDef = readJsonFile<unknown>(Paths.raw.azureGeoPolicyDef)
    const azurePolicyNorm = {
      source: [Paths.raw.azurePolicyDef, Paths.raw.azureGeoPolicyDef],
      extractedAt: timestamp,
      policies: [policyDef, geoPolicyDef],
    }
    writeJsonFile(Paths.normalized.azurePolicy, azurePolicyNorm)
    results.push({ type: 'azurePolicy', file: Paths.normalized.azurePolicy })

    // 5. Parse Azure resources before
    const azureResourcesBefore = readJsonFile<unknown>(Paths.raw.azureResourcesBefore)
    const azureResourcesNorm = {
      source: Paths.raw.azureResourcesBefore,
      sourceHash: hashFile(Paths.raw.azureResourcesBefore),
      extractedAt: timestamp,
      state: azureResourcesBefore,
    }
    writeJsonFile(Paths.normalized.azureResources, azureResourcesNorm)
    results.push({ type: 'azureResources', file: Paths.normalized.azureResources })

    // 6. Parse DDCR baseline CSV
    const ddcr = parseCsv<Record<string, string>>(Paths.raw.ddcrBefore)
    const ddcrNorm = {
      source: Paths.raw.ddcrBefore,
      sourceHash: hashFile(Paths.raw.ddcrBefore),
      extractedAt: timestamp,
      records: ddcr,
    }
    writeJsonFile(Paths.normalized.ddcr, ddcrNorm)
    results.push({ type: 'ddcr', file: Paths.normalized.ddcr })

    // 7. Parse SDD v1
    const sddText = await extractDocxText(Paths.raw.sddV1)
    const sddNorm = {
      source: Paths.raw.sddV1,
      sourceHash: hashFile(Paths.raw.sddV1),
      extractedAt: timestamp,
      version: '1.4',
      text: sddText,
      sections: sddText.split('\n').filter((l) => l.trim()),
    }
    writeJsonFile(Paths.normalized.sdd, sddNorm)
    results.push({ type: 'sdd', file: Paths.normalized.sdd })

    // 8. Parse Operating Manual v1
    const omText = await extractDocxText(Paths.raw.omV1)
    const omNorm = {
      source: Paths.raw.omV1,
      sourceHash: hashFile(Paths.raw.omV1),
      extractedAt: timestamp,
      version: '1.1',
      text: omText,
      sections: omText.split('\n').filter((l) => l.trim()),
    }
    writeJsonFile(Paths.normalized.om, omNorm)
    results.push({ type: 'om', file: Paths.normalized.om })

    return NextResponse.json({ ok: true, correlationId, results })
  } catch (err) {
    console.error('[Stage 1 Ingest]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
