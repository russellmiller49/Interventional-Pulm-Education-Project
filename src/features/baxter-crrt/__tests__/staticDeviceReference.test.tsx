/**
 * The static drawing used to open the machine surface, carried a badge that
 * tracked the run, and was the only device representation a learner met. These
 * tests hold the new arrangement: the live model leads, and the drawing is a
 * clearly-labelled reference that admits it is not wired to anything.
 */
import { render, screen, within } from '@testing-library/react'

import { PrismaxPilotInterface } from '../components/PrismaxPilotInterface'
import {
  prismaxSimulatorArtwork,
  prismaxSimulatorHotspots,
  prismaxStaticReferenceNotice,
} from '../content/prismaxSimulator'
import {
  createInitialPrismaxPilotInterfaceState,
  prismaxPilotInterfaceReducer,
  selectPrismaxPilotCaseOperationsDisplay,
  type PrismaxPilotInterfaceAction,
  type PrismaxPilotInterfaceState,
} from '../engine/deviceAdapters/prismax'
import { runningState } from '../engine/testSupport/livePressureStates'

const interfaceState = createInitialPrismaxPilotInterfaceState()

function reduce(
  state: PrismaxPilotInterfaceState,
  ...actions: readonly PrismaxPilotInterfaceAction[]
): PrismaxPilotInterfaceState {
  return actions.reduce(prismaxPilotInterfaceReducer, state)
}

/** Drives the pilot reducer all the way to the Operations screen. */
function operationsInterfaceState(): PrismaxPilotInterfaceState {
  return reduce(
    createInitialPrismaxPilotInterfaceState(),
    { type: 'SELECT_NEW_PATIENT' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'patient' },
    { type: 'SELECT_CVVHD' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'therapy' },
    { type: 'SET_PRESCRIPTION_VALUE', field: 'bloodFlowMlMin', value: 120 },
    { type: 'SET_PRESCRIPTION_VALUE', field: 'dialysateFlowMlHour', value: 1_500 },
    { type: 'SET_PRESCRIPTION_VALUE', field: 'patientFluidRemovalMlHour', value: 250 },
    { type: 'COMMIT_PRESCRIPTION' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'prescription' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'sets' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'fluids' },
    { type: 'START_PRIME' },
    { type: 'COMPLETE_PRIME' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'prime' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'review' },
    { type: 'COMPLETE_SETUP_STEP', stepId: 'connect-patient' },
    { type: 'START_TREATMENT' },
  )
}

function renderMachineSurface(state: PrismaxPilotInterfaceState = interfaceState) {
  return render(
    <PrismaxPilotInterface
      state={state}
      dispatch={() => {}}
      operationsDisplay={selectPrismaxPilotCaseOperationsDisplay(state, runningState())}
    />,
  )
}

describe('static device reference', () => {
  it('puts the live pressure profile ahead of the static drawing', () => {
    const { container } = renderMachineSurface()
    const html = container.innerHTML
    const liveIndex = html.indexOf('Live educational pressure profile')
    const staticIndex = html.indexOf(prismaxStaticReferenceNotice.title)
    expect(liveIndex).toBeGreaterThanOrEqual(0)
    expect(staticIndex).toBeGreaterThan(liveIndex)
  })

  it('keeps the drawing closed behind a disclosure rather than showing it first', () => {
    const { container } = renderMachineSurface()
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details!.hasAttribute('open')).toBe(false)
    expect(details!.querySelector('img')).not.toBeNull()
    expect(
      within(details as HTMLElement).getByText(prismaxStaticReferenceNotice.title),
    ).toBeInTheDocument()
  })

  it('states that the drawing is not synchronised with the simulation', () => {
    renderMachineSurface()
    expect(screen.getByText(prismaxStaticReferenceNotice.unsynchronisedNotice)).toBeInTheDocument()
    expect(prismaxStaticReferenceNotice.unsynchronisedNotice).toMatch(
      /not connected to the simulation/i,
    )
    expect(prismaxStaticReferenceNotice.unsynchronisedNotice).toMatch(/nothing on it updates/i)
  })

  it('shows no live-looking state badge on a fixed drawing', () => {
    const { container } = renderMachineSurface()
    const details = container.querySelector('details')!
    expect(details.textContent).not.toMatch(
      /Simulated treatment active|Operations paused|Run ended/,
    )
  })

  it('keeps the image reachable, described, and keyboard-operable', () => {
    const { container } = renderMachineSurface()
    const details = container.querySelector('details')!
    expect(details.querySelector('img')).toHaveAttribute('alt', prismaxSimulatorArtwork.alt)
    expect(details.querySelector('summary')).not.toBeNull()
    const regions = within(details).getByRole('group', { name: 'CRRT machine regions' })
    expect(within(regions).getAllByRole('button')).toHaveLength(prismaxSimulatorHotspots.length)
  })
})

