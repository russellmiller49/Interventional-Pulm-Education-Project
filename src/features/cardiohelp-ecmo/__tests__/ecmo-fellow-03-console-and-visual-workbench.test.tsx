import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { FitWidthSurface } from '../components/FitWidthSurface'
import {
  CIRCUIT_MAP_BODY_MIDLINE_X,
  VA_NATIVE_EJECTION_PATH,
  VA_RIGHT_ARM_SITE,
  circuitMapGeometry,
} from '../components/circuit-map/circuitMapGeometry'
import {
  PRACTICE_PATIENT_OXYGENATION_FOCUS_CASES,
  surfacesForStage,
} from '../components/practice/surfaceDisclosure'
import { EcmoSectionHeader } from '../components/shell/EcmoSectionHeader'
import { ecmoTaskPresentation } from '../components/stage/activityPresentation'
import {
  SCENE_LABEL_GAP_PX,
  SCENE_LABEL_MAX_SHIFT_PX,
  placeSceneLabels,
} from '../components/ecmo-circuit/sceneLabelLayout'
import { buildFoundationStageLesson } from '../components/stage/adapters/foundationStageAdapter'
import { capstoneMatrixMinimumRem } from '../components/teaching/CapstoneHypothesisMatrix'
import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import { VA_MIXING_ILLUSTRATIONS } from '../components/teaching/VaAorticStreamsDiagram'
import { VaDifferentialHypoxemiaPanel } from '../components/teaching/drills/VaDifferentialHypoxemiaPanel'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
} from '../engine'
import { mountDrill, nowPrimary, resetStageHarness } from '../test-support/learnStageHarness'

/**
 * ECMO-FELLOW-03: the console and the visual workbench.
 *
 * Portable checks for the repairs a fellow walkthrough (September 19, 2026) asked of lane 03. jsdom
 * does no layout, so geometry is asserted where it lives — the stylesheet contract, the DOM order a
 * layout depends on, and the drawing's own coordinates — and the rendered measurements are in the
 * handoff's production-browser evidence. No physiology, key, threshold or storage is touched here.
 */

jest.setTimeout(30_000)

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve(new Response('{}'))) as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
  resetStageHarness()
})

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const ecmoCss = read('src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css')
const shellCss = read('src/features/cardiohelp-ecmo/components/shell/EcmoActivityShell.module.css')
const flowCss = read('src/features/cardiohelp-ecmo/components/stage/ActivityFlow.module.css')

function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`${selector} is not declared`)
  return css.slice(start, css.indexOf('}', start))
}

function mediaBlock(css: string, query: string): string {
  const start = css.indexOf(query)
  if (start < 0) return ''
  let depth = 0
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    if (css[index] === '}') depth -= 1
    if (depth === 0) return css.slice(start, index)
  }
  return css.slice(start)
}

