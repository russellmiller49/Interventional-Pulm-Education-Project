'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

import { DecisionScenario } from '@/features/skill-lab/components/DecisionScenario'
import { EquipmentLabeler } from '@/features/skill-lab/components/EquipmentLabeler'
import { StepSequencer } from '@/features/skill-lab/components/StepSequencer'
import { HandoffContent } from '@/i18n/handoff'

import { rigidBronchoscopyEquipment } from '../content/equipment'
import { rigidBronchoscopyScenarios } from '../content/scenarios'
import { rigidBronchoscopySequences } from '../content/sequences'
import { RigidBronchoscopyAssemblyLabDynamic } from './RigidBronchoscopyAssemblyLabDynamic'
import { buildRigidBronchoscopyAssemblyCopy } from './assemblyLabCopy'

export function RigidBronchoscopyLearnDemos() {
  const t = useTranslations('rigidBronchoscopy')
  const assemblyCopy = useMemo(
    () => ({
      ...buildRigidBronchoscopyAssemblyCopy((key) => t(key)),
      eyebrow: t('learn.demonstrations.assemblyEyebrow'),
      title: t('learn.demonstrations.assemblyLabTitle'),
      description: t('learn.demonstrations.assemblyLabDescription'),
      assemblyModeDescription: t('learn.demonstrations.assemblyModeDescription'),
      dragHelp: t('learn.demonstrations.assemblyHelp'),
      ventilationScenarioIntro: t('learn.demonstrations.ventilationIntro'),
    }),
    [t],
  )
  const sequenceLabels = useMemo(
    () => ({
      correctOrderHeading: t('learn.demonstrations.sequenceCorrectOrder'),
      rationaleHeading: t('learn.demonstrations.sequenceRationale'),
    }),
    [t],
  )
  const scenarioLabels = useMemo(
    () => ({
      briefingHeading: t('learn.demonstrations.scenarioBriefing'),
      demonstrationHeading: t('learn.demonstrations.scenarioGuidedResponse'),
      recommendedActionHeading: t('learn.demonstrations.scenarioRecommendedAction'),
      teachingPointHeading: t('learn.demonstrations.scenarioTeachingPoint'),
      debriefHeading: t('learn.demonstrations.scenarioDebrief'),
    }),
    [t],
  )
  const equipmentLabels = useMemo(
    () => ({
      bankHeading: t('learn.demonstrations.equipmentLabels'),
      demonstrationInstruction: t('learn.demonstrations.equipmentReviewInstruction'),
    }),
    [t],
  )

  return (
    <HandoffContent>
      {
        <div className="space-y-12">
          <section
            className="container max-w-6xl space-y-6"
            aria-labelledby="rigid-learn-demonstrations"
          >
            <div className="max-w-3xl space-y-2">
              <h2
                id="rigid-learn-demonstrations"
                className="text-2xl font-semibold tracking-tight text-foreground"
              >
                {t('learn.demonstrations.heading')}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {t('learn.demonstrations.intro')}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                {t('learn.demonstrations.assemblyHeading')}
              </h3>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {t('learn.demonstrations.assemblyIntro')}
              </p>
            </div>
            <RigidBronchoscopyAssemblyLabDynamic experience="demonstration" copy={assemblyCopy} />
          </section>

          <section
            className="container max-w-4xl space-y-4"
            aria-labelledby="rigid-learn-sequences"
          >
            <div className="space-y-1">
              <h2 id="rigid-learn-sequences" className="text-xl font-semibold text-foreground">
                {t('learn.demonstrations.sequencesHeading')}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {t('learn.demonstrations.sequencesIntro')}
              </p>
            </div>
            {rigidBronchoscopySequences.map((sequence) => (
              <StepSequencer
                key={sequence.id}
                sequence={sequence}
                experience="demonstration"
                labels={sequenceLabels}
              />
            ))}
          </section>

          <section
            className="container max-w-4xl space-y-4"
            aria-labelledby="rigid-learn-scenarios"
          >
            <div className="space-y-1">
              <h2 id="rigid-learn-scenarios" className="text-xl font-semibold text-foreground">
                {t('learn.demonstrations.scenariosHeading')}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {t('learn.demonstrations.scenariosIntro')}
              </p>
            </div>
            {rigidBronchoscopyScenarios.map((scenario) => (
              <DecisionScenario
                key={scenario.id}
                scenario={scenario}
                experience="demonstration"
                labels={scenarioLabels}
              />
            ))}
          </section>

          <section
            className="container max-w-4xl space-y-4"
            aria-labelledby="rigid-learn-equipment"
          >
            <div className="space-y-1">
              <h2 id="rigid-learn-equipment" className="text-xl font-semibold text-foreground">
                {t('learn.demonstrations.equipmentHeading')}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {t('learn.demonstrations.equipmentIntro')}
              </p>
            </div>
            {rigidBronchoscopyEquipment.map((map) => (
              <EquipmentLabeler
                key={map.id}
                map={map}
                experience="demonstration"
                labels={equipmentLabels}
              />
            ))}
          </section>
        </div>
      }
    </HandoffContent>
  )
}