describe('static hotspot content', () => {
  it('keeps only hardware-orientation regions', () => {
    expect(prismaxSimulatorHotspots.map((hotspot) => hotspot.id)).toEqual([
      'solution-pumps',
      'syringe-pump',
      'safety-monitoring',
      'fluid-management',
    ])
    expect(prismaxSimulatorHotspots.map((hotspot) => hotspot.ordinal)).toEqual([1, 2, 3, 4])
  })

  it('drops the region that pointed at the surface below it', () => {
    const text = prismaxSimulatorHotspots.map((hotspot) => hotspot.description).join(' ')
    expect(text).not.toMatch(/the interactive screen below/i)
    expect(text).not.toMatch(/manufacturer-manual setup sequence/i)
  })

  it('does not explain a pressure a second time', () => {
    const safety = prismaxSimulatorHotspots.find((hotspot) => hotspot.id === 'safety-monitoring')!
    expect(safety.description).toMatch(/is on the live pressure profile — it is not repeated here/i)
    // It says where things sit; it does not re-teach what a reading means.
    expect(safety.description).not.toMatch(/more negative|resistance|arithmetic/i)
  })

  it('preserves the transferable orientation teaching', () => {
    const text = prismaxSimulatorHotspots.map((hotspot) => hotspot.description).join(' ')
    expect(text).toMatch(/Four pump positions/)
    expect(text).toMatch(/Medication and anticoagulation workflows remain outside/)
    expect(text).toMatch(/pressure connections, air monitoring, and return-line clamp/)
    expect(text).toMatch(/Four separated scale positions/)
  })

  it('promotes no threshold, alarm, or operating sequence', () => {
    const text = [
      ...prismaxSimulatorHotspots.map((hotspot) => hotspot.description),
      prismaxStaticReferenceNotice.fidelityBoundary,
      prismaxStaticReferenceNotice.unsynchronisedNotice,
    ].join(' ')
    expect(text).not.toMatch(/\bmmHg\b|\bthreshold of\b|\bset the\b|\bpress \b/i)
    expect(prismaxStaticReferenceNotice.fidelityBoundary).toMatch(
      /belong to the manufacturer’s instructions and your local training/i,
    )
  })
})

describe('console pressure readout', () => {
  it('no longer gives a measured site and an arithmetic relationship the same caption', () => {
    renderMachineSurface(operationsInterfaceState())
    const list = screen.getByRole('list', { name: 'Simulated pressure signals' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(6)
    expect(
      items.filter((item) => item.getAttribute('data-kind') === 'directly-modelled-site'),
    ).toHaveLength(4)
    expect(
      items.filter((item) => item.getAttribute('data-kind') === 'calculated-relationship'),
    ).toHaveLength(2)
    expect(list.textContent).not.toMatch(/Simulated case value/)
  })

  it('agrees with the live profile it sits beside, because both read one view', () => {
    const state = operationsInterfaceState()
    const operations = selectPrismaxPilotCaseOperationsDisplay(state, runningState())
    renderMachineSurface(state)
    const list = screen.getByRole('list', { name: 'Simulated pressure signals' })
    for (const signal of operations.pressureSignals) {
      expect(list.textContent).toContain(`${signal.valueMmHg!.toFixed(0)} mmHg`)
    }
  })
})
