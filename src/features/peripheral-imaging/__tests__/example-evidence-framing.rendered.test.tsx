import { cleanup, fireEvent, screen } from '@testing-library/react'

import { imagingStageLesson } from '../content/stageLessons'
import type { ImagingSectionId } from '../content/pathway'
import { QUESTION_BY_ID } from '../data/questions'
import {
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
  nowSecondary,
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
 * Presentation truth on a check's image.
 *
 * PI-FELLOW-01 made a check's image stable. Three checks then still put a written clinical scenario
 * beside an image their section cannot make show it: a new dependent opacity, duplicated edges from
 * motion during a CBCT spin, and a clinician holding an accessory in the primary beam. For a while
 * they carried a banner saying the image was not the situation in the question. Owner follow-up,
 * 2026-10-12: a check either shows the image it asks about or is a written scenario with no image,
 * as Section 10's has been since PR #279. These are the rendered regressions for that rule.
 */

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
    instruction:
      document
        .querySelector('[data-now-card]')
        ?.textContent?.match(/[^.]*\./g)
        ?.join('') ?? '',
    nowCard: document.querySelector('[data-now-card]')?.textContent ?? '',
    // Anything the pane prints about its own image while a check is pending.
    banner:
      document.querySelector('[data-suite-scene] [role="status"]')?.textContent?.trim() ?? null,
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

const WRITTEN: readonly { sectionId: ImagingSectionId; stemFragment: RegExp }[] = [
  { sectionId: 'current-anatomy', stemFragment: /dependent opacity/i },
  // QS-4 (OD4-05): the check describes the appearance and leaves the cause to the learner.
  { sectionId: 'changing-anatomy', stemFragment: /appear twice/i },
  { sectionId: 'staff-protection', stemFragment: /primary beam/i },
]

describe('a check whose scenario the section’s image cannot show is written, with no image', () => {
  it.each(WRITTEN)(
    '$sectionId reads as a scenario: no image beside it, no banner, no instruction to inspect one',
    ({ sectionId, stemFragment }) => {
      const lesson = reachCheck(sectionId)
      const seen = checkSurfaces()

      // Nothing beside the question, and nothing that claims or disclaims an image.
      expect(seen.identity).toBeNull()
      expect(seen.imagePresent).toBe(false)
      expect(seen.banner).toBeNull()
      expect(document.body.textContent).not.toMatch(
        /not the situation|stays fixed|teaching model|section’s example/i,
      )
      expect(seen.nowCard).not.toMatch(/inspect the image/i)
      expect(seen.nowCard).toMatch(/Read the scenario\./)
      expect(document.querySelector('[data-now-focus] h2')?.textContent).toBe(
        'Interpret a clinical scenario',
      )
      const prompt = document.querySelector('[data-check-teaching] [data-check-prompt]')
      expect(prompt?.textContent).toMatch(
        /^Choose the interpretation the written scenario supports\./,
      )
      expect(prompt?.textContent).not.toMatch(/image/i)

      // The question and its options are exactly as authored.
      const step = lesson.steps[lesson.predictionStepIndex]
      if (step.interaction.kind !== 'prediction') throw new Error('unreachable')
      expect(step.activity.title).toBe('Interpret a clinical scenario')
      expect(seen.stem).toBe(step.interaction.item.stem)
      expect(seen.stem).toMatch(stemFragment)
      expect(seen.choices).toHaveLength(step.interaction.item.choices.length)

      // Self-paced affordances are untouched.
      expect(seen.explanationButton).toMatch(/Show the explanation/)
      expect(seen.skipLabel).toMatch(/Continue without answering/)
    },
  )

  it.each(WRITTEN)('$sectionId keeps its answer key and rationale', ({ sectionId }) => {
    const lesson = reachCheck(sectionId)
    const step = lesson.steps[lesson.predictionStepIndex]
    if (step.interaction.kind !== 'prediction') throw new Error('unreachable')
    const item = step.interaction.item

    // Answering commits the authored key and shows the authored rationale, unchanged.
    const keyed = item.choices.find((choice) => item.correctChoiceIds.includes(choice.id))!
    fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${keyed.id}"]`)!)
    fireEvent.click(nowPrimary()!)
    const verdict = document.querySelector('[data-answer-verdict]')
    expect(verdict).not.toBeNull()
    expect(verdict!.getAttribute('data-verdict-outcome')).toBe('correct')
    expect(verdict!.textContent).toContain(keyed.rationale)
  })

  it.each(WRITTEN)('$sectionId keeps its image on every step before the check', ({ sectionId }) => {
    const lesson = imagingStageLesson(sectionId)
    const checkId = lesson.steps[lesson.predictionStepIndex].id
    mountSection(sectionId)
    for (let guard = 0; currentStepId() !== checkId; guard++) {
      if (guard > 40) throw new Error(`Never reached ${checkId}`)
      const step = lesson.steps.find((candidate) => candidate.id === currentStepId())!
      if (step.interaction.kind === 'read')
        expect(document.querySelector('[data-lesson-demonstration]')).not.toBeNull()
      else expect(document.querySelector('[data-suite-scene]')).not.toBeNull()
      const primary = nowPrimary()
      if (primary && !primary.disabled) fireEvent.click(primary)
      else fireEvent.click(nowSkip()!)
    }
  })
})

describe('a check whose image is the evidence keeps saying so', () => {
  it('the component walk still tells the learner to inspect the image it superimposes', () => {
    reachCheck('chain-walk')
    const seen = checkSurfaces()
    expect(
      document.querySelector('[data-check-teaching] [data-check-prompt]')?.textContent,
    ).toMatch(/^Choose the interpretation this image and its acquisition context support\./)
    expect(seen.identity).toBe('chain-walk:example:0')
    // An image that depicts its question carries no banner: it shows no controls to explain.
    expect(seen.banner).toBeNull()
    expect(seen.nowCard).toMatch(/Inspect the image and acquisition context/)
    expect(seen.nowCard).not.toMatch(/Answer from the written scenario/)
    expect(seen.stem).toMatch(/superimposed/i)
  })

  it('the CBCT scout check still tells the learner to inspect the scouts it shows', () => {
    reachCheck('cbct-acquisition')
    const seen = checkSurfaces()
    expect(seen.identity).toBe('cbct-acquisition:example:0')
    expect(seen.banner).toBeNull()
    expect(seen.nowCard).toMatch(/Inspect the image and acquisition context/)
    expect(seen.nowCard).not.toMatch(/Answer from the written scenario/)
    expect(seen.stem).toMatch(/lateral view/i)
  })
})

/*
 * Independent sanity review of PR #279, finding F3 (CHK-S10). Section 10's check asks about
 * structures elongated through depth. The image beside it was a single reconstructed plane with a
 * depth slider, which cannot show elongation through depth, and the check told the learner to
 * inspect it. The check is now the written scenario its stem already was: no image, and no
 * instruction to read one.
 */
describe('a conceptual check carries no image it cannot support (CHK-S10)', () => {
  it('Section 10’s check is written: no adjacent image, no instruction to inspect one', () => {
    const lesson = reachCheck('dts-acquisition')
    const seen = checkSurfaces()
    const step = lesson.steps[lesson.predictionStepIndex]
    if (step.interaction.kind !== 'prediction') throw new Error('unreachable')

    // The dts-1 question, exactly as it was.
    expect(step.interaction.item.id).toBe('dts-acquisition:dts-1')
    expect(seen.stem).toBe(QUESTION_BY_ID['dts-1'].stem)
    expect(seen.stem).toMatch(/elongated in the depth direction/)
    expect(seen.choices).toHaveLength(QUESTION_BY_ID['dts-1'].choices.length)
    expect(step.interaction.item.correctChoiceIds).toEqual([QUESTION_BY_ID['dts-1'].correct])

    // Nothing beside it, and nothing that claims or disclaims an image.
    expect(seen.identity).toBeNull()
    expect(seen.imagePresent).toBe(false)
    expect(document.querySelector('[data-dts-state]')).toBeNull()
    expect(seen.banner).toBeNull()
    expect(seen.nowCard).not.toMatch(/inspect the image|section’s example/i)
    expect(seen.nowCard).toMatch(/Read the scenario\./)
    // The teaching column beside it says the same: a written scenario, not "this image".
    const prompt = document.querySelector('[data-check-teaching] [data-check-prompt]')
    expect(prompt?.textContent).toMatch(
      /^Choose the interpretation the written scenario supports\./,
    )
    expect(prompt?.textContent).not.toMatch(/image/i)
  })

  it('stays self-paced: explanation first, answer, retry, and leaving without an answer', () => {
    const lesson = reachCheck('dts-acquisition')
    const step = lesson.steps[lesson.predictionStepIndex]
    if (step.interaction.kind !== 'prediction') throw new Error('unreachable')
    const item = step.interaction.item
    expect(step.gate).toBe('open')
    expect(nowSkip()?.textContent).toMatch(/Continue without answering/)
    // Nothing is chosen yet, and nothing waits on an image.
    expect(nowPrimary()?.disabled).toBe(true)

    // The explanation opens before any answer.
    expect(nowSecondary()?.textContent).toBe('Show the explanation')
    fireEvent.click(nowSecondary()!)
    expect(document.querySelector('[data-explanation-reveal]')).not.toBeNull()

    // A distractor, then retry, then the key.
    const distractor = item.choices.find((choice) => !item.correctChoiceIds.includes(choice.id))!
    fireEvent.click(
      document.querySelector(`[data-prediction-choices] input[value="${distractor.id}"]`)!,
    )
    expect(nowPrimary()?.disabled).toBe(false)
    fireEvent.click(nowPrimary()!)
    expect(
      document.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome'),
    ).toBe('not-correct')
    fireEvent.click(screen.getByRole('button', { name: 'Try this question again' }))
    const keyed = item.choices.find((choice) => item.correctChoiceIds.includes(choice.id))!
    fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${keyed.id}"]`)!)
    fireEvent.click(nowPrimary()!)
    expect(
      document.querySelector('[data-answer-verdict]')?.getAttribute('data-verdict-outcome'),
    ).toBe('correct')
  })

  it('keeps the DTS image on every Section 10 step before the check', () => {
    const lesson = imagingStageLesson('dts-acquisition')
    const checkId = lesson.steps[lesson.predictionStepIndex].id
    mountSection('dts-acquisition')
    const seen: { step: string; demonstration: boolean; suiteMode: string | null }[] = []
    for (let guard = 0; currentStepId() !== checkId; guard++) {
      if (guard > 40) throw new Error(`Never reached ${checkId}`)
      seen.push({
        step: currentStepId()!,
        demonstration: document.querySelector('[data-lesson-demonstration]') !== null,
        suiteMode:
          document.querySelector('[data-suite-scene]')?.getAttribute('data-suite-mode') ?? null,
      })
      const primary = nowPrimary()
      if (primary && !primary.disabled) fireEvent.click(primary)
      else fireEvent.click(nowSkip()!)
    }
    // Every reading step shows its demonstration; the guided and comparison steps show the DTS
    // suite view, as before.
    expect(seen.map((entry) => entry.step)).toEqual(
      lesson.steps.slice(0, lesson.predictionStepIndex).map((entry) => entry.id),
    )
    for (const entry of seen) {
      const step = lesson.steps.find((candidate) => candidate.id === entry.step)!
      if (step.interaction.kind === 'read') expect(entry.demonstration).toBe(true)
      else expect(entry.suiteMode).toBe('dts')
    }
  })
})
