'use client'

/**
 * Primitives shared by every Mechanical Ventilation teaching panel.
 *
 * The panels occupy the middle pane of the three-pane workspace. Every figure is computed from
 * live simulation state rather than drawn as static art, carries a computed `aria-label`, and is
 * followed by a text equivalent.
 *
 * A panel that shows a live value also shows the number a fellow compares it with, through
 * `ReferenceValues`. Those numbers come from the module's register, each with its source.
 */
import { ventilationEvidenceById } from '../../content/evidence'
import {
  PEEP_FIO2_HIGHER_PEEP,
  PEEP_FIO2_LOWER_PEEP,
  VENTILATION_NUMBERS,
  type PeepFio2Step,
  type VentilationNumberId,
} from '../../content/teachingNumbers'
import type { WaveformSample } from '../../engine'
import styles from '../mechanical-ventilation-teaching.module.css'

export { styles }

export const EMPTY_STATE_NOTE =
  'Waveform data appears once the simulation has produced a breath. Advance the case to populate this figure.'

export function round(value: number, places = 0): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * The trend samples a panel's arrows compare — the last `span` one-second samples — with the
 * simulated times they cover, so a panel can say which window "rising" or "holding steady" is
 * about. Two surfaces that disagreed about the same patient (Section 9's live panel said
 * "holding steady" while the worked comparison said saturation rises while waiting) were reading
 * different windows without saying so.
 */
export function trendWindow<T extends { readonly time: number }>(
  trends: readonly T[],
  span = 30,
): { readonly samples: readonly T[]; readonly fromSeconds: number; readonly toSeconds: number } {
  const samples = trends.slice(-Math.min(trends.length, span))
  return {
    samples,
    fromSeconds: samples[0]?.time ?? 0,
    toSeconds: samples.at(-1)?.time ?? 0,
  }
}

/** "From 12 to 41 s", for the window a trend arrow compares. */
export function trendWindowLabel(window: { fromSeconds: number; toSeconds: number }): string {
  return `from ${window.fromSeconds.toFixed(0)} to ${window.toSeconds.toFixed(0)} s`
}

/** "Higher", "lower", or "unchanged" without committing to a threshold for how much counts. */
export function direction(delta: number, deadband: number): 'up' | 'down' | 'flat' {
  if (delta > deadband) return 'up'
  if (delta < -deadband) return 'down'
  return 'flat'
}

export const directionGlyph: Readonly<Record<'up' | 'down' | 'flat', string>> = {
  up: '▲',
  down: '▼',
  flat: '—',
}

export const directionWord: Readonly<Record<'up' | 'down' | 'flat', string>> = {
  up: 'rising',
  down: 'falling',
  flat: 'holding steady',
}

/**
 * The most recent *complete* breath cycle: from one inspiration onset to the next.
 *
 * Slicing by phase from the tail instead truncates whichever phase is in progress, which drew a
 * pressure trace that stepped down and flattened rather than showing a breath. Cutting between
 * successive inspiration onsets also keeps a double-triggered pair together in one window, which
 * is what the dyssynchrony cases need to be legible.
 */
export function latestBreath(samples: readonly WaveformSample[]): readonly WaveformSample[] {
  if (samples.length < 4) return []
  const onsets: number[] = []
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].phase === 'inspiration' && samples[index - 1].phase === 'expiration') {
      onsets.push(index)
    }
  }
  if (onsets.length >= 2) {
    const start = onsets[onsets.length - 2]
    const end = onsets[onsets.length - 1]
    if (end - start >= 4) return samples.slice(start, end)
  }
  // No two onsets in the window yet: fall back to the most recent second or so of samples.
  return samples.slice(-Math.min(samples.length, 80))
}

