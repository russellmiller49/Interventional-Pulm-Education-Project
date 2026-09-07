import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import { NORMAL_WAVEFORM_ANATOMY_POSITION_LABELS } from '../components/NormalWaveformAnatomyFigure'
import { NormalWaveformReference } from '../components/NormalWaveformReference'
import { NormalWaveformValidityChallenges } from '../components/NormalWaveformValidityChallenges'
import {
  NORMAL_WAVEFORM_DETAIL_SCALE_MAX_MMHG,
  NORMAL_WAVEFORM_INTERPRETATION_WITHHELD,
  NORMAL_WAVEFORM_RESPIRATORY_CONTEXT,
  NORMAL_WAVEFORM_RHYTHM_CONTEXT,
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
  pacAdvancementStopReasonLabels,
  pacLearningPathwaySections,
  pawpCaptureSteps,
  pawpOcclusionOutcomes,
  pawpPlausibilityCommitment,
  pawpRecoveryCommitment,
  pawpRecoveryOutcomes,
  safeAdvancementCommitments,
  waveformAtlasById,
} from '../content'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_VERSION,
  advanceHemodynamicSimulation,
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  wedgeCaptureDelaySeconds,
  WEDGE_AUTO_DEFLATION_SECONDS,
} from '../engine'
import { PA_RETURN_CHECK, goalsMet, sectionRuntime } from '../engine/stageRuntime'
import {
  ICU_HEMODYNAMICS_CONTENT_VERSION,
  ICU_HEMODYNAMICS_RELEASE_STAGE,
} from '../content/release'
import { hemodynamicsSectionIds, type HemodynamicsSectionId } from '../content/sectionSpecs'

/**
 * H2/H3 — one canonical normal reference, and PAC work that reasons about safety continuously.
 *
 * The two failures this package is built against are both failures of *sufficiency*. H2's is a
 * learner who can name four tracings and names them just as confidently when the display is broken.
 * H3's is a learner who treats a matching waveform as permission to keep going, and who counts a
 * PAWP finished when the balloon is down.
 *
 * These pin both, and they pin them at the level where they can actually be broken: the derivation
 * that decides whether advancing is safe, the goals that decide whether the wedge section is
 * complete, and the rendered reference surfaces that have to agree with them.
 *
 * The guided-skill stations and the two safety panels this package once rendered were retired when
 * every section moved onto the shared lesson stage (2026-09-05). Their content records survive and
 * are pinned here; the stage's own suites pin how that content is shown.
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

const EXPECTED_ORDER: readonly HemodynamicsSectionId[] = [
  'why-measure',
  'pressure-system',
  'waveform-interpretation',
  'waveform-components',
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
    NORMAL_WAVEFORM_RHYTHM_CONTEXT.assumption,
    NORMAL_WAVEFORM_RHYTHM_CONTEXT.whyItMatters,
    NORMAL_WAVEFORM_RHYTHM_CONTEXT.atrialFibrillation,
    NORMAL_WAVEFORM_RHYTHM_CONTEXT.whatToUseInstead,
  ].filter((entry) => entry.length > 0)
}

/**
 * The corpus the clinical-copy corrections are policed against.
 *
 * Wider than `newLearnerCopy` because the correction pass reached into atlas records this package
 * did not author, and an assertion that stopped at the package boundary would police half the
 * surface. It is kept separate rather than merged, because those older records carry copy that
 * predates this work — a saturation percentage in the wedge pitfall, for one — and the banned-term
 * contract above was written for this package's own sentences.
 */
function correctedClinicalCopy(): readonly string[] {
  return [...newLearnerCopy(), ...atlasWedgeAndVentricleCopy()].filter((entry) => entry.length > 0)
}

