import { NextResponse } from 'next/server'
import * as path from 'path'
import { Paths, getFileMetadata } from '@/lib/fs-service'

type FileLayer = 'raw' | 'normalized' | 'generated' | 'evidence' | 'infra'
type FileStatus = 'baseline' | 'generated'

interface FileEntry {
  path: string
  relativePath: string
  exists: boolean
  format: string
  size?: number
  hash?: string
  modifiedAt?: string
  layer: FileLayer
  status: FileStatus
}

interface FileSpec {
  path: string
  layer: FileLayer
  status: FileStatus
}

function extOf(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase() || 'unknown'
}

function relPath(filePath: string): string {
  return filePath.replace(process.cwd() + path.sep, '').replace(/\\/g, '/')
}

const FILE_SPECS: FileSpec[] = [
  // Raw (baseline)
  { path: Paths.raw.eurlex, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.guidelineV1, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.guidelineV2Template, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.controlsBefore, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.azurePolicyDef, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.azureGeoPolicyDef, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.azureResourcesBefore, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.ddcrBefore, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.sddV1, layer: 'raw', status: 'baseline' },
  { path: Paths.raw.omV1, layer: 'raw', status: 'baseline' },
  // Infra baseline
  { path: Paths.infra.mainTf, layer: 'infra', status: 'baseline' },
  { path: Paths.infra.variablesTf, layer: 'infra', status: 'baseline' },
  { path: Paths.infra.backupTf, layer: 'infra', status: 'generated' },
  // Normalized
  { path: Paths.normalized.eurlex, layer: 'normalized', status: 'generated' },
  { path: Paths.normalized.guideline, layer: 'normalized', status: 'generated' },
  { path: Paths.normalized.controls, layer: 'normalized', status: 'generated' },
  { path: Paths.normalized.azurePolicy, layer: 'normalized', status: 'generated' },
  { path: Paths.normalized.azureResources, layer: 'normalized', status: 'generated' },
  { path: Paths.normalized.ddcr, layer: 'normalized', status: 'generated' },
  { path: Paths.normalized.sdd, layer: 'normalized', status: 'generated' },
  { path: Paths.normalized.om, layer: 'normalized', status: 'generated' },
  // Generated
  { path: Paths.generated.guidelineV2, layer: 'generated', status: 'generated' },
  { path: Paths.generated.controlsAfter, layer: 'generated', status: 'generated' },
  { path: Paths.generated.azureResourcesAfter, layer: 'generated', status: 'generated' },
  { path: Paths.generated.policyEvalAfter, layer: 'generated', status: 'generated' },
  { path: Paths.generated.ddcrAfter, layer: 'generated', status: 'generated' },
  { path: Paths.generated.sddV2, layer: 'generated', status: 'generated' },
  { path: Paths.generated.omV2, layer: 'generated', status: 'generated' },
  { path: Paths.generated.auditResponse, layer: 'generated', status: 'generated' },
  { path: Paths.generated.evidenceManifest, layer: 'generated', status: 'generated' },
  // Evidence log
  { path: Paths.evidence.transformLog, layer: 'evidence', status: 'generated' },
]

export async function GET() {
  const files: FileEntry[] = FILE_SPECS.map((spec) => {
    const meta = getFileMetadata(spec.path)
    return {
      path: spec.path,
      relativePath: relPath(spec.path),
      exists: meta.exists,
      format: extOf(spec.path),
      size: meta.size,
      hash: meta.hash,
      modifiedAt: meta.modifiedAt,
      layer: spec.layer,
      status: spec.status,
    }
  })

  return NextResponse.json({ files })
}
