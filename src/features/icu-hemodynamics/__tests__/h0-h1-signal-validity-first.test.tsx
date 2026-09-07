import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'

import { IcuHemodynamicsLearnLandingV2 } from '../components/IcuHemodynamicsLearnLandingV2'
import { IcuHemodynamicsOverviewV2 } from '../components/IcuHemodynamicsOverviewV2'
import { NormalWaveformReference } from '../components/NormalWaveformReference'
import {
  hemodynamicsSourceById,
  normalWaveformReference,
  pacGuidedLearningItems,
  pacLearningPathwaySections,
  pacPrebriefBeforeYouStart,
  pacPrebriefNotCoveredHere,
  pacPrebriefNotCoveredNotice,
  pacPrebriefScope,
  pacPrebriefStopConditions,
  pressureSystemValiditySteps,
} from '../content'
import { hemodynamicsPathwaySections } from '../content/pathwayResolver'
import { hemodynamicsSectionIds, type HemodynamicsSectionId } from '../content/sectionSpecs'

/**
 * H0/H1 — signal validity before catheter manipulation.
 *
 * The module used to open by advancing a catheter and finish with the integrated signal-validation
 * capstone. That is backwards for a novice: the first thing a fellow needs is a way to decide
 * whether the tracing in front of them means anything at all. These pin the runway — and, equally,
 * pin that reordering it did not gate anything or move an identifier.
 *
 * The flow rebuild (2026-09-05) put one orientation section — why a pressure line is placed at
 * all — ahead of the pressure system, and added a section on the waves inside a named place. The
 * readiness cards and the guided-skill stations those cards opened are gone; every section now
 * runs on the shared lesson stage, so what is pinned here is the content and the two entry
 * surfaces, not the retired station components.
 */

