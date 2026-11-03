import { act, render } from '@testing-library/react'

import { DolphinStageHost } from '../components/stage/DolphinStageHost'
import { DOLPHIN_SECTIONS } from '../content/sections'

jest.mock(
  '@/components/airway-anatomy/AirwayAnatomyModuleDynamic',
  () =>
    jest.requireActual<typeof import('../test-support/ScopeTestDouble')>(
      '../test-support/ScopeTestDouble',
    ).scopeDoubleModule,
)
jest.mock(
  '@/i18n/navigation',
  () =>
    jest.requireActual<typeof import('../test-support/navigationDouble')>(
      '../test-support/navigationDouble',
    ).navigationDouble,
)
jest.mock('@/features/dolphin-anatomy/components/DolphinScene', () => ({
  DolphinScene: () => <div data-scene-double />,
}))

/**
 * What a learner can read on the stage before committing the prediction — the whole rendered
 * document at Recognize, every pane — carries none of the section's keyed-answer phrases.
 */
describe('nothing on the stage answers the prediction before it is made', () => {
  it.each(DOLPHIN_SECTIONS.map((section) => [section.id, section] as const))(
    '%s',
    async (_id, section) => {
      const view = render(<DolphinStageHost sectionId={section.id} locale="en" />)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
      const text = document.body.textContent ?? ''
      for (const pattern of section.precommitDenyPatterns) expect(text).not.toMatch(pattern)
      view.unmount()
    },
  )
})
