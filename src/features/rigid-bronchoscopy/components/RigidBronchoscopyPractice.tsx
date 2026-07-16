'use client'

import { useTranslations } from 'next-intl'

import { DecisionScenario } from '@/features/skill-lab/components/DecisionScenario'
import { EquipmentLabeler } from '@/features/skill-lab/components/EquipmentLabeler'
import { StepSequencer } from '@/features/skill-lab/components/StepSequencer'
import { HandoffContent } from '@/i18n/handoff'

import { rigidBronchoscopyEquipment } from '../content/equipment'
import { rigidBronchoscopyScenarios } from '../content/scenarios'
import { rigidBronchoscopySequences } from '../content/sequences'

/**
 * Practice section for the Rigid Bronchoscopy module: composes the three shared
 * skill-lab drills (step sequencing, decision scenarios, equipment labeling)
 * over the module's authored content. Each drill holds its own in-memory state.
 */
export function RigidBronchoscopyPractice() {
  const t = useTranslations('rigidBronchoscopy.practice')

  return (
    <HandoffContent>
      {
        <div className="container max-w-4xl space-y-10">
          <section className="space-y-4" aria-labelledby="rigid-sequences">
            <div className="space-y-1">
              <h2 id="rigid-sequences" className="text-xl font-semibold text-foreground">
                {t('sequencesHeading')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('sequencesIntro')}</p>
            </div>
            {rigidBronchoscopySequences.map((sequence) => (
              <StepSequencer key={sequence.id} sequence={sequence} />
            ))}
          </section>

          <section className="space-y-4" aria-labelledby="rigid-scenarios">
            <div className="space-y-1">
              <h2 id="rigid-scenarios" className="text-xl font-semibold text-foreground">
                {t('scenariosHeading')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('scenariosIntro')}</p>
            </div>
            {rigidBronchoscopyScenarios.map((scenario) => (
              <DecisionScenario key={scenario.id} scenario={scenario} />
            ))}
          </section>

          <section className="space-y-4" aria-labelledby="rigid-equipment">
            <div className="space-y-1">
              <h2 id="rigid-equipment" className="text-xl font-semibold text-foreground">
                {t('equipmentHeading')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('equipmentIntro')}</p>
            </div>
            {rigidBronchoscopyEquipment.map((map) => (
              <EquipmentLabeler key={map.id} map={map} />
            ))}
          </section>
        </div>
      }
    </HandoffContent>
  )
}
