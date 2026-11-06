"use client"

import { useCallback, useEffect, useState } from "react"
import { checkHealth } from "@/lib/api"

// The first check gets a long timeout: a sleeping free-tier backend can take
// up to a minute to wake, and that first request is what wakes it.
const FIRST_CHECK_TIMEOUT = 60_000
const POLL_TIMEOUT = 10_000
const OFFLINE_RETRY_MS = 10_000

/**
 * Pings GET /health. `online` is null while the first check is in flight.
 * With `poll`, keeps checking in the background (faster while offline).
 */
export function useBackendHealth({ poll = true, intervalMs = 30_000 } = {}) {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async (timeoutMs: number) => {
      const ok = await checkHealth(timeoutMs)
      if (cancelled) return
      setOnline(ok)
      if (poll) timer = setTimeout(() => run(POLL_TIMEOUT), ok ? intervalMs : OFFLINE_RETRY_MS)
    }

    void run(FIRST_CHECK_TIMEOUT)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [poll, intervalMs])

  const recheck = useCallback(async () => {
    setOnline(null)
    const ok = await checkHealth(FIRST_CHECK_TIMEOUT)
    setOnline(ok)
    return ok
  }, [])

  return { online, recheck }
}
