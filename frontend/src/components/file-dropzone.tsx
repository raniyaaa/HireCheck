"use client"

import { useRef, useState } from "react"
import { CloudUploadIcon, FileTextIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Same list the backend accepts (batch_processor.SUPPORTED_FORMATS) and the
// Streamlit uploader allowed.
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

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <p id="dropzone-label" className="mb-2 text-sm">
        Upload PDF or image resumes (multiple files supported)
      </p>
      <div
        role="group"
        aria-labelledby="dropzone-label"
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
          "flex flex-col items-start gap-4 rounded-lg border border-dashed border-transparent bg-muted p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
          dragging && "border-primary bg-primary/5",
          disabled && "opacity-60",
        )}
      >
        <div className="flex items-center gap-3">
          <CloudUploadIcon className="size-9 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm">Drag and drop files here</p>
            <p className="text-xs text-muted-foreground">Supported: PDF, JPG, JPEG, PNG, BMP, TIFF</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="bg-background"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
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
        <div className="mt-3">
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {files.map((f, i) => (
              <li key={fileKey(f)} className="flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1.5">
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
                  size="icon-xs"
                  disabled={disabled}
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${f.name}`}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
          {files.length > 1 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-1 px-0 text-muted-foreground"
              disabled={disabled}
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
