import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CrrtPilotCircuit, type CrrtPilotCircuitProps } from '../components/CrrtPilotCircuit'

const nullPressures = {
  access: null,
  filter: null,
  return: null,
  effluent: null,
  TMP: null,
  filterDrop: null,
}

function renderCircuit(overrides: Partial<CrrtPilotCircuitProps> = {}) {
  return render(
    <CrrtPilotCircuit
      running={false}
      setReady={false}
      fluidsReady={false}
      bloodFlowMlMin={null}
      dialysateFlowMlHour={null}
      patientFluidRemovalMlHour={null}
      pressure={nullPressures}
      {...overrides}
    />,
  )
}

describe('CRRT educational circuit', () => {
  it('renders an accessible original schematic and the confirmed topology in text', () => {
    renderCircuit()

    expect(
      screen.getByRole('img', { name: /^CVVHD educational circuit topology/i }),
    ).toBeInTheDocument()
    const textSummary = screen.getByText(/Blood path: patient access/i, { selector: 'p' })
    expect(textSummary).toHaveTextContent(/patient access → blood pump → filter-pressure site/i)
    expect(textSummary).toHaveTextContent(
      /filter → deaeration and return path → air detector and return clamp → patient/i,
    )
    expect(textSummary).toHaveTextContent(/Dialysate enters the filter fluid side/i)
    expect(textSummary).toHaveTextContent(
      /Effluent leaves through the effluent-pressure site and blood-leak detector/i,
    )

    const viewport = screen.getByRole('group', { name: /horizontally scrollable/i })
    expect(viewport).toHaveAttribute('tabindex', '0')
    const scrollBy = jest.fn()
    Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy })
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledWith({ left: 140, behavior: 'smooth' })
  })

  it('shows all four source-mapped scale labels and explicit active or inactive status', () => {
    renderCircuit()

    const scaleList = screen.getByRole('list', { name: 'CRRT scale positions' })
    const cards = within(scaleList).getAllByRole('listitem')
    expect(cards).toHaveLength(4)
    expect(within(cards[0]).getByText('Effluent')).toBeInTheDocument()
    expect(within(cards[0]).getByText('Yellow circle')).toBeInTheDocument()
    expect(within(cards[0]).getByText('Active in this CVVHD case')).toBeInTheDocument()
    expect(within(cards[1]).getByText('PBP')).toBeInTheDocument()
    expect(within(cards[1]).getByText('White triangle')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Inactive in this CVVHD case')).toBeInTheDocument()
    expect(within(cards[2]).getByText('Dialysate')).toBeInTheDocument()
    expect(within(cards[2]).getByText('Green square')).toBeInTheDocument()
    expect(within(cards[2]).getByText('Active in this CVVHD case')).toBeInTheDocument()
    expect(within(cards[3]).getByText('Replacement')).toBeInTheDocument()
    expect(within(cards[3]).getByText('Purple octagon')).toBeInTheDocument()
    expect(within(cards[3]).getByText('Inactive in this CVVHD case')).toBeInTheDocument()
  })

  it('uses an em dash and No case signal for every absent pressure', () => {
    renderCircuit()

    const pressureList = screen.getByRole('list', { name: 'Circuit pressure signals' })
    const nodes = within(pressureList).getAllByRole('listitem')
    expect(nodes).toHaveLength(6)
    for (const node of nodes) {
      expect(within(node).getByLabelText('No case signal')).toHaveTextContent('—')
      expect(within(node).getByText('No case signal')).toBeInTheDocument()
    }
  })

  it('renders supplied pressure signals without adding thresholds or normal labels', () => {
    renderCircuit({
      pressure: {
        access: -82,
        filter: 144,
        return: 71,
        effluent: 18,
        TMP: 63,
        filterDrop: 73,
      },
    })

    const pressureList = screen.getByRole('list', { name: 'Circuit pressure signals' })
    for (const value of ['-82', '144', '71', '18', '63', '73']) {
      expect(within(pressureList).getByText(`${value} mmHg`)).toBeInTheDocument()
    }
    expect(within(pressureList).queryByText(/normal|target|threshold/i)).not.toBeInTheDocument()
  })

  it('communicates running and readiness states with visible text', () => {
    renderCircuit({
      running: true,
      setReady: true,
      fluidsReady: true,
      bloodFlowMlMin: 180,
      dialysateFlowMlHour: 1_200,
      patientFluidRemovalMlHour: 75,
      pressure: {
        access: -82,
        filter: 144,
        return: 71,
        effluent: 18,
        TMP: 63,
        filterDrop: 73,
      },
    })

    expect(screen.getByText('Circuit running').closest('[role="status"]')).toHaveTextContent(
      'Circuit running',
    )
    const readiness = screen.getByLabelText('Circuit readiness status')
    expect(within(readiness).getAllByText('Ready')).toHaveLength(2)
    expect(screen.getByText('FLOW MOTION: ACTIVE')).toBeInTheDocument()
    const stateSummary = screen.getByText(/^Circuit state: running\./)
    expect(stateSummary).not.toHaveAttribute('aria-live')
    expect(stateSummary).not.toHaveAttribute('role', 'status')
    expect(stateSummary).toHaveTextContent('Training set ready; fluids ready')
    expect(stateSummary).toHaveTextContent('Blood flow 180 milliliters per minute')
    expect(stateSummary).toHaveTextContent('Pressure state: access -82 millimeters of mercury')
    const viewport = screen.getByRole('group', { name: /horizontally scrollable/i })
    expect(viewport.getAttribute('aria-describedby')).toContain(stateSummary.id)
  })

  it('encodes focus visibility, running-only motion, and reduced-motion suppression', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/features/baxter-crrt/components/crrt-pilot-circuit.module.css'),
      'utf8',
    )

    expect(css).toContain('.diagramViewport:focus-visible')
    expect(css).toContain(".circuitSvg[data-running='true'] .flowTrace")
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation: none !important')
    expect(css).toContain('min-height: 44px')
  })

  it('responds to its own embedded width instead of compressing signal cards', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/features/baxter-crrt/components/crrt-pilot-circuit.module.css'),
      'utf8',
    )

    expect(css).toContain('container-type: inline-size')
    expect(css).toContain('@container crrt-circuit (max-width: 900px)')
    expect(css).toMatch(
      /@container crrt-circuit \(max-width: 900px\)[\s\S]*?\.dataGrid\s*\{[\s\S]*?grid-template-columns: 1fr/,
    )
    expect(css).toMatch(
      /@container crrt-circuit \(max-width: 600px\)[\s\S]*?\.pressureGrid\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
    )
  })
})
