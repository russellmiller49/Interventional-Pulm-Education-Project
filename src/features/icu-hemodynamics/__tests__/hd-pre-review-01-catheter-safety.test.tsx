import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'

import { hemodynamicsStageItems } from '../content/stageItems'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import {
  catheterSimulationNotice,
  catheterTransitionAllowed,
  catheterTransitionHold,
  occlusionReleasedByLearner,
  paReturnEpisodeKey,
  paWaveformReturned,
} from '../engine/catheterSafety'
import {
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  parseSelfPacedRecord,
} from '../engine/selfPacedProgress'
import {
  PA_RETURN_CHECK,
  capstoneState,
  cleanState,
  reduceAll,
  sectionRuntime,
  stageGoalMet,
} from '../engine/stageRuntime'
import { WEDGE_AUTO_DEFLATION_SECONDS } from '../engine/simulation'
import type { HemodynamicSimulationState } from '../engine/types'
import {
  clickPrimary,
  control,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
} from '../test-support/stageHarness'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string }
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  installDom()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

function tick(seconds: number) {
  act(() => {
    jest.advanceTimersByTime(seconds * 1000)
  })
}

function storedRecord() {
  return parseSelfPacedRecord(localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY))
}

function withCatheter(
  base: HemodynamicSimulationState,
  patch: Partial<HemodynamicSimulationState['catheter']>,
): HemodynamicSimulationState {
  return { ...base, catheter: { ...base.catheter, ...patch } }
}

/**
 * HD-PRE-REVIEW-01. The report's §5 ending (Figure 29), its §9 capstone screen (Figures 37–38) and
 * the case-narration findings, asserted as behaviour rather than as copy.
 *
 * Every test here fails on the batch's base commit: the eligibility rule did not exist, Continue
 * and Finish read one of the two balloon flags, the map answered in another pane, the capstone
 * named an occlusion it did not have, the pulmonary-artery-return check was unkeyed, and the case
 * host wrote "Applied …" before the reducer had refused the request.
 */
describe('one eligibility rule for leaving a step', () => {
  const base = cleanState(540, 'pa')

  it('holds on either balloon, on both, and on a movement — and releases when none of them is true', () => {
    expect(catheterTransitionAllowed(base)).toBe(true)
    expect(catheterTransitionHold(base)).toBeNull()

    const occlusion = withCatheter(base, { balloonInflated: true, position: 'wedge' })
    expect(catheterTransitionAllowed(occlusion)).toBe(false)
    expect(catheterTransitionHold(occlusion)?.reason).toBe('wedge-balloon')
    expect(catheterTransitionHold(occlusion)?.controlKey).toBe('deflate')

    // The flag the base commit's Continue and Finish did not read at all.
    const float = withCatheter(base, { floatBalloonInflated: true, position: 'rv' })
    expect(catheterTransitionAllowed(float)).toBe(false)
    expect(catheterTransitionHold(float)?.reason).toBe('float-balloon')
    expect(catheterTransitionHold(float)?.controlKey).toBe('advance')
    expect(catheterTransitionHold(float)?.recovery).toMatch(/Advance|Withdraw/)

    const both = withCatheter(base, {
      balloonInflated: true,
      floatBalloonInflated: true,
      position: 'wedge',
    })
    expect(catheterTransitionAllowed(both)).toBe(false)
    expect(catheterTransitionHold(both)?.reason).toBe('wedge-balloon')

    const floatingMidMove = withCatheter(base, {
      floatBalloonInflated: true,
      position: 'ra',
      targetPosition: 'rv',
    })
    expect(catheterTransitionAllowed(floatingMidMove)).toBe(false)
    expect(catheterTransitionHold(floatingMidMove)?.reason).toBe('in-flight')

    const moving = withCatheter(base, { targetPosition: 'rv' })
    expect(catheterTransitionAllowed(moving)).toBe(false)
    expect(catheterTransitionHold(moving)?.reason).toBe('in-flight')
    expect(catheterTransitionHold(moving)?.controlKey).toBeNull()
  })

  it('lets a run continue after a recovery, and still refuses to call an automatic release the learner’s work', () => {
    const afterAutomaticRelease = withCatheter(base, {
      forcedSafetyRecovery: true,
      wedgeEpisodeCount: 1,
      storedWedgeMmHg: 12,
      storedAtEndExpiration: true,
    })
    // Navigation is free: nothing is inflating and nothing is moving.
    expect(catheterTransitionAllowed(afterAutomaticRelease)).toBe(true)
    // The work is still not the learner's: the deflation goal stays unmet.
    expect(stageGoalMet({ type: 'balloon-down' }, afterAutomaticRelease)).toBe(false)
    expect(occlusionReleasedByLearner(afterAutomaticRelease)).toBe(false)
    // The tracing, separately, is a pulmonary-artery tracing again — see the sanity-blocker-1
    // group below. Who released the balloon is not evidence about what the monitor shows.
    expect(paWaveformReturned(afterAutomaticRelease)).toBe(true)

    const afterLearnerDeflation = withCatheter(afterAutomaticRelease, {
      forcedSafetyRecovery: false,
    })
    expect(catheterTransitionAllowed(afterLearnerDeflation)).toBe(true)
    expect(stageGoalMet({ type: 'balloon-down' }, afterLearnerDeflation)).toBe(true)
    expect(occlusionReleasedByLearner(afterLearnerDeflation)).toBe(true)
    expect(paWaveformReturned(afterLearnerDeflation)).toBe(true)
  })
})

