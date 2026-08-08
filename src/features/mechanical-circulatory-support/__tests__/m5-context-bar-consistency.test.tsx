/**
 * M5 — the cross-surface audit of the patient-context bar.
 *
 * M4 corrected the teaching panels. The bar above them was never part of that package, and it still
 * carried the claims M4 removed: a shock phenotype produced by unsourced cut points, a counterpulsation
 * device flow printed as `0.0 L/min` on a mechanism the module says reports no device flow at all, and
 * a mixed venous saturation and cardiac power output labelled "Perfusion" — three surfaces
 * disagreeing about the same patient, with the confident one on top.
 *
 * These tests are the demonstration, and they were written to fail against the workbench as it stood.
 * Each one names the accepted M0–M4 contract it is holding the bar to.
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

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { mcsDerivedValueGuides } from '../content'
import {
  MCS_CONGESTION_PATTERN_BOUNDARY,
  mcsCongestionProfileDefinition,
  mcsCongestionProfileId,
} from '../content/congestionProfile'
import {
  patientContextLabels,
  patientContextSafetyConstraints,
  patientContextValue,
  patientContextValues,
  renderWorkbench,
  selectDeviceTrack,
  setupMcsWorkbenchEnvironment,
  teardownMcsWorkbenchEnvironment,
} from '../test-support/mcsWorkbench'

const CONGESTION_LABEL = 'Filling-pressure congestion pattern'
const FLOW_LABEL = 'Native / device / effective flow'
const BALANCE_LABEL = 'Modeled balance and pressure–flow summary'

/**
 * The monitor's flow account: the native, device and effective tiles, as one block of text.
 *
 * Scoped by the authored target rather than by position, so the assertions are about the region a
 * Learn section can point at rather than about which tile happens to be third.
 */
function monitorFlowAccountText(container: HTMLElement): string {
  const tiles = [...container.querySelectorAll('[data-monitor-target="monitor:flow-account"]')]
  expect(tiles.length).toBeGreaterThan(0)
  return tiles.map((tile) => tile.textContent ?? '').join(' | ')
}

/** Reads the filling pressures the monitor is showing, so the expectation comes from the screen. */
function displayedFillingPressures(): { rapMmHg: number; pcwpMmHg: number } {
  const tile = within(screen.getByRole('group', { name: 'Current hemodynamic values' })).getByText(
    'RAP / PCWP',
  ).parentElement!
  const [rap, pcwp] = (tile.querySelector('strong')?.textContent ?? '').split('/').map(Number)
  return { rapMmHg: rap, pcwpMmHg: pcwp }
}

describe('MCS M5 — the patient-context bar carries no unsourced shock phenotype', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('offers no item that names a shock phenotype', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(patientContextLabels()).not.toContain('Shock phenotype')
    for (const label of patientContextLabels()) {
      expect(label).not.toMatch(/phenotype/i)
    }
  })

  it('states no ventricular shock mechanism as a value', async () => {
    await renderWorkbench({ section: 'practice' })

    for (const value of patientContextValues()) {
      expect(value).not.toMatch(/LV-dominant shock|RV-dominant shock|Biventricular \/ mixed shock/)
      expect(value).not.toMatch(/Supported low-output physiology/)
    }
  })

  it('reads the congestion pattern from the accepted framework and the displayed pressures', async () => {
    await renderWorkbench({ section: 'practice' })

    const { rapMmHg, pcwpMmHg } = displayedFillingPressures()
    const expected = mcsCongestionProfileDefinition(mcsCongestionProfileId(rapMmHg, pcwpMmHg))
    expect(patientContextValue(CONGESTION_LABEL)).toContain(expected.label)
  })

  it('follows the framework as the filling pressures move, rather than standing still', async () => {
    await renderWorkbench({ section: 'practice' })
    const observed = new Set<string>()

    function recordCurrentPattern() {
      const { rapMmHg, pcwpMmHg } = displayedFillingPressures()
      const expected = mcsCongestionProfileDefinition(mcsCongestionProfileId(rapMmHg, pcwpMmHg))
      expect(patientContextValue(CONGESTION_LABEL)).toContain(expected.label)
      observed.add(expected.id)
    }

    recordCurrentPattern()

    // A congested left heart, then a decongested circulation, then a loaded right heart.
    fireEvent.change(screen.getByRole('slider', { name: 'Preload' }), { target: { value: '145' } })
    fireEvent.change(screen.getByRole('slider', { name: 'LV contractility' }), {
      target: { value: '0.2' },
    })
    recordCurrentPattern()

    fireEvent.change(screen.getByRole('slider', { name: 'Preload' }), { target: { value: '50' } })
    fireEvent.change(screen.getByRole('slider', { name: 'LV contractility' }), {
      target: { value: '1.4' },
    })
    recordCurrentPattern()

    fireEvent.change(screen.getByRole('slider', { name: 'Preload' }), { target: { value: '145' } })
    fireEvent.change(screen.getByRole('slider', { name: 'PVR' }), { target: { value: '9' } })
    fireEvent.change(screen.getByRole('slider', { name: 'RV contractility' }), {
      target: { value: '0.2' },
    })
    recordCurrentPattern()

    // A label that never changes is indistinguishable from a constant.
    expect(observed.size).toBeGreaterThan(1)
  })

  it('names the modeled pericardial constraint separately, without replacing the pattern', async () => {
    await renderWorkbench({ section: 'practice' })

    fireEvent.click(screen.getByRole('checkbox', { name: /Pericardial constraint/ }))

    const value = patientContextValue(CONGESTION_LABEL)
    const { rapMmHg, pcwpMmHg } = displayedFillingPressures()
    expect(value).toContain(
      mcsCongestionProfileDefinition(mcsCongestionProfileId(rapMmHg, pcwpMmHg)).label,
    )
    expect(value).toMatch(/modeled pericardial constraint/i)
    expect(value).not.toMatch(/tamponade pattern/i)
  })

  it('carries the accepted boundary that a congestion pattern selects no device', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(patientContextSafetyConstraints()).toContain(
      MCS_CONGESTION_PATTERN_BOUNDARY.doesNotEstablish,
    )
    // And nothing in the bar turns the pattern into a recommendation.
    for (const value of patientContextValues()) {
      expect(value).not.toMatch(
        /should receive|recommend|indicated for|choose (an|the) (IABP|Impella|LVAD)/i,
      )
    }
  })
})

