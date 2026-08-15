import type { Route } from 'next'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { PathwayLanding } from '@/features/learning-module/curriculum'
import { Link } from '@/i18n/navigation'

import { ecmoPathwayComposition } from '../content/pathwayResolver'
import type { SupportMode } from '../engine/types'
import { EcmoContinueCta } from './EcmoContinueCta'

const trackLabel: Readonly<Record<SupportMode, string>> = {
  vv: 'VV · for failing lungs · gas exchange in series',
  va: 'VA · for a failing heart · flow in parallel',
}

export function CardiohelpLearnLanding({ supportMode }: { readonly supportMode: SupportMode }) {
  const other: SupportMode = supportMode === 'vv' ? 'va' : 'vv'
  const { foundations, consoleOrientation, drills, capstone } = ecmoPathwayComposition(supportMode)
  // Counted from the registry, like every other count on this surface, so the note cannot drift
  // into describing a shape the pathway no longer has.
  const compositionLine = [
    `${foundations} foundations`,
    consoleOrientation === 1
      ? 'console orientation seventh'
      : `${consoleOrientation} console orientation sections`,
    `${drills} drills`,
    capstone === 1 ? 'integration capstone' : `${capstone} integration capstones`,
  ].join(' · ')

  return (
    <>
      <nav
        className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 pt-8 sm:px-6 lg:px-8"
        aria-label="Choose support mode track"
      >
        {(['vv', 'va'] as const).map((mode) => (
          <Link
            key={mode}
            href={`/cardiohelp-ecmo/learn?track=${mode}` as Route}
            aria-current={mode === supportMode ? 'page' : undefined}
            className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold aria-[current=page]:border-primary aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
          >
            {trackLabel[mode]}
          </Link>
        ))}
      </nav>
      <PathwayLanding
        pathway={criticalCareLearningPathway('cardiohelp-ecmo', supportMode)}
        sectionHref={(sectionId) =>
          `/cardiohelp-ecmo/learn?lesson=${sectionId}&track=${supportMode}`
        }
        eyebrow={`${supportMode.toUpperCase()} track · one continuous pathway`}
        intro="The first four sections are shared by both tracks: what extracorporeal support substitutes for, the circuit as a flow path, what a centrifugal pump does to the pressures around it, and why blood flow and sweep are not interchangeable. The track then adds its own physiology and its normal state before the console appears, and only then works the failure patterns. Move in order or open any section directly."
        startCta={<EcmoContinueCta supportMode={supportMode} />}
        sectionsNote={`${compositionLine} · Working the first four covers them for the other track (${other.toUpperCase()}) too.`}
        notice={
          <aside
            role="note"
            className="flex max-w-3xl gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6"
          >
            <div>
              <p className="font-semibold">Educational model · draft</p>
              <p className="text-muted-foreground">
                Circuit responses are bounded teaching approximations. Where the source set
                disagrees — including adult anticoagulation targets — both positions are shown
                rather than reconciled, and neither is presented as a bedside threshold.
              </p>
            </div>
          </aside>
        }
      />
    </>
  )
}
