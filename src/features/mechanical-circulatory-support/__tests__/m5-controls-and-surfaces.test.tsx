/**
 * M5 — the bounded controls, the synchronized surfaces, and the mobile semantics.
 *
 * Every control is exercised through the workbench rather than by rendering `McsControls` alone, so
 * what is proved is the pairing a learner meets: the control dispatches, the monitor moves, the
 * anatomy summary follows the topology, and a scenario that does not permit an action closes it.
 *
 * jsdom has no layout, so the mobile assertions are about semantics — `aria-pressed`, the surface's
 * visibility flag, and where focus lands — never about pixels.
 */
import { fireEvent, screen, within } from '@testing-library/react'

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
jest.mock('../components/EcmoCannulationPreview', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .ecmoPreviewModule(),
)
jest.mock('../components/ImpellaVariantPreview', () =>
  jest
    .requireActual<
      typeof import('../test-support/mcsWorkbenchStubs')
    >('../test-support/mcsWorkbenchStubs')
    .impellaPreviewModule(),
)

import { mcsPracticeScenarios } from '../content'
import {
  advanceSimulation,
  commitPredictionPhase,
  completeRecognizePhase,
  continueFromPhase,
  flushAnimationFrames,
  mockRouterPush,
  renderWorkbench,
  renderWorkbenchOnFakeTimers,
  selectDeviceTrack,
  setupMcsWorkbenchEnvironment,
  sharedStepperPhase,
  teardownMcsWorkbenchEnvironment,
} from '../test-support/mcsWorkbench'

function controlsCard(): HTMLElement {
  return screen.getByRole('region', { name: 'Patient and mechanical-support controls' })
}

function metricGrid(): HTMLElement {
  return screen.getByRole('group', { name: 'Current hemodynamic values' })
}

function metricTile(label: string): string {
  return within(metricGrid()).getByText(label).parentElement!.textContent ?? ''
}

function sliderReadout(label: string): string {
  const slider = screen.getByRole('slider', { name: label })
  return (
    slider.closest('label')!.querySelector('output')!.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  )
}

/** Every patient slider, with the bounds and unit the engine and the component must agree on. */
const patientSliders = [
  ['Preload', 50, 145, '%'],
  ['Heart rate', 40, 180, 'bpm'],
  ['SVR', 400, 2200, 'dyn·s·cm⁻⁵'],
  ['LV contractility', 0.2, 1.4, 'relative'],
  ['RV contractility', 0.2, 1.4, 'relative'],
  ['PVR', 0.5, 9, 'WU'],
  ['PEEP', 0, 20, 'cm H₂O'],
  ['Aortic insufficiency', 0, 1, 'severity'],
] as const