describe('MCS M5 — the patient-context bar names the rhythm the model is running', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it.each([
    ['sinus', 'Sinus rhythm'],
    ['atrial-fibrillation', 'Atrial fibrillation'],
    ['paced', 'Paced'],
  ])('reads %s as "%s"', async (value, label) => {
    await renderWorkbench({ section: 'practice' })

    fireEvent.change(screen.getByRole('combobox', { name: 'Rhythm' }), { target: { value } })

    expect(patientContextValue('Rhythm')).toContain(label)
    expect(patientContextValue('Rhythm')).toMatch(/\d+ bpm/)
  })
})

describe('MCS M5 — the patient-context bar reports device flow as the model does', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('reports no direct device flow on counterpulsation', async () => {
    await renderWorkbench({ section: 'practice' })

    const value = patientContextValue(FLOW_LABEL)
    expect(value).toMatch(/none reported/i)
    expect(value).not.toMatch(/\b0\.0\b/)
  })

  it('reports the left-sided pump flow on a transvalvular pump', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('impella')

    expect(patientContextValue(FLOW_LABEL)).toMatch(/\d\.\d L\/min/)
    expect(patientContextValue(FLOW_LABEL)).not.toMatch(/none reported/i)
  })

  it('reports a displayed flow on durable support', async () => {
    await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('lvad')

    expect(patientContextValue(FLOW_LABEL)).toMatch(/\d\.\d L\/min/)
    expect(patientContextValue(FLOW_LABEL)).not.toMatch(/none reported/i)
  })

  /*
   * The Learn primary pane carries its own one-line flow summary, above the flow account and the
   * teaching panel that both say counterpulsation reports nothing. Found in the browser walkthrough,
   * not in the coverage map: it is the same claim as the context bar's, on a third surface.
   */
  it('reports no displayed device contribution in the Learn context strip on counterpulsation', async () => {
    const { container } = await renderWorkbench({
      section: 'learn',
      initialActivityId: 'iabp-timing-triggering',
    })

    const strip = container.querySelector('[data-learn-context]')?.textContent ?? ''
    expect(strip).toMatch(/displayed device none reported/)
    expect(strip).not.toMatch(/displayed device 0\.0/)
  })

  it('reports the left-sided pump flow in the Learn context strip on a transvalvular pump', async () => {
    const { container } = await renderWorkbench({
      section: 'learn',
      initialActivityId: 'impella-unloading-placement',
    })

    const strip = container.querySelector('[data-learn-context]')?.textContent ?? ''
    expect(strip).toMatch(/displayed device \d\.\d L\/min/)
    expect(strip).not.toMatch(/none reported/)
  })

  /*
   * The monitor was the last surface still printing the arithmetic zero as a reading. A tile headed
   * DEVICE FLOW showing `0.0 L/min` claims a pump-flow channel that reports nothing, which is the
   * one thing the module says counterpulsation does not have — and it said it directly beside a
   * flow account, on the same screen, reading "none reported".
   */
  it('reports no direct pump-flow channel on the counterpulsation monitor', async () => {
    const { container } = await renderWorkbench({ section: 'practice' })

    const account = monitorFlowAccountText(container)
    expect(account).toContain('DEVICE FLOW')
    expect(account).toContain('NONE REPORTED')
    expect(account).toMatch(/no direct pump-flow channel/i)
    expect(account).not.toMatch(/DEVICE FLOW[^|]*0\.0/)
    expect(account).not.toMatch(/DEVICE FLOW[^|]*L\/min/)
  })

  it('reports the same absence on an IABP Learn section, not only on a bare monitor', async () => {
    const { container } = await renderWorkbench({
      section: 'learn',
      initialActivityId: 'iabp-timing-triggering',
    })

    const account = monitorFlowAccountText(container)
    expect(account).toContain('DEVICE FLOW')
    expect(account).toContain('NONE REPORTED')
    expect(account).toMatch(/no direct pump-flow channel/i)
    expect(account).not.toMatch(/DEVICE FLOW[^|]*0\.0/)
    // The delivery the patient is actually getting stays a number on every pathway.
    expect(account).toMatch(/EFFECTIVE FLOW\s*\d+\.\d\s*L\/min/)
  })

  it('keeps a numeric displayed flow, marked estimated, on durable support', async () => {
    const { container } = await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('lvad')

    const account = monitorFlowAccountText(container)
    expect(account).toMatch(/DEVICE FLOW\s*\d+\.\d/)
    expect(account).toMatch(/L\/min · estimated/)
    expect(account).not.toContain('NONE REPORTED')
    expect(account).toMatch(/EFFECTIVE FLOW\s*\d+\.\d\s*L\/min/)
  })

  it('keeps the two microaxial pump flows separate, and out of one systemic total', async () => {
    const { container } = await renderWorkbench({ section: 'practice' })
    selectDeviceTrack('impella')
    fireEvent.change(screen.getByRole('combobox', { name: 'Right-sided Impella configuration' }), {
      target: { value: 'rp' },
    })

    const account = monitorFlowAccountText(container)
    expect(account).toMatch(/LV PUMP FLOW\s*\d+\.\d\s*L\/min · systemic assist/)
    expect(account).toMatch(/RP PUMP FLOW\s*\d+\.\d\s*L\/min · pulmonary delivery/)
    expect(account).not.toContain('DEVICE FLOW')
    expect(account).not.toContain('NONE REPORTED')
    expect(account).toMatch(/EFFECTIVE FLOW\s*\d+\.\d\s*L\/min/)
  })

  it('keeps the durable displayed flow marked as an estimate on the section that teaches it', async () => {
    const { container } = await renderWorkbench({
      section: 'learn',
      initialActivityId: 'lvad-parameters-assessment',
    })

    expect(
      container.querySelector('[data-flow-line="device"]')?.getAttribute('data-flow-line-kind'),
    ).toBe('estimated')
  })
})

