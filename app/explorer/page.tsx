import { FileExplorer } from '@/components/FileExplorer'

export default function ExplorerPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[#003781] text-sm font-semibold mb-1">File System</p>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Source &amp; Artefact Explorer</h1>
        <p className="text-[#4A5568] text-sm mt-1">Browse all raw sources, normalized data, and generated artefacts in the pipeline.</p>
      </div>
      <FileExplorer />
    </div>
  )
}
