import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(drop.correction.note).toMatch(/where the correction belongs awaits device review/)
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
    expect(block).toHaveTextContent('placement held for device review')
    expect(block).toHaveTextContent('clinical and device review of this arithmetic is pending')
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

  it('is static: no animation elements and a stated conceptual scope', () => {
    const { container } = render(<CrrtMembraneTransport selected="ultrafiltration" />)
    expect(container.querySelectorAll('animate, animateMotion, animateTransform')).toHaveLength(0)
    expect(container).toHaveTextContent('not a quantitative clearance or patient model')
    expect(container).toHaveTextContent('nothing in it is measured or animated')
    // One dot size only — no molecule-size or relative-clearance claim.
    const radii = new Set([...container.querySelectorAll('circle')].map((c) => c.getAttribute('r')))
    expect([...radii]).toEqual(['6'])
  })
})
