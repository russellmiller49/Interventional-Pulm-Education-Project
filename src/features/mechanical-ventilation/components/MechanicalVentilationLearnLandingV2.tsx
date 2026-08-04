import { FlaskConical } from 'lucide-react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { PathwayLanding } from '@/features/learning-module/curriculum'

export function MechanicalVentilationLearnLandingV2() {
  return (
    <PathwayLanding
      pathway={criticalCareLearningPathway('mechanical-ventilation')}
      sectionHref={(sectionId) => `/mechanical-ventilation/learn?activity=${sectionId}`}
      intro="Mechanics and a repeatable waveform-reading sequence come first, because a mode is only legible once you can read what it does to the waveforms. Timing, dyssynchrony, oxygenation, and ventilation each isolate one interaction between the patient and the machine. The last section puts four of them behind a single alarm. Move in order or open any section directly."
      startLabel="Start with the mechanics"
      sectionsNote="Modes sit fourth on purpose: they are device-facing, and they belong after the physiology they operate on."
      notice={
        <aside
          role="note"
          className="flex max-w-3xl gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6"
        >
          <FlaskConical
            className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Preview · needs clinical review</p>
            <p className="text-muted-foreground">
              These lesson drafts are available for preview and make no claim about clinical
              readiness. Numeric thresholds await this module&rsquo;s source reconciliation; use the
              reviewed practice cases for deeper clinical application.
            </p>
          </div>
        </aside>
      }
    />
  )
}
