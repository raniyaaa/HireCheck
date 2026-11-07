// How screening decisions look everywhere in the UI. Status colours come from
// the --status-* tokens in globals.css and always travel with a distinct glyph
// and a text label, so meaning never depends on colour alone.

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusKind = "good" | "warning" | "critical" | "neutral"

interface DecisionMeta {
  /** Short label for badges, filters and legends. */
  label: string
  status: StatusKind
}

/** Keyed by the backend's decision strings (decision/decision.py). */
export const DECISIONS: Record<string, DecisionMeta> = {
  Accept: { label: "Accept", status: "good" },
  "Human Review": { label: "Review", status: "warning" },
  Reject: { label: "Reject", status: "critical" },
}

export function decisionMeta(decision: string | null | undefined): DecisionMeta {
  return (decision && DECISIONS[decision]) || { label: decision || "Unknown", status: "neutral" }
}

const CIRCLE_FILL: Record<StatusKind, string> = {
  good: "fill-status-good",
  warning: "fill-status-warning",
  critical: "fill-status-critical",
  neutral: "fill-muted-foreground",
}

// White glyphs, except on amber where white falls below readable contrast.
const GLYPH_INK: Record<StatusKind, string> = {
  good: "stroke-white",
  warning: "stroke-[#0b0b0b]",
  critical: "stroke-white",
  neutral: "stroke-white",
}

/** Filled circle with a check, exclamation, cross or dash. */
export function StatusIcon({ status, className }: { status: StatusKind; className?: string }) {
  const ink = GLYPH_INK[status]
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn("size-3.5 shrink-0", className)}>
      <circle cx="8" cy="8" r="8" className={CIRCLE_FILL[status]} />
      <g fill="none" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={ink}>
        {status === "good" && <path d="M4.75 8.25 7 10.5l4.25-4.75" />}
        {status === "warning" && <path d="M8 4.25v4.5" />}
        {status === "critical" && <path d="m5.5 5.5 5 5m0-5-5 5" />}
        {status === "neutral" && <path d="M5 8h6" />}
      </g>
      {status === "warning" && <circle cx="8" cy="11.4" r="1.05" className="fill-[#0b0b0b]" />}
    </svg>
  )
}

export function DecisionBadge({ decision, className }: { decision: string; className?: string }) {
  const meta = decisionMeta(decision)
  return (
    <Badge variant="outline" className={cn("gap-1.5 bg-background", className)}>
      <StatusIcon status={meta.status} />
      {meta.label}
    </Badge>
  )
}
