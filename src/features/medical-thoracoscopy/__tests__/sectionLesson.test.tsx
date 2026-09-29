import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'
import { PROMOTIONAL_WORDING } from '@/lib/sponsorship/policy'

import { SectionLesson } from '../components/lesson/SectionLesson'
import { LESSON_WORDS } from '../components/lesson/lessonWords'
import { VIEW_WORDS } from '../components/space/spaceWords'
import type { SpaceLoader } from '../components/space/useSpaceEngine'
import { lessonParts } from '../content/lessonParts'
import { writtenSection } from '../content/sections'
import { teachingExample } from '../content/teachingExamples'
import { THORACOSCOPY_PROGRESS_STORAGE_KEY } from '../engine/selfPacedProgress'
import { scene } from '../test-support/spaceScenes'

/**
 * The lesson host (slice 12), for learner actions and truthful surfaces: what each control does and
 * does not do, what is kept, and that every surface says what it is. The engine is the real one on an
 * analytic scene with nine lung steps; the Chest view is the cut, since jsdom has no WebGL.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const target =
      typeof href === 'string'
        ? href
        : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query)}` : ''}`
    return (
      <a href={target} {...rest}>
        {children}
      </a>
    )
  },
}))
jest.mock('../components/space/useSpaceSupport', () => ({
  useWebGLSupport: () => false,
  useReducedMotion: () => false,
}))

const load: SpaceLoader = async () => scene('lesson').space

beforeAll(() => {
  // jsdom lays nothing out
  Element.prototype.scrollIntoView = jest.fn()
})
beforeEach(() => window.localStorage.clear())

const stored = () =>
  JSON.parse(window.localStorage.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY) ?? 'null')
const parts = () =>
  Array.from(document.querySelectorAll('[data-lesson-part]')).map((part) =>
    part.getAttribute('data-lesson-part'),
  )
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const pane = () => screen.getByRole('region', { name: VIEW_WORDS.paneLabel })

function visibleCopyProblems(container: HTMLElement): string[] {
  const text = container.textContent ?? ''
  const promotional = text.match(PROMOTIONAL_WORDING)
  return [...flaggedLearnerCopyTerms(text), ...(promotional ? [promotional[0]] : [])]
}

async function open(sectionId: 'normal-pleural-space' | 'four-controls' | 'systematic-survey') {
  const view = render(<SectionLesson sectionId={sectionId} load={load} />)
  return view
}

async function reachPart(part: string) {
  fireEvent.click(document.querySelector(`[data-part-link="${part}"]`) as HTMLElement)
  await waitFor(() => expect(parts()).toContain(part))
  return document.querySelector(`[data-lesson-part="${part}"]`) as HTMLElement
}

async function spaceReady() {
  await waitFor(() => expect(pane()).toHaveAttribute('data-readiness', 'ready'))
}

describe('the lesson host', () => {
  it('opens at the orientation, and keeps the visit and the place and nothing else', async () => {
    await open('systematic-survey')
    expect(parts()).toEqual(['orientation'])
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Look everywhere, in order')
    expect(stored()).toMatchObject({
      lastLocation: { kind: 'section', id: 'systematic-survey' },
      visitedSectionIds: ['systematic-survey'],
      reviewedSectionIds: [],
    })
    expect(Object.keys(stored()).sort()).toEqual([
      'lastLocation',
      'reviewedSectionIds',
      'updatedAt',
      'version',
      'visitedSectionIds',
    ])
  })

  it('says every clinical statement is not yet clinically reviewed, and labels what the learner sees', async () => {
    await open('four-controls')
    expect(screen.getByRole('note')).toHaveTextContent(LESSON_WORDS.notReviewed)
    const spec = writtenSection('four-controls')!
    for (const signal of spec.signals) expect(screen.getByText(signal.name)).toBeInTheDocument()
    expect(
      screen.getAllByText(
        /Derived from CT segmentation|Authored construct|Awaiting clinical review|Authored, illustrative|Educational rendering/,
      ).length,
    ).toBeGreaterThan(0)
  })

  it('walks the parts in the order the section’s question sets, and lets any part be opened at any time', async () => {
    await open('four-controls')
    const order = lessonParts(writtenSection('four-controls')!)
    // a prediction: the question comes before the teaching that answers it
    expect(order.indexOf('question')).toBeLessThan(order.indexOf('concept'))
    for (let n = 1; n < 4; n += 1)
      fireEvent.click(document.querySelector('[data-continue], [data-move-on]') as HTMLElement)
    expect(parts()).toEqual(order.slice(0, 4))
    await reachPart('transfer')
    expect(parts()).toContain('transfer')
    expect(parts()).not.toContain('activity')
  })

  it('never counts Continue, moving on or opening a part as doing its work', async () => {
    await open('four-controls')
    const before = stored()
    const order = lessonParts(writtenSection('four-controls')!)
    for (let n = 1; n < order.length; n += 1)
      fireEvent.click(document.querySelector('[data-continue], [data-move-on]') as HTMLElement)
    expect(parts()).toEqual(order)
    const outline = screen.getByRole('navigation', { name: LESSON_WORDS.partsHeading })
    expect(within(outline).queryByText(new RegExp(`· ${LESSON_WORDS.done}$`))).toBeNull()
    expect(within(outline).getAllByText(new RegExp(LESSON_WORDS.movedPast)).length).toBeGreaterThan(
      0,
    )
    expect(stored()).toEqual(before)
  })

  it('lets the explanation be read before answering, any answer be changed, and keeps no answer', async () => {
    await open('four-controls')
    const question = await reachPart('question')
    fireEvent.click(within(question).getByRole('button', { name: LESSON_WORDS.explain }))
    expect(
      within(question).getByRole('heading', { name: LESSON_WORDS.explanationHeading }),
    ).toBeInTheDocument()
    const choices = within(question).getAllByRole('radio')
    fireEvent.click(choices[0])
    fireEvent.click(within(question).getByRole('button', { name: LESSON_WORDS.check }))
    const first = within(question).getByRole('status').textContent
    fireEvent.click(choices[1])
    fireEvent.click(within(question).getByRole('button', { name: LESSON_WORDS.check }))
    expect(within(question).getByRole('status').textContent).not.toEqual(first)
    expect(window.localStorage.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY)).not.toMatch(
      /MT-Q|choice|answer/,
    )
  })

  it('labels the teaching example as one, says the learner did not do its steps, and loads it again on request', async () => {
    await open('systematic-survey')
    const example = await reachPart('teaching-example')
    const words = teachingExample('space-made')
    expect(within(example).getByText(words.label)).toBeInTheDocument()
    expect(within(example).getByText(words.notPerformed)).toBeInTheDocument()
    expect(within(example).getByRole('group', { name: 'Teaching example' })).toBeInTheDocument()
    await reachPart('activity')
    await spaceReady()
    act(() => {
      for (let n = 0; n < 12; n += 1) fireEvent.keyDown(pane(), { key: 'ArrowUp' })
    })
    const moved = screen
      .getAllByRole('row')
      .map((row) => row.textContent)
      .join('|')
    fireEvent.click(within(example).getByRole('button', { name: LESSON_WORDS.exampleLoadAgain }))
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('row')
          .map((row) => row.textContent)
          .join('|'),
      ).not.toEqual(moved),
    )
  })

  it('marks a section reviewed only when the learner does, and takes the mark back', async () => {
    await open('normal-pleural-space')
    expect(stored().reviewedSectionIds).toEqual([])
    fireEvent.click(button(LESSON_WORDS.markReviewed))
    await waitFor(() => expect(stored().reviewedSectionIds).toEqual(['normal-pleural-space']))
    expect(screen.getByText(LESSON_WORDS.marked)).toBeInTheDocument()
    fireEvent.click(button(LESSON_WORDS.unmark))
    await waitFor(() => expect(stored().reviewedSectionIds).toEqual([]))
  })

  it('says plainly when it cannot save, and works all the same', async () => {
    window.localStorage.setItem(THORACOSCOPY_PROGRESS_STORAGE_KEY, 'not json')
    await open('normal-pleural-space')
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(LESSON_WORDS.cannotSave),
    )
    expect(window.localStorage.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY)).toBe('not json')
    fireEvent.click(document.querySelector('[data-continue]') as HTMLElement)
    expect(parts().length).toBe(2)
  })

  it('takes the tour by loading each stop, and shows the name only once the learner names it or asks', async () => {
    await open('normal-pleural-space')
    const activity = await reachPart('activity')
    await spaceReady()
    fireEvent.click(within(activity).getByRole('button', { name: /first stop/ }))
    await waitFor(() =>
      expect(activity.querySelector('[data-tour-stop]')).toHaveAttribute('data-tour-stop', '0'),
    )
    expect(within(activity).queryByText(/This is the diaphragm/)).toBeNull()
    fireEvent.click(within(activity).getByRole('button', { name: 'Show me' }))
    expect(within(activity).getByText(/This is the diaphragm/)).toBeInTheDocument()
  })

  it('reaches a pivot target only when the engine shows the region, after the learner moved', async () => {
    await open('four-controls')
    const activity = await reachPart('activity')
    await spaceReady()
    fireEvent.click(within(activity).getByRole('radio', { name: 'Toward the head' }))
    expect(activity.querySelector('[data-pivot-target]')).not.toHaveAttribute('data-reached')
    // Hand toward the head swings the tip toward the feet: toward the diaphragm, in the scene's floor.
    for (let n = 0; n < 16 && !activity.querySelector('[data-reached]'); n += 1) {
      act(() => {
        fireEvent.keyDown(pane(), { key: 'ArrowRight' })
      })
    }
    await waitFor(() =>
      expect(activity.querySelector('[data-pivot-target]')).toHaveAttribute('data-reached', 'true'),
    )
    expect(within(activity).getByText(/so the hand moves toward the head/)).toBeInTheDocument()
  })

  it('does not reach a target already in view until the learner moves, even a turn that keeps it there', async () => {
    await open('four-controls')
    const activity = await reachPart('activity')
    await spaceReady()
    // the back of the chest wall, the third target, is in view from the example's start in this scene
    expect(pane().querySelector('[data-in-view]')?.getAttribute('data-in-view')).toContain(
      'posterior-chest-wall',
    )
    for (let n = 0; n < 2; n += 1)
      fireEvent.click(within(activity).getByRole('button', { name: 'Go to the next region' }))
    expect(activity.querySelector('[data-pivot-target]')).toHaveAttribute(
      'data-pivot-target',
      'posterior-chest-wall',
    )
    fireEvent.click(within(activity).getByRole('radio', { name: 'Toward the front' }))
    expect(activity.querySelector('[data-pivot-target]')).not.toHaveAttribute('data-reached')
    act(() => {
      fireEvent.keyDown(pane(), { key: 'e' })
    })
    await waitFor(() =>
      expect(activity.querySelector('[data-pivot-target]')).toHaveAttribute('data-reached', 'true'),
    )
  })

  it('keeps the survey’s note to the page, and compares it only once every region is noted', async () => {
    await open('systematic-survey')
    const activity = await reachPart('activity')
    await spaceReady()
    const compare = within(activity).getByRole('button', { name: /Compare your note/ })
    fireEvent.click(compare)
    expect(activity.querySelector('[data-survey-comparison]')).toBeNull()
    const outline = screen.getByRole('navigation', { name: LESSON_WORDS.partsHeading })
    const entry = outline.querySelector('[data-part-link="activity"]') as HTMLElement
    expect(entry.textContent).not.toMatch(new RegExp(`· ${LESSON_WORDS.done}`))
    for (const select of within(activity).getAllByRole('combobox', { name: /^Seen\?/ })) {
      fireEvent.change(select, { target: { value: 'not-seen' } })
    }
    for (const select of within(activity).getAllByRole('combobox', {
      name: /^If not fully seen/,
    })) {
      fireEvent.change(select, { target: { value: 'not-looked-at' } })
    }
    fireEvent.click(compare)
    expect(activity.querySelector('[data-survey-comparison]')).not.toBeNull()
    expect(window.localStorage.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY)).not.toMatch(
      /not-seen|note/,
    )
  })

  it.each(['normal-pleural-space', 'four-controls', 'systematic-survey'] as const)(
    'shows no score, grading word or promotion, and has no accessibility violations, in %s, every part open',
    async (sectionId) => {
      const { container } = await open(sectionId)
      const order = lessonParts(writtenSection(sectionId)!)
      for (let n = 1; n < order.length; n += 1)
        fireEvent.click(document.querySelector('[data-continue], [data-move-on]') as HTMLElement)
      await spaceReady()
      expect(visibleCopyProblems(container)).toEqual([])
      expect(container.textContent).not.toMatch(/\d+\s*%|score|points|grade/i)
      expect(await axe(container)).toHaveNoViolations()
    },
    20000,
  )
})