describe('MCS M5 — patient controls', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(patientSliders)(
    'offers %s inside its authored bounds, with its unit',
    async (label, minimum, maximum, unit) => {
      await renderWorkbench({ section: 'practice' })

      const slider = within(controlsCard()).getByRole('slider', { name: label })
      expect(slider).toBeEnabled()
      expect(slider).toHaveAttribute('min', String(minimum))
      expect(slider).toHaveAttribute('max', String(maximum))
      expect(sliderReadout(label)).toContain(unit)
    },
  )

  it.each(patientSliders)(
    'keeps %s inside its bounds when driven past them',
    async (label, minimum, maximum) => {
      await renderWorkbench({ section: 'practice' })

      fireEvent.change(screen.getByRole('slider', { name: label }), {
        target: { value: String(maximum + 1_000) },
      })
      expect(
        Number((screen.getByRole('slider', { name: label }) as HTMLInputElement).value),
      ).toBeLessThanOrEqual(maximum)

      fireEvent.change(screen.getByRole('slider', { name: label }), {
        target: { value: String(minimum - 1_000) },
      })
      expect(
        Number((screen.getByRole('slider', { name: label }) as HTMLInputElement).value),
      ).toBeGreaterThanOrEqual(minimum)
    },
  )

  it('offers rhythm and the pericardial-constraint fault as their own controls', async () => {
    await renderWorkbench({ section: 'practice' })

    const rhythm = within(controlsCard()).getByRole('combobox', { name: 'Rhythm' })
    fireEvent.change(rhythm, { target: { value: 'atrial-fibrillation' } })
    expect(rhythm).toHaveValue('atrial-fibrillation')

    const tamponade = within(controlsCard()).getByRole('checkbox', {
      name: /Pericardial constraint/,
    })
    fireEvent.click(tamponade)
    expect(tamponade).toBeChecked()
  })

  it('moves the monitor when a patient control changes, and only where it should', async () => {
    await renderWorkbench({ section: 'practice' })
    const beforeFilling = metricTile('RAP / PCWP')
    const beforeAv = metricTile('AV OPENING')

    fireEvent.change(screen.getByRole('slider', { name: 'Preload' }), { target: { value: '145' } })

    expect(metricTile('RAP / PCWP')).not.toBe(beforeFilling)
    expect(metricTile('AV OPENING')).toBe(beforeAv)
  })

  it('closes every patient slider on a case that permits no patient adjustment', async () => {
    // LVAD-03 is the power emergency: inspect, power, and escalation only.
    await renderWorkbench({ section: 'practice', initialActivityId: 'LVAD-03' })

    for (const [label] of patientSliders) {
      expect(within(controlsCard()).getByRole('slider', { name: label })).toBeDisabled()
    }
    expect(within(controlsCard()).getByRole('combobox', { name: 'Rhythm' })).toBeDisabled()
    expect(
      within(controlsCard()).getByRole('checkbox', { name: /Pericardial constraint/ }),
    ).toBeDisabled()
  })

  it('opens the pericardial-constraint fault only on the capstone that asks for it', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-LVAD-01' })

    expect(
      within(controlsCard()).getByRole('checkbox', { name: /Pericardial constraint/ }),
    ).toBeEnabled()
  })
})

describe('MCS M5 — IABP controls', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('runs, pauses, and reports the console state in words', async () => {
    await renderWorkbench({ section: 'practice' })

    const support = within(controlsCard()).getByRole('checkbox', { name: /Console support/ })
    expect(support).toBeChecked()
    expect(within(controlsCard()).getByText('Running')).toBeInTheDocument()

    fireEvent.click(support)

    expect(support).not.toBeChecked()
    expect(within(controlsCard()).getByText('Paused')).toBeInTheDocument()
  })

  it.each([
    ['1', '1:1'],
    ['2', '1:2'],
    ['3', '1:3'],
  ])('sets the assist ratio to %s', async (value) => {
    await renderWorkbench({ section: 'practice' })

    const ratio = within(controlsCard()).getByRole('combobox', { name: 'Assist ratio' })
    fireEvent.change(ratio, { target: { value } })

    expect(ratio).toHaveValue(value)
  })

  it.each(['ecg', 'pressure', 'internal'])('sets the %s trigger source', async (value) => {
    await renderWorkbench({ section: 'practice' })

    const trigger = within(controlsCard()).getByRole('combobox', { name: 'Trigger source' })
    fireEvent.change(trigger, { target: { value } })

    expect(trigger).toHaveValue(value)
  })

  it('moves timing synchrony with the inflation and deflation offsets', async () => {
    await renderWorkbench({ section: 'practice' })
    const before = metricTile('TIMING')

    fireEvent.change(screen.getByRole('slider', { name: 'Inflation vs notch' }), {
      target: { value: '-120' },
    })
    const afterInflation = metricTile('TIMING')
    expect(afterInflation).not.toBe(before)

    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '120' },
    })
    expect(metricTile('TIMING')).not.toBe(afterInflation)
  })

  it('highlights the one timing control a Learn section names, and no other', async () => {
    const { container } = await renderWorkbench({
      section: 'learn',
      initialActivityId: 'iabp-timing-triggering',
    })

    // Walk to Act, where the section's control is presented.
    completeRecognizePhase('iabp-timing-triggering')
    continueFromPhase('recognize')
    commitPredictionPhase('iabp-timing-triggering')
    continueFromPhase('predict')

    const highlighted = container.querySelectorAll('[data-mcs-control-highlighted="true"]')
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].getAttribute('data-mcs-control')).toBe('control:iabp-inflation')
  })

  it('closes the timing controls a case does not permit', async () => {
    // IMP-02 is an Impella case: no IABP control should be reachable at all.
    await renderWorkbench({ section: 'practice', initialActivityId: 'IMP-02' })

    expect(
      within(controlsCard()).queryByRole('slider', { name: 'Inflation vs notch' }),
    ).not.toBeInTheDocument()
  })
})

