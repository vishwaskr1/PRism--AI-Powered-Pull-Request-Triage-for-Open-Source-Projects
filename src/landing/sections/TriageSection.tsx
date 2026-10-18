import { triageCategories, triageHeading } from "../content"
import { SectionHeading } from "./SectionHeading"

export function TriageSection() {
  return (
    <section className="landing-section landing-triage" id="triage-categories" aria-labelledby="triage-title">
      <SectionHeading id="triage-title" eyebrow={triageHeading.eyebrow} title={triageHeading.title} />
      <div className="triage-grid">
        {triageCategories.map((category) => (
          <article className={`triage-card ${category.tone}`} key={category.name}>
            <span className={`triage-badge ${category.tone}`}>{category.name}</span>
            <p className="triage-meaning">{category.meaning}</p>
            <p className="triage-when"><strong>{triageHeading.when}</strong>{category.when}</p>
            <blockquote>{category.evidence}</blockquote>
          </article>
        ))}
      </div>
      <p className="triage-example-note">Illustrative examples of review categories; these are not additional detection rules.</p>
      <aside className="triage-caution">
        <strong>{triageHeading.caution}</strong>
        <p>{triageHeading.note}</p>
      </aside>
    </section>
  )
}
