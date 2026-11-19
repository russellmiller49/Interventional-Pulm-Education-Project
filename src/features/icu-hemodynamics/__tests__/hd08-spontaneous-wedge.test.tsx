/**
 * Owner ruling `hd-r1-false-wedge-fault` (2026-11-14), and his answer of 2026-11-17 on its scope:
 * HD-08 keeps its three line faults and one catheter-position fault, and that fault is a spontaneous
 * wedge (the tip occluding a distal branch with the balloon down), not an incomplete balloon
 * occlusion. Each test names the learning objective of his note that it holds in place.
 */
import { render, screen } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { FormulaDrawer } from '../components/FormulaDrawer'
import { hemodynamicCaseById } from '../content'
import { hemodynamicTeachingArtifactByCaseId } from '../content/hemodynamicTeaching'
import { artifactDefinitions } from '../content/troubleshootingAtlas'
import { createInitialHemodynamicState, icuHemodynamicsReducer } from '../engine'
import { SPONTANEOUS_WEDGE_FAULT, UNNAMED_WEDGE_FAULT } from '../engine/calculations'
import {
  SPONTANEOUS_WEDGE_NOTICE,
  catheterSimulationNotice,
  isSpontaneousWedge,
} from '../engine/catheterSafety'
import { catheterFlushBlocked } from '../engine/pressureObservation'
import { cleanState, ventilatedWedgeState } from '../engine/stageRuntime'
import type { HemodynamicAction, HemodynamicSimulationState } from '../engine/types'

const definition = hemodynamicCaseById.get('HD-08')!
const opening = () => createInitialHemodynamicState(definition, 'practice', 808)
const after = (state: HemodynamicSimulationState, actions: readonly HemodynamicAction[]) =>
  actions.reduce(icuHemodynamicsReducer, state)
const monitor = (state: HemodynamicSimulationState) =>
  render(<BedsideMonitor state={state} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />)

describe('the case as it opens', () => {
  it('keeps the three line faults and has one catheter-position fault', () => {
    const state = opening()
    expect(state.measurementSystem.zeroed).toBe(false)
    expect(state.measurementSystem.transducerLevelCm).toBe(10)
    expect(state.measurementSystem.dampingRatio).toBeLessThan(0.4)
    // The tip fault is where the tip is; no signal artifact stands in for it.
    expect(state.measurementSystem.artifact).toBe('none')
    expect(isSpontaneousWedge(state)).toBe(true)
    expect(definition.requiredInterventionIds).toEqual([
      'correct-measurement-system',
      'reposition-catheter',
      'repeat-valid-thermodilution',
    ])
  })

  it('names the fault for what it is', () => {
    expect(definition.shortTitle).toBe('Artifacts and a spontaneous wedge')
    expect([...definition.learningObjectives, ...definition.debrief].join(' ')).not.toMatch(
      /false wedge/i,
    )
  })

  it('is a state of this case, never of a normal wedge view or of a wedge the learner took', () => {
    // Section 3 shows the normal wedge by setting the tip straight to the wedge position.
    const walk = after(cleanState(520, 'pa'), [
      { type: 'SET_CATHETER_POSITION', position: 'wedge' },
    ])
    const transfer = after(ventilatedWedgeState(521), [
      { type: 'SET_CATHETER_POSITION', position: 'wedge' },
    ])
    for (const state of [walk, transfer]) {
      expect(isSpontaneousWedge(state)).toBe(false)
      const view = monitor(state)
      expect(screen.getByRole('group', { name: 'Current PAC pressure' })).toHaveTextContent(
        /PAC · PAWP/,
      )
      expect(view.container.textContent).not.toMatch(/spontaneous wedge/i)
      view.unmount()
    }
    // A wedge taken with the balloon is not one either, and the tip is back in the artery after it.
    const taken = after(cleanState(550, 'pa'), [{ type: 'START_WEDGE' }])
    expect(isSpontaneousWedge(taken)).toBe(false)
    // Nor is this case once a teaching view has moved the tip.
    const moved = after(opening(), [
      { type: 'SET_CATHETER_POSITION', position: 'pa' },
      { type: 'SET_CATHETER_POSITION', position: 'wedge' },
    ])
    expect(isSpontaneousWedge(moved)).toBe(false)
  })
})

