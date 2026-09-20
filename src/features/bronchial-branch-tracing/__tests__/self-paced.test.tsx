import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import {
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  createEmptyCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  writeCriticalCareProgress,
} from '@/features/learning-module/activity/progress'
import { BranchTracingOverview } from '../components/BranchTracingOverview'
import { BranchTracingPractice } from '../components/BranchTracingPractice'
import { BASE_PATH, LESSONS, ORIENTATION_CONTRACT, SOURCE } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { ASSESS_TRACES, SEGMENT_PRACTICE_TRACES } from '../content/practice'
import { DRAFT_PREFIX, draftSignature } from '../engine/ct-draft'
import { emptyLocalSession, localSessionReducer } from '../engine/local-session'
import { PREFIX } from '../engine/progress'
import {
  emptySelfPacedRecord,
  readSelfPacedRecord,
  recommendedLesson,
  recordDisplayExplanationShown,
  recordLessonOpened,
  SELF_PACED_STORAGE_KEY,
  setLessonReviewed,
  setLessonReviewLater,
} from '../engine/selfPacedProgress'
import { CT_TARGETS, CT_TRACES, NATIVE_CT, sliceZ, traceById } from '../geometry/native-ct'
import { orientationFor, STANDARD_ORIENTATION } from '../geometry/orientation'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('next/dynamic', () => () => () => null)

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
const imageReady = () =>
  document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
const storedKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).sort()
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Grade, lock and surveillance wording the self-paced course must not show or announce. */
const GRADE_WORDING = [
  /first (attempt|response)/i,
  /hint level/i,
  /independent (interpretation|application)/i,
  /ungraded check/i,
  /tracing reminder used/i,
  /\(preserved\)/i,
  /submit all/i,
  /(withheld|hidden) until/i,
  /\bmastery\b/i,
  /\bpass(ed)? (the|threshold met)/i,
  /Assess ·/,
]
function expectNoGradeWording(root: HTMLElement) {
  const text = [
    root.textContent ?? '',
    ...Array.from(root.querySelectorAll('[aria-label]')).map((el) => el.getAttribute('aria-label')),
  ].join('\n')
  for (const pattern of GRADE_WORDING)
    expect([String(pattern), pattern.test(text)]).toEqual([String(pattern), false])
}

describe('self-paced record', () => {
  it('stores only declared place fields, writes idempotently and never overwrites an unreadable value', () => {
    expect(readSelfPacedRecord(localStorage).status).toBe('empty')
    expect(recordLessonOpened('follow-one-airway', localStorage)).toBe(true)
    const once = localStorage.getItem(SELF_PACED_STORAGE_KEY)
    expect(recordLessonOpened('follow-one-airway', localStorage)).toBe(true)
    expect(localStorage.getItem(SELF_PACED_STORAGE_KEY)).toBe(once)
    setLessonReviewed('follow-one-airway', true, localStorage)
    setLessonReviewLater('continuity', true, localStorage)
    recordDisplayExplanationShown('mirror', localStorage)
    const { record } = readSelfPacedRecord(localStorage)
    expect(Object.keys(record).sort()).toEqual([
      'displayExplanationsShown',
      'lastLessonId',
      'reviewLaterLessonIds',
      'reviewedLessonIds',
      'updatedAt',
      'version',
      'visitedLessonIds',
    ])
    expect(record).toMatchObject({
      version: 1,
      lastLessonId: 'follow-one-airway',
      visitedLessonIds: ['follow-one-airway'],
      reviewedLessonIds: ['follow-one-airway'],
      reviewLaterLessonIds: ['continuity'],
      displayExplanationsShown: ['mirror'],
    })
    expect(storedKeys()).toEqual([SELF_PACED_STORAGE_KEY])
    localStorage.setItem(SELF_PACED_STORAGE_KEY, JSON.stringify({ ...record, marks: [[1, 2]] }))
    expect(readSelfPacedRecord(localStorage).status).toBe('unreadable')
    const carrying = localStorage.getItem(SELF_PACED_STORAGE_KEY)
    expect(setLessonReviewed('continuity', true, localStorage)).toBe(false)
    expect(localStorage.getItem(SELF_PACED_STORAGE_KEY)).toBe(carrying)
    localStorage.setItem(SELF_PACED_STORAGE_KEY, '{not json')
    expect(recordLessonOpened('continuity', localStorage)).toBe(false)
    expect(localStorage.getItem(SELF_PACED_STORAGE_KEY)).toBe('{not json')
    expect(recordLessonOpened('continuity', null)).toBe(false)
  })
  it('recommends from the self-paced record only', () => {
    const empty = emptySelfPacedRecord()
    expect(recommendedLesson(empty)).toMatchObject({
      kind: 'start',
      lesson: { id: 'follow-one-airway' },
    })
    expect(
      recommendedLesson({ ...empty, lastLessonId: 'vertical', visitedLessonIds: ['vertical'] }),
    ).toMatchObject({ kind: 'resume', lesson: { id: 'vertical' } })
    expect(
      recommendedLesson({
        ...empty,
        lastLessonId: 'follow-one-airway',
        visitedLessonIds: ['follow-one-airway'],
        reviewedLessonIds: ['follow-one-airway'],
      }),
    ).toMatchObject({ kind: 'continue', lesson: { id: 'orientation' } })
    expect(
      recommendedLesson({ ...empty, lastLessonId: 'retired', visitedLessonIds: ['retired'] }),
    ).toMatchObject({ kind: 'continue', lesson: { id: 'follow-one-airway' } })
    expect(recommendedLesson({ ...empty, reviewedLessonIds: LESSONS.map((l) => l.id) })).toBeNull()
  })
})

