import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { HemodynamicsShockProfiles } from '../components/HemodynamicsReferenceValues'
import {
  hemodynamicCaseById,
  hemodynamicCaseObstructiveCause,
  hemodynamicCases,
  hemodynamicCaseShockProfile,
} from '../content/cases'
import {
  feedbackForHemodynamicAction,
  hemodynamicTeachingArtifactByCaseId,
} from '../content/hemodynamicTeaching'
import { hemodynamicsSources } from '../content/sources'
import {
  HEMODYNAMICS_NUMBERS,
  HEMODYNAMICS_NUMBER_ONLY_SOURCES,
  HEMODYNAMICS_OBSTRUCTIVE_PATTERNS,
  HEMODYNAMICS_SHOCK_PROFILES,
} from '../content/teachingNumbers'
import { createInitialHemodynamicState } from '../engine'
import { modelOnlyMatchedComparison } from '../engine/matchedComparison'

/**
 * Two teaching repairs.
 *
 * A leg raise is a transient: it is read on a real-time flow measure at baseline, during the raise
 * and back at baseline, and thermodilution is too slow for it (Monnet and Teboul; Bootsma, part 2).
 * The monitor here has no real-time channel, so the copy says what the bedside uses, and the
 * debrief names a series that lands inside the effect as a product of compressed model time.
 *
 * Obstructive shock is not one filling-pressure pattern: the RAP is high, and the wedge depends on
 * the cause.
 */

jest.mock('@/features/critical-care/analytics', () => ({
  recordCriticalCareEvent: jest.fn(),
}))

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const FEATURE_ROOT = join(process.cwd(), 'src/features/icu-hemodynamics')
const HD01 = hemodynamicCaseById.get('HD-01')!
const PLR = HD01.interventions.find((item) => item.id === 'passive-leg-raise')!

function sourceFiles(directory: string): string[] {
  return readdirSync(join(FEATURE_ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(relative)
    return /\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

function legRaiseCopy(): string[] {
  const feedback = feedbackForHemodynamicAction(HD01, PLR, false)
  const trace = hemodynamicTeachingArtifactByCaseId.get('HD-01')!.expertTrace
  return [
    PLR.description,
    PLR.response,
    feedback.whatHappened,
    feedback.whyItHappened,
    feedback.theCue,
    ...trace.flatMap((step) => [step.cue, step.reasoning, step.commitment]),
    ...HD01.learningObjectives,
    ...HD01.debrief,
  ]
}

function inOrder(text: string, ...patterns: readonly RegExp[]) {
  const positions = patterns.map((pattern) => text.search(pattern))
  expect(positions.every((position) => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((left, right) => left - right))
}

async function toActions(caseId: string) {
  render(<HemodynamicCaseActivity caseId={caseId} mode="practice" />)
  expect(
    await screen.findByRole('heading', { name: hemodynamicCaseById.get(caseId)!.title }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Orient to the patient and signals' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Go to the actions without recording a frame' }),
  )
}

function openDebrief() {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Case checkpoints' })).getByRole('button', {
      name: /Review your reasoning/,
    }),
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Show the teaching without recording a frame' }),
  )
}

function raiseLegs(modelSeconds: number) {
  fireEvent.click(document.querySelector('[data-intervention="passive-leg-raise"]')!)
  act(() => {
    jest.advanceTimersByTime(modelSeconds * 1000)
  })
}

function acquireSeries() {
  for (let curve = 0; curve < 3; curve += 1) {
    fireEvent.click(screen.getByRole('button', { name: /Hold to inject/ }))
    for (const button of screen.queryAllByRole('button', { name: 'Review this curve' })) {
      if (!(button as HTMLButtonElement).disabled) fireEvent.click(button)
    }
    for (const button of screen.queryAllByRole('button', { name: 'Accept into the series' })) {
      if (button.getAttribute('aria-pressed') === 'false') fireEvent.click(button)
    }
  }
}

