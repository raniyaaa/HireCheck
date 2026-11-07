"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileTextIcon, GaugeIcon, LayersIcon, Loader2Icon, RefreshCwIcon, Trash2Icon, UsersIcon } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SESSION_EXPIRED } from "@/components/app-shell"
import { StatusIcon, type StatusKind } from "@/components/decision"
import { Notice, PageHeader, StatCard } from "@/components/shared"
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
import { cn } from "@/lib/utils"

type Loadable<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: T }

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You need an admin account to see this."
    if (err.kind !== "http") return `Connection error: ${err.message}`
    return err.message
  }
  return err instanceof Error ? err.message : String(err)
}

const numberFormat = new Intl.NumberFormat()

function formatDate(value: string | null, withTime = true): string {
  if (!value) return "—"
  const date = new Date(value.replace(" ", "T"))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date)
}

// ── Route entry ────────────────────────────────────────────

export function AdminPage() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  useEffect(() => {
    if (user && !isAdmin) router.replace("/")
  }, [user, isAdmin, router])

  if (!user) return null
  if (!isAdmin) {
    return (
      <Notice variant="warning" title="Admins only">
        You need an admin account to view this page. <Link href="/" className="font-medium underline">Back to screening</Link>
      </Notice>
    )
  }
  return <AdminDashboard user={user} />
}

// ── Dashboard ──────────────────────────────────────────────

function AdminDashboard({ user }: { user: AuthUser }) {
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
          signOut(SESSION_EXPIRED)
          return
        }
      }
      setStats(s.status === "fulfilled" ? { status: "ok", data: s.value } : { status: "error", message: errorMessage(s.reason) })
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

  // Loads on mount, and again whenever this page is shown after navigating away
  // (Next.js keeps the page alive in the background and re-runs its effects).
  useEffect(() => {
    let cancelled = false
    void fetchAll().then((results) => {
      if (!cancelled) applyResults(results)
    })
    return () => {
      cancelled = true
    }
  }, [fetchAll, applyResults])

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
      if (isUnauthorized(err)) return signOut(SESSION_EXPIRED)
      toast.error(errorMessage(err))
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
      if (isUnauthorized(err)) return signOut(SESSION_EXPIRED)
      toast.error(errorMessage(err))
    } finally {
      setPendingSession(null)
    }
  }

  const sessionCount = sessions.status === "ok" ? sessions.data.length : null
  const userCount = users.status === "ok" ? users.data.length : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="System-wide activity, screening sessions and user accounts."
        actions={
          <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} aria-hidden />
            Refresh
          </Button>
        }
      />

      <StatsOverview state={stats} />

      <Tabs defaultValue="sessions" className="gap-4">
        <TabsList>
          <TabsTrigger value="sessions">
            Sessions
            {sessionCount !== null && <CountBadge value={sessionCount} />}
          </TabsTrigger>
          <TabsTrigger value="users">
            Users
            {userCount !== null && <CountBadge value={userCount} />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Screening sessions</CardTitle>
              <CardDescription>Every batch screened by any recruiter.</CardDescription>
            </CardHeader>
            <LoadableTable state={sessions} columns={4} empty="No sessions yet.">
              {(rows) => (
                <SessionsTable
                  rows={rows}
                  pendingSession={pendingSession}
                  onDelete={(s) => setConfirmSession(s)}
                />
              )}
            </LoadableTable>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Users</CardTitle>
              <CardDescription>Disabled users can&apos;t sign in.</CardDescription>
            </CardHeader>
            <LoadableTable state={users} columns={3} empty="No users yet.">
              {(rows) => (
                <UsersTable
                  rows={rows}
                  currentUser={user.username}
                  pendingUser={pendingUser}
                  onToggle={(u) => void handleToggleUser(u)}
                />
              )}
            </LoadableTable>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmSession !== null} onOpenChange={(open) => !open && setConfirmSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session {confirmSession?.session_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {confirmSession?.candidate_count ?? 0} candidate result(s) from the database. This
              can&apos;t be undone.
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
    </div>
  )
}

