export interface DashboardSettings {
  pr_limit: number
  ai_enabled: boolean
  model_name: string
  sample_mode: boolean
}

export interface PullRequestSummary {
  number: number
  title: string
  html_url: string
  user?: string | null
  draft: boolean
}

export interface DashboardRepository {
  owner: string
  repo: string
  metadata: { full_name: string; html_url: string; description?: string | null }
  pulls: PullRequestSummary[]
  guidelines: Array<{ path: string }>
  guideline_status: "found" | "not_found" | "retrieval_failed"
  sample_mode: boolean
}

export interface DashboardEvidence {
  source_type: string
  source: string
  excerpt?: string
  start_line?: number
  end_line?: number
}

export interface DashboardFinding {
  source: "rule" | "ai"
  category: string
  title: string
  explanation: string
  evidence: DashboardEvidence[]
  overlap_similarity?: number | null
}

export interface DashboardChangedFile {
  filename: string
  patch_excerpt?: string | null
  line_start?: number | null
  line_end?: number | null
  patch_available: boolean
  patch_truncated: boolean
}

export interface DashboardAnalysisResult {
  pr_number: number
  status: string
  category: "Likely legitimate" | "Needs review" | "Potentially suspicious"
  reason?: string | null
  findings: DashboardFinding[]
  uncertainty: string[]
  ai_enabled: boolean
  ai_status: "completed" | "failed" | "disabled"
  ai_error?: "timeout" | "invalid_output" | "unreachable" | null
  guideline_status: "found" | "not_found" | "retrieval_failed"
  guideline_path?: string | null
  is_sample: boolean
}

interface ApiFinding {
  source_type?: "rule" | "ai"
  category: string
  title: string
  explanation: string
  evidence: DashboardEvidence[]
  overlap_similarity?: number | null
}

export interface PullAnalysis {
  result: DashboardAnalysisResult
  repository: DashboardRepository["metadata"]
  pull: PullRequestSummary
  changed_files: DashboardChangedFile[]
  files_truncated: boolean
  comparison: { compared: number; available: number }
}

async function requestJson<T>(path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = body === undefined
      ? await fetch(path)
      : await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
  } catch {
    throw new Error("Could not connect to the PRism analysis service. Make sure the backend is running.")
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("PRism is receiving too many requests right now. Please wait a few minutes before trying again.")
    }
    const detail = typeof payload.detail === "string"
      ? payload.detail
      : `The analysis service returned HTTP ${response.status}.`
    if (/repository or pull request was not found|not found or is private/i.test(detail)) {
      throw new Error("Repository not found or private. Check the URL and use a public repository you can access.")
    }
    if (/github api rate limit/i.test(detail)) {
      throw new Error("GitHub's API rate limit was reached. Wait before retrying, or configure a GitHub token for higher limits.")
    }
    throw new Error(detail)
  }
  return payload as T
}

export function checkServiceStatus() {
  return requestJson<{ status: string; ai_available: boolean }>("/api/status")
}

export function fetchRepository(repoUrl: string, settings: DashboardSettings) {
  return requestJson<DashboardRepository>("/api/repository", {
    url: repoUrl,
    pr_limit: settings.pr_limit,
  })
}

export async function analyzePullRequest(
  repoUrl: string,
  pull: PullRequestSummary,
  settings: DashboardSettings,
): Promise<PullAnalysis> {
  const response = await requestJson<{
    repository: string
    is_sample: boolean
    analysis: {
      pull_request: number
      status: string
      category: DashboardAnalysisResult["category"]
      reason?: DashboardAnalysisResult["reason"]
      findings: ApiFinding[]
      summary: { limitations: string[]; ai_enabled: boolean }
      ai_status: DashboardAnalysisResult["ai_status"]
      ai_error?: DashboardAnalysisResult["ai_error"]
      guideline_status: DashboardAnalysisResult["guideline_status"]
      guideline_path?: string | null
    }
    changed_files: DashboardChangedFile[]
    files_truncated: boolean
    comparison: { compared: number; available: number }
  }>("/api/analyze", {
    url: repoUrl,
    pull_number: pull.number,
    pr_limit: settings.pr_limit,
    ai_enabled: settings.ai_enabled,
    ollama_model: settings.model_name || null,
  })

  return {
    repository: { full_name: response.repository, html_url: `https://github.com/${response.repository}` },
    pull,
    changed_files: response.changed_files,
    files_truncated: response.files_truncated,
    comparison: response.comparison,
    result: {
      pr_number: response.analysis.pull_request,
      status: response.analysis.status,
      category: response.analysis.category,
      reason: response.analysis.reason,
      findings: response.analysis.findings.map((finding) => ({
        source: finding.source_type ?? (finding.category.startsWith("ai_") ? "ai" : "rule"),
        category: finding.category,
        title: finding.title,
        explanation: finding.explanation,
        evidence: finding.evidence,
        overlap_similarity: finding.overlap_similarity,
      })),
      uncertainty: response.analysis.summary.limitations ?? [],
      ai_enabled: response.analysis.summary.ai_enabled,
      ai_status: response.analysis.ai_status,
      ai_error: response.analysis.ai_error,
      guideline_status: response.analysis.guideline_status,
      guideline_path: response.analysis.guideline_path,
      is_sample: response.is_sample,
    },
  }
}
