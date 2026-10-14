'use client'

import { useId, useState } from 'react'
import { RotateCcw } from 'lucide-react'

import {
  OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN,
  OXYGEN_DELIVERY_ARITHMETIC_CLAIMS,
  ecmoOxygenDeliveryFigures,
} from '../../content/oxygenDeliveryArithmetic'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import { styles } from './shared'

/**
 * Move one component of oxygen delivery and watch what happens to the rest.
 *
 * The section this belongs to makes one claim: oxygen delivery is a blood flow carrying an oxygen
 * content, and a reassuring value in one component says nothing about the others. That claim was
 * previously made in prose beside three static bars, and an owner review found the obvious
 * consequence — a learner read the same three bars at four consecutive steps and never saw the claim
 * demonstrated. Reading that saturation is a ratio is not the same as watching the saturation sit at
 * 99 while delivery halves.
 *
 * So the learner drives it. Hemoglobin, arterial saturation and cardiac output each get a control,
 * the two computed figures follow, and the starting values stay on screen to compare against. The
 * three comparisons the section is actually about sit in one menu.
 *
 * A tester review in October 2026 found the surface heavier than its point: a caveat for an opening
 * line, three buttons and a reset in a row, a paragraph restating every number on screen, and a
 * model-boundary disclosure. It now opens on the instruction, offers the comparisons as one menu,
 * states the lesson in a sentence and prints the two equations as equations.
 *
 * What this deliberately does not do, under this module's no-invented-threshold rule: it shows no
 * target delivery, no adequate/inadequate verdict, and no colour-coded zone. It reports what the two
 * equations give for the numbers the learner has set, and nothing about whether that is enough for a
 * patient — which is a bedside judgement this simulation is in no position to make.
 */

interface DeliveryInputs {
  readonly hemoglobin: number
  readonly saturation: number
  readonly cardiacOutput: number
}

interface DeliveryFigures {
  /** mL of oxygen per decilitre of arterial blood. */
  readonly content: number
  /** mL of oxygen reaching the tissues per minute. */
  readonly delivery: number
}

/**
 * The two figures, for the three values the learner has set.
 *
 * The arithmetic itself lives in `content/oxygenDeliveryArithmetic`, which the engine's own oxygen
 * balance also imports, so this surface cannot drift from the model it is teaching. The flow term
 * this explorer passes is the patient's own cardiac output — see the model boundary below.
 */
export function oxygenDeliveryFigures(inputs: DeliveryInputs): DeliveryFigures {
  return ecmoOxygenDeliveryFigures({
    hemoglobin: inputs.hemoglobin,
    saturation: inputs.saturation,
    flowLpm: inputs.cardiacOutput,
  })
}

interface ControlSpec {
  readonly key: keyof DeliveryInputs
  readonly label: string
  readonly unit: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly precision: number
}

/**
 * The ranges the controls span.
 *
 * Authored exploration bounds, not claims. A physiology audit in September 2026 replaced the wider
 * first draft with these, each endpoint anchored on a figure this module already authors somewhere:
 * the hemoglobin span reaches below the lowest value any scenario or item in the module uses; the
 * saturation span is exactly the engine's own clamp domain, so nothing on the scale is a saturation
 * this simulation could not itself produce; the flow span covers every native cardiac output the
 * scenarios author. No endpoint is a target, and no point on any scale is marked.
 */
const CONTROLS: readonly ControlSpec[] = [
  {
    key: 'hemoglobin',
    label: 'Hemoglobin',
    unit: 'g/dL',
    min: 4,
    max: 16,
    step: 0.1,
    precision: 1,
  },
  {
    key: 'saturation',
    label: 'Arterial oxygen saturation',
    // S1-5 (ECMO-FELLOW-02): a saturation carries its unit, as it does on the comparison table.
    unit: '%',
    min: 65,
    max: 100,
    step: 1,
    precision: 0,
  },
  {
    key: 'cardiacOutput',
    label: 'Cardiac output',
    unit: 'L/min',
    min: 1,
    max: 8,
    step: 0.1,
    precision: 1,
  },
]

interface Preset {
  readonly id: string
  readonly label: string
  readonly key: keyof DeliveryInputs
  /** The value this comparison sets. A halving sets the exact half, so delivery halves exactly. */
  readonly target: (opening: DeliveryInputs) => number
}

