import { useState } from "react"
import type { DashboardEvidence, PullAnalysis, PullRequestSummary } from "./api"
import {
  categoryForAnalysis,
  aiStatusLabel,
  groupFindings,
  summaryForAnalysis,
  uncertaintyForAnalysis,
} from "./results"

interface ResultsPanelProps {
  analysis: PullAnalysis
  pulls: PullRequestSummary[]
}

function evidenceType(sourceType: string) {
  if (sourceType === "guideline") return "Guideline"
  if (sourceType === "changed_file") return "Diff"
  return "Metadata"
}

function aiErrorMessage(error?: string | null) {
  if (error === "timeout") return "AI analysis timed out for this PR. Rule-based results only."
  if (error === "invalid_output") return "The AI returned a response PRism could not validate; it was discarded."
  if (error === "unreachable") return "AI analysis unavailable: Ollama could not be reached."
  return null
}

function guidelineMessage(analysis: PullAnalysis) {
  const result = analysis.result
  if (result.guideline_status === "found") {
    return `Guidelines: found${result.guideline_path ? ` (${result.guideline_path})` : ""}`
  }
  if (result.guideline_status === "not_found") {
    return "No contribution guidelines were found; guideline checks were skipped."
  }
  return "Guidelines could not be retrieved; guideline checks were skipped."
}

function EvidenceBlock({
  evidence,
  analysis,
}: {
  evidence: DashboardEvidence
  analysis: PullAnalysis
}) {
  const type = evidenceType(evidence.source_type)
  const file = evidence.source_type === "changed_file"
    ? analysis.changed_files.find((item) => item.filename === evidence.source)
    : undefined
  const lineLocation = evidence.start_line
    ? ` · line ${evidence.start_line}${evidence.end_line && evidence.end_line !== evidence.start_line ? `–${evidence.end_line}` : ""}`
    : ""
  const diffLocation = file?.line_start
    ? ` · lines ${file.line_start}${file.line_end && file.line_end !== file.line_start ? `–${file.line_end}` : ""}`
    : ""

  return (
    <section className="dashboard-evidence-block">
      <div className="dashboard-evidence-heading">
        <span className="dashboard-evidence-type">{type}</span>
        <span className="dashboard-evidence-location">
          {evidence.source}{evidence.source_type === "changed_file" ? diffLocation : lineLocation}
        </span>
      </div>
      {evidence.source_type === "changed_file" ? (
        file?.patch_available && file.patch_excerpt ? (
          <pre className="dashboard-code-excerpt"><code>{file.patch_excerpt}</code></pre>
        ) : (
          <p className="dashboard-evidence-unavailable">Diff unavailable from GitHub.</p>
        )
      ) : evidence.excerpt ? (
        <blockquote className="dashboard-evidence-quote">{evidence.excerpt}</blockquote>
      ) : (
        <p className="dashboard-evidence-unavailable">No excerpt was returned for this source.</p>
      )}
    </section>
  )
}

