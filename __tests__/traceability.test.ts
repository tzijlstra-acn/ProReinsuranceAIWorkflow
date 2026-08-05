import { describe, it, expect, beforeEach } from 'vitest'
import { db, sqlite } from '@/lib/db/index'
import { regulationSources, requirements, guidelines, guidelineVersions, controlActivities, policyDefinitions } from '@/lib/db/schema'

// Minimal seed for traceability tests
function minimalSeed() {
  sqlite.exec(`
    DELETE FROM evidence_links; DELETE FROM evidence_artifacts;
    DELETE FROM requirements; DELETE FROM regulation_sources;
    DELETE FROM guideline_versions; DELETE FROM guidelines;
    DELETE FROM control_activities; DELETE FROM policy_definitions;
  `)

  db.insert(regulationSources).values({
    id: 'DORA-ART-12',
    articleId: 'Article 12',
    title: 'Backup policies',
    source: 'EUR-Lex',
    fixture: JSON.stringify({ id: 'DORA-ART-12', articleId: 'Article 12', title: 'Backup policies', requirements: ['req1'] }),
  }).run()

  db.insert(requirements).values([
    { id: 'REQ-1', regulationSourceId: 'DORA-ART-12', text: 'Backup requirement 1', category: 'Backup' },
    { id: 'REQ-2', regulationSourceId: 'DORA-ART-12', text: 'Backup requirement 2', category: 'Backup' },
  ]).run()

  db.insert(guidelines).values({ id: 'GL-001', title: 'BR Guideline', currentVersionId: 'GLV-001' }).run()
  db.insert(guidelineVersions).values({
    id: 'GLV-001', guidelineId: 'GL-001', version: '3.2', content: 'Content v3.2', status: 'active'
  }).run()
  db.insert(guidelineVersions).values({
    id: 'GLV-002', guidelineId: 'GL-001', version: '3.3', content: 'Content v3.2', proposedContent: 'Content v3.3', status: 'proposed'
  }).run()

  db.insert(controlActivities).values({
    id: 'CA-BR0039', code: 'BR0039', title: 'Backup Job Config', objective: 'Ensure backup', status: 'active', version: '2.1'
  }).run()
  db.insert(controlActivities).values({
    id: 'CA-BR0039-GR', code: 'BR0039-GR', title: 'Backup GRZ [DEMO DATA]', objective: 'Ensure GRZ', status: 'proposed', version: '1.0', isDemoData: true
  }).run()

  db.insert(policyDefinitions).values([
    { id: 'POL-DEF-001', code: 'POL-BACKUP-001', title: 'VM Backup Enabled', description: '', logic: '' },
    { id: 'POL-DEF-002', code: 'POL-BACKUP-002', title: 'Backup GRZ', description: '', logic: '' },
  ]).run()
}

describe('Traceability — Evidence Graph Completeness', () => {
  beforeEach(() => minimalSeed())

  it('DORA-ART-12 regulation source exists', () => {
    const reg = db.select().from(regulationSources).all()
    expect(reg.length).toBeGreaterThanOrEqual(1)
    expect(reg[0].id).toBe('DORA-ART-12')
  })

  it('regulation has at least 2 requirements', () => {
    const reqs = db.select().from(requirements).all()
    expect(reqs.length).toBeGreaterThanOrEqual(2)
    expect(reqs.every(r => r.regulationSourceId === 'DORA-ART-12')).toBe(true)
  })

  it('guideline has both v3.2 (active) and v3.3 (proposed)', () => {
    const versions = db.select().from(guidelineVersions).all()
    const v32 = versions.find(v => v.version === '3.2')
    const v33 = versions.find(v => v.version === '3.3')
    expect(v32).toBeDefined()
    expect(v33).toBeDefined()
    expect(v32?.status).toBe('active')
    expect(v33?.status).toBe('proposed')
  })

  it('BR0039-GR control activity exists and is marked demo data', () => {
    const controls = db.select().from(controlActivities).all()
    const ca = controls.find(c => c.code === 'BR0039-GR')
    expect(ca).toBeDefined()
    expect(ca?.isDemoData).toBe(true)
    expect(ca?.title).toContain('[DEMO DATA]')
  })

  it('both backup policy definitions exist', () => {
    const policies = db.select().from(policyDefinitions).all()
    const pol1 = policies.find(p => p.code === 'POL-BACKUP-001')
    const pol2 = policies.find(p => p.code === 'POL-BACKUP-002')
    expect(pol1).toBeDefined()
    expect(pol2).toBeDefined()
  })

  it('guideline v3.3 has proposed content set', () => {
    const versions = db.select().from(guidelineVersions).all()
    const v33 = versions.find(v => v.version === '3.3')
    expect(v33?.proposedContent).not.toBeNull()
    expect(v33?.proposedContent?.length).toBeGreaterThan(0)
  })
})
