'use client'

import { useReducer } from 'react'
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Layers3,
  LockKeyhole,
  RotateCcw,
  Siren,
} from 'lucide-react'

import { prismaflexReviewCandidateDeviceProfile } from '../content/deviceProfiles'
import { prismaflexCalculationAdapter } from '../engine/deviceAdapters/prismaflexCalculations'
import {
  prismaflexAlarmCategoryCandidates,
  prismaflexDeviceAdapter,
  prismaflexSetupSteps,
} from '../engine/deviceAdapters/prismaflex'
import type { CrrtFlowRates } from '../engine/types'
import {
  PRISMAFLEX_REVIEW_CONSOLE_VIEW_IDS,
  createPrismaflexReviewConsoleState,
  reducePrismaflexReviewConsole,
  type PrismaflexReviewConsoleViewId,
} from '../prismaflexReviewConsoleModel'
import styles from './prismaflex-reviewer-console.module.css'

const viewLabels: Readonly<Record<PrismaflexReviewConsoleViewId, string>> = Object.freeze({
  setup: 'Setup map',
  profile: 'Profile',
  calculations: 'Display math',
  'alarm-taxonomy': 'Alarm taxonomy',
})

const syntheticReviewFlows: CrrtFlowRates = Object.freeze({
  bloodFlowMlMin: 180,
  dialysateFlowMlHour: 1_000,
  pbpFlowMlHour: 200,
  preReplacementFlowMlHour: 300,
  postReplacementFlowMlHour: 500,
  patientFluidRemovalMlHour: 100,
  syringeFlowMlHour: 10,
  makeupFlowMlHour: 0,
})

const syntheticDisplayedPressures = prismaflexCalculationAdapter.calculateDisplayedPressures({
  rawFilterPressureMmHg: 150,
  rawReturnPressureMmHg: 90,
  rawEffluentPressureMmHg: -20,
})

const syntheticPumpTarget =
  prismaflexCalculationAdapter.calculateEffluentPumpTargetMlPerHour(syntheticReviewFlows)
const syntheticDoseSectionFlow =
  prismaflexCalculationAdapter.calculateDoseSectionEffluentFlowMlPerHour(syntheticReviewFlows)

