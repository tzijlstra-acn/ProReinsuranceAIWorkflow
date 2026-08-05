import { NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { deployments, auditEvents } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { evaluateAllPolicies } from '@/lib/policy-engine'
import { transition, getCurrentState } from '@/lib/state-machine'
import { randomUUID } from 'crypto'
import {
  Paths,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  appendTransformLog,
  hashFile,
  hashString,
  fileExists,
} from '@/lib/fs-service'

interface AzureResourceSnapshot {
  subscriptionId: string
  resourceGroupName: string
  applicationId: string
  capturedAt: string
  state: string
  resources: Array<{
    id: string
    type: string
    name: string
    location: string
    properties: Record<string, unknown>
    tags: Record<string, string>
  }>
  backupProtectedItems: unknown[]
  recoveryServicesVaults: unknown[]
}

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
    if (state !== 'DEPLOYED') {
      return NextResponse.json({ error: `Cannot evaluate policies in state ${state}` }, { status: 400 })
    }

    const timestamp = new Date().toISOString()

    // ── Read before-state from disk ────────────────────────────────────────
    const beforeState = readJsonFile<AzureResourceSnapshot>(Paths.raw.azureResourcesBefore)

    // ── Parse backup.tf to derive after-state ──────────────────────────────
    if (!fileExists(Paths.infra.backupTf)) {
      return NextResponse.json({ error: 'backup.tf not found — run stage 2 approve first' }, { status: 400 })
    }
    const tfContent = readTextFile(Paths.infra.backupTf)
    const tfConfig = parseTerraformBackupConfig(tfContent)

    // Build after-state by cloning before-state and adding new resources
    const afterState: AzureResourceSnapshot = JSON.parse(JSON.stringify(beforeState))
    afterState.state = 'after_remediation'
    afterState.capturedAt = timestamp

    // Update VM to backupEnabled: true
    const vmResource = afterState.resources.find(r => r.type === 'Microsoft.Compute/virtualMachines')
    if (vmResource) {
      vmResource.properties.backupEnabled = true
    }

    // Add RecoveryServicesVault
    afterState.resources.push({
      id: `/subscriptions/${afterState.subscriptionId}/resourceGroups/${afterState.resourceGroupName}/providers/Microsoft.RecoveryServices/vaults/${tfConfig.vaultName}`,
      type: 'Microsoft.RecoveryServices/vaults',
      name: tfConfig.vaultName,
      location: 'westeurope',
      properties: {
        storageRedundancy: tfConfig.storageRedundancy,
        sku: 'Standard',
        provisioningState: 'Succeeded',
      },
      tags: { app_id: 'APP-X-001', control_id: 'BR0039-GR', env: 'production', managed_by: 'terraform' },
    })

    // Add BackupPolicy
    afterState.resources.push({
      id: `/subscriptions/${afterState.subscriptionId}/resourceGroups/${afterState.resourceGroupName}/providers/Microsoft.RecoveryServices/vaults/${tfConfig.vaultName}/backupPolicies/bkp-policy-app-x-001-daily`,
      type: 'Microsoft.RecoveryServices/vaults/backupPolicies',
      name: 'bkp-policy-app-x-001-daily',
      location: 'westeurope',
      properties: {
        backupManagementType: 'AzureIaasVM',
        schedulePolicy: { scheduleRunFrequency: tfConfig.backupFrequency, scheduleRunTime: '02:00' },
        retentionPolicy: { dailySchedule: { retentionDuration: { count: tfConfig.retentionDays, durationType: 'Days' } } },
      },
      tags: { app_id: 'APP-X-001', env: 'production' },
    })

    // Add BackupProtectedItem
    afterState.resources.push({
      id: `/subscriptions/${afterState.subscriptionId}/resourceGroups/${afterState.resourceGroupName}/providers/Microsoft.RecoveryServices/vaults/${tfConfig.vaultName}/backupFabrics/Azure/protectionContainers/IaasVMContainer/protectedItems/vm-app-x-001`,
      type: 'Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers/protectedItems',
      name: 'vm-app-x-001-backup',
      location: 'westeurope',
      properties: {
        protectionStatus: 'Healthy',
        lastBackupStatus: 'Completed',
        virtualMachineId: vmResource?.id ?? '',
        policyName: 'bkp-policy-app-x-001-daily',
      },
      tags: { app_id: 'APP-X-001' },
    })

    // Add populated vaults list
    afterState.recoveryServicesVaults = [{
      name: tfConfig.vaultName,
      storageRedundancy: tfConfig.storageRedundancy,
      backupItems: ['vm-app-x-001'],
    }]

    afterState.backupProtectedItems = [{ vmName: 'vm-app-x-001', policyName: 'bkp-policy-app-x-001-daily', status: 'Protected' }]

    // Write after-state to disk
    writeJsonFile(Paths.generated.azureResourcesAfter, afterState)

    // ── Run policy engine via DB (existing logic) ──────────────────────────
    const latestDeployment = db.select().from(deployments)
      .where(eq(deployments.applicationId, 'APP-X-001'))
      .orderBy(desc(deployments.simulatedAt))
      .limit(1).get()

    const results = evaluateAllPolicies('APP-X-001', latestDeployment?.id, correlationId)

    // ── Write file-system policy evaluation result ─────────────────────────
    const backupResults = results.filter(r => r.policyCode.startsWith('POL-BACKUP'))
    const policyEvalAfter = {
      evaluatedAt: timestamp,
      applicationId: 'APP-X-001',
      sourceFile: Paths.generated.azureResourcesAfter,
      tfConfig,
      evaluations: results.map(r => ({
        policyCode: r.policyCode,
        status: r.result.status,
        evidence: r.result.evidence,
      })),
      backupCompliant: backupResults.every(r => r.result.status === 'Compliant'),
    }
    writeJsonFile(Paths.generated.policyEvalAfter, policyEvalAfter)

    // Append transform log entries
    appendTransformLog({
      timestamp,
      transformationId: randomUUID(),
      sourceSystem: 'Azure Resource Manager (simulated)',
      sourceFile: Paths.raw.azureResourcesBefore,
      sourceVersion: 'before_remediation',
      sourceHash: hashFile(Paths.raw.azureResourcesBefore),
      targetFile: Paths.generated.azureResourcesAfter,
      targetVersion: 'after_remediation',
      targetHash: hashString(JSON.stringify(afterState)),
      operation: 'AZURE_STATE_PROJECTION',
      actor: 'system:policy-engine',
      correlationId,
    })

    appendTransformLog({
      timestamp,
      transformationId: randomUUID(),
      sourceSystem: 'Policy Engine',
      sourceFile: Paths.generated.azureResourcesAfter,
      sourceVersion: 'after_remediation',
      sourceHash: hashString(JSON.stringify(afterState)),
      targetFile: Paths.generated.policyEvalAfter,
      targetVersion: '1',
      targetHash: hashString(JSON.stringify(policyEvalAfter)),
      operation: 'POLICY_EVALUATE',
      actor: 'system:policy-engine',
      correlationId,
    })

    db.insert(auditEvents).values({
      id: randomUUID(),
      actor: 'policy-engine',
      action: 'POLICY_EVALUATION_COMPLETE',
      objectType: 'Application',
      objectId: 'APP-X-001',
      outcome: 'success',
      correlationId,
      metadata: JSON.stringify({
        results: results.map(r => ({ policyCode: r.policyCode, status: r.result.status })),
        azureResourcesAfterFile: Paths.generated.azureResourcesAfter,
        policyEvalAfterFile: Paths.generated.policyEvalAfter,
        tfConfig,
      }),
    }).run()

    const txResult = await transition('POLICY_VERIFIED', 'system:policy-engine')
    if (!txResult.ok) return NextResponse.json({ error: txResult.error }, { status: 400 })

    return NextResponse.json({
      ok: true,
      newState: txResult.newState,
      results,
      tfConfig,
      beforeState: { resources: beforeState.resources.length, vaults: 0 },
      afterState: {
        resources: afterState.resources.length,
        vaults: afterState.recoveryServicesVaults.length,
        backupItems: afterState.backupProtectedItems.length,
      },
      files: {
        azureResourcesAfter: Paths.generated.azureResourcesAfter,
        policyEvalAfter: Paths.generated.policyEvalAfter,
      },
    })
  } catch (err) {
    console.error('[Stage 3 Evaluate]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
