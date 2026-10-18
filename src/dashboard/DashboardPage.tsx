import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { Link, useLocation } from "../router"
import { Brand } from "../landing/Brand"
import { ThemeToggle } from "../ThemeToggle"
import { footerLinks, LANDING_PATH, sectionNavNames, trialCopy } from "../landing/content"
import { SampleResultCard, validRepositoryUrl } from "../landing/sections/TrialSection"
import {
  analyzePullRequest,
  checkServiceStatus,
  fetchRepository,
  type DashboardAnalysisResult,
  type DashboardRepository,
  type DashboardSettings,
  type PullAnalysis,
  type PullRequestSummary,
} from "./api"
import { ResultsPanel } from "./ResultsPanel"
import { categoryForAnalysis, groupFindings } from "./results"
import "./dashboard.css"

function repoFromQuery(): string {
  try {
    // URLSearchParams safely decodes the query value; React renders it as text only.
    return new URLSearchParams(window.location.search).get("repo") ?? ""
  } catch {
    return ""
  }
}

function visibleFindingCount(result: DashboardAnalysisResult, pulls: PullRequestSummary[]) {
  return groupFindings(result.findings, pulls, result.pr_number).findings.length
}

export default function DashboardPage() {
  const location = useLocation()
  const pageRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [repoUrl, setRepoUrl] = useState(repoFromQuery)
  const [settings, setSettings] = useState<DashboardSettings>({
    pr_limit: 10,
    ai_enabled: false,
    model_name: "",
    sample_mode: false,
  })
  const [message, setMessage] = useState("")
  const [repository, setRepository] = useState<DashboardRepository | null>(null)
  const [loadedRepositoryUrl, setLoadedRepositoryUrl] = useState("")
  const [analyses, setAnalyses] = useState<Record<number, PullAnalysis>>({})
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [selectedPullNumber, setSelectedPullNumber] = useState<number | null>(null)
  const [isFetchingRepository, setIsFetchingRepository] = useState(false)
  const [analyzingNumber, setAnalyzingNumber] = useState<number | null>(null)
  const [queuedNumbers, setQueuedNumbers] = useState<number[]>([])
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [aiAvailable, setAiAvailable] = useState(false)
  const analysisQueue = useRef<Promise<void>>(Promise.resolve())
  const activeAnalysis = useRef<number | null>(null)
  const queuedAnalysis = useRef(new Set<number>())

  useEffect(() => {
    let active = true
    void checkServiceStatus()
      .then((status) => { if (active) setAiAvailable(status.ai_available === true) })
      .catch(() => { if (active) setAiAvailable(false) })
    return () => { active = false }
  }, [])

  // A new dashboard route/handoff starts a fresh attempt.
  useEffect(() => {
    setMessage("")
    setRepository(null)
    setLoadedRepositoryUrl("")
    setAnalyses({})
    setRowErrors({})
    setSelectedPullNumber(null)
    setCategoryFilter("all")
    queuedAnalysis.current.clear()
    setQueuedNumbers([])
    setRepoUrl(repoFromQuery())
  }, [location])

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let disposed = false
    let revert: (() => void) | undefined
    void import("gsap").then(({ gsap }) => {
      if (disposed || !pageRef.current) return
      const context = gsap.context(() => {
        gsap.from(pageRef.current, { autoAlpha: 0, y: 8, duration: 0.32, ease: "power2.out" })
      }, pageRef)
      revert = () => context.revert()
    }).catch(() => {})
    return () => {
      disposed = true
      revert?.()
    }
  }, [])

  const updateSetting = <K extends keyof DashboardSettings>(key: K, value: DashboardSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const analyzePull = useCallback(async (
    repo: DashboardRepository,
    pull: PullRequestSummary,
    repositoryUrl = repoUrl,
  ) => {
    setSelectedPullNumber(pull.number)
    setMessage("")
    setRowErrors((current) => ({ ...current, [pull.number]: "" }))
    if (activeAnalysis.current === pull.number || queuedAnalysis.current.has(pull.number)) return
    queuedAnalysis.current.add(pull.number)
    setQueuedNumbers((current) => [...current, pull.number])
    analysisQueue.current = analysisQueue.current.then(async () => {
      queuedAnalysis.current.delete(pull.number)
      activeAnalysis.current = pull.number
      setQueuedNumbers((current) => current.filter((number) => number !== pull.number))
      setAnalyzingNumber(pull.number)
      try {
        const detail = await analyzePullRequest(repositoryUrl, pull, settings)
        setAnalyses((current) => ({ ...current, [pull.number]: detail }))
      } catch (error) {
        setRowErrors((current) => ({
          ...current,
          [pull.number]: error instanceof Error ? error.message : "The analysis request failed. Please try again.",
        }))
      } finally {
        activeAnalysis.current = null
        setAnalyzingNumber(null)
      }
    })
    await analysisQueue.current
  }, [repoUrl, settings])

  const analyzeRepositoryForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage("")
    const normalized = validRepositoryUrl(repoUrl)
    if (!normalized) {
      setMessage(trialCopy.invalidUrl)
      return
    }
    setRepoUrl(normalized)
    if (settings.sample_mode) {
      setRepository(null)
      setLoadedRepositoryUrl("")
      setAnalyses({})
      setRowErrors({})
      setSelectedPullNumber(null)
      return
    }

    setIsFetchingRepository(true)
    setRowErrors({})
    try {
      const fetched = await fetchRepository(normalized, settings)
      setAnalyses({})
      setRowErrors({})
      setSelectedPullNumber(null)
      setCategoryFilter("all")
      setRepository(fetched)
      setLoadedRepositoryUrl(normalized)
      if (fetched.pulls.length === 0) {
        setMessage(`${fetched.metadata.full_name} has no open pull requests to review.`)
        return
      }
      if (fetched.pulls.length === 1) {
        setSelectedPullNumber(fetched.pulls[0].number)
        await analyzePull(fetched, fetched.pulls[0], normalized)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The repository request failed. Please try again.")
    } finally {
      setIsFetchingRepository(false)
    }
  }

  const selectPull = (pull: PullRequestSummary) => {
    setSelectedPullNumber(pull.number)
    if (!analyses[pull.number] && repository) void analyzePull(repository, pull, loadedRepositoryUrl || repoUrl)
  }

  const selectPullByKey = (event: KeyboardEvent<HTMLTableRowElement>, pull: PullRequestSummary) => {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      selectPull(pull)
    }
  }

  const clearFetchedResult = () => {
    setAnalyses({})
    setSelectedPullNumber(null)
  }

  const selectedAnalysis = selectedPullNumber === null ? null : analyses[selectedPullNumber]

  return (
    <main className="dashboard-page" ref={pageRef}>
      <header className="dashboard-nav">
        <Link to={LANDING_PATH} className="brand-link" aria-label={sectionNavNames.home}><Brand /></Link>
        <div className="dashboard-nav-actions">
          <ThemeToggle />
          <Link to={LANDING_PATH} className="dashboard-back">← Back to landing page</Link>
        </div>
      </header>

      <section className="dashboard-shell" aria-labelledby="dashboard-title">
        <div className="dashboard-heading">
          <span className="landing-section-kicker">MVP IN DEVELOPMENT</span>
          <h1 id="dashboard-title" ref={titleRef} tabIndex={-1}>PRism dashboard</h1>
          <p>Enter a public GitHub repository to prepare a review.</p>
        </div>

        <aside className="dashboard-advisory" role="note">
          Labels are recommendations, not verified judgments about contributor intent or code safety.
        </aside>

        <form className="dashboard-repo-form" onSubmit={analyzeRepositoryForm} noValidate>
          <label htmlFor="dashboard-repo-url">GitHub repository URL</label>
          <div className="dashboard-repo-row">
            <input
              id="dashboard-repo-url"
              name="repo"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(event) => {
                setRepoUrl(event.target.value)
                setMessage("")
              }}
              aria-describedby={message ? "dashboard-message" : undefined}
            />
            <button className="landing-primary" type="submit" disabled={isFetchingRepository || analyzingNumber !== null || queuedNumbers.length > 0 || settings.sample_mode}>
              {isFetchingRepository ? "Fetching…" : analyzingNumber !== null ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </form>

        <section className="dashboard-settings" aria-labelledby="settings-title">
          <div className="dashboard-panel-heading">
            <h2 id="settings-title">Settings</h2>
            <span>Applied to repository analysis</span>
          </div>
          <div className="dashboard-settings-grid">
            <label className="dashboard-field" htmlFor="dashboard-pr-limit">
              <span>PR limit</span>
              <input
                id="dashboard-pr-limit"
                type="number"
                min={1}
                max={30}
                value={settings.pr_limit}
                onChange={(event) => {
                  updateSetting("pr_limit", Math.max(1, Math.min(30, Number(event.target.value) || 1)))
                  setRepository(null)
                  setLoadedRepositoryUrl("")
                  clearFetchedResult()
                }}
              />
              <small>1–30 pull requests</small>
            </label>
            <label className="dashboard-field" htmlFor="dashboard-model">
              <span>Model name</span>
              <input id="dashboard-model" type="text" value={settings.model_name} placeholder="Optional local model" onChange={(event) => { updateSetting("model_name", event.target.value); clearFetchedResult() }} />
              <small>Used only when AI is enabled</small>
            </label>
            <label className="dashboard-toggle" htmlFor="dashboard-ai">
              <input
                id="dashboard-ai"
                type="checkbox"
                checked={settings.ai_enabled && aiAvailable}
                disabled={!aiAvailable}
                onChange={(event) => {
                  updateSetting("ai_enabled", event.target.checked)
                  setMessage("")
                  clearFetchedResult()
                }}
              />
              <span>
                <strong>AI analysis</strong>
                <small>{aiAvailable ? "Optional · uses configured local Ollama service" : "AI analysis is unavailable here. Rule-based results only."}</small>
              </span>
            </label>
            <label className="dashboard-toggle" htmlFor="dashboard-sample">
              <input type="checkbox" id="dashboard-sample" checked={settings.sample_mode} onChange={(event) => updateSetting("sample_mode", event.target.checked)} />
              <span><strong>Sample mode</strong><small>Show bundled example content</small></span>
            </label>
          </div>
        </section>

        {message && <p className="dashboard-message" id="dashboard-message" role="alert">{message}</p>}

        {settings.sample_mode ? (
          <>
            <SampleResultCard animate={false} />
            <p className="dashboard-notice" role="status">Sample output only. No repository was fetched or analyzed.</p>
          </>
        ) : repository && (
          <section className="dashboard-pr-section" aria-labelledby="dashboard-pr-list-title">
            <div className="dashboard-pr-list-heading">
              <div>
                <span className="landing-section-kicker">{repository.metadata.full_name}</span>
                <h2 id="dashboard-pr-list-title">Open pull requests</h2>
              </div>
              <span>{repository.pulls.length} returned</span>
            </div>
            {repository.sample_mode && <p className="dashboard-sample-banner">SAMPLE DATA, not a live analysis</p>}
            <div className="dashboard-pr-controls">
              <p className="dashboard-pr-instruction">Select a pull request to analyze it.</p>
              <label htmlFor="dashboard-category-filter">Filter by category</label>
              <select id="dashboard-category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All pull requests</option>
                <option value="Likely legitimate">Likely legitimate</option>
                <option value="Needs review">Needs review</option>
                <option value="Potentially suspicious">Potentially suspicious</option>
              </select>
            </div>
            <table className="dashboard-pr-table">
              <thead>
                <tr><th scope="col">Pull request</th><th scope="col">Author</th><th scope="col">Category</th><th scope="col">Findings</th><th scope="col">Link</th></tr>
              </thead>
              <tbody>
                {repository.pulls.filter((pull) => categoryFilter === "all" || analyses[pull.number]?.result.category === categoryFilter).map((pull) => {
                  const detail = analyses[pull.number]
                  const rowError = rowErrors[pull.number]
                  const count = detail ? visibleFindingCount(detail.result, repository.pulls) : null
                  const category = detail ? categoryForAnalysis(detail) : null
                  return (
                    <tr
                      key={pull.number}
                      tabIndex={0}
                      aria-selected={selectedPullNumber === pull.number}
                      className={selectedPullNumber === pull.number ? "selected" : undefined}
                      onClick={() => selectPull(pull)}
                      onKeyDown={(event) => selectPullByKey(event, pull)}
                    >
                      <td data-label="Pull request">
                        <span className="dashboard-pr-title">#{pull.number} {pull.title}</span>
                        {pull.draft && <span className="dashboard-draft-badge">Draft</span>}
                        {rowError && <span className="dashboard-row-error" role="alert">Analysis failed: {rowError}</span>}
                      </td>
                      <td data-label="Author">{pull.user ? `@${pull.user}` : "Unavailable"}</td>
                      <td data-label="Category">
                        {analyzingNumber === pull.number ? (
                          <span className="dashboard-pr-category pending">Analyzing…</span>
                        ) : queuedNumbers.includes(pull.number) ? (
                          <span className="dashboard-pr-category pending">Queued…</span>
                        ) : detail ? (
                          <span className={`dashboard-pr-category ${category?.tone}`}>
                            {category?.label}
                            {category?.reason && <small>{category.reason}</small>}
                          </span>
                        ) : <span className="dashboard-pr-category unanalyzed">Not analyzed</span>}
                      </td>
                      <td data-label="Findings">
                        {count === null ? "—" : count}
                      </td>
                      <td data-label="Link">
                        <div className="dashboard-pr-actions">
                          <button
                            type="button"
                            className="dashboard-row-analyze"
                            onClick={(event) => { event.stopPropagation(); selectPull(pull) }}
                          >
                            {analyzingNumber === pull.number ? "Analyzing…" : queuedNumbers.includes(pull.number) ? "Queued…" : rowError ? "Retry" : detail ? "Analyzed" : "Analyze"}
                          </button>
                          <a className="dashboard-pr-link" href={pull.html_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                            View PR ↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {repository.pulls.length === 0 && <p className="dashboard-no-findings">No open pull requests were returned.</p>}
          </section>
        )}

        {selectedPullNumber !== null && !settings.sample_mode && (
          analyzingNumber === selectedPullNumber ? (
            <p className="dashboard-analysis-loading" role="status">Analyzing PR #{selectedPullNumber}…</p>
          ) : selectedAnalysis && repository ? (
            <ResultsPanel analysis={selectedAnalysis} pulls={repository.pulls} />
          ) : null
        )}
      </section>

      <footer className="dashboard-footer">
        <Brand />
        <nav className="landing-footer-links" aria-label={sectionNavNames.footer}>
          {footerLinks.map((item) => <a href={item.href} key={item.href} target={"external" in item && item.external ? "_blank" : undefined} rel={"external" in item && item.external ? "noreferrer" : undefined}>{item.label}</a>)}
        </nav>
      </footer>
    </main>
  )
}
