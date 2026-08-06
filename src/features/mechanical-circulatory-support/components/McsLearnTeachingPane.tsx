'use client'

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import { mcsLearnControls, mcsSurfaceTarget, type McsSectionLearningContract } from '../content'
import type { McsDerivedMetrics, McsSimulationState } from '../engine'
import { McsTeachingPanel } from './teaching/McsTeachingPanel'
import {
  mcsMechanismDisclosed,
  mcsRevealStageAtLeast,
  type McsRevealStage,
} from './teaching/revealStage'
import styles from './mechanical-circulatory-support.module.css'

/**
 * Pane two: what the learner is looking at, what it can establish, and what it cannot.
 *
 * The pane is a shell now rather than the teaching itself. Its middle is the section's own live
 * panel — nine bespoke figures, one per section, each computed from the state on screen — and what
 * remains around that panel is the authored prose the panel organizes rather than replaces.
 *
 * The prose is disclosed in stages, and the stage is the single reason this component takes a
 * `reveal` rather than a phase. Before the learner has committed an answer the pane shows what is
 * physically on the screen and withholds the mechanism, because on several sections the sentence
 * that explains the figure *is* the prediction. Withholding means not rendering: none of the gated
 * blocks below exists in the DOM before its stage, so nothing is recoverable by turning off a
 * stylesheet.
 *
 * The two foundation sections additionally carry the common model and the standardized pathway
 * cards, unchanged, through `foundationMaterial`.
 */
export function McsLearnTeachingPane({
  contract,
  state,
  reveal,
  beforeMetrics,
  foundationMaterial,
}: {
  contract: McsSectionLearningContract
  state: McsSimulationState
  reveal: McsRevealStage
  /** The action-entry snapshot the section captured. Read-only here; never re-captured. */
  beforeMetrics: McsDerivedMetrics | null
  foundationMaterial?: ReactNode
}) {
  const target = mcsSurfaceTarget(contract.primarySurface, contract.primaryTarget)
  const control = contract.targetControl ? mcsLearnControls[contract.targetControl] : undefined
  const disclosed = mcsMechanismDisclosed(reveal)
  const explaining = mcsRevealStageAtLeast(reveal, 'explanation')

  return (
    <section className={styles.learnTeachingPane} aria-labelledby="mcs-learn-teaching-heading">
      <header className={styles.learnPaneHeader}>
        <span className={styles.kicker}>WHAT YOU ARE LOOKING AT</span>
        <h2 id="mcs-learn-teaching-heading">{contract.clinicalQuestion}</h2>
      </header>

      <div className={styles.teachingBlock}>
        <h3>On the screen right now</h3>
        <p>{contract.teaching.whatYouAreSeeing}</p>
        <p>
          <strong>{target?.label ?? contract.primaryTargetLabel}.</strong>{' '}
          {contract.teaching.whatTheTargetRepresents}
        </p>
        <p className={styles.teachingAside}>
          <strong>Why this surface and not the other:</strong> {contract.primarySurfaceRationale}
        </p>
      </div>

      <div
        className={styles.teachingPanelHost}
        data-mcs-teaching-panel-host
        data-reveal-stage={reveal}
      >
        <McsTeachingPanel
          contract={contract}
          state={state}
          reveal={reveal}
          beforeMetrics={beforeMetrics}
        />
      </div>

      {/*
       * Everything below sits after the shared answer verdict. The flow-account note and the
       * action's effect on the model both name the mechanism, and on the sections whose prediction
       * is about the mechanism they would answer the question before it was asked.
       */}
      {disclosed ? (
        <div className={styles.teachingBlock}>
          <h3>What the requested action does to the model</h3>
          <p>{contract.teaching.howTheActionAffectsTheModel}</p>
          <p>{contract.teaching.flowAccountNote}</p>
          {control ? (
            <p className={styles.teachingAside}>
              <strong>{control.label}</strong> changes {control.changes.toLowerCase()}{' '}
              {control.doesNotGuarantee}
            </p>
          ) : (
            <p className={styles.teachingAside}>
              <strong>No adjustment is expected here.</strong> {contract.noActionExplanation}
            </p>
          )}
        </div>
      ) : null}

      {disclosed ? (
        <div className={styles.teachingBlock}>
          <h3>What this can and cannot establish</h3>
          <p>
            <strong>Establishes:</strong> {contract.whatThisEstablishes}
          </p>
          <p data-does-not-establish>
            <strong>Does not establish:</strong> {contract.whatThisDoesNotEstablish}
          </p>
          <p className={styles.teachingWarning} data-common-misinterpretation>
            <AlertTriangle aria-hidden="true" />
            <span>
              <strong>One way this is read wrongly:</strong> {contract.commonMisinterpretation}
            </span>
          </p>
        </div>
      ) : null}

      {/*
       * The full causal account belongs to Explain. It is the section's answer written out, so it
       * arrives once the learner has been through the observation rather than beside the question.
       */}
      {explaining ? (
        <div className={styles.teachingBlock} data-causal-ladder-summary>
          <h3>Pressure, flow, oxygen delivery, organ response</h3>
          <ol className={styles.ladderList}>
            <li>
              <strong>Pressure</strong>
              <span>{contract.pressureLevelExplanation}</span>
            </li>
            <li>
              <strong>Flow</strong>
              <span>{contract.flowLevelExplanation}</span>
            </li>
            <li>
              <strong>Oxygen delivery</strong>
              <span>{contract.oxygenDeliveryExplanation}</span>
            </li>
            <li>
              <strong>Organ response</strong>
              <span>{contract.organResponseExplanation}</span>
            </li>
          </ol>
        </div>
      ) : null}

      {/*
       * The foundation material is long — it is the whole common model, and on the mechanisms
       * section the eight pathway cards as well. It stays complete and open by default, inside a
       * disclosure so a learner who has read it can fold it away and keep the section-specific
       * teaching above it within reach.
       */}
      {foundationMaterial ? (
        <details open className={styles.foundationDisclosure} data-foundation-material>
          <summary>The common model this section builds, and the pathways it compares</summary>
          <div className={styles.foundationMaterial}>{foundationMaterial}</div>
        </details>
      ) : null}
    </section>
  )
}
