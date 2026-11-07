"use client"

import { Loader2Icon, PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { IndeterminateProgress, Notice, type NoticeVariant } from "@/components/shared"
import { FileDropzone } from "@/components/screening/file-dropzone"

export interface RunStatus {
  variant: NoticeVariant
  text: string
}

interface UploadCardProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  busy: boolean
  canProcess: boolean
  /** Why processing isn't possible yet, or what's ready. */
  hint: string
  status: RunStatus | null
  skipped: string[]
  onProcess: () => void
}

export function UploadCard({ files, onFilesChange, busy, canProcess, hint, status, skipped, onProcess }: UploadCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload resumes</CardTitle>
        <CardDescription>Add one or more resumes to screen in this session.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <FileDropzone files={files} onChange={onFilesChange} disabled={busy} />

        <div aria-live="polite" className="space-y-3 empty:hidden">
          {busy && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-hidden />
                Screening {files.length} {files.length === 1 ? "resume" : "resumes"}…
              </div>
              <IndeterminateProgress label="Screening resumes" />
              <p className="text-xs text-muted-foreground">
                The AI agents parse, score and summarise each resume. Large batches can take a few minutes.
              </p>
            </div>
          )}
          {!busy && status && <Notice variant={status.variant}>{status.text}</Notice>}
          {!busy && skipped.length > 0 && (
            <Notice variant="warning" title="Some files were skipped">
              Unsupported format: {skipped.join(", ")}
            </Notice>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <Button onClick={onProcess} disabled={!canProcess} className="w-full sm:w-auto">
          {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlayIcon aria-hidden />}
          {busy ? "Processing…" : "Process resumes"}
        </Button>
      </CardFooter>
    </Card>
  )
}
