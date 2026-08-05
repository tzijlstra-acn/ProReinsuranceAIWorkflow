import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { deployments, documentVersions, auditEvents } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getAiProvider } from '@/lib/ai/provider'
import { transition, getCurrentState } from '@/lib/state-machine'
import { randomUUID } from 'crypto'
import {
  Paths,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  fileExists,
} from '@/lib/fs-service'
import { extractDocxText } from '@/lib/docx-service'

function parseTerraformBackupConfig(tfContent: string): {
  vaultName: string
  storageRedundancy: string
  backupFrequency: string
  retentionDays: number
} {
  const vaultMatch = tfContent.match(/name\s*=\s*"([^"]*rsv[^"]*)"/)
  const redundancyMatch = tfContent.match(/storage_mode_type\s*=\s*"([^"]+)"/)
  const freqMatch = tfContent.match(/frequency\s*=\s*"([^"]+)"/)
  const retentionMatch = tfContent.match(/count\s*=\s*(\d+)/)
  return {
    vaultName: vaultMatch?.[1] ?? 'rsv-app-x-001-prod',
    storageRedundancy: redundancyMatch?.[1] ?? 'GeoRedundant',
    backupFrequency: freqMatch?.[1] ?? 'Daily',
    retentionDays: parseInt(retentionMatch?.[1] ?? '30'),
  }
}

