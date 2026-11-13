import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { BaxterCrrtLearn } from '../components/BaxterCrrtLearn'
import { BaxterCrrtModuleFrame } from '../components/BaxterCrrtModuleFrame'
import { CrrtFoundationLesson } from '../components/CrrtFoundationLesson'
import { BAXTER_CRRT_LEARN_LESSON_IDS } from '../content/learnerRegistry'
import { crrtLearnTasks } from '../content/learnTasks'

/**
 * The lesson workspace (critical care plan 2026-11-10, CRRT round): one slim lesson bar, the text
 * on the left and the task's picture on the right.
 *
 * jsdom applies no stylesheet, so a test fixes the layout with `panes`. `two` is what a desktop
 * window gets; `one` is a small window, where every drawing stays where its exercise wrote it.
 */

jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}))

beforeEach(() => window.localStorage.clear())

const textPane = () => document.querySelector<HTMLElement>('[data-flow-teaching]')!
const picturePane = () => document.querySelector<HTMLElement>('[data-crrt-visual-pane]')!

function renderLesson(
  lessonId: (typeof BAXTER_CRRT_LEARN_LESSON_IDS)[number],
  panes: 'one' | 'two',
) {
  return render(
    <CrrtFoundationLesson
      lessonId={lessonId}
      onNavigate={() => {}}
      onRestart={() => {}}
      panes={panes}
    />,
  )
}

/** Opens a task from "Lesson tasks", as a learner can at any time. */
function openTask(index: number) {
  const map = document.querySelector<HTMLDetailsElement>('[data-crrt-task-map]')!
  fireEvent.click(map.querySelectorAll('ol button')[index])
}

