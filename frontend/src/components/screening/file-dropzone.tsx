"use client"

import { useRef, useState } from "react"
import { FileTextIcon, UploadIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Same list the backend accepts (batch_processor.SUPPORTED_FORMATS).
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"]

function isAccepted(name: string): boolean {
  const dot = name.lastIndexOf(".")
  return dot !== -1 && ACCEPTED_EXTENSIONS.includes(name.slice(dot).toLowerCase())
}

function fileKey(f: File): string {
  return `${f.name}:${f.size}:${f.lastModified}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileDropzone({
  files,
  onChange,
  disabled,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    const rejected = incoming.filter((f) => !isAccepted(f.name))
    if (rejected.length > 0) {
      toast.warning(`Unsupported file type: ${rejected.map((f) => f.name).join(", ")}`)
    }
    const seen = new Set(files.map(fileKey))
    const added = incoming.filter((f) => {
      if (!isAccepted(f.name)) return false
      const key = fileKey(f)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (added.length > 0) onChange([...files, ...added])
  }

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Resume files"
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) addFiles(e.dataTransfer.files)
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors sm:px-6",
          dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
          disabled && "opacity-60",
        )}
      >
        <div className="flex size-10 items-center justify-center rounded-full border bg-background shadow-xs">
          <UploadIcon className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            <span className="hidden sm:inline">Drag and drop resumes here</span>
            <span className="sm:hidden">Add resumes from your device</span>
          </p>
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG, BMP or TIFF</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = "" // allow re-selecting the same file after removing it
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border bg-background">
            {files.map((f, i) => (
              <li key={fileKey(f)} className="flex items-center gap-3 px-3 py-2">
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" title={f.name}>
                    {f.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                  aria-label={`Remove ${f.name}`}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {files.length} {files.length === 1 ? "file" : "files"} selected
            </span>
            {files.length > 1 && (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0 text-muted-foreground"
                disabled={disabled}
                onClick={() => onChange([])}
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
