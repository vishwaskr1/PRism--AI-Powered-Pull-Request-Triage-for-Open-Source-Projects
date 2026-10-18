import type { DashboardFinding, PullAnalysis, PullRequestSummary } from "./api"

export type ResultCategory = "Likely legitimate" | "Needs review" | "Potentially suspicious"

export interface OverlapPullRow {
  pull: PullRequestSummary
  sharedFiles: string[]
  similarTitle: boolean
}

export interface FindingGroup {
  kind: "finding" | "overlap"
  id: string
  title: string
  sources: Array<"rule" | "ai">
  finding?: DashboardFinding
  overlapRows?: OverlapPullRow[]
  sharedFiles?: string[]
  omittedOverlapCount?: number
}

export interface GroupedFindings {
  findings: FindingGroup[]
  minor: DashboardFinding[]
}

const isOverlap = (finding: DashboardFinding) =>
  finding.category === "overlap" || /^possible overlap with PR #\d+/i.test(finding.title)

const isMinor = (finding: DashboardFinding) =>
  finding.category === "change_relevance" || finding.category === "overlap_minor" || /little lexical overlap/i.test(finding.title)

const MAX_DISPLAYED_OVERLAPS = 5

function similarTitle(left: string, right: string): boolean {
  const tokenize = (title: string) => new Set(title.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
  const leftTokens = tokenize(left)
  const rightTokens = tokenize(right)
  const union = new Set([...leftTokens, ...rightTokens])
  if (!union.size) return false
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return intersection / union.size >= 0.35
}

export function groupFindings(
  findings: DashboardFinding[],
  pulls: PullRequestSummary[],
  currentPullNumber: number,
): GroupedFindings {
  const primary = findings.filter((finding) => !isMinor(finding))
  const minor = findings.filter(isMinor)
  const overlapFindings = primary.filter(isOverlap)
  const regularFindings = primary.filter((finding) => !isOverlap(finding))
  const pullByNumber = new Map(pulls.map((pull) => [pull.number, pull]))
  const overlapByNumber = new Map<number, OverlapPullRow>()

  for (const finding of overlapFindings) {
    const numberRefs = finding.evidence.filter((item) => item.source_type === "pull_request")
    const related = numberRefs
      .map((item) => Number.parseInt(item.source, 10))
      .find((number) => Number.isInteger(number) && number !== currentPullNumber)
    if (related === undefined) continue
    const pull = pullByNumber.get(related)
    if (!pull) continue
    const row = overlapByNumber.get(related) ?? {
      pull,
      sharedFiles: [],
      similarTitle: false,
    }
    row.sharedFiles = [...new Set([
      ...row.sharedFiles,
      ...finding.evidence
        .filter((item) => item.source_type === "changed_file")
        .map((item) => item.source),
    ])].sort()
    const currentPull = pullByNumber.get(currentPullNumber)
    row.similarTitle ||= currentPull ? similarTitle(currentPull.title, pull.title) : false
    overlapByNumber.set(related, row)
  }

  const overlapRows = [...overlapByNumber.values()].sort((a, b) => a.pull.number - b.pull.number)
  const allSharedFiles = overlapRows[0]?.sharedFiles ?? []
  const filesSharedAcrossAll = allSharedFiles.length > 0 && overlapRows.every(
    (row) => row.sharedFiles.length === allSharedFiles.length
      && row.sharedFiles.every((file, index) => file === allSharedFiles[index]),
  )

  const groups: FindingGroup[] = regularFindings.map((finding, index) => ({
    kind: "finding",
    id: `finding-${finding.category}-${index}`,
    title: finding.title,
    sources: [finding.source],
    finding,
  }))

  if (overlapRows.length) {
    groups.unshift({
      kind: "overlap",
      id: "possible-overlap",
      title: `Possible overlap with ${overlapRows.length} other open PR${overlapRows.length === 1 ? "" : "s"}`,
      sources: [...new Set(overlapFindings.map((finding) => finding.source))],
      overlapRows: overlapRows.slice(0, MAX_DISPLAYED_OVERLAPS).map((row) => ({
        ...row,
        sharedFiles: filesSharedAcrossAll ? [] : row.sharedFiles,
      })),
      sharedFiles: filesSharedAcrossAll ? allSharedFiles : [],
      omittedOverlapCount: Math.max(0, overlapRows.length - MAX_DISPLAYED_OVERLAPS),
    })
  }

  return { findings: groups, minor }
}

export function categoryForAnalysis(analysis: PullAnalysis): { label: ResultCategory; tone: "good" | "review" | "caution"; reason?: string } {
  const backendCategory = analysis.result.category
  return {
    label: backendCategory,
    tone: backendCategory === "Likely legitimate"
      ? "good"
      : backendCategory === "Potentially suspicious" ? "caution" : "review",
    ...(analysis.result.reason ? { reason: analysis.result.reason } : {}),
  }
}

export function summaryForAnalysis(analysis: PullAnalysis, grouped: GroupedFindings): string[] {
  const count = grouped.findings.length
  const overlap = grouped.findings.find((finding) => finding.kind === "overlap")
  const countLabel = `${count} signal${count === 1 ? "" : "s"} found`
  const lead = overlap
    ? `${countLabel}: possible overlap with ${overlap.overlapRows?.length ?? 0} other open PR${(overlap.overlapRows?.length ?? 0) === 1 ? "" : "s"}.`
    : countLabel + "."
  if (analysis.result.ai_status === "completed") {
    return [lead, analysis.result.ai_summary?.trim() || (
      analysis.result.findings.some((finding) => finding.source === "ai")
        ? "AI suggestions with validated evidence are included."
        : "AI analysis completed; no AI findings passed evidence validation."
    )]
  }
  if (analysis.result.ai_status === "failed") return [lead]
  return [lead, "Rule-based checks only."]
}

export function aiStatusLabel(analysis: PullAnalysis): string | null {
  switch (analysis.result.ai_status) {
    case "disabled": return "AI analysis: off"
    case "completed":
      return analysis.result.findings.some((finding) => finding.source === "ai")
        ? "AI analysis: completed"
        : "AI analysis completed; no AI findings passed evidence validation."
    case "failed": return null
  }
}

export function uncertaintyForAnalysis(analysis: PullAnalysis): string[] {
  const messages = new Set<string>()
  const compared = analysis.comparison
  messages.add(`Compared against ${compared.compared} of ${compared.available} other open PR${compared.available === 1 ? "" : "s"}.`)

  if (analysis.files_truncated) messages.add("The changed-file list reached its configured retrieval limit.")
  if (analysis.changed_files.some((file) => !file.patch_available)) {
    messages.add("Some relevant changed-file diffs were unavailable.")
  }
  if (analysis.changed_files.some((file) => file.patch_available && Boolean(file.patch_excerpt) && file.patch_truncated)) {
    messages.add("Some relevant diff excerpts are shortened to about 10 lines for display.")
  }

  for (const limitation of analysis.result.uncertainty) {
    if (/comparison pull requests were capped/i.test(limitation)) continue
    if (/changed-file list was truncated/i.test(limitation)) {
      messages.add("The changed-file list reached its configured retrieval limit.")
    } else if (/did not include patch data/i.test(limitation)) {
      messages.add("Some relevant changed-file diffs were unavailable.")
    } else if (/changed-file data was not retrieved/i.test(limitation)) {
      messages.add("Changed-file data could not be retrieved.")
    } else if (/no supported contribution guidance file/i.test(limitation)) {
      messages.add("No supported repository guidance file was available.")
    } else if (/diffs were truncated at the retrieval safety limit/i.test(limitation)) {
      // The UI reports shortened excerpts only when the response marks this PR's excerpt clipped.
      continue
    } else {
      messages.add(limitation)
    }
  }
  return [...messages]
}