describe('the §5 ending the report reproduced (Figure 29)', () => {
  /** Drive the advancement section to its hands-on transfer task, the way a learner does. */
  function reachRepairThenMove() {
    const { lesson } = mountSection('catheter-advancement')
    let remaining = 20
    while (currentStepId() !== lesson.steps[6].id && remaining-- > 0) clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[6].id)
    return lesson
  }

  it('holds the step while the tip is in flight, and names waiting as the thing to do', () => {
    reachRepairThenMove()

    fireEvent.click(control('advance'))
    expect(nowPrimary()).toBeDisabled()
    const hold = document.querySelector('[data-catheter-hold]')
    expect(hold?.getAttribute('data-catheter-hold')).toBe('in-flight')
    expect(hold?.querySelector('[data-catheter-hold-state]')?.textContent).toMatch(
      /tip is moving toward the right ventricle, with the flow-directed balloon up/i,
    )
    expect(hold?.querySelector('[data-catheter-hold-locate]')).toBeNull()
  })

  it('holds the last task and the reviewed mark while the balloon is up, then releases both after the float is finished', () => {
    reachRepairThenMove()
    fireEvent.click(control('advance'))
    tick(6)

    // Arrived in the ventricle with the flow-directed balloon still up: the state of Figure 29.
    const hold = document.querySelector('[data-catheter-hold]')
    expect(hold?.getAttribute('data-catheter-hold')).toBe('float-balloon')
    expect(hold?.querySelector('[data-catheter-hold-state]')?.textContent).toMatch(
      /flow-directed balloon is up/i,
    )
    expect(hold?.querySelector('[data-catheter-hold-recovery]')?.textContent).toMatch(
      /Advance until the pulmonary-artery tracing appears/i,
    )
    // The abandon path exists and says what it is not.
    expect(hold?.querySelector('[data-catheter-hold-abandon]')).not.toBeNull()
    expect(hold?.querySelector('[data-catheter-hold-abandon-note]')?.textContent).toMatch(
      /not a float, a confirmed artery, a deflation you performed or a completed skill/i,
    )

    // Every route out is held, including the two the base commit left open.
    expect(nowPrimary()).toBeDisabled()
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')].every(
        (button) => button.disabled,
      ),
    ).toBe(true)
    clickPrimaryIfEnabled()
    expect(currentStepId()).toBe(hemodynamicsStageLesson('catheter-advancement').steps[6].id)
    expect(storedRecord()?.reviewedSectionIds ?? []).toEqual([])

    // The named recovery works, and then the section can be finished normally.
    fireEvent.click(control('advance'))
    tick(6)
    expect(document.querySelector('[data-catheter-hold]')).toBeNull()
    expect(nowPrimary()).not.toBeDisabled()
  })

  it('records no performed work and no after-snapshot for a task that was skipped', () => {
    const lesson = mountSection('pawp-capture').lesson
    let remaining = 20
    while (currentStepId() !== lesson.steps[lesson.steps.length - 1].id && remaining-- > 0) {
      clickPrimary()
    }
    // Straight through, touching nothing: the Explain step says there is nothing to compare.
    expect(document.querySelector('[data-before-after-absent]')).not.toBeNull()
    expect(
      [...document.querySelectorAll('[data-step-list] li')].some(
        (row) => row.getAttribute('data-step-state') === 'done',
      ),
    ).toBe(false)
    clickPrimary()
    expect(storedRecord()?.reviewedSectionIds).toEqual(['pawp-capture'])
  })
})

