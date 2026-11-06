"use client"

import { useId, useMemo, useState } from "react"
import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  BulletList,
  Callout,
  Caption,
  DecisionBadge,
  Divider,
  Expander,
  Metric,
  MetricBox,
  ScoreText,
  Subheader,
  type CalloutVariant,
} from "@/components/display"
import type { Candidate } from "@/lib/api"
import { candidatesToCsv, csvFilename, downloadCsv } from "@/lib/csv"

const FILTERS = ["All", "Accept", "Human Review", "Reject"] as const
type Filter = (typeof FILTERS)[number]

// Column widths from the Streamlit table: st.columns([3, 1.5, 1.5, 1.5, 2])
const ROW_GRID = "md:grid-cols-[3fr_1.5fr_1.5fr_1.5fr_2fr]"

export function ResultsSection({ results }: { results: Candidate[] }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("All")

  const counts = useMemo(
    () => ({
      total: results.length,
      accepted: results.filter((r) => r.decision === "Accept").length,
      review: results.filter((r) => r.decision === "Human Review").length,
      rejected: results.filter((r) => r.decision === "Reject").length,
    }),
    [results],
  )

  // Keep each candidate's index in `results` so expander state follows the
  // candidate (not the row position) as the filter changes.
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return results
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => !q || (candidate.candidate_name ?? "").toLowerCase().includes(q))
      .filter(({ candidate }) => filter === "All" || candidate.decision === filter)
  }, [results, search, filter])

  return (
    <section aria-labelledby="results-heading">
      <Divider />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricBox value={counts.total} label=" Total" />
        <MetricBox value={counts.accepted} label="✅ Accepted" color="#16a34a" />
        <MetricBox value={counts.review} label=" Under Review" color="#a16207" />
        <MetricBox value={counts.rejected} label="❌ Rejected" color="#dc2626" />
      </div>

      <Divider />

      {/* Search + filter */}
      <Subheader>
        <span id="results-heading"> Candidate Results</span>
      </Subheader>
      <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="candidate-search" className="font-normal">
            Search by name
          </Label>
          <Input
            id="candidate-search"
            type="search"
            placeholder="Type to search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="decision-filter" className="font-normal">
            Filter by Decision
          </Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger id="decision-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Caption className="mt-3">
        Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
        <strong className="text-foreground">{counts.total}</strong> candidates
      </Caption>

      {/* Table header */}
      <div className={`mt-5 hidden gap-4 border-b pb-2 text-sm font-semibold md:grid ${ROW_GRID}`}>
        <span>Candidate</span>
        <span>JD Score</span>
        <span>Ref Score</span>
        <span>Final</span>
        <span>Decision</span>
      </div>

      {/* Candidate rows */}
      <ul className="divide-y">
        {filtered.map(({ candidate, index }) => (
          <CandidateRow key={index} candidate={candidate} />
        ))}
      </ul>

      {/* Export */}
      <Divider />
      <Subheader>Export</Subheader>
      <div className="mt-4 grid items-center gap-4 sm:grid-cols-2">
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={filtered.length === 0}
          onClick={() =>
            downloadCsv(
              candidatesToCsv(filtered.map(({ candidate }) => candidate)),
              csvFilename(),
            )
          }
        >
          <DownloadIcon aria-hidden />
          Download CSV
        </Button>
        <Caption>Exporting {filtered.length} candidate(s) with full analysis</Caption>
      </div>
    </section>
  )
}

function CandidateRow({ candidate: c }: { candidate: Candidate }) {
  const name = c.candidate_name || "Unknown"
  const jd = Number(c.jd_score ?? 0)
  const ref = Number(c.reference_score ?? 0)
  const final = Number(c.final_score ?? 0)
  const decision = c.decision || "Unknown"

  return (
    <li className="py-4">
      <div className={`grid grid-cols-3 items-center gap-x-4 gap-y-2 text-sm ${ROW_GRID}`}>
        <span className="col-span-3 font-semibold md:col-span-1">{name}</span>
        <span>
          <span className="text-muted-foreground md:hidden">JD </span>
          <ScoreText score={jd} max={10} />
        </span>
        <span>
          <span className="text-muted-foreground md:hidden">Ref </span>
          <ScoreText score={ref} max={10} />
        </span>
        <span>
          <span className="text-muted-foreground md:hidden">Final </span>
          <ScoreText score={final} max={20} large />
        </span>
        <span className="col-span-3 md:col-span-1">
          <DecisionBadge decision={decision} />
        </span>
      </div>

      <div className="mt-3">
        <Expander label={`🔍 Full Analysis — ${name}`}>
          <CandidateDetails candidate={c} jd={jd} profile={ref} final={final} decision={decision} />
        </Expander>
      </div>
    </li>
  )
}

function recommendationVariant(decision: string): CalloutVariant {
  if (decision === "Accept") return "success"
  if (decision === "Human Review") return "warning"
  return "error"
}

