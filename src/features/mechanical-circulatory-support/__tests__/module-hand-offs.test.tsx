import { act, fireEvent } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .anatomyModule(),
)

import { mcsModuleHandOff, mcsModuleHandOffs } from '../content/moduleHandOffs'
import { mcsSectionLearningContracts } from '../content/sectionLearningContracts'
import { mcsSectionSpec } from '../content/sectionSpecs'
import { mcsStageLessonIds } from '../content/stageLessons'
import { mountSection, setupMcsStage, teardownMcsStage } from '../test-support/mcsStage'

beforeEach(() => {
  setupMcsStage()
})
afterEach(() => {
  teardownMcsStage()
})

function openTask(position: 'first' | 'last') {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-step-list] li button')]
  const button = position === 'first' ? buttons[0] : buttons.at(-1)!
  if (button.disabled) return
  act(() => {
    fireEvent.click(button)
  })
  act(() => {
    jest.advanceTimersByTime(20)
  })
}

/**
 * The course's hand-off to ECMO (critical care plan, round 3).
 *
 * Section 2 compares the three devices this module teaches. ECMO, the support it leaves to its
 * own module, was named there only in one answer's feedback, which pointed to "the pathway cards
 * below": cards that are on the Overview, not in the lesson.
 */
describe('where MCS hands on', () => {
  it('is one hand-off, from Section 2 to the ECMO module', () => {
    expect(mcsModuleHandOffs.map((entry) => [entry.sectionId, entry.href])).toEqual([
      ['mcs-foundations-mechanisms', '/cardiohelp-ecmo'],
    ])
    for (const entry of mcsModuleHandOffs) expect(mcsStageLessonIds).toContain(entry.sectionId)
  })

  it('says nothing the section withholds before an answer', () => {
    for (const entry of mcsModuleHandOffs)
      for (const pattern of mcsSectionSpec(entry.sectionId).precommitDenyPatterns)
        expect(entry.line).not.toMatch(pattern)
  })

  it('is shown under the section’s last task, with a link, and on no earlier task', () => {
    mountSection('mcs-foundations-mechanisms')
    expect(document.querySelector('[data-next-module]')).toBeNull()
    openTask('last')
    const line = document.querySelector('[data-next-module]') as HTMLElement
    expect(line).toHaveAttribute('data-next-module', '/cardiohelp-ecmo')
    expect(line.textContent).toBe(
      `${mcsModuleHandOff('mcs-foundations-mechanisms')!.line} Open Cardiohelp ECMO`,
    )
    expect(line.querySelector('a')).toHaveAttribute('href', '/cardiohelp-ecmo')
    openTask('first')
    expect(document.querySelector('[data-next-module]')).toBeNull()
  })

  it.each(mcsStageLessonIds.filter((id) => !mcsModuleHandOff(id)))(
    '%s has none, on its last task either',
    (sectionId) => {
      mountSection(sectionId)
      openTask('last')
      expect(document.querySelector('[data-next-module]')).toBeNull()
    },
  )

  it('no longer sends the learner to cards that are not on the page', () => {
    const text = JSON.stringify(mcsSectionLearningContracts)
    expect(text).not.toMatch(/pathway cards below/)
    expect(text).toContain(
      'The Overview compares it on its pathway cards, and the Cardiohelp ECMO module teaches it.',
    )
  })
})
