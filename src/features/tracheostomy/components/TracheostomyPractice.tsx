'use client'

import { DecisionScenario } from '@/features/skill-lab/components/DecisionScenario'
import { EquipmentLabeler } from '@/features/skill-lab/components/EquipmentLabeler'
import { StepSequencer } from '@/features/skill-lab/components/StepSequencer'

import { tracheostomyEquipment } from '../content/equipment'
import { tracheostomyScenarios } from '../content/scenarios'
import { tracheostomySequences } from '../content/sequences'
import { DecannulationReadinessLab } from './DecannulationReadinessLab'
import { TubeSelectionLab } from './TubeSelectionLab'

export function TracheostomyPractice() {
  return (
    <div className="container max-w-5xl space-y-12">
      <section className="space-y-4" aria-labelledby="trach-equipment-heading">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
            01 · Component recognition
          </p>
          <h2 id="trach-equipment-heading" className="text-2xl font-semibold text-foreground">
            Label the bedside tube
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Tube exchange and obstruction rescue are safer when every team member uses the same
            component names.
          </p>
        </div>
        {tracheostomyEquipment.map((equipment) => (
          <EquipmentLabeler key={equipment.id} map={equipment} />
        ))}
      </section>

      <TubeSelectionLab />

      <section className="space-y-5" aria-labelledby="trach-sequences-heading">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
            03 · Cognitive sequencing
          </p>
          <h2 id="trach-sequences-heading" className="text-2xl font-semibold text-foreground">
            Put safety-critical steps in order
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Use drag-and-drop or the keyboard move controls. Rationale stays hidden until the whole
            sequence is correct.
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {tracheostomySequences.map((sequence) => (
            <StepSequencer key={sequence.id} sequence={sequence} />
          ))}
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="trach-rescue-heading">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">
            04 · Rescue simulation
          </p>
          <h2 id="trach-rescue-heading" className="text-2xl font-semibold text-foreground">
            Make the first move before the explanation appears
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            These cases are simplified cognitive rehearsals. Follow the local emergency algorithm
            during real care and identify whether the patient has a tracheostomy or total
            laryngectomy.
          </p>
        </div>
        <div className="space-y-6">
          {tracheostomyScenarios.map((scenario) => (
            <DecisionScenario key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </section>

      <DecannulationReadinessLab />
    </div>
  )
}
