import { hemodynamicsCompositionLine, hemodynamicsPathway } from '../content/pathwayResolver'
import {
  HemodynamicsContinueCta,
  HemodynamicsStoredPathwayAccordion,
} from './HemodynamicsPathwayAccordion'
import styles from './hemodynamics-hub.module.css'

/**
 * The Learn landing: the same door and the same map as the Overview.
 *
 * Two sentences, one call to action resolved through the resolver, the composition line derived
 * from the registry, and the pathway accordion with the group holding the next section open.
 */
export function IcuHemodynamicsLearnLandingV2() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-4 rounded-3xl border bg-card p-6 shadow-sm lg:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Learn</p>
        <h1 className="text-3xl font-bold tracking-tight">{hemodynamicsPathway.arcSentence}</h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          Every section runs on one monitored bed: a running monitor, the catheter map beneath it,
          and one thing to do at a time. Move in order or open any section directly; nothing is
          gated, and working through a section records that you took part — not a claim about
          clinical readiness.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <HemodynamicsContinueCta />
        </div>
        <p className={styles.composition} data-pathway-composition>
          {hemodynamicsCompositionLine()}
        </p>
      </section>
      <section aria-label="Every section of the pathway">
        <HemodynamicsStoredPathwayAccordion id="hemodynamics-learn-map" />
      </section>
    </div>
  )
}
