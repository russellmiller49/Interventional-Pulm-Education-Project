import { MCS_IABP_PRESSURE_SCALE } from '../../content/iabpWaveformReference'
import { measureIabpLandmarkPressures, type IabpLandmarkPressures } from '../../engine/model'
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
  FigureCaption,
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

/**
 * The five pressures the trace is read by, measured from the strip's own expression.
 *
 * Shown under the strip so the three relationships can be checked as numbers while the timing is
 * changed. At 1:1 there is no unassisted beat to compare with, and the readout says so.
 */
function IabpLandmarkReadout({ landmarks }: { readonly landmarks: IabpLandmarkPressures | null }) {
  if (!landmarks) return null
  const value = (mmHg: number | null) => (mmHg === null ? '—' : `${mmHg} mm Hg`)
  const compared = landmarks.unassistedSystolicMmHg !== null
  return (
    <section className="mt-3 min-w-0 rounded-xl border px-3 py-2" data-iabp-landmark-readout>
      <h4 className="text-xs font-semibold">The five pressures on this trace</h4>
      <dl className="mt-1 grid gap-1 text-xs leading-5 sm:grid-cols-2">
        <div>
          <dt className="inline">Unassisted systole: </dt>
          <dd className="inline font-semibold" data-landmark="unassisted-systolic">
            {value(landmarks.unassistedSystolicMmHg)}
          </dd>
        </div>
        <div>
          <dt className="inline">Diastolic augmentation: </dt>
          <dd className="inline font-semibold" data-landmark="augmented-diastolic">
            {value(landmarks.augmentedDiastolicMmHg)}
          </dd>
        </div>
        <div>
          <dt className="inline">Assisted systole: </dt>
          <dd className="inline font-semibold" data-landmark="assisted-systolic">
            {value(landmarks.assistedSystolicMmHg)}
          </dd>
        </div>
        <div>
          <dt className="inline">Unassisted end-diastolic: </dt>
          <dd className="inline font-semibold" data-landmark="unassisted-end-diastolic">
            {value(landmarks.unassistedEndDiastolicMmHg)}
          </dd>
        </div>
        <div>
          <dt className="inline">Assisted end-diastolic: </dt>
          <dd className="inline font-semibold" data-landmark="assisted-end-diastolic">
            {value(landmarks.assistedEndDiastolicMmHg)}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {compared
          ? 'Good timing: augmentation above unassisted systole, assisted end-diastolic below unassisted, assisted systole below unassisted.'
          : 'At 1:1 every beat is assisted. Set the ratio to 1:2 to compare an assisted beat with an unassisted one.'}
      </p>
    </section>
  )
}

export function IabpTimingTriggeringPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const timing = iabpTimingView(state)
  // Same fixed pressure domain as every other timing figure, so the panel's strip and Section 3's
  // five demonstrations are drawn against the same pressures (F17).
  const strip = timing ? iabpStripView(state, timing, 3, MCS_IABP_PRESSURE_SCALE) : null
  const alarms = activeAlarms(state)
  const landmarks = measureIabpLandmarkPressures(state.patient, state.device, state.metrics)
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
              aria-label="Electrocardiogram above the arterial pressure trace over the last three beats, with the dicrotic notch, inflation, deflation and the next upstroke marked"
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
                <span className="font-semibold">N — </span>dicrotic notch: aortic-valve closure, and
                the zero point the inflation setting is measured from.
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

        <IabpLandmarkReadout landmarks={landmarks} />

        <FigureCaption>
          Inflation and deflation against the notch and the next upstroke, the beats this ratio
          assists, and the trigger in use.
        </FigureCaption>
      </PanelSection>

      <PanelSection title="Trigger, ratio, and the synchrony reading" id="timing-settings">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
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
            note="A simulator index of how well inflation and deflation line up with the beat."
          />
        </div>

        <ModelBoundary>
          No console reports a timing synchrony percentage. It is this simulator&rsquo;s index of
          how well the two events line up. At the bedside you judge timing from the arterial trace
          at 1:2.
          {state.patient.rhythm === 'atrial-fibrillation' ? (
            <span data-trigger-source-hold>
              {' '}
              In atrial fibrillation this model rates pressure triggering above ECG triggering. The
              supplied Cardiosave material recommends ECG triggering for arrhythmias, warns against
              pressure triggering in a sustained irregular rhythm, and says not to keep internal
              triggering while the heart generates an output. Do not choose a trigger from the
              synchrony figure.
            </span>
          ) : null}
        </ModelBoundary>
        <AlarmBand alarms={alarms} disclosed={disclosed} emptyLabel="No timing alarm is active." />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
      </PanelSection>

      {disclosed ? (
        <PanelSection title="What each mistiming does" id="timing-consequences">
          <div className={styles.scroller}>
            <table className={styles.table} data-timing-consequences>
              <caption className="text-left text-xs leading-5 text-muted-foreground">
                Each of the four timing errors, where it lands in the beat, and what it does to the
                ventricle and the trace.
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
                    it. Afterload rises and the augmented peak is lower.
                  </td>
                </tr>
                <tr data-timing-error="late-inflation">
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    Late inflation
                  </th>
                  <td className="py-1 pr-3 align-top">After the notch, into diastole</td>
                  <td className="py-1 align-top">
                    Part of diastole has already passed. The augmented peak is lower and coronary
                    filling gains less.
                  </td>
                </tr>
                <tr data-timing-error="early-deflation">
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    Early deflation
                  </th>
                  <td className="py-1 pr-3 align-top">Well before the next upstroke</td>
                  <td className="py-1 align-top">
                    Augmentation ends too soon and aortic pressure recovers before the next beat, so
                    much of the fall in end-diastolic pressure is lost.
                  </td>
                </tr>
                <tr data-timing-error="late-deflation">
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    Late deflation
                  </th>
                  <td className="py-1 pr-3 align-top">Into the next upstroke</td>
                  <td className="py-1 align-top">
                    The ventricle ejects against a still-inflated balloon. Assisted end-diastolic
                    pressure is no longer below unassisted. This is the dangerous error: fix it
                    first.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <TextEquivalent>
            Early inflation lands before the notch and the ventricle ejects against the balloon.
            Late inflation lands after the notch and loses part of diastole. Early deflation ends
            augmentation too soon. Late deflation lands in the next upstroke, so the ventricle
            ejects against an inflated balloon; fix it first.
          </TextEquivalent>
          <ol className="mt-3 grid gap-1 text-xs leading-5" data-timing-first-moves>
            <li>Set the ratio to 1:2, so an assisted beat sits beside an unassisted one.</li>
            <li>Fix late deflation first: move deflation to just before the next upstroke.</li>
            <li>Move inflation to the dicrotic notch.</li>
            <li>
              Confirm the three relationships on the five-pressure readout, then return to the
              prescribed ratio.
            </li>
          </ol>
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
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="timing-transfer">
          <TransferState principle="Timing is a relationship between four moments in the beat, and a trigger only helps if the inflation and deflation it produces still land in the right places — beat by beat, in whatever rhythm this patient has.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
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
              emptyLabel="No timing alarm is active."
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
