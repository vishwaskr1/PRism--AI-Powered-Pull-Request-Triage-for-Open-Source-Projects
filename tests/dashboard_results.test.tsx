// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DashboardPage from "../src/dashboard/DashboardPage"
import { ResultsPanel } from "../src/dashboard/ResultsPanel"
import type { DashboardFinding, PullAnalysis, PullRequestSummary } from "../src/dashboard/api"
import { BrowserRouter } from "../src/router"
import { ThemeProvider } from "../src/theme"
import { aiStatusLabel, categoryForAnalysis, groupFindings, summaryForAnalysis, uncertaintyForAnalysis } from "../src/dashboard/results"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const pulls: PullRequestSummary[] = Array.from({ length: 7 }, (_, index) => ({
  number: index + 1,
  title: index === 0 ? "Current change" : `Related change ${index + 1}`,
  html_url: `https://github.com/acme/project/pull/${index + 1}`,
  user: `author-${index + 1}`,
  draft: index === 1,
}))

function overlapFinding(number: number, similarity = 0.73): DashboardFinding {
  return {
    source: "rule",
    category: "overlap",
    title: `Possible overlap with PR #${number}`,
    explanation: `Lexical similarity ${similarity.toFixed(2)} from retrieved metadata.`,
    overlap_similarity: similarity,
    evidence: [
      { source_type: "pull_request", source: "1", excerpt: "Current change" },
      { source_type: "pull_request", source: String(number), excerpt: `Related change ${number}` },
      { source_type: "changed_file", source: "src/shared.ts" },
    ],
  }
}

function analysisWith(
  findings: DashboardFinding[],
  status = "POSSIBLE_OVERLAP",
): PullAnalysis {
  return {
    repository: { full_name: "acme/project", html_url: "https://github.com/acme/project" },
    pull: pulls[0],
    changed_files: [],
    files_truncated: false,
    comparison: { compared: 6, available: 6 },
    result: {
      pr_number: 1,
      status,
      category: status === "CONSISTENT_WITH_AVAILABLE_CHECKS" ? "Likely legitimate" : "Needs review",
      reason: status === "POSSIBLE_OVERLAP" ? "possible overlap" : null,
      findings,
      uncertainty: [],
      ai_enabled: false,
      ai_status: "disabled",
      ai_error: null,
      guideline_status: "found",
      guideline_path: "CONTRIBUTING.md",
      is_sample: false,
    },
  }
}

function renderDashboard() {
  return render(<ThemeProvider><BrowserRouter><DashboardPage /></BrowserRouter></ThemeProvider>)
}

function qualityResponse(number: number, extra: Record<string, unknown> = {}) {
  return {
    verdict: "genuine",
    score: 82,
    confidence: "medium",
    summary: "A focused contribution with useful changes.",
    reasons: ["Updates source code."],
    red_flags: [],
    green_flags: ["Includes a focused change."],
    heuristic_score: 77,
    signals: { trivial_change: false },
    source: "heuristic",
    model: "heuristic-v1",
    cached: false,
    owner: "acme",
    repo: "project",
    number,
    head_sha: "fixture-head-sha",
    ...extra,
  }
}

