import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtPressureLocalizationLab } from '../components/CrrtPressureLocalizationLab'
import {
  comparePressureLocalizationPrediction,
  createSyntheticPressureLocalizationResult,
  pressureLocalizationSignals,
  pressureLocalizationSites,
  type PressureLocalizationPrediction,
  type QualitativePressureDirection,
} from '../pressureLocalizationLabModel'

/**
 * CRRT-FELLOW-04 — F-23. After the reveal each of the six predictions is compared on its own
 * with the observed direction, in words, with an explanation worked from the pattern's own
 * readings — so it stays true for every supported site. No total, count or score.
 */

const signals = pressureLocalizationSignals.map((signal) => signal.id)

function predictionFor(
  directions: Partial<Record<(typeof signals)[number], QualitativePressureDirection>>,
  fallback: QualitativePressureDirection = 'unchanged',
): PressureLocalizationPrediction {
  return Object.fromEntries(
    signals.map((id) => [id, directions[id] ?? fallback]),
  ) as PressureLocalizationPrediction
}

function chooseEveryPrediction(prediction: PressureLocalizationPrediction) {
  for (const signal of pressureLocalizationSignals) {
    const word = { lower: 'Lower', unchanged: 'Unchanged', higher: 'Higher' }[prediction[signal.id]]
    fireEvent.click(
      within(screen.getByRole('group', { name: signal.label })).getByRole('radio', { name: word }),
    )
  }
}

function signedNumber(text: string): number {
  return Number(text.replace('−', '-').replace('+', '').replace(/,/g, ''))
}

describe('per-signal comparison model (F-23)', () => {
  it('compares all six predictions individually and never totals them', () => {
    const result = createSyntheticPressureLocalizationResult('obstruction', 'return-line')
    const comparisons = comparePressureLocalizationPrediction(
      result,
      predictionFor({ tmp: 'unchanged', 'filter-drop': 'higher' }),
    )
    expect(comparisons.map((c) => c.id)).toEqual(signals)
    const byId = Object.fromEntries(comparisons.map((c) => [c.id, c]))
    // The novice errors the walkthrough made on purpose.
    expect(byId.tmp).toMatchObject({ predicted: 'unchanged', observed: 'higher' })
    expect(byId.tmp.outcome).toBe('does-not-match')
    expect(byId['filter-drop']).toMatchObject({ predicted: 'higher', observed: 'unchanged' })
    expect(byId['filter-drop'].outcome).toBe('does-not-match')
    expect(byId.access.outcome).toBe('matches')
    expect(Object.keys(comparisons[0])).not.toContain('score')
  })

  it('explains TMP and filter drop from this pattern’s own arithmetic', () => {
    const result = createSyntheticPressureLocalizationResult('obstruction', 'return-line')
    const byId = Object.fromEntries(
      comparePressureLocalizationPrediction(result, null).map((c) => [c.id, c]),
    )
    expect(byId.tmp.explanation).toMatch(/Filter changed by \+20 mmHg and return by \+20 mmHg/)
    expect(byId.tmp.explanation).toMatch(/average changed by \+20 mmHg/)
    expect(byId.tmp.explanation).toMatch(/TMP therefore rose from 37 to 57 mmHg/)
    expect(byId['filter-drop'].explanation).toMatch(
      /their difference changed by 0 mmHg and the drop stayed at 5 mmHg/,
    )
  })

  it.each(pressureLocalizationSites.map((site) => site.id))(
    'stays mathematically consistent for the %s pattern',
    (site) => {
      const result = createSyntheticPressureLocalizationResult('obstruction', site)
      const comparisons = comparePressureLocalizationPrediction(result, null)
      for (const comparison of comparisons) {
        const delta = comparison.revealedMmHg - comparison.baselineMmHg
        const expectedWord =
          comparison.observed === 'unchanged'
            ? 'stayed at'
            : comparison.observed === 'higher'
              ? 'rose from'
              : 'fell from'
        expect(comparison.explanation).toContain(expectedWord)
        expect(Math.sign(Math.round(delta * 10))).toBe(
          comparison.observed === 'higher' ? 1 : comparison.observed === 'lower' ? -1 : 0,
        )
        expect(comparison.outcome).toBe('no-prediction')
      }
      const byId = Object.fromEntries(comparisons.map((c) => [c.id, c]))
      const d = (id: (typeof signals)[number]) => byId[id].revealedMmHg - byId[id].baselineMmHg
      // TMP moves by the average of filter and return minus effluent; the drop by filter − return.
      const stated = byId.tmp.explanation.match(
        /Filter changed by (\S+) mmHg and return by (\S+) mmHg/,
      )
      expect(stated).not.toBeNull()
      expect(signedNumber(stated![1])).toBeCloseTo(d('filter'), 6)
      expect(signedNumber(stated![2])).toBeCloseTo(d('return'), 6)
      expect(d('tmp')).toBeCloseTo((d('filter') + d('return')) / 2 - d('effluent'), 6)
      expect(d('filter-drop')).toBeCloseTo(d('filter') - d('return'), 6)
    },
  )

  it('gives three different TMP stories for three different sites, not one canned sentence', () => {
    const tmp = (site: (typeof pressureLocalizationSites)[number]['id']) =>
      comparePressureLocalizationPrediction(
        createSyntheticPressureLocalizationResult('obstruction', site),
        null,
      ).find((c) => c.id === 'tmp')!.explanation
    expect(tmp('filter')).toMatch(/TMP therefore rose from 37 to 52 mmHg/)
    expect(tmp('return-line')).toMatch(/TMP therefore rose from 37 to 57 mmHg/)
    expect(tmp('effluent-line')).toMatch(/TMP therefore fell from 37 to 7 mmHg/)
    expect(tmp('access-catheter')).toMatch(/TMP therefore stayed at 37 mmHg/)
  })
})

