// Typed client for the HireCheck FastAPI backend (backend/main.py).
// Every call goes straight from the browser to FastAPI, so long-running
// requests like /process are never subject to a hosting platform's
// serverless timeout.

export const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
).replace(/\/+$/, "")

// ── Response shapes ────────────────────────────────────────

export type Decision = "Accept" | "Human Review" | "Reject" | "Error"

export interface Candidate {
  candidate_name: string
  resume_path?: string
  jd_score: number
  reference_score: number
  final_score: number
  decision: Decision | string
  jd_reasons?: string[]
  jd_missing_skills?: string[]
  jd_strengths?: string[]
  jd_weaknesses?: string[]
  jd_explanation?: string
  reference_reasons?: string[]
  reference_strengths?: string[]
  reference_weaknesses?: string[]
  reference_explanation?: string
  missing_skills?: string[]
  strengths?: string[]
  summary?: string
  final_recommendation_reason?: string
  email_status?: string
  email_content?: string
  error?: string | null
}

export interface AuthResponse {
  access_token: string
  token_type: string
  role: string
  username: string
}

export interface ProcessResponse {
  session_id: string
  processed_by: string
  processed: number
  skipped: string[]
  results: Candidate[]
}

export interface SystemStats {
  total_candidates: number
  total_sessions: number
  total_users: number
  active_users: number
  decision_breakdown: Record<string, number>
  avg_final_score: number
}

export interface SessionSummary {
  session_id: string
  candidate_count: number
  accepted: number
  review: number
  rejected: number
  started_at: string | null
  last_updated: string | null
}

export interface UserRecord {
  id: number
  username: string
  role: string
  is_active: boolean | number
  created_at: string | null
}

// ── Errors ─────────────────────────────────────────────────

export type ApiErrorKind = "http" | "network" | "timeout"

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number

  constructor(kind: ApiErrorKind, status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.kind = kind
    this.status = status
  }
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}

/** Turns FastAPI's `{"detail": ...}` error bodies into a readable message. */
function detailMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === "string") return detail
    // Pydantic validation errors: [{loc: [...], msg: "..."}, ...]
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            const loc = (item as { loc?: unknown[] }).loc
            const field = Array.isArray(loc) ? loc[loc.length - 1] : undefined
            const msg = String((item as { msg: unknown }).msg)
            return field !== undefined ? `${field}: ${msg}` : msg
          }
          return JSON.stringify(item)
        })
        .join("; ")
    }
  }
  return fallback
}

// ── Core request helper ────────────────────────────────────

interface RequestOptions {
  method?: string
  token?: string
  json?: unknown
  body?: BodyInit
  timeoutMs?: number
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`

  let body = opts.body
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json"
    body = JSON.stringify(opts.json)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000)

  let res: Response
  let text: string
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    })
    text = await res.text()
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError("timeout", 0, "Request timed out")
    }
    throw new ApiError("network", 0, `Could not reach the backend at ${BACKEND_URL}`)
  } finally {
    clearTimeout(timer)
  }

  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    throw new ApiError("http", res.status, detailMessage(data, text || res.statusText))
  }
  return data as T
}

// ── Endpoints ──────────────────────────────────────────────

export async function checkHealth(timeoutMs = 5_000): Promise<boolean> {
  try {
    await request("/health", { timeoutMs })
    return true
  } catch {
    return false
  }
}

export function login(username: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    json: { username, password },
    timeoutMs: 30_000,
  })
}

export function signup(username: string, password: string, role: string) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    json: { username, password, role },
    timeoutMs: 30_000,
  })
}

export function getMe(token: string) {
  return request<{ username: string; role: string }>("/auth/me", { token })
}

export interface ProcessInput {
  files: File[]
  jobDescription: string
  idealReference: string
  sessionId: string
  acceptThreshold: number
  reviewThreshold: number
}

export function processResumes(token: string, input: ProcessInput) {
  const form = new FormData()
  for (const file of input.files) form.append("files", file, file.name)
  form.append("job_description", input.jobDescription)
  form.append("ideal_reference", input.idealReference)
  form.append("session_id", input.sessionId)
  form.append("accept_threshold", String(input.acceptThreshold))
  form.append("review_threshold", String(input.reviewThreshold))

  return request<ProcessResponse>("/process", {
    method: "POST",
    token,
    body: form,
    timeoutMs: 300_000, // same 5-minute budget the Streamlit UI used
  })
}

export function getAdminStats(token: string) {
  return request<SystemStats>("/admin/stats", { token })
}

export function getAdminSessions(token: string) {
  return request<{ sessions: SessionSummary[] }>("/admin/sessions", { token })
}

export function getAdminUsers(token: string) {
  return request<{ users: UserRecord[] }>("/admin/users", { token })
}

export function setUserActive(token: string, username: string, activate: boolean) {
  return request<{ message: string }>(
    `/admin/users/${encodeURIComponent(username)}/toggle-active?activate=${activate}`,
    { method: "POST", token },
  )
}

export function deleteSession(token: string, sessionId: string) {
  return request<{ message: string }>(
    `/admin/session/${encodeURIComponent(sessionId)}`,
    { method: "DELETE", token },
  )
}