describe('the passive leg raise is taught on a real-time flow measure', () => {
  it('no longer tells the learner to catch the raise with a thermodilution series', () => {
    const offending =
      /shoot a thermodilution series|series (shot|acquired) while (it|the leg raise) lasts|needs a thermodilution series|That is the measured response/i
    expect(legRaiseCopy().filter((line) => offending.test(line))).toEqual([])
    const files = [...sourceFiles('content'), ...sourceFiles('components')]
    expect(
      files.filter((file) => offending.test(readFileSync(join(FEATURE_ROOT, file), 'utf8'))),
    ).toEqual([])
  })

  it('names the real-time measures and says why thermodilution is too slow', () => {
    expect(PLR.response).toMatch(/real-time flow measure/)
    expect(PLR.response).toMatch(/pulse contour/)
    expect(PLR.response).toMatch(/LVOT VTI/)
    expect(PLR.response).toMatch(/esophageal Doppler/)
    expect(PLR.response).toContain(HEMODYNAMICS_NUMBERS.value('plr-timing'))
    expect(PLR.response).toMatch(/thermodilution series is too slow/)
    expect(feedbackForHemodynamicAction(HD01, PLR, false).theCue).toMatch(
      /Thermodilution, bolus or continuous, is too slow/,
    )
  })

  it('teaches baseline, raise and return, in that order, on the card and in the cue', () => {
    expect(PLR.description).toContain(HEMODYNAMICS_NUMBERS.value('plr-position'))
    inOrder(PLR.description, /at baseline/, /during the raise/, /return/)
    const feedback = feedbackForHemodynamicAction(HD01, PLR, false)
    inOrder(feedback.theCue, /at baseline/, /during the raise/, /back at baseline/)
    expect(feedback.theCue).toContain(HEMODYNAMICS_NUMBERS.value('plr-response'))
  })

  it('carries the sequence into the expert path, the objective and the debrief', () => {
    const perturb = hemodynamicTeachingArtifactByCaseId
      .get('HD-01')!
      .expertTrace.find((step) => step.id === 'hd01-perturb')!
    expect(perturb.cue).toContain(HEMODYNAMICS_NUMBERS.value('plr-response'))
    expect(perturb.cue).toMatch(/back to baseline when the bed returns/)
    expect(perturb.reasoning).toMatch(/A rise that does not return/)
    expect(HD01.learningObjectives.join(' ')).toMatch(/baseline, raise and return/)
    expect(HD01.debrief.join(' ')).toContain(HEMODYNAMICS_NUMBERS.value('plr-response'))
  })

  it('keeps the leg-raise threshold apart from the fluid-bolus threshold', () => {
    expect(HEMODYNAMICS_NUMBERS.value('plr-response')).toMatch(/10%/)
    expect(HEMODYNAMICS_NUMBERS.value('fluid-responsiveness')).toMatch(/15%/)
    expect(HEMODYNAMICS_NUMBERS.get('plr-response').note).toMatch(/15% threshold belongs/)
  })

  it('states that continuous thermodilution lags, with its numbers', () => {
    expect(HEMODYNAMICS_NUMBERS.value('cco-response-time')).toMatch(/4–12 min/)
    expect(HEMODYNAMICS_NUMBERS.value('cco-response-time')).toMatch(/30–60 s/)
    expect(HEMODYNAMICS_NUMBERS.get('cco-response-time').note).toMatch(/270 s/)
  })

  it('shows the leg-raise numbers beside the fluid-responsiveness numbers', () => {
    render(<HemodynamicsShockProfiles />)
    for (const id of ['plr-position', 'plr-response', 'plr-timing', 'cco-response-time']) {
      expect(document.querySelector(`[data-teaching-number="${id}"]`)).not.toBeNull()
    }
  })
})

