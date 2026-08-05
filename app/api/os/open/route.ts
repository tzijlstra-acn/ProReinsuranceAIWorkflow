import { NextRequest, NextResponse } from 'next/server'
import * as path from 'path'
import * as fs from 'fs'
import { spawn } from 'child_process'

// Allowlisted root — only paths inside this directory can be opened
const ARTIFACT_ROOT = path.resolve(
  process.env.AOC_ARTIFACT_ROOT ?? path.join(process.cwd(), 'data')
)

function isPathAllowed(requestedPath: string): boolean {
  const resolved = path.resolve(requestedPath)
  // Must start with ARTIFACT_ROOT
  return resolved.startsWith(ARTIFACT_ROOT + path.sep) || resolved === ARTIFACT_ROOT
}

function openInOsFilerSync(targetPath: string, reveal: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform
    let cmd: string
    let args: string[]

    if (platform === 'win32') {
      cmd = 'explorer.exe'
      args = reveal ? ['/select,', targetPath] : [targetPath]
    } else if (platform === 'darwin') {
      cmd = 'open'
      args = reveal ? ['-R', targetPath] : [targetPath]
    } else {
      // Linux: open containing folder
      const dirPath = fs.statSync(targetPath).isDirectory() ? targetPath : path.dirname(targetPath)
      cmd = 'xdg-open'
      args = [dirPath]
    }

    // IMPORTANT: use spawn with args array, never shell interpolation
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
    child.unref()
    child.on('error', reject)
    resolve()
  })
}

export async function POST(request: NextRequest) {
  let body: { path: string; action: 'open' | 'reveal' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { path: requestedPath, action } = body

  if (!requestedPath || typeof requestedPath !== 'string') {
    return NextResponse.json({ error: 'Path required' }, { status: 400 })
  }

  if (!isPathAllowed(requestedPath)) {
    return NextResponse.json({ error: 'Path not in allowed root' }, { status: 403 })
  }

  const resolvedPath = path.resolve(requestedPath)

  if (!fs.existsSync(resolvedPath)) {
    return NextResponse.json({ error: 'Path does not exist' }, { status: 404 })
  }

  try {
    await openInOsFilerSync(resolvedPath, action === 'reveal')
    return NextResponse.json({ ok: true, path: resolvedPath, platform: process.platform })
  } catch (err) {
    // Fallback: can't open OS, return the path for copy
    return NextResponse.json({
      ok: false,
      fallback: true,
      absolutePath: resolvedPath,
      error: String(err)
    }, { status: 200 }) // 200 so frontend can handle gracefully
  }
}
