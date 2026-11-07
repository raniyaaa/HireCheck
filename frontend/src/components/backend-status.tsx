"use client"

import { createContext, useContext } from "react"
import { Loader2Icon } from "lucide-react"

import { StatusIcon } from "@/components/decision"
import { useBackendHealth } from "@/hooks/use-backend-health"

// One /health poller for the whole signed-in app, shared via context.
const BackendStatusContext = createContext<boolean | null>(null)

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const { online } = useBackendHealth()
  return <BackendStatusContext.Provider value={online}>{children}</BackendStatusContext.Provider>
}

/** true = reachable, false = unreachable, null = still checking. */
export function useBackendOnline(): boolean | null {
  return useContext(BackendStatusContext)
}

export function BackendStatusIndicator() {
  const online = useBackendOnline()
  const label = online === null ? "Connecting to backend…" : online ? "Backend online" : "Backend offline"

  return (
    <span role="status" title={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {online === null ? (
        <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <StatusIcon status={online ? "good" : "critical"} />
      )}
      <span className="sr-only lg:not-sr-only">{label}</span>
    </span>
  )
}
