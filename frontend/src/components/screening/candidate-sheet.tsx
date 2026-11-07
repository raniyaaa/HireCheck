"use client"

import { useId } from "react"
import { CheckIcon, CopyIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { DecisionBadge } from "@/components/decision"
import { Notice, type NoticeVariant } from "@/components/shared"
import type { Candidate } from "@/lib/api"

export function CandidateSheet({
  candidate,
  open,
  onOpenChange,
}: {
  candidate: Candidate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open && candidate !== null} onOpenChange={onOpenChange}>
      {/* Full screen on phones, a side panel from the sm breakpoint up. */}
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-2xl"
      >
        {candidate && <CandidateDetails candidate={candidate} />}
      </SheetContent>
    </Sheet>
  )
}

function recommendationVariant(decision: string): NoticeVariant {
  if (decision === "Accept") return "success"
  if (decision === "Human Review") return "warning"
  if (decision === "Reject") return "error"
  return "info"
}

function CandidateDetails({ candidate: c }: { candidate: Candidate }) {
  const name = c.candidate_name || "Unknown"
  const jd = Number(c.jd_score ?? 0)
  const profile = Number(c.reference_score ?? 0)
  const final = Number(c.final_score ?? 0)
  const decision = c.decision || "Unknown"

  return (
    <>
      <SheetHeader className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pr-8">
          <SheetTitle className="text-lg leading-tight wrap-anywhere">{name}</SheetTitle>
          <DecisionBadge decision={decision} />
        </div>
        <SheetDescription>
          Final score {final}/20 · JD match {jd}/10 · Profile match {profile}/10
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <Tabs defaultValue="overview" className="gap-5">
          <TabsList className="w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="jd">
              <span className="sm:hidden">JD</span>
              <span className="hidden sm:inline">JD match</span>
            </TabsTrigger>
            <TabsTrigger value="profile">
              <span className="sm:hidden">Profile</span>
              <span className="hidden sm:inline">Profile match</span>
            </TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            {c.error && (
              <Notice variant="error" title="This resume couldn't be processed">
                {c.error}
              </Notice>
            )}

            <Section title="Summary">
              <p className="leading-relaxed">{c.summary || "No summary available."}</p>
            </Section>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <MiniStat label="JD match" shortLabel="JD" value={jd} max={10} />
              <MiniStat label="Profile match" shortLabel="Profile" value={profile} max={10} />
              <MiniStat label="Final score" shortLabel="Final" value={final} max={20} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Section title="Key strengths">
                <IconList items={c.strengths ?? []} tone="positive" empty="None identified" />
              </Section>
              <Section title="Missing skills">
                <IconList items={c.missing_skills ?? []} tone="negative" empty="No major gaps" />
              </Section>
            </div>

            <Notice variant={recommendationVariant(decision)} title="Recommendation">
              {c.final_recommendation_reason || "No recommendation available."}
            </Notice>
          </TabsContent>

          {/* JD match */}
          <TabsContent value="jd" className="space-y-6">
            <ScoreMeter label="JD match" value={jd} max={10} />
            <div className="grid gap-6 sm:grid-cols-2">
              <Section title="Strengths">
                <BulletList items={c.jd_strengths ?? []} />
              </Section>
              <Section title="Missing skills">
                <BulletList items={c.jd_missing_skills ?? []} />
              </Section>
              <Section title="Weaknesses">
                <BulletList items={c.jd_weaknesses ?? []} />
              </Section>
              <Section title="Match reasons">
                <BulletList items={c.jd_reasons ?? []} />
              </Section>
            </div>
            <Section title="Explanation">
              <p className="leading-relaxed whitespace-pre-line">{c.jd_explanation || "No explanation provided."}</p>
            </Section>
          </TabsContent>

          {/* Profile match */}
          <TabsContent value="profile" className="space-y-6">
            <ScoreMeter label="Profile match" value={profile} max={10} />
            <div className="grid gap-6 sm:grid-cols-2">
              <Section title="Strengths">
                <BulletList items={c.reference_strengths ?? []} />
              </Section>
              <Section title="Weaknesses">
                <BulletList items={c.reference_weaknesses ?? []} />
              </Section>
              <Section title="Match reasons">
                <BulletList items={c.reference_reasons ?? []} />
              </Section>
            </div>
            <Section title="Explanation">
              <p className="leading-relaxed whitespace-pre-line">
                {c.reference_explanation || "No explanation provided."}
              </p>
            </Section>
          </TabsContent>

          {/* Email */}
          <TabsContent value="email" className="space-y-4">
            <EmailPanel status={c.email_status} content={c.email_content} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="text-sm">{children}</div>
    </section>
  )
}

function MiniStat({ label, shortLabel, value, max }: { label: string; shortLabel: string; value: number; max: number }) {
  return (
    <div className="min-w-0 rounded-lg border p-2.5 sm:p-3">
      <p className="truncate text-xs text-muted-foreground">
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </p>
      <p className="mt-1 text-lg font-semibold">
        {value}
        <span className="text-sm font-normal text-muted-foreground">/{max}</span>
      </p>
    </div>
  )
}

function ScoreMeter({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{label} score</span>
        <span className="tabular-nums">
          <span className="font-semibold">{value}</span>
          <span className="text-muted-foreground">/{max}</span>
        </span>
      </div>
      <Progress value={pct} aria-label={`${label} score`} className="h-2" />
    </div>
  )
}

function IconList({ items, tone, empty }: { items: string[]; tone: "positive" | "negative"; empty: string }) {
  if (items.length === 0) return <p className="text-muted-foreground">{empty}</p>
  const Icon = tone === "positive" ? CheckIcon : XIcon
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <Icon
            className={tone === "positive" ? "mt-0.5 size-4 shrink-0 text-status-good" : "mt-0.5 size-4 shrink-0 text-status-critical"}
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-muted-foreground">None listed</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function EmailPanel({ status, content }: { status?: string; content?: string }) {
  const id = useId()

  async function copy() {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      toast.success("Email copied to clipboard")
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.")
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status</span>
          <Badge variant="secondary">{status || "Not sent"}</Badge>
        </div>
        {content && (
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            <CopyIcon aria-hidden />
            Copy
          </Button>
        )}
      </div>
      {content ? (
        <div className="space-y-2">
          <Label htmlFor={id}>Generated email</Label>
          <Textarea id={id} readOnly value={content} className="h-80 resize-y field-sizing-fixed" />
          <p className="text-xs text-muted-foreground">This is a mock email. It isn&apos;t actually sent.</p>
        </div>
      ) : (
        <p className="text-muted-foreground">No email was generated for this candidate.</p>
      )}
    </>
  )
}