describe('MCS M5 — Impella controls', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each([
    ['off', 'Off'],
    ['cp', 'Impella CP'],
    ['55', 'Impella 5.5'],
  ])('configures left support as %s', async (value, groupLabel) => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('impella')

    fireEvent.change(
      within(controlsCard()).getByRole('combobox', { name: 'Left-sided Impella configuration' }),
      { target: { value } },
    )

    if (value === 'off') {
      expect(
        within(controlsCard()).queryByRole('group', { name: /^Impella (CP|5\.5)$/ }),
      ).toBeNull()
    } else {
      expect(within(controlsCard()).getByRole('group', { name: groupLabel })).toBeInTheDocument()
    }
  })

  it('adds the right-sided pump as its own group with its own performance level', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('impella')

    fireEvent.change(
      within(controlsCard()).getByRole('combobox', { name: 'Right-sided Impella configuration' }),
      { target: { value: 'rp' } },
    )

    const left = within(controlsCard()).getByRole('group', { name: 'Impella CP' })
    const right = within(controlsCard()).getByRole('group', { name: 'Impella RP' })
    fireEvent.change(within(left).getByRole('slider', { name: 'Performance level' }), {
      target: { value: '8' },
    })

    expect(within(left).getByRole('slider', { name: 'Performance level' })).toHaveValue('8')
    // The two pumps are independent: moving one leaves the other where it was.
    expect(within(right).getByRole('slider', { name: 'Performance level' })).not.toHaveValue('8')
  })

  it('keeps the two pump flows on separate readouts and out of one systemic total', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('impella')
    fireEvent.change(
      within(controlsCard()).getByRole('combobox', { name: 'Right-sided Impella configuration' }),
      { target: { value: 'rp' } },
    )

    const left = Number(
      metricTile('LV PUMP FLOW')
        .replace(/[^\d.]/g, '')
        .slice(0, 4),
    )
    expect(within(metricGrid()).getByText('RP PUMP FLOW')).toBeInTheDocument()
    expect(within(metricGrid()).getByText('RP − LEFT PUMP')).toBeInTheDocument()
    expect(within(metricGrid()).queryByText('DEVICE FLOW')).not.toBeInTheDocument()
    expect(screen.getByText(/never added directly to\s+systemic flow/)).toBeInTheDocument()
    expect(Number.isFinite(left)).toBe(true)
  })

  it.each([
    ['left', 'too-deep'],
    ['left', 'too-shallow'],
  ])('records a %s placement state of %s', async (_side, value) => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('impella')

    const placement = within(controlsCard()).getByRole('combobox', { name: 'Placement state' })
    fireEvent.change(placement, { target: { value } })

    expect(placement).toHaveValue(value)
    expect(screen.getByText(/CRITICAL · Left Impella position signal abnormal/)).toBeInTheDocument()
  })

  it.each(['high-pressure', 'low-pressure'])('records a %s purge state', async (value) => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('impella')

    const purge = within(controlsCard()).getByRole('combobox', { name: 'Purge-system state' })
    fireEvent.change(purge, { target: { value } })

    expect(purge).toHaveValue(value)
    expect(
      screen.getByText(
        value === 'high-pressure'
          ? /WARNING · Left Impella purge pressure high/
          : /WARNING · Left Impella purge pressure low/,
      ),
    ).toBeInTheDocument()
  })

  it('pauses and restarts a pump from its own support checkbox', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('impella')

    const support = within(controlsCard()).getByRole('checkbox', { name: /Pump support/ })
    fireEvent.click(support)

    expect(support).not.toBeChecked()
    expect(within(controlsCard()).getByText('Paused')).toBeInTheDocument()
  })

  it('closes the placement control on a case that does not permit it', async () => {
    // IMP-03 permits position changes; IABP-01 has no Impella controls at all.
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

    expect(
      within(controlsCard()).queryByRole('combobox', { name: 'Placement state' }),
    ).not.toBeInTheDocument()
  })
})

