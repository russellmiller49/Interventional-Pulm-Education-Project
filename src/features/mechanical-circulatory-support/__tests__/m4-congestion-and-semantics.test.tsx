/**
 * M4 correction pass — the sourced congestion framework, and the clinical wording it travelled with.
 *
 * Two things are being pinned here, and they fail for different reasons.
 *
 * The congestion tests pin a *framework*: which threshold, from which source, at which boundary, with
 * which label. The previous implementation classified with an unsourced ratio, and the reason that
 * was wrong is not that the numbers were badly chosen — it is that nobody published them. So these
 * tests assert the numbers come from the named record rather than restating them, and separately
 * assert that the numbers nobody published are gone.
 *
 * The wording tests pin sentences. A sentence that overstates what a controller value measures does
 * not fail a type-check or a render; it only fails a reader. Each one names the claim it refuses.
 */
import { render } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockRouterPush }),
}))

import { criticalCareEvidenceById } from '@/features/critical-care/content/evidenceRegistry'

import { McsTeachingPanel } from '../components/teaching/McsTeachingPanel'
import { MCS_REVEAL_STAGES, type McsRevealStage } from '../components/teaching/revealStage'
import {
  MCS_ESTIMATED_FLOW_BOUNDARY,
  MCS_OXYGEN_DELIVERY_BOUNDARY,
  congestionProfileView,
} from '../components/teaching/selectors'
import {
  MCS_ACC_CONGESTION_FRAMEWORK,
  MCS_ACC_CONGESTION_THRESHOLD_MMHG,
  MCS_COMPLETE_PROFILE_COMPONENTS,
  MCS_ORTEGA_COHORT_CUTOFFS,
  MCS_RAP_PCWP_RATIO_CONTEXT,
  mcsCongestionProfileId,
  mcsCongestionSource,
  mcsCongestionSourceById,
  mcsCongestionSources,
  mcsSectionLearningContracts,
  type McsSectionLearningContract,
} from '../content'
import { createInitialMcsState, mcsReducer } from '../engine'
import type { McsDerivedMetrics, McsSimulationState } from '../engine'

const teachingDir = 'src/features/mechanical-circulatory-support/components/teaching'

function tick(state: McsSimulationState, steps: number): McsSimulationState {
  let next = state
  for (let index = 0; index < steps; index += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.1 })
  }
  return next
}

function openedState(contract: McsSectionLearningContract): McsSimulationState {
  let state = createInitialMcsState('learn', contract.startingDevice)
  for (const action of contract.startingActions) state = mcsReducer(state, action)
  return tick(state, 80)
}

function contractFor(sectionId: string): McsSectionLearningContract {
  const contract = mcsSectionLearningContracts.find(
    (candidate) => candidate.sectionId === sectionId,
  )
  if (!contract) throw new Error(`no contract for ${sectionId}`)
  return contract
}

function renderPanel(
  sectionId: string,
  reveal: McsRevealStage = 'explanation',
  state?: McsSimulationState,
  beforeMetrics: McsDerivedMetrics | null = null,
) {
  const contract = contractFor(sectionId)
  return render(
    <McsTeachingPanel
      contract={contract}
      state={state ?? openedState(contract)}
      reveal={reveal}
      beforeMetrics={beforeMetrics}
    />,
  )
}

/** A state with the two filling pressures forced to chosen values, so a boundary can be tested. */
function stateWithFillingPressures(rapMmHg: number, pcwpMmHg: number): McsSimulationState {
  const base = openedState(contractFor('mcs-device-selection-integration'))
  return { ...base, metrics: { ...base.metrics, rapMmHg, pcwpMmHg } }
}

const panelSources = [
  'DeviceSelectionIntegrationPanel.tsx',
  'ImpellaSuctionPurgeRvPanel.tsx',
  'ImpellaUnloadingPlacementPanel.tsx',
  'LvadAlarmsEmergenciesPanel.tsx',
  'LvadParametersAssessmentPanel.tsx',
  'SignalToPerfusionPanel.tsx',
  'SupportPathwayMechanismsPanel.tsx',
  'IabpEfficacyLimitsPanel.tsx',
  'IabpTimingTriggeringPanel.tsx',
  'shared.tsx',
  'selectors.ts',
]

