'use client'

import { useEffect, useRef, type Dispatch, type ReactNode } from 'react'

import { catheterTransitionHold } from '../../engine/catheterSafety'
import type { RouteStopId } from '../../content/routeSpine'
import type { StageAnatomy, StageSurface } from '../../content/stageLessons'
import type {
  FastFlushLineType,
  HemodynamicAction,
  HemodynamicSimulationState,
} from '../../engine/types'
import { BedsideMonitor } from '../BedsideMonitor'
import { CatheterMap, type CatheterMapAnswer } from '../catheter-map/CatheterMap'
import { HemodynamicHeart3DDynamic } from '../HemodynamicHeart3DDynamic'
import { WaveformRecognitionDrill } from '../WaveformRecognitionDrill'
import type { RecognitionRecord } from '../WaveformRecognitionDrill'
import { AtrialComponentDemonstration } from './AtrialComponentActivity'
import { LevelingVisual, FastFlushTrace } from '../PressureSystemTeachingVisual'
import {
  dynamicResponseDefinitions,
  formatSignedPressure,
  hydrostaticPressureOffsetMmHg,
} from '../../content/pressureSystemVisuals'
import { unroundedModelEstimates } from '../../engine/simulation'
import {
  FlushDock,
  FreezeDock,
  LineDock,
  ThermodilutionDock,
  TipDock,
  WedgeDock,
} from './StageDocks'
import styles from './hemodynamics-stage.module.css'
import flowStyles from './hemodynamics-flow.module.css'
import type { HemodynamicsTaskPresentation } from '../../content/taskPresentation'

/**
 * The simulator pane: the monitor, the controls the step opens, and the catheter map.
 *
 * Live/procedural tasks retain the unscaled monitor and current control dock. Recognition practice
 * uses focused model tracings. Its state is explicitly separate from the live patient.
 */
