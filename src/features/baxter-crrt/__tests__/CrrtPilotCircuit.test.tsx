import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'

import { CrrtPilotCircuit, type CrrtPilotCircuitProps } from '../components/CrrtPilotCircuit'
import {
  crrtCircuitNodes,
  crrtCircuitOverlays,
  crrtCircuitPaths,
  crrtCircuitTextEquivalent,
  crrtCitrateCalciumTerms,
} from '../content/circuitModel'
import {
  PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG,
  PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG,
} from '../engine/pressureModel'

const nullPressures = {
  access: null,
  filter: null,
  return: null,
  effluent: null,
  TMP: null,
  filterDrop: null,
}

const suppliedPressures = {
  access: -82,
  filter: 144,
  return: 71,
  effluent: 18,
  TMP: 63,
  filterDrop: 73,
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

function overlayButton(label: string) {
  return within(screen.getByRole('group', { name: 'Circuit overlay layers' })).getByRole('button', {
    name: label,
  })
}

describe('CRRT universal educational circuit', () => {
  it('renders one accessible schematic whose description is the live text equivalent', () => {
    renderCircuit()

    expect(
      screen.getByRole('img', { name: /^Universal CRRT circuit topology/i }),
    ).toBeInTheDocument()

    const textSummary = screen.getByText(/^Blood path only\./, { selector: 'p' })
    expect(textSummary).toHaveTextContent(/Blood leaves the patient through the access lumen/i)
    expect(textSummary).toHaveTextContent(/Blood re-enters the patient through the return lumen/i)
    expect(textSummary).toHaveTextContent(
      /Blood travels along the access line past the access pressure site/i,
    )

    const viewport = screen.getByRole('group', { name: /horizontally scrollable/i })
    expect(viewport).toHaveAttribute('tabindex', '0')
    const scrollBy = jest.fn()
    Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy })
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledWith({ left: 140, behavior: 'smooth' })
  })

  it('offers every required overlay as an operable toggle', () => {
    renderCircuit()

    const group = screen.getByRole('group', { name: 'Circuit overlay layers' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(
      crrtCircuitOverlays.map((overlay) => overlay.label),
    )
    expect(buttons).toHaveLength(9)
    expect(overlayButton('Blood path only')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(overlayButton('CVVHDF'))
    expect(overlayButton('CVVHDF')).toHaveAttribute('aria-pressed', 'true')
    expect(overlayButton('Blood path only')).toHaveAttribute('aria-pressed', 'false')
  })

  it('never answers to the localization lab’s control names', () => {
    // `practiceAssess.ui.test.tsx` mounts this circuit and
    // `CrrtPressureLocalizationLab` in one tree, then queries a radio named
    // "Access catheter" and groups named after the six pressure signals.
    renderCircuit()

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Access catheter' })).not.toBeInTheDocument()
    for (const signal of [
      'Access pressure',
      'Filter pressure',
      'Return pressure',
      'Effluent pressure',
      'TMP',
      'Filter pressure drop',
    ]) {
      expect(screen.queryByRole('group', { name: signal })).not.toBeInTheDocument()
    }
  })

  it('rewrites the text equivalent when the overlay changes, and keeps the circuit itself fixed', () => {
    const { container } = renderCircuit()

    const placementsFor = (): Record<string, string> =>
      Object.fromEntries(
        [...container.querySelectorAll('svg g[data-node]')].map((group) => [
          group.getAttribute('data-node') ?? '',
          group.getAttribute('transform') ?? '',
        ]),
      )
    const pathShapesFor = (): Record<string, string> =>
      Object.fromEntries(
        [...container.querySelectorAll('svg g[data-path] > path.tube')].map((path) => [
          path.parentElement?.getAttribute('data-path') ?? '',
          path.getAttribute('d') ?? '',
        ]),
      )

    // The canonical table is the reference, not the first render: whatever an
    // overlay draws must sit exactly where the model says it sits.
    const canonicalPlacement = Object.fromEntries(
      crrtCircuitNodes.map((node) => [node.id, `translate(${node.at.x} ${node.at.y})`]),
    )
    const canonicalShape = Object.fromEntries(crrtCircuitPaths.map((path) => [path.id, path.d]))

    expect(Object.keys(placementsFor()).length).toBeGreaterThan(0)
    // Every path is drawn in every view; only its active flag moves.
    expect(Object.keys(pathShapesFor())).toHaveLength(crrtCircuitPaths.length)

    for (const overlay of crrtCircuitOverlays) {
      fireEvent.click(overlayButton(overlay.label))
      expect(
        screen.getByText(crrtCircuitTextEquivalent(overlay.id), { selector: 'p' }),
      ).toBeInTheDocument()

      // Same components, same coordinates, same tubing — only the fluids changed.
      const placements = placementsFor()
      for (const [nodeId, transform] of Object.entries(placements)) {
        expect(transform).toBe(canonicalPlacement[nodeId])
      }
      expect(pathShapesFor()).toEqual(canonicalShape)

      // The two sampling domains are the only overlay-scoped components, and
      // they appear in exactly one view.
      const showsDomains = 'systemic-sampling-domain' in placements
      expect(showsDomains).toBe(overlay.showsSamplingDomains)
    }
  })

  it('separates the access and return lumens in the picture and in words', () => {
    const { container } = renderCircuit()

    const svgText = [...container.querySelectorAll('svg text')].map((node) => node.textContent)
    expect(svgText).toContain('ACCESS LUMEN')
    expect(svgText).toContain('RETURN LUMEN')
    expect(svgText).toContain('BLOOD OUT OF PATIENT')
    expect(svgText).toContain('BLOOD INTO PATIENT')
  })

  it('turns dialysate on only for the therapies that run it', () => {
    const { container } = renderCircuit()

    const pathActive = (pathId: string) =>
      container.querySelector(`svg g[data-path="${pathId}"]`)?.getAttribute('data-active')

    fireEvent.click(overlayButton('CVVHD'))
    expect(pathActive('dialysate-supply')).toBe('true')
    expect(pathActive('pre-filter-replacement')).toBe('false')
    expect(pathActive('post-filter-replacement')).toBe('false')

    fireEvent.click(overlayButton('CVVH · pre-filter replacement'))
    expect(pathActive('dialysate-supply')).toBe('false')
    expect(pathActive('pre-filter-replacement')).toBe('true')
    expect(pathActive('post-filter-replacement')).toBe('false')

    fireEvent.click(overlayButton('SCUF'))
    expect(pathActive('dialysate-supply')).toBe('false')
    expect(pathActive('pre-filter-replacement')).toBe('false')
    expect(pathActive('post-filter-replacement')).toBe('false')
    expect(pathActive('effluent-line')).toBe('true')

    fireEvent.click(overlayButton('CVVHDF'))
    expect(pathActive('dialysate-supply')).toBe('true')
    expect(pathActive('pre-filter-replacement')).toBe('true')
    expect(pathActive('post-filter-replacement')).toBe('true')

    fireEvent.click(overlayButton('Blood path only'))
    expect(pathActive('effluent-line')).toBe('false')
    expect(pathActive('access-lumen')).toBe('true')
    expect(pathActive('return-lumen')).toBe('true')
  })

  it('states which fluids reach the patient and which never do', () => {
    renderCircuit()

    fireEvent.click(overlayButton('CVVHD'))
    const dialysateOnly = screen.getByRole('heading', { name: 'Never enters the patient' })
      .parentElement as HTMLElement
    expect(within(dialysateOnly).getByText('Dialysate supply')).toBeInTheDocument()

    const entersPatient = screen.getByRole('heading', { name: 'Enters the patient' })
      .parentElement as HTMLElement
    expect(
      within(entersPatient).getByText('No added fluid enters the patient in this view.'),
    ).toBeInTheDocument()

    fireEvent.click(overlayButton('CVVH · post-filter replacement'))
    const nowEnters = screen.getByRole('heading', { name: 'Enters the patient' })
      .parentElement as HTMLElement
    expect(within(nowEnters).getByText('Post-filter replacement')).toBeInTheDocument()
  })

  it('follows the overlay with the four device scale positions', () => {
    renderCircuit()

    const scaleList = screen.getByRole('list', { name: 'CRRT scale positions' })
    const cards = within(scaleList).getAllByRole('listitem')
    expect(cards).toHaveLength(4)
    expect(within(cards[0]).getByText('Effluent')).toBeInTheDocument()
    expect(within(cards[0]).getByText('Yellow circle')).toBeInTheDocument()
    expect(within(cards[1]).getByText('PBP')).toBeInTheDocument()
    expect(within(cards[1]).getByText('White triangle')).toBeInTheDocument()
    expect(within(cards[2]).getByText('Dialysate')).toBeInTheDocument()
    expect(within(cards[2]).getByText('Green square')).toBeInTheDocument()
    expect(within(cards[3]).getByText('Replacement')).toBeInTheDocument()
    expect(within(cards[3]).getByText('Purple octagon')).toBeInTheDocument()

    fireEvent.click(overlayButton('CVVHD'))
    expect(within(cards[2]).getByText('Active in CVVHD')).toBeInTheDocument()
    expect(within(cards[3]).getByText('Inactive in CVVHD')).toBeInTheDocument()

    fireEvent.click(overlayButton('CVVH · post-filter replacement'))
    expect(
      within(cards[2]).getByText('Inactive in CVVH · post-filter replacement'),
    ).toBeInTheDocument()
    expect(
      within(cards[3]).getByText('Active in CVVH · post-filter replacement'),
    ).toBeInTheDocument()
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
    renderCircuit({ pressure: suppliedPressures })

    const pressureList = screen.getByRole('list', { name: 'Circuit pressure signals' })
    for (const value of ['-82', '144', '71', '18', '63', '73']) {
      expect(within(pressureList).getByText(`${value} mmHg`)).toBeInTheDocument()
    }
    expect(within(pressureList).queryByText(/normal|target|threshold/i)).not.toBeInTheDocument()
  })

  it('marks four pressures as directly modelled sites and two as calculated', () => {
    renderCircuit({ pressure: suppliedPressures })

    const pressureList = screen.getByRole('list', { name: 'Circuit pressure signals' })
    const nodes = within(pressureList).getAllByRole('listitem')
    expect(nodes).toHaveLength(6)

    const kinds = nodes.map((node) => node.getAttribute('data-kind'))
    expect(kinds).toEqual([
      'directly-modelled-site',
      'directly-modelled-site',
      'directly-modelled-site',
      'directly-modelled-site',
      'calculated-relationship',
      'calculated-relationship',
    ])
    expect(within(pressureList).getAllByText('Directly modelled site')).toHaveLength(4)
    expect(within(pressureList).getAllByText('Calculated relationship')).toHaveLength(2)
  })

  it('explains each pressure with a location, a cause list, and an escalation boundary', () => {
    const { container } = renderCircuit({ pressure: suppliedPressures })

    const tmp = container.querySelector('[data-signal="tmp"]') as HTMLElement
    expect(tmp).toHaveTextContent(/Nowhere\. TMP has no transducer of its own/i)
    // The offsets are read from the engine constants, so this copy cannot drift.
    expect(tmp).toHaveTextContent(String(PRISMAX_TMP_HYDROSTATIC_OFFSET_MMHG))
    expect(tmp).toHaveTextContent(/responsible clinical team and the local protocol/i)

    const drop = container.querySelector('[data-signal="filter-drop"]') as HTMLElement
    expect(drop).toHaveTextContent(String(PRISMAX_FILTER_DROP_HYDROSTATIC_OFFSET_MMHG))

    const access = container.querySelector('[data-signal="access"]') as HTMLElement
    expect(access).toHaveTextContent(/between the access lumen and the blood pump/i)
    expect(access).toHaveTextContent(/more negative even when nothing has changed anatomically/i)
    expect(access).toHaveTextContent(/responsible clinical team and the local protocol/i)
  })

  it('shows the worked conservation ledger when no live flows are supplied', () => {
    renderCircuit()

    const ledger = screen.getByRole('region', { name: 'Where every millilitre goes' })
    expect(ledger).toHaveTextContent(/Authored worked example/i)
    expect(within(ledger).getByText('2,100 mL/h')).toBeInTheDocument()
    expect(within(ledger).getByText('100 mL/h')).toBeInTheDocument()
    expect(within(ledger).getByText('1,100 mL/h')).toBeInTheDocument()
    expect(within(ledger).getByText('-100 mL/h')).toBeInTheDocument()
    expect(ledger).toHaveTextContent(/21 times/)
    expect(ledger).toHaveTextContent(/Effluent volume is not patient loss/i)
  })

  it('reports every conservation identity as balancing for the worked example', () => {
    renderCircuit()

    const checks = screen.getByRole('list', { name: 'Fluid conservation checks' })
    const items = within(checks).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    for (const item of items) {
      expect(item).toHaveAttribute('data-status', 'balanced')
    }
    expect(within(checks).queryByText(/Does not balance/)).not.toBeInTheDocument()
    expect(within(checks).queryByText(/Cannot be checked/)).not.toBeInTheDocument()
  })

  it('suppresses the ledger rather than balancing it when a makeup flow is running', () => {
    renderCircuit({
      flows: {
        bloodFlowMlMin: 150,
        dialysateFlowMlHour: 1_000,
        pbpFlowMlHour: 0,
        preReplacementFlowMlHour: 0,
        postReplacementFlowMlHour: 1_000,
        patientFluidRemovalMlHour: 100,
        syringeFlowMlHour: 0,
        makeupFlowMlHour: 40,
      },
    })

    const ledger = screen.getByRole('region', { name: 'Where every millilitre goes' })
    expect(ledger).toHaveTextContent(/Computed from the flows currently set on this circuit/i)
    expect(ledger).toHaveTextContent(/This ledger cannot be closed/i)
    expect(ledger).toHaveTextContent(/none of this volume is attributed to patient fluid loss/i)

    // The three dependent quantities are withheld, not printed.
    expect(within(ledger).getAllByText('Withheld')).toHaveLength(3)
    // No ratio headline may appear off a suppressed removal term.
    expect(ledger).not.toHaveTextContent(/times.*faster than the patient loses fluid/i)

    const checks = screen.getByRole('list', { name: 'Fluid conservation checks' })
    const items = within(checks).getAllByRole('listitem')
    expect(items.filter((item) => item.getAttribute('data-status') === 'balanced')).toHaveLength(0)
    expect(
      items.filter((item) => item.getAttribute('data-status') === 'unresolved').length,
    ).toBeGreaterThan(0)
    expect(within(checks).getAllByText('Cannot be checked').length).toBeGreaterThan(0)
  })

  it('introduces the citrate vocabulary only in the citrate view, each term cited', () => {
    renderCircuit()

    expect(
      screen.queryByRole('region', { name: 'Words this view introduces' }),
    ).not.toBeInTheDocument()

    fireEvent.click(overlayButton('Citrate and calcium path'))
    const terms = screen.getByRole('region', { name: 'Words this view introduces' })

    for (const term of crrtCitrateCalciumTerms) {
      expect(within(terms).getByText(term.term)).toBeInTheDocument()
    }

    /**
     * Every term states what it rests on — but "carries a citation" is not the contract, and it
     * used to be. All seven printed the same three clinical records, all three resolved, and none
     * of them said anything about citrate. A term now either names records that genuinely support
     * it, or declares a gap and names none.
     */
    const cited = [...terms.querySelectorAll('[data-evidence-ids]')]
    expect(cited).toHaveLength(crrtCitrateCalciumTerms.length)
    for (const [index, node] of cited.entries()) {
      const support = crrtCitrateCalciumTerms[index].claimSupport
      const ids = (node.getAttribute('data-evidence-ids') ?? '').trim()
      expect(node.getAttribute('data-required-topic')).toBe(support.requiredTopic)
      if (support.kind === 'registered-source-gap') {
        expect(ids).toBe('')
      } else {
        expect(ids.length).toBeGreaterThan(0)
      }
    }

    // The three clinical-context records are no longer presented as support for any definition.
    for (const id of ['REVIEW-CKRT-CORE-2025', 'TEXT-CRRT-NEYRA-2026', 'GUID-RRT-ICU-2026']) {
      expect(terms.innerHTML).not.toContain(id)
    }
    // A gap is stated in words, not only by a border colour.
    expect(within(terms).getAllByText('Awaiting a source').length).toBe(
      crrtCitrateCalciumTerms.filter((term) => term.claimSupport.kind === 'registered-source-gap')
        .length,
    )
    // Bounded: the definitions themselves carry no dose, ratio, target, or
    // timing instruction. Scoped to the term list so the panel's own disclaimer
    // — which names those words in order to disclaim them — is not the thing
    // under test.
    const definitions = terms.querySelector('dl')?.textContent ?? ''
    expect(definitions.length).toBeGreaterThan(0)
    expect(definitions).not.toMatch(/mmol|mg\/|\bratio\b|titrat|every \d|\bq\d|\btarget\b/i)
    expect(definitions).not.toMatch(/\d+(\.\d+)?\s*(mL|mmol|mg|%)/i)
  })

  it('communicates running and readiness states with visible text', () => {
    renderCircuit({
      running: true,
      setReady: true,
      fluidsReady: true,
      bloodFlowMlMin: 180,
      dialysateFlowMlHour: 1_200,
      patientFluidRemovalMlHour: 75,
      pressure: suppliedPressures,
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

  it('names every line pattern in words as well as colour', () => {
    renderCircuit()

    const legend = screen.getByLabelText('Line pattern legend')
    for (const label of [
      'Blood',
      'Dialysate',
      'Replacement fluid',
      'Pre-blood-pump fluid and citrate',
      'Effluent',
      'Calcium replacement',
    ]) {
      expect(within(legend).getByText(label)).toBeInTheDocument()
    }
    expect(within(legend).getByText('solid heavy line')).toBeInTheDocument()
    expect(within(legend).getByText('long dashes')).toBeInTheDocument()
  })

  it('introduces no universal target language anywhere it renders', () => {
    const { container } = renderCircuit({ pressure: suppliedPressures })

    for (const overlay of crrtCircuitOverlays) {
      fireEvent.click(overlayButton(overlay.label))
      assertNoUniversalTargetLanguage(container.textContent ?? '')
    }
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
    expect(css).toContain('@media (forced-colors: active)')
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
