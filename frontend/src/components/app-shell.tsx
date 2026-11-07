"use client"

import { useEffect } from "react"

import { BackendStatusProvider } from "@/components/backend-status"
import { FullPageLoader } from "@/components/shared"
import { SiteHeader } from "@/components/site-header"
import { getMe, isUnauthorized } from "@/lib/api"
import { useAuth, type AuthUser } from "@/lib/auth"

export const SESSION_EXPIRED = "Session expired. Please log in again."

/** Wraps every signed-in page: waits for auth, bounces to /login when signed out. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth()

  useEffect(() => {
    // Full page load (not router.replace) so no in-memory state survives.
    if (ready && !user) window.location.replace("/login")
  }, [ready, user])

  if (!ready || !user) return <FullPageLoader />

  return (
    <BackendStatusProvider>
      {/* Keyed by username: a different user never inherits this one's page state. */}
      <SignedInLayout key={user.username} user={user}>
        {children}
      </SignedInLayout>
    </BackendStatusProvider>
  )
}

function SignedInLayout({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const { signOut, updateRole } = useAuth()

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

  return (
    <div className="min-h-svh bg-muted/40">
      <SiteHeader user={user} />
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
    </div>
  )
}
