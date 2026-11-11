import { cleanup, fireEvent } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { mcsStageLessons } from '../content/stageLessons'
import { mountSection, setupMcsStage, teardownMcsStage } from '../test-support/mcsStage'

/**
 * Every task opens on a picture.
 *
 * Walked on screen in November 2026, one task opened on an empty simulator pane and about twenty
 * more on a short table of numbers with the monitor, the circulation map and the
 * three-dimensional view all folded shut, beside text about a device. Each step now names its
 * lead visual, and the steps whose picture is the device itself open the heart-and-device view.
 */
const lessons = mcsStageLessons()

/** After `setupMcsStage`, which installs its own small-window `matchMedia`. */
function stubWorkspace(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}

const pane = () => document.querySelector<HTMLElement>('[data-simulator-surfaces]')!
const anatomyToggle = () =>
  pane().querySelector<HTMLButtonElement>('[data-surface="anatomy"] > button')!
const mapDisclosure = () =>
  [...pane().querySelectorAll('details')].find(
    (details) => details.querySelector('summary')?.textContent === 'Circulation map',
  )

describe('the lead visual of every MCS task', () => {
  it('is named on every step', () => {
    for (const lesson of lessons)
      for (const step of lesson.steps)
        expect(['comparison', 'timing', 'map', 'anatomy', 'case']).toContain(step.leadVisual)
  })

  it('opens the heart-and-device view on the steps that lead with it, and only there by default', () => {
    for (const lesson of lessons)
      for (const step of lesson.steps)
        if (step.leadVisual === 'anatomy') expect(step.surfaces).toContain('anatomy')
        else expect(step.surfaces).not.toContain('anatomy')
  })

  it('keeps the timing lab on its timing figure and the loop tasks on the map', () => {
    for (const lesson of lessons)
      for (const step of lesson.steps) {
        if (step.presentation === 'timing-lab') expect(step.leadVisual).toBe('timing')
        if (step.interaction.kind === 'walk') expect(step.leadVisual).toBe('map')
      }
  })

  it('leads with the heart and the device where a section used to open on numbers alone', () => {
    const leads = (sectionId: string) =>
      lessons.find((lesson) => lesson.sectionId === sectionId)!.steps.map((s) => s.leadVisual)
    // The three pathways: the opening task had an empty pane.
    expect(leads('mcs-foundations-mechanisms')[0]).toBe('anatomy')
    // The LVAD controller's readings and the LVAD alarms: a table of numbers.
    expect(leads('lvad-parameters-assessment').filter((lead) => lead === 'anatomy').length).toBe(7)
    expect(new Set(leads('lvad-alarms-emergencies'))).toEqual(new Set(['anatomy', 'case']))
    // Every section's closing question is a patient, and that task shows the device on the heart.
    // The case that follows it in sections 3 to 9 is its own picture: a monitor and a console.
    for (const lesson of lessons) {
      const transfer = lesson.steps.find((step) => step.interaction.kind === 'transfer')!
      expect(transfer.leadVisual).toBe('anatomy')
      for (const step of lesson.steps)
        expect(step.leadVisual === 'case').toBe(step.interaction.kind === 'case')
    }
  })
})

describe('the simulator pane', () => {
  afterEach(() => {
    cleanup()
    teardownMcsStage()
    Reflect.deleteProperty(window, 'matchMedia')
  })

  it('opens the three-pathways task on the heart and the device, in the lead column', () => {
    setupMcsStage()
    stubWorkspace(true)
    mountSection('mcs-foundations-mechanisms')
    expect(pane()).toHaveAttribute('data-lead-visual', 'anatomy')
    expect(pane()).toHaveAttribute('data-anatomy-leads')
    expect(anatomyToggle()).toHaveAttribute('aria-expanded', 'true')
    // The lead picture comes first in the pane, ahead of the folded monitor and map.
    expect(pane().firstElementChild).toHaveAttribute('data-surface', 'anatomy')
    expect(mapDisclosure()?.open).toBe(false)
  })

  it('opens the circulation map in its place when the learner closes the view', () => {
    setupMcsStage()
    stubWorkspace(true)
    mountSection('mcs-foundations-mechanisms')
    fireEvent.click(anatomyToggle())
    expect(anatomyToggle()).toHaveAttribute('aria-expanded', 'false')
    expect(pane()).not.toHaveAttribute('data-anatomy-leads')
    expect(mapDisclosure()?.open).toBe(true)
  })

  it('leaves the view closed on a small window and shows the map instead', () => {
    setupMcsStage()
    stubWorkspace(false)
    mountSection('mcs-foundations-mechanisms')
    expect(pane()).toHaveAttribute('data-lead-visual', 'anatomy')
    expect(pane()).not.toHaveAttribute('data-anatomy-leads')
    expect(anatomyToggle()).toHaveAttribute('aria-expanded', 'false')
    expect(mapDisclosure()?.open).toBe(true)
  })
})
