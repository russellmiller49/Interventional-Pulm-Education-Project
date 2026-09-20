import { cleanup, fireEvent } from '@testing-library/react'

import { imagingStageLesson } from '../content/stageLessons'
import type { ImagingSectionId } from '../content/pathway'
import {
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowSkip,
} from '../test-support/stageHarness'

jest.mock(
  '../components/suite/ImagingSuitePane',
  () =>
    jest.requireActual<typeof import('../test-support/SuiteTestDouble')>(
      '../test-support/SuiteTestDouble',
    ).suitePaneDouble,
)
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
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/*
 * PI-FELLOW-01 follow-up — presentation truth on a held example.
 *
 * PI-FELLOW-01 made a check's image stable. Three checks then still carried the banner "This
 * example stays fixed so the question and the image match" over a written clinical scenario their
 * section's model does not represent: a new dependent opacity, duplicated edges from motion during
 * a CBCT spin, and a clinician holding an accessory in the primary beam. The image is fixed and
 * authored; it is not evidence of those situations.
 *
 * These are the rendered regressions. They fail against the pre-correction module, where all three
 * carried the matching claim and the image-based instruction. The controls at the end hold the
 * checks whose image really is the evidence to that framing, so the correction cannot spread.
 */

const MATCHING_CLAIM = /stays fixed so the question and the image match/
const MODEL_DISCLAIMER = /teaching model of the equipment, not a picture of the situation/

/** Walk a section to its check, skipping past anything that will not simply continue. */
function reachCheck(sectionId: ImagingSectionId) {
  const lesson = imagingStageLesson(sectionId)
  const checkId = lesson.steps[lesson.predictionStepIndex].id
  mountSection(sectionId)
  for (let guard = 0; currentStepId() !== checkId; guard++) {
    if (guard > 40) throw new Error(`Never reached ${checkId}; stuck on ${currentStepId()}`)
    const primary = nowPrimary()
    if (primary && !primary.disabled) fireEvent.click(primary)
    else if (nowSkip()) fireEvent.click(nowSkip()!)
    else throw new Error(`No way past ${currentStepId()}`)
  }
  return lesson
}

/** What the check says about its own image, and what it still offers the learner. */
function checkSurfaces() {
  const pane = document.querySelector('[data-authored-example]')
  return {
    identity: pane?.getAttribute('data-authored-example') ?? null,
    evidence: pane?.getAttribute('data-example-evidence') ?? null,
    instruction:
      document
        .querySelector('[data-now-card]')
        ?.textContent?.match(/[^.]*\./g)
        ?.join('') ?? '',
    nowCard: document.querySelector('[data-now-card]')?.textContent ?? '',
    banner:
      [...document.querySelectorAll('[role="status"]')]
        .map((node) => node.textContent?.trim() ?? '')
        .find((text) => MATCHING_CLAIM.test(text) || MODEL_DISCLAIMER.test(text)) ?? null,
    stem: document.querySelector('[data-prediction-choices] legend')?.textContent ?? '',
    choices: [...document.querySelectorAll('[data-prediction-choices] label')].map(
      (label) => label.textContent?.trim() ?? '',
    ),
    imagePresent: document.querySelector('[data-suite-scene]') !== null,
    explanationButton: document
      .querySelector('[data-now-card] [data-now-secondary]')
      ?.textContent?.trim(),
    skipLabel: nowSkip()?.textContent?.trim(),
  }
}

const ILLUSTRATIVE: readonly {
  sectionId: ImagingSectionId
  stemFragment: RegExp
  whatTheModelOmits: string
}[] = [
  {
    sectionId: 'current-anatomy',
    stemFragment: /dependent opacity/i,
    whatTheModelOmits: 'a rigid translation simulates no new opacity',
  },
  {
    sectionId: 'changing-anatomy',
    stemFragment: /motion during the spin/i,
    whatTheModelOmits: 'the same model simulates no motion artifact',
  },
  {
    sectionId: 'staff-protection',
    stemFragment: /primary beam/i,
    whatTheModelOmits: 'the scatter scene shows no clinician holding anything',
  },
]