export function tracePath(
  samples: readonly WaveformSample[],
  field: 'pawCmH2O' | 'flowLMin' | 'volumeMl' | 'pmusCmH2O',
  minimum: number,
  maximum: number,
  width = 300,
  height = 78,
): string {
  if (samples.length === 0) return ''
  const firstTime = samples[0].time
  const duration = Math.max(0.02, samples[samples.length - 1].time - firstTime)
  return samples
    .map((sample, index) => {
      const x = ((sample.time - firstTime) / duration) * width
      const normalized = Math.max(0, Math.min(1, (sample[field] - minimum) / (maximum - minimum)))
      const y = height - normalized * (height - 6) - 3
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

/** Fraction of the way through the sample window, 0 to 1, for placing a marker on a trace. */
export function fractionAt(samples: readonly WaveformSample[], index: number): number {
  if (samples.length < 2) return 0
  const first = samples[0].time
  const duration = Math.max(0.02, samples[samples.length - 1].time - first)
  return Math.max(0, Math.min(1, (samples[index].time - first) / duration))
}

export function TextEquivalent({ children }: { readonly children: string }) {
  return (
    <p className={styles.textEquivalent}>
      <strong>Visual text equivalent:</strong> {children}
    </p>
  )
}

/** A model note, used only where a simulated value could be taken for a measured one. */
export function ModelBoundary({ children }: { readonly children: string }) {
  return <p className={styles.boundary}>{children}</p>
}

/** "ARDS Network 2000", from the registered source a row cites. */
function shortSource(sourceId: string, year: number): string {
  const names: Readonly<Record<string, string>> = {
    'ardsnet-arma-2000': 'ARDS Network',
    'ardsnet-alveoli-2004': 'ARDS Network ALVEOLI',
    'ats-esicm-sccm-ards-2017': 'ATS/ESICM/SCCM',
    'amato-driving-pressure-2015': 'Amato',
    'tobin-3e-severe-asthma': 'Leatherman, in Tobin',
  }
  const name = names[sourceId] ?? ventilationEvidenceById.get(sourceId)?.title ?? sourceId
  return `${name} ${year}`
}

/**
 * The numbers a fellow holds a live reading against, each with where it comes from.
 *
 * `title` says which patient the numbers are for, because a plateau limit written for ARDS is not
 * a setting for every ventilated patient.
 */
export function ReferenceValues({
  title,
  ids,
  children,
}: {
  readonly title: string
  readonly ids: readonly VentilationNumberId[]
  readonly children?: React.ReactNode
}) {
  return (
    <section className={styles.referenceValues} data-reference-values>
      <h4>{title}</h4>
      <dl>
        {ids.map((id) => {
          const row = VENTILATION_NUMBERS.get(id)
          return (
            <div key={id} data-teaching-number={id}>
              <dt>{row.label}</dt>
              <dd>
                <strong>{row.value}</strong>
                <small>
                  {row.sources
                    .map((source) => shortSource(source.sourceId, source.year))
                    .join('; ')}
                </small>
              </dd>
            </div>
          )
        })}
      </dl>
      {children}
    </section>
  )
}

function PeepFio2Rows({
  caption,
  steps,
}: {
  readonly caption: string
  readonly steps: readonly PeepFio2Step[]
}) {
  return (
    <table className={styles.peepTable}>
      <caption>{caption}</caption>
      <tbody>
        <tr>
          <th scope="row">FiO₂</th>
          {steps.map((step, index) => (
            <td key={index}>{step.fio2}</td>
          ))}
        </tr>
        <tr>
          <th scope="row">PEEP</th>
          {steps.map((step, index) => (
            <td key={index}>{step.peep}</td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

/** The two ARDS Network tables. Read left to right as oxygenation worsens. */
export function PeepFio2Tables() {
  return (
    <details className={styles.peepTables} data-peep-fio2-tables>
      <summary>PEEP and FiO₂ tables (ARDS Network)</summary>
      <p>
        Move one step right when oxygenation is under goal and one step left when it is over. Most
        units start on the lower PEEP table; the higher PEEP table is an option in moderate to
        severe ARDS. The trial comparing them found no difference in mortality.
      </p>
      <div className={styles.peepTableScroll}>
        <PeepFio2Rows caption="Lower PEEP, higher FiO₂" steps={PEEP_FIO2_LOWER_PEEP} />
        <PeepFio2Rows caption="Higher PEEP, lower FiO₂" steps={PEEP_FIO2_HIGHER_PEEP} />
      </div>
    </details>
  )
}

/** The empty state every panel shows before the simulation has produced a readable breath. */
export function AwaitingBreath({ label }: { readonly label: string }) {
  return (
    <div className={styles.stepDetail}>
      <span>{label}</span>
      <p>{EMPTY_STATE_NOTE}</p>
    </div>
  )
}
