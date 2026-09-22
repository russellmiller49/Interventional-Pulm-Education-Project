import { render } from '@testing-library/react'

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'

import { ScopeFallback } from '../components/scope/ScopeFallback'
import {
  opticalViewName,
  VIEW_SIGNAL_LEAD,
  VIEW_SIGNAL_WORDS,
} from '../components/scope/scopeSceneModel'
import type {
  ScopeCommand,
  ScopePaneProps,
  ScopeState,
  ScopeViewSpec,
} from '../components/scope/types'
import { section as branchEntry } from '../content/sections/branch-entry'
import { scopeLocationCaption } from '../engine/scope/scopeCaption'
import { createScopeState, reduceScope } from '../engine/scope/scopeReducer'
import { ScopePilot } from '../test-support/scopePilot'
import { centerlineTubeCollider, teachingCase } from '../test-support/teachingCase'

/**
 * BF-PRE-REVIEW-01 finding 1, residual: the optical surface's accessible name is a report of the
 * model's view signal, not a verdict on the picture.
 *
 * The independent re-review reproduced the overshoot — right main, back through the trachea, left
 * main, thirty degrees of deflection, then advance — and found the rendered field filled with
 * mucosa while `signals.view` stayed `clear`, because the reducer sets that signal from two
 * recorded conditions alone (a red-out and a contaminated lens) and neither had fired. Both
 * optical surfaces then translated the signal into "a clear view", which is the differential's own
 * name for a usable image. The model never establishes that, so the name may not claim it.
 *
 * `scopeSceneModel` now owns the one mapping both renderers read, so the WebGL surface and the DOM
 * fallback cannot drift apart or hand a learner different strength of claim.
 */

/** Words whose ordinary reading approves the picture on the screen. */
const VISUAL_QUALITY_CLAIMS: readonly RegExp[] = [
  /\bclear view\b/i,
  /\bview is clear\b/i,
  /\bclear (?:airway|lumen|field)\b/i,
  /\bopen lumen\b/i,
  /\blumen (?:is |in )?(?:open|in view)\b/i,
  /\bgood view\b/i,
  /\bunobstructed\b/i,
  /\bairway is clear\b/i,
]

/** The mechanism behind a lost view is the answer some sections ask for; §view-loss denies it. */
const MECHANISM_LEAKS: readonly RegExp[] = [
  /\blens (?:is |was )?(?:against|on) the (?:mucosa|wall)\b/i,
  /\bwall contact\b/i,
  /\bsecretions?\b/i,
  /\bblood\b/i,
]

const act = (section: typeof branchEntry) => {
  if (section.act.kind !== 'scope-lab') throw new Error(`${section.id} is not a scope-lab section`)
  return section.act
}

/** The learner's own transport, driven exactly as the host drives the reducer. */
function pilotFor(view: ScopeViewSpec) {
  const scopeCase = teachingCase()
  let state = createScopeState(view, scopeCase)
  return new ScopePilot({
    view,
    scopeCase,
    get state() {
      return state as ScopeState
    },
    send(command: ScopeCommand) {
      state = reduceScope(state, command, 'keyboard', { view, scopeCase })
    },
  })
}

/** How far the camera's own forward axis runs before it leaves the lumen. */
function forwardRunMm(state: ScopeState): number {
  if (!state.pose) throw new Error('The tip has no pose')
  const frame = scopeOpticalFrame(state.pose)
  const collider = centerlineTubeCollider(teachingCase().graph)
  for (let mm = 0; mm <= 120; mm += 1) {
    const point: [number, number, number] = [
      frame.position[0] + frame.forward[0] * mm,
      frame.position[1] + frame.forward[1] * mm,
      frame.position[2] + frame.forward[2] * mm,
    ]
    if (collider.clearance(point) < 0) return mm
  }
  return 120
}

/** The re-review's overshoot, with the learner's own controls. */
function overshoot() {
  const view = act(branchEntry).view
  const pilot = pilotFor(view)
  pilot.goInto('RMSB')
  pilot.withdrawTo('TR')
  pilot.goInto('LMSB')
  const openBefore = forwardRunMm(pilot.state)
  pilot.send({ type: 'set-deflection', deg: -30 })
  for (let i = 0; i < 25; i += 1) pilot.advance()
  return { view, pilot, state: pilot.state, openBefore }
}

