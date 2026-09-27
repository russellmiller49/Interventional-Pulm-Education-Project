import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { FICK_EPISODES } from '../components/FickMethodWorkbench'
import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { hemodynamicCaseById } from '../content'
import {
  authoredConcernForUnfavourableAction,
  feedbackForHemodynamicAction,
} from '../content/hemodynamicTeaching'
import { hemodynamicsSectionItems } from '../content/stageItems'
import { fickCardiacOutput, type FickInputSet } from '../engine/fick'
import { modelOnlyMatchedComparison } from '../engine/matchedComparison'
import { observedSystemState } from '../engine/decisionRecord'
import { icuHemodynamicsReducer } from '../engine/reducer'
import {
  createInitialHemodynamicState,
  latentPhysiologicalEstimates,
  unroundedModelEstimates,
} from '../engine/simulation'

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

jest.mock('../components/BedsideMonitor', () => ({
  BedsideMonitor: () => <section aria-label="Mock deterministic bedside monitor" />,
}))

jest.mock('../components/FormulaDrawer', () => ({
  FormulaDrawer: () => <div>Mock derived values</div>,
}))

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  })
})

afterEach(cleanup)

/* ------------------------------------------------------------------ *
 * E. Fick and derived-input provenance
 * ------------------------------------------------------------------ */

const BASE: FickInputSet = {
  methodId: 'fick-direct',
  vo2MlMin: 245,
  hemoglobinGDl: 12.4,
  arterialSaturationFraction: 0.97,
  mixedVenousSaturationFraction: 0.68,
  venousSampleSite: 'pulmonary-artery',
  arterialPo2MmHg: null,
  venousPo2MmHg: null,
  includeDissolvedOxygen: false,
  steadyState: true,
  samplesPairedInTime: true,
  intracardiacShuntPresent: false,
}

describe('E. Fick inputs keep their site, their gaps and their precision', () => {
  it('names an SVC specimen for what it is and withholds without substituting it', () => {
    const svc = fickCardiacOutput({ ...BASE, venousSampleSite: 'superior-vena-cava' })
    const labels = Object.fromEntries(svc.trace.map((row) => [row.id, row.label]))
    expect(labels['mixed-venous-saturation']).toBe(
      'Central venous oxygen saturation (superior vena cava specimen)',
    )
    expect(labels['mixed-venous-content']).toBe(
      'Central venous oxygen content (superior vena cava specimen)',
    )
    expect(svc.status).toBe('withheld')
    expect(svc.cardiacOutputLMin).toBeNull()
    expect(svc.withheldReasonKinds).toEqual(['not-mixed-venous'])
    expect(svc.withheldReasons[0]).toMatch(/does not substitute one for the other/)
  })

  it('tells a missing arterial specimen from a contradictory pair', () => {
    const missing = fickCardiacOutput({
      ...BASE,
      arterialSaturationFraction: null,
      mixedVenousSaturationFraction: 0.99,
    })
    expect(missing.withheldReasonKinds).toEqual(['missing-input'])
    expect(missing.withheldReasons.join(' ')).not.toMatch(/contradict/)
    expect(missing.trace.find((row) => row.id === 'arterial-saturation')?.display).toBe(
      'Not available',
    )

    const contradictory = fickCardiacOutput({ ...BASE, mixedVenousSaturationFraction: 0.99 })
    expect(contradictory.withheldReasonKinds).toEqual(['contradictory-inputs'])

    // The workbench's fifth episode keeps its inputs (no arterial value is inferred) and its title
    // now says what they are.
    const fifth = FICK_EPISODES.find((episode) => episode.id === 'contradictory-inputs')!
    expect(fifth.inputs.arterialSaturationFraction).toBeNull()
    expect(fifth.label).toBe('A missing arterial specimen')
    expect(fifth.whatHappened).not.toMatch(/higher than the arterial one/)
  })

  it('computes from unrounded contents and explains the 1.99 versus 2.00', () => {
    const narrow = fickCardiacOutput({ ...BASE, mixedVenousSaturationFraction: 0.85 })
    const arterial = 1.34 * 12.4 * 0.97
    const venous = 1.34 * 12.4 * 0.85
    expect(narrow.contentDifferenceUnroundedMlDl).toBeCloseTo(arterial - venous, 12)
    expect(narrow.cardiacOutputUnroundedLMin).toBeCloseTo(245 / ((arterial - venous) * 10), 12)
    const difference = narrow.unitAccount.find((line) => line.startsWith('Difference'))!
    expect(difference).toMatch(/16\.12 mL\/dL − 14\.12 mL\/dL ≈ 1\.99 mL\/dL/)
    expect(difference).toMatch(/16\.1175 − 14\.1236 = 1\.9939/)
    expect(difference).toMatch(/rounded figures alone would give 2\.00/)
    // When the rounded figures do reproduce the printed difference, the line says nothing extra.
    const plain = fickCardiacOutput(BASE).unitAccount.find((line) => line.startsWith('Difference'))!
    expect(plain).not.toMatch(/≈/)
  })
})

