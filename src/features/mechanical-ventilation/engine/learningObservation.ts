import type { LabSession } from './learningLab'

export function observationFor(session: LabSession) {
  const evidence = session.evidence[session.round]
  const before = evidence.baseline,
    after = evidence.response
  if (session.unitId === 'breathing-with-support') {
    const sample = evidence.inspection?.sample ?? after?.waveforms.at(-1)
    const previous = evidence.inspection?.previous ?? after?.waveforms.at(-2)
    const correct =
      sample && previous && sample.flowLMin > 0.1 && sample.volumeMl > previous.volumeMl
        ? 'inward-rising'
        : sample && previous && sample.flowLMin < -0.1 && sample.volumeMl < previous.volumeMl
          ? 'outward-falling'
          : 'indeterminate'
    return {
      prompt: 'Which flow–volume relationship is supported by your captured interval?',
      choices: [
        { id: 'inward-rising', label: 'Inward flow with rising volume' },
        { id: 'outward-falling', label: 'Outward flow with falling volume' },
        { id: 'indeterminate', label: 'This interval does not distinguish those relationships' },
      ],
      correct,
      feedback:
        sample && previous
          ? `Captured flow ${sample.flowLMin.toFixed(1)} L/min; volume ${previous.volumeMl.toFixed(0)} → ${sample.volumeMl.toFixed(0)} mL. ${correct === 'inward-rising' ? 'Gas is entering during inspiration.' : correct === 'outward-falling' ? 'Gas is leaving during expiration.' : 'Inspect a longer interval away from a phase boundary.'}`
          : 'No captured interval is available.',
    }
  }
  const metric =
    session.unitId === 'waveform-anatomy'
      ? 'ti'
      : session.unitId === 'mechanics-load-and-pressure'
        ? 'plateau'
        : session.unitId === 'modes-and-breath-delivery' && session.round === 0
          ? 'peak'
          : 'volume'
  const gap = session.unitId === 'mechanics-load-and-pressure' && session.round === 0
  const b = before
    ? gap
      ? before.values.peak - before.values.plateau
      : before.values[metric]
    : NaN
  const a = after ? (gap ? after.values.peak - after.values.plateau : after.values[metric]) : NaN
  const label = gap
    ? 'peak-to-plateau difference'
    : {
        ti: 'inspiratory time',
        plateau: 'plateau pressure',
        peak: 'peak pressure',
        volume: 'exhaled tidal volume',
      }[metric]
  const units = metric === 'ti' ? 's' : metric === 'volume' ? 'mL' : 'cmH₂O'
  const digits = metric === 'ti' ? 2 : metric === 'volume' ? 0 : 1
  // Compare exactly the precision displayed, not an invented clinical-significance threshold.
  const delta = Number(a.toFixed(digits)) - Number(b.toFixed(digits))
  const limited =
    (after?.issues?.length ?? 0) > 0 ||
    !Number.isFinite(delta) ||
    (session.unitId === 'mechanics-load-and-pressure' &&
      (!after?.plateauValid || after.plateauSource !== 'captured'))
  const correct = limited ? 'indeterminate' : delta > 0 ? 'rose' : delta < 0 ? 'fell' : 'similar'
  return {
    prompt: `Compared with the captured baseline, what happened to ${label} in this controlled experiment?`,
    choices: [
      { id: 'rose', label: 'Rose' },
      { id: 'fell', label: 'Fell' },
      { id: 'similar', label: 'Stayed similar at the displayed precision' },
      {
        id: 'indeterminate',
        label: 'The run does not support attributing a change to this input alone',
      },
    ],
    correct,
    feedback: `Recorded ${label}: ${b.toFixed(digits)} → ${a.toFixed(digits)} ${units}. ${limited ? 'This run cannot isolate the requested mechanism. Review the measurement status and additional changes; repeat from the baseline.' : delta === 0 ? 'An unchanged result is informative; the displayed precision does not distinguish a change.' : `The recorded value ${delta > 0 ? 'rose' : 'fell'}. This is the result of this run, separate from the intended prediction.`}${session.unitId === 'mechanics-load-and-pressure' ? ' The baseline plateau is a modeled reference; the result plateau comes from your current passive hold.' : ''}`,
  }
}
