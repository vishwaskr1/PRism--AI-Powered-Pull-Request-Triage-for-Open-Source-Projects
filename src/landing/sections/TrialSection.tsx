import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "../../router"
import { DashboardLink } from "../DashboardLink"
import { LANDING_MOTION } from "../motionConfig"
import { DASHBOARD_URL, dashboardHref, landingActions, sampleAnalysis, trialCopy, triageCategories } from "../content"
import { SectionHeading } from "./SectionHeading"

export function validRepositoryUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.port || url.username || url.password || url.search || url.hash) return null
    const path = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname
    if (path.includes("//")) return null
    const segments = path.split("/").filter(Boolean)
    if (segments.length !== 2) return null
    const [owner, rawRepo] = segments
    const repo = rawRepo.replace(/\.git$/i, "")
    if (!/^[a-z\d-]+$/i.test(owner) || !/^[a-z\d._-]+$/i.test(repo) || repo === "." || repo === "..") return null
    return `https://github.com/${owner}/${repo}`
  } catch {
    return null
  }
}

export function SampleResultCard({ animate = true }: { animate?: boolean }) {
  useEffect(() => {
    if (!animate || !LANDING_MOTION.gsap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let disposed = false
    let revert: (() => void) | undefined
    void import("gsap").then(({ gsap }) => {
      if (disposed) return
      const root = document.querySelector<HTMLElement>(".trial-result")
      if (!root) return
      const context = gsap.context(() => {
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } })
        timeline.from(".trial-result-banner", { autoAlpha: 0, y: -5, duration: 0.28 })
          .from(".trial-result-body", { autoAlpha: 0, y: 16, duration: 0.42 }, "-=0.02")
          .from(".trial-finding", { autoAlpha: 0, y: 10, duration: 0.32, stagger: 0.12 }, "-=0.08")
          .from(".trial-evidence", { clipPath: "inset(0 100% 0 0)", duration: 0.46 }, "-=0.02")
      }, root)
      revert = () => context.revert()
    }).catch(() => {})
    return () => { disposed = true; revert?.() }
  }, [animate])

  return (
    <article className="trial-result" aria-live="polite">
      <div className="trial-result-banner">{trialCopy.sampleBanner}</div>
      <div className="trial-result-body">
        <div className="trial-result-head">
          <div>
            <span className="trial-repo-name">{sampleAnalysis.repository}</span>
            <h3>PR #{sampleAnalysis.pullNumber} · {sampleAnalysis.title}</h3>
          </div>
          <span className={`triage-badge ${triageCategories[1].tone}`}>{sampleAnalysis.category}</span>
        </div>
        <p className="trial-result-summary">{sampleAnalysis.explanation}</p>
        <div className="trial-findings">
          {sampleAnalysis.findings.map((finding, index) => (
            <div className="trial-finding" key={`${finding.source}-${index}`}>
              <div className="trial-finding-title"><span className={`source-badge ${finding.source.toLowerCase()}`}>{finding.source}</span><strong>{finding.title}</strong></div>
              <p>{finding.explanation}</p>
            </div>
          ))}
        </div>
        <div className="trial-evidence">
          <div className="trial-evidence-heading"><span>{sampleAnalysis.evidence.sourceType}</span><small>{sampleAnalysis.evidence.location}</small></div>
          <blockquote>{sampleAnalysis.evidence.excerpt}</blockquote>
        </div>
        <div className="trial-limitations"><strong>{trialCopy.uncertainty}</strong><ul>{sampleAnalysis.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
        <a className="trial-pr-link" href={sampleAnalysis.url} target="_blank" rel="noreferrer">{trialCopy.sampleLink}</a>
      </div>
    </article>
  )
}

export function TrialSection() {
  const navigate = useNavigate()
  const [url, setUrl] = useState("")
  const [message, setMessage] = useState("")
  const [showSample, setShowSample] = useState(false)

  const analyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage("")
    setShowSample(false)
    const normalizedUrl = validRepositoryUrl(url)
    if (!normalizedUrl) { setMessage(trialCopy.invalidUrl); return }
    const href = dashboardHref(normalizedUrl)
    if (/^https?:\/\//i.test(DASHBOARD_URL)) window.location.assign(href)
    else navigate(href)
  }

  const useSample = () => {
    setUrl("")
    setMessage("")
    setShowSample(true)
  }

  return (
    <section className="landing-section landing-trial" id="try-it" aria-labelledby="trial-title">
      <SectionHeading id="trial-title" eyebrow={trialCopy.eyebrow} title={trialCopy.title} />
      <form className="trial-form" onSubmit={analyze} noValidate autoComplete="off">
        <label className="sr-only" htmlFor="trial-repo-url">GitHub repository URL</label>
        <input id="trial-repo-url" name="repository-url" type="url" inputMode="url" autoComplete="off" placeholder={trialCopy.placeholder} value={url} onChange={(event) => setUrl(event.target.value)} aria-describedby={message ? "trial-message" : undefined} />
        <div className="trial-actions">
          <button className="landing-primary" type="submit">{trialCopy.analyze}</button>
          <button className="landing-primary trial-sample-button" type="button" onClick={useSample}>{trialCopy.useSample}</button>
        </div>
      </form>
      <p className="trial-dashboard-hint">{trialCopy.dashboardHint} <DashboardLink>{landingActions.openDashboard}</DashboardLink></p>
      {message && <div className="trial-message" id="trial-message" role="alert">{message}</div>}
      {showSample && <SampleResultCard />}
    </section>
  )
}