describe('MCS M5 — the patient-context bar does not claim perfusion', () => {
  beforeEach(() => setupMcsWorkbenchEnvironment())
  afterEach(() => teardownMcsWorkbenchEnvironment())

  it('labels the venous saturation and cardiac power as a modeled balance and pressure–flow summary', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(patientContextLabels()).not.toContain('Perfusion')
    for (const label of patientContextLabels()) expect(label).not.toMatch(/^perfusion$/i)
    expect(patientContextValue(BALANCE_LABEL)).toMatch(/SvO₂ \d+% · CPO \d\.\d\d W/)
  })

  it('carries the accepted boundary that neither value establishes perfusion', async () => {
    await renderWorkbench({ section: 'practice' })

    expect(patientContextSafetyConstraints()).toContain(
      mcsDerivedValueGuides.cardiacPowerOutputW.doNotInfer,
    )
  })
})

describe('MCS M5 — the classifier is gone from the component tree, not only from one bar', () => {
  const componentsDir = join(
    process.cwd(),
    'src/features/mechanical-circulatory-support/components',
  )

  function componentSources(directory: string): readonly string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return componentSources(path)
      return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : []
    })
  }

  it.each([
    'LV-dominant shock',
    'RV-dominant shock',
    'Biventricular / mixed shock',
    'Supported low-output physiology',
    'Obstructive / tamponade pattern',
  ])('no MCS component still ships the "%s" label', (label) => {
    const offenders = componentSources(componentsDir).filter((path) =>
      readFileSync(path, 'utf8').includes(label),
    )
    expect(offenders).toEqual([])
  })

  it('classifies congestion only through the accepted framework helper', () => {
    const offenders = componentSources(componentsDir).filter((path) => {
      const source = readFileSync(path, 'utf8')
      return /shockPhenotype\s*\(/.test(source)
    })
    expect(offenders).toEqual([])
  })
})