function CountBadge({ value }: { value: number }) {
  return (
    <Badge variant="secondary" className="ml-1 h-4.5 min-w-4.5 px-1.5 tabular-nums">
      {value}
    </Badge>
  )
}

// ── Stats + decision breakdown ─────────────────────────────

function StatsOverview({ state }: { state: Loadable<SystemStats> }) {
  if (state.status === "loading") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading statistics">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-27 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }
  if (state.status === "error") return <Notice variant="error" title="Couldn't load statistics">{state.message}</Notice>

  const s = state.data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Candidates screened"
          value={numberFormat.format(s.total_candidates)}
          icon={<FileTextIcon className="size-4 text-muted-foreground" aria-hidden />}
          hint="Across all sessions"
        />
        <StatCard
          label="Sessions"
          value={numberFormat.format(s.total_sessions)}
          icon={<LayersIcon className="size-4 text-muted-foreground" aria-hidden />}
          hint="Screening batches"
        />
        <StatCard
          label="Users"
          value={numberFormat.format(s.total_users)}
          icon={<UsersIcon className="size-4 text-muted-foreground" aria-hidden />}
          hint={`${numberFormat.format(s.active_users)} active`}
        />
        <StatCard
          label="Average final score"
          value={s.avg_final_score}
          icon={<GaugeIcon className="size-4 text-muted-foreground" aria-hidden />}
          hint="Out of 20"
        />
      </div>
      <DecisionBreakdown breakdown={s.decision_breakdown ?? {}} />
    </div>
  )
}

const BAR_FILL: Record<StatusKind, string> = {
  good: "bg-status-good",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  neutral: "bg-muted-foreground",
}

function DecisionBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const known = ["Accept", "Human Review", "Reject"]
  const other = Object.entries(breakdown)
    .filter(([key]) => !known.includes(key))
    .reduce((sum, [, n]) => sum + (Number(n) || 0), 0)

  const parts: { key: string; label: string; value: number; status: StatusKind }[] = [
    { key: "accept", label: "Accept", value: Number(breakdown.Accept) || 0, status: "good" },
    { key: "review", label: "Review", value: Number(breakdown["Human Review"]) || 0, status: "warning" },
    { key: "reject", label: "Reject", value: Number(breakdown.Reject) || 0, status: "critical" },
    ...(other > 0 ? [{ key: "other", label: "Other", value: other, status: "neutral" as const }] : []),
  ]
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision breakdown</CardTitle>
        <CardDescription>Every candidate screened to date.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No candidates screened yet.</p>
        ) : (
          <>
            {/* Thin segmented bar; the list below carries the figures. */}
            <div
              role="img"
              aria-label={`Decision split: ${parts.map((p) => `${p.label} ${p.value} (${pct(p.value)}%)`).join(", ")}`}
              className="flex h-2 w-full gap-0.5"
            >
              {parts
                .filter((p) => p.value > 0)
                .map((p) => (
                  <div
                    key={p.key}
                    title={`${p.label}: ${p.value} (${pct(p.value)}%)`}
                    className={cn("h-full rounded-full", BAR_FILL[p.status])}
                    style={{ flexGrow: p.value, flexBasis: 0 }}
                  />
                ))}
            </div>
            <ul className={cn("grid gap-2", parts.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3")}>
              {parts.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <StatusIcon status={p.status} />
                    {p.label}
                  </span>
                  <span>
                    <span className="font-semibold">{numberFormat.format(p.value)}</span>
                    <span className="text-muted-foreground"> · {pct(p.value)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Tables ─────────────────────────────────────────────────

function LoadableTable<T>({
  state,
  columns,
  empty,
  children,
}: {
  state: Loadable<T[]>
  columns: number
  empty: string
  children: (rows: T[]) => React.ReactNode
}) {
  if (state.status === "loading") {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: columns }, (_, j) => (
              <Skeleton key={j} className="h-5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    )
  }
  if (state.status === "error") {
    return (
      <div className="p-4">
        <Notice variant="error">{state.message}</Notice>
      </div>
    )
  }
  if (state.data.length === 0) return <p className="p-8 text-center text-sm text-muted-foreground">{empty}</p>
  return <>{children(state.data)}</>
}

function SessionsTable({
  rows,
  pendingSession,
  onDelete,
}: {
  rows: SessionSummary[]
  pendingSession: string | null
  onDelete: (s: SessionSummary) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Session</TableHead>
          <TableHead className="text-right">Candidates</TableHead>
          <TableHead className="hidden text-right sm:table-cell">
            <span className="inline-flex items-center gap-1.5">
              <StatusIcon status="good" />
              Accept
            </span>
          </TableHead>
          <TableHead className="hidden text-right sm:table-cell">
            <span className="inline-flex items-center gap-1.5">
              <StatusIcon status="warning" />
              Review
            </span>
          </TableHead>
          <TableHead className="hidden text-right sm:table-cell">
            <span className="inline-flex items-center gap-1.5">
              <StatusIcon status="critical" />
              Reject
            </span>
          </TableHead>
          <TableHead className="hidden lg:table-cell">Started</TableHead>
          <TableHead className="hidden xl:table-cell">Last activity</TableHead>
          <TableHead className="w-0 pr-4">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.session_id}>
            <TableCell className="pl-4">
              <code className="font-mono text-xs">{s.session_id}</code>
              {/* Columns hidden on small screens, folded into a second line. */}
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground sm:hidden">
                <DecisionCount status="good" label="accepted" value={s.accepted} />
                <DecisionCount status="warning" label="in review" value={s.review} />
                <DecisionCount status="critical" label="rejected" value={s.rejected} />
              </div>
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block lg:hidden">
                Started {formatDate(s.started_at)}
              </p>
            </TableCell>
            <TableCell className="text-right tabular-nums">{s.candidate_count}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.accepted ?? 0}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.review ?? 0}</TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.rejected ?? 0}</TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(s.started_at)}</TableCell>
            <TableCell className="hidden text-muted-foreground xl:table-cell">{formatDate(s.last_updated)}</TableCell>
            <TableCell className="pr-4 text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={pendingSession === s.session_id}
                onClick={() => onDelete(s)}
                aria-label={`Delete session ${s.session_id}`}
              >
                {pendingSession === s.session_id ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DecisionCount({ status, label, value }: { status: StatusKind; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${value ?? 0} ${label}`}>
      <StatusIcon status={status} className="size-3" />
      <span className="tabular-nums">{value ?? 0}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

function UsersTable({
  rows,
  currentUser,
  pendingUser,
  onToggle,
}: {
  rows: UserRecord[]
  currentUser: string
  pendingUser: string | null
  onToggle: (u: UserRecord) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">User</TableHead>
          <TableHead className="hidden sm:table-cell">Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Joined</TableHead>
          <TableHead className="w-0 pr-4 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((u) => {
          const isSelf = u.username === currentUser
          const active = Boolean(u.is_active)
          return (
            <TableRow key={u.username}>
              <TableCell className="pl-4">
                <div className="flex items-center gap-2">
                  <span className="max-w-36 truncate font-medium min-[400px]:max-w-48 sm:max-w-64" title={u.username}>
                    {u.username}
                  </span>
                  {isSelf && <Badge variant="secondary">You</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground capitalize sm:hidden">{u.role}</p>
              </TableCell>
              <TableCell className="hidden capitalize sm:table-cell">{u.role}</TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1.5">
                  <StatusIcon status={active ? "good" : "neutral"} />
                  {active ? "Active" : "Disabled"}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(u.created_at, false)}</TableCell>
              <TableCell className="pr-4 text-right">
                {isSelf ? (
                  <span className="text-muted-foreground">
                    <span aria-hidden>—</span>
                    <span className="sr-only">You can&apos;t disable your own account</span>
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingUser === u.username}
                    onClick={() => onToggle(u)}
                    aria-label={`${active ? "Disable" : "Enable"} ${u.username}`}
                  >
                    {pendingUser === u.username && <Loader2Icon className="animate-spin" aria-hidden />}
                    {active ? "Disable" : "Enable"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
