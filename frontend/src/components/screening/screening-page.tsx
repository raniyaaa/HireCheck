"use client"

import { useState } from "react"
import { CheckIcon, FileSearchIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SESSION_EXPIRED } from "@/components/app-shell"
import { useBackendOnline } from "@/components/backend-status"
import { PageHeader } from "@/components/shared"
import { CriteriaCard } from "@/components/screening/criteria-card"
import { ResultsSection } from "@/components/screening/results-section"
import { UploadCard, type RunStatus } from "@/components/screening/upload-card"
import { ApiError, isUnauthorized, processResumes, type Candidate } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { newSessionId } from "@/lib/session"

export function ScreeningPage() {
  const { user, signOut } = useAuth()
  const online = useBackendOnline()

  // Criteria
  const [jobDescription, setJobDescription] = useState("")
  const [idealProfile, setIdealProfile] = useState("")
  const [acceptThreshold, setAcceptThreshold] = useState(18)
  const [reviewThreshold, setReviewThreshold] = useState(15)
  // Only rendered on the client (AppShell waits for auth), so this never runs during prerender.
  const [sessionId, setSessionId] = useState(newSessionId)

  // Upload + run
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<RunStatus | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])

  // Results
  const [results, setResults] = useState<Candidate[]>([])
  const [runId, setRunId] = useState(0)

  const hasJd = jobDescription.trim().length > 0
  const hasIdeal = idealProfile.trim().length > 0
  const canProcess = files.length > 0 && hasJd && hasIdeal && online === true && !busy

  let hint: string
  if (busy) hint = "Keep this page open while resumes are screened."
  else if (!hasJd) hint = "Add a job description to continue."
  else if (!hasIdeal) hint = "Add an ideal candidate profile to continue."
  else if (files.length === 0) hint = "Add at least one resume to continue."
  else if (online === null) hint = "Connecting to the backend…"
  else if (online === false) hint = "The backend is offline. Try again shortly."
  else hint = `${files.length} ${files.length === 1 ? "resume" : "resumes"} ready to screen.`

  function handleAcceptThresholdChange(v: number) {
    setAcceptThreshold(v)
    setReviewThreshold((r) => Math.min(r, v)) // the review band can't go above the accept threshold
  }

  function handleNewSession() {
    setSessionId(newSessionId())
    setResults([])
    setStatus(null)
    setSkipped([])
  }

  async function handleProcess() {
    if (!canProcess || !user) return
    setBusy(true)
    setStatus(null)
    setSkipped([])
    try {
      const data = await processResumes(user.token, {
        files,
        jobDescription,
        idealReference: idealProfile,
        sessionId,
        acceptThreshold,
        reviewThreshold,
      })
      const count = data.processed ?? 0
      setResults(data.results ?? [])
      setRunId((n) => n + 1)
      setSkipped(data.skipped ?? [])
      setStatus({ variant: "success", text: `Screened ${count} ${count === 1 ? "resume" : "resumes"}.` })
    } catch (err) {
      if (isUnauthorized(err)) {
        signOut(SESSION_EXPIRED)
        return
      }
      let text: string
      if (err instanceof ApiError && err.kind === "timeout") {
        text = "The request timed out. Try fewer resumes, or check that the backend is running."
      } else if (err instanceof ApiError && err.kind === "http") {
        text = `The backend returned an error: ${err.message}`
      } else {
        text = `Something went wrong: ${err instanceof Error ? err.message : String(err)}`
      }
      setStatus({ variant: "error", text })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume screening"
        description="Score resumes against a job description and an ideal candidate profile."
        actions={
          <>
            <span className="text-sm text-muted-foreground">
              Session{" "}
              <code className="ml-1 rounded-md border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                {sessionId}
              </code>
            </span>
            <Button variant="outline" size="sm" onClick={handleNewSession} disabled={busy}>
              <RotateCcwIcon aria-hidden />
              New session
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <CriteriaCard
          jobDescription={jobDescription}
          onJobDescriptionChange={setJobDescription}
          idealProfile={idealProfile}
          onIdealProfileChange={setIdealProfile}
          acceptThreshold={acceptThreshold}
          onAcceptThresholdChange={handleAcceptThresholdChange}
          reviewThreshold={reviewThreshold}
          onReviewThresholdChange={setReviewThreshold}
          disabled={busy}
        />

        <div className="min-w-0 space-y-6">
          <UploadCard
            files={files}
            onFilesChange={setFiles}
            busy={busy}
            canProcess={canProcess}
            hint={hint}
            status={status}
            skipped={skipped}
            onProcess={() => void handleProcess()}
          />

          {results.length > 0 && <ResultsSection key={runId} results={results} />}

          {results.length === 0 && !busy && (
            <GettingStarted
              steps={[
                { label: "Add a job description", done: hasJd },
                { label: "Describe the ideal candidate", done: hasIdeal },
                { label: "Upload resumes", done: files.length > 0 },
                { label: "Select Process resumes", done: false },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function GettingStarted({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <div className="rounded-xl border border-dashed bg-background/60 px-6 py-10 text-center sm:py-12">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
        <FileSearchIcon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-semibold">No results yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">Screened candidates will appear here.</p>
      <ol className="mx-auto mt-6 w-full max-w-xs space-y-2.5 text-left text-sm">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-3">
            {step.done ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CheckIcon className="size-3.5" aria-hidden />
              </span>
            ) : (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground">
                {i + 1}
              </span>
            )}
            <span className={step.done ? "text-muted-foreground" : undefined}>
              {step.label}
              {step.done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
