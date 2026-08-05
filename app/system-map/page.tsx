'use client'
import { clsx } from 'clsx'

interface SystemDef {
  name: string
  type: string
  role: string
  readsFrom: string[]
  writesTo: string[]
  implementation: string
  simulationStatus: 'simulated' | 'live'
  workflowSteps: number[]
  relatedPaths: string[]
}

const SYSTEMS: SystemDef[] = [
  {
    name: 'EUR-Lex',
    type: 'Regulatory database',
    role: 'Source of DORA Article 12 regulatory text',
    readsFrom: ['DORA Article 12 HTML'],
    writesTo: [],
    implementation: 'Local HTML snapshot at data/raw/eurlex/dora_article_12.html',
    simulationStatus: 'simulated',
    workflowSteps: [1],
    relatedPaths: ['data/raw/eurlex/dora_article_12.html'],
  },
  {
    name: 'Maya / Mitra',
    type: 'Regulatory interpretation and document generation',
    role: 'Interprets regulatory requirements, prepares guideline and control proposals',
    readsFrom: ['DORA Article 12', 'Backup & Restore Guideline v3.2', 'Control Catalogue'],
    writesTo: ['Backup & Restore Guideline v3.3', 'Proposed Control Activity'],
    implementation: 'Local AI service (OpenAI / deterministic fallback)',
    simulationStatus: 'simulated',
    workflowSteps: [1],
    relatedPaths: ['data/generated/guidelines/', 'data/generated/control-catalog/'],
  },
  {
    name: 'Product Hub',
    type: 'Document management system',
    role: 'Repository for versioned technical and operational documents',
    readsFrom: ['SDD v1', 'Operating Manual v1'],
    writesTo: ['SDD v2', 'Operating Manual v2'],
    implementation: 'Local file system at data/raw/product-hub/ and data/generated/product-hub/',
    simulationStatus: 'simulated',
    workflowSteps: [1, 5],
    relatedPaths: ['data/raw/product-hub/', 'data/generated/product-hub/'],
  },
  {
    name: 'Control Catalogue',
    type: 'Control activity repository',
    role: 'Stores and manages control activities',
    readsFrom: ['control_activities_before.csv'],
    writesTo: ['control_activities_after.csv'],
    implementation: 'Local CSV file at data/raw/control-catalog/',
    simulationStatus: 'simulated',
    workflowSteps: [1, 2],
    relatedPaths: ['data/raw/control-catalog/', 'data/generated/control-catalog/'],
  },
  {
    name: 'GitHub / Azure DevOps',
    type: 'Version control and pull request workflow',
    role: 'Hosts infrastructure-as-code changes and pull request approval workflow',
    readsFrom: ['infra/it-app-x/main.tf'],
    writesTo: ['infra/it-app-x/backup.tf (simulated PR)'],
    implementation: 'Local IaC file system. PR simulated in local SQLite.',
    simulationStatus: 'simulated',
    workflowSteps: [2],
    relatedPaths: ['infra/it-app-x/'],
  },
  {
    name: 'Copilot',
    type: 'AI-assisted infrastructure code generation',
    role: 'Generates the backup.tf Terraform configuration',
    readsFrom: ['Approved Control Activity', 'main.tf'],
    writesTo: ['backup.tf'],
    implementation: 'Local AI service (OpenAI / deterministic fallback)',
    simulationStatus: 'simulated',
    workflowSteps: [2],
    relatedPaths: ['infra/it-app-x/backup.tf'],
  },
  {
    name: 'Azure OneCloud',
    type: 'Cloud infrastructure platform',
    role: 'Target deployment environment for backup configuration',
    readsFrom: [],
    writesTo: ['Simulated resource state (it_app_x_resources_after.json)'],
    implementation: 'Simulated Azure state in data/generated/azure/',
    simulationStatus: 'simulated',
    workflowSteps: [2, 3],
    relatedPaths: ['data/generated/azure/'],
  },
  {
    name: 'Azure Policy',
    type: 'Policy compliance evaluation engine',
    role: 'Evaluates resource configuration against backup and geo-redundancy policies',
    readsFrom: ['backup_policy_definition.json', 'it_app_x_resources_*.json'],
    writesTo: ['policy_evaluation_after.json'],
    implementation: 'Local policy engine in lib/policy-engine.ts',
    simulationStatus: 'simulated',
    workflowSteps: [3],
    relatedPaths: ['data/raw/azure/', 'data/generated/azure/'],
  },
  {
    name: 'Azure APIs',
    type: 'Azure resource management API',
    role: 'Source of resource configuration data for policy evaluation',
    readsFrom: ['it_app_x_resources_before.json'],
    writesTo: ['it_app_x_resources_after.json'],
    implementation: 'Simulated: local JSON files representing API responses',
    simulationStatus: 'simulated',
    workflowSteps: [3, 4],
    relatedPaths: ['data/raw/azure/', 'data/generated/azure/'],
  },
  {
    name: 'DDCR',
    type: 'Digital Data and Controls Repository',
    role: 'Tracks fulfilment status of control work products per application',
    readsFrom: ['ddcr_export_before.csv', 'Policy evaluation result'],
    writesTo: ['DDCR SQLite record', 'ddcr_export_after.csv'],
    implementation: 'Local SQLite database (data/aoc.db) seeded from CSV',
    simulationStatus: 'simulated',
    workflowSteps: [4],
    relatedPaths: ['data/raw/ddcr/', 'data/generated/ddcr/'],
  },
  {
    name: 'Maya Doc Gen',
    type: 'Document generation service',
    role: 'Generates updated SDD and Operating Manual from deployed configuration',
    readsFrom: ['SDD v1', 'Operating Manual v1', 'backup.tf', 'Azure after-state'],
    writesTo: ['SDD v2', 'Operating Manual v2'],
    implementation: 'Local docx-service.ts using mammoth (read) and docx (generate)',
    simulationStatus: 'simulated',
    workflowSteps: [5],
    relatedPaths: ['data/generated/product-hub/'],
  },
  {
    name: 'RQMT / HCL',
    type: 'Requirements and compliance management tool',
    role: 'Generates audit responses from the full evidence graph',
    readsFrom: ['All generated artefacts', 'DDCR record', 'Policy evaluation'],
    writesTo: ['Audit response DOCX', 'Evidence manifest JSON'],
    implementation: 'Local evidence assembly service in API routes',
    simulationStatus: 'simulated',
    workflowSteps: [6],
    relatedPaths: ['data/generated/evidence/'],
  },
]

