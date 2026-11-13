import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CrrtMembraneTransport, crrtTransportMechanisms } from '../components/CrrtMembraneTransport'
import { CrrtPilotCircuit } from '../components/CrrtPilotCircuit'
import { CrrtPressureArithmetic } from '../components/CrrtPressureArithmetic'
import { crrtCircuitOverlay, crrtCircuitPath } from '../content/circuitModel'
import { CRRT_CALCULATED_PRESSURE_NO_FLOW_REASON } from '../engine/circuitDelivery'
import {
  calculatePrismaxFilterPressureDropMmHg,
  calculatePrismaxTmpMmHg,
  PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
  PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
} from '../engine/pressureModel'
import {
  describeCrrtFilterDropArithmetic,
  describeCrrtTmpArithmetic,
  formatCrrtMmHg,
} from '../pressureArithmetic'

/**
 * CRRT-FELLOW-03 — F-14 (arithmetic presentation only), F-13 (circuit legend and expanded
 * view) and F-15 (membrane comparison). No formula, constant or correction placement changes.
 */

describe('F-14 pressure arithmetic presents the existing formula and nothing else', () => {
  const cases = [
    { filterMmHg: 50, returnMmHg: 20, effluentMmHg: -20 },
    { filterMmHg: 70.3744, returnMmHg: 56, effluentMmHg: -20 },
    { filterMmHg: 5, returnMmHg: 5, effluentMmHg: -20 },
    { filterMmHg: 183.2, returnMmHg: 96.7, effluentMmHg: 12.4 },
    { filterMmHg: -3, returnMmHg: -9, effluentMmHg: 0 },
  ]

  it('returns the engine’s own results for every set of readings', () => {
    for (const raw of cases) {
      const tmp = describeCrrtTmpArithmetic(raw)
      const drop = describeCrrtFilterDropArithmetic(raw)
      expect(tmp.resultMmHg).toBe(
        calculatePrismaxTmpMmHg({
          rawFilterPressureMmHg: raw.filterMmHg,
          rawReturnPressureMmHg: raw.returnMmHg,
          rawEffluentPressureMmHg: raw.effluentMmHg,
        }),
      )
      expect(drop.resultMmHg).toBe(
        calculatePrismaxFilterPressureDropMmHg(raw.filterMmHg, raw.returnMmHg)
          .displayedPressureDropMmHg,
      )
    }
  })

  it('shows the correction as its own term with the engine’s constant, applied once, in place', () => {
    const tmp = describeCrrtTmpArithmetic(cases[0])
    const drop = describeCrrtFilterDropArithmetic(cases[0])
    expect(tmp.terms.filter((term) => term.role === 'correction')).toEqual([
      {
        label: 'Display offset',
        role: 'correction',
        valueMmHg: PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
      },
    ])
    expect(drop.terms.filter((term) => term.role === 'correction')).toEqual([
      {
        label: 'Correction applied by this simulation',
        role: 'correction',
        valueMmHg: PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
      },
    ])
    // The walkthrough's case: filter 50, return 20, effluent −20 → TMP 37, drop 5.
    expect(tmp.worked).toBe('(50 + 20) ÷ 2 − (−20) + (−18) = 37 mmHg')
    expect(drop.worked).toBe('(50 − 20) + (−25) = 5 mmHg')
    expect(drop.terms.find((term) => term.role === 'intermediate')?.valueMmHg).toBe(30)
    // The −25 placement is still held; the −18 is printed in the manual.
    expect(drop.correction.status).toBe('placement-held-for-device-review')
    expect(drop.correction.note).toMatch(/applies the −25 mmHg to the drop itself/)
    expect(tmp.correction.status).toBe('printed-in-manual')
    // Rounded terms either reproduce the rounded result or the display says they do not.
    for (const raw of cases) {
      const described = describeCrrtTmpArithmetic(raw)
      const [f, r, e] = [raw.filterMmHg, raw.returnMmHg, raw.effluentMmHg].map(Math.round)
      expect(described.roundedTermsReproduceResult).toBe(
        Math.round((f + r) / 2 - e + PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG) ===
          Math.round(described.resultMmHg),
      )
    }
  })

  it('keeps the no-flow validity qualification beside a neatly worked no-flow line', () => {
    render(
      <CrrtPressureArithmetic
        signal="filter-drop"
        raw={cases[2]}
        validityNote={CRRT_CALCULATED_PRESSURE_NO_FLOW_REASON}
        displayedMmHg={-25}
      />,
    )
    const block = screen.getByRole('region', {
      name: 'How this filter pressure drop is calculated now',
    })
    expect(within(block).getByText('(5 − 5) + (−25) = −25 mmHg')).toBeInTheDocument()
    expect(within(block).getByRole('note')).toHaveTextContent(
      CRRT_CALCULATED_PRESSURE_NO_FLOW_REASON,
    )
    expect(block).toHaveTextContent('Correction applied by this simulation · correction term')
  })

  it.each([
    {
      signal: 'tmp' as const,
      raw: { filterMmHg: 50.4, returnMmHg: 20.4, effluentMmHg: -20.4 },
      worked: '(50 + 20) ÷ 2 − (−20) + (−18) ≈ 38 mmHg',
      exact: 37.8,
    },
    {
      signal: 'filter-drop' as const,
      raw: { filterMmHg: 50.6, returnMmHg: 20.4, effluentMmHg: -20 },
      worked: '(51 − 20) + (−25) ≈ 5 mmHg',
      exact: 5.2,
    },
    {
      // Even integer inputs can yield a half-mmHg TMP. Rounding that result is not equality.
      signal: 'tmp' as const,
      raw: { filterMmHg: 51, returnMmHg: 20, effluentMmHg: -20 },
      worked: '(51 + 20) ÷ 2 − (−20) + (−18) ≈ 38 mmHg',
      exact: 37.5,
    },
  ])('does not render a false equality for $signal with $raw', ({ signal, raw, worked, exact }) => {
    const description =
      signal === 'tmp' ? describeCrrtTmpArithmetic(raw) : describeCrrtFilterDropArithmetic(raw)
    expect(description.resultMmHg).toBeCloseTo(exact)
    const { container } = render(<CrrtPressureArithmetic signal={signal} raw={raw} />)
    const equation = container.querySelector('[data-crrt-arithmetic-worked]')!
    expect(equation).toHaveTextContent(worked)
    expect(equation.textContent).not.toContain(' = ')
  })

  it('does not restate either constant in the presentation code', () => {
    for (const file of ['pressureArithmetic.ts', 'components/CrrtPressureArithmetic.tsx']) {
      const code = readFileSync(join(__dirname, '..', file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(code).not.toMatch(/\b(?:18|25)\b/)
    }
    expect(formatCrrtMmHg(-18)).toBe('−18')
  })

  it('brackets each correction as its own signed term on the circuit diagram', () => {
    const { container } = render(
      <CrrtPilotCircuit
        presentation="focused"
        overlayId="pressure-profile"
        running={false}
        setReady
        fluidsReady
        bloodFlowMlMin={100}
        dialysateFlowMlHour={null}
        patientFluidRemovalMlHour={null}
        pressure={{ access: -15, filter: 50, return: 20, effluent: -20, TMP: 37, filterDrop: 5 }}
      />,
    )
    const labels = [...container.querySelectorAll('svg[data-overlay] text')].map(
      (text) => text.textContent,
    )
    expect(labels).toContain('TMP = (FILTER + RETURN) ÷ 2 − EFFLUENT + (−18)')
    expect(labels).toContain('FILTER DROP = FILTER − RETURN + (−25 · IN REVIEW)')
    expect(labels.join(' ')).not.toMatch(/EFFLUENT -18|RETURN -25/)
  })
})

describe('F-13 canonical circuit: legend and expanded view', () => {
  function Focused() {
    return (
      <CrrtPilotCircuit
        presentation="focused"
        overlayId="cvvhd"
        running={false}
        setReady
        fluidsReady
        bloodFlowMlMin={null}
        dialysateFlowMlHour={null}
        patientFluidRemovalMlHour={null}
        pressure={{
          access: null,
          filter: null,
          return: null,
          effluent: null,
          TMP: null,
          filterDrop: null,
        }}
      />
    )
  }

  it('shows a legend for the line styles active in the view, with the dimmed-parts note', () => {
    render(<Focused />)
    const region = screen.getByRole('region', { name: 'Canonical CRRT circuit' })
    const legend = within(region).getByRole('group', { name: 'Line pattern legend' })
    const kinds = new Set(
      crrtCircuitOverlay('cvvhd').activePathIds.map((id) => crrtCircuitPath(id).kind),
    )
    expect(within(legend).getAllByText(/./, { selector: 'strong' })).toHaveLength(kinds.size)
    expect(region).toHaveTextContent('Dimmed lines and parts belong to the same circuit')
  })

  it('opens the same drawing larger from the keyboard, sizes it, and returns focus on Escape', async () => {
    const { container } = render(<Focused />)
    const expand = screen.getByRole('button', { name: 'Expand circuit' })
    expand.focus()
    fireEvent.click(expand)
    const dialog = screen.getByRole('dialog', { name: 'Canonical CRRT circuit · expanded' })
    // The same overlay, so the same connections and active paths; only its size changes.
    const inline = container.querySelector('svg[data-overlay]')!
    const larger = dialog.querySelector('svg[data-overlay]')!
    expect(larger.getAttribute('data-overlay')).toBe(inline.getAttribute('data-overlay'))
    expect(larger.querySelectorAll('[data-path]')).toHaveLength(
      inline.querySelectorAll('[data-path]').length,
    )
    expect(larger.querySelector('title')!.id).not.toBe(inline.querySelector('title')!.id)
    const sizes = within(dialog).getByRole('group', { name: 'Drawing size' })
    fireEvent.click(within(sizes).getByRole('button', { name: '150%' }))
    expect(within(sizes).getByRole('button', { name: '150%' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const scroller = within(dialog).getByRole('group', {
      name: 'Expanded circuit drawing; scrolls in both directions',
    })
    expect(scroller).toHaveAttribute('tabindex', '0')
    expect(scroller).toHaveAttribute('data-zoom', '150')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    // Radix returns focus on the next macrotask.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(expand)
  })
})

describe('F-15 membrane transport comparison', () => {
  it('draws all three mechanisms at once, named by the selected one', () => {
    render(<CrrtMembraneTransport selected="convection" />)
    const figure = screen.getByRole('figure', { name: 'Filter inset · convection' })
    const image = within(figure).getByRole('img')
    expect(image).toHaveAccessibleName(/Water carries eligible dissolved solute/)
    expect(figure.querySelectorAll('[data-mechanism]')).toHaveLength(3)
    expect(figure.querySelector('[data-selected="true"][data-mechanism]')).toHaveAttribute(
      'data-mechanism',
      'convection',
    )
  })

  it('has a full text equivalent reusing the existing captions verbatim', () => {
    render(<CrrtMembraneTransport selected="diffusion" />)
    const equivalent = screen.getByRole('region', { name: 'What each panel shows' })
    for (const mechanism of crrtTransportMechanisms) {
      expect(equivalent).toHaveTextContent(mechanism.caption)
      expect(equivalent).toHaveTextContent(mechanism.drawing)
    }
    const source = readFileSync(
      join(__dirname, '..', 'components', 'CrrtFoundationTools.tsx'),
      'utf8',
    )
    // The captions are the ones the original inset carried; no second copy drifts.
    expect(source).not.toMatch(/Solute moves down its concentration gradient/)
  })

  it('states its conceptual scope and keeps one dot size', () => {
    const { container } = render(<CrrtMembraneTransport selected="ultrafiltration" />)
    expect(container).toHaveTextContent('not a quantitative clearance or patient model')
    expect(container).toHaveTextContent(
      'The motion shows direction only; nothing in it is measured',
    )
    // One dot size only — no molecule-size or relative-clearance claim.
    const radii = new Set([...container.querySelectorAll('circle')].map((c) => c.getAttribute('r')))
    expect([...radii]).toEqual(['6'])
  })

  describe('in motion (critical care plan 2026-11-10)', () => {
    const figureOf = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('[data-crrt-membrane-transport]')!
    const panel = (container: HTMLElement, id: string) =>
      container.querySelector<HTMLElement>(`[data-mechanism="${id}"]`)!
    afterEach(() => {
      // @ts-expect-error restore jsdom's default (no matchMedia)
      delete window.matchMedia
    })

    it('plays by default and one button pauses and resumes it', () => {
      const { container } = render(<CrrtMembraneTransport selected="diffusion" />)
      expect(figureOf(container)).toHaveAttribute('data-motion', 'playing')
      fireEvent.click(screen.getByRole('button', { name: 'Pause motion' }))
      expect(figureOf(container)).toHaveAttribute('data-motion', 'paused')
      fireEvent.click(screen.getByRole('button', { name: 'Play motion' }))
      expect(figureOf(container)).toHaveAttribute('data-motion', 'playing')
    })

    /*
     * Found in the browser, 2026-11-13. This module's shell switches every animation off where
     * the device asks for reduced motion, so the figure's Play button did nothing there, and the
     * dots, which were placed by their paused animations, all sat at their start points: the
     * diffusion panel showed none and each water panel one. The figure is now a still drawing
     * there, every dot placed by its own coordinates, and no Play is offered.
     */
    describe('where the device asks for reduced motion', () => {
      beforeEach(() => {
        window.matchMedia = ((query: string) => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        })) as unknown as typeof window.matchMedia
      })

      it('is a still drawing that says why, with no button that would do nothing', () => {
        const { container } = render(<CrrtMembraneTransport selected="diffusion" />)
        expect(figureOf(container)).toHaveAttribute('data-motion', 'still')
        expect(screen.queryByRole('button', { name: /motion/ })).toBeNull()
        expect(container.querySelector('[data-crrt-membrane-motion-off]')).toHaveTextContent(
          'Shown still: this device asks for reduced motion.',
        )
      })

      it('places every dot by its own coordinates, so the drawing is complete without animation', () => {
        const { container } = render(<CrrtMembraneTransport selected="diffusion" />)
        // No dot leans on an animation class or delay to be where it is.
        for (const dot of container.querySelectorAll('circle')) {
          expect((dot as SVGElement).style.animationDelay).toBe('')
          expect(dot.getAttribute('class')).not.toMatch(/stream|crossing|carried/)
        }
        const diffusion = panel(container, 'diffusion')
        const [blood, fluid] = [...diffusion.querySelectorAll('g[clip-path]')].map((group) =>
          [...group.querySelectorAll('circle')].map((dot) => Number(dot.getAttribute('cy'))),
        )
        // Eight on the blood side and two on the fluid side, all inside the sides' own frame.
        expect(blood).toHaveLength(8)
        expect(fluid).toHaveLength(2)
        for (const y of [...blood, ...fluid]) {
          expect(y).toBeGreaterThanOrEqual(36)
          expect(y).toBeLessThanOrEqual(204)
        }
        // One dot about to cross and one just across the membrane (drawn at x 150).
        expect(
          [...diffusion.querySelectorAll('[data-crrt-crossing]')].map((dot) =>
            Number(dot.getAttribute('cx')),
          ),
        ).toEqual([118, 184])
        // Three dots spread along the water arrow, the same in both water panels.
        for (const id of ['convection', 'ultrafiltration']) {
          expect(
            [...panel(container, id).querySelectorAll('[data-crrt-carried]')].map((dot) =>
              Number(dot.getAttribute('cx')),
            ),
          ).toEqual([76, 128, 180])
        }
      })
    })

    it('diffusion: dots step across with no water; more dots on the blood side than the fluid side', () => {
      const { container } = render(<CrrtMembraneTransport selected="diffusion" />)
      const diffusion = panel(container, 'diffusion')
      expect(diffusion.querySelectorAll('[data-crrt-crossing]').length).toBeGreaterThan(0)
      expect(diffusion.querySelectorAll('[data-crrt-carried]')).toHaveLength(0)
      const [blood, fluid] = [...diffusion.querySelectorAll('g[clip-path]')].map(
        (group) => group.querySelectorAll('circle').length,
      )
      expect(blood).toBeGreaterThan(fluid)
      expect(fluid).toBeGreaterThan(0)
    })

    it('convection: the dots are carried in the water, and replacement runs back in', () => {
      const { container } = render(<CrrtMembraneTransport selected="convection" />)
      const convection = panel(container, 'convection')
      expect(convection.querySelectorAll('[data-crrt-carried]')).toHaveLength(3)
      expect(convection.querySelectorAll('[data-crrt-crossing]')).toHaveLength(0)
      // Each carried dot starts on the water arrow's own line.
      for (const dot of convection.querySelectorAll('[data-crrt-carried]')) {
        expect(dot).toHaveAttribute('cy', '128')
        expect(dot).toHaveAttribute('cx', '44')
      }
      expect(convection.querySelectorAll('[data-crrt-replacement]')).toHaveLength(1)
    })

    /*
     * Clinical review, 2026-11-13. The ultrafiltration panel drew water crossing with no solute,
     * which read as a mechanism that carries none. Water pushed across the membrane takes
     * permeable solute with it: that is what convection is. The panel now draws the same water
     * and the same dots as the convection panel, and differs in the one way the two differ:
     * nothing is run back in, so what crosses is net fluid removal.
     */
    it('ultrafiltration: the same water and solute as convection, with nothing replaced', () => {
      const { container } = render(<CrrtMembraneTransport selected="ultrafiltration" />)
      const convection = panel(container, 'convection')
      const ultrafiltration = panel(container, 'ultrafiltration')
      const carried = (element: HTMLElement) =>
        [...element.querySelectorAll('[data-crrt-carried]')].map((dot) => [
          dot.getAttribute('cx'),
          dot.getAttribute('cy'),
          dot.getAttribute('r'),
          (dot as SVGElement).style.animationDelay,
        ])
      // Same count, place, size and timing: neither panel reads as carrying more solute.
      expect(carried(ultrafiltration)).toEqual(carried(convection))
      expect(carried(ultrafiltration)).toHaveLength(3)
      expect(ultrafiltration.querySelectorAll('[data-crrt-replacement]')).toHaveLength(0)
      expect(ultrafiltration).toHaveTextContent('water + solute')
      expect(ultrafiltration).toHaveTextContent('net fluid removal')
      expect(convection).not.toHaveTextContent('net fluid removal')
    })

    it('ultrafiltration: says the panel is about fluid balance and where the solute is counted', () => {
      const entry = crrtTransportMechanisms.find((item) => item.id === 'ultrafiltration')!
      expect(entry.scope).toBe(
        'This panel is about fluid balance. The water that crosses carries dissolved solute with it, as in convection, and that solute is counted as convective clearance. What is not replaced is the net fluid removal.',
      )
      // Nothing in its words says or implies that no solute crosses.
      for (const text of [entry.caption, entry.scope!, entry.drawing, entry.motion])
        expect(text).not.toMatch(/no solute|without solute|water only|only water/i)
      // No amount is claimed: the model has no sieving coefficient or solute clearance behind this.
      expect(`${entry.scope} ${entry.drawing} ${entry.motion}`).not.toMatch(
        /\d|small|little|negligible|less than|most/i,
      )
      // Only this panel needs the line; the other two say what they draw.
      expect(crrtTransportMechanisms.filter((item) => item.scope).map((item) => item.id)).toEqual([
        'ultrafiltration',
      ])

      const { container } = render(<CrrtMembraneTransport selected="ultrafiltration" />)
      // Under the heading when the panel is the selected one, in the picture's spoken name, and
      // in the text equivalent whichever panel is selected.
      expect(container.querySelector('[data-crrt-membrane-scope]')).toHaveTextContent(entry.scope!)
      expect(within(figureOf(container)).getByRole('img')).toHaveAccessibleName(
        `${entry.caption} ${entry.scope}`,
      )
      cleanup()
      const other = render(<CrrtMembraneTransport selected="diffusion" />)
      expect(other.container.querySelector('[data-crrt-membrane-scope]')).toBeNull()
      expect(screen.getByRole('region', { name: 'What each panel shows' })).toHaveTextContent(
        entry.scope!,
      )
    })

    it('says in words what moves in each panel, and uses no SMIL', () => {
      const { container } = render(<CrrtMembraneTransport selected="diffusion" />)
      const equivalent = screen.getByRole('region', { name: 'What each panel shows' })
      for (const mechanism of crrtTransportMechanisms) {
        expect(mechanism.motion).toMatch(/^Moving: /)
        expect(equivalent).toHaveTextContent(mechanism.motion)
      }
      expect(container.querySelectorAll('animate, animateMotion, animateTransform')).toHaveLength(0)
    })

    it('describes the drawing in its motion lines, and claims nothing the drawing cannot show', () => {
      // Clinical review, 2026-11-13. A motion line says what is drawn. It does not say that no
      // water crosses a membrane during diffusive therapy, that no solute leaves with
      // ultrafiltrate, or how fast a solute travels relative to its water (a sieving claim).
      for (const mechanism of crrtTransportMechanisms) {
        expect(mechanism.motion).not.toMatch(/no water crosses|no solute/i)
        expect(mechanism.motion).not.toMatch(/speed|faster|slower|rate|\d/i)
      }
      const diffusion = crrtTransportMechanisms.find((entry) => entry.id === 'diffusion')!
      expect(diffusion.motion).toContain(
        'No water movement is drawn: this panel shows diffusion alone.',
      )
    })
  })
})
