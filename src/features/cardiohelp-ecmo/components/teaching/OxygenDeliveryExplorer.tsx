'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

import {
  OXYGEN_BINDING_CONSTANT_QUALIFIER,
  OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN,
  OXYGEN_DELIVERY_ARITHMETIC_CLAIMS,
  ecmoOxygenDeliveryFigures,
} from '../../content/oxygenDeliveryArithmetic'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import { ModelBoundary, TextEquivalent, styles } from './shared'

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
 * the two computed figures follow, and the patient's own opening values stay on screen to compare
 * against. The three presets are the comparisons the section is actually about, one tap each.
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
    unit: '',
    min: 65,
    max: 100,
    step: 1,
    precision: 0,
  },
  {
    key: 'cardiacOutput',
    label: 'Cardiac output, the patient’s own',
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
  /** The value this comparison needs, before the control's own range is consulted. */
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
 * A preset is offered only when its value is inside the control's range. That draft clamped instead,
 * which on a case opening at a low cardiac output would have *raised* it while the button said
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
    target: (opening) => Math.round(opening.hemoglobin * 5) / 10,
  },
  {
    id: 'halve-cardiac-output',
    label: 'Halve the cardiac output',
    key: 'cardiacOutput',
    target: (opening) => Math.round(opening.cardiacOutput * 5) / 10,
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

/** What a preset would set, and whether the control it moves can go there. */
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

/** "higher than", "lower than", or "the same as" — with a deadband so rounding noise is not movement. */
function comparison(now: number, opening: number, deadband: number): string {
  const delta = now - opening
  if (delta > deadband) return 'higher than'
  if (delta < -deadband) return 'lower than'
  return 'the same as'
}

export function OxygenDeliveryExplorer({
  state,
  sourceIds,
}: {
  readonly state: EcmoSimulationState
  readonly sourceIds: readonly string[]
}) {
  const arterialSaturation =
    state.supportMode === 'va' ? state.patient.femoralArterialSpo2 : state.patient.spo2
  // The patient the lesson opened on, kept for comparison and for the reset.
  const opening: DeliveryInputs = {
    hemoglobin: Math.round(state.circuit.hemoglobin * 10) / 10,
    saturation: Math.round(arterialSaturation),
    cardiacOutput: Math.round(state.patient.nativeCardiacOutputLpm * 10) / 10,
  }
  const [inputs, setInputs] = useState<DeliveryInputs>(opening)
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null)

  const now = oxygenDeliveryFigures(inputs)
  const base = oxygenDeliveryFigures(opening)
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
        These start at this patient&rsquo;s own values. Change any one of them and the two figures
        below follow.
      </p>

      <div className="mt-3 grid gap-3">
        {CONTROLS.map((control) => {
          const value = inputs[control.key]
          const openingValue = opening[control.key]
          const controlId = `oxygen-delivery-${control.key}`
          return (
            <div key={control.key} className="grid gap-1" data-delivery-control={control.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={controlId} className="text-sm font-semibold">
                  {control.label}
                </label>
                <span className="text-sm tabular-nums">
                  {format(value, control.precision)}
                  {control.unit ? ` ${control.unit}` : ''}
                </span>
              </div>
              <input
                id={controlId}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                aria-valuetext={`${format(value, control.precision)}${control.unit ? ` ${control.unit}` : ''}`}
                onChange={(event) => set(control.key, Number(event.target.value))}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                This patient opened at {format(openingValue, control.precision)}
                {control.unit ? ` ${control.unit}` : ''}.
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2" data-delivery-figures>
        <div className="rounded-xl border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Oxygen content, per decilitre
          </p>
          <p className="text-xl font-semibold tabular-nums" data-delivery-content>
            {format(now.content, 1)} mL/dL
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {comparison(now.content, base.content, 0.05)} the {format(base.content, 1)} mL/dL this
            patient opened with.
          </p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Oxygen delivery, per minute
          </p>
          <p className="text-xl font-semibold tabular-nums" data-delivery-total>
            {format(now.delivery, 0)} mL/min
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {comparison(now.delivery, base.delivery, 5)} the {format(base.delivery, 0)} mL/min this
            patient opened with.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Comparisons to try">
        {PRESETS.map((preset) => {
          const resolved = resolvePreset(preset, opening)
          return (
            <button
              key={preset.id}
              type="button"
              className="inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-semibold"
              data-delivery-preset={preset.id}
              data-delivery-preset-reachable={resolved.reachable ? 'true' : 'false'}
              aria-pressed={appliedPresetId === preset.id}
              disabled={!resolved.reachable}
              title={
                resolved.reachable
                  ? undefined
                  : 'From this patient’s opening value, that change falls outside the range these controls span. Move the control by hand instead.'
              }
              onClick={() => {
                setInputs(resolved.inputs)
                setAppliedPresetId(preset.id)
              }}
            >
              {preset.label}
            </button>
          )
        })}
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-semibold"
          data-delivery-reset
          disabled={!changed}
          onClick={reset}
        >
          <RotateCcw aria-hidden="true" className="size-3" /> Back to this patient
        </button>
      </div>

      <p className="mt-3 text-sm leading-6" data-delivery-equations>
        Oxygen content is the hemoglobin multiplied by how much of it is carrying oxygen, at{' '}
        {OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN} mL of oxygen per gram of fully saturated hemoglobin.
        Oxygen delivery is that content multiplied by the blood flow carrying it, and the ten in
        that product only converts decilitres to litres. Neither figure says anything on its own
        about whether a given patient is getting enough.
      </p>

      <TextEquivalent>
        With a hemoglobin of {format(inputs.hemoglobin, 1)} g/dL, an arterial saturation of{' '}
        {format(inputs.saturation, 0)} and a cardiac output of {format(inputs.cardiacOutput, 1)}{' '}
        L/min, each decilitre of arterial blood carries {format(now.content, 1)} mL of oxygen and{' '}
        {format(now.delivery, 0)} mL of oxygen reaches the tissues each minute. This patient opened
        with {format(opening.hemoglobin, 1)} g/dL, a saturation of {format(opening.saturation, 0)}{' '}
        and {format(opening.cardiacOutput, 1)} L/min, giving {format(base.content, 1)} mL/dL and{' '}
        {format(base.delivery, 0)} mL/min. In this arithmetic the saturation enters as a fraction,
        so taking ten off it near the top of the scale moves delivery by about a tenth, while
        hemoglobin and flow each enter as themselves — halve either one and delivery halves with it.
      </TextEquivalent>

      <ModelBoundary>
        Both figures are arithmetic on the three numbers you set, and three things about them are
        worth knowing. {OXYGEN_BINDING_CONSTANT_QUALIFIER} The small amount of oxygen dissolved in
        plasma rather than bound to hemoglobin is left out, so the content figure is the bound
        oxygen alone, exactly as this module&rsquo;s own simulation computes it. And the flow here
        is the patient&rsquo;s own cardiac output: on arterial support the circuit returns blood to
        the artery as well, and this explorer does not add the two together into a single systemic
        flow. No target delivery is shown, because what is enough depends on what the tissues are
        asking for and on the patient in front of you, neither of which is on these controls.
      </ModelBoundary>

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