describe('leaving without performing, and abandoning what was started', () => {
  it('opens the final task directly and finishes it without recording any simulation work', () => {
    const { lesson } = mountSection('catheter-advancement')
    const last = lesson.steps.length - 1
    fireEvent.click(document.querySelectorAll<HTMLButtonElement>('[data-step-list] button')[last])
    expect(currentStepId()).toBe(lesson.steps[last].id)
    expect(
      [...document.querySelectorAll('[data-step-list] li')].some(
        (row) => row.getAttribute('data-step-state') === 'done',
      ),
    ).toBe(false)
    clickPrimary()
    // Content reviewed; nothing about the procedure claimed.
    expect(storedRecord()?.reviewedSectionIds).toEqual(['catheter-advancement'])
    expect(
      [...document.querySelectorAll('[data-step-list] li')].some(
        (row) => row.getAttribute('data-step-state') === 'done',
      ),
    ).toBe(false)
  })

  it('abandons a started occlusion, resets the simulation, and records nothing about it', () => {
    const { lesson } = mountSection('pawp-capture')
    clickPrimary()
    while (currentStepId() !== lesson.steps[2].id) clickPrimary()
    fireEvent.click(control('inflate'))
    tick(6)
    fireEvent.click(control('cursor'))
    fireEvent.click(control('store'))

    // The balloon is up: held, with an abandon path that says what it is not.
    expect(document.querySelector('[data-catheter-hold]')?.getAttribute('data-catheter-hold')).toBe(
      'wedge-balloon',
    )
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-catheter-hold-abandon]')!)

    // Reentry: the section starts again on a fresh simulated patient.
    expect(currentStepId()).toBe(lesson.steps[0].id)
    expect(document.querySelector('[data-catheter-hold]')).toBeNull()
    expect(storedRecord()?.reviewedSectionIds ?? []).toEqual([])
    expect(
      [...document.querySelectorAll('[data-step-list] li')].some(
        (row) => row.getAttribute('data-step-state') === 'done',
      ),
    ).toBe(false)

    // And the wedge itself is gone: the stored value did not survive the abandon.
    // (The section's second goal, a deflated balloon at the artery, is true of its opening state
    // and always has been; what matters here is that no stored wedge carried over.)
    while (currentStepId() !== lesson.steps[2].id) clickPrimary()
    expect(
      [...document.querySelectorAll('[data-step-goals] li')].map((li) =>
        li.getAttribute('data-met'),
      )[0],
    ).toBe('false')
    expect(document.body.textContent).not.toMatch(/Stored: \d+ mmHg/)
  })
})

function clickPrimaryIfEnabled() {
  const button = nowPrimary()
  if (button && !button.disabled) fireEvent.click(button)
}

describe('confirming a place answers where the pins are (L5-02)', () => {
  it('renders the mismatch response inside the map’s own answer control and keeps the row selected', () => {
    const { lesson } = mountSection('catheter-advancement')
    while (currentStepId() !== lesson.steps[2].id) clickPrimary()
    const row = (pattern: RegExp) =>
      [...document.querySelectorAll<HTMLLabelElement>('[data-catheter-map-answer] label')].find(
        (label) => pattern.test(label.textContent ?? ''),
      )!

    fireEvent.click(row(/right ventricle/i).querySelector('input')!)
    const note = document.querySelector('[data-place-note]')
    expect(note?.textContent).toMatch(/does not match/i)
    // The response lives with the control, not in the other pane (report L5-02).
    expect(note?.closest('[data-catheter-map-answer]')).not.toBeNull()
    expect(row(/right ventricle/i).getAttribute('data-selected')).toBe('true')
  })
})

