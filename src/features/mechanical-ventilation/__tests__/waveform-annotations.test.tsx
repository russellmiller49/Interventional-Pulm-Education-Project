import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen, within } from '@testing-library/react'

import { MechanicalVentilatorConsole } from '../components/MechanicalVentilatorConsole'
import { annotationChipLayout, type WaveformAnnotation } from '../components/WaveformStrip'
import { createInitialSimulationState, ventilationSimulationReducer } from '../engine'

const componentStyles = readFileSync(
  join(
    process.cwd(),
    'src/features/mechanical-ventilation/components/mechanical-ventilation.module.css',
  ),
  'utf8',
)

/** The declared value of one property inside the first rule whose selector matches. */
function declaration(selector: string, property: string): string | null {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*{([^}]*)}`)
  const rule = pattern.exec(componentStyles)
  if (!rule) return null
  // Comments sit between declarations in this stylesheet; drop them before splitting.
  const declared = rule[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${property}:`))
  return declared ? declared.slice(property.length + 1).trim() : null
}

function annotation(id: string, value: number): WaveformAnnotation {
  return { id, value, marker: `${id} ${value}`, label: `${id} ${value} — what this level is` }
}

/**
 * Paused-trace annotations.
 *
 * They were SVG `<text>` inside a `preserveAspectRatio="none"` viewBox, so a 9px nominal glyph was
 * scaled by width/1000 horizontally: measured 3.5px per em at 1600x900, 2.3px at 1280x720 and
 * 1.3px at 1024x768 — unreadable, and worse the narrower the workspace got. Nothing here asserts a
 * pixel box, because that is browser-dependent; the invariants are that the size is the trace
 * surface's own baseline rather than a number of its own, that the placement keeps chips apart and
 * inside the trace, and that the sentence each chip abbreviates is still shown somewhere visible.
 * The measured browser confirmation lives in `e2e/mechanical-ventilation-learn-layout.spec.ts`.
 */
