"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { StatusIcon } from "@/components/decision"
import { Field } from "@/components/shared"

export const ACCEPT_RANGE = { min: 15, max: 20 } as const
export const REVIEW_MIN = 10

interface CriteriaCardProps {
  jobDescription: string
  onJobDescriptionChange: (v: string) => void
  idealProfile: string
  onIdealProfileChange: (v: string) => void
  acceptThreshold: number
  onAcceptThresholdChange: (v: number) => void
  reviewThreshold: number
  onReviewThresholdChange: (v: number) => void
  disabled?: boolean
}

export function CriteriaCard({
  jobDescription,
  onJobDescriptionChange,
  idealProfile,
  onIdealProfileChange,
  acceptThreshold,
  onAcceptThresholdChange,
  reviewThreshold,
  onReviewThresholdChange,
  disabled,
}: CriteriaCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Screening criteria</CardTitle>
        <CardDescription>What every resume in this session is scored against.</CardDescription>
      </CardHeader>

      {/* Side by side on tablets, where this card spans the full width; stacked elsewhere. */}
      <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        <Field id="jd" label="Job description" hint="Paste the full job description, including requirements.">
          <Textarea
            id="jd"
            aria-describedby="jd-hint"
            value={jobDescription}
            onChange={(e) => onJobDescriptionChange(e.target.value)}
            disabled={disabled}
            placeholder="e.g. Senior Python engineer with FastAPI and AWS experience…"
            className="h-40 resize-y field-sizing-fixed"
          />
        </Field>

        <Field id="ideal" label="Ideal candidate profile" hint="Describe the background and traits of the person you'd hire.">
          <Textarea
            id="ideal"
            aria-describedby="ideal-hint"
            value={idealProfile}
            onChange={(e) => onIdealProfileChange(e.target.value)}
            disabled={disabled}
            placeholder="e.g. Has shipped production APIs, mentors others…"
            className="h-40 resize-y field-sizing-fixed"
          />
        </Field>

        <fieldset className="md:col-span-2 lg:col-span-1">
          <legend className="text-sm font-medium">Decision thresholds</legend>
          <p className="mt-1 text-xs text-muted-foreground">
            The final score is the JD match plus the profile match, out of 20.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-1">
            <ThresholdSlider
              id="accept-threshold"
              label="Accept when score is above"
              value={acceptThreshold}
              min={ACCEPT_RANGE.min}
              max={ACCEPT_RANGE.max}
              onChange={onAcceptThresholdChange}
              disabled={disabled}
            />
            <ThresholdSlider
              id="review-threshold"
              label="Review when score is at least"
              value={reviewThreshold}
              min={REVIEW_MIN}
              max={acceptThreshold}
              onChange={onReviewThresholdChange}
              disabled={disabled}
            />
          </div>

          <ul
            aria-label="How scores map to decisions"
            className="mt-5 grid gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-3 sm:gap-4 lg:grid-cols-1 lg:gap-2"
          >
            <ThresholdRule status="good" label="Accept" range={`above ${acceptThreshold}`} />
            <ThresholdRule status="warning" label="Review" range={`${reviewThreshold} – ${acceptThreshold}`} />
            <ThresholdRule status="critical" label="Reject" range={`below ${reviewThreshold}`} />
          </ul>
        </fieldset>
      </CardContent>
    </Card>
  )
}

function ThresholdRule({ status, label, range }: { status: "good" | "warning" | "critical"; label: string; range: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <StatusIcon status={status} />
        {label}
      </span>
      <span className="text-muted-foreground tabular-nums">{range}</span>
    </li>
  )
}

function ThresholdSlider({
  id,
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label id={`${id}-label`} className="font-normal">
          {label}
        </Label>
        <span className="rounded-md border bg-background px-2 py-0.5 text-sm font-medium tabular-nums">{value}</span>
      </div>
      <Slider
        aria-labelledby={`${id}-label`}
        value={[value]}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