const push = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${
            href.query && Object.keys(href.query).length > 0
              ? `?${new URLSearchParams(href.query).toString()}`
              : ''
          }`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
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

/**
 * The primary call to action of whichever entry surface was just rendered. Both surfaces mark it
 * with the same attribute, so the test asks each the same question in the same way.
 */
function primaryCta(container: HTMLElement): HTMLElement {
  const found = container.querySelectorAll('[data-hemodynamics-continue]')
  if (found.length !== 1) {
    throw new Error(`expected exactly one primary call to action, found ${found.length}`)
  }
  return found[0] as HTMLElement
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('H0/H1 pathway order and identity', () => {
  it('opens on the orientation question, then the pressure system, and keeps the capstone last', () => {
    expect(pacLearningPathwaySections.map((section) => section.id)).toEqual(EXPECTED_ORDER)
    // The stage's own ladder and the pathway are the same order, declared once each.
    expect([...hemodynamicsSectionIds]).toEqual(EXPECTED_ORDER)
    expect(pacLearningPathwaySections[0]?.id).toBe('why-measure')
    expect(pacLearningPathwaySections[0]?.stage).toBe('orientation')
    expect(pacLearningPathwaySections[1]?.id).toBe('pressure-system')
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
    // And the pressure system still comes before the first simulated manipulation.
    const ids = pacLearningPathwaySections.map((section) => section.id)
    expect(ids.indexOf('pressure-system')).toBeLessThan(ids.indexOf('catheter-advancement'))
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

  it('leads the arc sentence with the question and the signal rather than advancement', () => {
    const { arcSentence } = criticalCareLearningPathway('icu-hemodynamics')
    expect(arcSentence).toMatch(/^Ask why, trust the signal/i)
    expect(arcSentence).not.toMatch(/^Advance/i)
  })
})

describe('H0/H1 module entry', () => {
  it('sends a first-year fellow to the first section, not the introducer', () => {
    const { container } = render(<IcuHemodynamicsOverviewV2 />)

    const first = hemodynamicsPathwaySections[0]!
    const start = primaryCta(container)
    // The stored record is read in an effect; with nothing stored it resolves to section one.
    expect(start).toHaveAttribute('data-hemodynamics-continue', 'resolved')
    expect(start).toHaveAttribute('data-next-section', first.id)
    expect(start).toHaveAttribute('href', `/icu-hemodynamics/learn?activity=${first.id}`)
    expect(start).toHaveTextContent(`Start — ${first.title}`)
    expect(start.getAttribute('href')).not.toContain('catheter-advancement')

    expect(screen.queryByText(/Begin at the introducer/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Start at the introducer/i })).not.toBeInTheDocument()
  })

  it('answers the five orientation questions a novice arrives with', () => {
    const { container } = render(<IcuHemodynamicsOverviewV2 />)

    const begin = screen.getByText(/Where a first-year fellow should begin/i)
    expect(begin).toBeInTheDocument()
    // And the answer names the pathway's own first section rather than a hard-coded one.
    expect(begin.nextElementSibling).toHaveTextContent(
      `At the first section — ${hemodynamicsPathwaySections[0]!.title}`,
    )
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

  it('names all nine sections, in order, on the Overview and the Learn landing', () => {
    for (const Surface of [IcuHemodynamicsOverviewV2, IcuHemodynamicsLearnLandingV2]) {
      const { container, unmount } = render(<Surface />)

      const composition = container.querySelector('[data-pathway-composition]')
      expect(composition).toHaveTextContent(/^9 sections\b/)

      const accordion = container.querySelector('[data-pathway-accordion]') as HTMLElement
      expect(accordion).not.toBeNull()
      const chips = Array.from(
        accordion.querySelectorAll<HTMLAnchorElement>('a[data-kind="section"]'),
      )
      // Flattening the stage groups reproduces the canonical order — one map, not a second order.
      expect(chips.map((chip) => chip.getAttribute('href'))).toEqual(
        EXPECTED_ORDER.map((id) => `/icu-hemodynamics/learn?activity=${id}`),
      )
      for (const section of pacLearningPathwaySections) {
        expect(within(accordion).getAllByText(section.title).length).toBeGreaterThan(0)
      }

      unmount()
    }
  })

  it('says on the Learn landing that nothing is gated, and every section still links out', () => {
    const { container } = render(<IcuHemodynamicsLearnLandingV2 />)

    expect(screen.getByText(/nothing is gated/i)).toBeInTheDocument()
    expect(screen.getByText(/not a claim about clinical readiness/i)).toBeInTheDocument()
    expect(primaryCta(container)).toHaveAttribute(
      'data-next-section',
      hemodynamicsPathwaySections[0]!.id,
    )
    // Every section is reachable from the map, whatever the record says.
    expect(container.querySelectorAll('a[data-kind="section"]')).toHaveLength(
      pacLearningPathwaySections.length,
    )
    assertNoUniversalTargetLanguage(container.textContent ?? '')
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

  it('authors a validity commitment for the pressure system with its reasoning on the record', () => {
    const commitment = pacGuidedLearningItems['pressure-system'].validityCommitment
    expect(commitment).toBeDefined()
    expect(commitment!.activityId).toBe('hemodynamics:learn:pressure-system')
    expect(commitment!.explanation.length).toBeGreaterThan(0)
    expect(commitment!.choices.map((choice) => choice.label).join(' ')).toMatch(
      /Read the mean with caution/i,
    )
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

  it('keeps the normal reference ahead of the first simulated manipulation in the pathway', () => {
    const ids = pacLearningPathwaySections.map((section) => section.id)
    expect(ids.indexOf('waveform-interpretation')).toBeGreaterThanOrEqual(0)
    expect(ids.indexOf('waveform-interpretation')).toBeLessThan(ids.indexOf('catheter-advancement'))
  })
})

describe('H0/H1 advancement safety prebrief', () => {
  it('separates waveform recognition from procedural ability', () => {
    expect(pacPrebriefScope.doesNotTeach).toMatch(
      /Placing or manipulating a pulmonary-artery catheter in a patient/i,
    )
    expect(pacPrebriefScope.doesNotTeach).toMatch(/idealized waveforms are easier to read/i)
    expect(pacPrebriefScope.supervision).toMatch(/under qualified supervision/i)
  })

  it('names every authored stop condition and continuous rhythm monitoring', () => {
    expect(pacPrebriefStopConditions.length).toBeGreaterThan(0)
    for (const condition of pacPrebriefStopConditions) {
      expect(condition.trigger.length).toBeGreaterThan(0)
      expect(condition.response.length).toBeGreaterThan(0)
      expect(condition.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of condition.sourceIds) {
        expect(hemodynamicsSourceById.has(sourceId)).toBe(true)
      }
    }
    expect(pacPrebriefBeforeYouStart.join(' ')).toMatch(
      /Continuous rhythm monitoring, watched throughout/i,
    )
    assertNoUniversalTargetLanguage(
      [
        ...Object.values(pacPrebriefScope),
        ...pacPrebriefBeforeYouStart,
        ...pacPrebriefStopConditions.flatMap((condition) => [
          condition.trigger,
          condition.response,
        ]),
        ...pacPrebriefNotCoveredHere,
        pacPrebriefNotCoveredNotice,
      ].join(' '),
    )
  })

  it('flags the stop conditions no source in this module supports instead of inventing them', () => {
    expect(pacPrebriefNotCoveredHere.length).toBeGreaterThan(0)
    expect(pacPrebriefNotCoveredNotice).toMatch(/no reviewed source for them yet/i)
    // Resistance and knotting are named as gaps, never asserted as rules.
    expect(pacPrebriefNotCoveredHere.join(' ')).toMatch(/resistance/i)
    expect(pacPrebriefNotCoveredHere.join(' ')).toMatch(/knotting/i)
  })
})