describe('the lab after a reveal (F-23)', () => {
  beforeEach(() => window.localStorage.clear())

  it('marks each signal in words, including the deliberately wrong TMP and drop', () => {
    render(<CrrtPressureLocalizationLab initialSite="return-line" lockedPlacement />)
    chooseEveryPrediction(
      predictionFor({
        access: 'unchanged',
        filter: 'higher',
        return: 'higher',
        effluent: 'unchanged',
        tmp: 'unchanged',
        'filter-drop': 'higher',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal pressure pattern' }))

    const table = screen.getByRole('table', {
      name: 'Pressure directions relative to the starting values',
    })
    expect(within(table).getByRole('row', { name: /^TMP Unchanged Higher/ })).toHaveTextContent(
      'Does not match',
    )
    expect(
      within(table).getByRole('row', { name: /^Filter pressure drop Higher Unchanged/ }),
    ).toHaveTextContent('Does not match')
    expect(
      within(table).getByRole('row', { name: /^Access pressure Unchanged Unchanged/ }),
    ).toHaveTextContent('Matches')

    const why = screen.getByRole('region', { name: 'Why each signal moved' })
    const tmp = why.querySelector('[data-crrt-pressure-signal="tmp"]')!
    expect(tmp).toHaveTextContent('You predicted unchanged; observed higher.')
    expect(tmp).toHaveTextContent('Does not match')
    expect(tmp).toHaveTextContent(/average changed by \+20 mmHg/)
    const drop = why.querySelector('[data-crrt-pressure-signal="filter-drop"]')!
    expect(drop).toHaveTextContent('You predicted higher; observed unchanged.')
    expect(drop).toHaveTextContent(/drop stayed at 5 mmHg/)
    // Outcome is carried by words; there is no total, count or score anywhere.
    expect(screen.queryByText(/\d+\s*(of|\/)\s*6/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\bscore\b|\bcorrect\b/i)).not.toBeInTheDocument()
  })

  it('shows every explanation on a reveal-first path with no prediction', () => {
    render(<CrrtPressureLocalizationLab initialSite="return-line" lockedPlacement />)
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    const why = screen.getByRole('region', { name: 'Why each signal moved' })
    expect(why.querySelectorAll('li[data-comparison="no-prediction"]')).toHaveLength(6)
    expect(why).toHaveTextContent('No prediction made; observed higher.')
    expect(
      screen.getByRole('button', { name: 'Review pressure comparison and continue' }),
    ).toBeDisabled()
  })

  it('lets the learner revise and try again, which hides the comparison', () => {
    render(<CrrtPressureLocalizationLab initialSite="return-line" lockedPlacement />)
    chooseEveryPrediction(predictionFor({}, 'higher'))
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal pressure pattern' }))
    expect(screen.getByRole('region', { name: 'Why each signal moved' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revise prediction' }))
    expect(screen.queryByRole('region', { name: 'Why each signal moved' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeEnabled()
    expect(window.localStorage).toHaveLength(0)
  })
})
