'use client'

import { useMemo, useState } from 'react'

import { architectureRegistry, getArchitectureProfile } from '../../content/architectureRegistry'
import { architectureDecisionAxes } from '../../content/clinicalDecisionFramework'
import type { StentArchitectureId } from '../../engine/learningLabTypes'

interface ArchitectureComparisonProps {
  architectureIds?: readonly StentArchitectureId[]
}

export function ArchitectureComparison({ architectureIds }: ArchitectureComparisonProps) {
  const available = useMemo(
    () =>
      architectureIds?.length
        ? architectureRegistry.filter((profile) => architectureIds.includes(profile.id))
        : architectureRegistry,
    [architectureIds],
  )
  const [leadingId, setLeadingId] = useState<StentArchitectureId>(
    available[0]?.id ?? 'studded-silicone',
  )
  const [alternativeId, setAlternativeId] = useState<StentArchitectureId>(
    available[1]?.id ?? available[0]?.id ?? 'studded-silicone',
  )
  const leading = getArchitectureProfile(leadingId)
  const alternative = getArchitectureProfile(alternativeId)

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby="architecture-comparison-title"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
        Architecture, not brand
      </p>
      <h3 id="architecture-comparison-title" className="mt-2 text-2xl font-bold tracking-tight">
        Compare a leading family with a reasonable alternative
      </h3>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
        Begin with the clinical job, anatomy, time horizon, and exit strategy. These families are
        teaching models, not a ranking or recommendation engine.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ArchitectureSelect
          id="leading-architecture"
          label="Leading architecture family"
          profiles={available}
          value={leadingId}
          onChange={setLeadingId}
        />
        <ArchitectureSelect
          id="alternative-architecture"
          label="Reasonable alternative"
          profiles={available}
          value={alternativeId}
          onChange={setAlternativeId}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ArchitectureSummary eyebrow="Leading family" profile={leading} />
        <ArchitectureSummary eyebrow="Alternative" profile={alternative} />
      </div>

      <details className="mt-5 rounded-2xl border bg-muted/15 p-4">
        <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
          Eight decision axes to defend the comparison
        </summary>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {architectureDecisionAxes.map((axis) => (
            <div key={axis.id} className="rounded-xl border bg-background p-3">
              <dt className="text-sm font-semibold">{axis.label}</dt>
              <dd className="mt-1 text-xs leading-5 text-muted-foreground">{axis.question}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}

function ArchitectureSelect({
  id,
  label,
  onChange,
  profiles,
  value,
}: {
  id: string
  label: string
  onChange: (id: StentArchitectureId) => void
  profiles: typeof architectureRegistry
  value: StentArchitectureId
}) {
  return (
    <label htmlFor={id} className="text-sm font-semibold">
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as StentArchitectureId)}
        className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.label}
            {profile.clinicalConsiderations.teachingOnly ? ' · teaching comparison only' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

function ArchitectureSummary({
  eyebrow,
  profile,
}: {
  eyebrow: string
  profile: ReturnType<typeof getArchitectureProfile>
}) {
  return (
    <article className="rounded-2xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
        {eyebrow}
      </p>
      <h4 className="mt-2 text-lg font-bold">{profile.label}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{profile.family}</p>
      {profile.clinicalConsiderations.teachingOnly ? (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-muted-foreground">
          Teaching comparison only. This generic family is included to explain architecture and
          tissue-interface tradeoffs, not as a case recommendation.
        </p>
      ) : null}

      <h5 className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
        Potential role
      </h5>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
        {profile.clinicalConsiderations.commonRoles.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>

      <h5 className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
        Important liabilities
      </h5>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
        {profile.tradeoffs.slice(0, 2).map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>

      <h5 className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
        Fit and exit questions
      </h5>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
        {[
          ...profile.clinicalConsiderations.fitConsiderations.slice(0, 1),
          ...profile.clinicalConsiderations.removalConsiderations.slice(0, 1),
        ].map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </article>
  )
}