beforeEach(() => {
  mockRouterPush.mockReset()
  window.localStorage.clear()
})

// ── The framework the module classifies with ─────────────────────────────────

describe('the congestion framework is the ACC consensus description, operationalized', () => {
  it('classifies strictly above 15 mm Hg on each pressure', () => {
    expect(MCS_ACC_CONGESTION_THRESHOLD_MMHG).toBe(15)
    expect(mcsCongestionProfileId(20, 10)).toBe('rv-predominant')
    expect(mcsCongestionProfileId(10, 20)).toBe('lv-predominant')
    expect(mcsCongestionProfileId(20, 20)).toBe('biventricular')
    expect(mcsCongestionProfileId(10, 10)).toBe('neither-elevated')
  })

  it('classifies from the two thresholds alone, whatever the ratio between them is', () => {
    /*
     * The point of the framework is that each pressure is judged against the threshold on its own.
     * These pairs span ratios from 0.15 to 1.9 and must not change the answer, which is exactly what
     * the removed 0.85/0.60 boundaries did.
     */
    const lvPairs: readonly (readonly [number, number])[] = [
      [3, 20],
      [10, 20],
      [14, 20],
      [15, 20],
      [12, 16],
    ]
    for (const [rap, pcwp] of lvPairs) {
      expect([rap, pcwp, mcsCongestionProfileId(rap, pcwp)]).toEqual([rap, pcwp, 'lv-predominant'])
    }
    const rvPairs: readonly (readonly [number, number])[] = [
      [19, 10],
      [19, 15],
      [16, 2],
      [30, 15],
    ]
    for (const [rap, pcwp] of rvPairs) {
      expect([rap, pcwp, mcsCongestionProfileId(rap, pcwp)]).toEqual([rap, pcwp, 'rv-predominant'])
    }
    const biPairs: readonly (readonly [number, number])[] = [
      [16, 16],
      [30, 16],
      [16, 30],
      [22, 24],
    ]
    for (const [rap, pcwp] of biPairs) {
      expect([rap, pcwp, mcsCongestionProfileId(rap, pcwp)]).toEqual([rap, pcwp, 'biventricular'])
    }
  })

  it('does not treat exactly 15 mm Hg as above 15', () => {
    expect(mcsCongestionProfileId(15, 15)).toBe('neither-elevated')
    expect(mcsCongestionProfileId(15, 16)).toBe('lv-predominant')
    expect(mcsCongestionProfileId(16, 15)).toBe('rv-predominant')
    expect(mcsCongestionProfileId(15.0001, 15)).toBe('rv-predominant')
    const view = congestionProfileView(stateWithFillingPressures(15, 15))
    expect(view.rapElevated).toBe(false)
    expect(view.pcwpElevated).toBe(false)
    expect(view.profileId).toBe('neither-elevated')
  })

  it('names the framework as ACC consensus–described and the grid as an operationalization', () => {
    expect(MCS_ACC_CONGESTION_FRAMEWORK.label).toBe(
      'ACC consensus–described filling-pressure congestion pattern',
    )
    expect(MCS_ACC_CONGESTION_FRAMEWORK.operationalizationNote).toMatch(
      /educational operationalization of the ACC consensus description/i,
    )
    expect(MCS_ACC_CONGESTION_FRAMEWORK.operationalizationNote).toMatch(
      /did not publish or validate this software grid/i,
    )
  })

  it('never calls the neither-elevated category euvolemic', () => {
    for (const rap of [4, 10, 15]) {
      for (const pcwp of [4, 10, 15]) {
        const view = congestionProfileView(stateWithFillingPressures(rap, pcwp))
        expect(view.profileId).toBe('neither-elevated')
        expect(view.label).toBe('Neither filling pressure is elevated by this framework')
        expect(view.label.toLowerCase()).not.toContain('euvolemic')
        expect(view.statement).toMatch(/does not establish true euvolemia/i)
      }
    }
  })

  it('has removed the unsourced ratio classifier from the shipped code', () => {
    const { readFileSync } = jest.requireActual<typeof import('node:fs')>('node:fs')
    const path = jest.requireActual<typeof import('node:path')>('node:path')
    const sources = panelSources
      .map((file) => readFileSync(path.join(process.cwd(), teachingDir, file), 'utf8'))
      .join('\n')
    const congestion = readFileSync(
      path.join(
        process.cwd(),
        'src/features/mechanical-circulatory-support/content/congestionProfile.ts',
      ),
      'utf8',
    )
    // The two ratio boundaries and the wedge-20 rule, gone from executable code.
    for (const removed of ['0.85', 'ratio >= 0.85', 'ratio <= 0.6', 'pcwp >= 20']) {
      expect(sources).not.toContain(removed)
    }
    expect(sources).not.toContain('fillingProfileView')
    // 0.60 survives only as documented prose about what was removed, never as a comparison.
    expect(congestion).not.toMatch(/ratio\s*[<>]=?\s*0\.(6|85)/)
  })
})