describe('the flow-directed balloon is the simulation’s work, not the learner’s (L5-03)', () => {
  it('says so on the tip controls whether it is up or down', () => {
    const { lesson } = mountSection('catheter-advancement')
    while (currentStepId() !== lesson.steps[2].id) clickPrimary()
    expect(document.querySelector('[data-float-balloon-provenance]')?.textContent).toMatch(
      /raised and lowered for you|guided model assistance/i,
    )
    fireEvent.click(control('advance'))
    tick(6)
    expect(document.querySelector('[data-float-balloon-provenance]')?.textContent).toMatch(
      /guided model assistance, not an action you performed/i,
    )
  })
})

describe('the flush control names the channel it flushes (L5-06)', () => {
  it('calls it the distal lumen, prints where the tip is, and states the restriction that applies', () => {
    const { lesson } = mountSection('catheter-advancement')
    while (currentStepId() !== lesson.steps[6].id) clickPrimary()
    const dock = document.querySelector('[data-dock="flush"]')!
    expect(dock.textContent).toMatch(/Flush the distal PAC line/)
    expect(dock.textContent).toMatch(
      /one channel, wherever the tip is; right now, the right atrium/,
    )
    expect(dock.textContent).not.toMatch(/needs a confirmed artery tracing/)
    // The restriction that is actually enforced is still stated and still enforced.
    expect(dock.textContent).toMatch(
      /blocks a flush on this lumen while the tip is in an occluding/,
    )
  })
})

describe('the pulmonary-artery-return check belongs to one occlusion (L6-05)', () => {
  it('has nothing to answer before an occlusion has been taken and released', () => {
    const { lesson } = mountSection('pawp-capture')
    let remaining = 20
    while (currentStepId() !== lesson.steps[3].id && remaining-- > 0) clickPrimary()
    expect(document.querySelector('[data-return-check]')?.getAttribute('data-return-episode')).toBe(
      'none',
    )
    expect(document.querySelector('[data-return-unavailable]')?.textContent).toMatch(
      /after an occlusion in this task has been released/i,
    )
    expect(document.querySelector('[data-return-answer="returned"]')).toBeNull()
  })

  it('offers both answers after a real release, and checks the answer against the tracing', () => {
    const { lesson } = mountSection('pawp-capture')
    clickPrimary()
    while (currentStepId() !== lesson.steps[2].id) clickPrimary()
    fireEvent.click(control('inflate'))
    tick(6)
    fireEvent.click(control('cursor'))
    fireEvent.click(control('store'))
    fireEvent.click(control('deflate'))
    clickPrimary()

    expect(document.querySelector('[data-return-check]')?.getAttribute('data-return-episode')).toBe(
      'episode-1',
    )
    expect(document.querySelector('[data-return-answer="not-returned"]')).not.toBeNull()

    // The truthful "it has not come back" answer is available and records nothing.
    fireEvent.click(
      document.querySelector<HTMLButtonElement>('[data-return-answer="not-returned"]')!,
    )
    expect(
      document.querySelector('[data-return-response]')?.getAttribute('data-return-response'),
    ).toBe('differs')
    expect(
      [...document.querySelectorAll('[data-step-goals] li')].map((li) =>
        li.getAttribute('data-met'),
      ),
    ).toEqual(['false'])

    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-return-answer="returned"]')!)
    expect(
      [...document.querySelectorAll('[data-step-goals] li')].map((li) =>
        li.getAttribute('data-met'),
      ),
    ).toEqual(['true'])
  })

  it('does not let one occlusion’s confirmation satisfy the next one', () => {
    const wedge = sectionRuntime('pawp-capture')
    const goal = { type: 'check', id: PA_RETURN_CHECK } as const
    const first = withCatheter(cleanState(550, 'pa'), { wedgeEpisodeCount: 1 })
    const confirmedFirst: HemodynamicSimulationState = {
      ...first,
      signalValidationChecks: [`${PA_RETURN_CHECK}:episode-1`],
    }
    expect(wedge.observeGoals).toContainEqual(goal)
    expect(stageGoalMet(goal, confirmedFirst)).toBe(true)

    // A second occlusion is a second observation. The first answer does not carry.
    const secondEpisode = withCatheter(confirmedFirst, { wedgeEpisodeCount: 2 })
    expect(stageGoalMet(goal, secondEpisode)).toBe(false)
    expect(paReturnEpisodeKey(secondEpisode)).toBe('episode-2')

    // And a click before any balloon went up is not an episode at all.
    const beforeAnyWedge: HemodynamicSimulationState = {
      ...cleanState(550, 'pa'),
      signalValidationChecks: [`${PA_RETURN_CHECK}:episode-1`],
    }
    expect(paReturnEpisodeKey(beforeAnyWedge)).toBeNull()
    expect(stageGoalMet(goal, beforeAnyWedge)).toBe(false)
  })
})

