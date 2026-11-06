"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2Icon, MenuIcon, PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AdminPanel } from "@/components/admin-panel"
import { AppSidebar } from "@/components/app-sidebar"
import { Callout, Divider, FullPageLoader, Subheader, Title, type CalloutVariant } from "@/components/display"
import { FileDropzone } from "@/components/file-dropzone"
import { ResultsSection } from "@/components/results-section"
import { useBackendHealth } from "@/hooks/use-backend-health"
import { ApiError, getMe, isUnauthorized, processResumes, type Candidate } from "@/lib/api"
import { useAuth, type AuthUser } from "@/lib/auth"
import { newSessionId } from "@/lib/session"

const SESSION_EXPIRED = "Session expired. Please log in again."

/** Route entry: waits for auth to load, bounces to /login if signed out. */
export function DashboardPage() {
  const { ready, user } = useAuth()

  useEffect(() => {
    // Full page load (not router.replace) so no in-memory state survives.
    if (ready && !user) window.location.replace("/login")
  }, [ready, user])

  if (!ready || !user) return <FullPageLoader />
  // Keyed by username: a different user never inherits this one's state.
  return <Dashboard key={user.username} user={user} />
}

interface Notice {
  variant: CalloutVariant
  text: string
}

function Dashboard({ user }: { user: AuthUser }) {
  const { signOut, updateRole } = useAuth()
  const { online } = useBackendHealth()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Sidebar inputs
  const [jobDescription, setJobDescription] = useState("")
  const [idealProfile, setIdealProfile] = useState("")
  const [acceptThreshold, setAcceptThreshold] = useState(18)
  const [reviewThreshold, setReviewThreshold] = useState(15)
  const [sessionId, setSessionId] = useState(newSessionId)

  // Upload + processing
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null) // null = processing block hidden
  const [status, setStatus] = useState<Notice | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])

  // Results
  const [results, setResults] = useState<Candidate[]>([])
  const [processed, setProcessed] = useState(false)
  const [runId, setRunId] = useState(0)

  // Confirm the stored token is still valid, and pick up any role change.
  useEffect(() => {
    let cancelled = false
    getMe(user.token)
      .then((me) => {
        if (!cancelled) updateRole(me.role)
      })
      .catch((err) => {
        if (!cancelled && isUnauthorized(err)) signOut(SESSION_EXPIRED)
      })
    return () => {
      cancelled = true
    }
  }, [user.token, updateRole, signOut])

  function handleAcceptThresholdChange(v: number) {
    setAcceptThreshold(v)
    setReviewThreshold((r) => Math.min(r, v)) // review range is capped at the accept threshold
  }

  function handleNewSession() {
    setSessionId(newSessionId())
    setResults([])
    setProcessed(false)
    setProgress(null)
    setStatus(null)
    setSkipped([])
  }

  const hasJd = jobDescription.trim().length > 0
  const hasIdeal = idealProfile.trim().length > 0
  const canProcess = files.length > 0 && hasJd && hasIdeal && online === true && !busy

  async function handleProcess() {
    if (!canProcess) return
    setBusy(true)
    setSkipped([])
    setProgress(10)
    setStatus({ variant: "info", text: "Sending resumes to backend..." })

    const request = processResumes(user.token, {
      files,
      jobDescription,
      idealReference: idealProfile,
      sessionId,
      acceptThreshold,
      reviewThreshold,
    })
    setProgress(30)
    setStatus({ variant: "info", text: "LangGraph Pipeline running — AI agents evaluating resumes..." })

    try {
      const data = await request
      setResults(data.results ?? [])
      setProcessed(true)
      setRunId((n) => n + 1)
      setSkipped(data.skipped ?? [])
      setProgress(100)
      setStatus({ variant: "success", text: `Done! ${data.processed ?? 0} resume(s) processed.` })
    } catch (err) {
      if (isUnauthorized(err)) {
        signOut(SESSION_EXPIRED)
        return
      }
      let text: string
      if (err instanceof ApiError && err.kind === "timeout") {
        text = "Request timed out. Try fewer resumes or check backend."
      } else if (err instanceof ApiError && err.kind === "http") {
        text = `❌ Backend error: ${err.message}`
      } else {
        text = `❌ Error: ${err instanceof Error ? err.message : String(err)}`
      }
      setStatus({ variant: "error", text })
    } finally {
      setBusy(false)
    }
  }

  let hint: Notice | null = null
  if (!hasJd) hint = { variant: "warning", text: "Please add a Job Description in the sidebar" }
  else if (!hasIdeal) hint = { variant: "warning", text: "Please add an Ideal Candidate Profile in the sidebar" }
  else if (online === false) hint = { variant: "error", text: "The backend is offline — see the status in the sidebar" }

  return (
    <div className="flex min-h-svh">
      <AppSidebar
        user={user}
        backendOnline={online}
        jobDescription={jobDescription}
        onJobDescriptionChange={setJobDescription}
        idealProfile={idealProfile}
        onIdealProfileChange={setIdealProfile}
        acceptThreshold={acceptThreshold}
        onAcceptThresholdChange={handleAcceptThresholdChange}
        reviewThreshold={reviewThreshold}
        onReviewThresholdChange={setReviewThreshold}
        sessionId={sessionId}
        onNewSession={handleNewSession}
        newSessionDisabled={busy}
        onLogout={() => signOut()}
        open={sidebarOpen}
        onClose={closeSidebar}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: the sidebar becomes a drawer below the lg breakpoint */}
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            aria-controls="app-sidebar"
            aria-expanded={sidebarOpen}
          >
            <MenuIcon />
          </Button>
          <span className="font-semibold">🔍 HireCheck ATS</span>
        </div>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
          <Title>HireCheck — AI Resume Screening</Title>
          <Divider />

          {/* Upload + process */}
          <Subheader className="mb-4">Upload Resumes</Subheader>
          <FileDropzone files={files} onChange={setFiles} disabled={busy} />
          {files.length > 0 && (
            <Callout variant="success" className="mt-4">
              ✅ {files.length} file(s) ready
            </Callout>
          )}

          <div className="mt-5">
            <Button size="lg" onClick={() => void handleProcess()} disabled={!canProcess}>
              {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlayIcon aria-hidden />}
              {busy ? "Processing…" : "Process Resumes"}
            </Button>
          </div>
          {hint && (
            <Callout variant={hint.variant} className="mt-4">
              <span className="hidden lg:inline">⬅ </span>
              {hint.text}
              <Button variant="link" size="sm" className="ml-1 h-auto p-0 lg:hidden" onClick={() => setSidebarOpen(true)}>
                Open sidebar
              </Button>
            </Callout>
          )}

          {/* Processing */}
          {progress !== null && (
            <section aria-live="polite">
              <Divider />
              <Subheader>Processing...</Subheader>
              <Progress value={progress} className="mt-4" aria-label="Processing progress" />
              {status && (
                <Callout variant={status.variant} className="mt-4">
                  {status.text}
                </Callout>
              )}
              {skipped.length > 0 && (
                <Callout variant="warning" className="mt-3">
                  ⚠️ Skipped (unsupported format): {skipped.join(", ")}
                </Callout>
              )}
            </section>
          )}

          {/* Results */}
          {processed && results.length > 0 && <ResultsSection key={runId} results={results} />}

          {/* Empty state */}
          {!processed && !busy && <EmptyState />}

          {/* Admin panel */}
          {user.role === "admin" && <AdminPanel user={user} refreshKey={runId} />}
        </main>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-5 py-20 text-center text-gray-400">
      <div className="text-7xl" aria-hidden>
        📄
      </div>
      <h3 className="mt-4 text-xl font-semibold text-gray-500">Ready to Screen Resumes</h3>
      <ol className="mt-4 space-y-2 text-base text-gray-500">
        <li>
          1. Paste a <b>Job Description</b> in the sidebar
        </li>
        <li>
          2. Describe your <b>Ideal Candidate</b> in the sidebar
        </li>
        <li>
          3. Upload <b>PDF or image resumes</b> above
        </li>
        <li>
          4. Click <b>▶ Process Resumes</b>
        </li>
      </ol>
    </div>
  )
}
