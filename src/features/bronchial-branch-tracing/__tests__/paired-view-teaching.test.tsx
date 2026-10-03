import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { displayAnswerLabel } from '../engine/branch-identity'
import { DRAFT_PREFIX } from '../engine/ct-draft'

/**
 * BBT-PRE-REVIEW-03 (BBTF-04, 06, 13, 26, 34, 42). The paired parent airway view is discoverable
 * from the first orientation lesson without an answer; its captions name the CT display and the
 * modelled camera separately; identities are neutral where names repeat; the diagram carries the
 * CT letters; intermediate demonstration planes carry model course locators. The 3D surface is a
 * WebGL component, so it is stubbed here; its projection and occlusion are covered by the
 * geometry tests and the browser suite.
 */
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('next/dynamic', () => () => () => null)
beforeEach(() => window.localStorage.clear())
const ready = () => document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
const click = (name: string | RegExp) => {
  ready()
  fireEvent.click(screen.getByRole('button', { name }))
  ready()
}
const draft = (id: string) => JSON.parse(localStorage.getItem(DRAFT_PREFIX + `learn.${id}`)!).value
const scopeColumn = () => document.querySelector('[data-paired-scope-column]')
const scopePose = () => scopeColumn()?.getAttribute('data-scope-pose') ?? null
function recordLocal(id: string, index = 0) {
  const ex = localExercise(LESSONS.find((l) => l.id === id)!.exercises![index])
  ex.answerPoints.forEach((point, i) => {
    const label = displayAnswerLabel(ex.trace.checkpoints[0], i, point.label)
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · slice`),
      }),
    )
    ready()
    click('Lumen unresolved here')
  })
  const course = screen.queryByRole('combobox', { name: 'Airway course' })
  if (course) fireEvent.change(course, { target: { value: 'uncertain' } })
  click('Check my tracing')
}

it('BBTF-04 · Lesson 2 opens paired: the parent airway view is beside the CT from the first step, through the comparison and into the exercise, and no mark is created', async () => {
  render(<BranchTracingLesson requestedId="orientation" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  ready()
  expect(scopeColumn()).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Hide parent airway view' })).toBeVisible()
  const caption = document.querySelector('[data-scope-caption]')!
  expect(caption.textContent).toMatch(/looking caudally along Trachea/)
  expect(caption.textContent).toMatch(
    /Reference roll for this region: anterior at the top of the view/,
  )
  expect(caption.textContent).not.toMatch(/always/i)
  expect(document.querySelector('[data-display-caption]')!.textContent).toMatch(
    /^CT display: Standard axial \(A up, R screen-left\)/,
  )
  click('Focus on this airway')
  // The comparison shows the fixed camera as a third panel with its own caption and toggle.
  expect(document.querySelector('[data-comparison-scope]')).not.toBeNull()
  expect(document.querySelector('[data-comparison-scope-caption]')!.textContent).toMatch(
    /looking caudally along Trachea.*renders the same whichever CT display you choose/,
  )
  click('Hide parent airway view')
  expect(document.querySelector('[data-comparison-scope]')).toBeNull()
  click('Show parent airway view')
  expect(document.querySelector('[data-comparison-scope]')).not.toBeNull()
  click('Compare with the caudal tracing view')
  expect(document.querySelector('[data-symmetric-note]')!.textContent).toMatch(
    /nearly round, midline lumen/,
  )
  expect(document.querySelector('[data-comparison-scope]')).not.toBeNull()
  click('Apply this to the same airway')
  expect(scopeColumn()).not.toBeNull()
  expect(document.querySelector('[data-display-caption]')!.textContent).toMatch(
    /^CT display: Left–right reflection \(A up, L screen-left\)/,
  )
  expect(document.querySelector('[data-scope-caption]')!.textContent).toMatch(
    /looking caudally along Trachea/,
  )
  click('Start tracing')
  expect(scopeColumn()).not.toBeNull()
  expect(draft('orientation').marks).toEqual([null])
  expect(draft('orientation').history).toEqual({})
})

it('BBTF-04 · every local lesson offers the parent airway view before any answer, and CT transforms leave the modelled camera unchanged while the display caption follows the CT', async () => {
  render(<BranchTracingLesson requestedId="continuity" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  ready()
  // Available, off by default outside the viewpoint lesson: one click, no answer required.
  expect(screen.getByRole('button', { name: 'Show parent airway view' })).toBeVisible()
  expect(scopeColumn()).toBeNull()
  click('Focus on this airway')
  expect(screen.getByRole('button', { name: 'Show parent airway view' })).toBeVisible()
  click('Show parent airway view')
  expect(scopeColumn()).not.toBeNull()
  const pose = scopePose()
  expect(pose).toMatch(/^[-\d.,]+\|[-\d.,]+\|[-\d.,]+$/)
  click('Start marking branches')
  // PR #273 final repair: the paired view opened on the worked example was the reference's display
  // and does not follow the learner into the try. It is still one click away, at the same pose.
  expect(scopeColumn()).toBeNull()
  click('Show parent airway view')
  expect(scopeColumn()).not.toBeNull()
  expect(scopePose()).toBe(pose)
  const preset = () => document.querySelector('[data-preset]')!.getAttribute('data-preset')
  const displayCaption = () => document.querySelector('[data-display-caption]')!.textContent
  expect(preset()).toBe('standard')
  fireEvent.click(screen.getByText('More orientation controls'))
  click(/Rotate 90° left/)
  expect(preset()).toBe('rul')
  expect(displayCaption()).toMatch(/^CT display: 90° counterclockwise \(L up, A screen-left\)/)
  expect(scopePose()).toBe(pose)
  click(/Flip left–right/)
  expect(preset()).not.toBe('standard')
  expect(scopePose()).toBe(pose)
  click('Return to standard axial')
  expect(preset()).toBe('standard')
  expect(displayCaption()).toMatch(/^CT display: Standard axial/)
  expect(scopePose()).toBe(pose)
  expect(draft('continuity').marks).toEqual([null, null])
})

it('BBTF-26 · intermediate demonstration planes carry dotted model course locators, named in the caption and hidden with the other overlays', async () => {
  render(<BranchTracingLesson requestedId="continuity" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  click('Focus on this airway')
  // The start plane carries the authored parent locator and no course locator.
  expect(document.querySelectorAll('[data-course-locator]')).toHaveLength(0)
  expect(document.querySelector('[data-course-legend]')).toBeNull()
  click('Next demonstration slice')
  click('Next demonstration slice')
  await waitFor(() => {
    ready()
    expect(document.querySelectorAll('[data-course-locator]').length).toBeGreaterThan(0)
  })
  const locator = document.querySelector('[data-course-locator]')!
  expect(locator.getAttribute('aria-label')).toMatch(
    /^Model course locator: Parent · Trachea, centreline crossing on slice \d+; provisional model position, not a lumen boundary$/,
  )
  expect(locator.querySelector('path')!.getAttribute('stroke-dasharray')).toBeTruthy()
  expect(locator.querySelector('text')).toBeNull()
  expect(document.querySelector('[data-course-legend]')).not.toBeNull()
  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'CT demonstration controls' }).textContent).toMatch(
      /Dotted gold crosshair: where the model centreline of Parent · Trachea crosses this plane/,
    ),
  )
  click('Hide overlays')
  expect(document.querySelectorAll('[data-course-locator]')).toHaveLength(0)
  click('Show overlays')
  expect(document.querySelectorAll('[data-course-locator]').length).toBeGreaterThan(0)
  expect(draft('continuity').marks).toEqual([null, null])
})

it('BBTF-13 · the branch-matching diagram carries the CT letters and both ends of every in-plane patient axis, names the axis along the view, and opens beside the parent airway view', async () => {
  render(<BranchTracingLesson requestedId="continuity" />)
  await screen.findByRole('button', { name: 'Focus on this airway' })
  click('Focus on this airway')
  click('Start marking branches')
  recordLocal('continuity')
  click('Study the parent view')
  click('Compare with the caudal tracing view')
  click('Apply this to the same airway')
  // Relating the parent view opens the paired camera without any further click.
  expect(scopeColumn()).not.toBeNull()
  const map = document.querySelector('[data-parent-map="junction-1"]') as HTMLElement
  expect(map).not.toBeNull()
  expect(map.querySelectorAll('[data-opening-letter]')).toHaveLength(2)
  expect(
    Array.from(map.querySelectorAll('[data-axis-label]'))
      .map((t) => t.textContent)
      .sort(),
  ).toEqual(['A', 'L', 'P', 'R'])
  expect(map.querySelector('[data-along-view="S–I"]')!.textContent).toMatch(
    /runs along the line of sight here: inferior points into the view and superior back toward the viewer, so it has no arrow/,
  )
  const legend = Array.from(map.querySelectorAll('[data-opening-legend]')).map((e) => e.textContent)
  expect(legend).toEqual(
    expect.arrayContaining([
      expect.stringMatching(
        /^Opening [12] · Daughter A · RMSB \(source label “more right”\) · \d+ slices caudal of the parent point$/,
      ),
      expect.stringMatching(/^Opening [12] · Daughter B · LMSB \(source label “more left”\)/),
    ]),
  )
  expect(map.querySelector('figcaption')!.textContent).toMatch(
    /Model parent view · looking distally from Trachea.*Reference roll for this region: anterior at the top of the view/,
  )
  expect(map.textContent).not.toMatch(/always/i)
  // The independent second example keeps the openings neutral until the learner asks.
  click('Next example: LLL')
  recordLocal('continuity', 1)
  click('Continue to branch matching')
  const second = document.querySelector('[data-parent-map="junction-6"]') as HTMLElement
  expect(second.querySelectorAll('[data-opening-letter]')).toHaveLength(0)
  expect(within(second).getByRole('button', { name: 'Opening 1' })).toBeVisible()
  expect(scopeColumn()).not.toBeNull()
  click('Show the labels')
  expect(second.querySelectorAll('[data-opening-letter]')).toHaveLength(2)
  expect(draft('continuity')).toMatchObject({ viewAnswer: null })
})

it('BBTF-06 and BBTF-34 · repeated source names are told apart by role and direction, and the RB1 a/b assignment is stated as this source’s before marking', async () => {
  const view = render(<BranchTracingLesson requestedId="vertical" />)
  await screen.findByRole('button', { name: 'Start marking branches' })
  ready()
  const identities = document.querySelector('[data-branch-identities="junction-14"]') as HTMLElement
  expect(identities).not.toBeNull()
  expect(identities.textContent).toMatch(
    /Parent · RB1 · Right apical segmental bronchus · parent point on slice 401/,
  )
  expect(identities.textContent).toMatch(
    /Daughter A is labelled RB1b in this source \(more anterior\); Daughter B is labelled RB1a in this source \(more posterior\)\. The a\/b letters follow this source’s labelling and are pending nomenclature review: they are shown so you can follow each lumen, not asked\./,
  )
  // The schematic is one click away before marking, with the same fixed camera basis.
  expect(document.querySelector('[data-parent-schematic]')).not.toBeNull()
  click('Start marking branches')
  expect(screen.getByRole('heading', { name: '2. Mark Daughter A · RB1b' })).toBeVisible()
  expect(screen.getByRole('button', { name: /^Daughter A · RB1b · slice 422/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /^Daughter B · RB1a · slice 424/ })).toBeVisible()
  expect(document.querySelector('[data-branch-identities="junction-14"]')).not.toBeNull()
  view.unmount()
  window.localStorage.clear()
  render(<BranchTracingLesson requestedId="horizontal-oblique" />)
  await screen.findByRole('button', { name: 'Start marking branches' })
  click('Start marking branches')
  expect(
    screen.getByRole('heading', { name: '2. Mark Daughter A · RB3a · more cranial' }),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: /^Daughter A · RB3a · more cranial · slice 396/ }),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: /^Daughter B · RB3a · more caudal · slice 384/ }),
  ).toBeVisible()
  const oblique = document.querySelector('[data-branch-identities="junction-16"]') as HTMLElement
  expect(oblique.textContent).toMatch(/Parent · RB3a/)
  // The a suffix is this source's, so the provisional note is right; no finer suffix is invented.
  expect(oblique.textContent).toMatch(/pending nomenclature review/)
  expect(oblique.textContent).not.toMatch(/RB3a[a-c]\b/)
  // The stored labels are untouched: the draft records the same answer-point slices as before.
  expect(draft('horizontal-oblique').marks).toEqual([null, null])
})
