"use client"

import { useEffect } from "react"
import { LogOutIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Callout, Caption, Divider } from "@/components/display"
import type { AuthUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

export const ACCEPT_RANGE = { min: 15, max: 20 } as const
export const REVIEW_MIN = 10

interface AppSidebarProps {
  user: AuthUser
  backendOnline: boolean | null
  jobDescription: string
  onJobDescriptionChange: (v: string) => void
  idealProfile: string
  onIdealProfileChange: (v: string) => void
  acceptThreshold: number
  onAcceptThresholdChange: (v: number) => void
  reviewThreshold: number
  onReviewThresholdChange: (v: number) => void
  sessionId: string
  onNewSession: () => void
  newSessionDisabled: boolean
  onLogout: () => void
  /** Mobile only: whether the drawer is open. Always shown on large screens. */
  open: boolean
  onClose: () => void
}

export function AppSidebar(props: AppSidebarProps) {
  const { open, onClose } = props

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        id="app-sidebar"
        aria-label="Screening settings"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] overflow-y-auto border-r bg-sidebar px-5 py-6 text-sidebar-foreground",
          "transition-[transform,visibility] duration-200",
          "lg:sticky lg:top-0 lg:h-svh lg:w-84 lg:max-w-none lg:translate-x-0 lg:visible",
          open ? "translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <SidebarContent {...props} />
      </aside>
    </>
  )
}

function SidebarContent({
  user,
  backendOnline,
  jobDescription,
  onJobDescriptionChange,
  idealProfile,
  onIdealProfileChange,
  acceptThreshold,
  onAcceptThresholdChange,
  reviewThreshold,
  onReviewThresholdChange,
  sessionId,
  onNewSession,
  newSessionDisabled,
  onLogout,
  onClose,
}: AppSidebarProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold tracking-tight">🔍 HireCheck ATS</h2>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Close sidebar">
          <XIcon />
        </Button>
      </div>

      {/* User info + logout */}
      <Callout variant="success" className="mt-4">
        👤 <strong>{user.username}</strong> ({user.role})
      </Callout>
      <Button variant="outline" className="mt-3 w-full bg-background" onClick={onLogout}>
        <LogOutIcon aria-hidden />
        Logout
      </Button>

      <Divider />

      {backendOnline === null ? (
        <Callout variant="info">Checking backend…</Callout>
      ) : backendOnline ? (
        <Callout variant="success">✅ Backend connected</Callout>
      ) : (
        <Callout variant="error">❌ Backend offline</Callout>
      )}

      <Divider />

      <h3 className="text-lg font-semibold">📋 Job Description</h3>
      <Label htmlFor="jd" className="mt-3 mb-2 block font-normal">
        Paste the full Job Description
      </Label>
      <Textarea
        id="jd"
        value={jobDescription}
        onChange={(e) => onJobDescriptionChange(e.target.value)}
        className="h-45 resize-y bg-background field-sizing-fixed"
      />

      <Divider />

      <h3 className="text-lg font-semibold">🎯 Ideal Candidate Profile</h3>
      <Label htmlFor="ideal" className="mt-3 mb-2 block font-normal">
        Describe your ideal candidate
      </Label>
      <Textarea
        id="ideal"
        value={idealProfile}
        onChange={(e) => onIdealProfileChange(e.target.value)}
        className="h-37.5 resize-y bg-background field-sizing-fixed"
      />

      <Divider />

      <h3 className="text-lg font-semibold">⚙️ Decision Thresholds</h3>
      <ThresholdSlider
        id="accept-threshold"
        label="Accept if score above"
        value={acceptThreshold}
        min={ACCEPT_RANGE.min}
        max={ACCEPT_RANGE.max}
        onChange={onAcceptThresholdChange}
      />
      <ThresholdSlider
        id="review-threshold"
        label="Review if score above"
        value={reviewThreshold}
        min={REVIEW_MIN}
        max={acceptThreshold}
        onChange={onReviewThresholdChange}
      />
      <Caption className="mt-3">
        🟢 Accept &gt;<strong>{acceptThreshold}</strong>&nbsp;&nbsp;🟡 Review{" "}
        <strong>
          {reviewThreshold}–{acceptThreshold}
        </strong>
        &nbsp;&nbsp;🔴 Reject &lt;<strong>{reviewThreshold}</strong>
      </Caption>

      <Divider />

      <Button variant="outline" className="w-full bg-background" onClick={onNewSession} disabled={newSessionDisabled}>
        <RotateCcwIcon aria-hidden />
        New Session
      </Button>
      <Caption className="mt-2">
        Session: <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{sessionId}</code>
      </Caption>
    </div>
  )
}

function ThresholdSlider({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between text-sm">
        <Label id={`${id}-label`} className="font-normal">
          {label}
        </Label>
        <span className="font-semibold text-primary tabular-nums">{value}</span>
      </div>
      <Slider
        aria-labelledby={`${id}-label`}
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