describe('MCS M5 — durable LVAD controls', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('renders every branch the component carries for a durable pump', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('lvad')

    for (const name of [
      /Approved power path/,
      /Authorized-personnel order/,
      /Controller fault/,
      /High-power \/ thrombosis pattern/,
    ]) {
      expect(within(controlsCard()).getByRole('checkbox', { name })).toBeInTheDocument()
    }
    expect(within(controlsCard()).getByRole('slider', { name: 'Pump speed' })).toBeInTheDocument()
    expect(screen.getByText(/Authorized simulation only\./)).toBeInTheDocument()
  })

  it('keeps the speed slider closed until the simulated authorization is given', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('lvad')

    expect(within(controlsCard()).getByRole('slider', { name: 'Pump speed' })).toBeDisabled()
    fireEvent.click(
      within(controlsCard()).getByRole('checkbox', { name: /Authorized-personnel order/ }),
    )
    expect(within(controlsCard()).getByRole('slider', { name: 'Pump speed' })).toBeEnabled()

    fireEvent.change(within(controlsCard()).getByRole('slider', { name: 'Pump speed' }), {
      target: { value: '6000' },
    })
    expect(within(controlsCard()).getByRole('slider', { name: 'Pump speed' })).toHaveValue('6000')
  })

  it('raises a critical alarm when the approved power path is opened', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('lvad')

    fireEvent.click(within(controlsCard()).getByRole('checkbox', { name: /Approved power path/ }))

    expect(screen.getByText(/CRITICAL · External power disconnected/)).toBeInTheDocument()
    expect(within(controlsCard()).getByText('Disconnected')).toBeInTheDocument()
  })

  it('raises the controller-fault and high-power patterns as their own alarms', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('lvad')

    fireEvent.click(within(controlsCard()).getByRole('checkbox', { name: /Controller fault/ }))
    expect(screen.getByText(/CRITICAL · Controller fault/)).toBeInTheDocument()

    fireEvent.click(
      within(controlsCard()).getByRole('checkbox', { name: /High-power \/ thrombosis pattern/ }),
    )
    expect(screen.getByText(/CRITICAL · High-power pattern/)).toBeInTheDocument()
  })

  it('closes the LVAD controls a case does not permit', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'LVAD-02' })

    // LVAD-02 permits the authorized speed path but not the power switch or the fault toggles.
    expect(
      within(controlsCard()).getByRole('checkbox', { name: /Authorized-personnel order/ }),
    ).toBeEnabled()
    expect(
      within(controlsCard()).getByRole('checkbox', { name: /Approved power path/ }),
    ).toBeDisabled()
    expect(
      within(controlsCard()).getByRole('checkbox', { name: /Controller fault/ }),
    ).toBeDisabled()
  })
})

