'use client'

import { Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { lessonHref } from '../content/module'
import { targetById, traceForTarget } from '../content/targets'
import { RIMS, modelMapLevels, type Anatomical, type Rim } from '../engine/arc-map'
import { DEMO_LESSON_ID, DEMO_TARGET_ID } from '../engine/demo-script'
import { planFrame } from '../engine/plan-session'
import styles from './branch-tracing.module.css'
// After the frame's stylesheet: the map's own rules override it at equal weight.
import { ArcMap } from './ArcMap'

/** One division is added to the poster's map this often. */
const DRAW_MS = 1100

/**
 * The way into the demonstration, on the course's front page: the nested-arc map for the
 * demonstration's lesion, drawing itself one division at a time, and the link to watch the whole
 * method. It is a picture of what the course teaches to draw; it asks nothing.
 */
export function MethodPoster() {
  const { rim, levels } = useMemo(() => {
    const target = targetById(DEMO_TARGET_ID)!
    const trace = traceForTarget(DEMO_TARGET_ID)
    const frame = planFrame(trace, target)!
    return {
      rim: Object.fromEntries(RIMS.map((r) => [r, frame.rim[r].word])) as Record<Rim, Anatomical>,
      levels: modelMapLevels(trace, target, 0),
    }
  }, [])
  // Before the page is in the browser, and with reduced motion, the whole map is simply there.
  const [drawn, setDrawn] = useState(levels.length)
  useEffect(() => {
    // Where the browser cannot say (or there is none), nothing is animated.
    if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let count = 0
    const tick = () => {
      setDrawn(count)
      if (count < levels.length) {
        count += 1
        timer = window.setTimeout(tick, DRAW_MS)
      }
    }
    let timer = window.setTimeout(tick, 0)
    return () => window.clearTimeout(timer)
  }, [levels.length])
  const whole = drawn >= levels.length
  return (
    <figure className={styles.methodPoster} data-method-poster data-poster-drawn={drawn}>
      <ArcMap
        rim={rim}
        levels={levels.slice(0, drawn)}
        star={whole}
        label="The map for one lesion"
        variant="compact"
      />
      <figcaption>
        <strong>The map you will learn to draw</strong>
        <span>
          An ostium circle with four directions, and an arc for each branch at each division, to the
          lesion.
        </span>
        <Link className={styles.posterLink} href={lessonHref(DEMO_LESSON_ID)} data-watch-method>
          <Play size={15} aria-hidden /> Watch the method, about 2 minutes
        </Link>
      </figcaption>
    </figure>
  )
}