/**
 * The three comparisons this section exists to make visible.
 *
 * Each one names a change rather than a destination. The first draft moved the saturation to 90,
 * which a physiology audit flagged: 90 is an alarm boundary elsewhere in this repo, so a button that
 * lands exactly on it reads as a threshold this section has not sourced. A relative drop makes the
 * same arithmetic point and asserts nothing.
 *
 * A comparison is offered only when its value is inside the control's range. That draft clamped
 * instead, which on a case opening at a low cardiac output would have *raised* it while the menu said
 * "halve" — a control that contradicts its own label.
 */
const PRESETS: readonly Preset[] = [
  {
    id: 'drop-saturation',
    label: 'Lower the saturation by ten',
    key: 'saturation',
    target: (opening) => opening.saturation - 10,
  },
  {
    id: 'halve-hemoglobin',
    label: 'Halve the hemoglobin',
    key: 'hemoglobin',
    target: (opening) => opening.hemoglobin / 2,
  },
  {
    id: 'halve-cardiac-output',
    label: 'Halve the cardiac output',
    key: 'cardiacOutput',
    target: (opening) => opening.cardiacOutput / 2,
  },
]

const CONTROL_BY_KEY: Readonly<Record<keyof DeliveryInputs, ControlSpec>> = Object.freeze(
  Object.fromEntries(CONTROLS.map((control) => [control.key, control])) as Record<
    keyof DeliveryInputs,
    ControlSpec
  >,
)

interface ResolvedPreset {
  readonly preset: Preset
  readonly inputs: DeliveryInputs
  readonly reachable: boolean
}

/** What a comparison would set, and whether the control it moves can go there. */
function resolvePreset(preset: Preset, opening: DeliveryInputs): ResolvedPreset {
  const control = CONTROL_BY_KEY[preset.key]
  const target = preset.target(opening)
  return {
    preset,
    inputs: { ...opening, [preset.key]: target },
    reachable: target >= control.min && target <= control.max,
  }
}

function format(value: number, precision: number): string {
  return value.toFixed(precision)
}

/**
 * A control's value as the learner reads it.
 *
 * A halving can land between two steps of the slider — half of 4.5 L/min is 2.25. The readout then
 * carries the extra digit, so the number on screen is the number the two figures were computed from
 * and "halve" means exactly half (S1-5).
 */
function formatInput(value: number, control: ControlSpec): string {
  const scale = 10 ** control.precision
  const onStep = Math.abs(value * scale - Math.round(value * scale)) < 1e-6
  const text = format(value, onStep ? control.precision : control.precision + 1)
  return control.unit ? `${text} ${control.unit}` : text
}

/** How a figure stands against its starting value, in one short line. */
function againstStart(now: number, start: number, precision: number, unit: string): string {
  if (format(now, precision) === format(start, precision)) return 'Starting value.'
  return `${format((now / start) * 100, 0)}% of the starting ${format(start, precision)} ${unit}.`
}

