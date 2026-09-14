import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LESSONS, nextLesson } from '../content/curriculum'
import { FINAL_CASES, PRACTICE_CASES } from '../content/cases'
import { SOURCES } from '../content/sources'
import { stageLesson } from '../content/stage'
import { LessonHost } from '../components/LessonHost'
import { CasePlayer } from '../components/CasePlayer'
import { AssessPage } from '../components/AssessPage'
import {
  completeCase,
  completeLesson,
  emptyRecord,
  firstAttempt,
  parseRecord,
  readRecord,
  STORAGE_KEY,
} from '../engine/progress'
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
    expect(stageLesson({ ...lesson }).index).toBe(ids.indexOf(lesson.id))
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
  'renders authored teaching and worked reasoning for %s, then withholds them for the decision',
  (_, lesson) => {
    render(<LessonHost lesson={lesson} />)
    expect(screen.getByText(lesson.objective, { exact: false })).toBeVisible()
    for (const paragraph of lesson.paragraphs) expect(screen.getByText(paragraph)).toBeVisible()
    next()
    expect(screen.getByText(lesson.worked.context)).toBeVisible()
    expect(screen.getByText(lesson.worked.reasoning, { exact: false })).toBeVisible()
    next()
    expect(screen.getByText(lesson.question.prompt)).toBeVisible()
    expect(screen.queryByText(lesson.worked.context)).not.toBeInTheDocument()
    expect(screen.queryByText(lesson.question.explanation)).not.toBeInTheDocument()
    expect(document.querySelector('iframe')).not.toBeInTheDocument()
  },
)
it('withholds ordinary practice feedback until debrief; unsafe responses require repair with first response retained', () => {
  const item = PRACTICE_CASES.find((c) => c.id === 'practice-handoff')!
  const exit = jest.fn()
  render(<CasePlayer item={item} mode="practice" onExit={exit} />)
  fireEvent.click(screen.getByLabelText(item.questions[0].choices.find((c) => c.unsafe)!.text))
  next()
  expect(screen.getByText('Not correct, and unsafe.', { exact: false })).toBeVisible()
  expect(primary()).toHaveTextContent('Revise')
  next()
  fireEvent.click(screen.getByLabelText(item.questions[0].choices.find((c) => c.correct)!.text))
  next()
  expect(screen.queryByText('Correct.', { exact: false })).not.toBeInTheDocument()
  next()
  fireEvent.click(screen.getByLabelText(item.questions[1].choices[0].text))
  next()
  expect(screen.queryByText(item.questions[1].explanation)).not.toBeInTheDocument()
  next()
  expect(screen.getByRole('heading', { name: 'Case debrief' })).toBeVisible()
  expect(readRecord().firstAttempts['practice-handoff:drill-retract'].choiceId).toBe('a')
  expect(readRecord().completedCases).toEqual([])
  expect(exit).not.toHaveBeenCalled()
})
it('locks direct assessment entry until required lessons are completed', () => {
  render(<AssessPage />)
  expect(screen.getByText('Finish the guided course first.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start assessment' })).not.toBeInTheDocument()
})
it('keeps one resolver and first responses across reloads, rejects stale records, and gates case completion', () => {
  expect(nextLesson([])?.id).toBe(LESSONS[0].id)
  let r = emptyRecord()
  const c = FINAL_CASES[0],
    q = c.questions[0]
  r = firstAttempt(r, c.id + ':' + q.id, q, 'a')
  r = firstAttempt(r, c.id + ':' + q.id, q, 'b')
  expect(r.firstAttempts[c.id + ':' + q.id].choiceId).toBe('a')
  const answers = Object.fromEntries(
    c.questions.map((q) => [q.id, q.choices.find((c) => c.correct)!.id]),
  )
  expect(completeCase(r, c.id, answers).completedCases).toEqual([])
  r = LESSONS.reduce((record, l) => completeLesson(record, l.id), r)
  expect(nextLesson(r.completed)).toBeUndefined()
  expect(completeCase(r, c.id, {}).completedCases).toEqual([])
  r = completeCase(r, c.id, answers)
  expect(r.completedCases).toEqual([c.id])
  expect(r.assessmentComplete).toBe(false)
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...r, completed: [...r.completed, 'old-lesson'] }),
  )
  expect(readRecord().completed).toEqual(LESSONS.map((l) => l.id))
  expect(parseRecord('{broken')).toEqual(emptyRecord())
  expect(parseRecord(JSON.stringify({ ...r, version: 9 }))).toEqual(emptyRecord())
  expect(readRecord().firstAttempts[c.id + ':' + q.id].choiceId).toBe('a')
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