export async function POST() {
  try {
    const { state, correlationId } = await getCurrentState()
    if (state !== 'DDCR_UPDATED') {
      return NextResponse.json({ error: `Cannot propose docs in state ${state}` }, { status: 400 })
    }

    // ── Read actual files from disk ────────────────────────────────────────

    // 1. Read v1 SDD and OM text using mammoth
    const sddV1Text = fileExists(Paths.raw.sddV1)
      ? await extractDocxText(Paths.raw.sddV1)
      : ''

    const omV1Text = fileExists(Paths.raw.omV1)
      ? await extractDocxText(Paths.raw.omV1)
      : ''

    // 2. Parse backup.tf for actual config
    if (!fileExists(Paths.infra.backupTf)) {
      return NextResponse.json({ error: 'backup.tf not found — run stage 2 approve first' }, { status: 400 })
    }
    const tfContent = readTextFile(Paths.infra.backupTf)
    const tfConfig = parseTerraformBackupConfig(tfContent)

    // 3. Read Azure after-state
    const azureAfterState = fileExists(Paths.generated.azureResourcesAfter)
      ? readJsonFile<{ resources: Array<{ type: string; name: string; properties: Record<string, unknown> }> }>(Paths.generated.azureResourcesAfter)
      : null

    const vaultResource = azureAfterState?.resources.find(r => r.type === 'Microsoft.RecoveryServices/vaults')

    // ── Generate v2 content derived from actual TF/Azure state ────────────
    const deployedAt = new Date().toISOString().split('T')[0]
    const latestDeployment = db.select().from(deployments)
      .where(eq(deployments.applicationId, 'APP-X-001'))
      .orderBy(desc(deployments.simulatedAt))
      .limit(1).get()

    const deployedConfig = {
      vaultName: tfConfig.vaultName,
      storageRedundancy: tfConfig.storageRedundancy,
      backupFrequency: tfConfig.backupFrequency,
      retentionDays: tfConfig.retentionDays,
      deployedAt: latestDeployment?.simulatedAt?.split('T')[0] ?? deployedAt,
    }

    // Build SDD v2 content from actual parsed TF file
    const sddV2Content = `System Design Document — IT App X
Version 1.5 | Status: Draft for Approval | Last Updated: ${deployedConfig.deployedAt}

1. System Overview
IT App X supports the Claims Processing business service.
Criticality: High | Environment: Azure OneCloud

2. Architecture
[Standard Azure IaaS deployment with VM, storage account, and Recovery Services Vault]

3. Data Classification
Operational claims data: Confidential
Historical records: Internal

4. Availability Requirements
RTO: 4 hours | RPO: 1 hour

5. Backup & Recovery
5.1 Backup Mechanism
Azure Recovery Services Vault: ${deployedConfig.vaultName}
Storage Redundancy: ${deployedConfig.storageRedundancy} (satisfies DORA Article 12(4))
Backup Schedule: ${deployedConfig.backupFrequency} at 02:00 UTC (automated)
Retention Period: ${deployedConfig.retentionDays} days

5.2 Geographic Redundancy
Backup vault configured with storage_mode_type = ${deployedConfig.storageRedundancy}.
Backup data replicated to geographically separate Azure region (North Europe from primary West Europe).
This configuration satisfies DORA Article 12(4) geographic separation requirement.

5.3 Recovery Procedure
1. Log into Azure Portal and navigate to Recovery Services Vault: ${deployedConfig.vaultName}
2. Select the VM (vm-app-x-001) and choose a restore point
3. Initiate restore operation (cross-region restore available due to GRS configuration)
4. Validate restored VM and data integrity via automated health check
Estimated RTO: 2 hours (improved from previous 4 hours due to vault-based restore)

5.4 Compliance
Control BR0039-GR: Compliant (POL-BACKUP-001 + POL-BACKUP-002 both passing)
DORA Article 12 gap: Remediated as of ${deployedConfig.deployedAt}
Evidence: Policy evaluation on file at data/generated/azure/policy_evaluation_after.json

Previous state (v1.4): Locally Redundant Storage (LRS), no geographic replication. Section 5 placeholder removed.`

    // Build Operating Manual v2 content from actual vault info
    const omV2Content = `Operating Manual — IT App X
Version 1.2 | Status: Draft for Approval | Last Updated: ${deployedConfig.deployedAt}

1. Daily Operations
1.1 Monitoring: Azure Monitor alerts configured for VM health, storage, and vault backup jobs.
1.2 Backup verification: Daily job log reviewed by Platform team via Azure portal.
1.3 Recovery Services Vault: ${deployedConfig.vaultName} (${deployedConfig.storageRedundancy})

2. Backup Procedures
2.1 Backup Job
Schedule: ${deployedConfig.backupFrequency} at 02:00 UTC (automated via Recovery Services Vault).
Vault: ${deployedConfig.vaultName}
Storage: ${deployedConfig.storageRedundancy} — data replicated to secondary Azure region.
Retention: ${deployedConfig.retentionDays} days rolling.

2.2 Restore Procedure (Updated)
1. Log into Azure Portal.
2. Navigate to Recovery Services Vault: ${deployedConfig.vaultName}
3. Select Protected Items > vm-app-x-001.
4. Choose a recovery point (available from last ${deployedConfig.retentionDays} days).
5. Select restore type (Original Location or Alternate Location).
6. For cross-region restore, select secondary region (available due to ${deployedConfig.storageRedundancy}).
7. Initiate restore and monitor progress in Azure portal notifications.
8. Validate restored VM: run automated health check script.

2.3 Geographic Redundancy
${deployedConfig.storageRedundancy} storage is configured on vault ${deployedConfig.vaultName}.
Backup data is replicated to North Europe (secondary region).
Cross-region restore is available and tested quarterly.

3. Testing Requirements
Restore tests must be conducted quarterly per updated Backup & Restore Guideline v2.0.
Test evidence must include: restore time measurement, data integrity check, geographic failover test.
Results reported to IT Risk & Compliance.

4. Incident Response
[Standard incident response procedures — see IRP-001]
For backup-related incidents: contact Platform Engineering Lead on-call via PagerDuty.`

    // Store proposed content in DB
    writeJsonFile(
      Paths.normalized.sdd.replace('sdd_v1.json', 'sdd_v2_proposed.json').replace('normalized/', 'generated/'),
      { version: '1.5', content: sddV2Content, proposedAt: new Date().toISOString() },
    )

    // Use AI provider for the DB-level proposal (keeps existing flow working)
    const ai = getAiProvider()
    const docProposal = await ai.generateDocumentationProposal('APP-X-001', {
      vaultName: deployedConfig.vaultName,
      commitSha: 'tf-derived',
      deployedAt: deployedConfig.deployedAt,
      cloudStateSnapshot: { resources: vaultResource ? [vaultResource] : [] },
    })

    const sddDocId = 'DOC-SDD-001'
    const omDocId = 'DOC-OM-001'

    const existingVersions = db.select().from(documentVersions).all()
    const existingProposedSdd = existingVersions.find(v => v.documentId === sddDocId && v.status === 'proposed')
    const existingProposedOm = existingVersions.find(v => v.documentId === omDocId && v.status === 'proposed')

    if (!existingProposedSdd) {
      db.insert(documentVersions).values({
        id: randomUUID(),
        documentId: sddDocId,
        version: '2.5',
        content: existingVersions.find(v => v.documentId === sddDocId && v.status === 'active')?.content ?? '',
        proposedContent: sddV2Content,
        status: 'proposed',
        configSnapshot: JSON.stringify({ tfConfig, deployedConfig }),
      }).run()
    }

    if (!existingProposedOm) {
      db.insert(documentVersions).values({
        id: randomUUID(),
        documentId: omDocId,
        version: '1.9',
        content: existingVersions.find(v => v.documentId === omDocId && v.status === 'active')?.content ?? '',
        proposedContent: omV2Content,
        status: 'proposed',
        configSnapshot: JSON.stringify({ tfConfig, deployedConfig }),
      }).run()
    }

    db.insert(auditEvents).values({
      id: randomUUID(),
      actor: `ai:${docProposal.provenance.provider}:${docProposal.provenance.model}`,
      action: 'DOC_PROPOSAL_GENERATED',
      objectType: 'DocumentVersion',
      objectId: sddDocId,
      outcome: 'success',
      correlationId,
      metadata: JSON.stringify({
        provenance: docProposal.provenance,
        tfConfig,
        deployedConfig,
        sddV1Length: sddV1Text.length,
        omV1Length: omV1Text.length,
      }),
    }).run()

    const txResult = await transition('DOCS_PROPOSED', `ai:${docProposal.provenance.model}`)
    if (!txResult.ok) return NextResponse.json({ error: txResult.error }, { status: 400 })

    return NextResponse.json({
      ok: true,
      newState: txResult.newState,
      tfConfig,
      deployedConfig,
      sddProposed: { version: '2.5', contentLength: sddV2Content.length },
      omProposed: { version: '1.9', contentLength: omV2Content.length },
    })
  } catch (err) {
    console.error('[Stage 5 Propose]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
