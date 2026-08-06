import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import { NORMAL_WAVEFORM_ANATOMY_POSITION_LABELS } from '../components/NormalWaveformAnatomyFigure'
import { NormalWaveformReference } from '../components/NormalWaveformReference'
import { NormalWaveformValidityChallenges } from '../components/NormalWaveformValidityChallenges'
import { PacAdvancementReasoningPanel } from '../components/PacAdvancementReasoningPanel'
import {
  PacGuidedSkillActivity,
  pacGuidedObjectiveComplete,
} from '../components/PacGuidedSkillActivity'
import { PA_RETURN_CHECK, PawpSafetySequencePanel } from '../components/PawpSafetySequencePanel'
import {
  NORMAL_WAVEFORM_DETAIL_SCALE_MAX_MMHG,
  NORMAL_WAVEFORM_INTERPRETATION_WITHHELD,
  NORMAL_WAVEFORM_RESPIRATORY_CONTEXT,
  NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG,
  PAWP_BALLOON_NUMBERS_BOUNDARY,
  advancementMayContinue,
  advancementStopReasons,
  hemodynamicCaseById,
  hemodynamicsSourceById,
  normalWaveformAtlasEntry,
  normalWaveformReference,
  normalWaveformReferenceTextEquivalent,
  normalWaveformScaleOption,
  normalWaveformValidityChallenges,
  pacAdvancementScenarios,
  pacLearningPathwaySections,
  pawpCaptureSteps,
  pawpOcclusionOutcomes,
  pawpPlausibilityCommitment,
  pawpRecoveryCommitment,
  pawpRecoveryOutcomes,
  safeAdvancementCommitments,
  type PacLearningPathwaySectionId,
} from '../content'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_VERSION,
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  type HemodynamicSimulationState,
} from '../engine'
import {
  ICU_HEMODYNAMICS_CONTENT_VERSION,
  ICU_HEMODYNAMICS_RELEASE_STAGE,
} from '../content/release'

/**
 * H2/H3 — one canonical normal reference, and PAC work that reasons about safety continuously.
 *
 * The two failures this package is built against are both failures of *sufficiency*. H2's is a
 * learner who can name four tracings and names them just as confidently when the display is broken.
 * H3's is a learner who treats a matching waveform as permission to keep going, and who counts a
 * PAWP finished when the balloon is down.
 *
 * These pin both, and they pin them at the level where they can actually be broken: the derivation
 * that decides whether advancing is safe, the predicate that decides whether the wedge station is
 * complete, and the rendered surfaces that have to agree with them.
 */

const push = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}))

const EXPECTED_ORDER: readonly PacLearningPathwaySectionId[] = [
  'pressure-system',
  'waveform-interpretation',
  'catheter-advancement',
  'pawp-capture',
  'thermodilution-series',
  'derived-hemodynamics',
  'pac-signal-validation',
]

/** Every string a learner can read from the records this package added. */
function newLearnerCopy(): readonly string[] {
  return [
    ...normalWaveformReference.flatMap((entry) => [
      entry.physicalLocation,
      entry.expectedMorphology,
      entry.ecgRelation,
      entry.pressureDirection,
      entry.expectedChangeFromPrevious,
      entry.respiratoryVariation,
      entry.technicalDistortion,
      entry.unsafeToInterpret,
      entry.cannotEstablish,
      ...entry.technicalDistortions.flatMap((distortion) => [
        distortion.label,
        distortion.whatYouSee,
        distortion.whatItMimics,
      ]),
    ]),
    NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.readingRule,
    NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.spontaneousContrast,
    NORMAL_WAVEFORM_RESPIRATORY_CONTEXT.renderingBoundary,
    ...normalWaveformValidityChallenges.flatMap((challenge) => [
      challenge.label,
      challenge.whatYouSee,
      challenge.whatItInvites,
      challenge.whyInterpretationIsWithheld,
      challenge.repairFirst,
      challenge.figureTextEquivalent,
    ]),
    ...pacAdvancementScenarios.flatMap((scenario) => [
      scenario.title,
      scenario.signalValidity.statement,
      scenario.currentTracing.statement,
      scenario.rhythm.statement,
      scenario.patient.statement,
      scenario.resistance.statement,
      scenario.balloon.statement,
      scenario.depth.statement,
      scenario.observed,
      scenario.reconciliation,
      scenario.justification,
      scenario.unsourcedBoundary ?? '',
    ]),
    ...pawpCaptureSteps.flatMap((step) => [
      step.question,
      step.whatYouDo,
      step.whatItEstablishes,
      step.whatItDoesNotEstablish,
    ]),
    ...pawpOcclusionOutcomes.flatMap((outcome) => [
      outcome.label,
      outcome.whatYouSee,
      outcome.verdict,
      outcome.nextAction,
    ]),
    ...pawpRecoveryOutcomes.flatMap((outcome) => [
      outcome.label,
      outcome.whatYouSee,
      outcome.whatItMeans,
      outcome.requiredResponse,
    ]),
    PAWP_BALLOON_NUMBERS_BOUNDARY,
  ].filter((entry) => entry.length > 0)
}

