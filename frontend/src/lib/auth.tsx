"use client"

// Login state, persisted in localStorage so a page refresh keeps you signed in.
//
// Logging out always does a full page load. Next.js keeps previously visited
// pages alive in the background (React <Activity>), so a client-side
// navigation would leave the previous user's results sitting in memory.

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react"
import type { AuthResponse } from "@/lib/api"

const STORAGE_KEY = "hirecheck_auth"
const FLASH_KEY = "hirecheck_flash"

export interface AuthUser {
  token: string
  username: string
  role: string
}

// ── localStorage as an external store ──────────────────────

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener("storage", callback) // other tabs
  return () => {
    listeners.delete(callback)
    window.removeEventListener("storage", callback)
  }
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

// `undefined` on the server means "not known yet", distinct from `null` (logged out).
function getServerSnapshot(): string | null | undefined {
  return undefined
}

function writeStored(value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Storage unavailable (private mode etc.) — the session just won't persist.
  }
  listeners.forEach((l) => l())
}

function parseUser(raw: string | null | undefined): AuthUser | null {
  if (!raw) return null
  try {
    const u = JSON.parse(raw) as Partial<AuthUser>
    if (typeof u.token === "string" && typeof u.username === "string" && typeof u.role === "string") {
      return { token: u.token, username: u.username, role: u.role }
    }
  } catch {
    // fall through
  }
  return null
}

// ── Context ────────────────────────────────────────────────

interface AuthContextValue {
  /** False until we've read localStorage on the client. */
  ready: boolean
  user: AuthUser | null
  signIn: (res: AuthResponse) => void
  updateRole: (role: string) => void
  /** Clears the session and reloads into /login, optionally showing a message there. */
  signOut: (message?: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const ready = raw !== undefined
  const user = useMemo(() => parseUser(raw), [raw])

  const signIn = useCallback((res: AuthResponse) => {
    writeStored(JSON.stringify({ token: res.access_token, username: res.username, role: res.role }))
  }, [])

  const updateRole = useCallback(
    (role: string) => {
      if (user && user.role !== role) writeStored(JSON.stringify({ ...user, role }))
    },
    [user],
  )

  const signOut = useCallback((message?: string) => {
    writeStored(null)
    try {
      if (message) window.sessionStorage.setItem(FLASH_KEY, message)
    } catch {
      // ignore
    }
    window.location.replace("/login")
  }, [])

  const value = useMemo(
    () => ({ ready, user, signIn, updateRole, signOut }),
    [ready, user, signIn, updateRole, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}

/** The one-time message left by signOut(), e.g. "Session expired". Pure, so it's safe in a state initializer. */
export function readFlashMessage(): string | null {
  try {
    return window.sessionStorage.getItem(FLASH_KEY)
  } catch {
    return null
  }
}

export function clearFlashMessage() {
  try {
    window.sessionStorage.removeItem(FLASH_KEY)
  } catch {
    // ignore
  }
}