/* ------------------------------------------------------------------ *
 * G. only outcomes the learner could have
 * ------------------------------------------------------------------ */

describe('G. the leg raise, the unfavourable choice and the case briefs', () => {
  it('P-04: the leg raise promises no endpoint the monitor lacks, and records no latent flow', () => {
    const hd01 = hemodynamicCaseById.get('HD-01')!
    const plr = hd01.interventions.find((item) => item.id === 'passive-leg-raise')!
    expect(plr.label).not.toMatch(/stroke-volume endpoint/)
    expect(plr.response).toMatch(/no continuous cardiac-output or stroke-volume channel/)
    const feedback = feedbackForHemodynamicAction(hd01, plr, false)
    expect(feedback.theCue).toMatch(/thermodilution series acquired while the leg raise lasts/)
    expect(feedback.theCue).not.toMatch(/Watch the flow trend/)

    let state = createInitialHemodynamicState(hd01, 'practice', 3282)
    state = icuHemodynamicsReducer(state, { type: 'APPLY_INTERVENTION', intervention: plr })
    state = icuHemodynamicsReducer(state, { type: 'TICK', seconds: 15 })
    // The model's flow rose; nothing acquired says so, and the record does not either.
    expect(unroundedModelEstimates(state).cardiacOutputLMin).toBeGreaterThan(
      unroundedModelEstimates(createInitialHemodynamicState(hd01, 'practice', 3282))
        .cardiacOutputLMin,
    )
    expect(observedSystemState(state).flow).toBeNull()
    expect(observedSystemState(state).earlierFlow).toBeNull()
  })

  it('P-08: the matched model-only comparison reports what this model does, nothing more', () => {
    const hd03 = hemodynamicCaseById.get('HD-03')!
    const fluid = hd03.interventions.find((item) => item.id === 'fluid-250')!
    const start = createInitialHemodynamicState(hd03, 'practice', 3268)
    const first = modelOnlyMatchedComparison(start, fluid, 30)
    const again = modelOnlyMatchedComparison(start, fluid, 30)
    expect(again).toEqual(first)
    expect(first.atSeconds).toBe(start.timeSeconds + 30)
    // Congestion the model does contain: the occlusion-pressure estimate rises with the volume step.
    expect(first.withAction.pawpMmHg).toBeGreaterThan(first.withoutAction.pawpMmHg)
    // Oxygenation it does not: SpO2 is identical with and without, and the debrief says so.
    expect(first.withAction.spo2Percent).toBe(first.withoutAction.spo2Percent)
    // The comparison leaves the learner's state untouched.
    expect(start.completedInterventionIds).toEqual([])

    expect(authoredConcernForUnfavourableAction(hd03, 'fluid-250')).toBe(
      'Additional volume cannot be inferred to improve flow and can worsen pulmonary congestion.',
    )
    const hd04 = hemodynamicCaseById.get('HD-04')!
    expect(authoredConcernForUnfavourableAction(hd04, 'fluid-250')).toBe(hd04.guidedPrompt)
    const hd05 = hemodynamicCaseById.get('HD-05')!
    expect(authoredConcernForUnfavourableAction(hd05, 'fluid-250')).toBeNull()
  })

  it('P-12 and L9-03: briefs say what the case shows; unsupported references are gone', () => {
    const hd07 = hemodynamicCaseById.get('HD-07')!
    expect(hd07.presentation).not.toMatch(/hypotension/)
    const state = createInitialHemodynamicState(hd07, 'practice', 3000)
    // The brief no longer contradicts the modeled pressure it opens on.
    expect(latentPhysiologicalEstimates(state).mapMmHg).toBeGreaterThan(65)
    // On the unzeroed line it displays higher still; neither is below the module's MAP threshold.
    expect(unroundedModelEstimates(state).mapMmHg).toBeGreaterThan(
      latentPhysiologicalEstimates(state).mapMmHg,
    )

    const hd08 = hemodynamicCaseById.get('HD-08')!
    expect(hd08.presentation).not.toMatch(/erratic thermodilution curves/)
    expect(hd08.presentation).toMatch(/curves are not available in this case/)
    expect(createInitialHemodynamicState(hd08, 'learn', 808).thermodilutionTrials).toEqual([])
    const stem = hemodynamicsSectionItems('pac-signal-validation').prediction.stem
    expect(stem).toMatch(/reported at that check/)
    expect(stem).toMatch(/not available to review/)
  })
})