function pawpState(
  overrides: Partial<HemodynamicSimulationState['catheter']> = {},
  checks: readonly string[] = [],
): HemodynamicSimulationState {
  const definition = hemodynamicCaseById.get('HD-01')
  if (!definition) throw new Error('HD-01 is required for the wedge station.')
  const base = icuHemodynamicsReducer(createInitialHemodynamicState(definition, 'learn', 7), {
    type: 'SET_CATHETER_POSITION',
    position: 'pa',
  })
  return {
    ...base,
    catheter: { ...base.catheter, storedWedgeMmHg: 11, ...overrides },
    signalValidationChecks: checks,
  }
}

describe('H2 canonical normal waveform reference', () => {
  it('is one model covering RA, RV, PA, and wedge exactly once, in insertion order', () => {
    expect(normalWaveformReference.map((entry) => entry.position)).toEqual([
      'ra',
      'rv',
      'pa',
      'wedge',
    ])
    expect(normalWaveformReference.map((entry) => entry.order)).toEqual([1, 2, 3, 4])
    expect(new Set(normalWaveformReference.map((entry) => entry.atlasEntryId)).size).toBe(4)
  })

  it('keeps anatomy, waveform, ECG, respiration, scale, and the text equivalent on one record', () => {
    for (const entry of normalWaveformReference) {
      const atlasEntry = normalWaveformAtlasEntry(entry)
      const text = normalWaveformReferenceTextEquivalent(entry)

      // The text equivalent is assembled from the same authored facets the figure and the definition
      // list render, so a graphic and its alternative cannot describe different states.
      expect(text).toContain(atlasEntry.label)
      expect(text).toContain(entry.physicalLocation)
      expect(text).toContain(entry.expectedMorphology)
      expect(text).toContain(entry.ecgRelation)
      expect(text).toContain(entry.expectedChangeFromPrevious)
      expect(text).toContain(entry.respiratoryVariation)
      expect(text).toContain(entry.unsafeToInterpret)
      expect(text).toContain(entry.cannotEstablish)
      expect(text).toContain(`0 to ${NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG} ${entry.displayUnit}`)
      for (const annotation of atlasEntry.annotations) {
        expect(text).toContain(annotation.description)
      }
      expect(entry.respiratorySwingMmHg).toBeGreaterThan(0)
    }
  })

  it('renders every state against one shared axis, so no scale change is silent', () => {
    render(<NormalWaveformReference />)

    for (const entry of normalWaveformReference) {
      fireEvent.click(
        screen.getByRole('tab', { name: new RegExp(normalWaveformAtlasEntry(entry).shortLabel) }),
      )
      const figure = screen.getByRole('img', { name: /Displayed axis: 0 to/i })
      // The figure's own description is the state's text equivalent, so the graphic and its
      // alternative cannot describe different axes or different chambers.
      expect(figure.getAttribute('aria-label')).toBe(normalWaveformReferenceTextEquivalent(entry))
      expect(figure.getAttribute('aria-label')).toContain(
        `0 to ${NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG} mmHg`,
      )
      // And the axis that was actually drawn agrees with what the description claims. Asserting the
      // description alone would pass while the figure quietly reverted to the atlas entry's own
      // per-entry scale, which is the exact regression the shared axis exists to prevent.
      const drawnTicks = within(figure.closest('figure') as HTMLElement)
        .getAllByText(/^\d+$/)
        .map((node) => Number(node.textContent))
      expect(Math.max(...drawnTicks)).toBe(NORMAL_WAVEFORM_SHARED_SCALE_MAX_MMHG)
      // The anatomy and the trace name the same chamber at the same moment. Both the caption and
      // the image description are checked against the position-derived label, because the prose
      // location is passed straight through and would keep reading correctly while the drawn tip
      // sat somewhere else entirely.
      const anatomyLabel = NORMAL_WAVEFORM_ANATOMY_POSITION_LABELS[entry.position]
      expect(screen.getByText(`Catheter tip: ${anatomyLabel}`)).toBeInTheDocument()
      const anatomy = screen
        .getByRole('img', { name: /Right-heart schematic/i })
        .getAttribute('aria-label')
      expect(anatomy).toContain(`The catheter tip is in the ${anatomyLabel.toLowerCase()}.`)
      expect(anatomy).toContain(entry.physicalLocation)
    }
  })

  it('announces a scale change in words rather than silently redrawing', () => {
    render(<NormalWaveformReference />)

    const shared = normalWaveformScaleOption('shared')
    const detail = normalWaveformScaleOption('low-pressure-detail')
    expect(screen.getByRole('status')).toHaveTextContent(/Heights are comparable across chambers/i)

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(detail.label) }))

    const notice = screen.getByRole('status')
    expect(notice).toHaveAttribute('data-changed', 'true')
    expect(notice).toHaveTextContent(/No pressure has changed/i)
    expect(notice).toHaveTextContent(new RegExp(`0–${NORMAL_WAVEFORM_DETAIL_SCALE_MAX_MMHG} mmHg`))
    expect(shared.maxMmHg).not.toBe(detail.maxMmHg)
    expect(
      screen.getByRole('img', { name: /Displayed axis: 0 to/i }).getAttribute('aria-label'),
    ).toContain(`0 to ${NORMAL_WAVEFORM_DETAIL_SCALE_MAX_MMHG} mmHg`)
  })

  it('resolves every claim it shows to a registered source', () => {
    for (const entry of normalWaveformReference) {
      expect(entry.evidenceIds.length).toBeGreaterThan(0)
      for (const sourceId of entry.evidenceIds) {
        expect(hemodynamicsSourceById.has(sourceId)).toBe(true)
      }
      for (const distortion of entry.technicalDistortions) {
        expect(distortion.sourceIds.length).toBeGreaterThan(0)
        for (const sourceId of distortion.sourceIds) {
          expect(hemodynamicsSourceById.has(sourceId)).toBe(true)
        }
      }
    }
  })

  it('states no balloon volume and no inflation-time limit anywhere it added copy', () => {
    const volume = /\b\d+(\.\d+)?\s*(ml\b|millilit|cc\b)/i
    const inflationDuration =
      /\b(inflat|occlu|wedge|balloon)[^.]{0,80}\b\d+(\.\d+)?\s*(second|sec\b|s\b|minute)/i
    for (const text of newLearnerCopy()) {
      expect(text).not.toMatch(volume)
      expect(text).not.toMatch(inflationDuration)
    }
    // The boundary is stated instead of the number, and it names where the number comes from.
    expect(PAWP_BALLOON_NUMBERS_BOUNDARY).toMatch(/manufacturer/i)
    expect(PAWP_BALLOON_NUMBERS_BOUNDARY).toMatch(/local procedure protocol/i)
    expect(PAWP_BALLOON_NUMBERS_BOUNDARY).toMatch(/not a clinical limit/i)
  })

  it('puts the normal reference before advancement in the learner experience', () => {
    const referenceIndex = pacLearningPathwaySections.findIndex(
      (section) => section.id === 'waveform-interpretation',
    )
    const advancementIndex = pacLearningPathwaySections.findIndex(
      (section) => section.id === 'catheter-advancement',
    )
    expect(referenceIndex).toBeGreaterThanOrEqual(0)
    expect(referenceIndex).toBeLessThan(advancementIndex)
  })

  it('opens the waveform station on the reference rather than on an abnormality', async () => {
    const { container } = render(<PacGuidedSkillActivity skillId="waveform-interpretation" />)
    expect(
      await screen.findByRole('heading', { name: 'Interpret normal and abnormal waveforms' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /What each chamber is supposed to look like/i }),
    ).toBeInTheDocument()
    assertNoUniversalTargetLanguage(container.textContent ?? '')
  })
})

