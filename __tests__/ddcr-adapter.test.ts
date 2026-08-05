import { describe, it, expect, beforeEach } from 'vitest'
import { db, sqlite } from '@/lib/db/index'
import { complianceWorkProducts, policyEvaluations, policyDefinitions } from '@/lib/db/schema'
import { deriveBackupJobConfigStatus } from '@/lib/ddcr-adapter'
import { randomUUID } from 'crypto'

function seedWorkProduct() {
  sqlite.exec(`
    DELETE FROM compliance_work_products;
    DELETE FROM policy_evaluations;
    DELETE FROM policy_definitions;
  `)
  db.insert(policyDefinitions).values([
    { id: 'POL-DEF-001', code: 'POL-BACKUP-001', title: 'VM Backup Enabled', description: '', logic: '' },
    { id: 'POL-DEF-002', code: 'POL-BACKUP-002', title: 'Backup GRZ', description: '', logic: '' },
  ]).run()
  db.insert(complianceWorkProducts).values({
    id: 'WP-001',
    applicationId: 'APP-X-001',
    name: 'Backup Job Configuration',
    status: 'Not Fulfilled',
    evidenceIds: '[]',
  }).run()
}

function insertEval(policyCode: string, status: string, defId: string) {
  db.insert(policyEvaluations).values({
    id: randomUUID(),
    policyDefinitionId: defId,
    policyCode,
    applicationId: 'APP-X-001',
    status,
    evidence: JSON.stringify({}),
  }).run()
}

describe('DDCR Adapter', () => {
  describe('deriveBackupJobConfigStatus', () => {
    beforeEach(() => seedWorkProduct())

    it('Not Fulfilled when no evaluations', () => {
      const result = deriveBackupJobConfigStatus('APP-X-001')
      expect(result.status).toBe('Not Fulfilled')
      expect(result.evidenceIds).toHaveLength(0)
    })

    it('Not Fulfilled when only POL-BACKUP-001 is Compliant', () => {
      insertEval('POL-BACKUP-001', 'Compliant', 'POL-DEF-001')
      insertEval('POL-BACKUP-002', 'NonCompliant', 'POL-DEF-002')
      const result = deriveBackupJobConfigStatus('APP-X-001')
      expect(result.status).toBe('Not Fulfilled')
    })

    it('Not Fulfilled when only POL-BACKUP-002 is Compliant', () => {
      insertEval('POL-BACKUP-001', 'NonCompliant', 'POL-DEF-001')
      insertEval('POL-BACKUP-002', 'Compliant', 'POL-DEF-002')
      const result = deriveBackupJobConfigStatus('APP-X-001')
      expect(result.status).toBe('Not Fulfilled')
    })

    it('Fulfilled when both POL-BACKUP-001 and POL-BACKUP-002 are Compliant', () => {
      insertEval('POL-BACKUP-001', 'Compliant', 'POL-DEF-001')
      insertEval('POL-BACKUP-002', 'Compliant', 'POL-DEF-002')
      const result = deriveBackupJobConfigStatus('APP-X-001')
      expect(result.status).toBe('Fulfilled')
      expect(result.evidenceIds).toHaveLength(2)
    })

    it('Fulfilled uses latest evaluation when multiple exist', () => {
      // First: NonCompliant
      insertEval('POL-BACKUP-001', 'NonCompliant', 'POL-DEF-001')
      insertEval('POL-BACKUP-002', 'NonCompliant', 'POL-DEF-002')
      // Then: Compliant (will be latest)
      insertEval('POL-BACKUP-001', 'Compliant', 'POL-DEF-001')
      insertEval('POL-BACKUP-002', 'Compliant', 'POL-DEF-002')
      const result = deriveBackupJobConfigStatus('APP-X-001')
      expect(result.status).toBe('Fulfilled')
    })
  })
})
