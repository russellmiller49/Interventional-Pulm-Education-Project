import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { LabDock, visibleLabControls } from '../components/suite/LabDock'
import type { ImagingSuitePaneProps } from '../components/suite/types'
import { imagingLesson, peripheralImagingSectionIds } from '../content/pathway'
import { imagingStageLesson, imagingStageLessons } from '../content/stageLessons'
import { suiteViewForStep } from '../content/suiteViews'
import { IMAGING_TASK_LEADS } from '../content/taskLeads'
import { emptyLabState } from '../engine/labGoalEvaluation'
import { LAB_CONTROLS } from '../engine/labMetrics'
import {
  clickPrimary,
  clickSkip,
  currentStepId,
  installDom,
  mountSection,
  nowPrimary,
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
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/peripheral-imaging/learn',
}))

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  installDom()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/*
 * The owner's slide feedback of 2026-10-11 on the first sections of the module, held as rules for
 * every section so the same thing cannot come back somewhere he has not looked yet.
 */

function walkEveryStep(
  sectionId: (typeof peripheralImagingSectionIds)[number],
  visit: (stepId: string) => void,
) {
  const { lesson } = mountSection(sectionId)
  // The component walk takes one Continue per component, so a section has more clicks than steps.
  for (let guard = 0; guard < 40; guard++) {
    const stepId = currentStepId()!
    visit(stepId)
    if (stepId === lesson.steps.at(-1)!.id) return
    const primary = nowPrimary()
    if (primary && !primary.disabled) fireEvent.click(primary)
    else clickSkip()
  }
  throw new Error(`Never reached the end of ${sectionId}`)
}

describe('slide 5 — the text column leads, and is never an empty box', () => {
  it.each(peripheralImagingSectionIds)('%s: text before image on every step', (sectionId) => {
    walkEveryStep(sectionId, () => {
      const task = document.querySelector('[data-current-task]')!
      expect(task.children[0].hasAttribute('data-text-column')).toBe(true)
      expect(task.children[1].hasAttribute('data-visual-column')).toBe(true)
      expect(task.children[0].textContent!.trim().length).toBeGreaterThan(20)
    })
  })

  it('every hands-on step has its own lead, and its instruction names no control', () => {
    for (const lesson of imagingStageLessons())
      for (const step of lesson.steps) {
        if (step.interaction.kind !== 'lab-task' && step.interaction.kind !== 'observe') continue
        const lead =
          IMAGING_TASK_LEADS[lesson.sectionId]?.[
            step.interaction.kind === 'observe' ? 'observe' : 'act'
          ]
        expect(lead?.length ?? 0).toBeGreaterThan(40)
        // The instruction is the same for every hands-on step, so it cannot ask for a control the
        // step does not have; what to move is the lead.
        expect(step.instruction).toBe(
          'Do the steps in the checklist, using the controls beside the image.',
        )
      }
  })
})

