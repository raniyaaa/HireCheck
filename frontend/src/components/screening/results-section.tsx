"use client"

import { useMemo, useState } from "react"
import { ChevronRightIcon, DownloadIcon, SearchIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DecisionBadge, StatusIcon } from "@/components/decision"
import { StatCard } from "@/components/shared"
import { CandidateSheet } from "@/components/screening/candidate-sheet"
import type { Candidate } from "@/lib/api"
import { candidatesToCsv, csvFilename, downloadCsv } from "@/lib/csv"

const FILTERS = [
  { value: "all", label: "All decisions" },
  { value: "Accept", label: "Accept" },
  { value: "Human Review", label: "Review" },
  { value: "Reject", label: "Reject" },
] as const

function share(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}% of candidates` : ""
}

export function ResultsSection({ results }: { results: Candidate[] }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<string>("all")
  // Index into `results`; kept after closing so the panel's exit animation still has content.
  const [selected, setSelected] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const counts = useMemo(
    () => ({
      total: results.length,
      accepted: results.filter((r) => r.decision === "Accept").length,
      review: results.filter((r) => r.decision === "Human Review").length,
      rejected: results.filter((r) => r.decision === "Reject").length,
    }),
    [results],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return results
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => !q || (candidate.candidate_name ?? "").toLowerCase().includes(q))
      .filter(({ candidate }) => filter === "all" || candidate.decision === filter)
  }, [results, search, filter])

  function openCandidate(index: number) {
    setSelected(index)
    setSheetOpen(true)
  }

  return (
    <section aria-labelledby="results-heading" className="space-y-6">
      <h2 id="results-heading" className="sr-only">
        Results
      </h2>

      {/* Four across when there's room; two across in the narrower right column. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Candidates"
          value={counts.total}
          icon={<UsersIcon className="size-4 text-muted-foreground" aria-hidden />}
          hint="In this session"
        />
        <StatCard
          label="Accepted"
          value={counts.accepted}
          icon={<StatusIcon status="good" />}
          hint={share(counts.accepted, counts.total)}
        />
        <StatCard
          label="Needs review"
          value={counts.review}
          icon={<StatusIcon status="warning" />}
          hint={share(counts.review, counts.total)}
        />
        <StatCard
          label="Rejected"
          value={counts.rejected}
          icon={<StatusIcon status="critical" />}
          hint={share(counts.rejected, counts.total)}
        />
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Candidates</CardTitle>
          <CardDescription>
            Showing {filtered.length} of {counts.total}
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0}
              onClick={() =>
                downloadCsv(candidatesToCsv(filtered.map(({ candidate }) => candidate)), csvFilename())
              }
            >
              <DownloadIcon aria-hidden />
              <span>
                Export<span className="hidden sm:inline"> CSV</span>
              </span>
            </Button>
          </CardAction>
        </CardHeader>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Search candidates by name"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Filter by decision" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Candidate</TableHead>
              <TableHead className="hidden text-right sm:table-cell">JD match</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Profile match</TableHead>
              <TableHead className="text-right">
                <span className="sm:hidden">Score</span>
                <span className="hidden sm:inline">Final score</span>
              </TableHead>
              <TableHead>Decision</TableHead>
              <TableHead className="w-0 pr-4">
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No candidates match your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(({ candidate: c, index }) => {
                const name = c.candidate_name || "Unknown"
                return (
                  <TableRow key={index} className="cursor-pointer" onClick={() => openCandidate(index)}>
                    <TableCell className="pl-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openCandidate(index)
                        }}
                        className="block max-w-36 truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 min-[400px]:max-w-48 sm:max-w-56 xl:max-w-80"
                        title={name}
                      >
                        {name}
                      </button>
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Score value={c.jd_score} max={10} />
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Score value={c.reference_score} max={10} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Score value={c.final_score} max={20} strong />
                    </TableCell>
                    <TableCell>
                      <DecisionBadge decision={c.decision} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <ChevronRightIcon className="ml-auto size-4 text-muted-foreground" aria-hidden />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <CandidateSheet
        candidate={selected !== null ? (results[selected] ?? null) : null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </section>
  )
}

function Score({ value, max, strong }: { value: number | null | undefined; max: number; strong?: boolean }) {
  return (
    <span className="tabular-nums">
      <span className={strong ? "font-semibold" : "font-medium"}>{Number(value ?? 0)}</span>
      <span className="text-muted-foreground">/{max}</span>
    </span>
  )
}