const STEP_LABELS: Record<number, string> = {
  1: 'Define',
  2: 'Integrate',
  3: 'Verify',
  4: 'Report',
  5: 'Document',
  6: 'Prove',
}

function SystemInitials({ name }: { name: string }) {
  const initials = name
    .split(/[\s\/]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div
      style={{
        width: '36px',
        height: '36px',
        borderRadius: 'var(--radius)',
        background: 'var(--mr-light-blue)',
        color: 'var(--mr-midnight-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '0.75rem',
        flexShrink: 0,
        border: '1px solid var(--color-border)',
      }}
    >
      {initials}
    </div>
  )
}

function SimBadge() {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.1875rem 0.5rem',
        fontSize: '0.625rem',
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        background: 'var(--mr-light-grey)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
      }}
    >
      SIMULATED INTEGRATION
    </span>
  )
}

function LiveBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0.1875rem 0.5rem',
        fontSize: '0.625rem',
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        background: 'rgba(26,124,89,0.08)',
        color: 'var(--color-success)',
        border: '1px solid rgba(26,124,89,0.25)',
        borderRadius: 'var(--radius)',
      }}
    >
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
      LIVE INTEGRATION
    </span>
  )
}

function SystemCard({ system }: { system: SystemDef }) {
  return (
    <div
      className="bg-white flex flex-col"
      style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Card header */}
      <div
        className="flex items-start gap-3 p-4"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <SystemInitials name={system.name} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--mr-midnight-blue)' }}>
            {system.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {system.type}
          </p>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex-1 space-y-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {/* Role */}
        <p>{system.role}</p>

        {/* Steps */}
        <div className="flex flex-wrap gap-1">
          {system.workflowSteps.map(s => (
            <span
              key={s}
              style={{
                padding: '0.125rem 0.5rem',
                background: 'var(--mr-light-blue)',
                color: 'var(--mr-midnight-blue)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.6875rem',
                fontWeight: 600,
              }}
            >
              Step {s}: {STEP_LABELS[s]}
            </span>
          ))}
        </div>

        {/* Reads */}
        {system.readsFrom.length > 0 && (
          <div>
            <p className="font-semibold mb-0.5" style={{ color: 'var(--mr-midnight-blue)' }}>Reads:</p>
            {system.readsFrom.map((r, i) => (
              <div key={i}>· {r}</div>
            ))}
          </div>
        )}

        {/* Writes */}
        {system.writesTo.length > 0 && (
          <div>
            <p className="font-semibold mb-0.5" style={{ color: 'var(--mr-midnight-blue)' }}>Writes:</p>
            {system.writesTo.map((w, i) => (
              <div key={i}>· {w}</div>
            ))}
          </div>
        )}

        {/* Implementation */}
        <div>
          <p className="font-semibold mb-0.5" style={{ color: 'var(--mr-midnight-blue)' }}>Implementation:</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
            {system.implementation}
          </p>
        </div>
      </div>

      {/* Card footer */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--color-border)', background: 'var(--mr-light-grey)', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}
      >
        {system.simulationStatus === 'simulated' ? <SimBadge /> : <LiveBadge />}
        {system.relatedPaths.length > 0 && (
          <span
            className="text-xs"
            title={system.relatedPaths.join('\n')}
            style={{ color: 'var(--color-text-muted)', cursor: 'default' }}
          >
            {system.relatedPaths.length} path{system.relatedPaths.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

export default function SystemMapPage() {
  // Group systems by primary workflow step
  const stepGroups: Record<number, SystemDef[]> = {}
  for (const sys of SYSTEMS) {
    const primaryStep = sys.workflowSteps[0]
    if (!stepGroups[primaryStep]) stepGroups[primaryStep] = []
    stepGroups[primaryStep].push(sys)
  }

  const sortedSteps = Object.keys(stepGroups).map(Number).sort((a, b) => a - b)

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--mr-midnight-blue)' }}>
          System Map
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          All systems involved in the DORA Article 12 compliance workflow — IT App X
        </p>
        <div
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs"
          style={{ background: 'var(--mr-light-grey)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <span style={{ fontWeight: 700, color: 'var(--mr-midnight-blue)' }}>{SYSTEMS.length} systems</span>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span>{SYSTEMS.filter(s => s.simulationStatus === 'simulated').length} simulated integrations</span>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span>{SYSTEMS.filter(s => s.simulationStatus === 'live').length} live integrations</span>
        </div>
        <p
          className="mt-3 text-xs px-3 py-2 rounded"
          style={{
            background: 'var(--mr-light-blue)',
            color: 'var(--mr-midnight-blue)',
            border: '1px solid var(--color-border)',
            maxWidth: '640px',
          }}
        >
          All systems marked <strong>SIMULATED INTEGRATION</strong> are demonstrator connections using local files and
          databases. No production systems are connected in this demonstrator.
        </p>
      </div>

      {/* Systems grouped by step */}
      {sortedSteps.map(step => (
        <div key={step}>
          {/* Step group header */}
          <div
            className="flex items-center gap-3 mb-4 pb-2"
            style={{ borderBottom: '2px solid var(--mr-vibrant-blue)' }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded"
              style={{
                background: 'var(--mr-vibrant-blue)',
                color: 'white',
              }}
            >
              Step {step}
            </span>
            <span className="font-semibold" style={{ color: 'var(--mr-midnight-blue)' }}>
              {STEP_LABELS[step]}
            </span>
          </div>

          {/* Cards grid */}
          <div
            className={clsx(
              'grid gap-4',
              stepGroups[step].length === 1
                ? 'grid-cols-1 max-w-sm'
                : stepGroups[step].length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3',
            )}
          >
            {stepGroups[step].map(system => (
              <SystemCard key={system.name} system={system} />
            ))}
          </div>

          {/* Note systems that also appear in other steps */}
          {stepGroups[step].some(s => s.workflowSteps.length > 1) && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              * Some systems participate in multiple steps — shown under their primary step.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
