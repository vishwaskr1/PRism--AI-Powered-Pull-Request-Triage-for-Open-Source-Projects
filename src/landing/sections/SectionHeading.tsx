type SectionHeadingProps = {
  eyebrow: string
  title: string
  accent?: string
  description?: string
  id?: string
}

export function SectionHeading({ eyebrow, title, accent, description, id }: SectionHeadingProps) {
  return (
    <div className="landing-section-heading">
      <span className="landing-section-kicker">{eyebrow}</span>
      <h2 id={id}>
        {title} {accent && <em>{accent}</em>}
      </h2>
      {description && <p>{description}</p>}
    </div>
  )
}