// ── Where the numbers come from ──────────────────────────────────────────────

describe('congestion provenance resolves and stays separated', () => {
  it('resolves every congestion evidence id to a registered record', () => {
    for (const id of [
      ...MCS_ACC_CONGESTION_FRAMEWORK.sourceIds,
      ...MCS_RAP_PCWP_RATIO_CONTEXT.sourceIds,
    ]) {
      expect(mcsCongestionSourceById.has(id)).toBe(true)
      expect(() => mcsCongestionSource(id)).not.toThrow()
    }
    expect(() => mcsCongestionSource('not-a-registered-source')).toThrow(
      /No MCS congestion source registered/,
    )
  })

  it('keeps title, authors, journal, year and locator accurate on each record', () => {
    const acc = mcsCongestionSource('acc-cs-concise-clinical-guidance-2025')
    expect(acc.kind).toBe('expert-consensus-statement')
    expect(acc.authors).toContain('Sinha SS')
    expect(acc.journal).toBe('Journal of the American College of Cardiology')
    expect(acc.year).toBe(2025)
    expect(acc.citation).toContain('2025;85(16):1618')
    expect(acc.locator).toMatch(/4\.4/)

    const ortega = mcsCongestionSource('ortega-hernandez-ami-cs-congestion-2023')
    expect(ortega.kind).toBe('single-center-retrospective-cohort')
    expect(ortega.authors).toContain('Ortega-Hernández')
    expect(ortega.journal).toBe('Journal of Cardiac Failure')
    expect(ortega.year).toBe(2023)
    expect(ortega.citation).toContain('2023;29(5):745')
    expect(ortega.population).toMatch(/295/)
    expect(ortega.population).toMatch(/AMI-CS/)

    const garan = mcsCongestionSource('garan-cswg-complete-pac-profile-2020')
    expect(garan.kind).toBe('multicenter-registry-analysis')
    expect(garan.authors).toContain('Garan AR')
    expect(garan.journal).toBe('JACC: Heart Failure')
    expect(garan.year).toBe(2020)
    expect(garan.citation).toContain('2020;8(11):903')
  })

  it('does not mislabel any of the three as a kind it is not', () => {
    const kinds = mcsCongestionSources.map((source) => source.kind)
    // Expert consensus is never a cohort observation, and neither study is society guidance.
    expect(kinds).not.toContain('randomized-trial')
    expect(mcsCongestionSource('acc-cs-concise-clinical-guidance-2025').kind).not.toBe(
      'single-center-retrospective-cohort',
    )
    expect(mcsCongestionSource('ortega-hernandez-ami-cs-congestion-2023').kind).not.toBe(
      'expert-consensus-statement',
    )
  })

  it('does not invent a shared-registry entry it has not earned', () => {
    // These live in the MCS-local record set because `McsSource['sourceType']` has no accurate
    // member for a cohort study, and `engine/types.ts` is frozen for this pass. If a future package
    // adds one, this expectation is what should be updated alongside it.
    for (const source of mcsCongestionSources) {
      expect(criticalCareEvidenceById.has(source.id)).toBe(false)
    }
  })

  it('keeps the ACC and cohort thresholds apart and never averages them', () => {
    expect(MCS_ORTEGA_COHORT_CUTOFFS.rapMmHg).toBe(12)
    expect(MCS_ORTEGA_COHORT_CUTOFFS.pcwpMmHg).toBe(18)
    expect(MCS_ACC_CONGESTION_THRESHOLD_MMHG).not.toBe(MCS_ORTEGA_COHORT_CUTOFFS.rapMmHg)
    expect(MCS_ACC_CONGESTION_THRESHOLD_MMHG).not.toBe(MCS_ORTEGA_COHORT_CUTOFFS.pcwpMmHg)
    const view = renderPanel('mcs-device-selection-integration')
    const text = view.container.textContent ?? ''
    // No compromise value between 12, 15 and 18 is created anywhere on the panel.
    for (const invented of ['13.5 mm Hg', '15.5 mm Hg', '16.5 mm Hg', '14 mm Hg average']) {
      expect(text).not.toContain(invented)
    }
    expect(view.container.querySelector('[data-no-averaged-threshold]')?.textContent).toMatch(
      /are not averaged and no\s+compromise value is created/i,
    )
    view.unmount()
  })
})

