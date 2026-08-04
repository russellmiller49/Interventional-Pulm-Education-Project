import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'

import { IcuHemodynamicsLearnLandingV2 } from '../components/IcuHemodynamicsLearnLandingV2'
import { IcuHemodynamicsOverviewV2 } from '../components/IcuHemodynamicsOverviewV2'
import { NormalWaveformReference } from '../components/NormalWaveformReference'
import { PacGuidedSkillActivity } from '../components/PacGuidedSkillActivity'
import {
  normalWaveformReference,
  pacGuidedLearningItems,
  pacLearningPathwaySections,
  pacPrebriefNotCoveredHere,
  pacPrebriefStopConditions,
  pacSectionReadiness,
  pressureSystemValiditySteps,
  recommendedPriorSection,
  type PacLearningPathwaySectionId,
} from '../content'

/**
 * H0/H1 — signal validity before catheter manipulation.
 *
 * The module used to open by advancing a catheter and finish with the integrated signal-validation
 * capstone. That is backwards for a novice: the first thing a fellow needs is a way to decide
 * whether the tracing in front of them means anything at all. These pin the new runway — and,
 * equally, pin that reordering it did not gate anything or move an identifier.
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

describe('H0/H1 pathway order and identity', () => {
  it('opens on the pressure system and keeps the capstone last', () => {
    expect(pacLearningPathwaySections.map((section) => section.id)).toEqual(EXPECTED_ORDER)
  })

  /**
   * The regression this package exists to prevent. Restoring the old advancement-first order here
   * reproduces exactly what the module did before, and the assertion above must reject it.
   */
  it('rejects the previous advancement-first order', () => {
    const previousOrder = [
      'catheter-advancement',
      'pressure-system',
      'waveform-interpretation',
      'pawp-capture',
      'thermodilution-series',
      'derived-hemodynamics',
      'pac-signal-validation',
    ]
    expect(previousOrder).not.toEqual(EXPECTED_ORDER)
    expect(pacLearningPathwaySections.map((section) => section.id)).not.toEqual(previousOrder)
    // Specifically: the first station is no longer catheter manipulation.
    expect(pacLearningPathwaySections[0]?.id).not.toBe('catheter-advancement')
  })

  it('keeps every section id and activity id unchanged and unique', () => {
    const ids = pacLearningPathwaySections.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...EXPECTED_ORDER].sort())

    const activityIds = pacLearningPathwaySections.map((section) => section.activityId)
    expect(new Set(activityIds).size).toBe(activityIds.length)
    for (const section of pacLearningPathwaySections) {
      expect(section.activityId).toBe(`hemodynamics:learn:${section.id}`)
      // Fails closed at import if the catalog and the pathway ever disagree; assert it anyway so a
      // future reorder cannot quietly drop a station.
      expect(criticalCareActivityById.get(section.activityId)).toBeDefined()
    }
  })

  it('keeps the capstone as the single integration station', () => {
    const integration = pacLearningPathwaySections.filter(
      (section) => section.stage === 'integration',
    )
    expect(integration).toHaveLength(1)
    expect(integration[0]?.id).toBe('pac-signal-validation')
    expect(pacLearningPathwaySections.at(-1)?.id).toBe('pac-signal-validation')
  })

  it('leads the arc sentence with validity rather than advancement', () => {
    const { arcSentence } = criticalCareLearningPathway('icu-hemodynamics')
    expect(arcSentence).toMatch(/^Trust the signal/i)
    expect(arcSentence).not.toMatch(/^Advance/i)
  })
})

describe('H0/H1 module entry', () => {
  it('sends a first-year fellow to the pressure system, not the introducer', () => {
    render(<IcuHemodynamicsOverviewV2 />)

    const start = screen.getByRole('link', {
      name: /Start here: can I trust this pressure signal\?/i,
    })
    expect(start).toHaveAttribute('href', '/icu-hemodynamics/learn?activity=pressure-system')
    expect(screen.queryByText(/Begin at the introducer/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Start at the introducer/i })).not.toBeInTheDocument()
  })

  it('answers the five orientation questions a novice arrives with', () => {
    const { container } = render(<IcuHemodynamicsOverviewV2 />)

    expect(screen.getByText(/Where a first-year fellow should begin/i)).toBeInTheDocument()
    expect(screen.getByText(/What is assumed beforehand/i)).toBeInTheDocument()
    expect(screen.getByText(/What you will actually practice/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Signal interpretation versus simulated procedure/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/What finishing a section means/i)).toBeInTheDocument()

    assertNoUniversalTargetLanguage(container.textContent ?? '')
  })

  it('describes completion as participation rather than readiness', () => {
    render(<IcuHemodynamicsOverviewV2 />)
    expect(screen.getByText(/does not make a claim about clinical readiness/i)).toBeInTheDocument()
    expect(
      screen.getByText(/not instruction in placing a catheter in a patient/i),
    ).toBeInTheDocument()
  })

  it('renders the readiness facts for every section on the Learn landing', () => {
    const { container } = render(<IcuHemodynamicsLearnLandingV2 />)

    expect(
      screen.getByRole('heading', { name: /Where to start, and what each section assumes/i }),
    ).toBeInTheDocument()
    for (const section of pacLearningPathwaySections) {
      expect(screen.getAllByText(section.title).length).toBeGreaterThan(0)
    }
    // Nothing gates: the landing says so, and every section still links out.
    expect(screen.getByText(/Nothing is locked/i)).toBeInTheDocument()
    assertNoUniversalTargetLanguage(container.textContent ?? '')
  })
})