describe('the case debrief reads the leg raise for what this monitor can show', () => {
  it('reads baseline, raise and return on the model’s flow, and HD-01 meets the threshold', async () => {
    jest.useFakeTimers()
    await toActions('HD-01')
    raiseLegs(8)
    openDebrief()
    const sequence = document.querySelector('[data-leg-raise-sequence]')?.textContent ?? ''
    inOrder(sequence, /at baseline/, /during the raise/, /model seconds later/)
    expect(sequence).toMatch(/\(\+1\d\.\d%\)/)
    expect(sequence).toContain(HEMODYNAMICS_NUMBERS.value('plr-response'))
    expect(sequence).toMatch(/so this one meets that/)
    expect(sequence).toMatch(/you return the bed and confirm that flow is back at baseline/)
  })

  it('reads HD-02 as short of the threshold, as its expert path says', async () => {
    jest.useFakeTimers()
    await toActions('HD-02')
    raiseLegs(8)
    openDebrief()
    expect(document.querySelector('[data-leg-raise-sequence]')?.textContent).toMatch(
      /so this one falls short of it/,
    )
    const commit = hemodynamicTeachingArtifactByCaseId
      .get('HD-02')!
      .expertTrace.find((step) => step.id === 'hd02-act')!
    expect(commit.cue).toMatch(/without a strong dynamic flow response/)
  })

  it('does not call a series inside the effect the measured response', async () => {
    jest.useFakeTimers()
    await toActions('HD-01')
    raiseLegs(8)
    acquireSeries()
    openDebrief()
    const summary = document.querySelector('[data-leg-raise-summary="performed"]')?.textContent
    expect(summary).toMatch(/Model seconds are compressed/)
    expect(summary).toMatch(/At the bedside a series is too slow for it/)
    expect(summary).not.toMatch(/measured response in this run/)
  })

  it('gives a run with no series no instruction to have shot one', async () => {
    jest.useFakeTimers()
    await toActions('HD-01')
    raiseLegs(8)
    openDebrief()
    const summary = document.querySelector('[data-leg-raise-summary="performed"]')?.textContent
    expect(summary).toMatch(/holds no measured flow response to the leg raise/)
    expect(summary).toMatch(/A thermodilution series is too slow to catch one/)
    expect(summary).not.toMatch(/No thermodilution series was acquired while it lasted/)
  })
})

