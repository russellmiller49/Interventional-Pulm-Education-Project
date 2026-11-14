import { fireEvent, render, screen } from '@testing-library/react'

import { DolphinIntegratedCaseActivity } from '../components/assess/DolphinIntegratedCaseActivity'
import { DOLPHIN_SOURCE_IDS } from '../data/sources'
import { DOLPHIN_INTEGRATED_CASES } from '../content/integratedCases'
import { dolphinLearnerCopyErrors } from '../content/learnerCopy'
import { DOLPHIN_NUMBER_IDS } from '../content/teachingNumbers'
import { DOLPHIN_PROGRESS_STORAGE_KEY } from '../engine/selfPacedProgress'

jest.mock(
  '@/i18n/navigation',
  () =>
    jest.requireActual<typeof import('../test-support/navigationDouble')>(
      '../test-support/navigationDouble',
    ).navigationDouble,
)

describe('the integrated cases', () => {
  it('are eight, each three to five frames of four choices with one that holds', () => {
    expect(DOLPHIN_INTEGRATED_CASES).toHaveLength(8)
    for (const integrated of DOLPHIN_INTEGRATED_CASES) {
      expect(integrated.frames.length).toBeGreaterThanOrEqual(3)
      expect(integrated.frames.length).toBeLessThanOrEqual(5)
      for (const frame of integrated.frames) {
        expect(frame.choices).toHaveLength(4)
        expect(frame.choices.filter((c) => c.plausibility === 'best')).toHaveLength(1)
        const text = [
          frame.situation,
          frame.prompt,
          ...frame.choices.flatMap((c) => [c.label, c.rationale]),
        ].join(' ')
        expect(text).not.toMatch(/\b(correct|incorrect|wrong)\b/i)
        expect(dolphinLearnerCopyErrors(`${integrated.id} ${frame.id}`, text)).toEqual([])
      }
      for (const id of integrated.sourceIds) expect(DOLPHIN_SOURCE_IDS.has(id)).toBe(true)
      for (const id of integrated.numberIds ?? []) expect(DOLPHIN_NUMBER_IDS.has(id)).toBe(true)
      expect(integrated.title).not.toMatch(/\d/)
    }
  })

  it('withholds the debrief until the last frame and stores only that the case was opened', () => {
    window.localStorage.clear()
    const integrated = DOLPHIN_INTEGRATED_CASES[0]
    render(<DolphinIntegratedCaseActivity caseId={integrated.id} />)
    integrated.frames.forEach((frame, index) => {
      expect(document.querySelector('[data-debrief]')).toBeNull()
      expect(screen.queryByText(integrated.debrief)).toBeNull()
      fireEvent.click(screen.getAllByRole('radio')[0])
      expect(document.querySelector('[data-verdict]')).not.toBeNull()
      const last = index === integrated.frames.length - 1
      fireEvent.click(document.querySelector(last ? '[data-open-debrief]' : '[data-next-frame]')!)
    })
    expect(document.querySelector('[data-debrief]')).not.toBeNull()
    expect(screen.getByText(integrated.debrief)).toBeInTheDocument()
    const stored = window.localStorage.getItem(DOLPHIN_PROGRESS_STORAGE_KEY) ?? ''
    expect(JSON.parse(stored).openedIntegratedCaseIds).toEqual([integrated.id])
    expect(stored).not.toMatch(/choice|correct|attempt|answer|plausib/i)
  })
})