/* ------------------------------------------------------------------ *
 * The case host: what the learner reads
 * ------------------------------------------------------------------ */

function interventionCard(id: string): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-intervention="${id}"]`)!
}

function openCheckpoint(name: RegExp) {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Case checkpoints' })).getByRole('button', {
      name,
    }),
  )
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
  openCheckpoint(/Review your reasoning/)
  fireEvent.click(
    screen.getByRole('button', { name: 'Show the teaching without recording a frame' }),
  )
}

describe('the case debrief names what happened in this run', () => {
  it('P-08: names the fluid step, quotes the case’s own concern, and states the model’s limits', async () => {
    jest.useFakeTimers()
    try {
      await toActions('HD-03')
      fireEvent.click(interventionCard('fluid-250'))
      act(() => {
        jest.advanceTimersByTime(3000)
      })
      openDebrief()
      const block = document.querySelector('[data-unfavourable-action="fluid-250"]')!
      expect(block.textContent).toMatch(/This case lists it among its unfavourable choices/)
      expect(block.textContent).toMatch(
        /Additional volume cannot be inferred to improve flow and can worsen pulmonary congestion/,
      )
      expect(block.textContent).toMatch(/not by itself benefit/)
      expect(block.textContent).toMatch(/does not model oxygenation or lung water/)
      expect(block.textContent).toMatch(
        /No thermodilution series was acquired after it, so this run holds no measurement of whether flow changed/,
      )
      const table = block.querySelector('[data-model-only-comparison]')!
      expect(table.textContent).toMatch(/not anything the monitor\s+displayed or you acquired/)
      expect(table.textContent).toMatch(/free of this run’s measurement-system error/)
      expect(table.textContent).toMatch(/30 model seconds after Fluid \+250 mL/)
      // Nothing here scores, grades or penalizes.
      const summary = document.querySelector('[data-case-run-summary]')!
      expect(summary.textContent).not.toMatch(/\b(score|points|grade|penalt)/i)
      expect(summary.querySelector('[data-model-time]')?.textContent).toMatch(/compressed/)
    } finally {
      jest.useRealTimers()
    }
  })

  it('P-04: says a leg raise without a series during it holds no measured response', async () => {
    jest.useFakeTimers()
    try {
      await toActions('HD-01')
      fireEvent.click(interventionCard('passive-leg-raise'))
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      openCheckpoint(/Compare the response/)
      const modelOnly = document.querySelector('[data-model-only-flow]')!
      expect(modelOnly.textContent).toMatch(
        /Model-only flow during the leg raise — not a measurement/,
      )
      expect(modelOnly.textContent).toMatch(
        /not a cardiac-output, stroke-volume or VTI measurement/,
      )
      openDebrief()
      const legRaise = document.querySelector('[data-leg-raise-summary="performed"]')!
      expect(legRaise.textContent).toMatch(/holds no measured flow response to the leg raise/)
      // The decision trace carries no cardiac index for this run.
      const rows = [...document.querySelectorAll('ol li')]
        .map((row) => row.textContent ?? '')
        .filter((text) => text.includes('Model +'))
      for (const row of rows) expect(row).toMatch(/cardiac index not acquired/)
    } finally {
      jest.useRealTimers()
    }
  })

  it('debrief-first: opening the debrief before any action claims no response and no flow', async () => {
    await toActions('HD-01')
    openDebrief()
    const summary = document.querySelector('[data-case-run-summary]')!
    expect(summary.querySelector('[data-leg-raise-summary="not-performed"]')).not.toBeNull()
    expect(summary.querySelector('[data-unfavourable-actions]')).toBeNull()
    expect(summary.querySelector('[data-pressure-versus-flow]')).toBeNull()
    expect(document.querySelector('[data-debrief-before-reassessment]')).not.toBeNull()
  })

  it('reset: a new run keeps nothing of the old one’s actions or measurements', async () => {
    jest.useFakeTimers()
    try {
      await toActions('HD-03')
      fireEvent.click(interventionCard('fluid-250'))
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Reset case' }))
      openDebrief()
      expect(document.querySelector('[data-unfavourable-actions]')).toBeNull()
      const rows = [...document.querySelectorAll('ol li')]
        .map((row) => row.textContent ?? '')
        .filter((text) => text.includes('Model +'))
      expect(rows).toEqual([])
    } finally {
      jest.useRealTimers()
    }
  })

  it('P-12: the brief says model time is compressed', async () => {
    await toActions('HD-06')
    expect(document.querySelector('[data-model-time]')?.textContent).toMatch(
      /not a clinical time course/,
    )
  })
})