describe("dashboard result grouping and evidence", () => {
  it("merges six overlap findings into one group with unique pull requests", () => {
    const grouped = groupFindings(
      pulls.slice(1).map((pull) => overlapFinding(pull.number)),
      pulls,
      1,
    )
    expect(grouped.findings).toHaveLength(1)
    expect(grouped.findings[0].title).toBe("Possible overlap with 6 other open PRs")
    expect(grouped.findings[0].overlapRows?.map((row) => row.pull.number)).toEqual([2, 3, 4, 5, 6])
    expect(grouped.findings[0].omittedOverlapCount).toBe(1)
    expect(grouped.findings[0].sharedFiles).toEqual(["src/shared.ts"])
  })

  it("caps displayed overlap rows and reports the omitted count", () => {
    const grouped = groupFindings(
      Array.from({ length: 7 }, (_, index) => overlapFinding(index + 2)),
      [...pulls, { number: 8, title: "Related 8", html_url: "https://github.com/acme/project/pull/8", draft: false }],
      1,
    )
    expect(grouped.findings[0].overlapRows).toHaveLength(5)
    expect(grouped.findings[0].omittedOverlapCount).toBe(2)
  })

  it("groups single-file overlap observations under minor observations", () => {
    const minor: DashboardFinding = {
      source: "rule", category: "overlap_minor", title: "One meaningful changed file is shared with PR #2",
      explanation: "A single shared path is a minor observation.", evidence: [],
    }
    expect(groupFindings([minor], pulls, 1)).toMatchObject({ findings: [], minor: [minor] })
  })

  it("does not render numeric similarity scores", () => {
    render(<ResultsPanel analysis={analysisWith(pulls.slice(1).map((pull) => overlapFinding(pull.number)))} pulls={pulls} />)
    fireEvent.click(screen.getByRole("button", { name: "Evidence" }))
    expect(screen.queryByText("Similar title")).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/similarity\s+0\.\d+/i)
    expect(document.body.textContent).not.toContain("0.73")
  })

  it("marks title similarity from titles, not the hidden overlap score", () => {
    const similarPulls = [
      { ...pulls[0], title: "Add repository authentication support" },
      { ...pulls[1], title: "Add repository authentication support to settings" },
    ]
    const grouped = groupFindings([overlapFinding(2, 0)], similarPulls, 1)
    expect(grouped.findings[0].overlapRows?.[0].similarTitle).toBe(true)
  })

  it("keeps minor observations out of the count and category", () => {
    const minor: DashboardFinding = {
      source: "rule",
      category: "change_relevance",
      title: "Purpose and changed paths have little lexical overlap",
      explanation: "A limited name-based heuristic.",
      evidence: [],
    }
    const analysis = analysisWith([minor], "CONSISTENT_WITH_AVAILABLE_CHECKS")
    const grouped = groupFindings(analysis.result.findings, pulls, 1)
    expect(grouped.findings).toHaveLength(0)
    expect(grouped.minor).toHaveLength(1)
    expect(categoryForAnalysis(analysis).label).toBe("Likely legitimate")
    expect(summaryForAnalysis(analysis, grouped)[0]).toBe("0 signals found.")
    render(<ResultsPanel analysis={analysis} pulls={pulls} />)
    expect(screen.getByText("Minor observations (1)").closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText("0 signals found.")).toBeInTheDocument()
  })

  it("expands and collapses evidence, rendering excerpts as text", () => {
    const excerpt = "Tests must cover <script>alert('plain text')</script>."
    const finding: DashboardFinding = {
      source: "rule",
      category: "guideline",
      title: "Test-related guidance may need review",
      explanation: "The available project guide mentions tests.",
      evidence: [{ source_type: "guideline", source: "CONTRIBUTING.md", excerpt, start_line: 12, end_line: 12 }],
    }
    render(<ResultsPanel analysis={analysisWith([finding], "NEEDS_REVIEW")} pulls={pulls} />)
    const toggle = screen.getByRole("button", { name: "Evidence" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText(excerpt)).toBeInTheDocument()
    expect(document.querySelector("script")).toBeNull()
    expect(screen.getByText("Guideline")).toBeInTheDocument()
    expect(screen.getByText("CONTRIBUTING.md · line 12")).toBeInTheDocument()
    expect(screen.getByText("Guidelines: found (CONTRIBUTING.md)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Hide evidence" }))
    expect(screen.getByRole("button", { name: "Evidence" })).toHaveAttribute("aria-expanded", "false")
  })

  it("shows sanitized AI failure and explicit guideline retrieval states", () => {
    const analysis = analysisWith([], "NEEDS_REVIEW")
    analysis.result.ai_status = "failed"
    analysis.result.ai_error = "timeout"
    analysis.result.guideline_status = "retrieval_failed"
    analysis.result.guideline_path = null
    const { rerender } = render(<ResultsPanel analysis={analysis} pulls={pulls} />)
    expect(screen.queryByText("AI analysis: failed")).not.toBeInTheDocument()
    expect(screen.getByText("AI analysis timed out for this PR. Rule-based results only.")).toBeInTheDocument()
    expect(screen.getByText("Guidelines could not be retrieved; guideline checks were skipped.")).toBeInTheDocument()

    analysis.result.ai_error = "invalid_output"
    rerender(<ResultsPanel analysis={analysis} pulls={pulls} />)
    expect(screen.getByText("The AI returned a response PRism could not validate; it was discarded.")).toBeInTheDocument()
    analysis.result.ai_error = "unreachable"
    rerender(<ResultsPanel analysis={analysis} pulls={pulls} />)
    expect(screen.getByText("AI analysis is temporarily unavailable from the hosted provider. Rule-based results only.")).toBeInTheDocument()

    analysis.result.guideline_status = "not_found"
    rerender(<ResultsPanel analysis={analysis} pulls={pulls} />)
    expect(screen.getByText("No contribution guidelines were found; guideline checks were skipped.")).toBeInTheDocument()
  })

  it("uses consistent AI status wording for disabled and completed analyses", () => {
    const analysis = analysisWith([], "NEEDS_REVIEW")
    expect(aiStatusLabel(analysis)).toBe("AI analysis: off")
    expect(summaryForAnalysis(analysis, groupFindings([], pulls, 1))).toContain("Rule-based checks only.")

    analysis.result.ai_status = "completed"
    expect(aiStatusLabel(analysis)).toBe("AI analysis completed; no AI findings passed evidence validation.")
    expect(summaryForAnalysis(analysis, groupFindings([], pulls, 1))).not.toContain("Rule-based checks only.")
    expect(summaryForAnalysis(analysis, groupFindings([], pulls, 1))).toContain("AI analysis completed; no AI findings passed evidence validation.")

    analysis.result.findings = [{ ...overlapFinding(2), source: "ai" }]
    expect(aiStatusLabel(analysis)).toBe("AI analysis: completed")
  })

  it("shows shortened-diff uncertainty only for a truncated excerpt actually returned", () => {
    const analysis = analysisWith([])
    analysis.changed_files = [{ filename: "src/a.ts", patch_available: true, patch_truncated: true }]
    expect(uncertaintyForAnalysis(analysis).some((item) => item.includes("shortened"))).toBe(false)
    analysis.changed_files[0].patch_excerpt = "@@ -1 +1 @@\n-old\n+new"
    expect(uncertaintyForAnalysis(analysis).some((item) => item.includes("shortened"))).toBe(true)
  })

  it("renders the category reason beside the result category", () => {
    const analysis = analysisWith([], "NEEDS_REVIEW")
    analysis.result.reason = "guidelines unavailable"
    render(<ResultsPanel analysis={analysis} pulls={pulls} />)
    expect(screen.getByText("Needs review")).toBeInTheDocument()
    expect(screen.getByText("guidelines unavailable")).toBeInTheDocument()
  })
})

