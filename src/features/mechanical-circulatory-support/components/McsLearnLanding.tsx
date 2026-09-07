import { mcsPathwayComposition } from '../content/pathwayResolver'
import { McsContinueCta } from './McsContinueCta'
import { McsStoredPathwayAccordion } from './McsPathwayAccordion'
import styles from './mechanical-circulatory-support.module.css'

/**
 * The Learn landing: the same door and the same map as the hub.
 *
 * It used to render the shared `PathwayLanding` — nine cards under a long intro, with its own
 * start link. Now it is two sentences, the one Continue the hub also resolves, and the pathway
 * accordion the hub also shows.
 */
export function McsLearnLanding() {
  const composition = mcsPathwayComposition()
  return (
    <div className={styles.learnLanding} data-learn-landing>
      <header className={styles.sectionHeading}>
        <span className={styles.kicker}>
          One continuous pathway · {composition.total} sections · {composition.minutes} min
        </span>
        <h1>Learn</h1>
        <p>
          Every section is read on the same simulated circulation: first the pressure apart from the
          flow, then the loop every device is drawn on, then each device one at a time, then the
          choice among them. Move in order, or open any section from the map below.
        </p>
        <div className={styles.heroActions}>
          <McsContinueCta />
        </div>
      </header>
      <section aria-labelledby="mcs-learn-landing-map-heading">
        <h2 id="mcs-learn-landing-map-heading">The pathway</h2>
        <McsStoredPathwayAccordion id="mcs-learn-landing-pathway" />
      </section>
      <aside role="note" className={styles.releaseReview}>
        <strong>Educational model · pending clinical review</strong>
        <p>
          Device responses are bounded teaching approximations. Device selection, timing, and
          escalation remain team decisions under current instructions and local protocol.
        </p>
      </aside>
    </div>
  )
}
