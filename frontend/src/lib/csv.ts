import type { Candidate } from "@/lib/api"

// Same columns, in the same order, as the Streamlit export (to_csv in streamlit_app.py).
const COLUMNS: [header: string, value: (c: Candidate) => string | number][] = [
  ["Name", (c) => c.candidate_name ?? ""],
  ["JD Score", (c) => c.jd_score ?? 0],
  ["Ref Score", (c) => c.reference_score ?? 0],
  ["Final Score", (c) => c.final_score ?? 0],
  ["Decision", (c) => c.decision ?? ""],
  ["Summary", (c) => c.summary ?? ""],
  ["Strengths", (c) => (c.strengths ?? []).join(", ")],
  ["Missing Skills", (c) => (c.missing_skills ?? []).join(", ")],
  ["JD Explanation", (c) => c.jd_explanation ?? ""],
  ["Ref Explanation", (c) => c.reference_explanation ?? ""],
  ["Email Status", (c) => c.email_status ?? ""],
]

function cell(value: string | number): string {
  if (typeof value === "number") return String(value)
  // Text pulled from resumes could start with a spreadsheet formula character;
  // prefix it so Excel/Sheets treat it as text instead of executing it.
  let s = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function candidatesToCsv(rows: Candidate[]): string {
  const lines = [COLUMNS.map(([h]) => h).join(",")]
  for (const row of rows) lines.push(COLUMNS.map(([, get]) => cell(get(row))).join(","))
  return lines.join("\n") + "\n"
}

/** hirecheck_YYYYMMDD_HHMMSS.csv in local time, matching the old export name. */
export function csvFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  const date = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
  const time = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  return `hirecheck_${date}_${time}.csv`
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
