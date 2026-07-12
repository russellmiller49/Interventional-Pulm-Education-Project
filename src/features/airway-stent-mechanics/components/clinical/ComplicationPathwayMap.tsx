import { ArrowDown } from 'lucide-react'

import type { ComplicationPathway } from '../../engine/learningLabTypes'

const domainLabels = {
  mechanical: 'Fit, contact, and motion',
  'infectious-secretory': 'Secretions, colonization, and infection',
  'biologic-time': 'Wound healing, host biology, and time',
} as const

export function ComplicationPathwayMap({ pathway }: { pathway: ComplicationPathway }) {
  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby={`${pathway.id}-pathway-title`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-200">
        Plausible multifactorial pathway
      </p>
      <h3 id={`${pathway.id}-pathway-title`} className="mt-2 text-2xl font-bold tracking-tight">
        {pathway.label}: connect contributors without claiming causation
      </h3>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {pathway.contributorDomains.map((domain) => (
          <article key={domain} className="rounded-2xl border bg-background p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-200">
              {domainLabels[domain]}
            </p>
            <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
              {pathway.plausibleContributors
                .filter(
                  (_, index) =>
                    index % pathway.contributorDomains.length ===
                    pathway.contributorDomains.indexOf(domain),
                )
                .map((contributor) => (
                  <li key={contributor}>• {contributor}</li>
                ))}
            </ul>
          </article>
        ))}
      </div>

      <ArrowDown className="mx-auto my-3 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-4 text-center">
        <p className="font-semibold">Mucosal injury and inflammatory signaling</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Foreign-body and wound-healing responses may then contribute to tissue that re-obstructs
          the airway.
        </p>
      </div>

      <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-muted-foreground">
        This is a plausible teaching model, not a validated patient-specific equation. It does not
        calculate tissue pressure, assign a complication probability, or prove which contributor
        caused an individual finding.
      </p>
    </section>
  )
}
