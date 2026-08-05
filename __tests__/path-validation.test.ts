import { describe, it, expect } from 'vitest'
import * as path from 'path'

// Test the allowlist logic without actually spawning OS commands
const ARTIFACT_ROOT = path.resolve(process.cwd(), 'data')

function isPathAllowed(requestedPath: string): boolean {
  const resolved = path.resolve(requestedPath)
  return resolved.startsWith(ARTIFACT_ROOT + path.sep) || resolved === ARTIFACT_ROOT
}

describe('Path allowlist validation', () => {
  it('allows paths inside the artifact root', () => {
    expect(isPathAllowed(path.join(ARTIFACT_ROOT, 'generated/guidelines/file.docx'))).toBe(true)
  })

  it('allows the artifact root itself', () => {
    expect(isPathAllowed(ARTIFACT_ROOT)).toBe(true)
  })

  it('rejects paths outside the artifact root', () => {
    expect(isPathAllowed(path.resolve(process.cwd(), '.env'))).toBe(false)
    expect(isPathAllowed(path.resolve(process.cwd(), '.env.local'))).toBe(false)
    expect(isPathAllowed('C:/Windows/System32')).toBe(false)
  })

  it('rejects path traversal attempts', () => {
    expect(isPathAllowed(path.join(ARTIFACT_ROOT, '../.env'))).toBe(false)
    expect(isPathAllowed(path.join(ARTIFACT_ROOT, '../../package.json'))).toBe(false)
  })

  it('rejects empty or null-like paths', () => {
    expect(isPathAllowed('')).toBe(false)
    expect(isPathAllowed('.')).toBe(false)
  })
})
