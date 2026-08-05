import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const DATA_ROOT = path.join(process.cwd(), 'data')
const INFRA_ROOT = path.join(process.cwd(), 'infra')

export const Paths = {
  raw: {
    eurlex: path.join(DATA_ROOT, 'raw/eurlex/dora_article_12.html'),
    guidelineV1: path.join(DATA_ROOT, 'raw/guidelines/Backup_Restore_Guideline_v1.docx'),
    guidelineV2Template: path.join(DATA_ROOT, 'raw/guidelines/Backup_Restore_Guideline_v2_template.txt'),
    controlsBefore: path.join(DATA_ROOT, 'raw/control-catalog/control_activities_before.csv'),
    azurePolicyDef: path.join(DATA_ROOT, 'raw/azure/backup_policy_definition.json'),
    azureGeoPolicyDef: path.join(DATA_ROOT, 'raw/azure/backup_geo_policy_definition.json'),
    azureResourcesBefore: path.join(DATA_ROOT, 'raw/azure/it_app_x_resources_before.json'),
    ddcrBefore: path.join(DATA_ROOT, 'raw/ddcr/ddcr_export_before.csv'),
    sddV1: path.join(DATA_ROOT, 'raw/product-hub/IT_App_X_SDD_v1.docx'),
    omV1: path.join(DATA_ROOT, 'raw/product-hub/IT_App_X_Operating_Manual_v1.docx'),
  },
  normalized: {
    eurlex: path.join(DATA_ROOT, 'normalized/eurlex_article12.json'),
    guideline: path.join(DATA_ROOT, 'normalized/guideline_v1.json'),
    controls: path.join(DATA_ROOT, 'normalized/control_activities.json'),
    azurePolicy: path.join(DATA_ROOT, 'normalized/azure_policy_definitions.json'),
    azureResources: path.join(DATA_ROOT, 'normalized/azure_resources_before.json'),
    ddcr: path.join(DATA_ROOT, 'normalized/ddcr_baseline.json'),
    sdd: path.join(DATA_ROOT, 'normalized/sdd_v1.json'),
    om: path.join(DATA_ROOT, 'normalized/operating_manual_v1.json'),
  },
  generated: {
    guidelineV2: path.join(DATA_ROOT, 'generated/guidelines/Backup_Restore_Guideline_v2.docx'),
    controlsAfter: path.join(DATA_ROOT, 'generated/control-catalog/control_activities_after.csv'),
    backupTf: path.join(INFRA_ROOT, 'it-app-x/backup.tf'),
    azureResourcesAfter: path.join(DATA_ROOT, 'generated/azure/it_app_x_resources_after.json'),
    policyEvalAfter: path.join(DATA_ROOT, 'generated/azure/policy_evaluation_after.json'),
    ddcrAfter: path.join(DATA_ROOT, 'generated/ddcr/ddcr_export_after.csv'),
    sddV2: path.join(DATA_ROOT, 'generated/product-hub/IT_App_X_SDD_v2.docx'),
    omV2: path.join(DATA_ROOT, 'generated/product-hub/IT_App_X_Operating_Manual_v2.docx'),
    auditResponse: path.join(DATA_ROOT, 'generated/evidence/DORA_Article_12_Audit_Response.docx'),
    evidenceManifest: path.join(DATA_ROOT, 'generated/evidence/evidence_manifest.json'),
  },
  evidence: {
    transformLog: path.join(DATA_ROOT, 'evidence/transformation_log.jsonl'),
  },
  infra: {
    mainTf: path.join(INFRA_ROOT, 'it-app-x/main.tf'),
    variablesTf: path.join(INFRA_ROOT, 'it-app-x/variables.tf'),
    backupTf: path.join(INFRA_ROOT, 'it-app-x/backup.tf'),
  },
}

export function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return ''
  const content = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function hashString(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

export function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

export function writeTextFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

export interface TransformLogEntry {
  timestamp: string
  transformationId: string
  sourceSystem: string
  sourceFile: string
  sourceVersion: string
  sourceHash: string
  targetFile: string
  targetVersion: string
  targetHash: string
  operation: string
  actor: string
  approvalId?: string
  correlationId: string
}

export function appendTransformLog(entry: TransformLogEntry): void {
  fs.mkdirSync(path.dirname(Paths.evidence.transformLog), { recursive: true })
  fs.appendFileSync(Paths.evidence.transformLog, JSON.stringify(entry) + '\n', 'utf-8')
}

export function readTransformLog(): TransformLogEntry[] {
  if (!fs.existsSync(Paths.evidence.transformLog)) return []
  return fs.readFileSync(Paths.evidence.transformLog, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as TransformLogEntry)
}

export function getFileMetadata(filePath: string): {
  exists: boolean
  size?: number
  hash?: string
  modifiedAt?: string
} {
  if (!fs.existsSync(filePath)) return { exists: false }
  const stat = fs.statSync(filePath)
  return {
    exists: true,
    size: stat.size,
    hash: hashFile(filePath),
    modifiedAt: stat.mtime.toISOString(),
  }
}

/** Delete all generated artefacts (for reset).
 *  Returns a list of files that could not be deleted (e.g. locked by Word on Windows).
 */
export function deleteGeneratedArtefacts(): { skipped: string[] } {
  const skipped: string[] = []
  const generatedDir = path.join(DATA_ROOT, 'generated')
  const normalizedDir = path.join(DATA_ROOT, 'normalized')

  deleteDirectoryContents(generatedDir, skipped)
  deleteDirectoryContents(normalizedDir, skipped)

  // Delete backup.tf
  if (fs.existsSync(Paths.infra.backupTf)) {
    try {
      fs.unlinkSync(Paths.infra.backupTf)
    } catch {
      skipped.push(Paths.infra.backupTf)
    }
  }

  // Clear transformation log (truncate, don't delete — never locked)
  try {
    if (fs.existsSync(Paths.evidence.transformLog)) {
      fs.writeFileSync(Paths.evidence.transformLog, '', 'utf-8')
    }
  } catch { /* ignore */ }

  return { skipped }
}

function deleteDirectoryContents(dir: string, skipped: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.name === '.gitkeep') continue
    if (entry.isDirectory()) {
      deleteDirectoryContents(full, skipped)
    } else {
      try {
        fs.unlinkSync(full)
      } catch {
        // File locked (e.g. open in Word/Excel on Windows) — skip gracefully
        skipped.push(full)
      }
    }
  }
}