export function OxygenDeliveryExplorer({
  state,
  sourceIds,
}: {
  readonly state: EcmoSimulationState
  readonly sourceIds: readonly string[]
}) {
  const comparisonId = useId()
  const arterialSaturation =
    state.supportMode === 'va' ? state.patient.femoralArterialSpo2 : state.patient.spo2
  // The values the lesson opened on, kept for comparison and for the reset.
  const opening: DeliveryInputs = {
    hemoglobin: Math.round(state.circuit.hemoglobin * 10) / 10,
    saturation: Math.round(arterialSaturation),
    cardiacOutput: Math.round(state.patient.nativeCardiacOutputLpm * 10) / 10,
  }
  const [inputs, setInputs] = useState<DeliveryInputs>(opening)
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null)

  const now = oxygenDeliveryFigures(inputs)
  const base = oxygenDeliveryFigures(opening)
  const comparisons = PRESETS.map((preset) => resolvePreset(preset, opening)).filter(
    (resolved) => resolved.reachable,
  )
  const changed =
    inputs.hemoglobin !== opening.hemoglobin ||
    inputs.saturation !== opening.saturation ||
    inputs.cardiacOutput !== opening.cardiacOutput

  function set(key: keyof DeliveryInputs, value: number) {
    setAppliedPresetId(null)
    setInputs((current) => ({ ...current, [key]: value }))
  }

  function reset() {
    setAppliedPresetId(null)
    setInputs(opening)
  }

  function applyComparison(id: string) {
    const resolved = comparisons.find((candidate) => candidate.preset.id === id)
    if (!resolved) {
      reset()
      return
    }
    setInputs(resolved.inputs)
    setAppliedPresetId(id)
  }

  return (
    <section
      className={styles.section}
      aria-labelledby="oxygen-delivery-explorer-heading"
      data-oxygen-delivery-explorer
    >
      <h3 id="oxygen-delivery-explorer-heading" className={styles.heading}>
        Move one component and watch the rest
      </h3>
      <p className="mt-2 text-sm leading-6">
        Move one slider, or pick a comparison. Oxygen content and oxygen delivery follow.
      </p>

      <div className="mt-3 grid gap-3">
        {CONTROLS.map((control) => {
          const value = inputs[control.key]
          const controlId = `oxygen-delivery-${control.key}`
          return (
            <div key={control.key} className="grid gap-1" data-delivery-control={control.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={controlId} className="text-sm font-semibold">
                  {control.label}
                </label>
                <span className="text-sm tabular-nums">{formatInput(value, control)}</span>
              </div>
              <input
                id={controlId}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                aria-valuetext={formatInput(value, control)}
                onChange={(event) => set(control.key, Number(event.target.value))}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Starting value {formatInput(opening[control.key], control)}.
              </p>
            </div>
          )
        })}
      </div>

      {/*
        One menu, not a row of buttons. The three comparisons and the reset sat side by side under
        the figures, and a tester asked for a single dropdown so the surface reads as one control.
        A comparison this patient's values cannot reach is left out, and the reset appears only once
        something has moved, so nothing here is drawn disabled.
      */}
      <div className="mt-4 flex flex-wrap items-center gap-2" data-delivery-comparisons>
        <label htmlFor={comparisonId} className="text-sm font-semibold">
          Try a comparison
        </label>
        <select
          id={comparisonId}
          // A percentage width, capped: left to size itself a select is as wide as its longest
          // option and will not shrink, which at a 320 px phone width pushed the page one pixel
          // sideways. A `max-width` alone does not change that; a percentage `width` does.
          className="min-h-9 w-full max-w-[17rem] rounded-lg border bg-transparent px-2 text-sm"
          value={appliedPresetId ?? ''}
          onChange={(event) => applyComparison(event.target.value)}
        >
          <option value="">Choose a change…</option>
          {comparisons.map(({ preset }) => (
            <option key={preset.id} value={preset.id} data-delivery-preset={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        {changed ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold"
            data-delivery-reset
            onClick={reset}
          >
            <RotateCcw aria-hidden="true" className="size-3" /> Reset
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" data-delivery-figures aria-live="polite">
        <div className="rounded-xl border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Oxygen content</p>
          <p className="text-xl font-semibold tabular-nums" data-delivery-content>
            {format(now.content, 1)} mL/dL
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {againstStart(now.content, base.content, 1, 'mL/dL')}
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Oxygen delivery</p>
          <p className="text-xl font-semibold tabular-nums" data-delivery-total>
            {format(now.delivery, 0)} mL/min
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {againstStart(now.delivery, base.delivery, 0, 'mL/min')}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium leading-6" data-delivery-takeaway>
        Taking ten off the saturation lowers delivery by about a tenth. Halving the hemoglobin or
        the cardiac output halves it.
      </p>

      <p className="mt-2 text-sm leading-6" data-delivery-equations>
        Oxygen content (mL/dL) = {OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN} × hemoglobin (g/dL) ×
        saturation. Oxygen delivery (mL/min) = oxygen content × cardiac output (L/min) × 10.
        Dissolved oxygen adds little and is left out. Neither figure says anything on its own about
        whether a given patient is getting enough.
        {state.supportMode === 'va'
          ? ' The flow here is the native cardiac output alone; on VA ECMO the circuit’s return adds to it.'
          : ''}
      </p>

      <div className="mt-3">
        <EcmoSourceList
          compact
          evidenceIds={sourceIds}
          claims={OXYGEN_DELIVERY_ARITHMETIC_CLAIMS}
          title="Sources"
          headingLevel={4}
        />
      </div>
    </section>
  )
}
