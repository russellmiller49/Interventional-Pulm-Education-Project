/**
 * BBT-PRE-REVIEW-04 — teaching before testing, entry language and a coherent optional route flow.
 *
 * Every assertion here is about wording, order or identity. None of them may pass by changing a
 * response plane, a draft signature or a stored record: the last block pins all of those.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity/progress'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { BranchTracingOverview } from '../components/BranchTracingOverview'
import { BranchTracingPractice } from '../components/BranchTracingPractice'
import { CourseOutline } from '../components/CourseOutline'
import { CtOrientationTeaching } from '../components/CtOrientationTeaching'
import { courseSentences, courseFor } from '../components/DivisionPrimer'
import {
  DIRECTION_CHANGE,
  PATTERNS,
  REGIONAL_NOTES,
  TERMS,
  courseMap,
  lessonText,
  moreRoutesSet,
} from '../content/course-guide'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import { BASE_PATH, LESSONS, ORIENTATION_CONTRACT } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { ASSESS_TRACES, PRACTICE_TRACES, SEGMENT_PRACTICE_TRACES } from '../content/practice'
import { displayAnswerLabel, divisionIdentities } from '../engine/branch-identity'
import { DRAFT_PREFIX, draftSignature } from '../engine/ct-draft'
import { count, displayName, displayOptionLabel } from '../engine/display-text'
import {
  SELF_PACED_STORAGE_KEY,
  readSelfPacedRecord,
  recordLessonOpened,
  setLessonReviewed,
  setLessonReviewLater,
} from '../engine/selfPacedProgress'
import { targetForTrace, traceById } from '../geometry/native-ct'
import signatureBaseline from './fixtures/draft-signatures-baseline.json'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
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
const ready = () => document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
const click = (name: string | RegExp) => {
  ready()
  fireEvent.click(screen.getByRole('button', { name }))
  ready()
}
const lessonById = (id: string) => LESSONS.find((l) => l.id === id)!
const localDraft = (id: string) =>
  JSON.parse(localStorage.getItem(`${DRAFT_PREFIX}learn.${id}`)!).value
const storageKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).sort()

describe('four-pattern reference comes from the lessons, not from their addresses', () => {
  it('reuses each definition verbatim from its lesson and finds the pattern named in that lesson’s text', () => {
    expect(PATTERNS.map((p) => p.name)).toEqual([
      'Vertical',
      'Horizontal–horizontal',
      'Horizontal–vertical',
      'Horizontal–oblique',
    ])
    for (const pattern of PATTERNS) {
      const text = lessonText(lessonById(pattern.lessonId))
      expect([pattern.lessonId, text.includes(pattern.evidence)]).toEqual([pattern.lessonId, true])
      for (const sentence of pattern.definition)
        expect([pattern.lessonId, sentence, text.includes(sentence)]).toEqual([
          pattern.lessonId,
          sentence,
          true,
        ])
    }
    const direction = lessonText(lessonById(DIRECTION_CHANGE.lessonId))
    for (const sentence of DIRECTION_CHANGE.definition) expect(direction).toContain(sentence)
  })
  it('keeps the four patterns on four distinct pattern lessons of the nine-lesson registry', () => {
    const numbers = PATTERNS.map((p) => LESSONS.findIndex((l) => l.id === p.lessonId) + 1)
    expect(numbers).toEqual([4, 5, 6, 7])
    expect(new Set(PATTERNS.map((p) => p.lessonId)).size).toBe(4)
    expect(LESSONS).toHaveLength(9)
  })
  it('defines the terms the overview uses before they are taught', () => {
    const terms = TERMS.map((t) => t.term)
    for (const term of ['Parent airway view', 'Parent viewpoint', 'Camera roll', 'Model reference'])
      expect(terms).toContain(term)
    expect(TERMS.every((t) => !/always|universal/i.test(t.text))).toBe(true)
  })
})

describe('Overview: one map of Learn, Practice and More routes', () => {
  it('derives counts and overlaps from the registries and keeps estimates visible after review', async () => {
    const map = courseMap()
    expect(map).toMatchObject({
      lessons: LESSONS.length,
      estimatedMinutes: LESSONS.reduce((n, l) => n + l.minutes, 0),
      practiceTargets: SEGMENT_PRACTICE_TRACES.length,
      mixedSet: PRACTICE_TRACES.length,
      moreRoutes: ASSESS_TRACES.length,
    })
    const example = targetForTrace(traceById(lessonById('variants-limits').example))
    const transfer = targetForTrace(traceById(lessonById('variants-limits').transfer))
    const set = moreRoutesSet()
    expect(set.find((e) => e.target.id === example.id)?.alsoIn).toContain('Lesson 9 worked example')
    expect(set.find((e) => e.target.id === transfer.id)?.alsoIn).toContain(
      'Lesson 9 transfer route',
    )
    expect(map.moreRoutesAlsoInLearn).toBe(2)
    expect(map.moreRoutesAlsoInPractice).toBe(ASSESS_TRACES.length)

    localStorage.setItem(`${DRAFT_PREFIX}practice.right-upper-apical`, '{"version":1}')
    const { container } = render(<BranchTracingOverview />)
    await screen.findByRole('link', { name: 'Start learning' })
    const courseMapSection = container.querySelector('[data-course-map]') as HTMLElement
    expect(within(courseMapSection).getByRole('link', { name: 'Learn' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/learn?lesson=follow-one-airway`,
    )
    expect(within(courseMapSection).getByRole('link', { name: 'Practice' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/practice`,
    )
    expect(within(courseMapSection).getByRole('link', { name: 'More routes' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/assess`,
    )
    expect(courseMapSection).toHaveTextContent(/not a measured learner time/)
    expect(courseMapSection).toHaveTextContent(/revisit, not a new patient or a test/)
    expect(courseMapSection).toHaveTextContent(/A Practice draft is saved on this device/)
    expect(courseMapSection).not.toHaveTextContent(/More routes draft/)
    // B versus S on first sight of the RS5 target.
    expect(container.querySelector('[data-naming-key]')).toHaveTextContent(
      /B denotes a bronchus and S its pulmonary segment.*The target RS5 .* is a segment; its segmental bronchus is RB5/,
    )
    for (const pattern of PATTERNS)
      expect(screen.getByText(`Pattern: ${pattern.name}`)).toBeVisible()
    const before = storageKeys()
    act(() => {
      recordLessonOpened('follow-one-airway')
      setLessonReviewed('follow-one-airway', true)
      setLessonReviewLater('vertical', true)
    })
    const first = screen.getByRole('link', { name: LESSONS[0].title }).closest('li')!
    expect(first).toHaveTextContent(`Reviewed · about ${LESSONS[0].minutes} min`)
    expect(screen.getByRole('heading', { name: 'Saved for later' })).toBeVisible()
    // The bookmark is the same stored field; nothing new is written for the labels.
    expect(readSelfPacedRecord(localStorage).record.reviewLaterLessonIds).toEqual(['vertical'])
    expect(storageKeys()).toEqual([...new Set([...before, SELF_PACED_STORAGE_KEY])].sort())
    expect(await axe(container)).toHaveNoViolations()
  })
  it('offers Practice and More routes after the lessons in the course outline, and names the bookmark apart from Mark reviewed', () => {
    render(<CourseOutline currentId="follow-one-airway" />)
    const save = screen.getByRole('button', { name: 'Save for later' })
    fireEvent.click(save)
    expect(readSelfPacedRecord(localStorage).record.reviewLaterLessonIds).toEqual([
      'follow-one-airway',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Course outline' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('link', { name: 'Practice' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/practice`,
    )
    expect(within(dialog).getByRole('link', { name: 'More routes' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/assess`,
    )
    expect(dialog).toHaveTextContent(/Save for later bookmarks a lesson; Mark reviewed/)
    expect(dialog).toHaveTextContent(/vertical pattern · about 6 min/)
  })
})

describe('Lesson 9: worked route, your route and the transfer route stay distinct', () => {
  const lesson = lessonById('variants-limits')
  const example = targetForTrace(traceById(lesson.example))
  const own = targetForTrace(traceById(lesson.prediction))
  const transfer = targetForTrace(traceById(lesson.transfer))
  const session = () =>
    JSON.parse(localStorage.getItem(`${DRAFT_PREFIX}learn.${lesson.id}`)!).value.session

  it('steps through the worked route without seeding marks, then opens the learner’s own target', async () => {
    const { container } = render(<BranchTracingLesson requestedId={lesson.id} />)
    const heading = await screen.findByRole('heading', {
      name: `Worked example: the route to ${example.segment.code}`,
    })
    expect(heading).toBeVisible()
    const roles = container.querySelector('[data-route-roles]') as HTMLElement
    expect(
      within(roles)
        .getByText(/Worked example/)
        .closest('li'),
    ).toHaveTextContent(example.segment.code)
    expect(roles.querySelector('[data-route-role="own"]')).toHaveTextContent(own.segment.code)
    expect(roles.querySelector('[data-route-role="transfer"]')).toHaveTextContent(
      transfer.segment.code,
    )
    expect(container.querySelector('[data-map-owner]')).toHaveAttribute(
      'data-map-owner',
      'worked-example',
    )
    expect(screen.queryByText(/Your route map/)).toBeNull()
    expect(
      screen.queryByRole('group', { name: 'Which daughter continues toward the target?' }),
    ).toBeNull()
    const junctions = traceById(lesson.example).checkpoints.length
    ready()
    expect(
      screen.getByRole('button', { name: `Skip to your own trace: ${own.segment.code}` }),
    ).toBeEnabled()
    for (let i = 0; i < junctions - 1; i++) {
      click(`Next worked junction (${example.segment.code} route)`)
      expect(session().active).toBe(i + 1)
      expect(session().marks.every((m: unknown) => m === null)).toBe(true)
      expect(session().recorded.every((r: boolean) => !r)).toBe(true)
      expect(session().junctionHistory).toEqual({})
    }
    expect(screen.queryByRole('button', { name: /Skip to your own trace/ })).toBeNull()
    click(`Start your own trace: ${own.segment.code}`)
    expect(session()).toMatchObject({ step: 1, active: 0, junctionHistory: {} })
    expect(session().marks).toEqual(traceById(lesson.prediction).checkpoints.map(() => null))
    expect(container.querySelector('[data-route-role="own"]')).toHaveTextContent(
      `Your trace · target ${own.segment.code}`,
    )
    expect(container.querySelector('[data-map-owner]')).toHaveAttribute('data-map-owner', 'learner')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('offers an optional, unrecorded reflection with the reference, then the transfer route by its target', async () => {
    const { container } = render(<BranchTracingLesson requestedId={lesson.id} />)
    await screen.findByRole('button', { name: `Skip to your own trace: ${own.segment.code}` })
    click(`Skip to your own trace: ${own.segment.code}`)
    click('Use this orientation')
    const junctions = traceById(lesson.prediction).checkpoints.length
    for (let i = 0; i < junctions - 1; i++) click('Continue without recording')
    click('Continue without recording this trace')
    click('Show the comparison without recording')
    click('Review the relationship')
    expect(
      screen.getByRole('heading', { name: 'Optional reflection: relate the two views' }),
    ).toBeVisible()
    expect(screen.getByText(/Nothing here is recorded or checked/)).toBeVisible()
    // No text box, no answer choice and no gate: the reflection is never collected.
    expect(container.querySelector('textarea, input[type="text"]')).toBeNull()
    const reference = container.querySelector('[data-reflection-reference]') as HTMLElement
    expect(reference).toHaveTextContent(/Source levels:/)
    expect(reference).toHaveTextContent(`in ${own.segment.code}`)
    expect(reference).toHaveTextContent(/only the reference is shown/)
    const before = JSON.stringify(session())
    const next = screen.getByRole('button', {
      name: `Continue to another trace: ${transfer.segment.code}`,
    })
    expect(next).toBeEnabled()
    expect(JSON.stringify(session())).toBe(before)
    click(`Continue to another trace: ${transfer.segment.code}`)
    expect(session().step).toBe(5)
    expect(container.querySelector('[data-route-role="transfer"]')).toHaveTextContent(
      `Another trace · target ${transfer.segment.code}`,
    )
    click('Finish without recording')
    expect(screen.getByRole('link', { name: 'Continue to Practice' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/practice`,
    )
    expect(screen.getByRole('link', { name: 'Return to overview' })).toHaveAttribute(
      'href',
      BASE_PATH,
    )
    expect(localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).toBeNull()
  })
})

describe('local lessons teach before the try', () => {
  it('Lesson 1 states this CT’s slice direction and the B/S key before the first mark', async () => {
    render(<BranchTracingLesson requestedId="follow-one-airway" />)
    await screen.findByRole('button', { name: 'Focus on this airway' })
    click('Focus on this airway')
    expect(document.querySelector('[data-slice-direction]')).toHaveTextContent(
      /slice numbers rise toward the head.*belongs to this CT’s export/,
    )
    expect(document.querySelector('[data-naming-key]')).toHaveTextContent(
      /B denotes a bronchus and S its pulmonary segment/,
    )
    expect(screen.getByText(/Optional: full-route Practice and source limits/)).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Open full-route Practice (optional)' }),
    ).toHaveAttribute('href', `${BASE_PATH}/practice`)
    expect(document.body).toHaveTextContent(
      /The suggested path continues with Lesson 2: Relate CT to the parent airway view/,
    )
  })

  it('Lesson 4 shows the bright-ring and dark-lumen cue in the worked example, before marking', async () => {
    render(<BranchTracingLesson requestedId="vertical" />)
    const heading = await screen.findByRole('heading', {
      name: '1. Worked example: watch this division',
    })
    expect(heading).toBeVisible()
    const primer = document.querySelector('[data-division-primer="junction-14"]') as HTMLElement
    expect(primer).toHaveTextContent(
      'an airway here is a dark lumen with a thin bright ring, not a bright dot',
    )
    expect(primer).toHaveTextContent(/runs toward cranial levels \(higher slice numbers\)/)
    expect(document.querySelector('[data-mode="worked"]')).toHaveTextContent(/Nothing is recorded/)
    expect(document.querySelector('[data-pattern]')).toHaveAttribute('data-pattern', 'Vertical')
    expect(screen.getAllByText(/^Worked example · Example 1 of 2/).length).toBeGreaterThan(0)
    click('Start marking branches')
    expect(screen.getAllByText(/^Try tracing · Example 1 of 2/).length).toBeGreaterThan(0)
    expect(document.querySelector('[data-mode="try"]')).toHaveTextContent(
      /guided practice on it, not an independent test/,
    )
    expect(localDraft('vertical').marks).toEqual([null, null])
  })

  it('states a change of direction before the Lesson 3 LB6 example, which opens without a demonstration', async () => {
    const ex = localExercise(lessonById('continuity').exercises![1])
    const sentences = courseSentences(courseFor(ex)!, 'continuity').join(' ')
    expect(sentences).toMatch(
      /Daughter A · LB6’s response slice, 326, lies 5 slices cranial of the node/,
    )
    expect(sentences).toMatch(/turns back against the direction you arrived from/)
    expect(sentences).toContain(DIRECTION_CHANGE.definition[1])
    expect(sentences).toMatch(/Lesson 8 teaches this change in tracing direction in full/)

    render(<BranchTracingLesson requestedId="continuity" />)
    await screen.findByRole('button', { name: 'Focus on this airway' })
    click('Focus on this airway')
    click('Start marking branches')
    click('Continue without marking')
    click('Compare with the caudal tracing view')
    click('Apply this to the same airway')
    click('Next example: LLL')
    expect(screen.getAllByText(/^Try tracing · Example 2 of 2 · LLL/).length).toBeGreaterThan(0)
    expect(document.querySelector('[data-mode="try"]')).toHaveTextContent(
      /opens without a demonstration/,
    )
    click('Watch a worked walkthrough')
    click(`Start from the parent · slice ${ex.trace.anchor.slice}`)
    expect(localDraft('continuity').marks).toEqual([null, null])
    expect(localDraft('continuity').history).toEqual({})
    expect(document.body).toHaveTextContent(
      /Each branch button above jumps straight to that daughter’s response slice/,
    )
  })

  it('labels the repeated RB5 division as an optional revisit', async () => {
    render(<BranchTracingLesson requestedId="horizontal-vertical" />)
    await screen.findByRole('button', { name: 'Start marking branches' })
    click('Start marking branches')
    click('Continue without marking')
    if (screen.queryByRole('button', { name: 'Compare with the caudal tracing view' })) {
      click('Compare with the caudal tracing view')
      click('Apply this to the same airway')
    }
    click(/^Next example:/)
    expect(screen.getAllByText(/Optional revisit · Example 2 of 2 · RB5/).length).toBeGreaterThan(0)
    expect(document.querySelector('[data-mode="try"]')).toHaveTextContent(
      /the same RB5 division as example 1.*It is not a new case/,
    )
  })

  it('names the Lesson 8 target from the registry and keeps the upper-division note out of the LB6 teaching', async () => {
    const lesson = lessonById('orientation-changes')
    const ex = localExercise(lesson.exercises![0])
    const target = targetForTrace(ex.trace)
    expect(target.segment.code).toBe('LS6')
    render(<BranchTracingLesson requestedId="orientation-changes" />)
    await screen.findByRole('button', { name: 'Start marking branches' })
    const pane = document.querySelector('[aria-label="Current exercise instructions"]')!
    // The upper-division convention appears once, inside the optional reference, not in the
    // teaching read before the LB6 examples.
    expect(pane.textContent!.split('rotates axial images clockwise').length - 1).toBe(1)
    const regional = document.querySelector('[data-regional-note]') as HTMLElement
    expect(regional.closest('details')).not.toBeNull()
    expect(regional).toHaveAttribute('data-regional-note', 'left-upper-division')
    expect(regional).toHaveTextContent(REGIONAL_NOTES[lesson.id].text)
    expect(within(regional).getByRole('link', { name: 'Lesson 7' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/learn?lesson=horizontal-oblique`,
    )
    click('Start marking branches')
    const legend = screen.getByText(/Which daughter would you follow toward/)
    expect(legend).toHaveTextContent(
      `Which daughter would you follow toward the simulated nodule in LS6 (left lower lobe superior segment)?`,
    )
    expect(screen.queryByText(/toward LLL/)).toBeNull()
    const identities = divisionIdentities(ex.trace.checkpoints[0])!
    for (const d of identities.daughters)
      expect(screen.getByRole('radio', { name: d.display })).toBeInTheDocument()
    expect(document.querySelector(`[data-route-target="LS6"]`)).toHaveTextContent(
      /at the end of LB6/,
    )
  })

  it('frames Lesson 2 as the same airway in a different display, with an unrecorded reflection', async () => {
    render(<BranchTracingLesson requestedId="orientation" />)
    await screen.findByRole('button', { name: 'Focus on this airway' })
    expect(screen.getByText(/Terms used here: parent airway view/)).toBeVisible()
    click('Focus on this airway')
    click('Compare with the caudal tracing view')
    click('Apply this to the same airway')
    expect(document.querySelector('[data-viewpoint-framing]')).toHaveTextContent(
      /Same airway, different display: this is the tracheal interval from Lesson 1/,
    )
    click('Start tracing')
    click(/^Trachea · slice 412/)
    click('Lumen unresolved here')
    click('Check my tracing')
    expect(document.querySelector('[data-optional-reflection]')).toHaveTextContent(
      /Optional reflection, not recorded/,
    )
    expect(
      screen.getByRole('button', { name: 'Compare the regional display convention' }),
    ).toBeEnabled()
  })
})

describe('consistent labels and copy-editing without touching stored data', () => {
  it('names the reset control the way the button reads', () => {
    const all = LESSONS.flatMap((l) => [l.worked, l.interpretation, ...l.teaching]).join(' ')
    expect(all).not.toMatch(/Reset to standard/)
    render(<CtOrientationTeaching trace={traceById('right-lower-basal')} />)
    expect(document.body).toHaveTextContent('“Return to standard axial” lets you repeat it')
  })
  it('reads title-case source names in sentence case and fixes a doubled word, leaving codes intact', () => {
    expect(displayName('Left Lower Lobe Posterior Basal segmental bronchus')).toBe(
      'Left lower lobe posterior basal segmental bronchus',
    )
    expect(displayName('Right B1–B2 common trunk')).toBe('Right B1–B2 common trunk')
    expect(displayOptionLabel('LB10 · Left Lower Lobe Posterior Basal segmental bronchus')).toBe(
      'LB10 · Left lower lobe posterior basal segmental bronchus',
    )
    expect(displayOptionLabel('RB8 · between the right and left daughters daughter')).toBe(
      'RB8 · between the right and left daughters',
    )
    expect(displayOptionLabel('LB6 · more caudal daughter')).toBe('LB6 · more caudal daughter')
    expect([count(1, 'checkpoint'), count(2, 'checkpoint'), count(1, 'stop')]).toEqual([
      '1 checkpoint',
      '2 checkpoints',
      '1 stop',
    ])
    // The source data keeps its own spelling.
    const stored = traceById('left-lower-basal')
      .checkpoints.flatMap((p) => p.decision?.options ?? [])
      .find((o) => o.airway.code === 'LB10')
    expect(stored?.airway.name).toBe('Left Lower Lobe Posterior Basal segmental bronchus')
  })
  it('explains More routes as an optional revisit in the same CT and keeps the /assess set', () => {
    const { container } = render(<BranchTracingPractice mode="assess" />)
    expect(
      screen.getByRole('heading', { name: 'Trace four more routes to simulated nodules' }),
    ).toBeVisible()
    const role = container.querySelector('[data-route-set-role="more-routes"]') as HTMLElement
    expect(role).toHaveTextContent(/treat it as a revisit, not a new patient case/)
    expect(role).toHaveTextContent(/the reference stays available and nothing is assessed/)
    const listed = Array.from(role.querySelectorAll('[data-more-route]')).map((li) =>
      li.getAttribute('data-more-route'),
    )
    expect(listed).toEqual(ASSESS_TRACES.map((id) => targetForTrace(traceById(id)).segment.code))
    expect(role.querySelector('[data-more-route="RS8"]')).toHaveTextContent(
      /also Lesson 9 worked example and a Practice target/,
    )
  })
})

describe('protected state is unchanged', () => {
  it('keeps every Learn, Practice and More routes draft signature at its base value', () => {
    const now: Record<string, string> = {}
    for (const lesson of LESSONS) {
      if (lesson.exercises) {
        const exercises = lesson.exercises.map(localExercise)
        now[`learn.${lesson.id}`] = draftSignature([
          lesson.id,
          lesson.id === 'orientation' ? ORIENTATION_CONTRACT : 'local-tracing',
          exercises.map((e) => ({
            id: e.id,
            trace: e.trace,
            answers: e.answerPoints,
            review: e.review,
          })),
        ])
      } else
        now[`learn.${lesson.id}`] = draftSignature([
          lesson,
          traceById(lesson.prediction),
          traceById(lesson.transfer),
          traceById(lesson.example),
        ])
    }
    const sets: [string, string[]][] = [
      ['practice', PRACTICE_TRACES],
      ['assess', ASSESS_TRACES],
      ...SEGMENT_PRACTICE_TRACES.map((id): [string, string[]] => ['practice', [id]]),
    ]
    for (const [mode, ids] of sets)
      now[`${mode}.${ids.join('.')}`] = draftSignature([mode, ids.map(traceById)])
    expect(now).toEqual(signatureBaseline.signatures)
  })
  it('adds a primer that quotes the packet unchanged and never rewrites a stored answer label', () => {
    for (const lesson of LESSONS)
      for (const spec of lesson.exercises ?? []) {
        const ex = localExercise(spec)
        ex.answerPoints.forEach((p, i) => {
          expect(p.label).toMatch(/^([A-Z] · )?\S/)
          expect(displayAnswerLabel(ex.trace.checkpoints[0], i, p.label)).not.toBe('')
        })
      }
    const packet = junctionFeedbackPacket('junction-14')!
    expect(packet.continuity).toContain('dark lumen with a thin bright ring')
  })
})
