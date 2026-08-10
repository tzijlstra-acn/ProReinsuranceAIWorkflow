import { db } from '@/lib/db/index'
import {
  regulatorySources,
  regulatoryRequirements,
  complianceGaps,
  controlChanges,
  internalDocuments,
} from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RegulatorySourceWithCounts {
  id: string
  shortCode: string
  name: string
  jurisdiction: string
  status: string
  effectiveDate: string | null
  description: string | null
  eurLexUrl: string | null
  createdAt: string | null
  requirementCount: number
  gapCount: number
}

export interface RegulatoryRequirement {
  id: string
  sourceId: string
  versionId: string
  articleRef: string
  title: string
  description: string
  obligationType: string
  obligationLevel: string
  applicabilityScope: string | null
  status: string
  createdAt: string | null
}

export interface ComplianceGapWithDetail {
  id: string
  requirementId: string
  sourceId: string
  title: string
  description: string
  severity: string
  gapType: string
  status: string
  detectedAt: string
  affectedDocumentIds: string[]
  aiAnalysis: string | null
  createdAt: string | null
  requirement: RegulatoryRequirement | null
  source: { id: string; shortCode: string; name: string } | null
}

export interface ControlChangeWithDetail {
  id: string
  gapId: string
  requirementId: string
  title: string
  description: string
  changeType: string
  status: string
  proposedAt: string | null
  approvedAt: string | null
  approvedBy: string | null
  publishedAt: string | null
  proposedChanges: Record<string, unknown> | null
  aiGenerated: boolean
  createdAt: string | null
  gap: ComplianceGapWithDetail | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All regulatory sources with their latest requirement count and open gap count.
 */
export function getRegulatorySources(): RegulatorySourceWithCounts[] {
  const sources = db.select().from(regulatorySources).all()
  const requirements = db.select().from(regulatoryRequirements).all()
  const gaps = db.select().from(complianceGaps).all()

  return sources.map(source => ({
    ...source,
    requirementCount: requirements.filter(r => r.sourceId === source.id).length,
    gapCount: gaps.filter(g => g.sourceId === source.id).length,
  }))
}

/**
 * All regulatory requirements, optionally filtered by sourceId.
 */
export function getRegulatoryRequirements(sourceId?: string): RegulatoryRequirement[] {
  if (sourceId) {
    return db
      .select()
      .from(regulatoryRequirements)
      .where(eq(regulatoryRequirements.sourceId, sourceId))
      .all()
  }
  return db.select().from(regulatoryRequirements).all()
}

/**
 * All compliance gaps with requirement and source joined.
 * Optionally filtered by status.
 */
export function getComplianceGaps(status?: string): ComplianceGapWithDetail[] {
  const gaps = status
    ? db.select().from(complianceGaps).where(eq(complianceGaps.status, status)).all()
    : db.select().from(complianceGaps).all()

  const requirements = db.select().from(regulatoryRequirements).all()
  const sources = db.select().from(regulatorySources).all()

  return gaps.map(gap => {
    const req = requirements.find(r => r.id === gap.requirementId) ?? null
    const src = sources.find(s => s.id === gap.sourceId) ?? null
    return {
      ...gap,
      affectedDocumentIds: JSON.parse(gap.affectedDocumentIds ?? '[]') as string[],
      requirement: req ?? null,
      source: src ? { id: src.id, shortCode: src.shortCode, name: src.name } : null,
    }
  })
}

/**
 * Single compliance gap with full detail.
 */
export function getComplianceGap(id: string): ComplianceGapWithDetail | null {
  const gap = db.select().from(complianceGaps).where(eq(complianceGaps.id, id)).get()
  if (!gap) return null

  const req = db
    .select()
    .from(regulatoryRequirements)
    .where(eq(regulatoryRequirements.id, gap.requirementId))
    .get() ?? null

  const src = db
    .select()
    .from(regulatorySources)
    .where(eq(regulatorySources.id, gap.sourceId))
    .get() ?? null

  return {
    ...gap,
    affectedDocumentIds: JSON.parse(gap.affectedDocumentIds ?? '[]') as string[],
    requirement: req ?? null,
    source: src ? { id: src.id, shortCode: src.shortCode, name: src.name } : null,
  }
}

/**
 * All control changes with gap joined.
 * Optionally filtered by status.
 */
export function getControlChanges(status?: string): ControlChangeWithDetail[] {
  const changes = status
    ? db.select().from(controlChanges).where(eq(controlChanges.status, status)).all()
    : db.select().from(controlChanges).all()

  const gaps = db.select().from(complianceGaps).all()
  const requirements = db.select().from(regulatoryRequirements).all()
  const sources = db.select().from(regulatorySources).all()

  return changes.map(change => {
    const gap = gaps.find(g => g.id === change.gapId) ?? null
    const req = requirements.find(r => r.id === change.requirementId) ?? null
    const src = gap ? sources.find(s => s.id === gap.sourceId) ?? null : null

    const gapDetail: ComplianceGapWithDetail | null = gap
      ? {
          ...gap,
          affectedDocumentIds: JSON.parse(gap.affectedDocumentIds ?? '[]') as string[],
          requirement: req ?? null,
          source: src ? { id: src.id, shortCode: src.shortCode, name: src.name } : null,
        }
      : null

    return {
      ...change,
      proposedChanges: change.proposedChanges ? parseJson(change.proposedChanges) : null,
      gap: gapDetail,
    }
  })
}

/**
 * Single control change with full detail.
 */
export function getControlChange(id: string): ControlChangeWithDetail | null {
  const change = db.select().from(controlChanges).where(eq(controlChanges.id, id)).get()
  if (!change) return null

  const gap = change.gapId
    ? db.select().from(complianceGaps).where(eq(complianceGaps.id, change.gapId)).get() ?? null
    : null

  const req = db
    .select()
    .from(regulatoryRequirements)
    .where(eq(regulatoryRequirements.id, change.requirementId))
    .get() ?? null

  const src = gap
    ? db.select().from(regulatorySources).where(eq(regulatorySources.id, gap.sourceId)).get() ?? null
    : null

  const gapDetail: ComplianceGapWithDetail | null = gap
    ? {
        ...gap,
        affectedDocumentIds: JSON.parse(gap.affectedDocumentIds ?? '[]') as string[],
        requirement: req ?? null,
        source: src ? { id: src.id, shortCode: src.shortCode, name: src.name } : null,
      }
    : null

  return {
    ...change,
    proposedChanges: change.proposedChanges ? parseJson(change.proposedChanges) : null,
    gap: gapDetail,
  }
}

/**
 * Approve a control change — sets status to APPROVED, records approvedAt/approvedBy.
 */
export function approveControlChange(id: string, approvedBy: string): void {
  db.update(controlChanges)
    .set({
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedBy,
    })
    .where(eq(controlChanges.id, id))
    .run()
}

/**
 * Publish a control change — sets status to PUBLISHED, records publishedAt.
 */
export function publishControlChange(id: string): void {
  db.update(controlChanges)
    .set({
      status: 'PUBLISHED',
      publishedAt: new Date().toISOString(),
    })
    .where(eq(controlChanges.id, id))
    .run()
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────────────────────────────────────

function parseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}
