import { featureStatusConfig, localCopy, localStatusContent, REPOSITORY_URL, SPECIFICATION_URL } from "../content"
import { SectionHeading } from "./SectionHeading"

export function LocalSection() {
  return (
    <section className="landing-section landing-local" id="open-local" aria-labelledby="local-title">
      <div className="local-copy">
        <SectionHeading id="local-title" eyebrow={localCopy.eyebrow} title={localCopy.title} />
        <ul className="local-points">
          {localCopy.points.map((point) => <li key={point}><span aria-hidden="true">✓</span>{point}</li>)}
        </ul>
        <div className="local-links">
          <a className="landing-primary" href={REPOSITORY_URL} target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">↗</span></a>
          <a className="landing-secondary" href={SPECIFICATION_URL}>Read the specification <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <aside className="local-status-card">
        <div className="local-status-heading"><span className="status-chip">{localStatusContent.statusChip}</span><span>{localStatusContent.featureStatusLabel}</span></div>
        <ul>{featureStatusConfig.map((feature) => <li key={feature.name}><span>{feature.name}{"detail" in feature && <small className="feature-status-detail">{feature.detail}</small>}</span><b className={`feature-status ${feature.status.toLowerCase()}`}>{feature.status}</b></li>)}</ul>
        <p>{localStatusContent.statusNote}</p>
      </aside>
    </section>
  )
}
