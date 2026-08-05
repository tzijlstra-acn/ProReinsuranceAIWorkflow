import { NextResponse } from 'next/server'
import { Paths, readJsonFile, fileExists, hashFile } from '@/lib/fs-service'

interface AzureResource {
  type: string
  name: string
  properties: Record<string, unknown>
}

interface AzureResourceSnapshot {
  applicationId: string
  capturedAt: string
  state: string
  resources: AzureResource[]
  backupProtectedItems: unknown[]
  recoveryServicesVaults: unknown[]
}

export async function GET() {
  try {
    if (!fileExists(Paths.raw.azureResourcesBefore)) {
      return NextResponse.json({ error: 'Raw Azure resources file not found' }, { status: 404 })
    }

    const beforeState = readJsonFile<AzureResourceSnapshot>(Paths.raw.azureResourcesBefore)

    // Run policy evaluation against before-state (no DB writes)
    const now = new Date().toISOString()

    const hasVault = beforeState.recoveryServicesVaults.length > 0
    const hasProtectedItem = beforeState.backupProtectedItems.length > 0
    const vault = beforeState.recoveryServicesVaults[0] as Record<string, string> | undefined

    const pol001: {
      policyCode: string
      status: string
      evidence: Record<string, unknown>
    } = {
      policyCode: 'POL-BACKUP-001',
      status: hasVault && hasProtectedItem ? 'Compliant' : 'NonCompliant',
      evidence: { hasVault, hasProtectedItem, evaluatedAt: now },
    }

    const pol002: {
      policyCode: string
      status: string
      evidence: Record<string, unknown>
    } = {
      policyCode: 'POL-BACKUP-002',
      status: vault && vault['storageRedundancy'] === 'GeoRedundant' ? 'Compliant' : (hasVault ? 'NonCompliant' : 'NotEvaluated'),
      evidence: {
        vaultExists: hasVault,
        storageRedundancy: vault?.['storageRedundancy'] ?? null,
        evaluatedAt: now,
      },
    }

    return NextResponse.json({
      evaluatedAt: now,
      applicationId: beforeState.applicationId,
      state: beforeState.state,
      capturedAt: beforeState.capturedAt,
      sourceFile: Paths.raw.azureResourcesBefore,
      sourceHash: hashFile(Paths.raw.azureResourcesBefore),
      resourceCount: beforeState.resources.length,
      evaluations: [pol001, pol002],
      summary: {
        'POL-BACKUP-001': pol001.status,
        'POL-BACKUP-002': pol002.status,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
