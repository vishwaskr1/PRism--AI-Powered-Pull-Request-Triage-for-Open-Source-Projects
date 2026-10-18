import type { QualityPullAnalysis } from "./api"

interface Props {
  analysis: QualityPullAnalysis
}

const verdictLabels = {
  genuine: "Likely legitimate",
  low_quality: "Needs review",
  spam: "Potentially suspicious",
} as const

export function PRReviewPanel({ analysis }: Props) {
  const { result, pull, repository } = analysis
  return (
    <section className="dashboard-results" aria-labelledby="dashboard-review-title">
      <div className="dashboard-result-header">
        <div className="dashboard-results-heading">
          <div>
            <span className="landing-section-kicker">PR #{pull.number} · {repository.full_name}</span>
            <h2 id="dashboard-review-title">{pull.title}</h2>
            <p>Advisory review · @{pull.user || "author unavailable"}</p>
          </div>
          <a className="dashboard-result-link" href={pull.html_url} target="_blank" rel="noreferrer">Open pull request ↗</a>
        </div>
        <span className={`dashboard-result-category ${result.verdict === "genuine" ? "good" : result.verdict === "spam" ? "caution" : "review"}`}>
          {verdictLabels[result.verdict]}
          <small>Score {result.score}/100</small>
        </span>
        <div className="dashboard-result-meta">
          <span>Confidence: {result.confidence}</span>
          <span>Analysis source: {result.source === "heuristic" ? "Heuristic fallback" : result.source === "groq" ? "Groq" : "Gemma"} ({result.model})</span>
          {result.cached && <span>Cached for this pull request revision</span>}
          <span>Head revision: <code>{result.head_sha.slice(0, 12)}</code></span>
        </div>
        <p className="dashboard-summary">{result.summary}</p>
      </div>

      <aside className="dashboard-advisory" role="note">
        This is an advisory quality signal, not a verified judgment about contributor intent or code safety. Review the pull request yourself.
      </aside>

      <div className="dashboard-quality-grid">
        <QualityList title="Reasons to review" items={result.reasons} empty="No additional reasons were returned." />
        <QualityList title="Potential concerns" items={result.red_flags} empty="No potential concerns were returned." tone="caution" />
        <QualityList title="Positive signals" items={result.green_flags} empty="No positive signals were returned." tone="good" />
      </div>
      <p className="dashboard-result-meta">Heuristic score: {result.heuristic_score}/100. {result.source === "heuristic" ? "Provider analysis was unavailable, so this result is based on repository metadata and changed-file signals." : "Model output is advisory and should be checked against the actual changes."}</p>
    </section>
  )
}

function QualityList({ title, items, empty, tone = "" }: { title: string; items: string[]; empty: string; tone?: string }) {
  return (
    <details className={`dashboard-quality-card ${tone}`}>
      <summary><h3>{title}</h3></summary>
      {items.length ? <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <p>{empty}</p>}
    </details>
  )
}
