import { NextResponse } from 'next/server'
import * as path from 'path'

export async function GET() {
  return NextResponse.json({
    root: path.resolve(process.cwd(), 'data'),
    platform: process.platform
  })
}