// ── What the integration panel renders ───────────────────────────────────────

describe('the integration panel renders a congestion pattern, not a device rule', () => {
  it('titles the opening block as a filling-pressure congestion pattern', () => {
    const view = renderPanel('mcs-device-selection-integration', 'orientation')
    expect(
      view.container.querySelector('[data-panel-section="integration-congestion"]'),
    ).not.toBeNull()
    expect(view.container.querySelector('[data-panel-section="integration-phenotype"]')).toBeNull()
    expect(view.container.textContent).toContain('Filling-pressure congestion pattern')
    view.unmount()
  })

  it('states the reading, the framework, the source type and the limit', () => {
    const state = stateWithFillingPressures(20, 10)
    const view = renderPanel('mcs-device-selection-integration', 'orientation', state)
    const reading = view.container.querySelector('[data-congestion-reading]')?.textContent ?? ''
    expect(reading).toMatch(/RAP is 20 mm Hg and PCWP is 10 mm Hg/)
    expect(reading).toMatch(/ACC consensus–described filling-pressure framework/)
    expect(reading).toMatch(/rv-predominant filling-pressure congestion pattern/i)

    expect(view.container.querySelector('[data-framework-label]')?.textContent).toBe(
      'ACC consensus–described filling-pressure congestion pattern',
    )
    expect(view.container.querySelector('[data-source-kind]')?.textContent).toBe(
      'Expert consensus statement',
    )
    expect(view.container.querySelector('[data-evidence-ids]')?.textContent).toContain(
      'acc-cs-concise-clinical-guidance-2025',
    )
    expect(
      view.container.querySelector('[data-congestion-operationalization]')?.textContent,
    ).toMatch(/educational operationalization/i)
    view.unmount()
  })

  it('says what the pattern does not establish, and what to reconcile it with', () => {
    const view = renderPanel('mcs-device-selection-integration', 'orientation')
    const limit = view.container.querySelector('[data-congestion-limit]')?.textContent ?? ''
    expect(limit).toMatch(/does not independently establish the cause of shock/i)
    expect(limit).toMatch(/prove isolated ventricular failure/i)
    expect(limit).toMatch(/measure organ perfusion/i)
    expect(limit).toMatch(/select a support device/i)

    const reconcile = view.container.querySelector('[data-congestion-reconcile]')?.textContent ?? ''
    for (const item of [
      'cardiac output',
      'pulmonary artery pressures',
      'PA saturation',
      'echocardiography',
      'gas-exchange',
      'trajectory',
    ]) {
      expect(reconcile).toContain(item)
    }
    view.unmount()
  })

  it('answers the dominant-problem question without naming a mechanism from two pressures', () => {
    const view = renderPanel('mcs-device-selection-integration', 'explanation')
    const row = view.container.querySelector(
      '[data-common-model-question="mcs.model.q1-dominant-problem"] [data-question-answer]',
    )?.textContent
    expect(row).toMatch(/Filling pressures identify a .*congestion pattern/i)
    expect(row).toMatch(/dominant shock mechanism is not fully determined by these two pressures/i)
    view.unmount()
  })

  it('recommends, prefers and indicates no pathway anywhere', () => {
    for (const reveal of MCS_REVEAL_STAGES) {
      const view = renderPanel('mcs-device-selection-integration', reveal)
      const text = view.container.textContent ?? ''
      expect(text).not.toMatch(/\b(recommended|preferred|indicated) (device|pathway|support)\b/i)
      expect(text).not.toMatch(/\b(start|choose|select) (an? )?(Impella|IABP|LVAD|balloon pump)\b/i)
      expect(text).not.toMatch(
        /this (patient|congestion pattern) (needs|requires) (an? )?\w+ pump/i,
      )
      view.unmount()
    }
  })

  it('renders the cohort disclosure separately, with its own labels', () => {
    const view = renderPanel('mcs-device-selection-integration', 'explanation')
    const acc = view.container.querySelector(
      '[data-congestion-source="acc-cs-concise-clinical-guidance-2025"]',
    )
    const ortega = view.container.querySelector(
      '[data-congestion-source="ortega-hernandez-ami-cs-congestion-2023"]',
    )
    expect(acc).not.toBeNull()
    expect(ortega).not.toBeNull()
    expect(acc?.contains(ortega as Node)).toBe(false)

    const ortegaText = ortega?.textContent ?? ''
    expect(ortegaText).toContain('Single-center retrospective cohort study')
    expect(ortegaText).toMatch(/at or above 12 mm Hg/)
    expect(ortegaText).toMatch(/at or above 18 mm Hg/)
    expect(ortegaText).toMatch(/AMI-CS/)
    expect(ortegaText).toMatch(/retrospectively/i)
    expect(ortegaText).toMatch(/295 patients/)
    expect(ortegaText).toMatch(/first 24 hours/i)
    expect(ortegaText).toContain('ortega-hernandez-ami-cs-congestion-2023')

    // The source's own word is preserved and immediately qualified.
    expect(view.container.querySelector('[data-ortega-euvolemic-note]')?.textContent).toMatch(
      /Euvolemic was the study’s label for the quadrant below both cohort cutoffs\. It does not independently establish total-body euvolemia or adequate perfusion\./,
    )

    const accText = acc?.textContent ?? ''
    expect(accText).toMatch(/above 15 mm Hg/)
    expect(accText).toMatch(/echocardiography or point-of-care ultrasound/i)
    expect(accText).not.toMatch(/at or above 12 mm Hg/)
    view.unmount()
  })

  it('names the complete-profile components and what this simulation lacks', () => {
    const view = renderPanel('mcs-device-selection-integration', 'explanation')
    const components =
      view.container.querySelector('[data-complete-profile-components]')?.textContent ?? ''
    for (const component of MCS_COMPLETE_PROFILE_COMPONENTS) {
      expect(components).toContain(component)
    }
    expect(components).toContain('Pulmonary artery oxygen saturation')
    const simulation =
      view.container.querySelector('[data-complete-profile-simulation]')?.textContent ?? ''
    expect(simulation).toMatch(
      /modeled balance signal rather than a measured pulmonary artery saturation/i,
    )
    expect(simulation).toMatch(/congestion pattern, not a complete profile/i)
    view.unmount()
  })

  it('carries the ratio only as an outcome association, with no unit and no phenotype', () => {
    const view = renderPanel('mcs-device-selection-integration', 'explanation')
    const block = view.container.querySelector('[data-rap-pcwp-ratio]')
    expect(block).not.toBeNull()
    const text = block?.textContent ?? ''
    expect(text).toMatch(/derived arithmetic relationship/i)
    expect(text).toMatch(/associated with adverse mortality/i)
    expect(text).not.toMatch(/0\.6\s*mm Hg/)
    expect(view.container.querySelector('[data-ratio-do-not-infer]')?.textContent ?? '').toMatch(
      /does not assign a ventricular phenotype/i,
    )
    expect(view.container.querySelector('[data-ratio-do-not-infer]')?.textContent ?? '').toMatch(
      /does not select a device/i,
    )
    view.unmount()
  })

  it('does not describe the obstruction constraint as examined and excluded', () => {
    const view = renderPanel('mcs-device-selection-integration', 'explanation')
    const row = view.container.querySelector(
      '[data-common-model-question="mcs.model.q6-what-limits-performance"]',
    )?.textContent
    expect(row).not.toMatch(/no modeled obstruction/i)
    expect(row).toMatch(/tamponade: modeled (present|not present)/i)
    expect(row).toMatch(
      /Inflow obstruction, outflow obstruction, and device-path malposition .*are not comprehensively modeled/i,
    )
    view.unmount()
  })
})

