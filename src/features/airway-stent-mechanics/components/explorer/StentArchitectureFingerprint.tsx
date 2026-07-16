import { Braces, CircleDot, Layers3, RefreshCw } from 'lucide-react'

import type { StentExplorerArchitectureOption } from '../../explorer/types'

const expansionLabels: Record<StentExplorerArchitectureOption['expansionMechanism'], string> = {
  'molded-passive': 'Molded / manually deployed',
  'self-expanding-superelastic': 'Self-expanding / superelastic',
  'balloon-expanded': 'Balloon-expanded / plastically set',
  'bifurcated-schematic': 'Bifurcated architecture',
}

const coverageLabels: Record<StentExplorerArchitectureOption['coverage'], string> = {
  'solid-wall': 'Integral solid wall',
  uncovered: 'Uncovered cells',
  'fully-covered': 'Fully covered scaffold',
  'partially-covered': 'Covered body with exposed end cells',
}

export function StentArchitectureFingerprint({
  architecture,
  revealed,
}: {
  architecture: StentExplorerArchitectureOption
  revealed: boolean
}) {
  const facts = [
    { icon: Braces, label: 'Topology', value: architecture.topology },
    { icon: CircleDot, label: 'Material', value: architecture.material },
    {
      icon: RefreshCw,
      label: 'Expansion',
      value: expansionLabels[architecture.expansionMechanism],
    },
    { icon: Layers3, label: 'Coverage', value: coverageLabels[architecture.coverage] },
  ]

  return (
    <section className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
        Architecture fingerprint
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" aria-hidden />
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-0.5 text-xs leading-5">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      {revealed ? (
        <div className="mt-3 rounded-lg border bg-background/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-200">
            Qualitative load path
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{architecture.loadPath}</p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          Commit or skip the optional prediction to reveal how this construction carries the modeled
          displacement.
        </p>
      )}
    </section>
  )
}