describe('objective 1 and 2: an apparent wedge with the balloon down is not a valid PAWP', () => {
  it('names the channel for the lumen, says the balloon is down, and stores nothing', () => {
    monitor(opening())
    const readout = screen.getByRole('group', { name: 'Current PAC pressure' })
    expect(readout).toHaveTextContent(/PAC · distal/)
    expect(readout).toHaveTextContent(
      /wedge tracing · balloon down · suspected spontaneous wedge · not a validated PAWP/,
    )
    expect(readout).not.toHaveTextContent(/PAC · PAWP/)
    expect(screen.getByRole('group', { name: 'PAWP measurement' })).toHaveTextContent(
      /nothing stored · a wedge tracing with the balloon down is not a validated PAWP/,
    )
  })

  it('withholds what is calculated from the wedge, and says why', () => {
    expect(SPONTANEOUS_WEDGE_FAULT.reason).toMatch(/Its value is not a validated PAWP/)
    render(<FormulaDrawer state={opening()} dispatch={jest.fn()} observedInputsOnly={false} />)
    expect(document.querySelector('[data-derived-signal-faults]')?.textContent).toMatch(
      /a suspected spontaneous wedge, with the tip occluding a distal branch/,
    )
  })

  it('in Practice, withholds the wedge without naming the fault before the learner has', () => {
    const drawer = render(
      <FormulaDrawer
        state={opening()}
        dispatch={jest.fn()}
        observedInputsOnly
        nameCatheterFault={false}
      />,
    )
    const faults = document.querySelector('[data-derived-signal-faults]')?.textContent ?? ''
    expect(faults).toContain(UNNAMED_WEDGE_FAULT.reason)
    expect(faults).not.toMatch(/spontaneous|balloon down|distal branch/i)
    drawer.unmount()
    const view = render(
      <BedsideMonitor
        state={opening()}
        dispatch={jest.fn()}
        onOpenCardiacOutput={jest.fn()}
        chamberLabel="withheld"
      />,
    )
    expect(view.container.textContent).not.toMatch(/spontaneous wedge|balloon down/i)
    expect(screen.getByRole('group', { name: 'PAWP measurement' })).toHaveTextContent(
      /nothing stored/,
    )
  })

  it('does not apply once the tip is back in the artery', () => {
    const withdrawn = after(opening(), [{ type: 'RETRACT_CATHETER', instant: true }])
    expect(isSpontaneousWedge(withdrawn)).toBe(false)
    render(<FormulaDrawer state={withdrawn} dispatch={jest.fn()} observedInputsOnly={false} />)
    expect(document.querySelector('[data-derived-signal-faults]')?.textContent ?? '').not.toMatch(
      /balloon down/,
    )
  })
})

describe('objective 3: check the balloon is down; no flush and no further inflation', () => {
  it('says so where the block bites', () => {
    expect(catheterSimulationNotice(opening())).toBe(SPONTANEOUS_WEDGE_NOTICE)
    expect(SPONTANEOUS_WEDGE_NOTICE).toMatch(/^Suspected spontaneous wedge/)
    expect(SPONTANEOUS_WEDGE_NOTICE).toMatch(/Do not read the value as a PAWP/)
    expect(SPONTANEOUS_WEDGE_NOTICE).toMatch(/Confirm the balloon is fully deflated/)
    expect(SPONTANEOUS_WEDGE_NOTICE).toMatch(/do not flush or inflate/)
  })

  it('blocks a flush of the distal lumen and refuses an inflation', () => {
    const state = opening()
    expect(catheterFlushBlocked(state, 'pulmonary-artery')).toBe(true)
    const flushed = after(state, [{ type: 'FAST_FLUSH', lineType: 'pulmonary-artery' }])
    expect(flushed.signalValidationChecks).not.toContain('fast-flush')
    const inflated = after(state, [{ type: 'START_WEDGE' }])
    expect(inflated.catheter.balloonInflated).toBe(false)
    expect(inflated.criticalErrors.length).toBeGreaterThan(0)
  })
})