// ── Durable-LVAD semantics ───────────────────────────────────────────────────

describe('durable-LVAD controller values are described accurately', () => {
  it('describes pump power as electrical power under hydraulic and mechanical load', () => {
    const view = renderPanel('lvad-parameters-assessment', 'explanation')
    const text = view.container.textContent ?? ''
    expect(text).toMatch(
      /electrical power required to maintain the set speed under the current hydraulic and mechanical load/i,
    )
    expect(
      view.container.querySelector('[data-controller-boundary="power"]')?.textContent ?? '',
    ).toMatch(/not one-to-one/i)
    expect(
      view.container.querySelector('[data-controller-boundary="power"]')?.textContent ?? '',
    ).toMatch(/mechanical drag/i)
    expect(
      view.container.querySelector('[data-controller-boundary="power"]')?.textContent ?? '',
    ).toMatch(/does not directly measure systemic delivery/i)
    expect(
      view.container.querySelector('[data-controller-boundary="power"]')?.textContent ?? '',
    ).toMatch(/single power value does not diagnose thrombosis/i)

    // The claims this replaced.
    expect(text).not.toMatch(/work the impeller is doing on the blood/i)
    expect(text).not.toMatch(/moves with the volume rather than with the pressure/i)
    view.unmount()
  })

  it('describes pulsatility index as cyclic variation, not a fraction of the cycle', () => {
    const view = renderPanel('lvad-parameters-assessment', 'explanation')
    const text = view.container.textContent ?? ''
    expect(text).toMatch(/magnitude of cyclic variation in estimated pump flow or power/i)
    const boundary =
      view.container.querySelector('[data-controller-boundary="pulsatility-index"]')?.textContent ??
      ''
    expect(boundary).toMatch(/same pulsatility index can\s+occur in different clinical states/i)
    expect(boundary).toMatch(/complete controller\s+trend/i)
    expect(boundary).toMatch(
      /hypovolemia,\s+right ventricular failure, recovery, or adequate unloading/i,
    )

    expect(text).not.toMatch(/how much of the cycle the native ventricle/i)
    expect(text).not.toMatch(/what is left of the native beat/i)
    view.unmount()
  })

  it('does not dismiss persistent aortic-valve closure as simply expected', () => {
    const view = renderPanel('lvad-parameters-assessment', 'explanation')
    const text = view.container.textContent ?? ''
    expect(text).not.toMatch(/an expected state rather than a fault/i)
    if (/not opening/i.test(text)) {
      expect(text).toMatch(/persistent closure must be interpreted with unloading goals/i)
    }
    view.unmount()
  })

  it('refuses universal targets rather than the existence of device settings', () => {
    const view = renderPanel('lvad-parameters-assessment', 'explanation')
    const text = view.container.querySelector('[data-no-published-targets]')?.textContent ?? ''
    expect(text).toMatch(/publishes no universal speed, power, pulsatility-index, or alarm target/i)
    expect(text).toMatch(/Specific devices define their own settings/i)
    view.unmount()
  })
})

