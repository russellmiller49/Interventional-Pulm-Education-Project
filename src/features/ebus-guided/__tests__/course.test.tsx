import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  CHAPTERS,
  LESSONS,
  CONTENT_LESSONS,
  MERGED_INTO,
  lessonById,
  partsOf,
} from '../content/curriculum'
import { FINAL_CASES, PRACTICE_CASES } from '../content/cases'
import { SOURCES } from '../content/sources'
import { activitiesForLesson } from '../content/stage'
import { READING_ITEMS } from '../content/node-features'
import { LessonHost } from '../components/LessonHost'
import { CasePlayer } from '../components/CasePlayer'
import { IntegratedCasesPage } from '../components/IntegratedCasesPage'
import { emptyRecord, firstAttempt, parseRecord, STORAGE_KEY } from '../engine/progress'
import { PROGRESS_STORAGE_KEY, readProgress } from '../engine/selfPacedProgress'
import { isPublicUnlistedPath, isPublicPath } from '@/lib/site-auth/access'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import manifest from '../../../../EBUS-course/apps/web/public/simulator/case-001/case_manifest.simplified.web.json'
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/DecisionImage', () => ({ DecisionImage: () => <div>Reference CT</div> }))
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement
const next = () => fireEvent.click(primary())
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
const verdict = () => document.querySelector('[data-answer-verdict]')
const explanation = () => document.querySelector('[data-explanation-reveal]')
/** Walk forward through read, task and acquisition steps until a check is in front of the learner. */
function reachFirstCheck() {
  for (let guard = 0; guard < 12; guard++) {
    if (document.querySelector('[data-question-id]')) return true
    const button = primary()
    if (button.disabled) {
      const skip = document.querySelector('[data-skip-acquisition]') as HTMLButtonElement | null
      if (!skip) return false
      fireEvent.click(skip)
    } else fireEvent.click(button)
  }
  return false
}
it('defines the full curriculum, unique decisions, sources, meaningful activities and current preset keys', () => {
  // 27 content units in 22 lessons: five units were folded into the lesson before or after them
  // (consolidation of 2026-11-10), and the scope lesson was added. A unit keeps its id, lab,
  // checks and sources.
  expect(LESSONS).toHaveLength(22)
  expect(CONTENT_LESSONS).toHaveLength(27)
  expect(Object.keys(MERGED_INTO).sort()).toEqual([
    'contact-cutaway-model',
    'eus-b-route-model',
    'gain-contrast',
    'measurement-phantoms',
    'needle-assembly-model',
  ])
  for (const [unit, holder] of Object.entries(MERGED_INTO)) {
    expect(lessonById(unit)!.id).toBe(holder)
    expect(partsOf(lessonById(unit)!).map((part) => part.id)).toContain(unit)
  }
  expect(FINAL_CASES).toHaveLength(8)
  const ids = CONTENT_LESSONS.map((l) => l.id)
  expect(new Set(ids).size).toBe(ids.length)
  const questions = CONTENT_LESSONS.flatMap((l) => [l.question, l.observation, l.transfer]).concat(
    [...FINAL_CASES, ...PRACTICE_CASES].flatMap((c) => c.questions),
  )
  expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length)
  for (const q of questions) {
    expect(q.choices.filter((c) => c.correct)).toHaveLength(1)
    for (const c of q.choices) expect(c.rationale.length).toBeGreaterThan(15)
  }
  for (const unit of CONTENT_LESSONS) {
    /*
     * A unit has one piece of work: a lab the learner acquires an image in, or a matching or
     * ordering task. Two units have both (2026-11-10), and are named here: the scope lesson, whose
     * console is an ungated example and then a short task before its matching, and the hilar and
     * interlobar lesson, whose matching names the stations before one of them is scanned.
     */
    expect([unit.sequence, unit.matching].filter(Boolean).length).toBeLessThanOrEqual(1)
    expect(!!unit.lab || !!unit.sequence || !!unit.matching).toBe(true)
    const steps = activitiesForLesson(lessonById(unit.id)!).filter(
      (activity) => activity.lessonId === unit.id,
    )
    const acquires = steps.some((activity) => activity.interaction === 'acquire')
    if (unit.id === 'ebus-scope')
      expect(acquires && !!unit.matching && !!unit.transferLab).toBe(true)
    else if (unit.id === 'hilar-interlobar')
      expect(acquires && !!unit.matching && !!unit.lab).toBe(true)
    else if (unit.sequence || unit.matching) expect(acquires).toBe(false)
    else expect(acquires).toBe(true)
    if (unit.lab && !acquires)
      expect(steps.some((activity) => activity.image === 'demonstration')).toBe(true)
    expect(unit.sources.every((id) => SOURCES.some((s) => s.id === id))).toBe(true)
    if (unit.lab?.kind === 'simulator')
      expect(manifest.presets.some((p) => p.preset_key === unit.lab!.presetKey)).toBe(true)
  }
  for (const lesson of LESSONS) {
    expect(lesson.sources.every((id) => SOURCES.some((s) => s.id === id))).toBe(true)
    // A merged lesson is as long as its units' steps warrant, not the sum of two lessons.
    if (lesson.parts)
      expect(lesson.minutes).toBeLessThan(
        lesson.parts.reduce((total, part) => total + part.minutes, 0),
      )
    const activities = activitiesForLesson({ ...lesson })
    /*
     * Flow change of 2026-11-10: a lesson asks each of its checks at most once, always ends on
     * the transfer, and no longer asks a middle check that repeats its first one.
     */
    // A check is a unit's question, observation or transfer; a lesson of two units may ask each
    // unit's transfer, never the same check twice.
    const asked = activities.flatMap((activity) =>
      activity.questions.map((slot) => activity.lessonId + ':' + slot),
    )
    expect(new Set(asked).size).toBe(asked.length)
    expect(asked.some((check) => check.endsWith(':transfer'))).toBe(true)
    expect(activities.findLast((activity) => activity.questions.length)!.questions).toEqual([
      'transfer',
    ])
    // A prediction is the lesson's first screen: no teaching is shown before the commitment.
    const prediction = activities.findIndex((activity) => activity.kind === 'prediction')
    expect(prediction).toBeLessThanOrEqual(0)
    if (prediction === 0) {
      expect(activities[0].teaching).toEqual([])
      expect(activities[0].image).toBe('none')
    }
    expect(activities.some((activity) => activity.teaching.includes('foundation'))).toBe(true)
    expect(activities.some((activity) => activity.teaching.includes('worked'))).toBe(true)
    expect(activities.some((activity) => activity.teaching.includes('takeaways'))).toBe(true)
    expect(new Set(activities.map((activity) => activity.id)).size).toBe(activities.length)
  }
  for (const c of [...FINAL_CASES, ...PRACTICE_CASES])
    expect(c.lessonIds.every((id) => ids.includes(id))).toBe(true)
  for (const entry of Object.values(media))
    for (const variants of [entry.ctVariants, entry.bronchoscopyVariants, entry.ebusVariants])
      for (const image of variants) {
        expect(existsSync(resolve('EBUS-course/apps/web/public', '.' + image.image))).toBe(true)
        if ('revealImage' in image)
          expect(existsSync(resolve('EBUS-course/apps/web/public', '.' + image.revealImage))).toBe(
            true,
          )
      }
})
it.each(LESSONS.map((l) => [l.id, l] as const))(
  'renders authored teaching for %s and opens the first check’s explanation before any answer, storing only the location',
  (_, lesson) => {
    render(<LessonHost lesson={lesson} />)
    const activities = activitiesForLesson(lesson)
    // The first briefing states the lesson's objective and teaches from its own content unit.
    const briefing = activities.find((activity) => activity.kind === 'briefing')!
    const unit = partsOf(lesson).find((part) => part.id === briefing.lessonId)!
    const teachingIsOnScreen = () => {
      expect(screen.getByText(lesson.objective, { exact: false })).toBeVisible()
      for (const paragraph of unit.paragraphs) expect(screen.getByText(paragraph)).toBeVisible()
      if (briefing.teaching.includes('worked'))
        expect(screen.getByText(unit.worked.reasoning, { exact: false })).toBeVisible()
    }
    const predicts = activities[0].kind === 'prediction'
    if (predicts) {
      // The commitment comes first: none of the teaching, and no worked example, is shown yet.
      expect(screen.queryByText(unit.paragraphs[0])).not.toBeInTheDocument()
      expect(screen.queryByText(unit.worked.reasoning, { exact: false })).not.toBeInTheDocument()
    } else teachingIsOnScreen()
    expect(reachFirstCheck()).toBe(true)
    const questionId = document
      .querySelector('[data-question-id]')!
      .getAttribute('data-question-id')
    // Lesson 16's first check is its image-reading task, one question per annotated image.
    const question = [
      ...partsOf(lesson).flatMap((part) => [part.question, part.observation, part.transfer]),
      ...READING_ITEMS.map((item) => item.question),
    ].find((item) => item.id === questionId)!
    expect(explanation()).toBeNull()
    expect(screen.queryByText(question.explanation)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(explanation()).toHaveTextContent(question.explanation)
    expect(explanation()).toHaveTextContent('Shown without an answer')
    for (const choice of question.choices) expect(explanation()).toHaveTextContent(choice.rationale)
    expect(verdict()).toBeNull()
    expect(document.querySelectorAll('input[type=radio]:checked')).toHaveLength(0)
    expect(primary()).toBeEnabled()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    const saved = readProgress()
    expect(saved.status).toBe('saved')
    expect(saved.progress.lastLocation).toEqual({ kind: 'lesson', id: lesson.id })
    expect(saved.progress.visitedLessonIds).toEqual([lesson.id])
    expect(saved.progress.reviewedLessonIds).toEqual([])
    expect(Object.keys(localStorage)).toEqual([PROGRESS_STORAGE_KEY])
    if (predicts) {
      next()
      teachingIsOnScreen()
    }
  },
)
it('names the two lessons that open on their teaching instead of a prediction', () => {
  // Doppler's title names its first answer; the six-features lesson commits image by image.
  expect(
    LESSONS.filter((lesson) => activitiesForLesson(lesson)[0].kind !== 'prediction').map(
      (lesson) => lesson.id,
    ),
  ).toEqual(['doppler', 'node-characterization'])
})
it('explains an unsafe practice response immediately, allows retry and moving on, and stores no answer', () => {
  const item = PRACTICE_CASES.find((c) => c.id === 'practice-handoff')!
  const exit = jest.fn()
  render(<CasePlayer item={item} kind="practice" onExit={exit} />)
  const first = item.questions[0]
  fireEvent.click(screen.getByLabelText(first.choices.find((c) => c.unsafe)!.text))
  check()
  expect(screen.getByText('Not correct, and unsafe.', { exact: false })).toBeVisible()
  expect(primary()).toBeEnabled()
  expect(primary()).not.toHaveTextContent('Revise')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(verdict()).toBeNull()
  expect(document.querySelectorAll('input[type=radio]:checked')).toHaveLength(0)
  fireEvent.click(screen.getByLabelText(first.choices.find((c) => c.correct)!.text))
  check()
  expect(screen.getByText('Correct.', { exact: false })).toBeVisible()
  next()
  const second = item.questions[1]
  expect(screen.getByText(second.prompt)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
  expect(explanation()).toHaveTextContent(second.explanation)
  expect(verdict()).toBeNull()
  while (!screen.queryByRole('heading', { name: 'Case debrief' })) {
    expect(primary()).toHaveTextContent('without answering')
    next()
  }
  expect(screen.getAllByText('Not answered in this session.').length).toBe(
    item.questions.length - 1,
  )
  expect(
    screen.getByText('Your response in this session:', { exact: false }).closest('p'),
  ).toHaveTextContent(first.choices.find((c) => c.correct)!.text)
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  expect(readProgress().progress.openedPracticeCaseIds).toEqual(['practice-handoff'])
  expect(exit).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Return to practice' }))
  expect(exit).toHaveBeenCalled()
})
it('opens every integrated case to a learner who has opened no lesson, from the old Assess address and by deep link', () => {
  render(<IntegratedCasesPage />)
  expect(screen.getByRole('heading', { name: 'Apply the complete EBUS approach' })).toBeVisible()
  expect(screen.queryByText(/Finish the guided course first/)).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Open case' })).toHaveLength(FINAL_CASES.length)
  fireEvent.click(screen.getAllByRole('button', { name: 'Open case' })[2])
  expect(screen.getByRole('heading', { name: FINAL_CASES[2].title })).toBeVisible()
  expect(screen.getByText('Integrated case')).toBeVisible()
  expect(readProgress().progress.openedIntegratedCaseIds).toEqual([FINAL_CASES[2].id])
  cleanup()
  render(<IntegratedCasesPage caseId={FINAL_CASES[5].id} />)
  expect(screen.getByRole('heading', { name: FINAL_CASES[5].title })).toBeVisible()
  cleanup()
  render(<IntegratedCasesPage caseId="not-a-case" />)
  expect(screen.getByText('That case link is no longer available', { exact: false })).toBeVisible()
  expect(screen.getByText('2. ' + FINAL_CASES[1].title)).toBeVisible()
  expect(screen.getAllByText(/decisions · Opened$/)).toHaveLength(2)
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
})
it('reads the legacy record only as read-only history and leaves its bytes unchanged through a lesson', () => {
  let r = emptyRecord()
  const c = FINAL_CASES[0],
    q = c.questions[0]
  r = firstAttempt(r, c.id + ':' + q.id, q, 'a')
  r = firstAttempt(r, c.id + ':' + q.id, q, 'b')
  expect(r.firstAttempts[c.id + ':' + q.id].choiceId).toBe('a')
  const legacy = JSON.stringify({
    ...r,
    completed: [LESSONS[0].id, LESSONS[1].id, 'old-lesson'],
    completedCases: [c.id],
    updatedAt: '2026-09-01T00:00:00.000Z',
  })
  localStorage.setItem(STORAGE_KEY, legacy)
  expect(parseRecord(legacy).completed).toEqual([LESSONS[0].id, LESSONS[1].id])
  expect(parseRecord('{broken')).toEqual(emptyRecord())
  expect(parseRecord(JSON.stringify({ ...r, version: 9 }))).toEqual(emptyRecord())
  render(<LessonHost lesson={LESSONS[0]} />)
  while (!screen.queryByRole('heading', { name: 'Lesson finished' })) next()
  expect(localStorage.getItem(STORAGE_KEY)).toBe(legacy)
  const saved = readProgress().progress
  expect(saved.reviewedLessonIds).toEqual([LESSONS[0].id])
  expect(saved.visitedLessonIds).toEqual([LESSONS[0].id])
  expect(saved.openedIntegratedCaseIds).toEqual([])
})
it('exposes only the new direct-link route family without replacing existing EBUS access', () => {
  for (const path of [
    '/en/ebus-guided',
    '/es/ebus-guided/learn',
    '/zh-CN/ebus-guided/practice',
    '/en/ebus-guided/assess',
  ]) {
    expect(isPublicUnlistedPath(path)).toBe(true)
    expect(isPublicPath(path)).toBe(true)
  }
  expect(isPublicUnlistedPath('/en/ebus-guided-unrelated')).toBe(false)
  expect(isPublicUnlistedPath('/en/ebus-training')).toBe(false)
})

it('uses seven chapters and teaches measurement before capture without changing lesson identity', () => {
  expect(CHAPTERS).toHaveLength(7)
  expect(
    LESSONS.indexOf(LESSONS.find((lesson) => lesson.id === 'measurement-phantoms')!),
  ).toBeLessThan(LESSONS.indexOf(LESSONS.find((lesson) => lesson.id === 'capture')!))
  expect(
    new Set(LESSONS.map((lesson) => activitiesForLesson(lesson).length)).size,
  ).toBeGreaterThanOrEqual(4)
})
it('explains a practice response immediately and stores nothing about it', () => {
  const item = PRACTICE_CASES[0],
    question = item.questions[0]
  render(<CasePlayer item={item} kind="practice" onExit={jest.fn()} />)
  fireEvent.click(screen.getByLabelText(question.choices.find((choice) => choice.correct)!.text))
  check()
  expect(screen.getAllByText(question.explanation)[0]).toBeVisible()
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  expect(JSON.stringify(readProgress().progress)).not.toContain(question.id)
})