export function PrismaflexReviewerConsole() {
  const [state, dispatch] = useReducer(
    reducePrismaflexReviewConsole,
    undefined,
    createPrismaflexReviewConsoleState,
  )
  const currentSetupStep = prismaflexSetupSteps[state.setupStepIndex]

  return (
    <section
      className={styles.shell}
      aria-labelledby="prismaflex-reviewer-console-heading"
      data-reviewer-only="true"
      data-learner-runtime="disabled"
      data-device-action="none"
      data-progress-write="none"
      data-analytics="none"
      data-scoring="none"
      data-competency="none"
    >
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Phase 8 · source-mapped review candidate</span>
          <h3 id="prismaflex-reviewer-console-heading">Prismaflex softkey review console</h3>
          <p>
            Original educational interface for inspecting the G5036003 program 6.xx mapping. It does
            not reproduce an installed system or execute a setup, alarm response, or therapy.
          </p>
        </div>
        <span className={styles.statusBadge}>
          <LockKeyhole aria-hidden="true" /> Adapter not learner-registered
        </span>
      </header>

      <div className={styles.identityStrip}>
        <dl>
          <div>
            <dt>Source manufacturer</dt>
            <dd>{prismaflexReviewCandidateDeviceProfile.manufacturerDisclosure}</dd>
          </div>
          <div>
            <dt>Manual</dt>
            <dd>
              {prismaflexReviewCandidateDeviceProfile.manualNumber} ·{' '}
              {prismaflexReviewCandidateDeviceProfile.manualRevision}
            </dd>
          </div>
          <div>
            <dt>Configuration</dt>
            <dd>Pending local review</dd>
          </div>
        </dl>
      </div>

      <div className={styles.console}>
        <div className={styles.display} aria-live="polite">
          <div className={styles.displayHeader}>
            <span>{viewLabels[state.viewId]}</span>
            <small>Reviewer-only · all mappings pending</small>
          </div>

          {state.viewId === 'setup' && currentSetupStep ? (
            <section className={styles.setupView} aria-labelledby="prismaflex-setup-map-heading">
              <div className={styles.viewTitle}>
                <ClipboardCheck aria-hidden="true" />
                <div>
                  <span>
                    Source sequence {state.setupStepIndex + 1} / {prismaflexSetupSteps.length}
                  </span>
                  <h4 id="prismaflex-setup-map-heading">{currentSetupStep.label}</h4>
                </div>
              </div>
              <p>
                This is a sequence label for review, not a completed machine step. Conditional
                therapy, set, syringe, anticoagulation, stop, and end branches remain inactive.
              </p>
              <div className={styles.setupProgress} aria-hidden="true">
                <span
                  style={{
                    width: `${((state.setupStepIndex + 1) / prismaflexSetupSteps.length) * 100}%`,
                  }}
                />
              </div>
              <p className={styles.sourceLine}>Pending source record: DEV-PF-002</p>
            </section>
          ) : null}

          {state.viewId === 'profile' ? (
            <section className={styles.profileView} aria-labelledby="prismaflex-profile-heading">
              <div className={styles.viewTitle}>
                <Layers3 aria-hidden="true" />
                <div>
                  <span>Immutable reviewer profile</span>
                  <h4 id="prismaflex-profile-heading">
                    {prismaflexReviewCandidateDeviceProfile.displayName}
                  </h4>
                </div>
              </div>
              <div className={styles.profileGrid}>
                <div>
                  <strong>Source-described inventory</strong>
                  <ul>
                    {prismaflexReviewCandidateDeviceProfile.pumpAndScaleInventory.items.map(
                      (item) => (
                        <li key={item}>{item}</li>
                      ),
                    )}
                  </ul>
                </div>
                <div>
                  <strong>Locally activated</strong>
                  <p>0 therapies · 0 sets/accessories · 0 active ranges</p>
                </div>
              </div>
              <p className={styles.sourceLine}>
                Pending source records: {prismaflexDeviceAdapter.sourceIds.join(', ')}
              </p>
            </section>
          ) : null}

          {state.viewId === 'calculations' ? (
            <section
              className={styles.calculationView}
              aria-labelledby="prismaflex-calculation-heading"
            >
              <div className={styles.viewTitle}>
                <Calculator aria-hidden="true" />
                <div>
                  <span>Synthetic arithmetic fixture · no clinical target</span>
                  <h4 id="prismaflex-calculation-heading">Device display contexts stay separate</h4>
                </div>
              </div>
              <dl className={styles.calculationGrid}>
                <div>
                  <dt>Pump-target Qeff</dt>
                  <dd>{syntheticPumpTarget.toLocaleString()} mL/h</dd>
                  <small>Includes the synthetic syringe term · DEV-PF-006</small>
                </div>
                <div>
                  <dt>Dose-section Qeff</dt>
                  <dd>{syntheticDoseSectionFlow.toLocaleString()} mL/h</dd>
                  <small>Omits the syringe term as printed · DEV-PF-006</small>
                </div>
                <div>
                  <dt>Displayed TMP</dt>
                  <dd>{syntheticDisplayedPressures.transmembranePressureMmHg} mmHg</dd>
                  <small>Synthetic pressures with documented display correction</small>
                </div>
                <div>
                  <dt>Displayed filter drop</dt>
                  <dd>{syntheticDisplayedPressures.displayedFilterPressureDropMmHg} mmHg</dd>
                  <small>
                    Raw value {syntheticDisplayedPressures.rawFilterPressureDropMmHg} mmHg
                  </small>
                </div>
              </dl>
              <p className={styles.conflictNote} role="note">
                <CircleAlert aria-hidden="true" /> <strong>CONFLICT-010 remains unresolved.</strong>{' '}
                The two printed Qeff contexts are not silently merged, and neither displayed value
                is an alarm threshold or delivered-dose claim.
              </p>
            </section>
          ) : null}

          {state.viewId === 'alarm-taxonomy' ? (
            <section className={styles.alarmView} aria-labelledby="prismaflex-alarm-heading">
              <div className={styles.viewTitle}>
                <Siren aria-hidden="true" />
                <div>
                  <span>Taxonomy only · individual mappings unavailable</span>
                  <h4 id="prismaflex-alarm-heading">Prismaflex category vocabulary</h4>
                </div>
              </div>
              <ul className={styles.alarmCategories}>
                {prismaflexAlarmCategoryCandidates.map((category) => (
                  <li key={category.label}>
                    <strong>{category.label}</strong>
                    <span>Mapping pending</span>
                  </li>
                ))}
              </ul>
              <p>
                No engine condition is assigned to a category here. Exact detection, priority,
                pump/clamp reaction, correction, override, restart, and escalation require an
                individual source record and device review.
              </p>
              <p className={styles.sourceLine}>Pending source record: DEV-PF-007</p>
            </section>
          ) : null}
        </div>

        <div className={styles.softkeyRail} aria-label="Prismaflex reviewer softkeys">
          {PRISMAFLEX_REVIEW_CONSOLE_VIEW_IDS.map((viewId) => (
            <button
              key={viewId}
              type="button"
              aria-pressed={state.viewId === viewId}
              onClick={() => dispatch({ type: 'SELECT_VIEW', viewId })}
            >
              {viewLabels[viewId]}
            </button>
          ))}
        </div>

        <div className={styles.consoleControls}>
          <button
            type="button"
            disabled={state.viewId !== 'setup' || state.setupStepIndex === 0}
            onClick={() => dispatch({ type: 'MOVE_SETUP_STEP', direction: 'previous' })}
          >
            <ChevronLeft aria-hidden="true" /> Previous step
          </button>
          <button type="button" onClick={() => dispatch({ type: 'RESET' })}>
            <RotateCcw aria-hidden="true" /> Reset review
          </button>
          <button
            type="button"
            disabled={
              state.viewId !== 'setup' || state.setupStepIndex === prismaflexSetupSteps.length - 1
            }
            onClick={() => dispatch({ type: 'MOVE_SETUP_STEP', direction: 'next' })}
          >
            Next step <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.boundary} role="note">
        <CircleAlert aria-hidden="true" />
        <p>
          The profile has no enabled therapy, set, accessory, solution, range, alarm mapping,
          anticoagulation pathway, or learner action. The source manual describes a product family;
          it does not establish the configuration of a local device.
        </p>
      </div>
    </section>
  )
}