describe('storage boundary', () => {
  const featureRoot = path.join(process.cwd(), 'src/features/bronchial-branch-tracing')
  const sourceFiles = (dir: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? entry.name === '__tests__'
            ? []
            : sourceFiles(path.join(dir, entry.name))
          : /\.tsx?$/.test(entry.name)
            ? [path.join(dir, entry.name)]
            : [],
      )
  it('no course source writes the shared activity envelope, imports the legacy readers, or writes storage outside the declared owners', () => {
    const writers = [
      'engine/selfPacedProgress.ts',
      'engine/ct-draft.ts',
      // The chosen Practice segment, a place preference restored on the landing.
      'components/BranchTracingPractice.tsx',
    ]
    const files = sourceFiles(featureRoot)
    expect(files.length).toBeGreaterThan(40)
    for (const file of files) {
      const rel = path.relative(featureRoot, file).split(path.sep).join('/')
      const text = fs.readFileSync(file, 'utf8')
      expect([
        rel,
        /writeCriticalCareProgress|upsertCriticalCareActivityProgress|CRITICAL_CARE_PROGRESS_STORAGE_KEY/.test(
          text,
        ),
      ]).toEqual([rel, false])
      expect([rel, /from '(\.\.\/engine|\.)\/progress'/.test(text)]).toEqual([rel, false])
      expect([rel, /\.setItem\(/.test(text)]).toEqual([rel, writers.includes(rel)])
    }
  })
})

describe('Follow one airway is authored for its own intervals', () => {
  const lesson = LESSONS[0]
  const continuity = LESSONS.find((l) => l.id === 'continuity')!
  const intervals = lesson.exercises!.map(localExercise)
  it('does not inherit the bifurcation lesson teaching', () => {
    expect(lesson.id).toBe('follow-one-airway')
    for (const field of [
      'objective',
      'concept',
      'worked',
      'interpretation',
      'transferPrompt',
      'sourcePages',
      'example',
    ] as const)
      expect([field, lesson[field]]).not.toEqual([field, continuity[field]])
    expect(lesson.teaching.some((paragraph) => continuity.teaching.includes(paragraph))).toBe(false)
    const text = [
      lesson.objective,
      lesson.concept,
      lesson.purpose,
      ...lesson.teaching,
      lesson.worked,
      lesson.interpretation,
      lesson.transferPrompt,
      ...lesson.checklist!,
    ].join(' ')
    expect(text).not.toMatch(/upper.lobe|RB5|intermedius|middle lobe|turns cranially/i)
    expect(lesson.purpose).toBeTruthy()
    expect(lesson.checklist!.length).toBeGreaterThanOrEqual(3)
  })
  it('describes the actual central airways, direction and length of its two CT intervals', () => {
    expect(intervals.map((e) => e.spec.traceId)).toEqual([lesson.prediction, lesson.transfer])
    expect(lesson.example).toBe(lesson.prediction)
    expect(intervals.map((e) => e.trace.checkpoints[0].airway.code)).toEqual(['Trachea', 'LMSB'])
    expect(lesson.worked).toMatch(/trachea above the carina/)
    expect(lesson.worked).toMatch(/left main bronchus/)
    expect(lesson.transferPrompt).toMatch(/left main bronchus/)
    expect(lesson.worked).toMatch(/four 0\.5 mm steps \(2 mm\)/)
    expect(lesson.worked).toMatch(/caudal/)
    expect(lesson.checklist!.join(' ')).toMatch(/0\.5 mm/)
    for (const interval of intervals) {
      const start = interval.trace.anchor.slice
      const end = interval.answerPoints[0].slice
      expect(start - end).toBe(4)
      expect((start - end) * NATIVE_CT.spacing[2]).toBe(2)
      // LPS z rises with the slice number, so a falling slice number is a caudal step.
      expect(sliceZ(end)).toBeLessThan(sliceZ(start))
      expect(interval.frames.map((f) => f.slice)).toEqual([0, 1, 2, 3, 4].map((i) => start - i))
    }
  })
  it('stays in standard axial display and never accepts a transform, even after a convention was explained elsewhere', () => {
    let s = emptyLocalSession(intervals, {}, ['mirror', 'rul', 'upper-division'])
    expect(s.orientation).toEqual(STANDARD_ORIENTATION)
    s = localSessionReducer(intervals, s, { type: 'focus-airway' })
    s = localSessionReducer(intervals, s, { type: 'begin' })
    for (const preset of ['mirror', 'rul', 'upper-division'] as const)
      expect(
        localSessionReducer(intervals, s, { type: 'orientation', value: orientationFor(preset) }),
      ).toBe(s)
  })
  it('keeps every lesson step open', () => {
    for (const l of LESSONS)
      for (const step of l.steps)
        expect([l.id, step.id, step.gate]).toEqual([l.id, step.id, 'open'])
  })
  it('leaves exercise geometry, CT traces, targets and local draft signatures as they were before BBT-01', () => {
    // Recorded at 5d21844f, before any BBT-01 edit (Local-Data evidence: baseline/geometry-signatures.json).
    const baseline: Record<string, [string, string]> = {
      'follow-one-airway': [
        'c6-local-teaching-r1.95260c11',
        '3431eb591a73f2c050a7729baf953a52c2da026f19d80afd8550b1e57a8f7632',
      ],
      orientation: [
        'c6-local-teaching-r1.9fd5eccd',
        '1d93a6faf80561a8f3082722d7ca184fa4f54389a699cc5f8eec4d08415d7b56',
      ],
      continuity: [
        'c6-local-teaching-r1.71168219',
        'fef17cc0dc16d6661d2f06de9e7b5473f898d0402110d9e803747ac426b2cb10',
      ],
      vertical: [
        'c6-local-teaching-r1.e1832196',
        '7636d7aba0a282c0ed9b70ac18fe9d3e5378d9c270a6b949d33e9164c1fe6d8d',
      ],
      'horizontal-horizontal': [
        'c6-local-teaching-r1.775e75c0',
        '779627d7ceb3a02daac99ccc63cc784759dce7c74eba5dae0cbb40a60c16482a',
      ],
      'horizontal-vertical': [
        'c6-local-teaching-r1.c31265d3',
        '8c3c2c41b550767720027f3a49a7043a3c7cf3f343d732ea959e110b2c89cbd6',
      ],
      'horizontal-oblique': [
        'c6-local-teaching-r1.9cb27899',
        'ecbee26e82b2d3ef90aec0c7ba0b5337370ec0b5d75168b2996f45046f541952',
      ],
      'orientation-changes': [
        'c6-local-teaching-r1.ed4e2f28',
        '96105905be302c93043332e01fa6e5d56cfb79f08328ac1aa895a280435594cf',
      ],
    }
    const local = LESSONS.filter((l) => l.exercises)
    expect(local.map((l) => l.id)).toEqual(Object.keys(baseline))
    for (const l of local) {
      const exercises = l.exercises!.map(localExercise)
      const signature = draftSignature([
        l.id,
        l.id === 'orientation' ? ORIENTATION_CONTRACT : 'local-tracing',
        exercises.map((e) => ({
          id: e.id,
          trace: e.trace,
          answers: e.answerPoints,
          review: e.review,
        })),
      ])
      const geometry = sha(
        exercises.map((e) => ({
          id: e.id,
          trace: e.trace,
          frames: e.frames.map((f) => ({ slice: f.slice, overlays: f.overlays })),
          answerPoints: e.answerPoints,
        })),
      )
      expect([l.id, signature, geometry]).toEqual([l.id, ...baseline[l.id]])
    }
    expect(sha(CT_TRACES)).toBe('86b223c8ef59e3d7943d52984718cff853615a5f876dd2556614742f3e0581a4')
    expect(sha(CT_TARGETS)).toBe('ca1a873b489309e16009b8c3dd7c080fe9890a0a0a38c903c0f4d9685643f957')
  })
})

describe('Overview', () => {
  it('opens every lesson, starts at Follow one airway, cites the named source and shows no grade', async () => {
    const { container } = render(<BranchTracingOverview />)
    const start = await screen.findByRole('link', { name: 'Start learning' })
    expect(start).toHaveAttribute('href', `${BASE_PATH}/learn?lesson=follow-one-airway`)
    for (const lesson of LESSONS)
      expect(screen.getByRole('link', { name: lesson.title })).toHaveAttribute(
        'href',
        `${BASE_PATH}/learn?lesson=${lesson.id}`,
      )
    const source = screen.getByRole('link', { name: SOURCE.title })
    expect(source).toHaveAttribute('href', SOURCE.url)
    expect(source.closest('p')).toHaveTextContent(
      'The four-pattern framework follows Kurimoto & Morita. Bronchial Branch Tracing (2020), Chapter 1.',
    )
    expect(
      Array.from(container.querySelectorAll('a')).some(
        (a) =>
          a.getAttribute('href') === `${BASE_PATH}/assess` && /More routes/.test(a.textContent!),
      ),
    ).toBe(true)
    expectNoGradeWording(container)
    expect(await axe(container)).toHaveNoViolations()
  })
  it('continues from the self-paced record, ignores legacy completions and scores, and leaves their bytes unchanged', async () => {
    const at = '2026-09-01T00:00:00.000Z'
    let legacy = createEmptyCriticalCareProgress(at)
    for (const lesson of LESSONS)
      legacy = upsertCriticalCareActivityProgress(legacy, {
        activityId: `${PREFIX}.learn.${lesson.id}${lesson.id === 'orientation' ? `.${ORIENTATION_CONTRACT}` : ''}`,
        status: 'completed',
        attempts: 1,
        bestScore: 100,
        hintCount: 0,
        competencyEvidenceIds: [],
        updatedAt: at,
      })
    writeCriticalCareProgress(localStorage, legacy)
    const bytes = localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
    render(<BranchTracingOverview />)
    expect(await screen.findByRole('link', { name: 'Start learning' })).toBeVisible()
    expect(screen.queryByText('Reviewed')).toBeNull()
    act(() => {
      recordLessonOpened('follow-one-airway')
      setLessonReviewed('follow-one-airway', true)
      setLessonReviewLater('vertical', true)
    })
    expect(
      screen.getByRole('link', { name: 'Continue: Relate CT to the parent airway view' }),
    ).toHaveAttribute('href', `${BASE_PATH}/learn?lesson=orientation`)
    expect(screen.getByRole('heading', { name: 'Saved for review' })).toBeVisible()
    expect(screen.getByText('Reviewed')).toBeVisible()
    expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBe(bytes)
  })
  it('says when the saved place cannot be read and leaves it untouched', async () => {
    localStorage.setItem(SELF_PACED_STORAGE_KEY, '{"version":2}')
    render(<BranchTracingOverview />)
    expect(
      await screen.findByText(/could not be read, so it has been left untouched/),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Start learning' })).toBeVisible()
    expect(localStorage.getItem(SELF_PACED_STORAGE_KEY)).toBe('{"version":2}')
  })
})

describe('Practice and the former Assess address', () => {
  // BBT-01 superseded the Assess contract "withholds marks, model choices and camera cues until
  // independent set submission" (e2e): the address now opens four more self-paced routes.
  it('opens four more routes with references on request, open traces and a comparison without recording', async () => {
    const trace = traceById(ASSESS_TRACES[0])
    const { container } = render(<BranchTracingPractice mode="assess" />)
    expect(
      screen.getByRole('heading', { name: 'Trace four more routes to simulated nodules' }),
    ).toBeVisible()
    expectNoGradeWording(container)
    fireEvent.click(screen.getByRole('button', { name: 'Start the route set' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Use this orientation' }))
    imageReady()
    for (const i of ASSESS_TRACES.keys())
      expect(screen.getByRole('button', { name: `Trace ${i + 1}` })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Go to response slice' }))
    imageReady()
    expect(document.querySelector('[data-ct-reference="1"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show reference for this junction' }))
    imageReady()
    expect(document.querySelector('[data-ct-reference="1"]')).not.toBeNull()
    expect(document.querySelector('[data-branch-comparison]')).not.toBeNull()
    expect(screen.queryByLabelText('Your mark 1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Continue without recording' }))
    imageReady()
    expect(
      screen.getAllByText(`Junction 2 of ${trace.checkpoints.length - 1}`).length,
    ).toBeGreaterThan(0)
    expectNoGradeWording(container)
    fireEvent.click(screen.getByRole('button', { name: 'Compare all routes with the reference' }))
    expect(
      screen.getByRole('heading', { name: 'Compare your routes with the reference' }),
    ).toBeVisible()
    expect(screen.getByText(/^0 of 4 routes have a recorded interpretation/)).toBeVisible()
    // Continuing without recording leaves no junction work, so no route is shown as partial.
    expect(
      screen.getAllByText(/No junction work and no interpretation recorded for this route/),
    ).toHaveLength(4)
    expect(document.querySelectorAll('[data-route-state="partial"]')).toHaveLength(0)
    expectNoGradeWording(container)
    const drafts = storedKeys()
      .filter((key) => key.startsWith(`${DRAFT_PREFIX}assess.`))
      .map((key) => JSON.parse(localStorage.getItem(key)!).value)
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      attempts: {},
      submitted: true,
      responses: [null, null, null, null],
    })
    expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
  })
  it('keeps a checked junction exactly as placed, without hint use or a support label', async () => {
    const trace = traceById(SEGMENT_PRACTICE_TRACES[2])
    render(<BranchTracingPractice mode="practice" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start CT practice' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Use this orientation' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Tracing reminder' }))
    const unresolved = screen
      .getAllByRole('radio')
      .find((input) => (input as HTMLInputElement).value === 'unresolved')!
    fireEvent.click(unresolved)
    fireEvent.click(screen.getByRole('button', { name: 'Go to response slice' }))
    imageReady()
    fireEvent.click(screen.getByRole('button', { name: 'Lumen unresolved here' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check this junction' }))
    expect(screen.getByText('Junction comparison')).toBeVisible()
    const stored = storedKeys()
      .filter((key) => key.startsWith(`${DRAFT_PREFIX}practice.`))
      .map((key) => JSON.parse(localStorage.getItem(key)!).value)
    expect(stored[0].attempts).toEqual({
      [`${trace.id}.${trace.checkpoints[0].id}`]: [
        {
          mark: { slice: trace.checkpoints[0].slice, pixel: null },
          branch: 'unresolved',
          orientation: STANDARD_ORIENTATION,
        },
      ],
    })
    expect(screen.queryByText(/hint level|First response/)).toBeNull()
  })
})