describe('the capstone screen (L9-01, L9-02)', () => {
  const capstone = capstoneState(808)

  it('opens on the authored false wedge, with the balloon down', () => {
    expect(capstone.caseId).toBe('HD-08')
    expect(capstone.measurementSystem.artifact).toBe('false-wedge')
    expect(capstone.catheter.position).toBe('wedge')
    expect(capstone.catheter.balloonInflated).toBe(false)
  })

  it('states the simulation’s own restriction rather than a manufacturer alarm', () => {
    const notice = catheterSimulationNotice(capstone)
    expect(notice).toMatch(/Simulation safety notice, not a device alarm/)
    expect(notice).toMatch(/occluding distal position with the balloon down/)
    expect(notice).toMatch(/not a validated occlusion pressure/)
    expect(notice).toMatch(/blocks a flush on the pulmonary-artery line/)
    // No invented withdrawal distance or recovery sequence: HD-03-08 is still an open source item.
    expect(notice).not.toMatch(/\d+\s?cm/)
  })

  it('names the channel for what it is carrying, with the balloon state beside it', () => {
    render(<BedsideMonitor state={capstone} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />)
    const readout = screen.getByRole('group', { name: 'Current PAC pressure' })
    expect(readout).toHaveTextContent(/PAC · distal/)
    expect(readout).toHaveTextContent(/balloon down/)
    expect(readout).toHaveTextContent(/not a validated occlusion/)
    // The claim the report caught: an occlusion mean printed over a balloon that is down.
    expect(readout).not.toHaveTextContent(/live occlusion mean/)
    expect(document.querySelector('[data-simulation-safety-notice]')?.textContent).toMatch(
      /not a device alarm/,
    )
    expect(screen.getByText('NO ACTIVE MODEL ALARMS')).toBeInTheDocument()
  })

  it('still names a real balloon occlusion PAWP', () => {
    const occluding = reduceAll(cleanState(550, 'pa'), [{ type: 'START_WEDGE' }])
    render(
      <BedsideMonitor state={occluding} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />,
    )
    expect(screen.getByRole('group', { name: 'Current PAC pressure' })).toHaveTextContent(
      /PAC · PAWP.*balloon occlusion · live mean/,
    )
  })

  it('puts the tip before the flush in the step that says what order to work in', () => {
    const lesson = hemodynamicsStageLesson('pac-signal-validation')
    const act = lesson.steps[2]
    expect(act.instruction).toMatch(/blocked while the tip sits in an occluding position/)
    expect(act.instruction.indexOf('Then the tip')).toBeLessThan(
      act.instruction.indexOf('flush, read, repair'),
    )
  })

  it('clears the notice once the tip is back in the artery', () => {
    const recovered = reduceAll(capstone, [{ type: 'RETRACT_CATHETER', instant: true }])
    expect(recovered.catheter.position).toBe('pa')
    expect(catheterSimulationNotice(recovered)).toBeNull()
  })
})

