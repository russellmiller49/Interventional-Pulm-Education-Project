import { act, cleanup, fireEvent } from '@testing-library/react'

import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'

import { hemodynamicsSectionIds } from '../content/sectionSpecs'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { ICU_HEMODYNAMICS_LEARN_STORAGE_KEY } from '../engine/learnProgress'
import {
  ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY,
  ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY,
} from '../engine/progress'
import {
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  parseSelfPacedRecord,
} from '../engine/selfPacedProgress'
import {
  advanceToPrediction,
  clickPrimary,
  currentStepId,
  installDom,
  mountSection,
  scannableText,
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
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/*
 * Legacy records an older session could have left on a device — including an unknown field and a
 * version-one ledger the old reader used to rewrite. Every byte must survive a self-paced visit.
 */
const LEGACY_RECORDS: Readonly<Record<string, string>> = {
  [ICU_HEMODYNAMICS_LEARN_STORAGE_KEY]:
    '{"version":1,"completedSectionIds":["why-measure"],"lastSectionId":"why-measure","updatedAt":"2026-09-01T00:00:00.000Z","unknown":"kept"}',
  [ICU_HEMODYNAMICS_PROGRESS_STORAGE_KEY]:
    '{"version":2,"lastStation":"HD-03","lastWorkspace":"cases","attempts":{"HD-03":2},"completedCaseIds":["HD-03"],"bestScores":{"HD-03":86},"masteredCaseIds":["HD-03"]}',
  [ICU_HEMODYNAMICS_LEGACY_PROGRESS_STORAGE_KEY]:
    '{"version":1,"lastCaseId":"HD-02","attempts":{"HD-02":1},"bestScores":{"HD-02":40}}',
  [CRITICAL_CARE_PROGRESS_STORAGE_KEY]:
    '{"version":1,"activities":[{"activityId":"hemodynamics:learn:why-measure","status":"completed"}],"updatedAt":"2026-09-01T00:00:00.000Z"}',
}

function stepStates(): readonly (string | null)[] {
  return [...document.querySelectorAll('[data-step-list] li')].map((row) =>
    row.getAttribute('data-step-state'),
  )
}

/**
 * HD-01 — the self-paced contract, section by section.
 *
 * This replaces the rendered pre-commit leak scan, whose premise (nothing explains a section before
 * its question is committed) the owner's self-paced decision withdrew. What it asserts instead: every
 * task is named and reachable; the question's explanation opens before any answer and records none;
 * and a learner can leave every step without an answer or an action, which performs nothing, answers
 * nothing, adds no count or first-response tally, and leaves every legacy record byte-identical.
 */
describe.each(hemodynamicsSectionIds)('%s, self-paced', (sectionId) => {
  it('names every task, opens the question’s explanation before an answer, and records no answer', () => {
    const lesson = hemodynamicsStageLesson(sectionId)
    mountSection(sectionId)
    const titles = [...document.querySelectorAll('[data-step-list] button')].map(
      (button) => button.textContent ?? '',
    )
    expect(titles).toHaveLength(lesson.steps.length)
    lesson.steps.forEach((step, index) => expect(titles[index]).toContain(step.title))
    expect(document.body.textContent).not.toMatch(/Upcoming task/)

    advanceToPrediction(sectionId)
    act(() => {
      jest.advanceTimersByTime(10)
    })
    expect(currentStepId()).toBe(lesson.steps[lesson.predictionStepIndex].id)
    expect(document.querySelector('[data-verdict-outcome]')).toBeNull()
    expect(document.querySelector('[data-controls-locked]')).toBeNull()

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-now-card] [data-question-explanation-toggle]',
      )!,
    )
    expect(document.querySelector('[data-explanation-reveal]')).not.toBeNull()
    expect(document.querySelector('[data-verdict-outcome]')).toBeNull()
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('true')
    expect(stepStates()[lesson.predictionStepIndex]).toBe('current')
  })

  it('can be left at every step without an answer or an action, performs nothing, and keeps legacy records', () => {
    for (const [key, value] of Object.entries(LEGACY_RECORDS)) localStorage.setItem(key, value)
    const lesson = hemodynamicsStageLesson(sectionId)
    mountSection(sectionId)
    let guard = 80
    while (!document.querySelector('[data-stage-completion]') && guard-- > 0) {
      const skip = document.querySelector<HTMLButtonElement>('[data-skip-task]')
      if (skip) fireEvent.click(skip)
      else clickPrimary()
    }
    expect(document.querySelector('[data-stage-completion]')).not.toBeNull()
    const states = stepStates()
    expect(states).toHaveLength(lesson.steps.length)
    expect(states).not.toContain('done')
    expect(states).not.toContain('answered')
    expect(scannableText()).not.toMatch(
      /of 5 correct|attempted|first response|assisted retr|worked through/i,
    )
    for (const [key, value] of Object.entries(LEGACY_RECORDS)) {
      expect(localStorage.getItem(key)).toBe(value)
    }
    const record = parseSelfPacedRecord(
      localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY),
    )
    expect(record?.visitedSectionIds).toEqual([sectionId])
    expect(record?.reviewedSectionIds).toEqual([sectionId])
  })
})
