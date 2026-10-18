import { failureCopy, failureExampleContent } from "../content"
import { SectionHeading } from "./SectionHeading"

export function FailureSection() {
  return (
    <section className="landing-section landing-failure" id="honest-failure" aria-labelledby="failure-title">
      <div className="failure-intro">
        <SectionHeading id="failure-title" eyebrow={failureCopy.eyebrow} title={failureCopy.title} />
        <p>{failureCopy.caption}</p>
      </div>
      <article className="failure-mockup">
        <div className="failure-mockup-top"><span>{failureExampleContent.illustrative}</span><span>{failureExampleContent.pullRequest}</span></div>
        <div className="failure-ai-panel" aria-live="polite">
          <span className="failure-ai-icon" aria-hidden="true">✳</span>
          <span className="failure-ai-unavailable">{failureCopy.unavailable}</span>
        </div>
        <div className="failure-rule-panel">
          <div className="failure-rule-title"><span className="source-badge rule">Rule</span><strong>{failureCopy.ruleFinding}</strong></div>
          <blockquote>{failureCopy.evidenceExcerpt}</blockquote>
          <p>{failureCopy.evidence}</p>
        </div>
      </article>
    </section>
  )
}
