import { describe, it, expect, beforeEach } from 'vitest'
import { db, sqlite } from '@/lib/db/index'
import {
  regulatorySources,
  regulatoryRequirements,
  complianceGaps,
  controlChanges,
} from '@/lib/db/schema'
import {
  getRegulatorySources,
  getComplianceGaps,
  getComplianceGap,
  approveControlChange,
  publishControlChange,
  getControlChange,
} from '@/lib/domain/compliance-hub'

const NOW = new Date().toISOString()

const CLEAR_SQL = `
  DELETE FROM ddcr_reporting_records;
  DELETE FROM requirement_status_history;
  DELETE FROM evidence_packages;
  DELETE FROM verification_results;
  DELETE FROM verification_criteria;
  DELETE FROM product_work_products;
  DELETE FROM work_product_definitions;
  DELETE FROM product_gaps;
  DELETE FROM product_applicability;
  DELETE FROM products;
  DELETE FROM control_changes;
  DELETE FROM compliance_gaps;
  DELETE FROM requirement_document_mappings;
  DELETE FROM internal_documents;
  DELETE FROM regulatory_requirements;
  DELETE FROM regulatory_versions;
  DELETE FROM regulatory_sources;
`

describe('Compliance Hub', () => {
  beforeEach(() => {
    sqlite.exec(CLEAR_SQL)

    db.insert(regulatorySources).values({
      id: 'REG-TEST',
      shortCode: 'DORA',
      name: 'Digital Operational Resilience Act',
      jurisdiction: 'EU',
      status: 'active',
    }).run()

    db.insert(regulatoryRequirements).values({
      id: 'REQ-TEST',
      sourceId: 'REG-TEST',
      versionId: 'REGV-TEST',
      articleRef: 'Art. 12(1)',
      title: 'Backup Requirement',
      description: 'Must maintain backups',
      obligationType: 'TECHNICAL_CONTROL',
      obligationLevel: 'MANDATORY',
      status: 'active',
    }).run()

    db.insert(complianceGaps).values({
      id: 'GAP-TEST',
      requirementId: 'REQ-TEST',
      sourceId: 'REG-TEST',
      title: 'Missing Backup Policy',
      description: 'No backup policy exists',
      severity: 'HIGH',
      gapType: 'POLICY_MISSING',
      status: 'OPEN',
      detectedAt: NOW,
    }).run()

    db.insert(controlChanges).values({
      id: 'CC-TEST',
      gapId: 'GAP-TEST',
      requirementId: 'REQ-TEST',
      title: 'Create Backup Policy',
      description: 'Draft a new backup policy document',
      changeType: 'NEW_POLICY',
      status: 'DRAFT',
    }).run()
  })

  describe('getRegulatorySources', () => {
    it('returns sources with requirementCount and gapCount', () => {
      const sources = getRegulatorySources()
      expect(sources).toHaveLength(1)
      const [src] = sources
      expect(src.id).toBe('REG-TEST')
      expect(src.shortCode).toBe('DORA')
      expect(src.jurisdiction).toBe('EU')
      expect(src.requirementCount).toBe(1)
      expect(src.gapCount).toBe(1)
    })
  })

  describe('getComplianceGaps', () => {
    it('returns all gaps when called with no filter', () => {
      const gaps = getComplianceGaps()
      expect(gaps).toHaveLength(1)
      expect(gaps[0].id).toBe('GAP-TEST')
    })

    it('returns gaps filtered by OPEN status', () => {
      const gaps = getComplianceGaps('OPEN')
      expect(gaps).toHaveLength(1)
      expect(gaps[0].status).toBe('OPEN')
    })

    it('returns empty array when filtering by CLOSED status', () => {
      const gaps = getComplianceGaps('CLOSED')
      expect(gaps).toHaveLength(0)
    })
  })

  describe('getComplianceGap', () => {
    it('returns full detail including requirement and source', () => {
      const gap = getComplianceGap('GAP-TEST')
      expect(gap).not.toBeNull()
      expect(gap!.id).toBe('GAP-TEST')
      expect(gap!.status).toBe('OPEN')
      expect(gap!.affectedDocumentIds).toEqual([])
      expect(gap!.requirement).not.toBeNull()
      expect(gap!.requirement!.id).toBe('REQ-TEST')
      expect(gap!.source).not.toBeNull()
      expect(gap!.source!.id).toBe('REG-TEST')
      expect(gap!.source!.shortCode).toBe('DORA')
    })

    it('returns null for a nonexistent id', () => {
      expect(getComplianceGap('nonexistent')).toBeNull()
    })
  })

  describe('approveControlChange', () => {
    it('sets status to APPROVED and records approvedAt and approvedBy', () => {
      approveControlChange('CC-TEST', 'tester')
      const updated = getControlChange('CC-TEST')
      expect(updated).not.toBeNull()
      expect(updated!.status).toBe('APPROVED')
      expect(updated!.approvedBy).toBe('tester')
      expect(updated!.approvedAt).not.toBeNull()
    })
  })

  describe('publishControlChange', () => {
    it('sets status to PUBLISHED and records publishedAt', () => {
      publishControlChange('CC-TEST')
      const updated = getControlChange('CC-TEST')
      expect(updated).not.toBeNull()
      expect(updated!.status).toBe('PUBLISHED')
      expect(updated!.publishedAt).not.toBeNull()
    })
  })
})
