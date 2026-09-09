/**
 * @jest-environment node
 */
import {
  emptyLabState,
  labGoalMet,
  labGoalsMet,
  labStateAfterChange,
  type LabGoal,
} from '../engine/labGoalEvaluation'

describe('labStateAfterChange', () => {
  it('returns the same state when nothing changes', () => {
    const state = emptyLabState('geometry', 'projection')
    expect(labStateAfterChange('geometry', state, { orbit: 0 }, 'projection')).toBe(state)
  })

  it('records a touched event per changed control and applies action patches', () => {
    const state = emptyLabState('geometry', 'projection')
    const moved = labStateAfterChange('geometry', state, { orbit: 30 }, 'projection')
    expect(moved.values.orbit).toBe(30)
    expect(moved.events).toContain('touched-orbit')
    const reset = labStateAfterChange('geometry', moved, { resetGeometry: true }, 'projection')
    expect(reset.values).toMatchObject({ orbit: 0, tilt: 0, depth: 22 })
    expect(reset.events).toContain('touched-resetGeometry')
  })

  it('geometry records overlap and separation as the learner sees them', () => {
    const state = emptyLabState('geometry', 'projection')
    const frontal = labStateAfterChange('geometry', state, { depth: 22, tilt: 0 }, 'projection')
    expect(frontal.events).not.toContain('overlap-seen')
    const nudged = labStateAfterChange('geometry', frontal, { orbit: 1 }, 'projection')
    const back = labStateAfterChange('geometry', nudged, { orbit: 0 }, 'projection')
    expect(back.events).toContain('overlap-seen')
    const oblique = labStateAfterChange('geometry', back, { orbit: 40 }, 'projection')
    expect(oblique.events).toContain('separation-seen')
  })

  it('moving a checked CBCT setup clears every readiness check and the capture', () => {
    let state = emptyLabState('acquisition', 'cbct-acquisition')
    state = labStateAfterChange(
      'acquisition',
      state,
      { offsetX: 0, offsetDepth: 0 },
      'cbct-acquisition',
    )
    state = labStateAfterChange(
      'acquisition',
      state,
      { target: true, clearance: true, state: true, protection: true },
      'cbct-acquisition',
    )
    state = labStateAfterChange('acquisition', state, { captured: true }, 'cbct-acquisition')
    expect(state.values.captured).toBe(true)
    expect(state.events).toContain('state-captured')
    const moved = labStateAfterChange('acquisition', state, { offsetX: 6 }, 'cbct-acquisition')
    expect(moved.values).toMatchObject({
      target: false,
      clearance: false,
      state: false,
      protection: false,
      captured: false,
    })
    expect(moved.events).toContain('moved-after-capture')
  })

  it('checking a box alone never captures, and a workflow change also invalidates', () => {
    let state = emptyLabState('acquisition', 'fixed-suite')
    state = labStateAfterChange('acquisition', state, { target: true }, 'fixed-suite')
    expect(state.values.captured).toBe(false)
    state = labStateAfterChange('acquisition', state, { kind: 'mobile' }, 'fixed-suite')
    expect(state.values.target).toBe(false)
  })

  it('moving the tool hides the revealed explanation; the slab compared event needs both states', () => {
    let state = emptyLabState('mpr', 'tool-confirmation')
    state = labStateAfterChange('mpr', state, { revealed: true }, 'tool-confirmation')
    expect(state.events).toContain('explanation-revealed')
    state = labStateAfterChange('mpr', state, { tipX: 10 }, 'tool-confirmation')
    expect(state.values.revealed).toBe(false)
    state = labStateAfterChange('mpr', state, { slab: true }, 'tool-confirmation')
    expect(state.events).not.toContain('slab-compared')
    state = labStateAfterChange('mpr', state, { slab: false }, 'tool-confirmation')
    expect(state.events).toContain('slab-compared')
  })

  it('visiting the window slices is recorded when all three slices sit on the window', () => {
    let state = emptyLabState('mpr', 'tool-confirmation')
    state = labStateAfterChange(
      'mpr',
      state,
      { axial: 0, coronal: 14, sagittal: 4 },
      'tool-confirmation',
    )
    expect(state.events).toContain('window-slices-visited')
  })

  it('DTS plane visits are recorded at the tool, lesion and deeper planes', () => {
    let state = emptyLabState('dts', 'dts-acquisition')
    state = labStateAfterChange('dts', state, { planeTool: true }, 'dts-acquisition')
    expect(state.values.plane).toBe(-18)
    expect(state.events).toContain('plane-tool-visited')
    state = labStateAfterChange('dts', state, { plane: 0 }, 'dts-acquisition')
    expect(state.events).toContain('plane-lesion-visited')
    state = labStateAfterChange('dts', state, { plane: 25 }, 'dts-acquisition')
    expect(state.events).toContain('plane-deeper-visited')
  })

  it('capturing a contour stores the current shift, and a second capture is a recapture', () => {
    let state = emptyLabState('registration', 'changing-anatomy')
    state = labStateAfterChange(
      'registration',
      state,
      { shift: 15, overlay: false },
      'changing-anatomy',
    )
    state = labStateAfterChange('registration', state, { capture: true }, 'changing-anatomy')
    expect(state.values).toMatchObject({ previous: 15, overlay: true })
    expect(state.events).toContain('contour-captured')
    state = labStateAfterChange('registration', state, { shift: -5 }, 'changing-anatomy')
    state = labStateAfterChange('registration', state, { capture: true }, 'changing-anatomy')
    expect(state.values.previous).toBe(-5)
    expect(state.events).toContain('contour-recaptured')
  })
})

describe('labGoalMet', () => {
  const state = labStateAfterChange(
    'geometry',
    emptyLabState('geometry', 'projection'),
    { orbit: 35, depth: 20 },
    'projection',
  )
  const goals: readonly LabGoal[] = [
    { type: 'metric', metric: 'separationMm', op: 'gte', value: 10, label: 'separated' },
    { type: 'value', key: 'depth', op: 'abs-gte', value: 15, label: 'offset' },
    { type: 'event', id: 'separation-seen', label: 'seen' },
  ]

  it('evaluates value, metric and event goals over the lab state', () => {
    for (const goal of goals) expect(labGoalMet(goal, state, 'geometry', 'projection')).toBe(true)
    expect(labGoalsMet(goals, state, 'geometry', 'projection')).toBe(true)
    expect(
      labGoalMet(
        { type: 'flag', key: 'crop', value: true, label: 'crop' },
        emptyLabState('field', 'field'),
        'field',
        'field',
      ),
    ).toBe(false)
  })
})
