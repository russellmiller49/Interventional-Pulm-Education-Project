import type { ReactNode } from 'react'

import { DerivedValueReadout } from '@/features/critical-care/components/teaching/EvidenceRenderers'
import type { CriticalCareDerivedValueGuide } from '@/features/critical-care/content/derivedValueGuides'

import type { EcmoChannelReadout, EcmoSimulationState } from '../../engine/types'
import { UNAVAILABLE_INDICATION, formatChannelReadout } from '../channelReadout'

/**
 * Primitives shared by the ECMO foundation teaching panels.
 *
 * Every figure here is computed from live state. The rules the panels follow — a text equivalent
 * after each figure, an explicit model boundary where a visual simplifies, and a reference kind
 * beside any interpreted number — are enforced by the shared teaching-panel contract.
 */

export const styles = {
  panel: 'grid gap-4',
  /**
   * `min-w-0` is load-bearing: these sections are grid items, and a grid item defaults to
   * `min-width: auto`, so a wide child — the capstone's hypothesis matrix — would stretch the whole
   * pane instead of scrolling inside its own `overflow-x-auto` wrapper.
   */
  section: 'min-w-0 rounded-2xl border p-4',
  heading: 'text-sm font-semibold uppercase tracking-wide text-muted-foreground',
  figureCaption: 'mt-2 text-xs leading-5 text-muted-foreground',
} as const

export function round(value: number, places = 0): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

/**
 * A retained trend value in a table cell.
 *
 * A frame recorded while the circuit was not flowing carries `null` rather than the pressure
 * equations' zero-flow intercept, so the cell shows the same unavailable indication the console
 * shows rather than a number the model never stood behind.
 */
export function trendCell(value: number | null, precision = 0): string {
  return value === null ? UNAVAILABLE_INDICATION : value.toFixed(precision)
}

/** The same value in prose, for a text equivalent. */
export function trendPhrase(value: number | null, precision = 0): string {
  return value === null ? 'not reported' : value.toFixed(precision)
}

/** Direction of a change, with a deadband so noise does not read as movement. */
export function direction(delta: number, deadband: number): 'up' | 'down' | 'flat' {
  if (delta > deadband) return 'up'
  if (delta < -deadband) return 'down'
  return 'flat'
}

export const directionWord: Readonly<Record<'up' | 'down' | 'flat', string>> = {
  up: 'higher',
  down: 'lower',
  flat: 'about the same',
}

/** The textual equivalent of a figure. Never decorative — it carries the same numbers. */
export function TextEquivalent({ children }: { readonly children: ReactNode }) {
  return (
    <p className="mt-2 text-xs leading-5 text-muted-foreground" data-text-equivalent>
      {children}
    </p>
  )
}

/** What this visual simplifies, stated where the learner can read it. */
export function ModelBoundary({ children }: { readonly children: ReactNode }) {
  return (
    <p
      className="mt-3 rounded-xl border border-dashed px-3 py-2 text-xs leading-5"
      data-model-boundary
    >
      <span className="font-semibold">Model boundary. </span>
      {children}
    </p>
  )
}

/**
 * Working that a learner may open, behind the warning about what it must not be used for.
 *
 * Some of this module's arithmetic is genuinely useful to see and genuinely dangerous to carry to a
 * bedside — the recirculation algebra most of all, because it looks like a formula for estimating
 * recirculation from two saturations and is not one. Presenting the caution first and the algebra
 * behind a disclosure means the learner meets the limit before the method, rather than reading the
 * warning after they have already memorised the equation.
 *
 * Plain `<details>` rather than a new widget: it is keyboard-operable, announced as a disclosure by
 * screen readers, and searchable in most browsers without any script.
 */
export function DisclosedWorking({
  summary,
  caution,
  children,
}: {
  readonly summary: string
  readonly caution: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div className="mt-3" data-disclosed-working>
      <p className="text-xs font-semibold leading-5" data-do-not-infer-lead>
        {caution}
      </p>
      <details className="mt-2 rounded-xl border border-dashed px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold">{summary}</summary>
        <div className="mt-2">{children}</div>
      </details>
    </div>
  )
}

/** Rendered while the reference circuit has not yet produced a reading. */
export function AwaitingCircuit({ label }: { readonly label: string }) {
  return (
    <p className="text-sm text-muted-foreground" role="status">
      Waiting for the {label} to report.
    </p>
  )
}

/**
 * A readout rendered the way the console must render it: the number, or the unavailable
 * indication with the reason it is unavailable.
 *
 * The reason is visible, not only spoken. A bare `--` tells a sighted learner that something is
 * missing but not whether the device would have nothing to show or whether this simulation simply
 * does not model it — two different claims, and the distinction is the teaching point.
 */
export function ChannelValue({
  label,
  readout,
  unit,
  precision = 0,
}: {
  readonly label: string
  readonly readout: EcmoChannelReadout
  readonly unit: string
  readonly precision?: number
}) {
  const formatted = formatChannelReadout(label, readout, unit, precision)
  return (
    <span
      className="inline-flex flex-col"
      data-channel={label}
      data-readout-status={readout.status}
    >
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold">
        <span aria-hidden="true">{formatted.displayText}</span>
        <span className="sr-only">{formatted.screenReaderText}</span>
      </span>
      {formatted.available ? null : (
        <span
          className="mt-1 max-w-[22rem] text-xs leading-5 text-muted-foreground"
          aria-hidden="true"
        >
          {readout.reason}
        </span>
      )}
    </span>
  )
}

/** A live value beside its authored guide, for anything that carries an interpretation. */
export function GuidedValue({
  guide,
  value,
  headingLevel = 4,
}: {
  readonly guide: CriticalCareDerivedValueGuide
  readonly value: number | null
  readonly headingLevel?: 2 | 3 | 4 | 5
}) {
  return <DerivedValueReadout guide={guide} value={value} headingLevel={headingLevel} />
}

/**
 * The VA topology this simulation actually models, named wherever VA teaching appears.
 *
 * "VA ECMO" is not one flow topology. Where the arterial return enters decides which way circuit
 * blood travels in the aorta, where it meets native ejection, and therefore which beds each side
 * supplies. A schematic labelled only "VA" invites a learner to carry conclusions drawn here into
 * configurations whose flow runs the other way, so the configuration is stated rather than implied.
 */
export const VA_MODELED_CONFIGURATION =
  'peripheral femoral V-A ECMO with retrograde arterial return'

export const VA_CONFIGURATION_BOUNDARY =
  'This live simulation models peripheral femoral V-A ECMO with retrograde arterial return. V-AV, upper-body arterial return, and central V-A ECMO change the flow topology and are described but not simulated here.'

/** The configuration badge. Rendered at the top of every VA panel, not only in a boundary note. */
export function VaConfigurationLabel() {
  return (
    <p
      className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
      data-va-configuration={VA_MODELED_CONFIGURATION}
    >
      Modeled configuration: {VA_MODELED_CONFIGURATION}
    </p>
  )
}

/** The support configuration in words, used by several panels' text equivalents. */
export function trackDescription(state: EcmoSimulationState): string {
  return state.supportMode === 'va'
    ? 'venoarterial support, where the circuit returns to the arterial side and runs in parallel with the native heart'
    : 'venovenous support, where the circuit returns to the venous side and runs in series with the native lung'
}
