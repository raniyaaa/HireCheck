// Small presentational pieces that mirror the Streamlit widgets the old UI used
// (st.success/info/warning/error, st.metric, the custom metric-box and badges).

import { ChevronDownIcon, Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Callout (st.success / st.info / st.warning / st.error) ──

export type CalloutVariant = "success" | "info" | "warning" | "error"

const calloutStyles: Record<CalloutVariant, string> = {
  success: "bg-green-50 text-green-800",
  info: "bg-blue-50 text-blue-800",
  warning: "bg-yellow-50 text-yellow-800",
  error: "bg-red-50 text-red-800",
}

export function Callout({
  variant,
  className,
  children,
}: {
  variant: CalloutVariant
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("rounded-lg px-4 py-3 text-sm whitespace-pre-line", calloutStyles[variant], className)}
    >
      {children}
    </div>
  )
}

// ── Headings (st.title / st.header / st.subheader) ─────────

export function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{children}</h1>
}

export function Header({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-2xl font-semibold tracking-tight sm:text-3xl", className)}>{children}</h2>
}

export function Subheader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-xl font-semibold sm:text-2xl", className)}>{children}</h3>
}

export function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("my-6 border-border", className)} />
}

// ── Metrics ────────────────────────────────────────────────

/** The custom white `.metric-box` card used for summary counts. */
export function MetricBox({ value, label, color }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="rounded-[10px] bg-white p-4 text-center shadow-[0_1px_4px_rgba(0,0,0,0.1)] ring-1 ring-black/5">
      <div className="text-[32px] leading-tight font-extrabold text-black" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="mt-1 text-[13px] text-gray-500">{label}</div>
    </div>
  )
}

/** st.metric: small label over a large value. */
export function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl leading-tight">{value}</div>
    </div>
  )
}

// ── Decision badge + score colors ──────────────────────────

const badgeStyles: Record<string, string> = {
  Accept: "bg-green-100 text-green-800",
  "Human Review": "bg-yellow-100 text-yellow-800",
  Reject: "bg-red-100 text-red-800",
}

export function DecisionBadge({ decision }: { decision: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-[13px] font-bold whitespace-nowrap",
        badgeStyles[decision] ?? "bg-gray-100 text-gray-700",
      )}
    >
      {decision || "Unknown"}
    </span>
  )
}

/** Green ≥ 80%, amber ≥ 60%, red below — same thresholds as score_color(). */
export function scoreColor(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0
  if (pct >= 80) return "#15803d"
  if (pct >= 60) return "#a16207"
  return "#dc2626"
}

export function ScoreText({ score, max, large }: { score: number; max: number; large?: boolean }) {
  return (
    <span className={cn("font-bold", large && "text-base")} style={{ color: scoreColor(score, max) }}>
      {score}/{max}
    </span>
  )
}

// ── Expander (st.expander) ─────────────────────────────────

export function Expander({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm hover:text-primary [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4 pt-1 pb-4">{children}</div>
    </details>
  )
}

// ── Misc ───────────────────────────────────────────────────

export function BulletList({ items, marker = "•" }: { items: string[]; marker?: string }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-1 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="shrink-0">
            {marker}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  )
}
