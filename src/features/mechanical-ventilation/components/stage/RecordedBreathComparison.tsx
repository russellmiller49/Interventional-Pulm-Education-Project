import type { LabEvidence } from '../../engine/learningLab'
import { anchorBreathVolume, completedBreath, waveformAxes } from '../../engine/teachingBreath'
import { CapturedBreath } from './CapturedBreath'
import styles from './task-flow.module.css'

export function RecordedBreathComparison({
  evidence,
  effort = false,
}: {
  evidence: LabEvidence
  effort?: boolean
}) {
  const before = evidence.baseline,
    after = evidence.response
  if (!before || !after) return null
  /*
   * The shared scale is built from what the two figures actually draw. Both re-anchor volume to
   * their own breath start, so an axis taken from the raw samples would leave the comparison
   * squeezed into the top of a range set by retained gas neither trace shows.
   */
  const axes = waveformAxes(
    [before, after].flatMap((record) => [...anchorBreathVolume(completedBreath(record.waveforms))]),
  )
  const duration = Math.max(
    ...[before, after].map((record) => {
      const breath = completedBreath(record.waveforms)
      return breath.length ? breath.at(-1)!.time - breath[0].time : 0
    }),
  )
  return (
    <section data-recorded-breath-comparison>
      <h3>Retained baseline and result</h3>
      {before.inputs?.mode === 'volume-ac' ? (
        <p className={styles.note}>
          Selected VT: {before.inputs.vtMl} → {after.inputs?.vtMl ?? 'not recorded'} mL ·
          inspiratory flow: {before.inputs.peakFlowLMin} →{' '}
          {after.inputs?.peakFlowLMin ?? 'not recorded'} L/min. These are selected inputs; delivery
          is recorded separately.
        </p>
      ) : null}
      <div className={styles.comparison}>
        <CapturedBreath
          label="Captured baseline"
          samples={before.waveforms}
          axes={axes}
          durationSeconds={duration}
          effort={effort}
        />
        <CapturedBreath
          label="Captured result"
          samples={after.waveforms}
          axes={axes}
          durationSeconds={duration}
          effort={effort}
        />
      </div>
    </section>
  )
}