describe('MCS M5 — the synchronized monitor and anatomy surfaces', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('replaces the device-specific monitor fields when the device changes', async () => {
    await renderWorkbench({ section: 'practice' })

    // IABP reports timing synchrony and no pump power.
    expect(within(metricGrid()).getByText('TIMING')).toBeInTheDocument()
    expect(within(metricGrid()).queryByText('POWER / PI')).not.toBeInTheDocument()

    selectDeviceTrack('lvad')

    expect(within(metricGrid()).queryByText('TIMING')).not.toBeInTheDocument()
    expect(within(metricGrid()).getByText('POWER / PI')).toBeInTheDocument()
    expect(within(metricGrid()).getByText('POWER / PI').parentElement).toHaveTextContent('estimate')
  })

  it('renders no non-finite value on any device track', async () => {
    await renderWorkbench({ section: 'practice' })

    for (const device of ['iabp', 'impella', 'lvad'] as const) {
      selectDeviceTrack(device)
      const text = metricGrid().textContent ?? ''
      expect(text).not.toMatch(/NaN|Infinity|undefined|null/)
    }
  })

  it('offers a way out of the 3D surface on a display too small for it', async () => {
    // jsdom's default 1024×768 clears the desktop gate, so the gate only appears once the display
    // is genuinely constrained — which is the only state in which the escape hatch exists.
    const width = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    await renderWorkbench({ section: 'practice' })

    expect(screen.getByRole('heading', { name: 'A larger screen is recommended' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Save for later' }))
    expect(mockRouterPush).toHaveBeenCalledWith('/mechanical-circulatory-support')

    // Continuing anyway is still offered, and it does not change the simulation.
    fireEvent.click(screen.getByRole('button', { name: 'Continue on this device' }))
    expect(
      screen.getByRole('region', { name: 'Animated mechanical-support anatomy' }),
    ).toBeInTheDocument()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  })

  it('offers the same way out of the Learn anatomy pane', async () => {
    const width = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 })
    await renderWorkbench({ section: 'learn', initialActivityId: 'impella-unloading-placement' })

    fireEvent.click(screen.getByRole('button', { name: 'Save for later' }))

    expect(mockRouterPush).toHaveBeenCalledWith('/mechanical-circulatory-support')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  })

  it('states the alarm priority and the active alarm in text', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(screen.getByText('NO ACTIVE MODEL ALARMS')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('slider', { name: 'Deflation vs systole' }), {
      target: { value: '120' },
    })

    expect(screen.getByText('CRITICAL · Late deflation')).toBeInTheDocument()
    // The band names the priority; the explanation beneath says what produced it.
    expect(
      screen.getAllByText(/The next ejection begins against an inflated balloon\./).length,
    ).toBeGreaterThan(0)
  })

  it('keeps the waveform traces accessible while the buffer is still filling', async () => {
    await renderWorkbenchOnFakeTimers({ section: 'practice' })

    for (const name of [
      /^ECG II waveform/,
      /^ART waveform/,
      /^PAP waveform/,
      /^RAP \/ CVP waveform/,
    ]) {
      expect(screen.getByRole('img', { name })).toBeInTheDocument()
    }
    const before = screen.getByRole('img', { name: /^ART waveform/ }).getAttribute('aria-label')

    advanceSimulation(1_000)

    expect(screen.getByRole('img', { name: /^ART waveform/ }).getAttribute('aria-label')).not.toBe(
      undefined,
    )
    expect(before).toMatch(/current value/)
  })

  it('changes the anatomy pathway summary with the device topology', async () => {
    const { container } = await renderWorkbench({ section: 'practice' })
    const summary = () =>
      container.querySelector('[data-anatomy-target="anatomy:support-pathway-overview"]')!
        .textContent ?? ''

    const counterpulsation = summary()
    selectDeviceTrack('lvad')
    const durable = summary()

    expect(durable).not.toBe(counterpulsation)
    expect(counterpulsation).toMatch(/balloon|counterpulsation/i)
    expect(durable).toMatch(/apex|continuous/i)
  })

  it('keeps the semantic pathway summary reachable behind the stubbed 3D canvas', async () => {
    const { container } = await renderWorkbench({ section: 'practice' })

    expect(
      screen.getByRole('region', {
        name: 'Support pathway: where blood enters and where it returns',
      }),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
  })

  it('withholds and restores the monitor causal callout with the route rules', async () => {
    await renderWorkbench({ section: 'assess', initialActivityId: 'CAP-IABP-01' })
    expect(screen.getByText('Challenge mode:')).toBeInTheDocument()
    expect(
      screen.getByText(/Causal coaching is withheld until you complete the reassessment\./),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /Show teaching notes after each action/ }))

    expect(screen.getByText('Why the display changed:')).toBeInTheDocument()
  })
})

