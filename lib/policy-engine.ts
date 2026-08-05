import { db } from './db/index'
import { cloudResources, policyEvaluations, auditEvents } from './db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export type PolicyStatus = 'Compliant' | 'NonCompliant' | 'NotEvaluated'

export interface PolicyResult {
  status: PolicyStatus
  evidence: Record<string, unknown>
}

export interface AppCloudState {
  applicationId: string
  resources: Array<{
    id: string
    type: string
    name: string
    config: Record<string, unknown>
    tags: Record<string, unknown>
  }>
}

export function loadAppCloudState(applicationId: string): AppCloudState {
  const resources = db.select().from(cloudResources).where(eq(cloudResources.applicationId, applicationId)).all()
  return {
    applicationId,
    resources: resources.map(r => ({
      id: r.id,
      type: r.type,
      name: r.name,
      config: JSON.parse(r.config || '{}'),
      tags: JSON.parse(r.tags || '{}'),
    })),
  }
}

export function evaluatePolicy(policyCode: string, appState: AppCloudState): PolicyResult {
  const now = new Date().toISOString()

  switch (policyCode) {
    case 'POL-BACKUP-001': {
      const hasVault = appState.resources.some(r => r.type === 'RecoveryVault')
      const hasProtectedItem = appState.resources.some(r => r.type === 'BackupProtectedItem')
      return {
        status: hasVault && hasProtectedItem ? 'Compliant' : 'NonCompliant',
        evidence: { hasVault, hasProtectedItem, evaluatedAt: now },
      }
    }

    case 'POL-BACKUP-002': {
      const vault = appState.resources.find(r => r.type === 'RecoveryVault')
      const isGeoRedundant = vault?.config?.storageRedundancy === 'GeoRedundant'
      return {
        status: vault && isGeoRedundant ? 'Compliant' : (vault ? 'NonCompliant' : 'NotEvaluated'),
        evidence: {
          vaultExists: !!vault,
          vaultName: vault?.name ?? null,
          storageRedundancy: vault?.config?.storageRedundancy ?? null,
          evaluatedAt: now,
        },
      }
    }

    case 'POL-EDR-001': {
      // Always NonCompliant in demo — no EDR resource type
      const hasEDRAgent = appState.resources.some(r => r.type === 'EDRAgent')
      return {
        status: 'NonCompliant',
        evidence: { hasEDRAgent, note: 'EDR agent not deployed in this environment (demo scope)', evaluatedAt: now },
      }
    }

    case 'POL-ENC-001': {
      const vm = appState.resources.find(r => r.type === 'VM')
      const encryptionEnabled = !!(vm?.config?.encryptionEnabled)
      return {
        status: vm ? (encryptionEnabled ? 'Compliant' : 'NonCompliant') : 'NotEvaluated',
        evidence: { vmExists: !!vm, encryptionEnabled, evaluatedAt: now },
      }
    }

    case 'POL-LOG-001': {
      const vm = appState.resources.find(r => r.type === 'VM')
      const diagnosticLogging = !!(vm?.config?.diagnosticLogging)
      return {
        status: vm ? (diagnosticLogging ? 'Compliant' : 'NonCompliant') : 'NotEvaluated',
        evidence: { vmExists: !!vm, diagnosticLogging, evaluatedAt: now },
      }
    }

    default:
      return { status: 'NotEvaluated', evidence: { reason: `Unknown policy: ${policyCode}` } }
  }
}

export function evaluateAllPolicies(
  applicationId: string,
  deploymentId?: string,
  correlationId?: string
): Array<{ policyCode: string; result: PolicyResult }> {
  const appState = loadAppCloudState(applicationId)
  const policyCodes = ['POL-BACKUP-001', 'POL-BACKUP-002', 'POL-EDR-001', 'POL-ENC-001', 'POL-LOG-001']

  const policyDefMap: Record<string, string> = {
    'POL-BACKUP-001': 'POL-DEF-001',
    'POL-BACKUP-002': 'POL-DEF-002',
    'POL-EDR-001': 'POL-DEF-003',
    'POL-ENC-001': 'POL-DEF-004',
    'POL-LOG-001': 'POL-DEF-005',
  }

  const results = policyCodes.map(code => {
    const result = evaluatePolicy(code, appState)

    // Persist evaluation — use JS ISO timestamp (millisecond precision) so
    // rapid sequential inserts within the same second are still ordered correctly
    const evalId = randomUUID()
    const evaluatedAt = new Date().toISOString()
    db.insert(policyEvaluations).values({
      id: evalId,
      policyDefinitionId: policyDefMap[code],
      policyCode: code,
      applicationId,
      deploymentId: deploymentId ?? null,
      status: result.status,
      evidence: JSON.stringify(result.evidence),
      evaluatedAt,
    }).run()

    // Write audit event
    if (correlationId) {
      db.insert(auditEvents).values({
        id: randomUUID(),
        actor: 'policy-engine',
        action: `POLICY_EVALUATED:${code}`,
        objectType: 'PolicyEvaluation',
        objectId: evalId,
        outcome: 'success',
        correlationId,
        metadata: JSON.stringify({ policyCode: code, status: result.status, applicationId }),
      }).run()
    }

    return { policyCode: code, result }
  })

  return results
}

export function getLatestPolicyEvaluations(applicationId: string) {
  const allEvals = db.select().from(policyEvaluations)
    .where(eq(policyEvaluations.applicationId, applicationId))
    .all()

  // Get latest per policy code
  const latestMap = new Map<string, typeof allEvals[0]>()
  for (const eval_ of allEvals) {
    const existing = latestMap.get(eval_.policyCode)
    // Use >= so that when timestamps tie (same second), the last-inserted row wins
    if (!existing || (eval_.evaluatedAt ?? '') >= (existing.evaluatedAt ?? '')) {
      latestMap.set(eval_.policyCode, eval_)
    }
  }
  return Array.from(latestMap.values())
}