// ── Boundaries shared across panels ──────────────────────────────────────────

describe('the estimated-flow and oxygen-delivery boundaries say what they mean', () => {
  it('does not claim to reproduce a real controller', () => {
    expect(MCS_ESTIMATED_FLOW_BOUNDARY).toMatch(/estimated rather than measured directly/i)
    expect(MCS_ESTIMATED_FLOW_BOUNDARY).toMatch(
      /does not reproduce each controller’s proprietary calculation or display/i,
    )
    expect(MCS_ESTIMATED_FLOW_BOUNDARY).not.toMatch(/exactly as it is on the real controller/i)
    for (const sectionId of [
      'impella-unloading-placement',
      'impella-suction-purge-rv',
      'lvad-parameters-assessment',
      'lvad-alarms-emergencies',
    ]) {
      const view = renderPanel(sectionId, 'explanation')
      expect(view.container.textContent).not.toMatch(/exactly as it is on the real controller/i)
      view.unmount()
    }
  })

  it('labels the oxygen rung as not directly calculated, and SvO2 as a balance signal', () => {
    const view = renderPanel('mcs-foundations-signals', 'orientation')
    const text = view.container.textContent ?? ''
    expect(text).toContain('Oxygen delivery — not directly calculated')
    expect(text).not.toContain('Oxygen-delivery evidence')
    expect(text).toMatch(/Modeled delivery–consumption balance signal/i)
    expect(text).not.toMatch(/fills three of them/i)
    expect(text).toMatch(/directly populates pressure and flow/i)
    expect(MCS_OXYGEN_DELIVERY_BOUNDARY).toMatch(/delivery–consumption balance signal/i)
    expect(MCS_OXYGEN_DELIVERY_BOUNDARY).toMatch(/not a measurement of delivery/i)
    expect(MCS_OXYGEN_DELIVERY_BOUNDARY).toMatch(/not a value to drive a patient toward/i)
    // The unmodeled list survives the rewording.
    for (const id of ['mentation', 'urine-output', 'lactate', 'organ-recovery']) {
      expect(view.container.querySelector(`[data-unmodeled-signal="${id}"]`)).not.toBeNull()
    }
    expect(text).toMatch(/Hemoglobin and arterial oxygen content are not modeled/i)
    view.unmount()
  })
})