describe('objective 4: reposition, and confirm the artery tracing before another wedge', () => {
  it('is cleared by withdrawing the catheter, not by repairing the line', () => {
    // The old case cleared its tip fault when the damping was repaired. A position is not a
    // property of the line: a repaired line with the tip still wedged is still a spontaneous wedge.
    const lineRepaired = after(opening(), [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
      { type: 'ZERO_TRANSDUCER' },
      { type: 'SET_DAMPING', dampingRatio: 0.65 },
    ])
    expect(isSpontaneousWedge(lineRepaired)).toBe(true)
    expect(lineRepaired.completedInterventionIds).not.toContain('reposition-catheter')

    const withdrawn = after(opening(), [{ type: 'RETRACT_CATHETER', instant: true }])
    expect(withdrawn.catheter.position).toBe('pa')
    expect(withdrawn.signalValidationChecks).toContain('catheter-position-confirmed')
    expect(withdrawn.completedInterventionIds).toContain('reposition-catheter')
    expect(withdrawn.responseMessage).toMatch(/the PA waveform is restored and confirmed/)
    expect(catheterSimulationNotice(withdrawn)).toBeNull()
    // While the catheter is still travelling the fault and its labels stay; they do not flicker
    // back to "PAWP" for the length of the withdrawal.
    const travelling = after(opening(), [{ type: 'RETRACT_CATHETER' }])
    expect(travelling.catheter.targetPosition).toBe('pa')
    expect(isSpontaneousWedge(travelling)).toBe(true)
    // The line's own faults are still there to repair.
    expect(withdrawn.completedInterventionIds).not.toContain('correct-measurement-system')
  })

  it('teaches the withdrawal, and the wait, on the troubleshooting card', () => {
    const card = artifactDefinitions['spontaneous-wedge']
    expect(card.actions.join(' ')).toMatch(/Confirm that the balloon is completely deflated/)
    expect(card.actions.join(' ')).toMatch(
      /Take another wedge only after a pulmonary-artery tracing is confirmed/,
    )
    expect(card.doNot.join(' ')).toMatch(/Do not record the tracing as a wedge pressure/)
    expect(card.doNot.join(' ')).toMatch(/do not inflate the balloon/)
    // Neither card says which one the capstone uses: that is the learner's to work out.
    expect(card.appearance.join(' ')).not.toMatch(/capstone/)
    expect(artifactDefinitions['false-wedge'].appearance.join(' ')).not.toMatch(/capstone/)
  })
})

describe('objective 5: told apart from its neighbors in the explanation', () => {
  // The worked reasoning is what the case shows after it is done; the debrief list is not rendered.
  const step = hemodynamicTeachingArtifactByCaseId
    .get('HD-08')!
    .expertTrace.find((entry) => entry.id === 'hd08-localize')!
  const explanation = JSON.stringify(step)

  it('names the fault with the clinical term, and the three things it is not, each by its sign', () => {
    expect(explanation).toMatch(
      /The wedge tracing with the balloon down is a suspected spontaneous wedge/,
    )
    expect(explanation).toMatch(
      /not an incomplete balloon occlusion, which keeps pulmonary-artery pulsatility with the balloon up/,
    )
    expect(explanation).toMatch(
      /not wall contact, which damps or flattens the tracing without giving it a wedge shape/,
    )
    expect(explanation).toMatch(
      /not an overdamped line, which blunts systolic and diastolic on every tracing from that line and shows on the fast-flush test/,
    )
  })

  it('ends on what to do: no PAWP, no flush, no inflation, withdraw, confirm before another wedge', () => {
    expect(explanation).toMatch(/Do not read the distal value as a PAWP/)
    expect(explanation).toMatch(/confirm the balloon is fully deflated, do not flush or inflate/)
    expect(explanation).toMatch(
      /withdraw until the pulmonary-artery tracing returns, and confirm it before another wedge/,
    )
  })

  it('keeps the incomplete occlusion as its own, different state: balloon up', () => {
    const incomplete = after(cleanState(550, 'pa'), [
      { type: 'SET_ARTIFACT', artifact: 'false-wedge' },
      { type: 'START_WEDGE' },
    ])
    expect(incomplete.catheter.balloonInflated).toBe(true)
    expect(isSpontaneousWedge(incomplete)).toBe(false)
    monitor(incomplete)
    expect(screen.getByRole('group', { name: 'Current PAC pressure' })).toHaveTextContent(
      /balloon up · not a validated occlusion/,
    )
  })
})
