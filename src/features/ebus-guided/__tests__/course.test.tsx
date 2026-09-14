import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CHAPTERS, LESSONS } from '../content/curriculum'
import { FINAL_CASES, PRACTICE_CASES } from '../content/cases'
import { SOURCES } from '../content/sources'
import { activitiesForLesson } from '../content/stage'
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
  expect(LESSONS).toHaveLength(26)
  expect(FINAL_CASES).toHaveLength(8)
  const ids = LESSONS.map((l) => l.id)
  expect(new Set(ids).size).toBe(ids.length)
  const questions = LESSONS.flatMap((l) => [l.question, l.observation, l.transfer]).concat(
    [...FINAL_CASES, ...PRACTICE_CASES].flatMap((c) => c.questions),
  )
  expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length)
  for (const q of questions) {
    expect(q.choices.filter((c) => c.correct)).toHaveLength(1)
    for (const c of q.choices) expect(c.rationale.length).toBeGreaterThan(15)
  }
  for (const lesson of LESSONS) {
    expect([lesson.lab, lesson.sequence, lesson.matching].filter(Boolean)).toHaveLength(1)
    expect(lesson.sources.every((id) => SOURCES.some((s) => s.id === id))).toBe(true)
    const activities = activitiesForLesson({ ...lesson })
    expect(activities.flatMap((activity) => activity.questions).sort()).toEqual([
      'observation',
      'question',
      'transfer',
    ])
    expect(activities.some((activity) => activity.teaching.includes('foundation'))).toBe(true)
    expect(activities.some((activity) => activity.teaching.includes('worked'))).toBe(true)
    expect(activities.some((activity) => activity.teaching.includes('takeaways'))).toBe(true)
    expect(new Set(activities.map((activity) => activity.id)).size).toBe(activities.length)
    if (lesson.lab?.kind === 'simulator')
      expect(manifest.presets.some((p) => p.preset_key === lesson.lab!.presetKey)).toBe(true)
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
    expect(screen.getByText(lesson.objective, { exact: false })).toBeVisible()
    for (const paragraph of lesson.paragraphs) expect(screen.getByText(paragraph)).toBeVisible()
    const activities = activitiesForLesson(lesson)
    const worked = activities.find(
      (activity) => activity.interaction === 'read' && activity.teaching.includes('worked'),
    )
    if (worked && activities.indexOf(worked) === 0)
      expect(screen.getByText(lesson.worked.reasoning, { exact: false })).toBeVisible()
    expect(reachFirstCheck()).toBe(true)
    const questionId = document
      .querySelector('[data-question-id]')!
      .getAttribute('data-question-id')
    const question = [lesson.question, lesson.observation, lesson.transfer].find(
      (item) => item.id === questionId,
    )!
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
  },
)
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
  expect(screen.getByText('Integrated case · Authored clinical case')).toBeVisible()
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
