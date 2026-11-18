import type { ReactNode } from 'react'
import {
  MODEL_GEOMETRY,
  MODEL_STEPS,
  NEEDLE_LAB,
  type ModelAction,
  type NeedleState,
} from '../../../../../../src/lib/ebus-model-contract'
import type { NeedleHandlePart } from './NeedleHandleView'

/*
 * The needle lab's steps and the controls that do them, as one list (rebuild of 2026-11-11).
 *
 * Each control is named after the part of the handle it moves, and sits under the step it belongs
 * to, so there is one instruction and one place to act. Every control stays live: a movement the
 * model does not allow is answered with the reason, not with a greyed-out control. The list
 * replaces ten event buttons ("Introduce resistance", "Change imaging plane") that happened to the
 * learner; here the learner's own hand makes each change.
 *
 * Owner ruling `ebus-needle-lab-model` (2026-11-14): the six steps stand. The stop tolerance and
 * the number of movements are said to belong to this exercise, the lost tip is said to be
 * something this lab makes happen so that it can be recognised, and the needle is advanced only
 * with its tip in view. The stylet is not modelled; the lesson says so.
 */
type StepId = (typeof MODEL_STEPS.needle)[number]
const STEP_TEXT: Record<StepId, { title: string; how: string }> = {
  sheath: {
    title: 'Bring the sheath out and lock it',
    how: 'Move the sheath adjuster until the end of the sheath is seen beyond the scope tip, then lock it. The needle never leaves a sheath that is still inside the working channel.',
  },
  stop: {
    title: 'Set the needle stop',
    how: `The stop is a depth limit set from the size of the node and from what lies beyond it: here, a vessel. On the ultrasound picture, read the depth along the needle path to the far side of the node and set the stop to it. This lab accepts a stop up to ${NEEDLE_LAB.stopShortMm} mm short of the far side. That tolerance belongs to this drawn node; it is not a clinical threshold.`,
  },
  'in-node': {
    title: 'Advance the needle into the node',
    how: 'Move the needle slider and watch the tip cross the airway wall and enter the node on the ultrasound picture. Advance only while you can see the tip.',
  },
  'tip-recovered': {
    title: 'Lose the tip, then bring it back',
    how: 'With the tip in the node, turn the scope until the tip leaves the image, so that you see what a lost tip looks like. On a patient this happens without your meaning it to. Hold the needle still and turn back until the tip returns before you move the needle again.',
  },
  agitate: {
    title: 'Move the needle within the node',
    how: 'With the needle slider, draw the needle back toward the near side of the node and return it to the stop. Keep the tip inside the node and in the image. The count is the minimum for this exercise; it is not the number that makes a sample adequate.',
  },
  'protected-removal': {
    title: 'Retract the needle fully',
    how: 'Bring the needle slider all the way back so the whole needle is inside its sheath, and only then remove the assembly. An exposed needle is never drawn back through the working channel.',
  },
}
const signed = (degrees: number) => (degrees > 0 ? '+' : '') + degrees + '°'

export function NeedleSteps({
  state: s,
  act,
  demonstration,
  onFocus,
}: {
  state: NeedleState
  act: (a: ModelAction) => void
  demonstration: boolean
  onFocus: (part: NeedleHandlePart | '') => void
}) {
  const current = MODEL_STEPS.needle.find((step) => !s.steps.includes(step))
  const focus = (part: NeedleHandlePart | '') => ({
    onFocus: () => onFocus(part),
    onPointerEnter: () => onFocus(part),
    onBlur: () => onFocus(''),
    onPointerLeave: () => onFocus(''),
  })
  const slider = (
    name: string,
    value: number,
    shown: string,
    range: [number, number],
    type: string,
    part: NeedleHandlePart | '',
  ) => (
    <label className="needle-slider">
      <span>{name}</span>
      <input
        type="range"
        aria-label={name}
        aria-valuetext={shown}
        min={range[0]}
        max={range[1]}
        step={1}
        value={value}
        onChange={(e) => act({ type, value: Number(e.target.value) })}
        {...focus(part)}
      />
      <output>{shown}</output>
    </label>
  )
  const travel = MODEL_GEOMETRY.needle.maxTravel
  /** What sits on the step's title line, and what sits under it. */
  const beside: Partial<Record<StepId, ReactNode>> = {
    sheath: (
      <button
        type="button"
        aria-pressed={s.secured}
        data-needle-lock
        onClick={() => act({ type: 'secure' })}
        {...focus('sheath_lock')}
      >
        {s.secured ? 'Release sheath lock' : 'Lock sheath'}
      </button>
    ),
    agitate: (
      <span className="needle-count" data-needle-movements={s.movements}>
        {Math.min(s.movements, s.movementsNeeded)} of {s.movementsNeeded}
      </span>
    ),
    'protected-removal': (
      <button type="button" data-needle-remove onClick={() => act({ type: 'remove' })}>
        Remove the assembly
      </button>
    ),
  }
  const under: Partial<Record<StepId, ReactNode>> = {
    sheath: slider('Sheath adjuster', s.sheath, s.sheath + ' mm', [0, 2], 'sheath', 'sheath_adjuster'),
    stop: slider(
      'Needle stop',
      s.stop,
      s.stop > 0 ? s.stop + ' mm' : 'not set',
      [0, travel],
      'stop',
      'extension_stop',
    ),
    'in-node': slider(
      'Needle slider',
      s.extension,
      s.extension + ' mm',
      [0, travel],
      'needle',
      'needle_handle',
    ),
    'tip-recovered': slider(
      'Scope rotation',
      s.plane,
      signed(s.plane),
      [-NEEDLE_LAB.maxRotation, NEEDLE_LAB.maxRotation],
      'rotate',
      '',
    ),
  }
  return (
    <ol
      className="needle-steps"
      data-model-steps={demonstration ? 'demonstration' : 'activity'}
      data-needle-current={current ?? 'done'}
    >
      {MODEL_STEPS.needle.map((step, index) => {
        const done = s.steps.includes(step)
        return (
          <li key={step} data-step={step} data-done={done} data-current={step === current || undefined}>
            <div className="needle-step-title">
              <span className="needle-step-mark" aria-hidden="true">
                {done ? '✓' : index + 1}
              </span>
              <p>
                {STEP_TEXT[step].title}
                <span className="sr-only">{done ? ' (done)' : ''}</span>
              </p>
              {beside[step]}
            </div>
            {step === current && <p className="needle-step-how">{STEP_TEXT[step].how}</p>}
            {under[step]}
          </li>
        )
      })}
    </ol>
  )
}