describe('the lesson bar', () => {
  it('is one row: the lesson, the Lessons list, the glossary, the menu and the way out', () => {
    renderLesson('crrt-circuit-pressures', 'two')
    const bar = document.querySelector<HTMLElement>('[data-lesson-shell] > div')!
    expect(within(bar).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Circuit anatomy and pressure localization',
    )
    expect(within(bar).getByRole('link', { name: 'CRRT' })).toHaveAttribute('href', '/baxter-crrt')
    expect(bar).toHaveTextContent('Lesson 2 of 8')
    expect(bar.querySelector('[data-sections-drawer] summary')).toHaveTextContent('Lessons2 of 8')
    expect(within(bar).getByRole('button', { name: 'Glossary' })).toBeVisible()
    expect(within(bar).getByRole('button', { name: 'Save & exit' })).toBeVisible()
    expect(bar.querySelector('[data-crrt-lesson-menu] > summary')).toHaveTextContent('Menu')
    // The shell has no context strip and no footer row any more.
    expect(document.querySelector('[data-context-strip]')).toBeEmptyDOMElement()
  })

  it('keeps the restart row, the other parts of the module and the storage notes in the menu', () => {
    renderLesson('crrt-circuit-pressures', 'two')
    const menu = document.querySelector<HTMLDetailsElement>('[data-crrt-lesson-menu]')!
    expect(menu.open).toBe(false)
    const panel = within(menu.querySelector<HTMLElement>('[data-crrt-lesson-menu-panel]')!)
    for (const name of ['Restart lesson', 'Restart course'])
      expect(panel.getByRole('button', { name })).not.toBeVisible()
    expect(panel.getByText(/Each visit starts a fresh simulation/)).not.toBeVisible()
    act(() => {
      menu.open = true
    })
    for (const name of ['Restart lesson', 'Restart course'])
      expect(panel.getByRole('button', { name })).toBeVisible()
    expect(panel.getByRole('button', { name: /^Previous lesson: 1\. / })).toBeVisible()
    expect(panel.getByRole('button', { name: /^Next lesson: 3\. / })).toBeVisible()
    expect(
      within(panel.getByRole('navigation', { name: 'CRRT learning navigation' }))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Overview', 'Learn', 'Practice', 'Challenge'])
    expect(panel.getByText(/Each visit starts a fresh simulation/)).toBeVisible()
    expect(panel.getByText(/Restart lesson goes back to task 1/)).toBeVisible()
  })

  it('closes the menu when one of its actions is taken', () => {
    const onRestart = jest.fn()
    render(
      <CrrtFoundationLesson
        lessonId="crrt-circuit-pressures"
        onNavigate={() => {}}
        onRestart={onRestart}
        panes="two"
      />,
    )
    const menu = document.querySelector<HTMLDetailsElement>('[data-crrt-lesson-menu]')!
    act(() => {
      menu.open = true
    })
    fireEvent.click(within(menu).getByRole('button', { name: 'Restart lesson' }))
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(menu.open).toBe(false)
  })
})

describe('the frame around a lesson', () => {
  it('a lesson is a workspace with the site menu hidden; Practice and Challenge are not', () => {
    const lesson = render(<BaxterCrrtLearn initialLessonId="crrt-indications-modality" />)
    const shell = document.querySelector('main')!
    expect(shell).toHaveAttribute('data-learning-scroll-owner', 'workspace')
    expect(shell.querySelector('[data-activity-frame]')).toHaveAttribute(
      'data-site-header',
      'hidden',
    )
    lesson.unmount()
    render(
      <BaxterCrrtModuleFrame locale="en" activeHref="/baxter-crrt/practice" activityMode>
        <p>case</p>
      </BaxterCrrtModuleFrame>,
    )
    const practice = document.querySelector('main')!
    expect(practice).toHaveAttribute('data-learning-scroll-owner', 'document')
    expect(practice.querySelector('[data-activity-frame]')).not.toHaveAttribute('data-site-header')
  })

  it('the Learn landing page keeps the site menu', () => {
    render(<BaxterCrrtLearn />)
    expect(document.querySelector('main')).toHaveAttribute('data-learning-scroll-owner', 'document')
    expect(document.querySelector('[data-site-header]')).toBeNull()
  })
})

describe('two panes', () => {
  it('lesson 1 task 1 opens with the circuit in the picture pane and the text beside it', () => {
    renderLesson('crrt-indications-modality', 'two')
    expect(document.querySelector('[data-foundation-lesson]')).toHaveAttribute(
      'data-crrt-panes',
      'two',
    )
    expect(
      within(textPane()).getByRole('heading', { name: 'Two treatment goals, one blood circuit' }),
    ).toBeVisible()
    expect(textPane().querySelector('svg[data-overlay]')).toBeNull()
    expect(picturePane().querySelectorAll('svg[data-overlay]')).toHaveLength(1)
    expect(picturePane().querySelector('svg[data-overlay]')).toHaveAttribute(
      'data-overlay',
      'blood-path',
    )
  })

  it('a walk keeps its selections in the text and lights the drawing in the pane', () => {
    renderLesson('crrt-circuit-pressures', 'two')
    const workbench = textPane().querySelector<HTMLElement>('[data-crrt-circuit-workbench]')!
    expect(workbench).toHaveAttribute('data-crrt-drawing', 'pane')
    expect(workbench.querySelector('svg')).toBeNull()
    const drawing = picturePane().querySelector('svg[data-overlay]')!
    expect(drawing.querySelector('[data-node="access-lumen"]')).toHaveAttribute(
      'data-highlighted',
      'false',
    )
    fireEvent.click(within(workbench).getByRole('button', { name: 'Patient access' }))
    expect(
      picturePane().querySelector('svg[data-overlay] [data-node="access-lumen"]'),
    ).toHaveAttribute('data-highlighted', 'true')
    // The explanation of the selection stays with the buttons, in the text.
    expect(
      within(workbench).getByText(/Blood leaves the patient through the access lumen/),
    ).toBeVisible()
  })

  it('a task with no picture of its own keeps the reference circuit; one with its own replaces it', () => {
    renderLesson('crrt-indications-modality', 'two')
    // Task 2 is a worked example with no tool.
    openTask(1)
    expect(picturePane().querySelector('[data-crrt-lesson-visual="reference"]')).not.toBeNull()
    expect(picturePane().querySelectorAll('svg[data-overlay]')).toHaveLength(1)
    // Task 3 brings the modality circuit.
    openTask(2)
    expect(picturePane().querySelector('[data-crrt-lesson-visual="reference"]')).toBeNull()
    expect(picturePane().querySelectorAll('[data-crrt-lesson-visual="lead"]')).toHaveLength(1)
  })

  it('the membrane task leads with the filter inset; the circuit follows it', () => {
    renderLesson('crrt-solute-transport', 'two')
    const lead = picturePane().querySelector('[data-crrt-lesson-visual="lead"]')!
    const support = picturePane().querySelector('[data-crrt-lesson-visual="support"]')!
    expect(lead.querySelector('[data-crrt-membrane-transport]')).not.toBeNull()
    expect(support.querySelector('svg[data-overlay]')).not.toBeNull()
    // Choosing a mechanism in the text changes both pictures in the pane.
    fireEvent.click(within(textPane()).getByRole('button', { name: 'Convection' }))
    expect(lead.querySelector('[data-crrt-membrane-transport]')).toHaveAttribute(
      'data-selected',
      'convection',
    )
    expect(support.querySelector('svg[data-overlay]')).toHaveAttribute('data-overlay', 'cvvh-post')
  })

  it.each(BAXTER_CRRT_LEARN_LESSON_IDS)(
    '%s: no task opens on an empty pane, and no drawing is left in the text',
    (lessonId) => {
      renderLesson(lessonId, 'two')
      const tasks = crrtLearnTasks[lessonId]!
      tasks.forEach((task, index) => {
        if (index > 0) openTask(index)
        expect(screen.getByRole('heading', { level: 2, name: task.title })).toBeInTheDocument()
        const visuals = picturePane().querySelectorAll('[data-crrt-lesson-visual]')
        expect(visuals.length).toBeGreaterThan(0)
        for (const visual of visuals) expect(visual).not.toBeEmptyDOMElement()
        expect(textPane().querySelector('[data-crrt-visual-inline]')).toBeNull()
        // The reference circuit is there only when the task brought nothing.
        const reference = picturePane().querySelector('[data-crrt-lesson-visual="reference"]')
        expect(Boolean(reference)).toBe(visuals.length === 1 && visuals[0] === reference)
      })
    },
  )
})

describe('one column (a small window)', () => {
  it('every drawing stays where its exercise wrote it', () => {
    renderLesson('crrt-circuit-pressures', 'one')
    expect(document.querySelector('[data-foundation-lesson]')).toHaveAttribute(
      'data-crrt-panes',
      'one',
    )
    const workbench = textPane().querySelector<HTMLElement>('[data-crrt-circuit-workbench]')!
    expect(workbench).toHaveAttribute('data-crrt-drawing', 'inline')
    expect(workbench.querySelector('svg[data-overlay]')).not.toBeNull()
    expect(picturePane().querySelector('[data-crrt-visual-slot]')).toBeEmptyDOMElement()
    expect(picturePane().querySelector('[data-crrt-lesson-visual="reference"]')).toBeNull()
  })

  it('is what a window without the two-pane stylesheet gets', () => {
    render(
      <CrrtFoundationLesson
        lessonId="crrt-circuit-pressures"
        onNavigate={() => {}}
        onRestart={() => {}}
      />,
    )
    expect(document.querySelector('[data-foundation-lesson]')).toHaveAttribute(
      'data-crrt-panes',
      'one',
    )
  })
})
