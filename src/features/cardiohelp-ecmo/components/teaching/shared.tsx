import type { ReactNode } from 'react'

import { DerivedValueReadout } from '@/features/critical-care/components/teaching/EvidenceRenderers'
import type { CriticalCareDerivedValueGuide } from '@/features/critical-care/content/derivedValueGuides'

import type { EcmoChannelReadout, EcmoSimulationState } from '../../engine/types'

/**
 * Primitives shared by the ECMO foundation teaching panels.
 *
 * Every figure here is computed from live state. The rules the panels follow — a text equivalent
 * after each figure, an explicit model boundary where a visual simplifies, and a reference kind
 * beside any interpreted number — are enforced by the shared teaching-panel contract.
 */

export const styles = {
  panel: 'grid gap-4',
  section: 'rounded-2xl border p-4',
  heading: 'text-sm font-semibold uppercase tracking-wide text-muted-foreground',
  figureCaption: 'mt-2 text-xs leading-5 text-muted-foreground',
} as const

export function round(value: number, places = 0): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
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
 * indication with the reason it is unavailable spelled out for a screen reader.
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
  const available = readout.displayed !== null
  return (
    <span
      className="inline-flex flex-col"
      data-channel={label}
      data-readout-status={readout.status}
    >
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold">
        <span aria-hidden="true">
          {available ? `${readout.displayed?.toFixed(precision)} ${unit}` : '--'}
        </span>
        <span className="sr-only">
          {available
            ? `${label} ${readout.displayed?.toFixed(precision)} ${unit}.`
            : `${label} not available. ${readout.reason}`}
        </span>
      </span>
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

/** The support configuration in words, used by several panels' text equivalents. */
export function trackDescription(state: EcmoSimulationState): string {
  return state.supportMode === 'va'
    ? 'venoarterial support, where the circuit returns to the arterial side and runs in parallel with the native heart'
    : 'venovenous support, where the circuit returns to the venous side and runs in series with the native lung'
}