describe('H2 signal validity prevents a confident interpretation', () => {
  it('covers every representative display problem', () => {
    expect(normalWaveformValidityChallenges.map((challenge) => challenge.faultKind).sort()).toEqual(
      [
        'level-or-zero',
        'mislabeled-channel',
        'motion-artifact',
        'overdamped',
        'respiratory-phase-mismatch',
        'scale-mismatch',
        'underdamped',
      ].sort(),
    )
    for (const challenge of normalWaveformValidityChallenges) {
      expect(challenge.figureTextEquivalent.length).toBeGreaterThan(0)
      for (const sourceId of challenge.sourceIds) {
        expect(hemodynamicsSourceById.has(sourceId)).toBe(true)
      }
    }
  })

  it('never names a chamber from a faulted display, before or after the commitment', () => {
    render(<NormalWaveformValidityChallenges />)

    const readout = () => screen.getByText(/Chamber readout/i).closest('p')
    expect(readout()).toHaveTextContent(/Not established yet/i)
    expect(readout()).not.toHaveTextContent(/right atrium|right ventricle|pulmonary artery/i)

    const challenge = normalWaveformValidityChallenges[0]!
    fireEvent.click(
      screen.getByRole('radio', {
        name: new RegExp(escape(challenge.commitment.choices[0]!.label.slice(0, 40))),
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit this reading' }))

    expect(readout()).toHaveTextContent(NORMAL_WAVEFORM_INTERPRETATION_WITHHELD)
    expect(readout()).toHaveAttribute('data-withheld', 'true')
  })

  it('withholds the reasoning until the learner commits', () => {
    render(<NormalWaveformValidityChallenges />)
    const challenge = normalWaveformValidityChallenges[0]!

    expect(screen.queryByText(challenge.whyInterpretationIsWithheld)).not.toBeInTheDocument()
    expect(screen.queryByText(challenge.commitment.explanation)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit this reading' })).toBeDisabled()

    fireEvent.click(screen.getAllByRole('radio')[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Commit this reading' }))

    expect(screen.getByText(challenge.whyInterpretationIsWithheld)).toBeInTheDocument()
    expect(screen.getByText(challenge.commitment.explanation)).toBeInTheDocument()
  })

  it('does not gate the route: every station stays reachable and the merged order is unchanged', () => {
    expect(pacLearningPathwaySections.map((section) => section.id)).toEqual(EXPECTED_ORDER)
    for (const section of pacLearningPathwaySections) {
      const activity = criticalCareActivityById.get(`hemodynamics:learn:${section.id}`)
      expect(activity).toBeDefined()
      // Nothing this package added changes how a station is addressed.
      expect(section.activityId).toBe(`hemodynamics:learn:${section.id}`)
    }
  })
})

describe('H3 advancement reasons about safety continuously', () => {
  it('derives whether continuing is safe without looking at the waveform match', () => {
    const stopScenarios = pacAdvancementScenarios.filter((scenario) => scenario.kind === 'stop')
    expect(stopScenarios.length).toBeGreaterThan(0)

    for (const scenario of stopScenarios) {
      expect(advancementMayContinue(scenario)).toBe(false)
      expect(safeAdvancementCommitments(scenario)).not.toContain('advance')
      expect(advancementStopReasons(scenario).length).toBeGreaterThan(0)
    }
  })

  it('does not let an expected waveform override a stop condition', () => {
    // The cases that matter: the tracing matches the reference for the chamber the catheter is in,
    // and something else says stop anyway.
    const matchingButStopped = pacAdvancementScenarios.filter(
      (scenario) =>
        scenario.currentTracing.matchesPosition !== null &&
        !scenario.currentTracing.concerning &&
        advancementStopReasons(scenario).length > 0,
    )
    expect(matchingButStopped.length).toBeGreaterThanOrEqual(4)

    for (const scenario of matchingButStopped) {
      expect(advancementMayContinue(scenario)).toBe(false)
      const advanceChoice = scenario.commitment.choices.find((choice) => choice.id === 'advance')
      expect(advanceChoice?.plausibility).toBe('unsafe')
      expect(scenario.commitment.correctChoiceIds).not.toContain('advance')
    }
  })

  it('represents every stop category the package requires', () => {
    const covered = new Set(pacAdvancementScenarios.flatMap(advancementStopReasons))
    for (const reason of [
      'signal-invalid',
      'unexpected-waveform',
      'position-depth-mismatch',
      'resistance',
      'rhythm-concern',
      'patient-deterioration',
      'balloon-state-unresolved',
    ]) {
      expect([...covered]).toContain(reason)
    }
  })

  it('teaches recognition and escalation for resistance rather than a threshold or a management algorithm', () => {
    const resistance = pacAdvancementScenarios.find((scenario) => scenario.id === 'rv-resistance')
    expect(resistance).toBeDefined()
    expect(resistance!.unsourcedBoundary).toMatch(/how much is too much/i)
    expect(resistance!.unsourcedBoundary).toMatch(/knotting/i)
    expect(resistance!.unsourcedBoundary).toMatch(/not a source-derived rule/i)
    // No number attaches to resistance anywhere.
    expect(resistance!.resistance.statement).not.toMatch(/\d/)
    expect(resistance!.commitment.correctChoiceIds).toEqual(['escalate'])
  })

  it('withholds the reasoning until the learner commits, and continues only on a separate action', () => {
    render(<PacAdvancementReasoningPanel />)
    const scenario = pacAdvancementScenarios[0]!

    expect(screen.queryByText(scenario.observed)).not.toBeInTheDocument()
    expect(screen.queryByText(scenario.justification)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Continue to the next situation/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('radio')[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Commit this decision' }))

    expect(screen.getByText(scenario.observed)).toBeInTheDocument()
    expect(screen.getByText(scenario.justification)).toBeInTheDocument()
    // Committing revealed the reasoning and moved nothing.
    expect(screen.getByText(/Situation 1 of/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Continue to the next situation/i }),
    ).toBeInTheDocument()
  })

  it('says in words that a matching waveform changes nothing when something says stop', () => {
    render(<PacAdvancementReasoningPanel />)
    const index = pacAdvancementScenarios.findIndex(
      (scenario) => scenario.id === 'rv-ectopy-despite-textbook-waveform',
    )
    expect(index).toBeGreaterThan(-1)

    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(pacAdvancementScenarios[index]!.title),
      }),
    )
    fireEvent.click(screen.getAllByRole('radio')[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Commit this decision' }))

    expect(
      screen.getByText(
        /Continuing is not safe\. A stop condition outranks a matching waveform every time/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/A waveform confirms which chamber the tip is in/i)).toBeInTheDocument()
    const reasons = screen.getByRole('list', { name: 'Reasons to stop here' })
    expect(within(reasons).getByText(/rhythm needs attention/i)).toBeInTheDocument()
  })

  it('keeps the supervised-simulation and non-competency boundary visible', () => {
    render(<PacAdvancementReasoningPanel />)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(/Supervised simulation/i)
    expect(note).toHaveTextContent(/does not establish the ability to place or manage/i)
    expect(note).toHaveTextContent(/manufacturer instructions/i)
    expect(note).toHaveTextContent(/direct supervision/i)
  })

  it('keeps the prebrief acknowledgement ahead of the manipulation controls', async () => {
    render(<PacGuidedSkillActivity skillId="catheter-advancement" />)
    expect(
      await screen.findByRole('heading', { name: 'Advance the PAC by waveform' }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: /What this section is, and what it is not/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Orient to this skill station' })).toBeDisabled()
    expect(
      screen.getByText(
        /simulated advancement controls open once you have read the safety prebrief/i,
      ),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'I have read the prebrief — open the simulated advancement',
      }),
    )
    expect(screen.getByRole('button', { name: 'Orient to this skill station' })).toBeEnabled()
  })
})

describe('H3 PAWP acquisition closes its safety loop', () => {
  it('runs an explicit nine-step sequence that ends on the return of the PA waveform', () => {
    expect(pawpCaptureSteps.map((step) => step.id)).toEqual([
      'confirm-pa-signal',
      'confirm-balloon-state',
      'predict-occlusion',
      'commit',
      'observe',
      'judge-plausibility',
      'deflate',
      'confirm-pa-return',
      'withhold-or-continue',
    ])
    for (const step of pawpCaptureSteps) {
      expect(step.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of step.sourceIds) {
        expect(hemodynamicsSourceById.has(sourceId)).toBe(true)
      }
    }
  })

  it('shows the balloon state as words in the interface', () => {
    const inflated = pawpState({ balloonInflated: true, position: 'wedge' })
    const { rerender } = render(
      <PawpSafetySequencePanel state={inflated} onRecoveryConfirmed={jest.fn()} />,
    )
    expect(screen.getByText(/Occlusion balloon INFLATED/i)).toBeInTheDocument()

    rerender(<PawpSafetySequencePanel state={pawpState()} onRecoveryConfirmed={jest.fn()} />)
    expect(screen.getByText(/Balloon DEFLATED\. Nothing is occluding/i)).toBeInTheDocument()
  })

  it('refuses to let a wedge-like shape alone establish a valid PAWP', () => {
    const best = pawpPlausibilityCommitment.choices.find((choice) => choice.plausibility === 'best')
    expect(pawpPlausibilityCommitment.correctChoiceIds).toEqual([best!.id])
    expect(best!.label).toMatch(/reconciled with the signal validity/i)

    const shapeIsEnough = pawpPlausibilityCommitment.choices.find(
      (choice) => choice.id === 'shape-establishes-wedge',
    )
    expect(shapeIsEnough?.plausibility).toBe('unsafe')

    // Two of the three things an occlusion can produce are not interpretable at all.
    expect(pawpOcclusionOutcomes.filter((outcome) => !outcome.plausiblyInterpretable)).toHaveLength(
      2,
    )
    const wedgeEntry = normalWaveformReference.find((entry) => entry.position === 'wedge')
    expect(wedgeEntry?.cannotEstablish).toMatch(/does not establish a valid PAWP/i)
  })

  it('does not caption a post-deflation tracing with the state it was authored for', () => {
    render(<PawpSafetySequencePanel state={pawpState()} onRecoveryConfirmed={jest.fn()} />)

    // Both recovery cards reuse an atlas trace for its shape. The wedge entry's own caption says the
    // balloon is inflated at the pulmonary-artery position, which sat directly beneath this card's
    // "balloon deflated" label and contradicted it.
    for (const outcome of pawpRecoveryOutcomes) {
      const card = screen.getByText(outcome.label).closest('li') as HTMLElement
      expect(within(card).getByText(/Balloon DEFLATED · depth unchanged/i)).toBeInTheDocument()
      expect(card.textContent ?? '').not.toMatch(/Balloon inflated at the pulmonary artery/i)
    }
  })

  it('never permits continuation from a state where the PA waveform did not return', () => {
    const missing = pawpRecoveryOutcomes.find((outcome) => !outcome.paWaveformReturned)
    expect(missing).toBeDefined()
    expect(missing!.continuationPermitted).toBe(false)
    expect(missing!.requiredResponse).toMatch(/escalate/i)
    expect(pawpRecoveryCommitment.correctChoiceIds).toEqual(['treat-as-unsafe-and-escalate'])
  })

  it('records the return only after the learner assesses both post-deflation states', () => {
    const onRecoveryConfirmed = jest.fn()
    render(
      <PawpSafetySequencePanel state={pawpState()} onRecoveryConfirmed={onRecoveryConfirmed} />,
    )

    expect(
      screen.getByText(/Return of the pulmonary-artery waveform has not been assessed yet/i),
    ).toBeInTheDocument()
    expect(onRecoveryConfirmed).not.toHaveBeenCalled()

    const returns = screen.getByText(/pulsatility and the notch return/i).closest('li')!
    const persists = screen.getByText(/occlusion morphology persists/i).closest('li')!
    fireEvent.click(within(returns).getByRole('radio', { name: /Yes —/i }))
    fireEvent.click(within(persists).getByRole('radio', { name: /No —/i }))

    // Both observations are in, and the sequence still is not finished: what follows has to be
    // committed to as well.
    expect(onRecoveryConfirmed).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('radio', { name: /Treat the signal and the catheter position as unsafe/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit what follows' }))

    expect(onRecoveryConfirmed).toHaveBeenCalled()
    expect(
      screen.getByText(/has been assessed in both states. This station will accept completion/i),
    ).toBeInTheDocument()
  })

  it('withholds the objective until the return is assessed, and after a forced recovery', () => {
    // Stored, deflated, back at PA — everything the station used to count as finished.
    expect(pacGuidedObjectiveComplete('pawp-capture', pawpState())).toBe(false)

    // The prolonged-inflation recovery reaches exactly that state on its own, so it must not count.
    expect(
      pacGuidedObjectiveComplete(
        'pawp-capture',
        pawpState({ forcedSafetyRecovery: true }, [PA_RETURN_CHECK]),
      ),
    ).toBe(false)

    expect(pacGuidedObjectiveComplete('pawp-capture', pawpState({}, [PA_RETURN_CHECK]))).toBe(true)
  })
})

describe('H2/H3 non-regression', () => {
  it('leaves the merged pathway order, ids, and routes untouched', () => {
    expect(pacLearningPathwaySections.map((section) => section.id)).toEqual(EXPECTED_ORDER)
    expect(pacLearningPathwaySections[0]?.id).toBe('pressure-system')
    expect(pacLearningPathwaySections.at(-1)?.id).toBe('pac-signal-validation')

    const ids = pacLearningPathwaySections.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    const activityIds = pacLearningPathwaySections.map((section) => section.activityId)
    expect(new Set(activityIds).size).toBe(activityIds.length)
  })

  it('leaves storage keys, progress versions, and release constants untouched', () => {
    expect(ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY).toBe('icu-hemodynamics-progress-v2')
    expect(ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY).toBe('icu-hemodynamics-progress-v1')
    expect(ICU_HEMODYNAMICS_PROGRESS_VERSION).toBe(2)
    expect(ICU_HEMODYNAMICS_RELEASE_STAGE).toBe('unlisted-preview')
    expect(ICU_HEMODYNAMICS_CONTENT_VERSION).toBe('1.0.0-preview.1')
  })

  it('keeps every station addressable by its own query value', () => {
    for (const section of pacLearningPathwaySections) {
      expect(`/icu-hemodynamics/learn?activity=${section.id}`).toMatch(
        /^\/icu-hemodynamics\/learn\?activity=[a-z-]+$/,
      )
    }
  })

  it('keeps software-internal vocabulary and universal targets out of the copy it added', () => {
    for (const text of newLearnerCopy()) {
      expect({ text, flagged: flaggedLearnerCopyTerms(text) }).toMatchObject({ flagged: [] })
      assertNoUniversalTargetLanguage(text)
    }
  })

  it('keeps raw catheter-position and plausibility enums out of the copy it added', () => {
    for (const text of newLearnerCopy()) {
      expect(text).not.toMatch(/\b(introducer|ra|rv|pa|wedge)\s*[:=]\s*/i)
      expect(text).not.toMatch(/reasonable-but-incomplete|incorrect-mechanism|sme-review/i)
      expect(text).not.toMatch(/signal-invalid|position-depth-mismatch|rhythm-concern/i)
    }
  })
})

/** Escapes a literal for use inside a RegExp. */
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