describe('the verdict labels match the rationales beside them (L1-02, L4-07, L1-03)', () => {
  it('no longer calls an inference the item rejects defensible', () => {
    const fluid = hemodynamicsStageItems['why-measure'].prediction.choices.find(
      (choice) => choice.id === 'needs-fluid',
    )!
    expect(fluid.plausibility).toBe('incorrect-mechanism')

    const constriction = hemodynamicsStageItems['waveform-components'].transfer.choices.find(
      (choice) => choice.id === 'constriction',
    )!
    expect(constriction.plausibility).toBe('incorrect-mechanism')
  })

  it('keeps the keys, the options and their rationales exactly where they were', () => {
    const item = hemodynamicsStageItems['why-measure'].prediction
    expect(item.correctChoiceIds).toEqual(['driving-pressure-only'])
    expect(item.choices.map((choice) => choice.id)).toEqual([
      'driving-pressure-only',
      'needs-fluid',
      'heart-failing',
    ])
    expect(item.choices.find((choice) => choice.id === 'needs-fluid')!.rationale).toMatch(
      /one cause among several/,
    )
  })
})

/**
 * Sanity-review repairs on top of HD-PRE-REVIEW-01 (independent review of `78a4bdcb`).
 *
 * Blocker 1: `paWaveformReturned` folded `forcedSafetyRecovery` into its answer, so after the
 * simulation's own cutoff released the balloon — leaving a pulsatile pulmonary-artery tracing on
 * the monitor — the control agreed with "It has not come back" and produced persistent-occlusion
 * guidance. How an occlusion ended and what the tracing shows are different facts.
 *
 * Blocker 2: the control's answer lived in React state that outlived the occlusion it was about,
 * so a second occlusion opened already showing the first one's answer and its "Recorded for this
 * occlusion" line, although the engine had correctly refused to carry the check over.
 */
describe('an automatic release is not evidence about the tracing (sanity blocker 1)', () => {
  /** The teaching patient, one occlusion taken, released by the simulation's own cutoff. */
  function afterAutomaticRelease(): HemodynamicSimulationState {
    const inflated = reduceAll(cleanState(550, 'pa'), [{ type: 'START_WEDGE' }])
    return reduceAll(inflated, [{ type: 'TICK', seconds: WEDGE_AUTO_DEFLATION_SECONDS + 1 }])
  }

  it('reports the tracing as back, while still refusing the learner credit for the release', () => {
    const state = afterAutomaticRelease()
    // The simulation ended it, and says so.
    expect(state.catheter.forcedSafetyRecovery).toBe(true)
    expect(state.catheter.balloonInflated).toBe(false)
    expect(state.catheter.position).toBe('pa')

    // Observation: a pulmonary-artery tracing is on the monitor.
    expect(paWaveformReturned(state)).toBe(true)
    // Provenance: the release was not the learner's, so the deflation goal stays unmet.
    expect(occlusionReleasedByLearner(state)).toBe(false)
    expect(stageGoalMet({ type: 'balloon-down' }, state)).toBe(false)
  })

  it('still answers "not returned" where the tracing really is not back', () => {
    // The capstone's tip sits distally on a deflated balloon: no artery on that channel.
    const held = withCatheter(capstoneState(808), { wedgeEpisodeCount: 1 })
    expect(paWaveformReturned(held)).toBe(false)
    // And while a balloon is up, there is no released episode to answer about at all.
    const occluding = reduceAll(cleanState(550, 'pa'), [{ type: 'START_WEDGE' }])
    expect(paWaveformReturned(occluding)).toBe(false)
    expect(paReturnEpisodeKey(occluding)).toBeNull()
  })

  it('answers the learner against the tracing after an automatic release, both ways', () => {
    const { lesson } = mountSection('pawp-capture')
    clickPrimary()
    while (currentStepId() !== lesson.steps[2].id) clickPrimary()
    fireEvent.click(control('inflate'))
    tick(WEDGE_AUTO_DEFLATION_SECONDS + 1)
    expect(screen.getByRole('alert').textContent).toMatch(/released the balloon itself/)
    clickPrimary()

    expect(document.querySelector('[data-return-check]')?.getAttribute('data-return-episode')).toBe(
      'episode-1',
    )

    // "It has not come back" must not narrate a persistent occlusion over a returned tracing.
    fireEvent.click(
      document.querySelector<HTMLButtonElement>('[data-return-answer="not-returned"]')!,
    )
    const disagreement = document.querySelector('[data-return-response]')
    expect(disagreement?.getAttribute('data-return-response')).toBe('differs')
    expect(disagreement?.textContent).toMatch(/Look again/i)
    expect(disagreement?.textContent).not.toMatch(/occlusion has not ended at the vessel/i)
    expect(disagreement?.textContent).not.toMatch(/escalate/i)

    // "The artery is back" is observationally correct, and says whose release it was.
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-return-answer="returned"]')!)
    const agreement = document.querySelector('[data-return-response]')
    expect(agreement?.getAttribute('data-return-response')).toBe('agrees')
    expect(agreement?.textContent).toMatch(/this simulation ended the occlusion at its own cutoff/i)
    expect(agreement?.textContent).toMatch(/not recorded as a deflation you performed/i)
    // The observation counts; the deflation still does not.
    expect(
      [...document.querySelectorAll('[data-step-goals] li')].map((li) =>
        li.getAttribute('data-met'),
      ),
    ).toEqual(['true'])
  })
})

