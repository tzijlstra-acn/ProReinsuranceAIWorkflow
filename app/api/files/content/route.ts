import { NextRequest, NextResponse } from 'next/server'
import * as path from 'path'
import * as fs from 'fs'
import { extractDocxText } from '@/lib/docx-service'
import { readTransformLog } from '@/lib/fs-service'

const SAFE_BASE_DIRS = [
  path.join(process.cwd(), 'data'),
  path.join(process.cwd(), 'infra'),
]

function isSafePath(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  return SAFE_BASE_DIRS.some(base => resolved.startsWith(base))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const relativePathParam = searchParams.get('path')

    if (!relativePathParam) {
      return NextResponse.json({ error: 'Missing ?path= parameter' }, { status: 400 })
    }

    // Resolve against cwd — prevent path traversal
    const filePath = path.resolve(process.cwd(), relativePathParam)

    if (!isSafePath(filePath)) {
      return NextResponse.json({ error: 'Access denied — path outside allowed directories' }, { status: 403 })
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found', path: relativePathParam }, { status: 404 })
    }

    const ext = path.extname(filePath).toLowerCase()

    switch (ext) {
      case '.json': {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        return NextResponse.json({ format: 'json', content })
      }
      case '.jsonl': {
        const content = readTransformLog()
        return NextResponse.json({ format: 'jsonl', content })
      }
      case '.csv':
      case '.html':
      case '.tf':
      case '.txt': {
        const content = fs.readFileSync(filePath, 'utf-8')
        return NextResponse.json({ format: ext.slice(1), content })
      }
      case '.docx': {
        const text = await extractDocxText(filePath)
        return NextResponse.json({ format: 'docx', content: text })
      }
      default:
        return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 415 })
    }
  } catch (err) {
    console.error('[Files Content]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
