'use client'

import type { Route } from 'next'

import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import { useRouter } from '@/i18n/navigation'

import type { McsAnatomyTargetId, McsMonitorTargetId, McsSectionLearningContract } from '../content'
import type { McsSimulationState } from '../engine'
import { McsAnatomy3D } from './McsAnatomy3D'
import { McsMonitor } from './McsMonitor'
import { mcsDeviceFlowText } from './teaching/selectors'
import styles from './mechanical-circulatory-support.module.css'

/**
 * Pane one: the live surface the section leads with, and nothing else.
 *
 * Which surface renders is read from the authored map, never decided here — there is deliberately no
 * device name, product family, or section title in this component. What it adds on top of the
 * surface is the short context strip a learner needs to know *whose* circulation they are looking
 * at, and the "why this view" sentence that says why the section chose anatomy or the monitor.
 *
 * The lesson prose stays out. It lives in the teaching pane, so this one can be made small without
 * making the section unreadable.
 */
export function McsLearnPrimaryPane({
  contract,
  state,
  phaseLabel,
}: {
  contract: McsSectionLearningContract
  state: McsSimulationState
  /** The phase name, so the context strip says where in the section the learner is. */
  phaseLabel: string
}) {
  const router = useRouter()
  const isAnatomy = contract.primarySurface === 'anatomy'

  return (
    <section
      className={styles.learnPrimaryPane}
      aria-label={`Live ${isAnatomy ? 'anatomy' : 'bedside monitor'} for ${contract.lessonTitle}`}
      data-primary-surface={contract.primarySurface}
      data-primary-target={contract.primaryTarget}
    >
      <header className={styles.learnPaneHeader}>
        <span className={styles.kicker}>
          {isAnatomy ? 'LIVE ANATOMY' : 'LIVE BEDSIDE MONITOR'} · {phaseLabel}
        </span>
        <h2>{contract.lessonTitle}</h2>
      </header>
      <dl className={styles.learnContextStrip} data-learn-context>
        <div>
          <dt>Patient problem</dt>
          <dd>{contract.patientProblem}</dd>
        </div>
        <div>
          <dt>Support pathway</dt>
          <dd>{contract.supportPathway}</dd>
        </div>
        <div>
          <dt>Right now</dt>
          <dd>
            {/*
             * The device slot comes from the flow account rather than from the raw metric, so this
             * strip cannot read `0.0` on a mechanism the account beneath it calls "none reported".
             */}
            Native {state.metrics.nativeFlowLMin.toFixed(1)} L/min · displayed device{' '}
            {mcsDeviceFlowText(state)} · effective systemic{' '}
            {state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min · mean pressure{' '}
            {state.metrics.mapMmHg} mm Hg
          </dd>
        </div>
      </dl>
      <p className={styles.whyThisView} data-why-this-view>
        <strong>Why this view?</strong> {contract.whyThisView}
      </p>
      {isAnatomy ? (
        <SimulationLaunchGate
          activityTitle="Mechanical circulatory support 3D anatomy"
          minimumViewport="desktop"
          bandwidthClass="heavy"
          estimatedSizeLabel="Interactive heart and device model"
          lightweightAlternativeHref="/critical-care/reference?item=mcs-cardiac-text-summary"
          onSaveForLater={() => router.push(mechanicalCirculatorySupportNavBase as Route)}
        >
          <McsAnatomy3D
            state={state}
            highlightTarget={contract.primaryTarget as McsAnatomyTargetId}
          />
        </SimulationLaunchGate>
      ) : (
        <McsMonitor state={state} highlightTarget={contract.primaryTarget as McsMonitorTargetId} />
      )}
    </section>
  )
}