describe('obstructive shock separates the two sides of the heart', () => {
  const obstructive = HEMODYNAMICS_SHOCK_PROFILES.find((profile) => profile.id === 'obstructive')!
  const pattern = (id: (typeof HEMODYNAMICS_OBSTRUCTIVE_PATTERNS)[number]['id']) =>
    HEMODYNAMICS_OBSTRUCTIVE_PATTERNS.find((item) => item.id === id)!

  it('no longer summarizes obstructive filling pressures as one word', () => {
    expect(obstructive.fillingPressures).not.toBe('High')
    expect(obstructive.fillingPressures).toMatch(/RAP high/)
    expect(obstructive.fillingPressures).toMatch(/wedge depends on the cause/)
  })

  it('teaches a low or normal wedge in pulmonary embolism, with RAP above it', () => {
    const embolism = pattern('pulmonary-embolism')
    expect(embolism.reading).toMatch(/RAP and PA pressures high/)
    expect(embolism.reading).toMatch(/RAP above the wedge/)
    expect(embolism.reading).toMatch(/low or normal/)
    expect(embolism.why).toMatch(/dilated RV compresses a small LV/)
  })

  it('teaches equal pressures in tamponade, and that a low RAP does not exclude it', () => {
    const tamponade = pattern('tamponade')
    expect(tamponade.reading).toContain(HEMODYNAMICS_NUMBERS.value('tamponade-diastolic-pressures'))
    expect(tamponade.reading).toMatch(/about 20 mm Hg/)
    expect(tamponade.reading).toMatch(/6–12 mm Hg in low-pressure tamponade/)
    expect(tamponade.reading).toMatch(/A low RAP does not exclude it/)
  })

  it('claims no wedge for tension pneumothorax, which no source read gives', () => {
    const tension = pattern('tension-pneumothorax')
    expect(`${tension.reading} ${tension.why}`).not.toMatch(/wedge/i)
    expect(tension.why).toMatch(/transmural pressure that fills the heart is low/)
  })

  it('traces every pattern to a source that resolves, with a year and a locator', () => {
    const sourceIds = new Set<string>([
      ...hemodynamicsSources.map((source) => source.id),
      ...HEMODYNAMICS_NUMBER_ONLY_SOURCES.map((source) => source.id),
    ])
    for (const item of HEMODYNAMICS_OBSTRUCTIVE_PATTERNS) {
      expect(item.sources.length).toBeGreaterThan(0)
      for (const source of item.sources) {
        expect({ id: source.sourceId, resolves: sourceIds.has(source.sourceId) }).toEqual({
          id: source.sourceId,
          resolves: true,
        })
        expect(Number.isInteger(source.year)).toBe(true)
        expect(source.locator.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('renders the patterns under the table, marks the case’s own, and shows no source ids', () => {
    render(
      <HemodynamicsShockProfiles highlight="obstructive" highlightCause="pulmonary-embolism" />,
    )
    const row = document.querySelector('[data-shock-profile="obstructive"]')!
    expect(row.textContent).toContain(obstructive.fillingPressures)
    const patterns = document.querySelector('[data-obstructive-patterns]')!
    expect(patterns.textContent).toMatch(/A high RAP does not mean the left ventricle is full/)
    const current = patterns.querySelector('[data-current="true"]')!
    expect(current.getAttribute('data-obstructive-pattern')).toBe('pulmonary-embolism')
    expect(current.textContent).toMatch(/\(this case\)/)
    const shown = document.querySelector('[data-shock-profiles]')!.textContent ?? ''
    expect(shown).not.toMatch(/TEXT-|LIT-/)
  })

  it('points each obstructive case at its own pattern', () => {
    const onTheRow = Object.entries(hemodynamicCaseShockProfile)
      .filter(([, profile]) => profile === 'obstructive')
      .map(([caseId]) => caseId)
    expect(Object.keys(hemodynamicCaseObstructiveCause).sort()).toEqual(onTheRow.sort())
    expect(hemodynamicCaseObstructiveCause).toEqual({
      'HD-04': 'pulmonary-embolism',
      'HD-07': 'tamponade',
    })
  })

  it('holds true of the pressures the two cases model', () => {
    const baseline = (caseId: string) => {
      const definition = hemodynamicCaseById.get(caseId)!
      return modelOnlyMatchedComparison(
        createInitialHemodynamicState(definition, 'practice', 3469),
        definition.interventions[0],
        5,
      ).atAction
    }
    const embolism = baseline('HD-04')
    expect(embolism.rightAtrialMmHg).toBeGreaterThan(embolism.pawpMmHg)
    expect(embolism.pawpMmHg).toBeLessThan(15)
    const tamponade = baseline('HD-07')
    expect(Math.abs(tamponade.rightAtrialMmHg - tamponade.pawpMmHg)).toBeLessThan(1)
    expect(tamponade.pawpMmHg).toBeGreaterThan(15)
  })
})

describe('the interactive cases behave as before', () => {
  it('keeps the leg raise’s identity, timing and model effect', () => {
    expect({
      id: PLR.id,
      category: PLR.category,
      onsetSeconds: PLR.onsetSeconds,
      recoverySeconds: PLR.recoverySeconds,
      parameterDeltas: PLR.parameterDeltas,
    }).toEqual({
      id: 'passive-leg-raise',
      category: 'assessment',
      onsetSeconds: 5,
      recoverySeconds: 35,
      parameterDeltas: { circulatingVolumeFraction: 0.08 },
    })
  })

  it('keeps the keyed mechanisms, priorities, required and unsafe actions', () => {
    const keys = hemodynamicCases
      .filter((definition) => ['HD-01', 'HD-02', 'HD-04', 'HD-07'].includes(definition.id))
      .map((definition) => ({
        id: definition.id,
        mechanism: definition.correctMechanismId,
        priority: definition.correctPriorityId,
        required: definition.requiredInterventionIds,
        unsafe: definition.unsafeInterventionIds,
      }))
    expect(keys).toEqual([
      {
        id: 'HD-01',
        mechanism: 'underfilled',
        priority: 'validate-preload',
        required: ['passive-leg-raise', 'fluid-250'],
        unsafe: ['peep-up-unsafe'],
      },
      {
        id: 'HD-02',
        mechanism: 'vasodilatory',
        priority: 'restore-map',
        required: ['norepinephrine-up'],
        unsafe: ['fluid-250'],
      },
      {
        id: 'HD-04',
        mechanism: 'acute-pulmonary-obstruction',
        priority: 'bridge-and-reperfuse',
        required: ['inhaled-pulmonary-vasodilator', 'pe-reperfusion'],
        unsafe: ['peep-up-unsafe', 'fluid-250'],
      },
      {
        id: 'HD-07',
        mechanism: 'tamponade',
        priority: 'relieve-constraint',
        required: ['pericardial-drainage'],
        unsafe: ['peep-up-unsafe'],
      },
    ])
  })
})
