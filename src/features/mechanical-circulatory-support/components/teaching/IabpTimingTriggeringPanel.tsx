import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  activeAlarms,
  beforeAfterReadings,
  iabpStripView,
  iabpTimingView,
  reading,
  tracePath,
  type McsIabpLandmark,
} from './selectors'
import {
  AlarmBand,
  BeforeAfter,
  DEADBAND_CAPTION,
  FigureScope,
  LiveSetting,
  LiveValue,
  ModelBoundary,
  PanelSection,
  TextEquivalent,
  TransferState,
  WaitingState,
  alarmSentence,
  beforeAfterSentence,
  styles,
} from './shared'

/**
 * Section 3 — where inflation and deflation land inside the beat.
 *
 * A timing error is a relationship between four moments, and it is invisible in any single number.
 * The strip below draws the ECG above the arterial trace on one time axis and marks all four: the
 * modeled dicrotic notch, where inflation begins, where deflation completes, and the next systolic
 * upstroke. Assisted beats are banded and labelled, so an assist ratio is something a learner can
 * see rather than something they read off a setting.
 *
 * The landmarks come from the engine's own cycle helper, not from a second timing model, and before
 * a commitment the panel marks them without saying which of them is in the wrong place.
 */

const STRIP_WIDTH = 320
const ECG_HEIGHT = 34
const ART_HEIGHT = 52

const landmarkMark: Readonly<Record<McsIabpLandmark['id'], string>> = {
  notch: 'N',
  inflation: 'I',
  deflation: 'D',
  upstroke: 'U',
}