function FieldHeading({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 mb-2 text-sm font-semibold first:mt-0">{children}</p>
}

function percent(score: number, max: number) {
  return Math.max(0, Math.min(100, (score / max) * 100))
}

function CandidateDetails({
  candidate: c,
  jd,
  profile,
  final,
  decision,
}: {
  candidate: Candidate
  jd: number
  profile: number
  final: number
  decision: string
}) {
  const emailId = useId()
  const strengths = (c.strengths ?? []).slice(0, 5)
  const missing = (c.missing_skills ?? []).slice(0, 5)

  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="max-w-full justify-start overflow-x-auto">
        <TabsTrigger value="overview"> Overview</TabsTrigger>
        <TabsTrigger value="jd">JD Analysis</TabsTrigger>
        <TabsTrigger value="profile">Profile Analysis</TabsTrigger>
        <TabsTrigger value="email"> Email</TabsTrigger>
      </TabsList>

      {/* Overview */}
      <TabsContent value="overview" className="mt-4">
        {c.error && (
          <Callout variant="error" className="mb-4">
            This resume could not be processed: {c.error}
          </Callout>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <FieldHeading>AI Summary</FieldHeading>
            <Callout variant="info">{c.summary || "No summary available."}</Callout>

            <FieldHeading>Key Strengths</FieldHeading>
            {strengths.length > 0 ? <BulletList items={strengths} marker="✅" /> : <Caption>None identified</Caption>}
          </div>
          <div>
            <FieldHeading>📊 Score Breakdown</FieldHeading>
            <Metric label="JD Match" value={`${jd}/10`} />
            <Metric label="Profile Match" value={`${profile}/10`} />
            <Metric label="Final Score" value={`${final}/20`} />

            <FieldHeading>Missing Skills</FieldHeading>
            {missing.length > 0 ? <BulletList items={missing} marker="❌" /> : <Caption>No major gaps</Caption>}
          </div>
        </div>

        <FieldHeading>🎯 Final Recommendation</FieldHeading>
        <Callout variant={recommendationVariant(decision)}>
          {c.final_recommendation_reason || "No recommendation available."}
        </Callout>
      </TabsContent>

      {/* JD Analysis */}
      <TabsContent value="jd" className="mt-4">
        <p className="text-sm font-semibold">JD Match Score: {jd}/10</p>
        <Progress value={percent(jd, 10)} className="mt-2" aria-label="JD match score" />
        <div className="mt-2 grid gap-x-6 md:grid-cols-2">
          <div>
            <FieldHeading>✅ Strengths vs JD</FieldHeading>
            <BulletList items={c.jd_strengths ?? []} />
            <FieldHeading>❌ Missing Skills</FieldHeading>
            <BulletList items={c.jd_missing_skills ?? []} />
          </div>
          <div>
            <FieldHeading> Weaknesses vs JD</FieldHeading>
            <BulletList items={c.jd_weaknesses ?? []} />
            <FieldHeading> Match Reasons</FieldHeading>
            <BulletList items={c.jd_reasons ?? []} />
          </div>
        </div>
        <FieldHeading>📖 JD Match Explanation</FieldHeading>
        <p className="text-sm whitespace-pre-line">{c.jd_explanation ?? ""}</p>
      </TabsContent>

      {/* Profile Analysis */}
      <TabsContent value="profile" className="mt-4">
        <p className="text-sm font-semibold">Profile Match Score: {profile}/10</p>
        <Progress value={percent(profile, 10)} className="mt-2" aria-label="Profile match score" />
        <div className="mt-2 grid gap-x-6 md:grid-cols-2">
          <div>
            <FieldHeading> Strengths vs Profile</FieldHeading>
            <BulletList items={c.reference_strengths ?? []} />
            <FieldHeading> Match Reasons</FieldHeading>
            <BulletList items={c.reference_reasons ?? []} />
          </div>
          <div>
            <FieldHeading> Weaknesses vs Profile</FieldHeading>
            <BulletList items={c.reference_weaknesses ?? []} />
          </div>
        </div>
        <FieldHeading> Profile Match Explanation</FieldHeading>
        <p className="text-sm whitespace-pre-line">{c.reference_explanation ?? ""}</p>
      </TabsContent>

      {/* Email */}
      <TabsContent value="email" className="mt-4">
        <FieldHeading> Generated Email</FieldHeading>
        <Callout variant="info">Status: {c.email_status || "Not Sent"}</Callout>
        {c.email_content ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor={emailId} className="font-normal">
              Email content (mock — not actually sent)
            </Label>
            <Textarea id={emailId} readOnly value={c.email_content} className="h-70 resize-y field-sizing-fixed" />
          </div>
        ) : (
          <Caption className="mt-3">No email generated.</Caption>
        )}
      </TabsContent>
    </Tabs>
  )
}