/** Learner-visible strings on the atlas entries this correction pass touched. */
function atlasWedgeAndVentricleCopy(): readonly string[] {
  return ['wedge-normal', 'rv-normal', 'pa-normal', 'wedge-overwedged'].flatMap((id) => {
    const entry = waveformAtlasById.get(id)
    if (!entry) throw new Error(`Missing atlas entry: ${id}`)
    return [
      entry.summary,
      entry.pitfall ?? '',
      ...entry.recognitionCues,
      ...entry.annotations.map((annotation) => annotation.description),
    ]
  })
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

  /**
   * Named for what it actually establishes.
   *
   * It was titled as proving that every claim resolves to a source, which it does not do and cannot
   * do at this level: it checks that each record carries source ids that exist in the registry. That
   * is a real and useful contract — an unregistered id fails the import — but it is a statement about
   * records, not about sentences. Claim-level locator validation would need the source texts, and the
   * supplied PDFs are not in this repository.
   */
  it('has every reference record cite registered evidence (records, not sentences)', () => {
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
    expect([...hemodynamicsSectionIds]).toEqual(EXPECTED_ORDER)
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

  it('says in words that a matching waveform changes nothing when something says stop', () => {
    const scenario = pacAdvancementScenarios.find(
      (candidate) => candidate.id === 'rv-ectopy-despite-textbook-waveform',
    )
    expect(scenario).toBeDefined()

    // The tracing matches the chamber, and the rhythm alone says stop.
    expect(scenario!.currentTracing.matchesPosition).not.toBeNull()
    expect(scenario!.currentTracing.concerning).toBe(false)
    expect(advancementStopReasons(scenario!)).toEqual(['rhythm-concern'])
    expect(pacAdvancementStopReasonLabels['rhythm-concern']).toMatch(/rhythm needs attention/i)
    expect(advancementMayContinue(scenario!)).toBe(false)

    // And the words the learner reads after committing say exactly that.
    expect(scenario!.justification).toMatch(
      /Continuing is not safe\. A stop condition outranks a matching waveform every time/i,
    )
    expect(scenario!.commitment.explanation).toMatch(/confirms which chamber the tip is in/i)
    expect(scenario!.commitment.correctChoiceIds).toEqual(['escalate'])
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

  it('never permits continuation from a state where the PA waveform did not return', () => {
    const missing = pawpRecoveryOutcomes.find((outcome) => !outcome.paWaveformReturned)
    expect(missing).toBeDefined()
    expect(missing!.continuationPermitted).toBe(false)
    expect(missing!.requiredResponse).toMatch(/escalate/i)
    expect(pawpRecoveryCommitment.correctChoiceIds).toEqual(['treat-as-unsafe-and-escalate'])
  })
})

describe('H2/H3 non-regression', () => {
  it('leaves the merged pathway order, ids, and routes untouched', () => {
    expect(pacLearningPathwaySections.map((section) => section.id)).toEqual(EXPECTED_ORDER)
    expect(pacLearningPathwaySections[0]?.id).toBe('why-measure')
    expect(pacLearningPathwaySections[1]?.id).toBe('pressure-system')
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

/**
 * The clinical-copy correction pass requested before merge.
 *
 * Each of these pins a specific sentence that was wrong, not a general property. They are grouped
 * together deliberately: read as a set, they are the record of what a clinician reviewer objected to
 * and what replaced it.
 */
describe('clinical-copy corrections', () => {
  const wedgeEntry = () => normalWaveformReference.find((entry) => entry.position === 'wedge')!
  const rvEntry = () => normalWaveformReference.find((entry) => entry.position === 'rv')!
  const wedgeAtlas = () => waveformAtlasById.get('wedge-normal')!
  const overWedgeAtlas = () => waveformAtlasById.get('wedge-overwedged')!

  it('never calls a PAWP above pulmonary-artery diastolic pressure physiologically impossible', () => {
    for (const text of correctedClinicalCopy()) {
      expect(text).not.toMatch(/physiologically impossible/i)
      expect(text).not.toMatch(/impossible for (a |one)?(true )?wedge/i)
    }
  })

  it('treats an unexpected PAWP/PADP relationship as something to reconcile, not as a verdict', () => {
    const overWedged = pawpOcclusionOutcomes.find((outcome) => outcome.id === 'over-wedged')!
    // The relationship is named, and named as insufficient on its own.
    expect(overWedged.verdict).toMatch(/above pulmonary-artery diastolic pressure/i)
    expect(overWedged.verdict).toMatch(/on its own it does not establish over-wedging/i)
    // What actually identifies it is the drift plus the loss of interpretable wave components.
    expect(overWedged.verdict).toMatch(
      /upward drift and the loss of interpretable wave components/i,
    )

    const pressureOnlyChoice = pawpPlausibilityCommitment.choices.find(
      (choice) => choice.id === 'shape-plus-value-enough',
    )!
    expect(pressureOnlyChoice.plausibility).not.toBe('best')
    expect(pressureOnlyChoice.rationale).toMatch(/not decisive in either direction/i)

    expect(overWedgeAtlas().recognitionCues.join(' ')).toMatch(
      /on its own it does not establish over-wedging/i,
    )
    expect(wedgeEntry().unsafeToInterpret).toMatch(
      /pressure relationship alone does not establish over-wedging/i,
    )
  })

  it('distinguishes mean PAWP from end-diastolic PAWP wherever LVEDP is estimated', () => {
    expect(wedgeEntry().pressureDirection).toMatch(
      /displayed mean and that end-diastolic value are different measurements and are not interchangeable/i,
    )
    const aWave = wedgeAtlas().annotations.find((annotation) => annotation.id === 'a')!
    expect(aWave.description).toMatch(/that end-diastolic value is not the displayed mean/i)
    // And the reason the two diverge is named where over-wedging is discussed.
    expect(wedgeEntry().unsafeToInterpret).toMatch(
      /large v wave can raise the displayed mean without the end-diastolic value moving with it/i,
    )
  })

  it('reads end-diastolic PAWP just before the c wave rather than at the peak of the a wave', () => {
    const aWave = wedgeAtlas().annotations.find((annotation) => annotation.id === 'a')!
    for (const text of [aWave.description, wedgeEntry().pressureDirection]) {
      expect(text).not.toMatch(/peak of the a wave is the best/i)
      expect(text).not.toMatch(/best single estimate/i)
    }
    expect(aWave.description).toMatch(/read just before the c wave/i)
    expect(aWave.description).toMatch(
      /average the peak and the trough of this a wave|average the peak and the trough/i,
    )
    expect(wedgeEntry().pressureDirection).toMatch(/just before the c wave/i)
    expect(wedgeEntry().pressureDirection).toMatch(/average the peak and the trough of the a wave/i)
    // The averaging fallback is scoped to sinus rhythm, where an a wave exists at all.
    expect(wedgeEntry().pressureDirection).toMatch(/in sinus rhythm/i)
  })

  it('states on the reference itself that it assumes sinus rhythm', () => {
    expect(NORMAL_WAVEFORM_RHYTHM_CONTEXT.assumption).toMatch(/assumes sinus rhythm/i)

    render(<NormalWaveformReference />)
    const note = screen.getByLabelText('Rhythm this reference assumes')
    expect(within(note).getByText(/This reference assumes sinus rhythm/i)).toBeInTheDocument()
    expect(within(note).getByText(/Atrial fibrillation removes the a wave/i)).toBeInTheDocument()
  })

  it('accommodates the missing a wave of atrial fibrillation in the wedge validity language', () => {
    expect(NORMAL_WAVEFORM_RHYTHM_CONTEXT.atrialFibrillation).toMatch(
      /absence does not by itself make the tracing invalid/i,
    )
    expect(wedgeEntry().unsafeToInterpret).toMatch(/In atrial fibrillation the a wave is absent/i)
    expect(wedgeEntry().unsafeToInterpret).toMatch(
      /does not invalidate|by itself does not invalidate|that by itself does not invalidate/i,
    )
    expect(wedgeEntry().unsafeToInterpret).toMatch(/remaining ECG and pressure landmarks/i)
    // v > a is a typical feature, not a validity requirement.
    expect(wedgeEntry().expectedMorphology).toMatch(/typically larger than the a wave/i)
    expect(wedgeEntry().expectedMorphology).toMatch(/typical normal feature, not a requirement/i)
    expect(wedgeAtlas().recognitionCues.join(' ')).toMatch(
      /typical normal feature rather than a validity requirement/i,
    )
    expect(wedgeAtlas().pitfall ?? '').toMatch(/the v wave alone in atrial fibrillation/i)
    for (const text of correctedClinicalCopy()) {
      expect(text).not.toMatch(/v wave normally exceeds the a wave/i)
      expect(text).not.toMatch(/v wave normally EXCEEDS/)
    }
  })

  it('never makes a conspicuous up-sloping RV diastole a single mandatory criterion', () => {
    const rv = rvEntry()
    for (const text of [
      rv.expectedMorphology,
      rv.expectedChangeFromPrevious,
      rv.unsafeToInterpret,
      ...rv.technicalDistortions.map((distortion) => distortion.whatItMimics),
    ]) {
      expect(text).not.toMatch(/only feature separating/i)
      expect(text).not.toMatch(/single most reliable/i)
      expect(text).not.toMatch(/no up-sloping diastole is not a confirmed/i)
    }
    // The climb is offered as possible, and read alongside the rest of the transition.
    expect(rv.expectedMorphology).toMatch(/may climb gradually/i)
    expect(rv.expectedChangeFromPrevious).toMatch(/whole transition rather than any one feature/i)
    expect(rv.expectedChangeFromPrevious).toMatch(
      /read together with the rest of the transition|rather than required on its own/i,
    )
    // And the pulmonary-artery side is what the discrimination actually rests on.
    expect(rv.unsafeToInterpret).toMatch(
      /diastolic step-up, a downward runoff, and a dicrotic notch/i,
    )
    expect(waveformAtlasById.get('rv-normal')!.summary).toMatch(/may climb gradually/i)
  })

  it('introduces no universal balloon volume or inflation duration, and says why', () => {
    const volume = /\b\d+(\.\d+)?\s*(ml\b|millilit|cc\b)/i
    const duration =
      /\b(inflat|occlu|wedge|balloon)[^.]{0,80}\b\d+(\.\d+)?\s*(second|sec\b|s\b|minute)/i
    for (const text of correctedClinicalCopy()) {
      expect(text).not.toMatch(volume)
      expect(text).not.toMatch(duration)
    }
    // The boundary is framed as scope, not as an absence of sources.
    expect(PAWP_BALLOON_NUMBERS_BOUNDARY).toMatch(
      /does not teach a universal inflation volume or duration/i,
    )
    expect(PAWP_BALLOON_NUMBERS_BOUNDARY).toMatch(/exact catheter in use/i)
    expect(PAWP_BALLOON_NUMBERS_BOUNDARY).toMatch(/applicable local procedure protocol/i)
    expect(PAWP_BALLOON_NUMBERS_BOUNDARY).toMatch(/educational safety rail, not a clinical limit/i)
    expect(PAWP_BALLOON_NUMBERS_BOUNDARY).not.toMatch(/no reviewed source/i)
  })

  it('leaves the simulator cutoff and its inability to complete the station untouched', () => {
    // The constant, the auto-deflation, and the recorded safety event are all unchanged.
    expect(WEDGE_AUTO_DEFLATION_SECONDS).toBe(10)

    const definition = hemodynamicCaseById.get('HD-01')!
    let state = icuHemodynamicsReducer(createInitialHemodynamicState(definition, 'learn', 3), {
      type: 'ZERO_TRANSDUCER',
    })
    state = icuHemodynamicsReducer(state, { type: 'START_WEDGE' })
    state = advanceHemodynamicSimulation(
      state,
      wedgeCaptureDelaySeconds(state.parameters.respiratoryRateBpm) + 0.2,
    )
    state = icuHemodynamicsReducer(state, { type: 'PLACE_WEDGE_CURSOR' })
    state = icuHemodynamicsReducer(state, { type: 'STORE_WEDGE' })
    const elapsed = state.timeSeconds - (state.catheter.wedgeStartedAt ?? 0)
    state = advanceHemodynamicSimulation(state, WEDGE_AUTO_DEFLATION_SECONDS - elapsed + 0.1)

    expect(state.catheter.forcedSafetyRecovery).toBe(true)
    expect(state.catheter.balloonInflated).toBe(false)
    expect(state.catheter.position).toBe('pa')
    expect(state.criticalErrors).toContain('wedge-prolonged-inflation')
    // And that path still cannot finish the section, with or without the learner's own assessment:
    // the wedge section's goals are pure predicates over this same state.
    const wedge = sectionRuntime('pawp-capture')
    const goals = [...wedge.actGoals, ...wedge.observeGoals]
    expect(goals).toContainEqual({ type: 'check', id: PA_RETURN_CHECK })
    expect(goalsMet(goals, state)).toBe(false)
    expect(
      goalsMet(goals, {
        ...state,
        signalValidationChecks: [...state.signalValidationChecks, PA_RETURN_CHECK],
      }),
    ).toBe(false)
  })
})

/** Escapes a literal for use inside a RegExp. */
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
