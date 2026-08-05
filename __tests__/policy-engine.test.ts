import { describe, it, expect } from 'vitest'
import { evaluatePolicy } from '@/lib/policy-engine'
import type { AppCloudState } from '@/lib/policy-engine'

const baseState: AppCloudState = {
  applicationId: 'TEST-APP',
  resources: [],
}

const stateWithVaultNoItem: AppCloudState = {
  applicationId: 'TEST-APP',
  resources: [
    { id: 'v1', type: 'RecoveryVault', name: 'rsv-test', config: { storageRedundancy: 'GeoRedundant' }, tags: {} },
  ],
}

const stateCompliant: AppCloudState = {
  applicationId: 'TEST-APP',
  resources: [
    { id: 'v1', type: 'RecoveryVault', name: 'rsv-test', config: { storageRedundancy: 'GeoRedundant' }, tags: {} },
    { id: 'b1', type: 'BackupProtectedItem', name: 'vm-backup', config: {}, tags: {} },
  ],
}

const stateVaultLRS: AppCloudState = {
  applicationId: 'TEST-APP',
  resources: [
    { id: 'v1', type: 'RecoveryVault', name: 'rsv-test', config: { storageRedundancy: 'LocallyRedundant' }, tags: {} },
    { id: 'b1', type: 'BackupProtectedItem', name: 'vm-backup', config: {}, tags: {} },
  ],
}

const stateWithVM: AppCloudState = {
  applicationId: 'TEST-APP',
  resources: [
    { id: 'vm1', type: 'VM', name: 'vm-test', config: { encryptionEnabled: true, diagnosticLogging: false }, tags: {} },
  ],
}

describe('Policy Engine', () => {
  describe('POL-BACKUP-001 — VM Backup Enabled', () => {
    it('NonCompliant when no resources', () => {
      const result = evaluatePolicy('POL-BACKUP-001', baseState)
      expect(result.status).toBe('NonCompliant')
      expect(result.evidence.hasVault).toBe(false)
      expect(result.evidence.hasProtectedItem).toBe(false)
    })

    it('NonCompliant when vault exists but no protected item', () => {
      const result = evaluatePolicy('POL-BACKUP-001', stateWithVaultNoItem)
      expect(result.status).toBe('NonCompliant')
      expect(result.evidence.hasVault).toBe(true)
      expect(result.evidence.hasProtectedItem).toBe(false)
    })

    it('Compliant when vault + protected item exist', () => {
      const result = evaluatePolicy('POL-BACKUP-001', stateCompliant)
      expect(result.status).toBe('Compliant')
      expect(result.evidence.hasVault).toBe(true)
      expect(result.evidence.hasProtectedItem).toBe(true)
    })
  })

  describe('POL-BACKUP-002 — Backup Storage Geo-Redundant', () => {
    it('NotEvaluated when no vault', () => {
      const result = evaluatePolicy('POL-BACKUP-002', baseState)
      expect(result.status).toBe('NotEvaluated')
      expect(result.evidence.vaultExists).toBe(false)
    })

    it('NonCompliant when vault has LocallyRedundant storage', () => {
      const result = evaluatePolicy('POL-BACKUP-002', stateVaultLRS)
      expect(result.status).toBe('NonCompliant')
      expect(result.evidence.storageRedundancy).toBe('LocallyRedundant')
    })

    it('Compliant when vault has GeoRedundant storage', () => {
      const result = evaluatePolicy('POL-BACKUP-002', stateCompliant)
      expect(result.status).toBe('Compliant')
      expect(result.evidence.storageRedundancy).toBe('GeoRedundant')
    })
  })

  describe('POL-EDR-001 — EDR Agent', () => {
    it('always NonCompliant in demo', () => {
      const result = evaluatePolicy('POL-EDR-001', stateCompliant)
      expect(result.status).toBe('NonCompliant')
    })
  })

  describe('POL-ENC-001 — Disk Encryption', () => {
    it('NotEvaluated when no VM', () => {
      const result = evaluatePolicy('POL-ENC-001', baseState)
      expect(result.status).toBe('NotEvaluated')
    })

    it('Compliant when VM has encryptionEnabled=true', () => {
      const result = evaluatePolicy('POL-ENC-001', stateWithVM)
      expect(result.status).toBe('Compliant')
    })

    it('NonCompliant when VM has encryptionEnabled=false', () => {
      const state: AppCloudState = {
        applicationId: 'TEST-APP',
        resources: [{ id: 'vm1', type: 'VM', name: 'vm', config: { encryptionEnabled: false }, tags: {} }],
      }
      const result = evaluatePolicy('POL-ENC-001', state)
      expect(result.status).toBe('NonCompliant')
    })
  })

  describe('POL-LOG-001 — Diagnostic Logging', () => {
    it('NonCompliant when VM has diagnosticLogging=false', () => {
      const result = evaluatePolicy('POL-LOG-001', stateWithVM)
      expect(result.status).toBe('NonCompliant')
    })

    it('Compliant when diagnosticLogging=true', () => {
      const state: AppCloudState = {
        applicationId: 'TEST-APP',
        resources: [{ id: 'vm1', type: 'VM', name: 'vm', config: { diagnosticLogging: true }, tags: {} }],
      }
      const result = evaluatePolicy('POL-LOG-001', state)
      expect(result.status).toBe('Compliant')
    })
  })

  describe('Unknown policy', () => {
    it('returns NotEvaluated for unknown code', () => {
      const result = evaluatePolicy('POL-UNKNOWN-999', baseState)
      expect(result.status).toBe('NotEvaluated')
    })
  })
})
