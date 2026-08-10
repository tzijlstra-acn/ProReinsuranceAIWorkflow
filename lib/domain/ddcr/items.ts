import { db } from '@/lib/db/index'
import { ddcrItems, ddcrItemHistory } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DdcrItem = typeof ddcrItems.$inferSelect
export type DdcrItemHistory = typeof ddcrItemHistory.$inferSelect

export interface DdcrItemFilter {
  entityType?: string
  tower?: string
  reportingStatus?: string
  executionStatus?: string
  sourceSystem?: string
  actionOwner?: string
  regulatoryFramework?: string
}

export interface DdcrSummary {
  total: number
  byReportingStatus: Record<string, number>
  byExecutionStatus: Record<string, number>
  byTower: Record<string, number>
  bySourceSystem: Record<string, number>
  overdueCount: number
  actionRequiredCount: number
  compliantCount: number
  evidenceIncompleteCount: number
}

export interface DdcrTowerRow {
  tower: string
  total: number
  compliant: number
  nonCompliant: number
  partiallyCompliant: number
  overdue: number
  actionRequired: number
  inProgress: number
}

export interface DdcrEntityRow {
  entityId: string
  entityName: string
  entityType: string
  tower: string
  records: DdcrItem[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Query functions (all synchronous — no await)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return filtered list of DDCR items.
 * All filtering is done in JS after a single .all() fetch.
 */
export function getDdcrItems(filter?: DdcrItemFilter): DdcrItem[] {
  const all = db.select().from(ddcrItems).all()
  if (!filter) return all

  return all.filter(item => {
    if (filter.entityType && item.entityType !== filter.entityType) return false
    if (filter.tower && item.tower !== filter.tower) return false
    if (filter.reportingStatus && item.reportingStatus !== filter.reportingStatus) return false
    if (filter.executionStatus && item.executionStatus !== filter.executionStatus) return false
    if (filter.sourceSystem && item.sourceSystem !== filter.sourceSystem) return false
    if (filter.actionOwner && item.actionOwner !== filter.actionOwner) return false
    if (filter.regulatoryFramework && item.regulatoryFramework !== filter.regulatoryFramework) return false
    return true
  })
}

/**
 * Return a single DDCR item plus its history sorted by changedAt descending.
 */
export function getDdcrItem(id: string): { item: DdcrItem | null; history: DdcrItemHistory[] } {
  const item = db.select().from(ddcrItems).where(eq(ddcrItems.id, id)).get() ?? null
  if (!item) return { item: null, history: [] }

  const history = db.select().from(ddcrItemHistory)
    .where(eq(ddcrItemHistory.itemId, id))
    .all()
    .sort((a, b) => (b.changedAt > a.changedAt ? 1 : -1))

  return { item, history }
}

/**
 * Return summary counts across all DDCR items.
 */
export function getDdcrSummary(): DdcrSummary {
  const all = db.select().from(ddcrItems).all()

  const byReportingStatus: Record<string, number> = {}
  const byExecutionStatus: Record<string, number> = {}
  const byTower: Record<string, number> = {}
  const bySourceSystem: Record<string, number> = {}

  let overdueCount = 0
  let actionRequiredCount = 0
  let compliantCount = 0
  let evidenceIncompleteCount = 0

  for (const item of all) {
    // Reporting status
    byReportingStatus[item.reportingStatus] = (byReportingStatus[item.reportingStatus] ?? 0) + 1
    // Execution status
    byExecutionStatus[item.executionStatus] = (byExecutionStatus[item.executionStatus] ?? 0) + 1
    // Tower
    byTower[item.tower] = (byTower[item.tower] ?? 0) + 1
    // Source system
    bySourceSystem[item.sourceSystem] = (bySourceSystem[item.sourceSystem] ?? 0) + 1

    // Derived counts
    if (item.executionStatus === 'OVERDUE') overdueCount++
    if (item.executionStatus === 'ACTION_REQUIRED') actionRequiredCount++
    if (item.reportingStatus === 'COMPLIANT') compliantCount++

    // Evidence incomplete: no evidence references or empty array
    try {
      const refs = JSON.parse(item.evidenceReferences ?? '[]')
      if (!Array.isArray(refs) || refs.length === 0) evidenceIncompleteCount++
    } catch {
      evidenceIncompleteCount++
    }
  }

  return {
    total: all.length,
    byReportingStatus,
    byExecutionStatus,
    byTower,
    bySourceSystem,
    overdueCount,
    actionRequiredCount,
    compliantCount,
    evidenceIncompleteCount,
  }
}

/**
 * Return per-tower breakdown with status counts.
 */
export function getDdcrTowers(): DdcrTowerRow[] {
  const all = db.select().from(ddcrItems).all()

  const towerMap = new Map<string, DdcrTowerRow>()

  for (const item of all) {
    if (!towerMap.has(item.tower)) {
      towerMap.set(item.tower, {
        tower: item.tower,
        total: 0,
        compliant: 0,
        nonCompliant: 0,
        partiallyCompliant: 0,
        overdue: 0,
        actionRequired: 0,
        inProgress: 0,
      })
    }
    const row = towerMap.get(item.tower)!
    row.total++

    if (item.reportingStatus === 'COMPLIANT') row.compliant++
    if (item.reportingStatus === 'NON_COMPLIANT') row.nonCompliant++
    if (item.reportingStatus === 'PARTIALLY_COMPLIANT') row.partiallyCompliant++
    if (item.executionStatus === 'OVERDUE') row.overdue++
    if (item.executionStatus === 'ACTION_REQUIRED') row.actionRequired++
    if (item.executionStatus === 'IN_PROGRESS') row.inProgress++
  }

  return Array.from(towerMap.values()).sort((a, b) => a.tower.localeCompare(b.tower))
}

/**
 * Return all distinct entities with their associated DDCR items.
 */
export function getDdcrEntities(): DdcrEntityRow[] {
  const all = db.select().from(ddcrItems).all()

  const entityMap = new Map<string, DdcrEntityRow>()

  for (const item of all) {
    const key = item.entityId
    if (!entityMap.has(key)) {
      entityMap.set(key, {
        entityId: item.entityId,
        entityName: item.entityName,
        entityType: item.entityType,
        tower: item.tower,
        records: [],
      })
    }
    entityMap.get(key)!.records.push(item)
  }

  return Array.from(entityMap.values()).sort((a, b) => a.entityName.localeCompare(b.entityName))
}
