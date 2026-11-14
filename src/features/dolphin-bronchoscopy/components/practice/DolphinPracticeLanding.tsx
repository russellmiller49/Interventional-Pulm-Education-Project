'use client'

import { Crosshair, Image as ImageIcon, Stethoscope } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { DOLPHIN_DRILL_SETS } from '../../content/branchDrillSets'
import { DOLPHIN_FRAME_DRILLS } from '../../content/frameDrills'
import { interleavedMicroCases } from '../../content/microCases'
import {
  dolphinBranchDrillLinkTarget,
  dolphinFrameDrillLinkTarget,
  dolphinPracticeCaseLinkTarget,
} from '../../content/routes'
import styles from '../dolphin-hub.module.css'
import { useDolphinProgress } from '../useDolphinProgress'

/**
 * Practice: short cases with one decision each, branch-finding drills on the simulator, and frame
 * drills. Every item is open; this device remembers only which ones were opened.
 */
export function DolphinPracticeLanding() {
  const { progress } = useDolphinProgress()
  const opened = new Set(progress.openedPracticeCaseIds)
  const groups = interleavedMicroCases()
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Practice</p>
        <h1 className="text-3xl font-bold tracking-tight">One decision at a time</h1>
        <p>
          Each case gives the situation and asks for one decision, with its explanation after you
          answer or before, if you prefer. The drills put the scope in your hands with the labels
          off. Nothing here is timed or kept.
        </p>
      </header>

      <section className="grid gap-4" aria-labelledby="practice-cases-heading">
        <h2 id="practice-cases-heading" className="text-xl font-semibold">
          Cases
        </h2>
        {groups.map((group) => (
          <div key={group.phase} className="grid gap-2" data-practice-phase={group.phase}>
            <h3 className="text-base font-semibold">{group.phase}</h3>
            <div className={styles.chipRow}>
              {group.cases.map((microCase) => (
                <Link
                  key={microCase.id}
                  className={styles.chip}
                  data-kind="practice-case"
                  data-visited={opened.has(microCase.id)}
                  href={dolphinPracticeCaseLinkTarget(microCase.id)}
                >
                  <Stethoscope aria-hidden="true" />
                  {microCase.presentationTitle}
                  {opened.has(microCase.id) ? ' · opened' : ''}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-3" aria-labelledby="practice-drills-heading">
        <h2 id="practice-drills-heading" className="text-xl font-semibold">
          Find the branch, labels off
        </h2>
        <p>
          Drive the dolphin airway to each named branch. A turn off the way gets a hint, never a
          mark.
        </p>
        <div className={styles.chipRow}>
          {DOLPHIN_DRILL_SETS.map((set) => (
            <Link
              key={set.id}
              className={styles.chip}
              data-kind="branch-drill"
              href={dolphinBranchDrillLinkTarget(set.id)}
            >
              <Crosshair aria-hidden="true" />
              {set.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="practice-frames-heading">
        <h2 id="practice-frames-heading" className="text-xl font-semibold">
          Frames
        </h2>
        <div className={styles.chipRow}>
          {DOLPHIN_FRAME_DRILLS.map((drill) => (
            <Link
              key={drill.id}
              className={styles.chip}
              data-kind="frame-drill"
              href={dolphinFrameDrillLinkTarget(drill.id)}
            >
              <ImageIcon aria-hidden="true" />
              {drill.title} · {drill.items.length} views
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