function paneProps(state: ScopeState, view: ScopeViewSpec): ScopePaneProps {
  return {
    view,
    state,
    map: teachingCase().map,
    caption: scopeLocationCaption(state),
    goals: [],
    controlsEnabled: true,
    onCommand: jest.fn(),
    onReset: jest.fn(),
  }
}

const fieldName = () =>
  document.querySelector('[data-view-signal]')?.getAttribute('aria-label') ?? ''

describe('the reproduced overshoot', () => {
  it('leaves the model signal clear while the rendered field is wall dominated', () => {
    const { state, openBefore } = overshoot()

    // The state the re-review described, reached the learner's own way.
    expect(state.place).toBe('airway')
    expect(state.location.fullLabel).toBe('Left main bronchus')
    expect(state.inputs.deflectionDeg).toBe(-30)

    // The signal is still clear: neither recorded condition fired.
    expect(state.signals.view).toBe('clear')
    expect(state.signals.lossOfViewCount).toBe(0)

    // And yet there is no lumen to see: no opening is in view, and the camera's own axis runs
    // into the wall in a fraction of the distance it had down the open bronchus.
    expect(state.ostia.filter((pin) => pin.inView)).toHaveLength(0)
    expect(forwardRunMm(state)).toBeLessThan(openBefore / 2)
  })
})

describe('the optical accessible name in that state (A, B)', () => {
  it('does not claim a visually clear airway merely because the signal is clear', () => {
    const { state } = overshoot()
    const name = opticalViewName(state.signals.view)
    for (const claim of VISUAL_QUALITY_CLAIMS) expect(name).not.toMatch(claim)
  })

  it('reports the model signal, and says that is what it is', () => {
    const { state } = overshoot()
    const name = opticalViewName(state.signals.view)
    expect(name).toBe('Scope view · what the model records: no red field, smear or dark field')
    expect(name.startsWith(VIEW_SIGNAL_LEAD)).toBe(true)
    expect(name).toContain('what the model records')
  })
})

describe('the fallback renderer obeys the same contract (C)', () => {
  it("names its field with the scene's own words", () => {
    const { state, view } = overshoot()
    render(<ScopeFallback {...paneProps(state, view)} />)
    expect(fieldName()).toBe(opticalViewName(state.signals.view))
  })

  it('makes no visual-quality claim either', () => {
    const { state, view } = overshoot()
    render(<ScopeFallback {...paneProps(state, view)} />)
    for (const claim of VISUAL_QUALITY_CLAIMS) expect(fieldName()).not.toMatch(claim)
  })
})

describe('the mapping as a whole (B, C)', () => {
  const signals = Object.keys(VIEW_SIGNAL_WORDS) as (keyof typeof VIEW_SIGNAL_WORDS)[]

  it('covers every signal the state can carry', () => {
    expect(signals.sort()).toEqual(['clear', 'contaminated', 'dark', 'red-out'])
  })

  it.each(signals)('frames %s as a record and never as a verdict', (signal) => {
    const name = opticalViewName(signal)
    expect(name.startsWith(VIEW_SIGNAL_LEAD)).toBe(true)
    for (const claim of VISUAL_QUALITY_CLAIMS) expect(name).not.toMatch(claim)
    for (const leak of MECHANISM_LEAKS) expect(name).not.toMatch(leak)
    expect(flaggedLearnerCopyTerms(name)).toEqual([])
  })

  it.each(signals)('gives the scene and the fallback the same words for %s', (signal) => {
    const { state, view } = overshoot()
    const shifted: ScopeState = { ...state, signals: { ...state.signals, view: signal } }
    render(<ScopeFallback {...paneProps(shifted, view)} />)
    // The fallback may add the openings it measures; the view clause itself is the scene's.
    expect(fieldName().startsWith(opticalViewName(signal))).toBe(true)
  })
})

describe('the accepted record and location presentation is untouched (D)', () => {
  it('still separates where the tip is now from what was recorded', () => {
    const { state, view } = overshoot()
    render(<ScopeFallback {...paneProps(state, view)} />)
    // The caption strip keeps printing the live location, as the accepted repair left it.
    expect(document.querySelector('[data-scope-scene]')).not.toBeNull()
    expect(document.body.textContent).toContain('Left main bronchus')
    // Nothing on the pane approves the picture.
    for (const claim of VISUAL_QUALITY_CLAIMS)
      expect(document.body.textContent ?? '').not.toMatch(claim)
  })
})