describe("dashboard repository flow", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addListener: vi.fn(), removeListener: vi.fn() })
    window.scrollTo = vi.fn()
    window.history.replaceState(null, "", "/dashboard")
    window.localStorage.removeItem("prism-theme")
  })

  it("shows heuristic-only mode when no hosted provider is configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", ai_available: false }),
    }))
    renderDashboard()
    expect(await screen.findByText("AI providers are not configured. PRs will use heuristic-only results.")).toBeInTheDocument()
  })

  it("shows bundled sample mode without making repository or analysis requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok", ai_available: false }) })
    vi.stubGlobal("fetch", fetchMock)
    renderDashboard()
    fireEvent.click(screen.getByRole("checkbox", { name: /Sample mode/ }))
    expect(await screen.findByText("SAMPLE DATA, not a live analysis")).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(["/api/status"])
  })

  it("rejects an invalid repository URL with the SRS error text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ai_available: false }) }))
    renderDashboard()
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), { target: { value: "https://github.com/owner/repo/pull/2" } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("That doesn't look like a GitHub repository URL. Use the form https://github.com/owner/repo.")
  })

  it("filters the PR list by its analyzed category", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/status") return { ok: true, json: async () => ({ ai_available: false }) } as Response
      if (path === "/api/repository") return { ok: true, json: async () => ({
        owner: "acme", repo: "project", metadata: { full_name: "acme/project", html_url: "https://github.com/acme/project" },
        pulls: pulls.slice(0, 2), guidelines: [], guideline_status: "not_found", sample_mode: false,
      }) } as Response
      const body = JSON.parse(String(init?.body ?? "{}"))
      return { ok: true, json: async () => qualityResponse(body.number, { verdict: body.number === 1 ? "low_quality" : "genuine" }) } as Response
    }))
    renderDashboard()
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), { target: { value: "https://github.com/acme/project" } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }))
    await screen.findByRole("heading", { name: "Open pull requests" })
    fireEvent.click(screen.getByRole("row", { name: /#1 Current change/ }))
    await screen.findByRole("heading", { name: "Current change" })
    fireEvent.change(screen.getByLabelText("Filter by category"), { target: { value: "Needs review" } })
    expect(screen.getByRole("row", { name: /#1 Current change/ })).toBeInTheDocument()
    expect(screen.queryByRole("row", { name: /#2 Related change/ })).not.toBeInTheDocument()
  })

  it("does not analyze multiple PRs automatically and analyzes only a clicked row", async () => {
    const requestedPulls: number[] = []
    const requestedUrls: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/status") {
        return { ok: true, json: async () => ({ status: "ok", ai_available: false }) } as Response
      }
      const body = JSON.parse(String(init?.body ?? "{}"))
      if (path === "/api/repository") {
        requestedUrls.push(body.url)
        return {
          ok: true,
          json: async () => ({
            owner: "acme",
            repo: "project",
            metadata: { full_name: "acme/project", html_url: "https://github.com/acme/project" },
            pulls: pulls.slice(0, 2),
            guidelines: [],
            guideline_status: "not_found",
            sample_mode: false,
          }),
        } as Response
      }
      requestedPulls.push(body.number)
      return {
        ok: true,
        json: async () => qualityResponse(body.number),
      } as Response
    })
    vi.stubGlobal("fetch", fetchMock)
    renderDashboard()

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: { value: "https://github.com/acme/project.git/" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }))

    await screen.findByRole("heading", { name: "Open pull requests" })
    expect(requestedPulls).toEqual([])
    const secondRow = screen.getByRole("row", { name: /#2 Related change 2/ })
    fireEvent.click(secondRow)
    await waitFor(() => expect(requestedPulls).toEqual([2]))
    expect(requestedUrls).toEqual(["https://github.com/acme/project"])
    expect(within(secondRow).getByText("Draft")).toBeInTheDocument()
  })

  it("automatically analyzes a repository's only open PR", async () => {
    const requestedPulls: number[] = []
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/status") return { ok: true, json: async () => ({ ai_available: false }) } as Response
      if (path === "/api/repository") return {
        ok: true,
        json: async () => ({
          owner: "acme", repo: "project",
          metadata: { full_name: "acme/project", html_url: "https://github.com/acme/project" },
          pulls: pulls.slice(0, 1), guidelines: [], guideline_status: "not_found", sample_mode: false,
        }),
      } as Response
      const body = JSON.parse(String(init?.body ?? "{}"))
      requestedPulls.push(body.number)
      return {
        ok: true,
        json: async () => qualityResponse(body.number),
      } as Response
    }))
    renderDashboard()
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), { target: { value: "https://github.com/acme/project" } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }))
    await screen.findAllByText("Likely legitimate")
    expect(requestedPulls).toEqual([1])
  })

  it("analyzes all pull requests one at a time with the configured 2.5 second gap", async () => {
    const requested: number[] = []
    const delay = vi.spyOn(window, "setTimeout")
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/status") return { ok: true, json: async () => ({ ai_available: false }) } as Response
      const body = JSON.parse(String(init?.body ?? "{}"))
      if (path === "/api/repository") return { ok: true, json: async () => ({
        owner: "acme", repo: "project", metadata: { full_name: "acme/project", html_url: "https://github.com/acme/project" },
        pulls: pulls.slice(0, 3), guidelines: [], guideline_status: "not_found", sample_mode: false,
      }) } as Response
      requested.push(body.number)
      return { ok: true, json: async () => qualityResponse(body.number) } as Response
    }))
    renderDashboard()
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), { target: { value: "https://github.com/acme/project" } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }))
    await screen.findByRole("heading", { name: "Open pull requests" })
    fireEvent.click(screen.getByRole("row", { name: /#1 Current change/ }))
    await screen.findByText("Analysis source: Heuristic fallback (heuristic-v1)")
    expect(screen.getByText("Reasons to review").closest("details")).not.toHaveAttribute("open")
    fireEvent.click(screen.getByText("Reasons to review"))
    expect(await screen.findByText("Updates source code.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Analyze all PRs" }))
    await waitFor(() => expect(requested).toEqual([1, 2, 3]), { timeout: 8000 })
    expect(delay).toHaveBeenCalledWith(expect.any(Function), 2500)
  }, 10000)

  it("keeps a failed row local and allows another PR to be analyzed", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/status") return { ok: true, json: async () => ({ ai_available: false }) } as Response
      const body = JSON.parse(String(init?.body ?? "{}"))
      if (path === "/api/repository") return {
        ok: true,
        json: async () => ({
          owner: "acme", repo: "project",
          metadata: { full_name: "acme/project", html_url: "https://github.com/acme/project" },
          pulls: pulls.slice(0, 3), guidelines: [], guideline_status: "not_found", sample_mode: false,
        }),
      } as Response
      if (body.number === 2) return {
        ok: false,
        status: 502,
        json: async () => ({ detail: "Temporary service failure" }),
      } as Response
      return {
        ok: true,
        json: async () => qualityResponse(body.number),
      } as Response
    })
    vi.stubGlobal("fetch", fetchMock)
    renderDashboard()
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), { target: { value: "https://github.com/acme/project" } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }))
    await screen.findByRole("heading", { name: "Open pull requests" })

    fireEvent.click(screen.getByRole("row", { name: /#2 Related change 2/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary service failure")
    fireEvent.click(screen.getByRole("row", { name: /#3 Related change 3/ }))
    const thirdRow = screen.getByRole("row", { name: /#3 Related change 3/ })
    expect(await within(thirdRow).findByText("Likely legitimate")).toBeInTheDocument()
  })

  it("queues row analyses one at a time and continues after the first fails", async () => {
    let finishFirst!: (response: Response) => void
    const requested: number[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === "/api/status") return { ok: true, json: async () => ({ ai_available: false }) } as Response
      const body = JSON.parse(String(init?.body ?? "{}"))
      if (path === "/api/repository") return { ok: true, json: async () => ({
        owner: "acme", repo: "project", metadata: { full_name: "acme/project", html_url: "https://github.com/acme/project" },
        pulls: pulls.slice(0, 3), guidelines: [], guideline_status: "not_found", sample_mode: false,
      }) } as Response
      requested.push(body.number)
      if (body.number === 2) return await new Promise<Response>((resolve) => { finishFirst = resolve })
      return { ok: true, json: async () => qualityResponse(body.number) } as Response
    })
    vi.stubGlobal("fetch", fetchMock)
    renderDashboard()
    fireEvent.change(screen.getByLabelText("GitHub repository URL"), { target: { value: "https://github.com/acme/project" } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }))
    await screen.findByRole("heading", { name: "Open pull requests" })
    fireEvent.click(screen.getByRole("row", { name: /#2 Related change 2/ }))
    fireEvent.click(screen.getByRole("row", { name: /#3 Related change 3/ }))
    await waitFor(() => expect(requested).toEqual([2]))
    expect(within(screen.getByRole("row", { name: /#3 Related change 3/ })).getByRole("button", { name: "Queued…" })).toBeInTheDocument()
    finishFirst({ ok: false, status: 502, json: async () => ({ detail: "Temporary failure" }) } as Response)
    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary failure")
    const thirdRow = screen.getByRole("row", { name: /#3 Related change 3/ })
    expect(await within(thirdRow).findByText("Likely legitimate")).toBeInTheDocument()
    expect(requested).toEqual([2, 3])
  })
})