describe('a check whose model does not depict its scenario says so', () => {
  it.each(ILLUSTRATIVE)(
    '$sectionId names the image as a teaching model and sends the learner to the written scenario',
    ({ sectionId, stemFragment }) => {
      const lesson = reachCheck(sectionId)
      const seen = checkSurfaces()

      expect(seen.identity).toBe(`${sectionId}:example:0`)
      expect(seen.evidence).toBe('illustrative-model')

      // The banner no longer claims the question and the image match.
      expect(seen.banner).not.toBeNull()
      expect(seen.banner).not.toMatch(MATCHING_CLAIM)
      expect(seen.banner).toMatch(MODEL_DISCLAIMER)
      expect(seen.banner).toMatch(/answer from the written scenario/i)
      expect(seen.nowCard).not.toMatch(MATCHING_CLAIM)

      // The adjacent instruction makes the same correction, not the old image-reading claim.
      expect(seen.nowCard).not.toMatch(/inspect the image/i)
      expect(seen.nowCard).toMatch(/Answer from the written scenario below/)
      expect(seen.nowCard).toMatch(/teaching model of the equipment/)

      // The question, its options and its image are exactly as authored.
      const step = lesson.steps[lesson.predictionStepIndex]
      if (step.interaction.kind !== 'prediction') throw new Error('unreachable')
      expect(seen.stem).toBe(step.interaction.item.stem)
      expect(seen.stem).toMatch(stemFragment)
      expect(seen.choices).toHaveLength(step.interaction.item.choices.length)
      expect(seen.imagePresent).toBe(true)

      // Self-paced affordances are untouched.
      expect(seen.explanationButton).toMatch(/Show the explanation/)
      expect(seen.skipLabel).toMatch(/Continue without answering/)
    },
  )

  it.each(ILLUSTRATIVE)(
    '$sectionId keeps its answer key, rationale and model boundary ($whatTheModelOmits)',
    ({ sectionId }) => {
      const lesson = reachCheck(sectionId)
      const step = lesson.steps[lesson.predictionStepIndex]
      if (step.interaction.kind !== 'prediction') throw new Error('unreachable')
      const item = step.interaction.item

      // The section still states what its model does and does not simulate.
      expect(document.querySelector('[data-model-boundary]')?.textContent ?? '').toContain(
        lesson.spec.modelBoundary.slice(0, 60),
      )

      // Answering commits the authored key and shows the authored rationale, unchanged.
      const keyed = item.choices.find((choice) => item.correctChoiceIds.includes(choice.id))!
      fireEvent.click(
        document.querySelector(`[data-prediction-choices] input[value="${keyed.id}"]`)!,
      )
      fireEvent.click(nowPrimary()!)
      const verdict = document.querySelector('[data-answer-verdict]')
      expect(verdict).not.toBeNull()
      expect(verdict!.getAttribute('data-verdict-outcome')).toBe('correct')
      // The verdict is the item's own explanation, and it is still not a matching claim.
      expect(verdict!.textContent).not.toMatch(MATCHING_CLAIM)
    },
  )

  it('draws every one of the three from its authored state, not from learner controls', () => {
    for (const { sectionId } of ILLUSTRATIVE) {
      reachCheck(sectionId)
      const dock = document.querySelector<HTMLFieldSetElement>('[data-suite-controls]')
      expect(dock?.disabled ?? null).toBe(true)
      cleanup()
      localStorage.clear()
    }
  })
})

describe('a check whose image is the evidence keeps saying so', () => {
  it('the component walk still tells the learner to inspect the image it superimposes', () => {
    reachCheck('chain-walk')
    const seen = checkSurfaces()
    expect(seen.identity).toBe('chain-walk:example:0')
    expect(seen.evidence).toBe('depicts-the-question')
    expect(seen.banner).toMatch(MATCHING_CLAIM)
    expect(seen.banner).not.toMatch(MODEL_DISCLAIMER)
    expect(seen.nowCard).toMatch(/Inspect the image and acquisition context/)
    expect(seen.nowCard).not.toMatch(/Answer from the written scenario/)
    expect(seen.stem).toMatch(/superimposed/i)
  })

  it('the CBCT scout check still tells the learner to inspect the scouts it shows', () => {
    reachCheck('cbct-acquisition')
    const seen = checkSurfaces()
    expect(seen.identity).toBe('cbct-acquisition:example:0')
    expect(seen.evidence).toBe('depicts-the-question')
    expect(seen.banner).toMatch(MATCHING_CLAIM)
    expect(seen.banner).not.toMatch(MODEL_DISCLAIMER)
    expect(seen.nowCard).toMatch(/Inspect the image and acquisition context/)
    expect(seen.nowCard).not.toMatch(/Answer from the written scenario/)
    expect(seen.stem).toMatch(/lateral view/i)
  })
})
