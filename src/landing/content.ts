export const REPOSITORY_URL = "https://github.com/vishwaskr1/PRism--AI-Powered-Pull-Request-Triage-for-Open-Source-Projects"
export const SPECIFICATION_URL = `${REPOSITORY_URL}/blob/main/PRism_PRD.md`
export const DASHBOARD_PATH = "/dashboard"
export const LANDING_PATH = "/"
export const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL?.trim() || DASHBOARD_PATH

export function dashboardHref(repoUrl?: string) {
  if (!repoUrl) return DASHBOARD_URL
  return `${DASHBOARD_URL}${DASHBOARD_URL.includes("?") ? "&" : "?"}repo=${encodeURIComponent(repoUrl)}`
}

export const landingActions = {
  openDashboard: "Open the dashboard",
  trySample: "Try sample data",
} as const

export const navigationCopy = [
  { label: "Try it", href: "#try-it" },
  { label: "Categories", href: "#triage-categories" },
  { label: "Trust", href: "#evidence-trust" },
  { label: "Open source", href: "#open-local" },
  { label: "AI fallback", href: "#honest-failure" },
  { label: "How it works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
  { label: "Principles", href: "#principles" },
] as const

export const heroContent = {
  eyebrow: "OPEN-SOURCE REVIEW, WITH CONTEXT",
  headlineFirst: "Make every PR",
  headlineSecond: "easier to",
  headlineAccent: "understand.",
  description:
    "PRism brings repository guidance, changed-file context, and traceable evidence into one calm review workspace.",
  primaryAction: landingActions.openDashboard,
  secondaryAction: landingActions.trySample,
  assurance: ["Human-led triage", "Read-only GitHub access", "Evidence attached"],
} as const

export const principlesContent = [
  {
    number: "01",
    title: "Start with the project’s rules",
    body: "Bring contribution guidance into the review so each pull request is read in its repository context.",
  },
  {
    number: "02",
    title: "Keep the source close",
    body: "Review signals stay connected to retrieved files, PR details, and available patch context.",
  },
  {
    number: "03",
    title: "Keep people in control",
    body: "Uncertainty stays visible. PRism never closes, merges, or labels a contributor’s work.",
  },
] as const

export const workflowContent = {
  eyebrow: "A CLEARER REVIEW FLOW",
  title: "From a pull request to",
  accent: "clearer context.",
  description: "PRism gathers the useful context around a change so maintainers can spend their attention where it matters.",
  steps: [
    { number: "01", title: "Choose a pull request", body: "Start with a repository and pull request to bring its guidance and changed-file context into view." },
    { number: "02", title: "Review the signals", body: "See contribution guidance and related changes that may deserve a closer look." },
    { number: "03", title: "Make the call", body: "Use the source and available context to decide what needs attention." },
  ],
} as const

export const faqHeading = {
  eyebrow: "A FEW GOOD QUESTIONS",
  title: "Designed to assist,",
  accent: "never take over.",
} as const

export const closingContent = {
  eyebrow: "EVIDENCE FIRST. PEOPLE IN CONTROL.",
  title: "Bring clearer context to your next review.",
  description: "Give every signal a source and keep the final call with the maintainer.",
  action: landingActions.openDashboard,
} as const

export const footerLinks = [
  { label: "GitHub", href: REPOSITORY_URL, external: true },
  { label: "Specification", href: SPECIFICATION_URL, external: true },
  { label: "License (MIT)", href: `${REPOSITORY_URL}/blob/main/LICENSE`, external: true },
  { label: "Contributing", href: `${REPOSITORY_URL}/blob/main/CONTRIBUTING.md`, external: true },
] as const

export const trialCopy = {
  eyebrow: "TRY IT NOW",
  title: "See it on a sample pull request.",
  placeholder: "https://github.com/owner/repo",
  invalidUrl:
    "That doesn't look like a GitHub repository URL. Use the form https://github.com/owner/repo.",
  sampleBanner: "SAMPLE DATA, not a live analysis",
  useSample: "Use sample data",
  analyze: "Analyze",
  inputLabel: "GitHub repository URL",
  noPulls: "No open pull requests were returned for this repository.",
  choosePull: "Choose an open pull request",
  runAnalysis: "Run live analysis",
  uncertainty: "Uncertainty / limitations",
  noFindings: "No findings were returned for the available checks.",
  noExcerpt: "The API returned no source excerpt for this finding.",
  genericLimitation: "Available context may be incomplete; maintainers should review the source and diff.",
  sampleLink: "Open sample pull request ↗",
  liveLink: "Open pull request ↗",
  dashboardHint: "Live analysis runs in the dashboard.",
  working: "Working…",
  analyzing: "Analyzing…",
} as const

export const sampleAnalysis = {
  repository: "acme/api-platform",
  pullNumber: 284,
  title: "Add request retry policy",
  url: "https://github.com/acme/api-platform/pull/284",
  category: "Needs review",
  explanation:
    "The sample change adds retry behavior, and the sample project guidance asks for tests when behavior changes. Review whether the included test path covers the retry limits before approving.",
  findings: [
    {
      source: "Rule",
      title: "Test guidance may need a check",
      explanation:
        "The contribution guidance calls for a test when behavior changes.",
    },
    {
      source: "AI",
      title: "Retry boundaries may deserve review",
      explanation:
        "A maintainer could confirm the attempt cap and delay are covered at their boundaries.",
    },
  ],
  evidence: {
    sourceType: "Guideline excerpt",
    location: "CONTRIBUTING.md · line 42 (sample)",
    excerpt: "Changes to request behavior should include a test when practical.",
  },
  limitations: [
    "This is bundled example content, not a fetched repository or completed analysis.",
    "The example does not establish whether the change is correct or safe.",
  ],
} as const

export const triageCategories = [
  {
    name: "Likely legitimate",
    tone: "green",
    meaning: "Available context is consistent with an ordinary contribution.",
    when: "When retrieved guidance and change context raise no notable signal.",
    evidence: "Example: title and changed paths share the described feature area.",
  },
  {
    name: "Needs review",
    tone: "amber",
    meaning: "A signal needs a maintainer to check the surrounding context.",
    when: "When a guidance check, missing context, or possible overlap needs judgment.",
    evidence: "Example: CONTRIBUTING.md asks for tests; test coverage is not verified.",
  },
  {
    name: "Potentially suspicious",
    tone: "red-violet",
    meaning: "A specific, evidence-backed concern warrants careful inspection.",
    when: "Only when concrete retrieved evidence supports a concern—not from style alone.",
    evidence: "Example: two independent, medium-severity findings with verified evidence.",
  },
] as const

export const triageHeading = {
  eyebrow: "THREE CATEGORIES",
  title: "Cautious labels, never verdicts.",
  caution: "A short or missing description alone never makes a pull request suspicious.",
  note: "Labels are recommendations, not judgments about contributor intent or code safety.",
  when: "When it applies",
} as const

export const trustCopy = {
  eyebrow: "TRUSTWORTHY BY DESIGN",
  title: "Every claim has a source.",
  cards: [
    {
      title: "Evidence is checked",
      body: "Cited excerpts must exist in retrieved diff or guideline text.",
    },
    {
      title: "Fabrications are dropped",
      body: "Invented paths or quotes are discarded, with a limitation shown when context is missing.",
    },
    {
      title: "PR text is untrusted",
      body: "Text inside a pull request is treated as data; it cannot change the analysis rules.",
    },
    {
      title: "Rules and AI stay distinct",
      body: "Findings carry a source label so maintainers can see where each came from.",
    },
  ],
  diagram: {
    claim: "AI claim",
    verifyFirst: "Verify against",
    verifySecond: "retrieved data",
    shown: "Shown with evidence",
    shownMobileFirst: "Shown with",
    shownMobileSecond: "evidence",
    dropped: "Dropped",
  },
} as const

export const localCopy = {
  eyebrow: "OPEN AND LOCAL",
  title: "Optional hosted AI, with a heuristic fallback.",
  points: [
    "Groq-hosted gpt-oss-20b as the primary model",
    "Gemma 4 is an optional fallback provider",
    "Heuristic results work without provider keys",
    "MIT licensed",
  ],
} as const

export const featureStatusConfig = [
  { name: "Repository analysis in the dashboard", status: "Implemented" },
  { name: "Evidence-linked checks in the dashboard", status: "Implemented" },
  { name: "Sample mode with a clear banner", status: "Implemented" },
  { name: "Optional hosted PR quality review", status: "Partial", detail: "Groq and Gemini provider integration is available when server keys are configured; otherwise results use heuristic signals." },
  { name: "Evaluation set and published results", status: "Planned", detail: "No labeled evaluation has been run or published." },
] as const

export const failureCopy = {
  eyebrow: "HONEST BY DEFAULT",
  title: "When AI isn't available, we say so.",
  unavailable: "AI analysis unavailable. Rule-based results only.",
  caption: "Failed AI analysis is never presented as completed.",
  ruleFinding: "Contribution guidance asks for a test when practical.",
  evidence: "CONTRIBUTING.md · line 42 (illustrative)",
  evidenceExcerpt: "Changes to behavior should include a test when practical.",
} as const

export const faqCopy = {
  analysisLocationAnswer: "Repository retrieval and PR quality analysis run in the PRism backend. Optional model requests are sent server-side to Groq, with Gemini as a fallback when configured.",
} as const

export const faqItems = [
  {
    question: "Does PRism make review decisions for me?",
    answer:
      "No. PRism surfaces context and evidence. Maintainers decide what to do; it does not merge, close, or label pull requests.",
  },
  {
    question: "Does it change my repository?",
    answer:
      "PRism uses read-only GitHub access for repository and pull request context. It does not push commits or change repository settings.",
  },
  {
    question: "Is the workspace shown above a real pull request?",
    answer: "No. The preview is illustrative and contains no live repository data.",
  },
  {
    question: "Is AI required?",
    answer:
      "No. Heuristic review works without AI. Optional hosted models can add a PR quality review when configured.",
  },
  {
    question: "Does PRism work with private repositories?",
    answer: "Not in the MVP; public repositories only.",
  },
  {
    question: "What about GitHub rate limits?",
    answer:
      "Unauthenticated API limits apply. An optional read-only GitHub token can raise those limits.",
  },
  {
    question: "How accurate is it?",
    answer:
      "Accuracy has not been measured yet. We will publish results from a labelled evaluation set before making accuracy claims.",
  },
  {
    question: "Which AI models work?",
    answer: "PRism uses Groq's openai/gpt-oss-20b model first, then Gemma 4 through Gemini only if Groq fails and a Gemini key is configured. Without either key it returns heuristic-only results.",
  },
  {
    question: "Where does analysis run?",
    answer: faqCopy.analysisLocationAnswer,
  },
] as const

export const localStatusContent = {
  statusNote: "Hosted AI is optional and disabled by default. Evaluation results have not been measured or published.",
  featureStatusLabel: "FEATURE STATUS",
  statusChip: "MVP in development",
} as const

export const failureExampleContent = {
  illustrative: "Illustrative example",
  pullRequest: "PR #284 · sample",
} as const

export const sectionNavNames = {
  home: "PRism home",
  main: "Main navigation",
  footer: "Project links",
} as const