export function IabpTimingTriggeringPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const timing = iabpTimingView(state)
  const strip = timing ? iabpStripView(state, timing) : null
  const alarms = activeAlarms(state)
  const rows = beforeAfterReadings(
    [
      {
        metric: 'timingQualityPercent',
        label: 'Timing synchrony',
        unit: '%',
        digits: 0,
        kind: 'displayed',
      },
      {
        metric: 'mapMmHg',
        label: 'Mean arterial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      {
        metric: 'pulsePressureMmHg',
        label: 'Pulse pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      { metric: 'nativeFlowLMin', label: 'Native contribution', unit: 'L/min', kind: 'modeled' },
      {
        metric: 'effectiveSystemicFlowLMin',
        label: 'Effective systemic delivery',
        unit: 'L/min',
        kind: 'reasoned',
      },
    ],
    beforeMetrics,
    state.metrics,
  )

  if (!timing) {
    return (
      <div className={styles.panel} data-teaching-panel={contract.sectionId}>
        <PanelSection title="Counterpulsation timing" id="timing-unavailable">
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            No counterpulsation pathway is in place, so there is no inflation or deflation to time.
          </p>
        </PanelSection>
      </div>
    )
  }

  const assistedBeatCount = strip ? strip.beats.filter((beat) => beat.assisted).length : 0
  const landmarkSentence = `Inflation sits ${timing.inflationOffsetMs} ms from the notch, which places it ${timing.inflationRelation}; deflation sits ${timing.deflationOffsetMs} ms from its reference, which places it ${timing.deflationRelation}.`

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="The beat, with the balloon's landmarks on it" id="timing-strip">
        {strip ? (
          <>
            <svg
              viewBox={`0 0 ${STRIP_WIDTH} ${ECG_HEIGHT + ART_HEIGHT + 26}`}
              className="mt-3 h-auto w-full"
              role="img"
              aria-label="Electrocardiogram above the arterial pressure trace over the last three modeled beats, with the dicrotic notch, inflation, deflation and the next upstroke marked"
              data-iabp-strip
            >
              {strip.beats.map((beat) => (
                <rect
                  key={beat.index}
                  x={Math.max(0, beat.start) * STRIP_WIDTH}
                  y="0"
                  width={Math.max(0, Math.min(1, beat.end) - Math.max(0, beat.start)) * STRIP_WIDTH}
                  height={ECG_HEIGHT + ART_HEIGHT + 12}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  strokeDasharray={beat.assisted ? '0' : '3 3'}
                  opacity="0.35"
                />
              ))}
              <path
                d={tracePath(strip.ecg, STRIP_WIDTH, ECG_HEIGHT)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <g transform={`translate(0 ${ECG_HEIGHT + 6})`}>
                <path
                  d={tracePath(strip.arterial, STRIP_WIDTH, ART_HEIGHT)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </g>
              {strip.landmarks.map((landmark) => (
                <g key={`${landmark.id}-${landmark.beatIndex}`} data-iabp-landmark={landmark.id}>
                  <line
                    x1={landmark.x * STRIP_WIDTH}
                    y1="0"
                    x2={landmark.x * STRIP_WIDTH}
                    y2={ECG_HEIGHT + ART_HEIGHT + 8}
                    stroke="currentColor"
                    strokeWidth="0.8"
                    strokeDasharray={
                      landmark.id === 'notch' ? '2 2' : landmark.id === 'upstroke' ? '6 3' : '0'
                    }
                  />
                  <text
                    x={landmark.x * STRIP_WIDTH + 2}
                    y={ECG_HEIGHT + ART_HEIGHT + 20}
                    fontSize="7"
                    fill="currentColor"
                  >
                    {landmarkMark[landmark.id]}
                  </text>
                </g>
              ))}
            </svg>
            <ul className="mt-2 grid gap-1 text-xs leading-5" data-landmark-key>
              <li>
                <span className="font-semibold">N — </span>dicrotic notch, the modeled moment of
                aortic-valve closure and the zero point the inflation setting is measured from.
              </li>
              <li>
                <span className="font-semibold">I — </span>inflation begins, currently{' '}
                {timing.inflationOffsetMs} ms from the notch, {timing.inflationRelation}.
              </li>
              <li>
                <span className="font-semibold">D — </span>deflation complete, currently{' '}
                {timing.deflationOffsetMs} ms from its reference, {timing.deflationRelation}.
              </li>
              <li>
                <span className="font-semibold">U — </span>next systolic upstroke.
              </li>
              <li>
                <span className="font-semibold">Solid outline — </span>an assisted beat. A dashed
                outline is a beat this ratio does not assist, and it carries no inflation or
                deflation marker.
              </li>
            </ul>
          </>
        ) : (
          <WaitingState label="arterial and electrocardiogram traces" />
        )}

        <TextEquivalent>
          The balloon is {timing.running ? 'running' : 'stopped'} on a {timing.triggerSource}{' '}
          trigger at a {timing.assistRatio} assist ratio. {landmarkSentence} The beat currently on
          screen {timing.assistedBeatNow ? 'is' : 'is not'} an assisted beat, and{' '}
          {strip
            ? `${assistedBeatCount} of the ${strip.beats.length} beats drawn are assisted`
            : 'the strip is still collecting samples'}
          . Timing synchrony reads {reading(timing.timingQualityPercent, 0)} percent.
        </TextEquivalent>

        <ModelBoundary>
          This is a modeled arterial trace, not a recording. The dicrotic notch is placed at the
          fixed cycle fraction this simulation uses as aortic-valve closure rather than detected
          from the waveform, so the picture shows where the simulation believes the landmarks are.
          Real counterpulsation is timed against a real trace on a real console, and neither the
          trace shape nor the landmark detection here reproduces a product display.
        </ModelBoundary>

        <FigureScope
          establishes="Where inflation and deflation currently sit relative to the modeled notch and the next upstroke, which beats this ratio assists, and which trigger the console is using."
          doesNotEstablish="Whether this level of support is adequate for the patient. Timing describes how much of the mechanism is available; it says nothing about whether that is enough."
        />
      </PanelSection>

      <PanelSection title="Trigger, ratio, and the synchrony reading" id="timing-settings">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveSetting
            label="Trigger source"
            value={timing.triggerSource}
            note="The signal the console uses to decide where each cardiac cycle begins."
          />
          <LiveSetting
            label="Assist ratio"
            value={timing.assistRatio}
            note={`One beat in ${state.device.kind === 'iabp' ? state.device.assistRatio : 1} is assisted.`}
          />
          <LiveValue
            label="Inflation vs notch"
            value={timing.inflationOffsetMs}
            unit="ms"
            digits={0}
            kind="displayed"
            note={`Zero places inflation at the notch. Currently ${timing.inflationRelation}.`}
          />
          <LiveValue
            label="Deflation offset"
            value={timing.deflationOffsetMs}
            unit="ms"
            digits={0}
            kind="displayed"
            note={`Currently ${timing.deflationRelation}.`}
          />
          <LiveValue
            label="Timing synchrony"
            value={timing.timingQualityPercent}
            unit="%"
            digits={0}
            kind="displayed"
            note="This simulation's own synchrony figure, produced from the trigger, the rhythm, and the two offsets."
          />
        </div>

        <ModelBoundary>
          The synchrony percentage is a value this simulation computes so that it can behave
          deterministically. Nothing has validated it at a bedside, no product publishes it, and it
          is not a number to drive a patient toward — no part of this module asks for a particular
          value of it.
        </ModelBoundary>

        <AlarmBand
          alarms={alarms}
          disclosed={disclosed}
          emptyLabel="No modeled timing alarm is active."
        />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
      </PanelSection>

      {disclosed ? (
        <PanelSection title="What each mistiming does" id="timing-consequences">
          <div className={styles.scroller}>
            <table className={styles.table} data-timing-consequences>
              <caption className="text-left text-xs leading-5 text-muted-foreground">
                Each of the four timing errors, where it lands in the beat, and what it does to the
                ventricle — described qualitatively, because this simulation does not quantify any
                of them.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Error
                  </th>
                  <th scope="col" className="pb-1 pr-3 font-semibold">
                    Where it lands
                  </th>
                  <th scope="col" className="pb-1 font-semibold">
                    Consequence
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr data-timing-error="early-inflation">
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    Early inflation
                  </th>
                  <td className="py-1 pr-3 align-top">
                    Before the notch, while ejection continues
                  </td>
                  <td className="py-1 align-top">
                    The balloon inflates into an open aortic valve, so the ventricle ejects against
                    added impedance. The mechanism meant to reduce the load is adding to it.
                  </td>
                </tr>
                <tr data-timing-error="late-inflation">
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    Late inflation
                  </th>
                  <td className="py-1 pr-3 align-top">After the notch, into diastole</td>
                  <td className="py-1 align-top">
                    Part of the diastolic window has already passed, so less of the augmentation the
                    mechanism can offer is realised.
                  </td>
                </tr>
                <tr data-timing-error="early-deflation">
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    Early deflation
                  </th>
                  <td className="py-1 pr-3 align-top">Well before the next upstroke</td>
                  <td className="py-1 align-top">
                    Augmentation ends prematurely, and the reduction in the pressure at the start of
                    the next ejection is lost with it.
                  </td>
                </tr>
                <tr data-timing-error="late-deflation">
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    Late deflation
                  </th>
                  <td className="py-1 pr-3 align-top">Into the next upstroke</td>
                  <td className="py-1 align-top">
                    The next ejection begins against a still-inflated balloon. Of the four, this is
                    the one the model treats as most harmful.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <TextEquivalent>
            Early inflation lands before the notch and adds impedance to an ejection still in
            progress. Late inflation lands after the notch and loses part of the diastolic window.
            Early deflation ends augmentation too soon. Late deflation lands in the next upstroke,
            so the ventricle opens against an inflated balloon.
          </TextEquivalent>
          <ModelBoundary>
            These are directions, not magnitudes. The simulation applies its own penalties to
            loading and native output; it does not reproduce any product&rsquo;s timing algorithm,
            and none of these rows is an operating instruction for a specific console.
          </ModelBoundary>
        </PanelSection>
      ) : null}

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before the timing change, and now" id="timing-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="What synchrony, pressure and flow read when the task began, and what they read now."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <ModelBoundary>{DEADBAND_CAPTION}</ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="timing-transfer">
          <TransferState principle="Timing is a relationship between four moments in the beat, and a trigger only helps if the inflation and deflation it produces still land in the right places — beat by beat, in whatever rhythm this patient has.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveSetting label="Rhythm" value={state.patient.rhythm} kind="modeled" />
              <LiveSetting label="Trigger source" value={timing.triggerSource} />
              <LiveSetting label="Assist ratio" value={timing.assistRatio} />
              <LiveValue
                label="Timing synchrony"
                value={timing.timingQualityPercent}
                unit="%"
                digits={0}
                kind="displayed"
              />
            </div>
            <AlarmBand
              alarms={alarms}
              disclosed={disclosed}
              emptyLabel="No modeled timing alarm is active."
            />
            <TextEquivalent>
              In the transfer patient the rhythm is {state.patient.rhythm}, the trigger is{' '}
              {timing.triggerSource}, the assist ratio is {timing.assistRatio}, and timing synchrony
              reads {reading(timing.timingQualityPercent, 0)} percent. {alarmSentence(alarms)}.
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