describe('an answer belongs to the occlusion it was given about (sanity blocker 2)', () => {
  /** Take one occlusion on the wedge section's transfer task and release it by hand. */
  function occludeAndRelease() {
    fireEvent.click(control('inflate'))
    tick(6)
    fireEvent.click(control('cursor'))
    fireEvent.click(control('store'))
    fireEvent.click(control('deflate'))
  }

  it('does not show the first occlusion’s answer, or its recorded line, on the second', () => {
    const { lesson } = mountSection('pawp-capture')
    let remaining = 20
    while (currentStepId() !== lesson.steps[6].id && remaining-- > 0) clickPrimary()
    expect(currentStepId()).toBe(lesson.steps[6].id)

    // No episode yet.
    expect(document.querySelector('[data-return-check]')?.getAttribute('data-return-episode')).toBe(
      'none',
    )
    expect(document.querySelector('[data-return-response]')).toBeNull()

    // Episode 1, answered and recorded.
    occludeAndRelease()
    expect(document.querySelector('[data-return-check]')?.getAttribute('data-return-episode')).toBe(
      'episode-1',
    )
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-return-answer="returned"]')!)
    expect(document.querySelector('[data-return-response]')?.textContent).toMatch(
      /Recorded for this occlusion/,
    )
    expect(
      document.querySelector<HTMLButtonElement>('[data-return-answer="returned"]')?.textContent,
    ).toMatch(/recorded/)

    // Episode 2 begins: the previous answer is not this episode's answer.
    fireEvent.click(control('inflate'))
    expect(document.querySelector('[data-return-check]')?.getAttribute('data-return-episode')).toBe(
      'none',
    )
    expect(document.querySelector('[data-return-response]')).toBeNull()

    // Episode 2 released and unanswered: nothing claims a recorded observation.
    tick(6)
    fireEvent.click(control('deflate'))
    expect(document.querySelector('[data-return-check]')?.getAttribute('data-return-episode')).toBe(
      'episode-2',
    )
    expect(document.querySelector('[data-return-response]')).toBeNull()
    expect(
      document.querySelector<HTMLButtonElement>('[data-return-answer="returned"]')?.textContent,
    ).not.toMatch(/recorded/)
    expect(
      document
        .querySelector<HTMLButtonElement>('[data-return-answer="returned"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false')

    // Episode 2 answered: now, and only now, it is this episode's recorded observation.
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-return-answer="returned"]')!)
    expect(document.querySelector('[data-return-response]')?.textContent).toMatch(
      /Recorded for this occlusion/,
    )
    expect(
      document.querySelector<HTMLButtonElement>('[data-return-answer="returned"]')?.textContent,
    ).toMatch(/recorded/)
  })
})