export function ResultsPanel({ analysis, pulls }: ResultsPanelProps) {
  const grouped = groupFindings(analysis.result.findings, pulls, analysis.result.pr_number)
  const category = categoryForAnalysis(analysis)
  const summary = summaryForAnalysis(analysis, grouped)
  const uncertainty = uncertaintyForAnalysis(analysis)
  const aiMessage = aiErrorMessage(analysis.result.ai_error)
  const aiLabel = aiStatusLabel(analysis)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <section className="dashboard-results" aria-labelledby="dashboard-results-title">
      <header className="dashboard-result-header">
        <div className="dashboard-results-heading">
          <div>
            <span className="landing-section-kicker">{analysis.repository.full_name}</span>
            <h2 id="dashboard-results-title">Review signals</h2>
            <p>PR #{analysis.pull.number}: {analysis.pull.title}</p>
          </div>
          <a
            className="dashboard-result-link"
            href={`${analysis.pull.html_url.replace(/\/$/, "")}/files`}
            target="_blank"
            rel="noreferrer"
          >
            Open files on GitHub ↗
          </a>
        </div>
        <div className={`dashboard-result-category ${category.tone}`}>
          <span>{category.label}</span>
          {category.reason && <small>{category.reason}</small>}
        </div>
        <div className="dashboard-result-meta" aria-label="Analysis status">
          {aiLabel && <span>{aiLabel}</span>}
          <span>{guidelineMessage(analysis)}</span>
        </div>
        {aiMessage && <p className="dashboard-ai-error" role="status">{aiMessage}</p>}
        <div className="dashboard-summary" aria-label="Analysis summary">
          {summary.map((line) => <p key={line}>{line}</p>)}
        </div>
      </header>

      <div className="dashboard-findings-list" aria-label="Findings">
        {grouped.findings.map((group) => {
          const isExpanded = expanded[group.id] === true
          const controlsId = `evidence-${group.id}`
          const finding = group.finding
          const evidence = finding?.evidence.filter((item) =>
            !(item.source_type === "pull_request" && item.source === String(analysis.pull.number))
              && !(item.source_type === "pull_request" && item.source === "title"),
          ) ?? []

          return (
            <article className="dashboard-finding-card" key={group.id}>
              <div className="dashboard-finding-topline">
                <h3>{group.title}</h3>
                <div className="dashboard-source-badges" aria-label="Finding sources">
                  {group.sources.map((source) => (
                    <span className={`dashboard-source-badge ${source}`} key={source}>
                      {source === "ai" ? "AI" : "Rule"}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className="dashboard-evidence-toggle"
                type="button"
                aria-expanded={isExpanded}
                aria-controls={controlsId}
                onClick={() => toggle(group.id)}
              >
                {isExpanded ? "Hide evidence" : "Evidence"}
              </button>
              <div id={controlsId} className="dashboard-expanded-evidence" hidden={!isExpanded}>
                {group.kind === "overlap" ? (
                  <div className="dashboard-overlap-content">
                    {group.sharedFiles && group.sharedFiles.length > 0 && (
                      <div className="dashboard-shared-files">
                        <span>Shared files</span>
                        <div className="dashboard-file-chips">
                          {group.sharedFiles.map((file) => <code key={file}>{file}</code>)}
                        </div>
                      </div>
                    )}
                    <ul className="dashboard-overlap-list">
                      {group.overlapRows?.map((row) => (
                        <li key={row.pull.number}>
                          <a href={row.pull.html_url} target="_blank" rel="noreferrer">
                            <strong>#{row.pull.number}</strong> {row.pull.title} ↗
                          </a>
                          {row.similarTitle && <span className="dashboard-similar-title">Similar title</span>}
                          {row.sharedFiles.length > 0 && (
                            <div className="dashboard-file-chips">
                              {row.sharedFiles.map((file) => <code key={file}>{file}</code>)}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {group.omittedOverlapCount ? <p>And {group.omittedOverlapCount} more related pull request{group.omittedOverlapCount === 1 ? "" : "s"}.</p> : null}
                    <p className="dashboard-overlap-caveat">Review leads, not duplicate work.</p>
                  </div>
                ) : (
                  <div className="dashboard-evidence-content">
                    {finding?.explanation && <p className="dashboard-finding-explanation">{finding.explanation}</p>}
                    {evidence.map((item, index) => (
                      <EvidenceBlock key={`${item.source_type}-${item.source}-${index}`} evidence={item} analysis={analysis} />
                    ))}
                  </div>
                )}
              </div>
            </article>
          )
        })}
        {grouped.findings.length === 0 && (
          <p className="dashboard-no-findings">No grouped review signals were returned for the available context.</p>
        )}
      </div>

      {grouped.minor.length > 0 && (
        <details className="dashboard-minor-observations">
          <summary>Minor observations ({grouped.minor.length})</summary>
          <ul>
            {grouped.minor.map((item, index) => <li key={`${item.category}-${index}`}>{item.title}</li>)}
          </ul>
          <p>These observations are not included in the signal count or category.</p>
        </details>
      )}

      <section className="dashboard-uncertainty" aria-labelledby="uncertainty-title">
        <h3 id="uncertainty-title">Uncertainty / limitations</h3>
        <ul>
          {uncertainty.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </section>
  )
}