export function HemodynamicsSimulatorPane({
  state,
  dispatch,
  surface,
  anatomy = 'none',
  flushLine,
  controlsEnabled,
  lockedReason,
  pausedReason,
  chamberLabel,
  stops,
  mapCaption,
  mapAnswer,
  tipVisible,
  children,
  stepKey,
  requireFreshObservation = false,
  recognitionRecord,
  onRecognitionRecord,
  referenceLabel,
  taskContext,
  presentation,
  baseline,
  onResetDemonstration,
}: {
  readonly state: HemodynamicSimulationState
  readonly dispatch: Dispatch<HemodynamicAction>
  readonly surface: StageSurface
  /** The anatomy surface beneath the docks; the 3D heart on the wedge section. */
  readonly anatomy?: StageAnatomy
  readonly flushLine: FastFlushLineType
  readonly controlsEnabled: boolean
  /** Why the docks are off while the learner decides; printed on the simulator. */
  readonly lockedReason?: string
  /** Why the docks are off while the learner looks back; printed on the simulator. */
  readonly pausedReason?: string
  readonly chamberLabel: 'shown' | 'withheld'
  readonly stops: readonly RouteStopId[]
  readonly mapCaption?: string
  readonly mapAnswer?: CatheterMapAnswer
  readonly tipVisible: boolean
  readonly children?: ReactNode
  readonly stepKey?: string
  readonly requireFreshObservation?: boolean
  readonly recognitionRecord?: RecognitionRecord
  readonly onRecognitionRecord?: (record: RecognitionRecord) => void
  readonly referenceLabel?: string
  readonly taskContext?: ReactNode
  readonly presentation?: HemodynamicsTaskPresentation
  readonly baseline?: HemodynamicSimulationState
  readonly onResetDemonstration?: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (
      !stepKey ||
      !['why-measure', 'pressure-system', 'waveform-interpretation', 'waveform-components'].some(
        (id) => stepKey.startsWith(id),
      )
    )
      return
    const pane = panelRef.current?.closest<HTMLElement>(
      '[role="region"][aria-label="Simulator panel"]',
    )
    if (pane) pane.scrollTop = 0
  }, [stepKey])

  const catheterPanelUrgent =
    state.catheter.position === 'wedge' || state.catheter.forcedSafetyRecovery

  const dock = (() => {
    const props = { state, dispatch, enabled: controlsEnabled }
    switch (surface) {
      case 'level-demo':
        return (
          <>
            <LineDock {...props} only="level" />
            <LevelingVisual state={state} />
          </>
        )
      case 'zero-demo':
        return (
          <>
            <LineDock {...props} only="zero" />
            <p className={styles.dockNote}>
              PAC mean estimate {unroundedModelEstimates(state).meanPapMmHg.toFixed(1)} mmHg ·
              transducer {state.measurementSystem.transducerLevelCm} cm · zero{' '}
              {state.measurementSystem.zeroed ? 'set' : 'unset'}.
            </p>
          </>
        )
      case 'scale-demo':
        return (
          <>
            <LineDock {...props} only="scale" />
            <p className={styles.dockNote}>
              Systemic arterial MAP estimate {unroundedModelEstimates(state).mapMmHg.toFixed(1)}{' '}
              mmHg · ART display axis 0–{state.pressureScaleMmHg} mmHg. Changing the axis leaves the
              measured pressure unchanged.
            </p>
          </>
        )
      case 'response-demo':
        return (
          <section className={styles.surfaceCard} aria-label="Reference flush responses">
            <h3>Reference flush responses</h3>
            <p>
              Guided demonstration · PAC pressure channel · identical reference scale. These labeled
              examples are not captured observations from your attempt.
            </p>
            {dynamicResponseDefinitions.map((definition) => (
              <div key={definition.id}>
                <FastFlushTrace response={definition.id} lineType="pulmonary-artery" revealLabel />
                <p>
                  {definition.interpretation} {definition.pressureEffect}
                </p>
              </div>
            ))}
          </section>
        )
      case 'component-demo':
        return <AtrialComponentDemonstration />
      case 'line':
        return <LineDock {...props} />
      case 'flush':
        return (
          <>
            <LineDock {...props} />
            <FlushDock
              key={stepKey}
              {...props}
              lineType={flushLine}
              requireFreshObservation={requireFreshObservation}
            />
          </>
        )
      case 'flush-then-tip':
        return (
          <>
            <FlushDock {...props} lineType={flushLine} />
            <TipDock {...props} />
          </>
        )
      case 'tip':
        return <TipDock {...props} />
      case 'wedge':
        return <WedgeDock {...props} />
      case 'thermodilution':
        return <ThermodilutionDock {...props} />
      case 'freeze':
        return <FreezeDock {...props} />
      case 'recognition':
        return (
          <div className={styles.surfaceCard} data-surface="recognition">
            <WaveformRecognitionDrill
              enabled={controlsEnabled}
              record={recognitionRecord}
              onRecord={onRecognitionRecord}
            />
          </div>
        )
      case 'capstone':
        return (
          <div className={flowStyles.toolGroups}>
            <details>
              <summary>Pressure measurement</summary>
              <div>
                <LineDock {...props} />
                <FlushDock {...props} lineType="pulmonary-artery" />
              </div>
            </details>
            {/*
              Open whenever the catheter itself is the thing holding the case up, not only when a
              balloon is inflated. The capstone opens with the tip sitting distally on a deflated
              balloon, so the panel that explains the blocked flush was the one panel the learner
              had to go looking for (report L9-02, Figure 38 callout 4).
            */}
            <details open={catheterTransitionHold(state) !== null || catheterPanelUrgent}>
              <summary>Catheter and balloon</summary>
              <div>
                <WedgeDock {...props} />
                <TipDock {...props} />
              </div>
            </details>
            <details>
              <summary>Cardiac-output acquisition</summary>
              <div>
                <ThermodilutionDock {...props} />
              </div>
            </details>
          </div>
        )
      default:
        return null
    }
  })()

  const focused =
    surface === 'recognition' ||
    surface === 'component-demo' ||
    surface === 'component-identification' ||
    surface === 'response-demo'
  const lineDemo = surface === 'level-demo' || surface === 'zero-demo' || surface === 'scale-demo'
  const vignette = surface === 'question-trace'
  const monitor = (
    <div className={styles.monitorFrame}>
      {referenceLabel ? <p className={styles.dockNote}>{referenceLabel}</p> : null}
      <BedsideMonitor
        state={state}
        dispatch={dispatch}
        chamberLabel={chamberLabel}
        showControls={false}
        focus={presentation?.monitor === 'none' ? 'all' : presentation?.monitor}
      />
    </div>
  )

  const heart = (
    <section
      className={styles.surfaceCard}
      data-surface="heart-3d"
      aria-label="The heart and the catheter, in three dimensions"
    >
      <h3>Catheter course · synchronized teaching model</h3>
      <p className={styles.dockNote}>
        Drag to rotate, or use the arrow and Reset view buttons. Resistance and ectopy are not
        modeled.
      </p>
      {tipVisible ? (
        <HemodynamicHeart3DDynamic state={state} />
      ) : (
        <p>Tip position is withheld for this question. Use the pressure tracing.</p>
      )}
      <details>
        <summary>2D catheter map and keyboard position choices</summary>
        <CatheterMap
          emphasis={stops}
          caption={mapCaption}
          tipPosition={tipVisible ? state.catheter.position : null}
          balloonUp={tipVisible && state.catheter.balloonInflated}
        />
      </details>
    </section>
  )

  if (presentation) {
    const showControls =
      presentation.controls || state.catheter.balloonInflated || state.catheter.floatBalloonInflated
    return (
      <div className={styles.simulator} data-simulator-surface={surface}>
        <div
          className={
            presentation.anatomy === 'paired' ||
            (presentation.kind === 'signal-lab' &&
              presentation.monitor !== 'none' &&
              presentation.controls)
              ? flowStyles.paired
              : undefined
          }
        >
          <div>
            {presentation.monitor !== 'none' ? monitor : null}
            {presentation.anatomy === 'paired' && showControls && dock ? (
              <div className={styles.docks}>{dock}</div>
            ) : null}
            {presentation.anatomy === 'paired' && mapAnswer ? (
              <CatheterMap
                emphasis={stops}
                caption={mapCaption}
                tipPosition={tipVisible ? state.catheter.position : null}
                balloonUp={tipVisible && state.catheter.balloonInflated}
                answer={mapAnswer}
              />
            ) : null}
          </div>
          {presentation.anatomy === 'paired' ? (
            heart
          ) : showControls && dock ? (
            <div className={styles.docks}>{dock}</div>
          ) : null}
        </div>
        {presentation.anatomy === 'optional' ? (
          <details className={styles.surfaceCard}>
            <summary>Inspect catheter anatomy</summary>
            {heart}
          </details>
        ) : null}
        {lineDemo && baseline ? (
          <section className={flowStyles.comparison} aria-label="Retained demonstration comparison">
            <h3>Reference and current result</h3>
            <p>
              Same simulated patient; only this demonstration’s measurement setting changes. Model
              estimates, each rounded to 0.1 mmHg on its own, so a hand subtraction of the rounded
              figures can differ from the printed result by 0.1.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Observation</th>
                  <th>Reference</th>
                  <th>Current</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Transducer height</th>
                  <td>{baseline.measurementSystem.transducerLevelCm} cm</td>
                  <td>{state.measurementSystem.transducerLevelCm} cm</td>
                </tr>
                <tr>
                  <th>Atmospheric zero</th>
                  <td>{baseline.measurementSystem.zeroed ? 'Set' : 'Unset'}</td>
                  <td>{state.measurementSystem.zeroed ? 'Set' : 'Unset'}</td>
                </tr>
                {/*
                  HD-PRE-REVIEW-02 (report L2-02). These rows printed the model's integer estimate
                  with a ".0", so a 7.355 mmHg offset read as 16.0 → 9.0. They are now the
                  unrounded estimates at one decimal, with the offset itself on its own row.
                */}
                <tr>
                  <th>
                    {surface === 'scale-demo' ? 'Arterial MAP estimate' : 'PAC mean estimate'}
                  </th>
                  <td data-demo-before>
                    {(surface === 'scale-demo'
                      ? unroundedModelEstimates(baseline).mapMmHg
                      : unroundedModelEstimates(baseline).meanPapMmHg
                    ).toFixed(1)}{' '}
                    mmHg
                  </td>
                  <td data-demo-current>
                    {(surface === 'scale-demo'
                      ? unroundedModelEstimates(state).mapMmHg
                      : unroundedModelEstimates(state).meanPapMmHg
                    ).toFixed(1)}{' '}
                    mmHg
                  </td>
                </tr>
                {surface === 'level-demo' ? (
                  <tr>
                    <th>Hydrostatic contribution of the transducer height</th>
                    <td>
                      {formatSignedPressure(
                        hydrostaticPressureOffsetMmHg(baseline.measurementSystem.transducerLevelCm),
                      )}
                    </td>
                    <td data-demo-offset>
                      {formatSignedPressure(
                        hydrostaticPressureOffsetMmHg(state.measurementSystem.transducerLevelCm),
                      )}
                    </td>
                  </tr>
                ) : null}
                {surface === 'scale-demo' ? (
                  <tr>
                    <th>ART display axis</th>
                    <td>0–{baseline.pressureScaleMmHg} mmHg</td>
                    <td>0–{state.pressureScaleMmHg} mmHg</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {onResetDemonstration ? (
              <button type="button" className={styles.dockButton} onClick={onResetDemonstration}>
                Reset demonstration
              </button>
            ) : null}
          </section>
        ) : null}
        {children}
        {presentation.anatomy === 'map' ? (
          <CatheterMap
            emphasis={stops}
            caption={mapCaption}
            tipPosition={tipVisible ? state.catheter.position : null}
            balloonUp={tipVisible && state.catheter.balloonInflated}
            answer={mapAnswer}
          />
        ) : null}
        {lockedReason && presentation.controls ? (
          <p className={styles.lockedNote} data-controls-locked>
            {lockedReason}
          </p>
        ) : null}
        {pausedReason ? (
          <p className={styles.lockedNote} data-controls-paused>
            {pausedReason}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={panelRef} className={styles.simulator} data-simulator-surface={surface}>
      {lineDemo && dock ? <div className={styles.docks}>{dock}</div> : null}
      {focused ? null : vignette ? (
        <details className={styles.surfaceCard}>
          <summary>Separate normal reference monitor</summary>
          <p>
            The question trace and its patient vignette are in Steps. This monitor remains the
            normal teaching patient and does not depict the question.
          </p>
          {monitor}
        </details>
      ) : (
        monitor
      )}
      {lockedReason ? (
        <p className={styles.lockedNote} role="status" data-controls-locked>
          {lockedReason}
        </p>
      ) : null}
      {pausedReason ? (
        <p className={styles.lockedNote} role="status" data-controls-paused>
          {pausedReason}
        </p>
      ) : null}
      {dock && !lineDemo ? <div className={styles.docks}>{dock}</div> : null}
      {anatomy === 'heart' ? (
        <section
          className={styles.surfaceCard}
          data-surface="heart-3d"
          aria-label="The heart and the catheter, in three dimensions"
        >
          <p className={styles.kicker}>The heart and the catheter · teaching model</p>
          <p className={styles.dockNote}>
            The catheter&apos;s course through the right heart, its balloon and the transducer, in
            step with the monitor above. Drag to turn it; the arrows and Reset view do the same from
            the keyboard.
          </p>
          <HemodynamicHeart3DDynamic state={state} />
        </section>
      ) : null}
      {children}
      {!focused && !vignette ? (
        <CatheterMap
          emphasis={stops}
          caption={mapCaption}
          tipPosition={tipVisible ? state.catheter.position : null}
          balloonUp={tipVisible && state.catheter.balloonInflated}
          answer={mapAnswer}
        />
      ) : null}
      {taskContext}
    </div>
  )
}
