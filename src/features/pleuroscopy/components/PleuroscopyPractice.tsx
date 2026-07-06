'use client'

import { useTranslations } from 'next-intl'

import { DecisionScenario } from '@/features/skill-lab/components/DecisionScenario'
import { EquipmentLabeler } from '@/features/skill-lab/components/EquipmentLabeler'
import { StepSequencer } from '@/features/skill-lab/components/StepSequencer'
import { HandoffContent } from '@/i18n/handoff'

import { pleuroscopyEquipment } from '../content/equipment'
import { pleuroscopyScenarios } from '../content/scenarios'
import { pleuroscopySequences } from '../content/sequences'

/**
 * Practice section for the Pleuroscopy module: composes the three shared
 * skill-lab drills (step sequencing, decision scenarios, equipment labeling)
 * over the module's authored content. Each drill holds its own in-memory state.
 */
export function PleuroscopyPractice() {
  const t = useTranslations('pleuroscopy.practice')

  return (
    <HandoffContent>
      {
        <div className="container max-w-4xl space-y-10">
          <section className="space-y-4" aria-labelledby="pleuroscopy-sequences">
            <div className="space-y-1">
              <h2 id="pleuroscopy-sequences" className="text-xl font-semibold text-foreground">
                {t('sequencesHeading')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('sequencesIntro')}</p>
            </div>
            {pleuroscopySequences.map((sequence) => (
              <StepSequencer key={sequence.id} sequence={sequence} />
            ))}
          </section>

          <section className="space-y-4" aria-labelledby="pleuroscopy-scenarios">
            <div className="space-y-1">
              <h2 id="pleuroscopy-scenarios" className="text-xl font-semibold text-foreground">
                {t('scenariosHeading')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('scenariosIntro')}</p>
            </div>
            {pleuroscopyScenarios.map((scenario) => (
              <DecisionScenario key={scenario.id} scenario={scenario} />
            ))}
          </section>

          <section className="space-y-4" aria-labelledby="pleuroscopy-equipment">
            <div className="space-y-1">
              <h2 id="pleuroscopy-equipment" className="text-xl font-semibold text-foreground">
                {t('equipmentHeading')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('equipmentIntro')}</p>
            </div>
            {pleuroscopyEquipment.map((map) => (
              <EquipmentLabeler key={map.id} map={map} />
            ))}
          </section>
        </div>
      }
    </HandoffContent>
  )
}
