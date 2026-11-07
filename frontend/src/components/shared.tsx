// Small building blocks shared across pages.

import { CircleCheckIcon, CircleXIcon, InfoIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// ── Brand ──────────────────────────────────────────────────

/** Same mark as the favicon (src/app/icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <g fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-primary-foreground">
        <circle cx="14.5" cy="14.5" r="6" />
        <path d="m19.2 19.2 4.8 4.8" />
      </g>
    </svg>
  )
}

// ── Notice (inline alert) ──────────────────────────────────

export type NoticeVariant = "success" | "info" | "warning" | "error"

const NOTICE_STYLES: Record<NoticeVariant, { box: string; icon: string; Icon: typeof InfoIcon }> = {
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: "text-emerald-600", Icon: CircleCheckIcon },
  info: { box: "border-blue-200 bg-blue-50 text-blue-900", icon: "text-blue-600", Icon: InfoIcon },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: "text-amber-600", Icon: TriangleAlertIcon },
  error: { box: "border-red-200 bg-red-50 text-red-900", icon: "text-red-600", Icon: CircleXIcon },
}

export function Notice({
  variant,
  title,
  icon,
  className,
  children,
}: {
  variant: NoticeVariant
  title?: string
  /** Replaces the default variant icon (e.g. a spinner). */
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  const { box, icon: iconClass, Icon } = NOTICE_STYLES[variant]
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border px-3.5 py-3 text-sm", box, className)}
    >
      {icon ?? <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="whitespace-pre-line wrap-anywhere">{children}</div>}
      </div>
    </div>
  )
}

// ── Page layout ────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  )
}

/** A labelled form control with optional helper text below it. */
export function Field({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

// ── Figures ────────────────────────────────────────────────

/** Stat tile: sentence-case label, one headline value, optional context line. */
export function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        {/* Labels wrap rather than truncate: tiles get narrow on small phones. */}
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm leading-snug text-muted-foreground">{label}</p>
          <span className="mt-0.5 shrink-0">{icon}</span>
        </div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

// ── Loading ────────────────────────────────────────────────

/** For waits with no measurable progress (the backend doesn't report any). */
export function IndeterminateProgress({ label }: { label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-busy="true"
      className="relative h-1 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="absolute inset-y-0 left-0 w-2/5 animate-[progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40" />
    </div>
  )
}

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 bg-muted/40 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  )
}