describe('H0/H1 per-section readiness', () => {
  it('derives the recommended prior section from the pathway, not the catalog prerequisites', () => {
    expect(recommendedPriorSection('pressure-system')).toBeNull()

    for (const [index, section] of pacLearningPathwaySections.entries()) {
      const prior = recommendedPriorSection(section.id as PacLearningPathwaySectionId)
      if (index === 0) {
        expect(prior).toBeNull()
        continue
      }
      expect(prior?.id).toBe(pacLearningPathwaySections[index - 1]?.id)
    }

    // The catalog prerequisite for the *first* section is empty, but the point of deriving from the
    // pathway is that the display stays right even when the two diverge.
    expect(recommendedPriorSection('waveform-interpretation')?.id).toBe('pressure-system')
    expect(recommendedPriorSection('catheter-advancement')?.id).toBe('waveform-interpretation')
  })

  it('authors readiness facts for every section, marking the simulated-procedure ones', () => {
    for (const section of pacLearningPathwaySections) {
      const readiness = pacSectionReadiness[section.id as PacLearningPathwaySectionId]
      expect(readiness).toBeDefined()
      expect(readiness.level.length).toBeGreaterThan(0)
      expect(readiness.beforeStarting.length).toBeGreaterThan(0)
      expect(readiness.whatYouWillPractice.length).toBeGreaterThan(0)
    }
    expect(pacSectionReadiness['catheter-advancement'].boundary).toBe('simulated-procedure')
    expect(pacSectionReadiness['pawp-capture'].boundary).toBe('simulated-procedure')
    expect(pacSectionReadiness['pressure-system'].boundary).toBe('signal-interpretation')
  })

  it('shows the readiness card before the learner opens a station', async () => {
    render(<PacGuidedSkillActivity skillId="pressure-system" />)
    expect(
      await screen.findByRole('heading', { name: 'Level, zero, and dynamic response' }),
    ).toBeInTheDocument()

    const card = screen.getByLabelText(/Before you start: Level, zero, and dynamic response/i)
    expect(
      within(card).getByText(/Start here — no earlier section is assumed/i),
    ).toBeInTheDocument()
    expect(
      within(card).getByText(/This is the recommended first section of the module/i),
    ).toBeInTheDocument()
  })
})

