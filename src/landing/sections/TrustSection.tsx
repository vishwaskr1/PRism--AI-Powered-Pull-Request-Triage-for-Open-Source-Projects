import { trustCopy } from "../content"
import { SectionHeading } from "./SectionHeading"

function EvidenceFlowDiagram() {
  return (
    <>
    <svg className="evidence-flow-svg flow-desktop" viewBox="0 0 620 188" role="img" aria-labelledby="evidence-flow-title evidence-flow-description">
      <title id="evidence-flow-title">Evidence verification flow</title>
      <desc id="evidence-flow-description">An AI claim is checked against retrieved data. Supported claims are shown with evidence; unsupported claims are dropped.</desc>
      <defs>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#8f81e9" /></marker>
      </defs>
      <rect className="flow-node" x="14" y="67" width="132" height="48" rx="9" />
      <text x="80" y="96" textAnchor="middle">{trustCopy.diagram.claim}</text>
      <rect className="flow-node verify" x="218" y="58" width="188" height="66" rx="10" />
      <text x="312" y="86" textAnchor="middle">{trustCopy.diagram.verifyFirst}</text>
      <text x="312" y="104" textAnchor="middle">{trustCopy.diagram.verifySecond}</text>
      <rect className="flow-node accepted" x="472" y="24" width="134" height="48" rx="9" />
      <text x="539" y="53" textAnchor="middle">{trustCopy.diagram.shown}</text>
      <rect className="flow-node dropped" x="472" y="116" width="134" height="48" rx="9" />
      <text x="539" y="145" textAnchor="middle">{trustCopy.diagram.dropped}</text>
      <path className="flow-path flow-main" d="M146 91H212" markerEnd="url(#flow-arrow)" />
      <path className="flow-path flow-accepted" d="M406 76C435 76 438 48 466 48" markerEnd="url(#flow-arrow)" />
      <path className="flow-path flow-dropped" d="M406 106C435 106 438 140 466 140" markerEnd="url(#flow-arrow)" />
    </svg>
    <svg className="evidence-flow-svg flow-mobile" viewBox="0 0 320 320" role="img" aria-labelledby="evidence-flow-mobile-title evidence-flow-mobile-description">
      <title id="evidence-flow-mobile-title">Evidence verification flow</title>
      <desc id="evidence-flow-mobile-description">An AI claim is checked against retrieved data, then shown with evidence or dropped.</desc>
      <defs>
        <marker id="flow-arrow-mobile" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10Z" fill="#8f81e9" /></marker>
      </defs>
      <rect className="flow-node" x="60" y="8" width="200" height="46" rx="9" />
      <text x="160" y="36" textAnchor="middle">{trustCopy.diagram.claim}</text>
      <rect className="flow-node verify" x="38" y="102" width="244" height="64" rx="10" />
      <text x="160" y="128" textAnchor="middle">{trustCopy.diagram.verifyFirst}</text>
      <text x="160" y="147" textAnchor="middle">{trustCopy.diagram.verifySecond}</text>
      <rect className="flow-node accepted" x="6" y="240" width="146" height="62" rx="9" />
      <text x="79" y="265" textAnchor="middle">{trustCopy.diagram.shownMobileFirst}</text>
      <text x="79" y="282" textAnchor="middle">{trustCopy.diagram.shownMobileSecond}</text>
      <rect className="flow-node dropped" x="168" y="240" width="146" height="62" rx="9" />
      <text x="241" y="276" textAnchor="middle">{trustCopy.diagram.dropped}</text>
      <path className="flow-path flow-main" d="M160 54V96" markerEnd="url(#flow-arrow-mobile)" />
      <path className="flow-path flow-accepted" d="M160 166C160 202 79 197 79 234" markerEnd="url(#flow-arrow-mobile)" />
      <path className="flow-path flow-dropped" d="M160 166C160 202 241 197 241 234" markerEnd="url(#flow-arrow-mobile)" />
    </svg>
    </>
  )
}

export function TrustSection() {
  return (
    <section className="landing-section landing-trust" id="evidence-trust" aria-labelledby="trust-title">
      <SectionHeading id="trust-title" eyebrow={trustCopy.eyebrow} title={trustCopy.title} />
      <div className="trust-card-grid">
        {trustCopy.cards.map((card, index) => (
          <article className="trust-card" key={card.title}>
            <span className="trust-card-index">0{index + 1}</span>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
      <div className="trust-diagram-wrap">
        <div className="trust-diagram-copy"><span className="landing-section-kicker">A CHECK BEFORE A CLAIM</span><p>Retrieved sources decide what can be shown.</p></div>
        <EvidenceFlowDiagram />
      </div>
    </section>
  )
}
