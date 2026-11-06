"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2Icon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Callout, Caption, Divider, Header, Metric, MetricBox, Subheader } from "@/components/display"
import {
  ApiError,
  deleteSession,
  getAdminSessions,
  getAdminStats,
  getAdminUsers,
  isUnauthorized,
  setUserActive,
  type SessionSummary,
  type SystemStats,
  type UserRecord,
} from "@/lib/api"
import { useAuth, type AuthUser } from "@/lib/auth"

type Loadable<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: T }

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "🚫 Admin access required"
    if (err.kind !== "http") return `Connection error: ${err.message}`
    return `Error: ${err.message}`
  }
  return `Error: ${err instanceof Error ? err.message : String(err)}`
}

function formatTimestamp(value: string | null): string {
  return value ? value.replace("T", " ").replace(/\.\d+$/, "") : "—"
}

const SESSION_GRID = "md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1.5fr]"
const USER_GRID = "md:grid-cols-[2fr_1.5fr_1fr_1.5fr_1.5fr]"

export function AdminPanel({ user, refreshKey }: { user: AuthUser; refreshKey: number }) {
  const { signOut } = useAuth()
  const token = user.token

  const [stats, setStats] = useState<Loadable<SystemStats>>({ status: "loading" })
  const [sessions, setSessions] = useState<Loadable<SessionSummary[]>>({ status: "loading" })
  const [users, setUsers] = useState<Loadable<UserRecord[]>>({ status: "loading" })
  const [refreshing, setRefreshing] = useState(false)
  const [pendingUser, setPendingUser] = useState<string | null>(null)
  const [pendingSession, setPendingSession] = useState<string | null>(null)
  const [confirmSession, setConfirmSession] = useState<SessionSummary | null>(null)

  const fetchAll = useCallback(
    () => Promise.allSettled([getAdminStats(token), getAdminSessions(token), getAdminUsers(token)]),
    [token],
  )

  const applyResults = useCallback(
    ([s, se, u]: Awaited<ReturnType<typeof fetchAll>>) => {
      for (const r of [s, se, u]) {
        if (r.status === "rejected" && isUnauthorized(r.reason)) {
          signOut("Your session has expired. Please log in again.")
          return
        }
      }
      setStats(
        s.status === "fulfilled" ? { status: "ok", data: s.value } : { status: "error", message: errorMessage(s.reason) },
      )
      setSessions(
        se.status === "fulfilled"
          ? { status: "ok", data: se.value.sessions ?? [] }
          : { status: "error", message: errorMessage(se.reason) },
      )
      setUsers(
        u.status === "fulfilled"
          ? { status: "ok", data: u.value.users ?? [] }
          : { status: "error", message: errorMessage(u.reason) },
      )
    },
    [signOut],
  )

  const load = useCallback(async () => applyResults(await fetchAll()), [fetchAll, applyResults])

  // Reload on mount and whenever the dashboard finishes a batch.
  useEffect(() => {
    let cancelled = false
    void fetchAll().then((results) => {
      if (!cancelled) applyResults(results)
    })
    return () => {
      cancelled = true
    }
  }, [fetchAll, applyResults, refreshKey])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function handleToggleUser(u: UserRecord) {
    const activate = !u.is_active
    setPendingUser(u.username)
    try {
      await setUserActive(token, u.username, activate)
      toast.success(`${activate ? "Enabled" : "Disabled"} ${u.username}`)
      await load()
    } catch (err) {
      if (isUnauthorized(err)) return signOut("Your session has expired. Please log in again.")
      toast.error(err instanceof ApiError && err.kind === "http" ? err.message : errorMessage(err))
    } finally {
      setPendingUser(null)
    }
  }

  async function handleDeleteSession(sessionId: string) {
    setPendingSession(sessionId)
    try {
      await deleteSession(token, sessionId)
      toast.success(`Deleted session ${sessionId}`)
      await load()
    } catch (err) {
      if (isUnauthorized(err)) return signOut("Your session has expired. Please log in again.")
      toast.error(errorMessage(err))
    } finally {
      setPendingSession(null)
    }
  }

  return (
    <section aria-labelledby="admin-heading">
      <Divider />
      <div className="flex items-center justify-between gap-4">
        <Header>
          <span id="admin-heading">Admin Panel</span>
        </Header>
        <Button variant="ghost" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
          <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} aria-hidden />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList variant="line" className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">📊 System Overview</TabsTrigger>
          <TabsTrigger value="sessions">All Sessions</TabsTrigger>
          <TabsTrigger value="users">👥 Manage Users</TabsTrigger>
        </TabsList>

        {/* System overview */}
        <TabsContent value="overview" className="mt-5">
          <LoadableView state={stats}>
            {(data) => (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <MetricBox value={data.total_candidates} label="Total Candidates" />
                  <MetricBox value={data.total_sessions} label="Total Sessions" />
                  <MetricBox value={data.total_users} label="Total Users" />
                  <MetricBox value={data.avg_final_score} label="Avg Final Score" />
                </div>

                <Subheader className="mt-8">Decision Breakdown (All Time)</Subheader>
                {Object.keys(data.decision_breakdown ?? {}).length > 0 ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <Metric label="✅ Accept" value={data.decision_breakdown.Accept ?? 0} />
                    <Metric label="🔍 Human Review" value={data.decision_breakdown["Human Review"] ?? 0} />
                    <Metric label="❌ Reject" value={data.decision_breakdown.Reject ?? 0} />
                  </div>
                ) : (
                  <Caption className="mt-3">No candidates processed yet.</Caption>
                )}

                <Caption className="mt-6">
                  👤 Active users: {data.active_users} / {data.total_users}
                </Caption>
              </>
            )}
          </LoadableView>
        </TabsContent>

        {/* All sessions */}
        <TabsContent value="sessions" className="mt-5">
          <Caption>View and manage every resume-screening session across all recruiters.</Caption>
          <div className="mt-4">
            <LoadableView state={sessions}>
              {(data) =>
                data.length === 0 ? (
                  <Callout variant="info">No sessions found yet.</Callout>
                ) : (
                  <>
                    <div className={`hidden gap-4 border-b pb-2 text-sm font-semibold md:grid ${SESSION_GRID}`}>
                      <span>Session ID</span>
                      <span>Candidates</span>
                      <span>Accept</span>
                      <span>Review</span>
                      <span>Reject</span>
                      <span>Action</span>
                    </div>
                    <ul className="divide-y">
                      {data.map((s) => (
                        <li key={s.session_id} className="py-3">
                          <div className={`grid grid-cols-4 items-center gap-x-4 gap-y-2 text-sm ${SESSION_GRID}`}>
                            <code className="col-span-3 font-mono md:col-span-1">{s.session_id}</code>
                            <span className="col-span-1 text-right md:text-left">
                              <span className="text-muted-foreground md:hidden">Candidates </span>
                              {s.candidate_count}
                            </span>
                            <span>🟢 {s.accepted ?? 0}</span>
                            <span>🟡 {s.review ?? 0}</span>
                            <span>🔴 {s.rejected ?? 0}</span>
                            <span className="text-right md:text-left">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={pendingSession === s.session_id}
                                onClick={() => setConfirmSession(s)}
                              >
                                {pendingSession === s.session_id ? (
                                  <Loader2Icon className="animate-spin" aria-hidden />
                                ) : (
                                  <Trash2Icon aria-hidden />
                                )}
                                Delete
                              </Button>
                            </span>
                          </div>
                          <Caption className="mt-1 text-xs">
                            Started: {formatTimestamp(s.started_at)} | Last updated: {formatTimestamp(s.last_updated)}
                          </Caption>
                        </li>
                      ))}
                    </ul>
                  </>
                )
              }
            </LoadableView>
          </div>
        </TabsContent>

        {/* Manage users */}
        <TabsContent value="users" className="mt-5">
          <Caption>View all registered users. Enable/disable accounts as needed.</Caption>
          <div className="mt-4">
            <LoadableView state={users}>
              {(data) =>
                data.length === 0 ? (
                  <Callout variant="info">No users found.</Callout>
                ) : (
                  <>
                    <div className={`hidden gap-4 border-b pb-2 text-sm font-semibold md:grid ${USER_GRID}`}>
                      <span>Username</span>
                      <span>Role</span>
                      <span>Status</span>
                      <span>Joined</span>
                      <span>Action</span>
                    </div>
                    <ul className="divide-y">
                      {data.map((u) => {
                        const isSelf = u.username === user.username
                        return (
                          <li
                            key={u.username}
                            className={`grid grid-cols-2 items-center gap-x-4 gap-y-1.5 py-3 text-sm ${USER_GRID}`}
                          >
                            <span className="col-span-2 md:col-span-1">
                              <strong>{u.username}</strong>
                              {isSelf && <em className="text-muted-foreground"> (you)</em>}
                            </span>
                            <span>{u.role === "admin" ? "🛠️ Admin" : "👤 Recruiter"}</span>
                            <span>{u.is_active ? "🟢 Active" : "🔴 Disabled"}</span>
                            <Caption className="text-sm">
                              <span className="md:hidden">Joined </span>
                              {u.created_at ? u.created_at.slice(0, 10) : "—"}
                            </Caption>
                            <span>
                              {isSelf ? (
                                <Caption>—</Caption>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={pendingUser === u.username}
                                  onClick={() => void handleToggleUser(u)}
                                >
                                  {pendingUser === u.username && <Loader2Icon className="animate-spin" aria-hidden />}
                                  {u.is_active ? "🚫 Disable" : "✅ Enable"}
                                </Button>
                              )}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )
              }
            </LoadableView>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmSession !== null} onOpenChange={(open) => !open && setConfirmSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session {confirmSession?.session_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {confirmSession?.candidate_count ?? 0} candidate result(s) from the
              database. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmSession) void handleDeleteSession(confirmSession.session_id)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function LoadableView<T>({ state, children }: { state: Loadable<T>; children: (data: T) => React.ReactNode }) {
  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        Loading…
      </p>
    )
  }
  if (state.status === "error") return <Callout variant="error">{state.message}</Callout>
  return <>{children(state.data)}</>
}
