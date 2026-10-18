import { faqHeading, faqItems } from "../content"
import { SectionHeading } from "./SectionHeading"

export function FaqSection() {
  return (
    <section className="landing-section landing-faq" id="faq" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" eyebrow={faqHeading.eyebrow} title={faqHeading.title} accent={faqHeading.accent} />
      <div className="landing-faq-list">
        {faqItems.map((item) => (
          <details key={item.question}>
            <summary>{item.question}<span aria-hidden="true">+</span></summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
