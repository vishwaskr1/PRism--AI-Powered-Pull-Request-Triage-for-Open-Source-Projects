import { Suspense, lazy, useEffect, useRef, useState } from "react"
import "./landing.css"
import "./landing/landing-motion.css"
import { LANDING_MOTION } from "./landing/motionConfig"
import { useLandingMotion } from "./landing/useLandingMotion"
import { TrialSection } from "./landing/sections/TrialSection"
import { TriageSection } from "./landing/sections/TriageSection"
import { TrustSection } from "./landing/sections/TrustSection"
import { LocalSection } from "./landing/sections/LocalSection"
import { FailureSection } from "./landing/sections/FailureSection"
import { FaqSection } from "./landing/sections/FaqSection"
import { DashboardLink } from "./landing/DashboardLink"
import { Brand } from "./landing/Brand"
import { ThemeToggle } from "./ThemeToggle"
import {
  closingContent,
  footerLinks,
  heroContent,
  navigationCopy,
  principlesContent,
  workflowContent,
  sectionNavNames,
  landingActions,
} from "./landing/content"

const PrismScene = lazy(() => import("./landing/PrismScene"))

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  )
}

export default function LandingPage() {
  useLandingMotion(true)
  const [sceneReady, setSceneReady] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Let the first text frame paint before the optional Three.js chunk is requested.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
    setSceneReady(false)
    if (
      !LANDING_MOTION.three ||
      window.matchMedia("(max-width: 767px)").matches
    )
      return
    const timer = window.setTimeout(() => setSceneReady(true), 420)
    return () => window.clearTimeout(timer)
  }, [])

  return (
      <main className="landing-page">
        <header className="landing-nav">
          <a href="#top" className="brand-link" aria-label={sectionNavNames.home}>
            <Brand />
          </a>
          <nav aria-label={sectionNavNames.main}>
            {navigationCopy.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
          </nav>
          <div className="landing-nav-actions">
            <ThemeToggle />
            <DashboardLink className="landing-nav-cta">{landingActions.openDashboard} <Arrow /></DashboardLink>
            <a className="landing-try-sample" href="#try-it">{landingActions.trySample}</a>
          </div>
        </header>

        <section className="landing-hero" id="top">
          {LANDING_MOTION.three && (
            <div
              className="prism-scene prism-scene-fallback"
              aria-hidden="true"
            >
              {sceneReady && (
                <Suspense fallback={null}>
                  <PrismScene />
                </Suspense>
              )}
            </div>
          )}
          <div className="landing-copy">
            <div className="landing-kicker">
              <span /> {heroContent.eyebrow}
            </div>
            <h1 ref={titleRef} tabIndex={-1} aria-label={`${heroContent.headlineFirst} ${heroContent.headlineSecond} ${heroContent.headlineAccent}`}>
              <span className="hero-line">{heroContent.headlineFirst}</span>
              <span className="hero-line">
                {heroContent.headlineSecond} <em className="hero-understand">{heroContent.headlineAccent}</em>
              </span>
            </h1>
            <p className="landing-description">
              {heroContent.description}
            </p>
            <div className="landing-actions">
              <DashboardLink className="landing-primary">{heroContent.primaryAction} <Arrow /></DashboardLink>
              <a className="landing-secondary" href="#try-it">{heroContent.secondaryAction}</a>
            </div>
            <div className="landing-assurance">
              <span className="assurance-icon">✓</span>
              {heroContent.assurance.map((item, index) => <span className="assurance-item" key={item}>{index > 0 && <i />}{item}</span>)}
            </div>
          </div>

          <div
            className="landing-visual"
            aria-label="Illustrative PRism review interface preview"
          >
            <div className="visual-glow" />
            <div className="preview-window">
              <div className="preview-window-bar">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>PRISM REVIEW WORKSPACE</span>
                <span className="preview-online">
                  <i /> READY
                </span>
              </div>
              <div className="preview-repo">
                <span className="preview-repo-icon">⌘</span>
                <div>
                  <strong>acme / api-platform</strong>
                  <small>Pull request #284 · Add request retry policy</small>
                </div>
                <span className="preview-status">NEEDS REVIEW</span>
              </div>
              <div className="preview-columns">
                <div className="preview-left">
                  <div className="preview-section-label">
                    REVIEW SIGNALS <span>02</span>
                  </div>
                  <div className="preview-signal selected">
                    <span className="signal-mark amber">!</span>
                    <div>
                      <strong>Guidance needs a check</strong>
                      <small>Test-related contribution note</small>
                    </div>
                    <b>›</b>
                  </div>
                  <div className="preview-signal">
                    <span className="signal-mark violet">↗</span>
                    <div>
                      <strong>Possible related change</strong>
                      <small>One shared path in another PR</small>
                    </div>
                    <b>›</b>
                  </div>
                  <div className="preview-files">
                    <div className="preview-section-label">CHANGED FILES</div>
                    <span>
                      <i className="file-dot blue" /> src/client/retry.ts
                    </span>
                    <span>
                      <i className="file-dot green" /> tests/retry.test.ts
                    </span>
                    <span>
                      <i className="file-dot orange" /> docs/retries.md
                    </span>
                  </div>
                </div>
                <div className="preview-right">
                  <div className="evidence-label">
                    <span>⌁</span> EVIDENCE · CONTRIBUTING.MD
                  </div>
                  <div className="code-snippet">
                    <span>12</span>
                    <code className="evidence-copy">
                      Changes should include
                      <br />a test when practical.
                    </code>
                  </div>
                  <div className="preview-explanation">
                    The guidance mentions tests. A test path appears in this PR,
                    but coverage has not been run.
                  </div>
                  <div className="preview-foot">
                    <span>Source linked</span>
                    <span>Human review suggested</span>
                  </div>
                </div>
              </div>
              <div className="preview-caption">
                Illustrative workspace preview · no repository data shown
              </div>
            </div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
          </div>
        </section>

        <div className="landing-rule">
          <span /> BUILT TO SUPPORT MAINTAINERS, NOT REPLACE THEM <span />
        </div>
        <section className="landing-features" id="principles">
          {principlesContent.map((principle) => <article key={principle.number}>
            <span className="feature-number">{principle.number}</span>
            <h2>{principle.title}</h2>
            <p>{principle.body}</p>
          </article>)}
        </section>

        <TrialSection />

        <section
          className="landing-how"
          id="how-it-works"
          aria-labelledby="how-title"
        >
          <div className="landing-section-heading">
            <span className="landing-section-kicker">{workflowContent.eyebrow}</span>
            <h2 id="how-title">{workflowContent.title} <em>{workflowContent.accent}</em></h2>
            <p>{workflowContent.description}</p>
          </div>
          <div className="landing-steps">
            {workflowContent.steps.map((step) => <article key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>)}
          </div>
        </section>

        <TriageSection />
        <TrustSection />
        <LocalSection />
        <FailureSection />

        <FaqSection />

        <section className="landing-close" aria-labelledby="close-title">
          <span className="landing-section-kicker">{closingContent.eyebrow}</span>
          <h2 id="close-title">{closingContent.title}</h2>
          <p>{closingContent.description}</p>
          <div className="landing-close-actions">
            <DashboardLink className="landing-primary">{closingContent.action} <Arrow /></DashboardLink>
            <a className="landing-secondary" href="#try-it">{landingActions.trySample}</a>
          </div>
        </section>

        <footer className="landing-footer">
          <Brand />
          <span>
            Thoughtful triage for the people who maintain open source.
          </span>
          <span>PRism · Evidence first, always.</span>
          <nav className="landing-footer-links" aria-label={sectionNavNames.footer}>
            {footerLinks.map((item) => <a href={item.href} key={item.href} target={"external" in item && item.external ? "_blank" : undefined} rel={"external" in item && item.external ? "noreferrer" : undefined}>{item.label}</a>)}
          </nav>
        </footer>
      </main>
    )
}