describe('paused-trace annotations', () => {
  describe('the placement is readable by construction', () => {
    it('is sized from the trace surface baseline, not a number of its own', () => {
      const baseline = declaration('.waveformLabel strong', 'font-size')
      const token = declaration('.consoleShell', '--wave-annotation-size')
      expect(baseline).toBe('0.65rem')
      // The token exists and equals the baseline the rest of the trace furniture already uses.
      expect(token).toBe(baseline)
      expect(declaration('.waveformAnnotationChip', 'font-size')).toBe(
        'var(--wave-annotation-size)',
      )
    })

    it('does not size the chip in a unit that scales with the pane', () => {
      const chipRule = /\.waveformAnnotationChip\s*{([^}]*)}/.exec(componentStyles)?.[1] ?? ''
      // px or viewBox units here would reintroduce the defect the moment the workspace narrows.
      expect(chipRule).not.toMatch(/font-size:\s*\d/)
      // And the crushed SVG text rule is gone rather than merely overridden.
      expect(componentStyles).not.toMatch(/\.waveformAnnotation\s+text\s*{/)
    })

    it('keeps the chip layer and the trace in the same grid cell', () => {
      // Sharing the cell is what makes a percentage top line up with the dashed reference line;
      // it also has to be explicit, or the overlay displaces the trace into the label column.
      expect(declaration('.waveformSvg', 'grid-column')).toBe('2')
      expect(declaration('.waveformSvg', 'grid-row')).toBe('1')
      expect(declaration('.waveformAnnotationLayer', 'grid-column')).toBe('2')
      expect(declaration('.waveformAnnotationLayer', 'grid-row')).toBe('1')
    })

    it('still stands up under forced colours', () => {
      const forced = /@media\s*\(forced-colors:\s*active\)\s*{([\s\S]*?)\n}/.exec(componentStyles)
      expect(forced).not.toBeNull()
      expect(forced?.[1]).toMatch(/\.waveformAnnotationChip/)
      expect(forced?.[1]).toMatch(/CanvasText/)
    })
  })

  describe('chip placement', () => {
    const bounds = { minimum: 0, maximum: 60 }
    const centres = (annotations: readonly WaveformAnnotation[]) =>
      annotationChipLayout(annotations, bounds.minimum, bounds.maximum).map(
        (placement) => placement.centrePercent,
      )

    function assertSeparatedAndContained(annotations: readonly WaveformAnnotation[]) {
      const placements = annotationChipLayout(annotations, bounds.minimum, bounds.maximum)
      placements.forEach((placement) => {
        expect(placement.centrePercent).toBeGreaterThanOrEqual(8)
        expect(placement.centrePercent).toBeLessThanOrEqual(92)
      })
      for (let index = 1; index < placements.length; index += 1) {
        // One chip's own height, so two chips can never share the same band.
        expect(
          placements[index].centrePercent - placements[index - 1].centrePercent,
        ).toBeGreaterThanOrEqual(14 - 1e-9)
      }
    }

    it('separates levels that would otherwise collide', () => {
      // A plateau one cmH2O under the peak is the standing case in an obstructed patient.
      assertSeparatedAndContained([
        annotation('peak', 26),
        annotation('plateau', 25),
        annotation('peep', 24),
      ])
    })

    it('separates levels that are identical', () => {
      assertSeparatedAndContained([
        annotation('peak', 20),
        annotation('plateau', 20),
        annotation('peep', 20),
      ])
    })

    it('contains levels that sit at or beyond the ends of the scale', () => {
      assertSeparatedAndContained([
        annotation('peak', 240),
        annotation('plateau', 30),
        annotation('peep', -40),
      ])
    })

    it('handles a degenerate scale without producing NaN', () => {
      const placements = annotationChipLayout([annotation('peak', 12)], 20, 20)
      expect(placements).toHaveLength(1)
      expect(Number.isFinite(placements[0].centrePercent)).toBe(true)
    })

    it('leaves the dashed line on the true value even when the chip is nudged', () => {
      const placements = annotationChipLayout(
        [annotation('peak', 26), annotation('plateau', 25)],
        bounds.minimum,
        bounds.maximum,
      )
      const peak = placements.find((placement) => placement.id === 'peak')
      const plateau = placements.find((placement) => placement.id === 'plateau')
      // The lines stay where the values put them: only the chips move.
      expect(peak?.linePercent).toBeLessThan(plateau?.linePercent ?? 0)
      expect(peak?.linePercent).not.toBe(plateau?.linePercent)
      expect(plateau?.centrePercent).toBeGreaterThan(plateau?.linePercent ?? 0)
    })

    it('orders chips by level, highest pressure highest on the trace', () => {
      const [first, second, third] = centres([
        annotation('peep', 5),
        annotation('peak', 40),
        annotation('plateau', 22),
      ])
      expect(first).toBeLessThan(second)
      expect(second).toBeLessThan(third)
    })

    it('returns nothing to place when there is nothing to annotate', () => {
      expect(annotationChipLayout([], 0, 60)).toEqual([])
    })
  })

  describe('what the console renders while the trace is held still', () => {
    function pausedConsole() {
      const initial = createInitialSimulationState('MV-01', 'learn', 1, 'hamilton-c6')
      let state = { ...initial, paused: false }
      for (let tick = 0; tick < 120; tick += 1) {
        state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
      }
      return { ...state, paused: true }
    }

    it('marks each level on the trace and states what it is in a visible text equivalent', () => {
      const state = pausedConsole()
      render(<MechanicalVentilatorConsole state={state} dispatch={jest.fn()} controlsEnabled />)
      const consoleRegion = screen.getByRole('region', {
        name: /functional training facsimile/i,
      })

      const chips = consoleRegion.querySelectorAll('[data-mv-annotation-chip]')
      expect(chips.length).toBe(3)
      chips.forEach((chip) => {
        // Name and value: short enough to sit beside the line it marks at any pane width.
        expect(chip.textContent?.trim()).toMatch(/^\S+ -?\d+$/)
      })

      // The sentence each chip abbreviates is still shown, in the console's own text equivalent.
      expect(within(consoleRegion).getByText(/Held trace, labelled levels/i)).toBeInTheDocument()
      // Stated in the visible text equivalent as well as in the trace's own caption.
      expect(
        within(consoleRegion).getAllByText(/baseline the breath starts from/i).length,
      ).toBeGreaterThan(0)
    })

    it('says nothing about held levels while the trace is running', () => {
      const state = { ...pausedConsole(), paused: false }
      render(<MechanicalVentilatorConsole state={state} dispatch={jest.fn()} controlsEnabled />)
      const consoleRegion = screen.getByRole('region', {
        name: /functional training facsimile/i,
      })
      expect(consoleRegion.querySelectorAll('[data-mv-annotation-chip]')).toHaveLength(0)
      expect(
        within(consoleRegion).queryByText(/Held trace, labelled levels/i),
      ).not.toBeInTheDocument()
    })

    it('keeps the full labels in the trace figure caption for a screen reader', () => {
      const state = pausedConsole()
      render(<MechanicalVentilatorConsole state={state} dispatch={jest.fn()} controlsEnabled />)
      // The caption is the non-visual equivalent and still carries every clause, unabbreviated.
      expect(screen.getAllByText(/Labelled components:/i).length).toBeGreaterThan(0)
      expect(
        screen.getAllByText(/Labelled components:[^.]*baseline the breath starts from/i).length,
      ).toBeGreaterThan(0)
    })

    it('does not hide the chips from the accessibility tree twice', () => {
      const state = pausedConsole()
      const { container } = render(
        <MechanicalVentilatorConsole state={state} dispatch={jest.fn()} controlsEnabled />,
      )
      // The chips repeat what the caption and the text equivalent already say, so the layer is
      // aria-hidden — but the layer, not each chip, so the DOM stays simple.
      const layer = container.querySelector('[data-mv-annotation-chip]')?.parentElement
      expect(layer).toHaveAttribute('aria-hidden', 'true')
    })
  })
})
