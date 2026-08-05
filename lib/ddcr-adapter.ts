import { db } from './db/index'
import { complianceWorkProducts, auditEvents, evidenceArtifacts } from './db/schema'
import { eq } from 'drizzle-orm'
import { getLatestPolicyEvaluations } from './policy-engine'
import { randomUUID } from 'crypto'

export type WorkProductStatus = 'Fulfilled' | 'Not Fulfilled' | 'N/A'

export interface WorkProductUpdate {
  name: string
  status: WorkProductStatus
  evidenceIds: string[]
}

export function deriveBackupJobConfigStatus(
  applicationId: string
): WorkProductUpdate {
  const evals = getLatestPolicyEvaluations(applicationId)
  const pol1 = evals.find(e => e.policyCode === 'POL-BACKUP-001')
  const pol2 = evals.find(e => e.policyCode === 'POL-BACKUP-002')

  if (pol1?.status === 'Compliant' && pol2?.status === 'Compliant') {
    return {
      name: 'Backup Job Configuration',
      status: 'Fulfilled',
      evidenceIds: [pol1.id, pol2.id],
    }
  }

  return {
    name: 'Backup Job Configuration',
    status: 'Not Fulfilled',
    evidenceIds: [],
  }
}

export function updateDdcrWorkProducts(
  applicationId: string,
  correlationId?: string
): WorkProductUpdate[] {
  const backupUpdate = deriveBackupJobConfigStatus(applicationId)

  // Update the work product in DB
  const wp = db.select().from(complianceWorkProducts)
    .where(eq(complianceWorkProducts.applicationId, applicationId))
    .all()
    .find(w => w.name === 'Backup Job Configuration')

  if (wp) {
    db.update(complianceWorkProducts)
      .set({
        status: backupUpdate.status,
        evidenceIds: JSON.stringify(backupUpdate.evidenceIds),
        lastUpdatedAt: new Date().toISOString(),
      })
      .where(eq(complianceWorkProducts.id, wp.id))
      .run()

    // Write evidence artifact
    const artifactId = randomUUID()
    db.insert(evidenceArtifacts).values({
      id: artifactId,
      type: 'ComplianceWorkProduct',
      sourceId: wp.id,
      sourceType: 'ComplianceWorkProduct',
      content: JSON.stringify({
        name: backupUpdate.name,
        status: backupUpdate.status,
        evidenceIds: backupUpdate.evidenceIds,
        updatedAt: new Date().toISOString(),
      }),
      correlationId: correlationId ?? null,
    }).run()

    // Audit event
    if (correlationId) {
      db.insert(auditEvents).values({
        id: randomUUID(),
        actor: 'ddcr-adapter',
        action: 'DDCR_WORK_PRODUCT_UPDATED',
        objectType: 'ComplianceWorkProduct',
        objectId: wp.id,
        outcome: 'success',
        correlationId,
        metadata: JSON.stringify({
          workProduct: backupUpdate.name,
          newStatus: backupUpdate.status,
          applicationId,
        }),
      }).run()
    }
  }

  return [backupUpdate]
}

export function getAllWorkProducts(applicationId: string) {
  return db.select().from(complianceWorkProducts)
    .where(eq(complianceWorkProducts.applicationId, applicationId))
    .all()
}
