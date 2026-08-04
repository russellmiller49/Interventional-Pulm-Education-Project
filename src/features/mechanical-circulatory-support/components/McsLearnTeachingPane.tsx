'use client'

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import {
  MCS_MODEL_BOUNDARY_REFERENCES,
  mcsLearnControls,
  mcsSurfaceTarget,
  type McsSectionLearningContract,
} from '../content'
import type { McsSimulationState } from '../engine'
import styles from './mechanical-circulatory-support.module.css'

/**
 * Pane two: what the learner is looking at, what it can establish, and what it cannot.
 *
 * Section-specific by construction — every sentence here comes from that section's contract, so
 * there is no generic fallback to fall back to. It also carries the live numeric readout, which is
 * why the primary pane can be a single surface without the complementary half disappearing: an
 * anatomy-led section still shows its flow lines, in words, here.
 *
 * The two foundation sections additionally carry the common model and the standardized pathway
 * cards, unchanged, through `foundationMaterial`. Those are the teaching for those sections rather
 * than an aside beside it, so they belong in this pane and not below the workspace.
 */
export function McsLearnTeachingPane({
  contract,
  state,
  foundationMaterial,
}: {
  contract: McsSectionLearningContract
  state: McsSimulationState
  foundationMaterial?: ReactNode
}) {
  const target = mcsSurfaceTarget(contract.primarySurface, contract.primaryTarget)
  const control = contract.targetControl ? mcsLearnControls[contract.targetControl] : undefined
  const metrics = state.metrics
  const impella = state.device.kind === 'impella'

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

      <div className={styles.teachingBlock} data-live-readout>
        <h3>The three flow lines, right now</h3>
        <dl className={styles.liveFlowLines}>
          <div>
            <dt>Native contribution</dt>
            <dd>{metrics.nativeFlowLMin.toFixed(1)} L/min</dd>
          </div>
          <div>
            <dt>Displayed device contribution</dt>
            <dd>
              {state.device.kind === 'iabp'
                ? 'None reported — this pathway moves no blood of its own'
                : impella
                  ? `Left ${metrics.leftDeviceFlowLMin.toFixed(1)} L/min into the aorta · right ${metrics.rightDeviceFlowLMin.toFixed(1)} L/min into the lung`
                  : `${metrics.deviceFlowLMin.toFixed(1)} L/min (an estimate, not a probe reading)`}
            </dd>
          </div>
          <div>
            <dt>Effective systemic delivery</dt>
            <dd>{metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min</dd>
          </div>
        </dl>
        <p>{contract.teaching.flowAccountNote}</p>
      </div>

      <div className={styles.teachingBlock}>
        <h3>What the requested action does to the model</h3>
        <p>{contract.teaching.howTheActionAffectsTheModel}</p>
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

      {contract.sectionId === 'impella-suction-purge-rv' ||
      contract.sectionId === 'mcs-device-selection-integration' ? (
        <p className={styles.teachingAside} data-papi-limitation>
          <strong>A limit of this model.</strong>{' '}
          {MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.statement}{' '}
          {MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.appliesWhen} The pulmonary pulsatility
          ratio moves only weakly with right-sided support here, and mostly through right atrial
          pressure, so it must not be used on its own to judge whether right-sided support is
          working.
        </p>
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
