'use client'

import type { Route } from 'next'
import { ArrowRight, Stethoscope } from 'lucide-react'
import type { ReactNode } from 'react'

import { Link, useRouter } from '@/i18n/navigation'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'

import { getIcuScenario } from '../content'
import { icuScenarioFamilies, type IcuScenarioFamily } from '../engine'
import { IcuSimulatorLab } from './IcuSimulatorLab'
import styles from './icu-simulation.module.css'

export interface IcuCapstoneEntryProps {
  readonly mode: 'practice' | 'assess'
  readonly locale?: string
  readonly requestedScenarioId?: string
}

function IntegratedSimulatorLaunchGate({ children }: { readonly children: ReactNode }) {
  const router = useRouter()
  return (
    <SimulationLaunchGate
      activityTitle="Integrated ICU bedside simulator"
      minimumViewport="desktop"
      bandwidthClass="heavy"
      estimatedSizeLabel="Interactive bedside, device, and monitor assets"
      lightweightAlternativeHref="/icu-simulation"
      onSaveForLater={() => router.push('/critical-care' as Route)}
      theme="dark"
    >
      {children}
    </SimulationLaunchGate>
  )
}

function challengeLabel(scenarioId: IcuScenarioFamily): string {
  const index = icuScenarioFamilies.indexOf(scenarioId)
  return `Challenge ${String(index + 1).padStart(2, '0')}`
}

function isIcuScenarioFamily(value: string | undefined): value is IcuScenarioFamily {
  return typeof value === 'string' && icuScenarioFamilies.some((scenarioId) => scenarioId === value)
}

function PracticeEntry({
  locale,
  requestedScenarioId,
}: {
  readonly locale?: string
  readonly requestedScenarioId?: string
}) {
  const scenarioId = isIcuScenarioFamily(requestedScenarioId)
    ? requestedScenarioId
    : icuScenarioFamilies[0]
  const scenario = getIcuScenario(scenarioId)

  return (
    <div className={styles.capstoneActivityRoute} data-icu-capstone-active="practice">
      <section className={styles.capstonePreparation} aria-labelledby="practice-entry-title">
        <div className={styles.capstonePreparationHeader}>
          <div>
            <span className={styles.panelKicker}>Open practice</span>
            <h2 id="practice-entry-title">{scenario.title}</h2>
            <p>
              Start this synthetic course directly. Related focused activities are optional
              refreshers and never prevent entry.
            </p>
          </div>
        </div>
        <div className={styles.practiceOpenNote} role="note">
          <Stethoscope aria-hidden="true" />
          <p>
            <strong>Choose the case that fits your question.</strong> The scenario remains available
            regardless of saved history.
          </p>
        </div>
      </section>
      <div className={styles.capstoneActivityStage}>
        <IntegratedSimulatorLaunchGate>
          <IcuSimulatorLab
            mode="practice"
            locale={locale}
            initialScenarioId={scenarioId}
            embedded
          />
        </IntegratedSimulatorLaunchGate>
      </div>
    </div>
  )
}

function ChallengeLibrary() {
  return (
    <main className={styles.capstoneGate}>
      <header className={styles.assessmentGateHeader}>
        <Link href={'/icu-simulation' as Route} className={styles.backLink}>
          ICU Simulator home
        </Link>
        <span className={styles.panelKicker}>Challenge library</span>
        <h1>Harder cases, open from the start</h1>
        <p>
          Challenges provide less help while you work and collect the teaching feedback for the
          debrief. Preparation links are suggestions, not requirements.
        </p>
      </header>
      <section className={styles.assessmentCaseList} aria-labelledby="challenge-case-list-title">
        <h2 id="challenge-case-list-title">Choose a challenge</h2>
        <div>
          {icuScenarioFamilies.map((scenarioId) => {
            const scenario = getIcuScenario(scenarioId)
            return (
              <article key={scenarioId} data-ready>
                <header>
                  <div>
                    <span>{challengeLabel(scenarioId)}</span>
                    <strong>{scenario.shortTitle}</strong>
                  </div>
                </header>
                <p>{scenario.summary}</p>
                <Link href={`/icu-simulation/assess?case=${scenarioId}` as Route}>
                  Open challenge
                  <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            )
          })}
        </div>
      </section>
      <Link className={styles.practiceFallbackLink} href={'/icu-simulation/practice' as Route}>
        Prefer coached Practice?
        <ArrowRight aria-hidden="true" />
      </Link>
    </main>
  )
}

export function IcuCapstoneEntry({
  mode,
  locale = 'en',
  requestedScenarioId,
}: IcuCapstoneEntryProps) {
  if (mode === 'practice') {
    return <PracticeEntry locale={locale} requestedScenarioId={requestedScenarioId} />
  }

  if (!isIcuScenarioFamily(requestedScenarioId)) return <ChallengeLibrary />

  return (
    <div className={styles.capstoneActivityRoute} data-icu-capstone-active="assess">
      <div className={styles.capstoneActivityStage}>
        <IntegratedSimulatorLaunchGate>
          <IcuSimulatorLab
            mode="assess"
            locale={locale}
            initialScenarioId={requestedScenarioId}
            availableScenarioIds={[requestedScenarioId]}
            embedded
          />
        </IntegratedSimulatorLaunchGate>
      </div>
    </div>
  )
}