describe('H0/H1 pressure-system validity sequence', () => {
  it('teaches one ordered sequence that ends in an explicit decision to interpret or withhold', () => {
    expect(pressureSystemValiditySteps.map((step) => step.id)).toEqual([
      'patient-context',
      'level',
      'zero',
      'plumbing',
      'scale-and-channel',
      'dynamic-response',
      'respiratory-phase',
      'morphology',
      'interpret-or-withhold',
    ])

    for (const step of pressureSystemValiditySteps) {
      expect(step.sourceIds.length).toBeGreaterThan(0)
      assertNoUniversalTargetLanguage(
        [
          step.whatYouCheck,
          step.whatItEstablishes,
          step.whatItDoesNotEstablish,
          step.howItMisleads,
        ].join(' '),
      )
    }
  })

  it('renders the sequence in order in the first station', async () => {
    const { container } = render(<PacGuidedSkillActivity skillId="pressure-system" />)
    expect(
      await screen.findByRole('heading', { name: 'Level, zero, and dynamic response' }),
    ).toBeInTheDocument()

    const sequence = screen.getByLabelText('Pressure-system validity sequence')
    const rendered = within(sequence)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(rendered).toEqual(pressureSystemValiditySteps.map((step) => step.shortLabel))

    assertNoUniversalTargetLanguage(container.textContent ?? '')
  })

  it('withholds the reasoning until the learner commits', async () => {
    render(<PacGuidedSkillActivity skillId="pressure-system" />)
    expect(
      await screen.findByRole('heading', { name: 'Level, zero, and dynamic response' }),
    ).toBeInTheDocument()

    const commitment = pacGuidedLearningItems['pressure-system'].validityCommitment
    expect(commitment).toBeDefined()

    // Before commitment the explanation is nowhere on the page.
    expect(screen.queryByText(commitment!.explanation)).not.toBeInTheDocument()

    const commit = screen.getByRole('button', { name: 'Commit this reading' })
    expect(commit).toBeDisabled()

    fireEvent.click(
      screen.getByRole('radio', {
        name: /Read the mean with caution/i,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit this reading' }))

    expect(screen.getByText(commitment!.explanation)).toBeInTheDocument()
  })
})

describe('H0/H1 normal waveform reference', () => {
  it('covers RA, RV, PA, and wedge in insertion order with every facet authored', () => {
    expect(normalWaveformReference.map((entry) => entry.position)).toEqual([
      'ra',
      'rv',
      'pa',
      'wedge',
    ])

    for (const entry of normalWaveformReference) {
      for (const facet of [
        entry.physicalLocation,
        entry.expectedMorphology,
        entry.ecgRelation,
        entry.pressureDirection,
        entry.respiratoryVariation,
        entry.technicalDistortion,
        entry.unsafeToInterpret,
      ]) {
        expect(facet.length).toBeGreaterThan(0)
      }
      assertNoUniversalTargetLanguage(
        [entry.pressureDirection, entry.respiratoryVariation, entry.unsafeToInterpret].join(' '),
      )
    }
  })

  it('renders the reference with its ranges marked as not being targets', () => {
    const { container } = render(<NormalWaveformReference />)

    expect(
      screen.getByRole('heading', { name: /What each chamber is supposed to look like/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/When it is not safe to interpret/i)).toBeInTheDocument()
    expect(screen.getByText(/They are not treatment targets/i)).toBeInTheDocument()
    assertNoUniversalTargetLanguage(container.textContent ?? '')
  })

  it('establishes the normal reference before the recognition drill', async () => {
    render(<PacGuidedSkillActivity skillId="waveform-interpretation" />)
    expect(
      await screen.findByRole('heading', { name: 'Interpret normal and abnormal waveforms' }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: /What each chamber is supposed to look like/i }),
    ).toBeInTheDocument()
  })
})

describe('H0/H1 advancement safety prebrief', () => {
  it('appears before the manipulation controls and gates nothing else', async () => {
    render(<PacGuidedSkillActivity skillId="catheter-advancement" />)
    expect(
      await screen.findByRole('heading', { name: 'Advance the PAC by waveform' }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: /What this section is, and what it is not/i }),
    ).toBeInTheDocument()
    // The orientation control stays out of reach until the prebrief is acknowledged.
    expect(screen.getByRole('button', { name: 'Orient to this skill station' })).toBeDisabled()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'I have read the prebrief — open the simulated advancement',
      }),
    )
    expect(screen.getByRole('button', { name: 'Orient to this skill station' })).toBeEnabled()
  })

  it('separates waveform recognition from procedural ability', async () => {
    render(<PacGuidedSkillActivity skillId="catheter-advancement" />)
    expect(
      await screen.findByRole('heading', { name: 'Advance the PAC by waveform' }),
    ).toBeInTheDocument()

    expect(
      screen.getByText(/Placing or manipulating a pulmonary-artery catheter in a patient/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/idealized waveforms are easier to read/i)).toBeInTheDocument()
    expect(screen.getByText(/under qualified supervision/i)).toBeInTheDocument()
  })

  it('names every authored stop condition and continuous rhythm monitoring', async () => {
    const { container } = render(<PacGuidedSkillActivity skillId="catheter-advancement" />)
    expect(
      await screen.findByRole('heading', { name: 'Advance the PAC by waveform' }),
    ).toBeInTheDocument()

    for (const condition of pacPrebriefStopConditions) {
      expect(screen.getByText(condition.trigger)).toBeInTheDocument()
      expect(screen.getByText(condition.response)).toBeInTheDocument()
      expect(condition.sourceIds.length).toBeGreaterThan(0)
    }
    expect(
      screen.getByText(/Continuous rhythm monitoring, watched throughout/i),
    ).toBeInTheDocument()
    assertNoUniversalTargetLanguage(container.textContent ?? '')
  })

  it('flags the stop conditions no source in this module supports instead of inventing them', async () => {
    render(<PacGuidedSkillActivity skillId="catheter-advancement" />)
    expect(
      await screen.findByRole('heading', { name: 'Advance the PAC by waveform' }),
    ).toBeInTheDocument()

    for (const gap of pacPrebriefNotCoveredHere) {
      expect(screen.getByText(gap)).toBeInTheDocument()
    }
    expect(screen.getByText(/no reviewed source for them yet/i)).toBeInTheDocument()
    // Resistance and knotting are named as gaps, never asserted as rules.
    expect(pacPrebriefNotCoveredHere.join(' ')).toMatch(/resistance/i)
    expect(pacPrebriefNotCoveredHere.join(' ')).toMatch(/knotting/i)
  })
})