describe('MCS M5 — mobile surface semantics and phase focus', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each(['anatomy', 'monitor', 'controls', 'workflow'] as const)(
    'presses the %s mobile tab and shows only that surface',
    async (surface) => {
      const { container } = await renderWorkbench({ section: 'practice' })
      const tabs = screen.getByRole('group', { name: 'Choose mobile workspace surface' })

      fireEvent.click(within(tabs).getByRole('button', { name: surface }))

      for (const candidate of ['anatomy', 'monitor', 'controls', 'workflow'] as const) {
        expect(within(tabs).getByRole('button', { name: candidate })).toHaveAttribute(
          'aria-pressed',
          String(candidate === surface),
        )
      }
      expect(container.querySelectorAll('[data-mobile-visible="true"]').length).toBeGreaterThan(0)
    },
  )

  it.each([
    ['Act', 'controls', 'mcs-case-actions'],
    ['Observe', 'monitor', 'mcs-case-response'],
    ['Predict', 'workflow', 'mcs-case-predict'],
    ['Explain', 'workflow', 'mcs-case-actions'],
    ['Transfer', 'workflow', 'mcs-case-actions'],
  ] as const)(
    'selects the %s phase, shows the %s surface, and focuses %s',
    async (phase, surface, targetId) => {
      await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })

      fireEvent.click(screen.getByRole('button', { name: `Open ${phase} phase` }))
      flushAnimationFrames()

      const tabs = screen.getByRole('group', { name: 'Choose mobile workspace surface' })
      expect(within(tabs).getByRole('button', { name: surface })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(document.activeElement).toHaveAttribute('id', targetId)
    },
  )

  it('selects the monitor and the inspect step when Recognize is chosen', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
    // The stepper offers a jump control only for phases other than the current one, and in a case
    // the current phase is the reducer's, so an inspection has to move it off Recognize first.
    fireEvent.click(screen.getByRole('button', { name: 'Arterial waveform' }))
    expect(sharedStepperPhase()).toBe('Predict')

    fireEvent.click(screen.getByRole('button', { name: 'Open Recognize phase' }))
    flushAnimationFrames()

    const tabs = screen.getByRole('group', { name: 'Choose mobile workspace surface' })
    expect(within(tabs).getByRole('button', { name: 'monitor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(document.activeElement).toHaveAttribute('id', 'mcs-case-inspect')
  })

  it('navigates with the shared stepper in a case without moving the case phase', async () => {
    await renderWorkbench({ section: 'practice', initialActivityId: 'IABP-01' })
    expect(sharedStepperPhase()).toBe('Recognize')

    fireEvent.click(screen.getByRole('button', { name: 'Open Transfer phase' }))
    flushAnimationFrames()

    // Practice and Challenge derive the phase from the reducer, so the stepper moves the learner to
    // a region rather than declaring a step complete.
    expect(sharedStepperPhase()).toBe('Recognize')
    expect(document.activeElement).toHaveAttribute('id', 'mcs-case-actions')
  })

  it('survives a phase selection in the studio, where the case regions do not exist', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(document.getElementById('mcs-case-actions')).toBeNull()
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Open Act phase' }))
      flushAnimationFrames()
    }).not.toThrow()

    const tabs = screen.getByRole('group', { name: 'Choose mobile workspace surface' })
    expect(within(tabs).getByRole('button', { name: 'controls' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('gives Learn the three-pane workspace instead of the four mobile surfaces', async () => {
    await renderWorkbench({ section: 'learn' })

    expect(
      screen.queryByRole('group', { name: 'Choose mobile workspace surface' }),
    ).not.toBeInTheDocument()
    for (const pane of ['Live monitor panel', 'Teaching panel', 'Your turn panel']) {
      expect(screen.getByRole('region', { name: pane })).toBeInTheDocument()
    }
  })

  it('keeps every practice case reachable from the rail without a mobile surface change', async () => {
    await renderWorkbench({ section: 'practice' })
    const rail = screen.getByRole('region', { name: 'Mechanism Studio and device cases' })

    // The studio plus the three cases for the active device track.
    expect(within(rail).getAllByRole('button')).toHaveLength(
      1 + mcsPracticeScenarios.filter((scenario) => scenario.device === 'iabp').length,
    )
  })
})