// ── ECMO comparison, alarms, suction ─────────────────────────────────────────

describe('the comparison and differential wording is qualified', () => {
  it('qualifies the VV and VA extracorporeal rows', () => {
    const view = renderPanel('mcs-foundations-mechanisms', 'explanation')
    const vv =
      view.container.querySelector('[data-distinction="vv-ecmo-adds-no-systemic-flow"]')
        ?.textContent ?? ''
    expect(vv).toMatch(/no direct arterial pump-flow\s+contribution/i)
    expect(vv).toMatch(/systemic circulatory flow remains native cardiac output/i)
    expect(vv).toMatch(/may indirectly affect that\s+native output/i)

    const va =
      view.container.querySelector('[data-distinction="va-ecmo-loads-the-lv"]')?.textContent ?? ''
    expect(va).toMatch(/may increase left ventricular/i)
    expect(va).toMatch(/peripheral retrograde arterial return/i)
    expect(va).toMatch(/depends on\s+the configuration/i)
    expect(va).not.toMatch(/An arterial return raises the pressure the native ventricle must open/i)
    view.unmount()
  })

  it('does not mark the preload domain positive from the right atrial pressure alone', () => {
    const contract = contractFor('lvad-alarms-emergencies')
    const base = openedState(contract)
    const highRap: McsSimulationState = {
      ...base,
      metrics: { ...base.metrics, rapMmHg: 22 },
    }
    const view = renderPanel('lvad-alarms-emergencies', 'explanation', highRap)
    const row = view.container.querySelector('[data-alarm-domain="preload-rv"]')
    expect(row?.getAttribute('data-domain-modeled-state')).toBe('reading-only')
    expect(row?.textContent).toMatch(/readings only — no modeled verdict/i)
    expect(row?.textContent).toMatch(/right atrial pressure 22 mm Hg/)
    expect(row?.textContent).toMatch(/no single one of them, the right atrial pressure included/i)
    // The explicit modeled states keep their binary reading.
    expect(
      view.container
        .querySelector('[data-alarm-domain="external-power"]')
        ?.getAttribute('data-domain-modeled-state'),
    ).toMatch(/^(present|absent)$/)
    view.unmount()
  })

  it('separates current modeled evidence from what it raises and what remains open', () => {
    const view = renderPanel('lvad-alarms-emergencies', 'explanation')
    const headers = Array.from(
      view.container.querySelectorAll('[data-alarm-localization] thead th'),
    ).map((cell) => cell.textContent)
    expect(headers).toEqual([
      'Domain',
      'Current modeled evidence',
      'What this raises',
      'What remains in the differential',
    ])
    view.unmount()
  })

  it('names the full high-power evaluation, and keeps the unmodeled boundaries', () => {
    const contract = contractFor('lvad-alarms-emergencies')
    const acted = tick(
      mcsReducer(openedState(contract), {
        type: 'SET_LVAD_CONTROL',
        control: 'suspectedPumpThrombosis',
        value: true,
      }),
      40,
    )
    const view = renderPanel('lvad-alarms-emergencies', 'explanation', acted)
    const text = view.container.textContent ?? ''
    for (const item of [
      'clinical status',
      'power and flow trends',
      'device logs',
      'hemolysis evaluation',
      'focused imaging',
      'inflow/outflow causes',
    ]) {
      expect(text).toContain(item)
    }
    expect(text).toMatch(/suspected/i)
    expect(text).toMatch(/raises power and leaves the delivered flow where it was/i)
    expect(text).toMatch(/does not teach the converse/i)
    expect(text).not.toMatch(/(?:reduces|lowers) (?:the )?delivered flow/i)
    expect(
      view.container.querySelector('[data-high-power-boundary="hemolysis"]')?.textContent,
    ).toMatch(/not modeled/i)
    expect(
      view.container.querySelector('[data-high-power-boundary="obstruction"]')?.textContent,
    ).toMatch(/not modeled/i)
    view.unmount()
  })

  it('states the suction principle as inlet conditions, not as a setting that is too low', () => {
    const view = renderPanel('impella-suction-purge-rv', 'transfer')
    const principle =
      view.container.querySelector('[data-transferable-principle]')?.textContent ?? ''
    expect(principle).toMatch(/inlet conditions are inadequate for the requested\s+support/i)
    expect(principle).toMatch(/underfilling, restricted inflow, or position/i)
    expect(principle).toMatch(/not that the performance level is too low/i)
    expect(principle).not.toMatch(/short of blood, not short of setting/i)
    view.unmount()
  })

  it('keeps purge separate from suction and the serial flows non-additive', () => {
    const view = renderPanel('impella-suction-purge-rv', 'explanation')
    expect(view.container.querySelector('[data-differential-domain="purge"]')?.textContent).toMatch(
      /different problems with different causes/i,
    )
    expect(view.container.querySelector('[data-serial-not-additive]')?.textContent).toMatch(
      /never summed here/i,
    )
    view.unmount()
  })
})

// ── US English ───────────────────────────────────────────────────────────────

describe('newly authored learner-facing text uses US spellings', () => {
  it.each(panelSources)('keeps %s free of the old spellings', (file) => {
    const { readFileSync } = jest.requireActual<typeof import('node:fs')>('node:fs')
    const path = jest.requireActual<typeof import('node:path')>('node:path')
    const source = readFileSync(path.join(process.cwd(), teachingDir, file), 'utf8')
    for (const spelling of [
      'haemoglobin',
      'Haemoglobin',
      'haemolysis',
      'Haemolysis',
      'hypovolaemia',
      'Hypovolaemia',
      'programme',
      'behaviour',
      'characterised',
    ]) {
      expect(source).not.toContain(spelling)
    }
  })
})