describe('slide 6 — no control that does nothing', () => {
  it.each(peripheralImagingSectionIds)(
    '%s: a check offers only the controls that browse its image, before and after the answer',
    (sectionId) => {
      const lesson = imagingStageLesson(sectionId)
      const check = lesson.steps[lesson.predictionStepIndex]
      walkEveryStep(sectionId, (stepId) => {
        if (stepId !== check.id) return
        const offered = () =>
          [...document.querySelectorAll('[data-suite-controls] [id]')].map((node) => node.id)
        const browsing = sectionId === 'tool-confirmation'
        if (!browsing) expect(offered()).toEqual([])
        else expect(offered().length).toBeGreaterThan(0)
        const choice = document.querySelector<HTMLInputElement>('[data-prediction-choices] input')
        if (!choice) return
        fireEvent.click(choice)
        clickPrimary()
        if (!browsing) expect(offered()).toEqual([])
      })
    },
  )

  const paneProps = (
    sectionId: 'field' | 'chain-walk',
    overrides: Partial<ImagingSuitePaneProps> = {},
  ): ImagingSuitePaneProps => {
    const view = suiteViewForStep(sectionId)
    return {
      view,
      lab: emptyLabState(view.lab!, sectionId),
      onLabChange: jest.fn(),
      onLabReset: jest.fn(),
      controlsEnabled: true,
      goals: [],
      chainCaption: '',
      ...overrides,
    }
  }

  it('leaves out controls the step has not handed over, instead of drawing them disabled', () => {
    const { container, rerender } = render(<LabDock {...paneProps('field')} />)
    expect(container.querySelector('[data-suite-controls]')).not.toBeNull()
    rerender(<LabDock {...paneProps('field')} controlsWithheld />)
    expect(container.querySelector('[data-suite-controls]')).toBeNull()
    expect(container.querySelectorAll('input, select, button')).toHaveLength(0)
    // The readouts stay: they are what the image is showing.
    expect(container.querySelector('[data-readouts]')).not.toBeNull()
  })

  it('shows the crop-width slider only while the crop is on', () => {
    const props = paneProps('field')
    const { container, rerender } = render(<LabDock {...props} />)
    expect(container.querySelector('#peripheral-imaging-control-crop')).not.toBeNull()
    expect(container.querySelector('#peripheral-imaging-control-cropWidth')).toBeNull()
    rerender(
      <LabDock {...props} lab={{ ...props.lab, values: { ...props.lab.values, crop: true } }} />,
    )
    expect(container.querySelector('#peripheral-imaging-control-cropWidth')).not.toBeNull()
  })

  it('draws no dock at all when there is nothing to adjust and nothing to read out', () => {
    const view = { ...suiteViewForStep('chain-walk'), controls: [] as string[] }
    const { container } = render(
      <LabDock {...paneProps('chain-walk', { view, independent: true })} />,
    )
    expect(container.querySelector('[data-lab-dock]')).toBeNull()
  })

  it('a view that names no control offers none, which is what turns the baseline tools off', () => {
    const view = suiteViewForStep('chain-walk')
    expect(visibleLabControls({ ...view, controls: [] })).toEqual([])
    expect(visibleLabControls({ ...view, controls: ['orbit'] }).map((c) => c.key)).toEqual([
      'orbit',
    ])
    expect(visibleLabControls({ ...view, controls: undefined }).length).toBe(
      LAB_CONTROLS[view.lab!].length,
    )
  })

  it('prints the checklist nowhere in the dock', () => {
    const goal = { type: 'event', id: 'touched-field', label: 'Narrow the field' } as const
    const { container } = render(
      <LabDock {...paneProps('field', { goals: [{ goal, met: false }] })} />,
    )
    expect(container.textContent).not.toContain('Narrow the field')
  })
})

describe('slide 3 — the image-formation section says nothing about radial EBUS', () => {
  it('neither its teaching nor its steps', () => {
    const lesson = imagingLesson('chain-walk')
    const text = [
      ...lesson.blocks.flatMap((block) => [block.title, block.body, ...(block.points ?? [])]),
      ...imagingStageLesson('chain-walk').steps.flatMap((step) => [step.title, step.instruction]),
    ].join(' ')
    expect(text).not.toMatch(/radial EBUS|ultrasound/i)
  })
})

describe('slide 7 — collimating the spine out of the field is taught, shown and practised', () => {
  it('teaches the three mechanisms on the collimation step, with a worked example for it', () => {
    const lesson = imagingStageLesson('field')
    const step = lesson.steps[0]
    expect(step.activity.content).toContain('Collimate the spine out of the field')
    const block = lesson.lesson.blocks.find(
      (candidate) => candidate.title === 'Collimate the spine out of the field',
    )!
    expect(block.body).toMatch(/spine/)
    expect(block.points).toHaveLength(3)
    expect(block.points!.join(' ')).toMatch(/scatter/i)
    expect(block.points!.join(' ')).toMatch(/grayscale/i)
    expect(block.points!.join(' ')).toMatch(/automatic exposure control/i)
    expect(step.activity.examples).toContain('Collimated to the lesion · spine out of the field')
  })

  it('renders that teaching in the text column, beside the example', () => {
    mountSection('field')
    const column = document.querySelector('[data-text-column]')!
    expect(column.textContent).toMatch(/Collimate the spine out of the field/)
    expect(column.textContent).toMatch(/Compton scattering/)
    expect(
      [...document.querySelectorAll('[data-visual-column] button')].map((b) => b.textContent),
    ).toContain('Collimated to the lesion · spine out of the field')
  })

  it('asks for the two fields in the hands-on step and reports whether the spine is in the field', () => {
    const lesson = imagingStageLesson('field')
    const act = lesson.steps.find((step) => step.interaction.kind === 'lab-task')!
    if (act.interaction.kind !== 'lab-task') throw new Error('unreachable')
    expect(act.interaction.goals.map((goal) => goal.type === 'event' && goal.id)).toEqual([
      'path-kept-collimated',
      'spine-excluded',
    ])
    expect(act.suite.readouts).toContain('spineInField')
  })
})
