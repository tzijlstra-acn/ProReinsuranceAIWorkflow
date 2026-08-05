import { NextResponse } from 'next/server'
import {
  Paths,
  hashFile,
  hashString,
  fileExists,
  writeJsonFile,
  readTransformLog,
} from '@/lib/fs-service'
import { createAuditResponseDocx } from '@/lib/docx-service'
import { getCurrentState } from '@/lib/state-machine'

interface ArtefactEntry {
  name: string
  sourceSystem: string
  sourceFile: string
  sourceVersion: string
  sourceHash: string
  generatedFile: string
  generatedVersion: string
  generatedHash: string
  transformationId: string
  timestamp: string
  approvalStatus: string
  approvedBy: string
}

export async function POST() {
  try {
    const { state } = await getCurrentState()

    // Check all required files exist
    const requiredFiles: Array<{ label: string; path: string }> = [
      { label: 'Guideline v2 DOCX', path: Paths.generated.guidelineV2 },
      { label: 'Controls After CSV', path: Paths.generated.controlsAfter },
      { label: 'backup.tf', path: Paths.infra.backupTf },
      { label: 'Azure Resources After', path: Paths.generated.azureResourcesAfter },
      { label: 'Policy Evaluation After', path: Paths.generated.policyEvalAfter },
      { label: 'SDD v2 DOCX', path: Paths.generated.sddV2 },
      { label: 'Operating Manual v2 DOCX', path: Paths.generated.omV2 },
    ]

    const missing = requiredFiles.filter(f => !fileExists(f.path))
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Missing required artefacts: ${missing.map(f => f.label).join(', ')}`,
        missing: missing.map(f => f.path),
      }, { status: 400 })
    }

    // Read transform log to pull real transformationIds and timestamps
    const log = readTransformLog()
    const findLogEntry = (targetFile: string) =>
      log.find(e => e.targetFile === targetFile) ?? {
        transformationId: 'N/A',
        timestamp: new Date().toISOString(),
        actor: 'system',
      }

    const artefacts: ArtefactEntry[] = [
      {
        name: 'EUR-Lex DORA Article 12 (HTML snapshot)',
        sourceSystem: 'EUR-Lex',
        sourceFile: Paths.raw.eurlex,
        sourceVersion: 'snapshot-2025',
        sourceHash: hashFile(Paths.raw.eurlex),
        generatedFile: Paths.normalized.eurlex,
        generatedVersion: '1',
        generatedHash: fileExists(Paths.normalized.eurlex) ? hashFile(Paths.normalized.eurlex) : '',
        transformationId: findLogEntry(Paths.normalized.eurlex).transformationId,
        timestamp: findLogEntry(Paths.normalized.eurlex).timestamp,
        approvalStatus: 'N/A (source material)',
        approvedBy: 'N/A',
      },
      {
        name: 'Backup & Restore Guideline v2.0 (DOCX)',
        sourceSystem: 'Product Hub (raw)',
        sourceFile: Paths.raw.guidelineV1,
        sourceVersion: 'v1.0',
        sourceHash: hashFile(Paths.raw.guidelineV1),
        generatedFile: Paths.generated.guidelineV2,
        generatedVersion: 'v2.0',
        generatedHash: hashFile(Paths.generated.guidelineV2),
        transformationId: findLogEntry(Paths.generated.guidelineV2).transformationId,
        timestamp: findLogEntry(Paths.generated.guidelineV2).timestamp,
        approvalStatus: 'Approved',
        approvedBy: 'Compliance Review Board',
      },
      {
        name: 'Control Catalog — After (CSV)',
        sourceSystem: 'Control Catalog (CSV)',
        sourceFile: Paths.raw.controlsBefore,
        sourceVersion: 'export-2025-01',
        sourceHash: hashFile(Paths.raw.controlsBefore),
        generatedFile: Paths.generated.controlsAfter,
        generatedVersion: 'export-2025-02',
        generatedHash: hashFile(Paths.generated.controlsAfter),
        transformationId: findLogEntry(Paths.generated.controlsAfter).transformationId,
        timestamp: findLogEntry(Paths.generated.controlsAfter).timestamp,
        approvalStatus: 'Approved (with BR0039-GR)',
        approvedBy: 'Compliance Review Board',
      },
      {
        name: 'Terraform backup.tf (IaC)',
        sourceSystem: 'IaC Repository',
        sourceFile: Paths.infra.mainTf,
        sourceVersion: 'HEAD (before)',
        sourceHash: hashFile(Paths.infra.mainTf),
        generatedFile: Paths.infra.backupTf,
        generatedVersion: hashFile(Paths.infra.backupTf).slice(0, 8),
        generatedHash: hashFile(Paths.infra.backupTf),
        transformationId: findLogEntry(Paths.infra.backupTf).transformationId,
        timestamp: findLogEntry(Paths.infra.backupTf).timestamp,
        approvalStatus: 'Approved (PR merged)',
        approvedBy: 'Platform Engineering Lead',
      },
      {
        name: 'Azure Resources — After State (JSON)',
        sourceSystem: 'Azure Resource Manager (simulated)',
        sourceFile: Paths.raw.azureResourcesBefore,
        sourceVersion: 'before_remediation',
        sourceHash: hashFile(Paths.raw.azureResourcesBefore),
        generatedFile: Paths.generated.azureResourcesAfter,
        generatedVersion: 'after_remediation',
        generatedHash: hashFile(Paths.generated.azureResourcesAfter),
        transformationId: findLogEntry(Paths.generated.azureResourcesAfter).transformationId,
        timestamp: findLogEntry(Paths.generated.azureResourcesAfter).timestamp,
        approvalStatus: 'N/A (generated state)',
        approvedBy: 'N/A',
      },
      {
        name: 'Policy Evaluation Report — After (JSON)',
        sourceSystem: 'Policy Engine',
        sourceFile: Paths.generated.azureResourcesAfter,
        sourceVersion: 'after_remediation',
        sourceHash: hashFile(Paths.generated.azureResourcesAfter),
        generatedFile: Paths.generated.policyEvalAfter,
        generatedVersion: '1',
        generatedHash: hashFile(Paths.generated.policyEvalAfter),
        transformationId: findLogEntry(Paths.generated.policyEvalAfter).transformationId,
        timestamp: findLogEntry(Paths.generated.policyEvalAfter).timestamp,
        approvalStatus: 'N/A (automated evaluation)',
        approvedBy: 'N/A',
      },
      {
        name: 'DDCR Export — After (CSV)',
        sourceSystem: 'DDCR (CSV export)',
        sourceFile: Paths.raw.ddcrBefore,
        sourceVersion: 'export-2025-01',
        sourceHash: hashFile(Paths.raw.ddcrBefore),
        generatedFile: Paths.generated.ddcrAfter,
        generatedVersion: 'export-2025-02',
        generatedHash: hashFile(Paths.generated.ddcrAfter),
        transformationId: findLogEntry(Paths.generated.ddcrAfter).transformationId,
        timestamp: findLogEntry(Paths.generated.ddcrAfter).timestamp,
        approvalStatus: 'N/A (system-generated)',
        approvedBy: 'N/A',
      },
      {
        name: 'System Design Document v1.5 (DOCX)',
        sourceSystem: 'Product Hub (raw)',
        sourceFile: Paths.raw.sddV1,
        sourceVersion: 'v1.4',
        sourceHash: hashFile(Paths.raw.sddV1),
        generatedFile: Paths.generated.sddV2,
        generatedVersion: 'v1.5',
        generatedHash: hashFile(Paths.generated.sddV2),
        transformationId: findLogEntry(Paths.generated.sddV2).transformationId,
        timestamp: findLogEntry(Paths.generated.sddV2).timestamp,
        approvalStatus: 'Approved',
        approvedBy: 'IT Risk & Compliance Lead',
      },
      {
        name: 'Operating Manual v1.2 (DOCX)',
        sourceSystem: 'Product Hub (raw)',
        sourceFile: Paths.raw.omV1,
        sourceVersion: 'v1.1',
        sourceHash: hashFile(Paths.raw.omV1),
        generatedFile: Paths.generated.omV2,
        generatedVersion: 'v1.2',
        generatedHash: hashFile(Paths.generated.omV2),
        transformationId: findLogEntry(Paths.generated.omV2).transformationId,
        timestamp: findLogEntry(Paths.generated.omV2).timestamp,
        approvalStatus: 'Approved',
        approvedBy: 'IT Risk & Compliance Lead',
      },
    ]

    // Build evidence manifest
    const manifest = {
      generatedAt: new Date().toISOString(),
      demoState: state,
      auditQuestion: 'How does GT fulfil the data backup requirements associated with DORA Article 12?',
      artefacts,
      portfolioFulfilmentRate: '21/25 applications',
      outstandingExceptions: [
        { appId: 'APP-004', name: 'Customer Portal', type: 'risk-acceptance', raisedDate: '2024-10-01' },
        { appId: 'APP-008', name: 'Know Your Customer Platform', type: 'risk-acceptance', raisedDate: '2024-10-01' },
        { appId: 'APP-011', name: 'Loan Origination System', type: 'risk-acceptance', raisedDate: '2024-10-01' },
        { appId: 'APP-017', name: 'Securities Custody System', type: 'risk-acceptance', raisedDate: '2024-10-01' },
      ],
      transformationLog: log,
    }

    writeJsonFile(Paths.generated.evidenceManifest, manifest)

    // Generate audit response document text
    const auditText = `# DORA Article 12 — Audit Response
## GT Internal Audit — Backup & Recovery Compliance
## Generated: ${manifest.generatedAt}

> SYNTHETIC DEMONSTRATION DATA — No client data. All entities are fictional.

---

## Audit Question
How does GT fulfil the data backup requirements associated with DORA Article 12?

---

## Executive Summary
GT has implemented a comprehensive backup and recovery framework satisfying DORA Article 12 requirements. Following identification of a geographic redundancy gap, the organisation executed a structured remediation workflow documented in full below.

---

## Regulatory Obligation
DORA Article 12 — Backup policies and procedures, restoration and recovery procedures and methods

Key requirements addressed:
- Article 12(2): Backup policies specifying frequency based on data criticality
- Article 12(3): Annual (now quarterly) backup restoration testing with documented evidence
- Article 12(4): Backup systems geographically separate from primary systems

---

## Evidence Chain

${artefacts.map((a, i) => `### ${i + 1}. ${a.name}
- Source: ${a.sourceSystem} (${a.sourceVersion})
- Source hash: \`${a.sourceHash}\`
- Generated: ${a.generatedVersion}
- Generated hash: \`${a.generatedHash}\`
- Transformation ID: ${a.transformationId}
- Approval: ${a.approvalStatus}${a.approvedBy !== 'N/A' ? ` by ${a.approvedBy}` : ''}
`).join('\n')}

---

## Control Status
- BR0039 (Backup Job Configuration): Active — daily automated backup configured
- BR0039-GR (Geographic Redundancy Verification): Active — POL-BACKUP-001 and POL-BACKUP-002 both Compliant

---

## Portfolio Coverage
${manifest.portfolioFulfilmentRate} applications fulfil DORA Article 12 requirements.

Outstanding exceptions (risk-accepted, pending remediation):
${manifest.outstandingExceptions.map(e => `- ${e.name} (${e.appId}): risk acceptance raised ${e.raisedDate}`).join('\n')}

---

## Transformation Log
${log.length} transformation events recorded. All file hashes independently verifiable.

---

*End of audit response — ${manifest.generatedAt}*`

    await createAuditResponseDocx(Paths.generated.auditResponse, auditText)

    return NextResponse.json({
      ok: true,
      files: {
        evidenceManifest: Paths.generated.evidenceManifest,
        auditResponse: Paths.generated.auditResponse,
        auditResponseHash: hashFile(Paths.generated.auditResponse),
      },
      artefactCount: artefacts.length,
      transformationLogEntries: log.length,
    })
  } catch (err) {
    console.error('[Stage 6 Generate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
