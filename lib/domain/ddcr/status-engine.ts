import { db } from '@/lib/db/index'
import {
  ddcrReportingRecords,
  verificationCriteria,
  verificationResults,
  productGaps,
  controlChanges,
  evidencePackages,
  productApplicability,
  regulatoryRequirements,
  regulatorySources,
} from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DDCRStatus =
  | 'COMPLIANT'
  | 'NON_COMPLIANT'
  | 'NOT_APPLICABLE'
  | 'EXCEPTION_APPROVED'
  | 'PENDING'

export interface DDCRRecord {
  id: string
  productId: string
  requirementId: string | null
  sourceId: string | null
  status: DDCRStatus
  effectiveAt: string
  evidencePackageId: string | null
  reportedAt: string
  reportedBy: string | null
  notes: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function latestBy<T extends { reportedAt: string }>(records: T[]): T | null {
  if (records.length === 0) return null
  return records.reduce((a, b) => (a.reportedAt >= b.reportedAt ? a : b))
}

function latestPerKey<T extends { reportedAt: string }>(
  records: T[],
  keyFn: (r: T) => string
): T[] {
  const map = new Map<string, T>()
  for (const r of records) {
    const k = keyFn(r)
    const existing = map.get(k)
    if (!existing || r.reportedAt > existing.reportedAt) map.set(k, r)
  }
  return Array.from(map.values())
}

// ─────────────────────────────────────────────────────────────────────────────
// Read functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Latest DDCR record for a product × requirement × source.
 * Pass null for requirementId / sourceId to target aggregate levels.
 */
export function getRequirementStatus(
  productId: string,
  requirementId: string | null,
  sourceId: string | null
): DDCRRecord | null {
  const all = db.select().from(ddcrReportingRecords)
    .where(eq(ddcrReportingRecords.productId, productId))
    .all()

  const filtered = all.filter(r =>
    (requirementId === null ? r.requirementId === null : r.requirementId === requirementId) &&
    (sourceId === null ? r.sourceId === null : r.sourceId === sourceId)
  )

  return latestBy(filtered) as DDCRRecord | null
}

/** Latest requirement-level records for a product (one per requirementId). */
export function getProductRequirementStatuses(productId: string): DDCRRecord[] {
  const all = db.select().from(ddcrReportingRecords)
    .where(eq(ddcrReportingRecords.productId, productId))
    .all()

  const reqLevel = all.filter(r => r.requirementId !== null)
  return latestPerKey(reqLevel, r => r.requirementId!) as DDCRRecord[]
}

/** Latest regulation-level aggregate records for a product (one per sourceId). */
export function getProductRegulationStatuses(productId: string): DDCRRecord[] {
  const all = db.select().from(ddcrReportingRecords)
    .where(eq(ddcrReportingRecords.productId, productId))
    .all()

  const regLevel = all.filter(r => r.requirementId === null && r.sourceId !== null)
  return latestPerKey(regLevel, r => r.sourceId!) as DDCRRecord[]
}

/** Latest product-level aggregate record. */
export function getProductOverallStatus(productId: string): DDCRRecord | null {
  const all = db.select().from(ddcrReportingRecords)
    .where(eq(ddcrReportingRecords.productId, productId))
    .all()

  const productLevel = all.filter(r => r.requirementId === null && r.sourceId === null)
  return latestBy(productLevel) as DDCRRecord | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether transitioning a requirement to COMPLIANT is permitted.
 * Rules:
 *  1. A COMPLIANT evidence package exists for this product × requirement.
 *  2. All mandatory verification criteria have PASSED results for this product.
 *  3. No OPEN product gaps remain for this product × requirement.
 *  4. Any control_change linked to this requirement must be PUBLISHED.
 */
export function checkDDCRTransitionAllowed(
  productId: string,
  requirementId: string
): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = []

  // 1. A COMPLIANT evidence package must exist
  const compliantPackages = db.select().from(evidencePackages)
    .where(
      and(
        eq(evidencePackages.productId, productId),
        eq(evidencePackages.requirementId, requirementId),
        eq(evidencePackages.status, 'COMPLETE')
      )
    )
    .all()

  if (compliantPackages.length === 0) {
    blockers.push('No COMPLETE evidence package found for this product × requirement')
  }

  // 2. All mandatory criteria must have PASSED results
  const criteria = db.select().from(verificationCriteria)
    .where(eq(verificationCriteria.requirementId, requirementId))
    .all()
    .filter(c => c.isMandatory)

  const results = db.select().from(verificationResults)
    .where(
      and(
        eq(verificationResults.productId, productId),
        eq(verificationResults.requirementId, requirementId)
      )
    )
    .all()

  // Latest result per criterion
  const latestResultMap = new Map<string, typeof results[0]>()
  for (const r of results) {
    const existing = latestResultMap.get(r.criterionId)
    if (!existing || r.verifiedAt > existing.verifiedAt) latestResultMap.set(r.criterionId, r)
  }

  for (const c of criteria) {
    const result = latestResultMap.get(c.id)
    if (!result || result.status !== 'PASSED') {
      blockers.push(`Mandatory criterion not passed: "${c.title}"`)
    }
  }

  // 3. No OPEN product gaps
  const openGaps = db.select().from(productGaps)
    .where(
      and(
        eq(productGaps.productId, productId),
        eq(productGaps.requirementId, requirementId),
        eq(productGaps.status, 'OPEN')
      )
    )
    .all()

  for (const gap of openGaps) {
    blockers.push(`Open product gap: "${gap.title}"`)
  }

  // 4. Any control changes for this requirement must be PUBLISHED
  const changes = db.select().from(controlChanges)
    .where(eq(controlChanges.requirementId, requirementId))
    .all()

  for (const change of changes) {
    if (change.status !== 'PUBLISHED') {
      blockers.push(
        `Control change not published: "${change.title}" (current status: ${change.status})`
      )
    }
  }

  return { allowed: blockers.length === 0, blockers }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Writes a new COMPLIANT record for a requirement — only if evidence gate passes.
 * Returns { ok: true } on success, or { ok: false, error, blockers } on failure.
 */
export function transitionToCompliant(
  productId: string,
  requirementId: string,
  sourceId: string,
  approvedBy: string
): { ok: boolean; error?: string; blockers?: string[] } {
  const check = checkDDCRTransitionAllowed(productId, requirementId)
  if (!check.allowed) {
    return { ok: false, error: 'Transition blocked by evidence gate', blockers: check.blockers }
  }

  const now = new Date().toISOString()
  db.insert(ddcrReportingRecords).values({
    id: randomUUID(),
    productId,
    requirementId,
    sourceId,
    status: 'COMPLIANT',
    effectiveAt: now,
    evidencePackageId: null,
    reportedAt: now,
    reportedBy: approvedBy,
    notes: `Transitioned to COMPLIANT by ${approvedBy} after evidence gate passed.`,
  }).run()

  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate recompute
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recomputes regulation-level and product-level aggregate DDCR records
 * by deleting stale aggregates and inserting fresh ones derived from
 * current requirement-level statuses.
 *
 * Regulation logic:
 *   - Any MANDATORY applicable requirement NON_COMPLIANT → regulation NON_COMPLIANT
 *   - All MANDATORY applicable requirements COMPLIANT (or EXCEPTION_APPROVED) → COMPLIANT
 *   - No applicable requirements → NOT_APPLICABLE
 *
 * Product logic:
 *   - Any regulation NON_COMPLIANT → product NON_COMPLIANT
 *   - All regulations COMPLIANT or NOT_APPLICABLE → COMPLIANT
 */
export function recomputeAggregates(productId: string): void {
  const now = new Date().toISOString()

  const reqStatuses = getProductRequirementStatuses(productId)

  const applicability = db.select().from(productApplicability)
    .where(eq(productApplicability.productId, productId))
    .all()

  const allRequirements = db.select().from(regulatoryRequirements).all()
  const sources = db.select().from(regulatorySources).all()

  type RegResult = { sourceId: string; status: DDCRStatus; notes: string }
  const regulationResults: RegResult[] = []

  for (const source of sources) {
    const applicable = applicability.filter(a => a.sourceId === source.id && a.applicable)

    if (applicable.length === 0) {
      regulationResults.push({
        sourceId: source.id,
        status: 'NOT_APPLICABLE',
        notes: `${source.shortCode}: no applicable requirements for this product.`,
      })
      continue
    }

    const applicableReqIds = new Set(applicable.map(a => a.requirementId))
    const mandatoryReqs = allRequirements.filter(
      r => applicableReqIds.has(r.id) && r.obligationLevel === 'MANDATORY'
    )

    if (mandatoryReqs.length === 0) {
      regulationResults.push({
        sourceId: source.id,
        status: 'NOT_APPLICABLE',
        notes: `${source.shortCode}: no mandatory requirements applicable.`,
      })
      continue
    }

    const statuses = mandatoryReqs.map(req => {
      const record = reqStatuses.find(r => r.requirementId === req.id)
      return record?.status ?? ('PENDING' as DDCRStatus)
    })

    let regStatus: DDCRStatus
    if (statuses.some(s => s === 'NON_COMPLIANT')) {
      regStatus = 'NON_COMPLIANT'
    } else if (statuses.every(
      s => s === 'COMPLIANT' || s === 'NOT_APPLICABLE' || s === 'EXCEPTION_APPROVED'
    )) {
      regStatus = 'COMPLIANT'
    } else if (statuses.every(s => s === 'NOT_APPLICABLE')) {
      regStatus = 'NOT_APPLICABLE'
    } else {
      regStatus = 'PENDING'
    }

    const nc = statuses.filter(s => s === 'NON_COMPLIANT').length
    const comp = statuses.filter(s => s === 'COMPLIANT').length
    regulationResults.push({
      sourceId: source.id,
      status: regStatus,
      notes: `${source.shortCode} overall: ${comp}/${mandatoryReqs.length} mandatory requirement(s) compliant${nc > 0 ? `, ${nc} non-compliant` : ''}.`,
    })
  }

  // Product-level
  let productStatus: DDCRStatus
  if (regulationResults.some(r => r.status === 'NON_COMPLIANT')) {
    productStatus = 'NON_COMPLIANT'
  } else if (regulationResults.every(r => r.status === 'COMPLIANT' || r.status === 'NOT_APPLICABLE')) {
    productStatus = 'COMPLIANT'
  } else {
    productStatus = 'PENDING'
  }

  // Delete stale aggregate records (requirementId IS NULL)
  const existing = db.select().from(ddcrReportingRecords)
    .where(eq(ddcrReportingRecords.productId, productId))
    .all()
  const aggregateIds = existing.filter(r => r.requirementId === null).map(r => r.id)
  for (const id of aggregateIds) {
    db.delete(ddcrReportingRecords).where(eq(ddcrReportingRecords.id, id)).run()
  }

  // Insert fresh regulation-level records
  for (const { sourceId, status, notes } of regulationResults) {
    db.insert(ddcrReportingRecords).values({
      id: randomUUID(),
      productId,
      requirementId: null,
      sourceId,
      status,
      effectiveAt: now,
      evidencePackageId: null,
      reportedAt: now,
      reportedBy: 'system',
      notes,
    }).run()
  }

  // Insert fresh product-level record
  const nc = regulationResults.filter(r => r.status === 'NON_COMPLIANT').length
  db.insert(ddcrReportingRecords).values({
    id: randomUUID(),
    productId,
    requirementId: null,
    sourceId: null,
    status: productStatus,
    effectiveAt: now,
    evidencePackageId: null,
    reportedAt: now,
    reportedBy: 'system',
    notes: nc > 0
      ? `Product overall: ${nc} regulation(s) non-compliant.`
      : 'Product overall: all applicable regulations compliant.',
  }).run()
}