function settled(profileId: 'vv-reference' | 'va-reference') {
  let state = createReferenceSimulationState(profileId)
  for (let tick = 0; tick < 8; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

function follows(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

/** WCAG relative-luminance contrast between two #rrggbb colours. */
function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    const linear = (channel: number) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
  }
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

/* ------------------------------------------------------------------ *
 * A. The console at the width it is given (S4-1, S7-2)
 * ------------------------------------------------------------------ */

describe('A. console reflows by its own width', () => {
  it('is a size container with three arrangements keyed to it, not to the viewport', () => {
    expect(ruleBody(ecmoCss, '.consoleSection')).toContain('container: ecmo-console / inline-size')
    for (const query of [
      '@container ecmo-console (max-width: 51rem)',
      '@container ecmo-console (max-width: 36rem)',
      '@container ecmo-console (max-width: 26rem)',
    ]) {
      expect(ecmoCss).toContain(query)
    }
    // The old viewport rules no longer lay out the device: at 1280 × 961 they said "desktop" while
    // the console had 726 px, and the physical controls were clipped.
    for (const query of ['@media (max-width: 1000px)', '@media (max-width: 760px)']) {
      const block = mediaBlock(ecmoCss, query)
      expect(block).not.toMatch(/\.deviceLayout|\.physicalPanel|\.rotaryControl/)
    }
  })

  it('gives the screen work area, not the status bar, the spare height', () => {
    expect(ruleBody(ecmoCss, '.touchscreenFrame')).toContain(
      'grid-template-rows: auto minmax(0, 1fr) auto',
    )
    expect(ruleBody(ecmoCss, '.statusBar')).toContain('font-size: 0.75rem')
  })

  it('keeps every physical control and moves the operating hints beside the device at reading size', () => {
    const state = createInitialSimulationState('startup-sensor-orientation')
    const view = render(<CardiohelpConsole state={state} dispatch={jest.fn()} controlsEnabled />)
    const panel = view.container.querySelector('[aria-label="Physical console controls"]')
    expect(panel).not.toBeNull()
    for (const name of [
      /Hold Safety/i,
      /^Zero flow$/i,
      /Lock controls/i,
      /Power on/i,
      /^RPM$/,
      /^LPM$/,
      /Decrease setpoint/i,
      /Increase setpoint/i,
      /Optional alarm audio/i,
    ]) {
      expect(within(panel as HTMLElement).getByRole('button', { name })).toBeInTheDocument()
    }
    const notes = view.container.querySelector('[data-console-notes]')
    for (const id of ['cardiohelp-safety-chord-hint', 'cardiohelp-rotary-hold-hint']) {
      const hint = document.getElementById(id)
      expect(hint).not.toBeNull()
      expect(panel?.contains(hint)).toBe(false)
      expect(notes?.contains(hint)).toBe(true)
    }
    // Still described by their hints.
    expect(screen.getByRole('button', { name: /Increase setpoint/i })).toHaveAttribute(
      'aria-describedby',
      'cardiohelp-rotary-hold-hint',
    )
    expect(ruleBody(ecmoCss, '.consoleNotes')).toContain(
      'font-size: var(--ecmo-type-floor, 0.875rem)',
    )
  })

  it('explains the device tab abbreviations and pAux outside the facsimile', () => {
    const state = createInitialSimulationState('startup-sensor-orientation')
    const view = render(<CardiohelpConsole state={state} dispatch={jest.fn()} controlsEnabled />)
    const key = view.container.querySelector('[data-console-tab-key]')?.textContent ?? ''
    for (const [short, label] of [
      ['START', 'Startup'],
      ['PARAM', 'Parameter list'],
      ['BLOOD', 'Blood parameters'],
      ['TRANS', 'Transport'],
      ['INTERV', 'Interventions'],
      ['TIME', 'Timers'],
    ]) {
      expect(key).toContain(`${short} ${label}`)
    }
    // The device's own tab labels are unchanged.
    expect(screen.getByRole('button', { name: 'Parameter list' })).toHaveTextContent('PARAM')
    const paux = view.container.querySelector('[data-console-paux]')?.textContent ?? ''
    expect(paux).toMatch(/IFU revision 2\.3, pages 45 and 110/)
    expect(paux).toMatch(/does not model a pAux sensor/)
  })

  it('exposes a scrollable region only while something actually overflows', () => {
    const widths = { available: 700, content: 690 }
    const clientWidth = jest
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(() => widths.available)
    const scrollWidth = jest
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(() => widths.content)
    try {
      const { rerender, container } = render(
        <FitWidthSurface mode="actual" label="console" remeasureKey="fits">
          <div>console</div>
        </FitWidthSurface>,
      )
      const surface = () => container.querySelector('[data-fit-width-surface]') as HTMLElement
      expect(surface()).toHaveAttribute('data-fit-scrollable', 'false')
      expect(surface()).not.toHaveAttribute('tabindex')
      expect(surface()).not.toHaveAttribute('role')

      widths.content = 900
      rerender(
        <FitWidthSurface mode="actual" label="console" remeasureKey="overflows">
          <div>console</div>
        </FitWidthSurface>,
      )
      expect(surface()).toHaveAttribute('data-fit-scrollable', 'true')
      expect(surface()).toHaveAttribute('tabindex', '0')
      expect(surface()).toHaveAttribute('role', 'region')
    } finally {
      clientWidth.mockRestore()
      scrollWidth.mockRestore()
    }
  })
})

/* ------------------------------------------------------------------ *
 * E. Controls: ink, pressed states, vocabulary (S1-2, S2-8)
 * ------------------------------------------------------------------ */

describe('E. control ink and pressed states', () => {
  it('states the primary ink where the module shell rule cannot override it', () => {
    // `.moduleShell button { color: inherit }` is (0,1,1); `.shell .nowPrimary` is (0,2,0).
    expect(ruleBody(shellCss, '.shell .nowPrimary')).toContain('color: #04211f')
    expect(contrast('#04211f', '#71e1e5')).toBeGreaterThanOrEqual(4.5)
    // Hover and pressed fills keep the same dark ink readable.
    expect(ruleBody(shellCss, '.shell .nowPrimary:hover:not(:disabled)')).toContain('#a4eff1')
    expect(ruleBody(shellCss, '.shell .nowPrimary:active:not(:disabled)')).toContain('#45c6cc')
    expect(contrast('#04211f', '#a4eff1')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#04211f', '#45c6cc')).toBeGreaterThanOrEqual(4.5)
    // The near-white ink the walkthrough measured, for the record.
    expect(contrast('#eaf4f4', '#71e1e5')).toBeLessThan(1.5)
  })

  it('makes the real pressed pressure location visible, and says "task" in both places', async () => {
    render(<EcmoFoundationLessonActivity sectionId="circuit-flow-path" supportMode="vv" />)
    await screen.findByRole('heading', { name: /Follow the blood/i })
    const lesson = buildFoundationStageLesson('circuit-flow-path', 'vv')
    const pressureStep = lesson.steps.find((step) => step.id.endsWith('pressure-sites'))
    fireEvent.click(
      document.querySelector(`[data-step-id="${pressureStep?.id}"] button`) as HTMLElement,
    )
    const toggle = await waitFor(() => {
      const node = document.querySelector('[data-pressure-site-toggle="pArt"]')
      if (!node) throw new Error('no toggle yet')
      return node as HTMLElement
    })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle.className).toMatch(/aria-pressed:bg-\[#71e1e5\]/)
    expect(toggle.className).toMatch(/aria-pressed:text-\[#04211f\]/)
    expect(document.querySelector('[data-now-card]')?.textContent).toMatch(/Task \d+ of \d+/)
    const rows = [...document.querySelectorAll('[data-step-id]')].map(
      (row) => row.textContent ?? '',
    )
    expect(rows.every((text) => !/Step \d/.test(text))).toBe(true)
    expect(rows.some((text) => /Task \d/.test(text))).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * B. Task, control and observation together (S2-4, S2-5, S3-1, S8-2, C5-2)
 * ------------------------------------------------------------------ */

describe('B. the work and what it is read against, together', () => {
  it('S2-4: pairs circuit pArt and patient MAP, each named by its site, from the one live state', () => {
    const state = settled('vv-reference')
    const view = render(<EcmoFoundationTeachingPanel sectionId="circuit-flow-path" state={state} />)
    const pair = view.container.querySelector('[data-part-map-pair]')
    expect(pair).not.toBeNull()
    const circuit = pair?.querySelector('[data-measurement-site="circuit"]')?.textContent ?? ''
    const patient = pair?.querySelector('[data-measurement-site="patient"]')?.textContent ?? ''
    expect(circuit).toMatch(/Return limb, after the oxygenator/)
    expect(circuit).toContain(`${state.circuit.readouts.pArt.displayed}`)
    expect(patient).toMatch(/independent bedside monitor/)
    expect(patient).toContain(`${state.patient.meanArterialPressure} mmHg`)
    expect(view.container.querySelector('[data-part-map-sites]')?.textContent).toMatch(
      /not expected to agree/,
    )
    // And the comparison task puts the full monitor first beside it.
    const lesson = buildFoundationStageLesson('circuit-flow-path', 'vv')
    const observe = lesson.steps.find((step) => step.phase === 'observe')
    expect(ecmoTaskPresentation(lesson, observe!)?.surfaces).toEqual(['monitor', 'circuit'])
  })

  it('S2-5: keeps the model identity in view and the meta-text one disclosure away', async () => {
    render(<EcmoFoundationLessonActivity sectionId="circuit-flow-path" supportMode="vv" />)
    await screen.findByRole('heading', { name: /Follow the blood/i })
    const card = document.querySelector('[data-model-reference="compact"]')
    expect(card).not.toBeNull()
    expect(card?.querySelector('[data-clock-held]')?.textContent).toMatch(/clock held/)
    const details = card?.querySelector('details[data-model-reference-details]')
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')
    expect(details?.textContent).toMatch(/Observation-only display/)
  })

  it('S3-1: the result sits under the action, and replay takes the action’s slot', async () => {
    render(<EcmoFoundationLessonActivity sectionId="pump-and-pressure-zones" supportMode="vv" />)
    await screen.findByRole('heading', { name: /Read the settled reference/i })
    const lesson = buildFoundationStageLesson('pump-and-pressure-zones', 'vv')
    const act = lesson.steps.find((step) => step.id.endsWith('-act'))
    fireEvent.click(document.querySelector(`[data-step-id="${act?.id}"] button`) as HTMLElement)
    const run = await screen.findByRole('button', { name: 'Increase pump speed by 300 rpm' })
    const lead = document.querySelector('[data-comparison-lead]') as HTMLElement
    const teaching = document.querySelector('[data-pane="teaching"]') as HTMLElement
    const table = lead.querySelector('[data-foundation-comparison]') as HTMLElement
    expect(follows(run, table)).toBe(true)
    expect(follows(table, teaching)).toBe(true)

    fireEvent.click(run)
    const repeat = await screen.findByRole('button', { name: 'Repeat this comparison' })
    expect(lead.contains(repeat)).toBe(true)
    expect(follows(repeat, lead.querySelector('[data-foundation-comparison]') as Element)).toBe(
      true,
    )
    expect(follows(lead, teaching)).toBe(true)
  })

  it('S8-2: a drill’s question leads the card, ahead of the teaching and the simulator', async () => {
    await mountDrill('preload-drainage-collapse')
    // The opening read's one action moves the lesson to its prediction.
    fireEvent.click(nowPrimary())
    const choices = await waitFor(() => {
      const node = document.querySelector('[data-prediction-choices]')
      if (!node) throw new Error('no choices yet')
      return node
    })
    const lead = document.querySelector('[data-drill-lead]') as HTMLElement
    expect(lead.contains(choices)).toBe(true)
    expect(lead.textContent).toMatch(/Show explanation without answering/)
    const content = document.querySelector('[data-activity-content]') as HTMLElement
    expect(follows(lead, content)).toBe(true)
    // The readings the prediction is read from come before the map in the circuit panel.
    const readingsFirst = document.querySelector('[data-circuit-readings-first]')
    expect(readingsFirst).not.toBeNull()
  })

  it('C5-2: oxygenation-focus cases lead Manage with the patient monitor, and are authored as such', () => {
    expect(surfacesForStage('manage', [], { patientOxygenationFocus: true })).toEqual([
      'monitor',
      'circuit',
    ])
    expect(surfacesForStage('manage')).toEqual(['circuit'])
    for (const caseId of PRACTICE_PATIENT_OXYGENATION_FOCUS_CASES) {
      const data = clinicalPracticeScenarioById.get(caseId)?.clinicalCase?.data ?? []
      expect(data.some((point) => /SpO₂/.test(point.label) && point.trend === 'critical')).toBe(
        true,
      )
    }
  })
})

/* ------------------------------------------------------------------ *
 * C. Wide comparisons without deletion (S5-2, S5-5, S7-1, S17-1, S17-2, VA5-2, VA17-1)
 * ------------------------------------------------------------------ */

describe('C. comparisons that fit the room they have', () => {
  it('stacks teaching tables by the width of their own box and keeps every value named', () => {
    expect(flowCss).toContain('@container ecmo-table (max-width: 36rem)')
    expect(flowCss).toMatch(/\.flow table :is\(th, td\) \{\s*overflow-wrap: normal;/)
    for (const sectionId of ['vv-normal-state', 'va-normal-state'] as const) {
      const state = settled(sectionId === 'vv-normal-state' ? 'vv-reference' : 'va-reference')
      const view = render(<EcmoFoundationTeachingPanel sectionId={sectionId} state={state} />)
      const tables = view.container.querySelectorAll('[data-responsive-table] > table')
      expect(tables.length).toBeGreaterThanOrEqual(2)
      for (const cell of view.container.querySelectorAll('[data-responsive-table] td')) {
        expect(cell.getAttribute('data-column-label')).toBeTruthy()
      }
      const text = view.container.textContent ?? ''
      expect(text).not.toMatch(/serieswith|parallelwith|arterialside|[0-9]unchanged from/)
      expect(
        view.container.querySelector('[data-baseline-row="spo2"] [data-current-value]')
          ?.textContent,
      ).toMatch(/%/)
      // The row sentences are folded, not deleted.
      const sentences = view.container.querySelector('details[data-table-sentences]')
      expect(sentences?.querySelector('[data-text-equivalent]')).not.toBeNull()
      cleanup()
    }
  })

  it('lets the learner compare any explanations, with reasoning on request, and hides nothing for good', () => {
    const state = settled('vv-reference')
    const view = render(
      <EcmoFoundationTeachingPanel sectionId="vv-integration-capstone" state={state} />,
    )
    const toggles = [...view.container.querySelectorAll('[data-hypothesis-toggle]')]
    expect(toggles).toHaveLength(4)
    expect(toggles.every((toggle) => toggle.getAttribute('aria-pressed') === 'true')).toBe(true)
    // The reasoning is collapsed, in the DOM, and one press away.
    const discriminators = view.container.querySelectorAll('[data-cell-discriminator]')
    expect(discriminators.length).toBeGreaterThan(0)
    expect([...discriminators].every((node) => node.hasAttribute('hidden'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Show why each row separates them/ }))
    expect([...discriminators].some((node) => node.hasAttribute('hidden'))).toBe(false)

    // Hide three; the last shown cannot be hidden; all come back in one press.
    for (const toggle of toggles.slice(0, 3)) fireEvent.click(toggle)
    fireEvent.click(toggles[3])
    expect(toggles[3]).toHaveAttribute('aria-pressed', 'true')
    expect(
      view.container.querySelector('[data-hypothesis-column="recirculation"]'),
    ).toHaveAttribute('hidden')
    fireEvent.click(screen.getByRole('button', { name: /Show all 4/ }))
    expect(
      view.container.querySelector('[data-hypothesis-column="recirculation"]'),
    ).not.toHaveAttribute('hidden')
    // The sentence equivalents are still there, folded.
    expect(
      view.container.querySelector('details[data-matrix-sentences] [data-text-equivalent]'),
    ).not.toBeNull()
    // A full table asks for readable columns; four explanations fit a laptop's full card width.
    expect(capstoneMatrixMinimumRem(4) * 16).toBeLessThanOrEqual(1100)
  })

  it('lays the capstones out in one column so the comparison takes the card’s width', () => {
    for (const [sectionId, mode] of [
      ['vv-integration-capstone', 'vv'],
      ['va-integration-capstone', 'va'],
    ] as const) {
      const lesson = buildFoundationStageLesson(sectionId, mode)
      const recognize = lesson.steps.find((step) => step.phase === 'recognize')
      expect(ecmoTaskPresentation(lesson, recognize!)?.stacked).toBe(true)
    }
    expect(flowCss).toMatch(
      /\.content\[data-stacked='true'\] \{\s*grid-template-columns: minmax\(0, 1fr\);/,
    )
  })
})

/* ------------------------------------------------------------------ *
 * D. Circuit and VA visual teaching (S2-2, S2-3, S6-1, VA6-1, VA7-2, VA7-3, VA11-1)
 * ------------------------------------------------------------------ */

describe('D. drawings that stay true', () => {
  it('VA7-2: draws the right-arm site and the native stream’s cue on the patient’s right', () => {
    expect(VA_RIGHT_ARM_SITE.cx).toBeLessThan(CIRCUIT_MAP_BODY_MIDLINE_X)
    const numbers = VA_NATIVE_EJECTION_PATH.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    const endX = numbers[numbers.length - 2]
    expect(endX).toBeLessThan(CIRCUIT_MAP_BODY_MIDLINE_X)

    const state = createInitialSimulationState('va-lv-loading')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))
    const site = document.querySelector('[data-right-arm-site]')
    expect(Number(site?.getAttribute('cx'))).toBeLessThan(CIRCUIT_MAP_BODY_MIDLINE_X)
    const label = [...document.querySelectorAll('svg text')].find(
      (node) => node.textContent?.trim() === 'R ARM',
    )
    expect(Number(label?.getAttribute('x'))).toBeLessThan(CIRCUIT_MAP_BODY_MIDLINE_X)
    // The anterior view is said on the drawing, and the fixed marker's boundary is always visible.
    expect(document.querySelector('[data-map-view="anterior"]')?.textContent).toMatch(
      /Anterior view/,
    )
    const note = document.querySelector('[data-local-model-boundary="va-mixing-fixed"]')
    expect(note?.className).toMatch(/circuitMapNote/)
    expect(note?.className).not.toMatch(/circuitPanHint/)
  })

  it('S2-2: routes the VV return up the venous side and says red is oxygen, not an artery', () => {
    const vv = circuitMapGeometry('vv').returnCannula
    const points = (vv.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
    const xs = points.filter((_, index) => index % 2 === 0)
    const ys = points.filter((_, index) => index % 2 === 1)
    // Above the pelvis (y < 390) the VV return stays on the venous side of the trunk (the IVC is
    // drawn at x ≈ 145; the aorta at x ≈ 195).
    xs.forEach((x, index) => {
      if (ys[index] < 390) expect(x).toBeLessThan(170)
    })
    const state = settled('vv-reference')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))
    expect(document.querySelector('[data-legend-return-note]')?.textContent).toMatch(
      /red marks oxygenated blood; in VV it returns into a vein, not an artery/,
    )
    // Labels the walkthrough found under plates are out from under them.
    const anchors = (text: string) =>
      [...document.querySelectorAll('svg text')].find((node) =>
        (node.textContent ?? '').replace(/\s+/g, ' ').includes(text),
      )
    const gas = anchors('GAS EXHAUST')
    expect(Number(gas?.getAttribute('x'))).toBeLessThan(700)
    const access = anchors('PRE-OXYGENATOR ACCESS')
    expect(Number(access?.getAttribute('y'))).toBeGreaterThan(400)
    // Readable map type and a halo for labels that must cross a line.
    expect(ruleBody(ecmoCss, '.circuitSvg text')).toContain('paint-order: stroke fill')
    expect(ruleBody(ecmoCss, '.circuitSvg text')).toContain('font-size: 12px')
  })

  it('offers the circuit at full width from the keyboard, in the flowing layout only', () => {
    const state = settled('vv-reference')
    const view = render(
      <CircuitAndMonitors
        state={state}
        dispatch={jest.fn()}
        controlsEnabled={false}
        circuitFit="pane"
      />,
    )
    const toggle = screen.getByRole('button', { name: 'Show the circuit at full width' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(view.container.querySelector('#cardiohelp-circuit-panel')).toHaveAttribute(
      'data-circuit-enlarged',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Show the circuit beside the task' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(flowCss).toContain(".content:has([data-circuit-enlarged='true'])")
  })

  it('S2-3: scene labels are legible, pushed-back labels stay readable, and the mode pill has contrast', () => {
    expect(ruleBody(ecmoCss, '.circuit3dSceneLabel')).toContain('font-size: 0.75rem')
    const receded = ruleBody(ecmoCss, ".circuit3dSceneLabel[data-emphasis='receded']")
    const opacity = Number(/opacity: ([\d.]+)/.exec(receded)?.[1])
    expect(opacity).toBeGreaterThanOrEqual(0.85)
    expect(ruleBody(ecmoCss, '.circuit3dHud span[data-mode]')).toContain(
      'background: rgba(3, 20, 24, 0.95)',
    )
    expect(ruleBody(ecmoCss, '.circuit3dHud small')).toContain('font-size: 0.75rem')
  })

  it('S2-3: a pill keeps whole words inside drei’s zero-width wrapper, whatever the flow sets', () => {
    // The Learn flow's overflow-wrap: anywhere reaches the scene; inside a 0 px wrapper it broke
    // every pill into one letter per line on the real WebGL path.
    const pill = ruleBody(ecmoCss, '.circuit3dSceneLabel')
    expect(pill).toContain('overflow-wrap: normal')
    expect(pill).toContain('width: max-content')
    expect(pill).toContain('translateY(var(--scene-label-offset, calc(-50% - 0.9rem)))')
    expect(ruleBody(ecmoCss, '.circuit3dSceneLabel::after')).toContain(
      'height: var(--scene-label-leader, 0.9rem)',
    )
    expect(ruleBody(ecmoCss, ".circuit3dSceneLabel[data-leader='below']::after")).toContain(
      'bottom: 100%',
    )
  })

  it('S2-3: moves a pill along its own leader until it clears pills and overlays, never its anchor', () => {
    const pill = { width: 120, height: 24 }
    const leader = 14
    const top = (placement: { offsetY: number } | undefined) => placement!.offsetY - pill.height / 2
    // Apart: every pill rests above its anchor on the resting leader.
    const apart = placeSceneLabels(
      [
        { id: 'a', x: 100, y: 300, ...pill },
        { id: 'b', x: 400, y: 300, ...pill },
      ],
      { restingLeader: leader },
    )
    for (const placement of apart.values()) {
      expect(placement).toEqual({ side: 'above', leader, offsetY: -(leader + pill.height / 2) })
    }
    // Crowded: the lower anchor keeps its rest; the other takes the shorter clear move.
    const crowded = placeSceneLabels(
      [
        { id: 'upper', x: 160, y: 290, ...pill },
        { id: 'lower', x: 150, y: 300, ...pill },
      ],
      { restingLeader: leader, bounds: { width: 600, height: 600 } },
    )
    expect(crowded.get('lower')).toMatchObject({ side: 'above', leader })
    const upper = crowded.get('upper')!
    const lowerTop = 300 - leader - pill.height
    const upperTop = 290 + top(upper)
    const clear =
      upperTop + pill.height <= lowerTop - SCENE_LABEL_GAP_PX + 1 ||
      upperTop >= 300 - leader + SCENE_LABEL_GAP_PX - 1
    expect(clear).toBe(true)
    // It moved: to the free side of its own anchor, or further up its leader.
    expect(upper.side === 'below' || upper.leader > leader).toBe(true)
    // The pill a teaching step points at is placed first, so it is the one that stays put.
    const emphasised = placeSceneLabels(
      [
        { id: 'upper', x: 160, y: 290, ...pill },
        { id: 'lower', x: 150, y: 300, ...pill },
      ],
      { priorityIds: ['upper'], restingLeader: leader },
    )
    expect(emphasised.get('upper')).toMatchObject({ side: 'above', leader })
    const lower = emphasised.get('lower')!
    expect(lower.side === 'below' || lower.leader > leader).toBe(true)
    // An overlay over the resting place (the HUD) sends the pill below its anchor when above would
    // leave the canvas.
    const underHud = placeSceneLabels([{ id: 'site', x: 150, y: 60, ...pill }], {
      restingLeader: leader,
      obstacles: [{ left: 0, right: 300, top: 0, bottom: 50 }],
      bounds: { width: 600, height: 400 },
    })
    expect(underHud.get('site')).toMatchObject({ side: 'below', leader })
    // A leader never grows past the cap.
    const many = placeSceneLabels(
      Array.from({ length: 16 }, (_, index) => ({ id: `p${index}`, x: 150, y: 300, ...pill })),
      { restingLeader: leader },
    )
    expect(Math.max(...[...many.values()].map((placement) => placement.leader))).toBe(
      leader + SCENE_LABEL_MAX_SHIFT_PX,
    )
  })

  it('S2-3: the HUD and the labels toggle are the overlays a pill steers around', () => {
    const source = read('src/features/cardiohelp-ecmo/components/EcmoCircuit3D.tsx')
    expect(source).toContain('data-scene-label-host')
    expect(source.match(/data-scene-label-obstacle/g)).toHaveLength(2)
  })

  it('S6-1: draws the VV series loop with its recirculation short-circuit, labelled schematic', () => {
    const state = settled('vv-reference')
    const view = render(
      <EcmoFoundationTeachingPanel sectionId="vv-series-physiology" state={state} />,
    )
    const diagram = view.container.querySelector('[data-concept-diagram="vv-series-loop"]')
    expect(diagram).not.toBeNull()
    expect(diagram?.querySelectorAll('[data-series-node]')).toHaveLength(7)
    expect(diagram?.querySelector('[data-recirculation-path]')).not.toBeNull()
    expect(diagram?.querySelector('[data-schematic-label]')?.textContent).toMatch(
      /Schematic · not to scale/,
    )
    // The teaching list stays; the diagram is added, not substituted.
    expect(view.container.querySelectorAll('[data-series-stage]')).toHaveLength(7)
  })

  it('VA6-1 / VA11-1: a conceptual aorta that names both streams and never claims a computed meeting place', () => {
    const state = settled('va-reference')
    const view = render(
      <EcmoFoundationTeachingPanel sectionId="va-parallel-physiology" state={state} />,
    )
    const diagram = view.container.querySelector('[data-concept-diagram="va-aortic-streams"]')
    expect(diagram).not.toBeNull()
    expect(diagram).toHaveAttribute('data-conceptual', 'true')
    const text = diagram?.textContent ?? ''
    for (const phrase of [
      /Native stream/,
      /Circuit return/,
      /Arch branches/,
      /Coronary origins/,
      /Right-radial/,
      /not computed/,
      /does not locate the mixing region or establish what the coronary\s+arteries receive/,
      /Schematic · not to scale · conceptual/,
    ]) {
      expect(text).toMatch(phrase)
    }
    // Switching the illustration moves the band; nothing reads a live value.
    expect(diagram).toHaveAttribute('data-mixing-band-position', 'distal')
    fireEvent.click(
      within(diagram as HTMLElement).getByLabelText(VA_MIXING_ILLUSTRATIONS[1].choice),
    )
    expect(diagram).toHaveAttribute('data-mixing-band-position', 'proximal')
    for (const illustration of VA_MIXING_ILLUSTRATIONS) {
      expect(illustration.caption).not.toMatch(/\d/)
    }
    // The diagram the section's sentence names now exists above that sentence.
    const note = view.container.querySelector('[data-configuration-diagram-note]')
    expect(follows(diagram as Element, note as Element)).toBe(true)
    cleanup()

    const differential = render(
      <VaDifferentialHypoxemiaPanel
        state={createInitialSimulationState('va-differential-hypoxemia')}
      />,
    )
    expect(
      differential.container.querySelector('[data-concept-diagram="va-aortic-streams"]'),
    ).not.toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * Phone chrome and narrow text (Figure 23; Prompt-01 observation)
 * ------------------------------------------------------------------ */

describe('phone chrome', () => {
  function withPhone(matches: boolean, run: () => void) {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: matches && query === '(max-width: 600px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
    try {
      run()
    } finally {
      window.matchMedia = original
    }
  }

  it('folds track switch and restart into one disclosure on a phone, keeping section, help and exit', () => {
    withPhone(true, () => {
      render(
        <EcmoSectionHeader
          kicker="VV track · Section 4 of 17"
          title="The control panel"
          trackToggle={<div role="radiogroup" aria-label="ECMO support mode" />}
          sectionsControl={<button type="button">Sections</button>}
          onHelp={() => {}}
          onRestart={() => {}}
          restartLabel="Restart section"
          onSaveAndExit={() => {}}
        />,
      )
      const more = document.querySelector('details[data-ecmo-header-more]')
      expect(more).not.toBeNull()
      expect(more?.querySelector('[role="radiogroup"]')).not.toBeNull()
      expect(
        within(more as HTMLElement).getByRole('button', { name: 'Restart section' }),
      ).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Sections' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'What do I do now?' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Save & exit/ })).toBeInTheDocument()
    })
  })

  it('keeps the wide header unchanged elsewhere', () => {
    withPhone(false, () => {
      render(
        <EcmoSectionHeader
          kicker="VV track"
          title="The control panel"
          trackToggle={<div role="radiogroup" aria-label="ECMO support mode" />}
          onRestart={() => {}}
        />,
      )
      expect(document.querySelector('details[data-ecmo-header-more]')).toBeNull()
      expect(screen.getByRole('radiogroup', { name: 'ECMO support mode' })).toBeInTheDocument()
    })
  })

  it('lets no single word widen the page, while table cells keep whole words', () => {
    expect(ruleBody(flowCss, '.flow')).toContain('overflow-wrap: anywhere')
    expect(ruleBody(ecmoCss, '.trackToggle')).toContain('max-width: 100%')
    expect(ruleBody(ecmoCss, '.trackToggle')).toContain('flex-wrap: wrap')
  })
})
