import { fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { EcmoFoundationTeachingPanel } from '../components/teaching/EcmoFoundationTeachingPanel'
import { EcmoDrillTeachingPanel } from '../components/teaching/EcmoDrillTeachingPanel'
import { DrillStepTeaching } from '../components/stage/DrillStepTeaching'
import type { StageStep } from '../components/stage/stageModel'
import { ecmoCircuitWalkStopsForSection } from '../content/circuitWalk'
import { ecmoDrillSpecs } from '../content/drillSpecs'
import { evidenceById } from '../content/evidence'
import { ecmoFoundationLearningItemsFor } from '../content/foundationLearningItems'
import {
  ecmoInteractiveFoundationSectionIds,
  ecmoFoundationSupportMode,
  type EcmoInteractiveFoundationSectionId,
} from '../content/foundationLessonRuntime'
import { ecmoReferenceProfileForMode } from '../content/referenceProfiles'
import { cardiohelpScenarioById } from '../content/scenarios'
import {
  ecmoDrillStageSources,
  ecmoFoundationStageSources,
  ecmoStageSources,
} from '../content/stageSources'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
} from '../engine'
import type { EcmoSimulationState, SupportMode } from '../engine/types'

/**
 * The stage cites a lesson's sources in one place, so that one place has to be complete.
 *
 * `content/stageSources.ts` derives the set from the content registries rather than collecting it
 * from the panes at render, which keeps the footer out of every surface's render path — and puts
 * the whole risk in one place: a panel that starts citing something the derivation does not know
 * about would silently lose its provenance.
 *
 * So this mounts every teaching panel with its own lists rendering — outside the stage, where the
 * scope does not suppress them — reads the evidence ids straight off the markup, and fails if any
 * of them is missing from the set collected for that lesson. The panels are the authority on what
 * they cite; the derivation only has to keep up with them.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

jest.mock('../components/EcmoCircuit3D', () => ({
  EcmoCircuit3D: () => <div data-testid="ecmo-circuit-3d" />,
}))

function settledReference(supportMode: SupportMode, seconds = 8): EcmoSimulationState {
  let state = createReferenceSimulationState(ecmoReferenceProfileForMode(supportMode).id)
  for (let tick = 0; tick < seconds; tick += 1)
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

function settledDrill(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, 'guided')
  for (let tick = 0; tick < steps; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

function renderedIds(root: ParentNode): string[] {
  return [...root.querySelectorAll('[data-evidence-id]')].map(
    (node) => node.getAttribute('data-evidence-id') ?? '',
  )
}

const FOUNDATION_IDS =
  ecmoInteractiveFoundationSectionIds as readonly EcmoInteractiveFoundationSectionId[]
const DRILL_IDS = Object.keys(ecmoDrillSpecs)

describe('the set the stage footer cites', () => {
  it('covers every interactive section and every drill', () => {
    expect(FOUNDATION_IDS.length).toBeGreaterThan(0)
    expect(DRILL_IDS).toHaveLength(20)
  })

  it.each(FOUNDATION_IDS)('holds every source the %s panel cites', (sectionId) => {
    const supportMode = ecmoFoundationSupportMode(sectionId, 'vv')
    const collected = new Set(ecmoFoundationStageSources(sectionId).evidenceIds)
    const { container } = render(
      <EcmoFoundationTeachingPanel sectionId={sectionId} state={settledReference(supportMode)} />,
    )
    const missing = [...new Set(renderedIds(container))].filter((id) => !collected.has(id))
    expect(`${sectionId}: ${missing.join(', ') || 'nothing missing'}`).toBe(
      `${sectionId}: nothing missing`,
    )
  })

  it.each(FOUNDATION_IDS)('holds both of the %s items’ sources', (sectionId) => {
    const collected = new Set(ecmoFoundationStageSources(sectionId).evidenceIds)
    const items = ecmoFoundationLearningItemsFor(sectionId)
    for (const item of [items.prediction, items.transfer]) {
      for (const id of item.evidenceIds) {
        expect(`${sectionId}/${item.id}: ${collected.has(id) ? 'held' : id}`).toBe(
          `${sectionId}/${item.id}: held`,
        )
      }
    }
  })

  it.each(FOUNDATION_IDS)('holds every source the %s walk stops cite', (sectionId) => {
    const collected = new Set(ecmoFoundationStageSources(sectionId).evidenceIds)
    for (const stop of ecmoCircuitWalkStopsForSection(sectionId)) {
      for (const id of stop.sourceIds) {
        expect(`${stop.id}: ${collected.has(id) ? 'held' : id}`).toBe(`${stop.id}: held`)
      }
    }
  })

  it.each(DRILL_IDS)('holds every source the %s drill surfaces cite', (scenarioId) => {
    const collected = new Set(ecmoDrillStageSources(scenarioId).evidenceIds)
    const explain: StageStep = {
      id: `${scenarioId}-explain`,
      ordinal: 1,
      phase: 'explain',
      title: 'Explain',
      instruction: '',
      actionLabel: '',
      interaction: { kind: 'read' },
      focusTarget: null,
      surfaces: [],
      teaching: { prose: 'none', blocks: 'all' },
      gate: 'after-prediction',
    }
    const { container } = render(
      <DrillStepTeaching
        scenario={cardiohelpScenarioById.get(scenarioId)}
        step={explain}
        predictionCommitted
        hasAuthoredPanel={false}
      />,
    )
    const missing = [...new Set(renderedIds(container))].filter((id) => !collected.has(id))
    expect(`${scenarioId}: ${missing.join(', ') || 'nothing missing'}`).toBe(
      `${scenarioId}: nothing missing`,
    )
  })

  it('holds every source the authored drill panels cite, once their reveal has been earned', () => {
    for (const scenarioId of DRILL_IDS) {
      const collected = new Set(ecmoDrillStageSources(scenarioId).evidenceIds)
      const { container, unmount } = render(
        <EcmoDrillTeachingPanel state={settledDrill(scenarioId)} />,
      )
      const missing = [...new Set(renderedIds(container))].filter((id) => !collected.has(id))
      expect(`${scenarioId}: ${missing.join(', ') || 'nothing missing'}`).toBe(
        `${scenarioId}: nothing missing`,
      )
      unmount()
    }
  })

  it('resolves every id it collects, and cites nothing twice', () => {
    for (const sectionId of [...FOUNDATION_IDS, ...DRILL_IDS]) {
      const { evidenceIds, claims } = ecmoStageSources(sectionId)
      expect(`${sectionId}: ${evidenceIds.length}`).toBe(
        `${sectionId}: ${new Set(evidenceIds).size}`,
      )
      for (const id of evidenceIds) {
        expect(`${sectionId}/${id}: ${evidenceById.has(id) ? 'registered' : 'unregistered'}`).toBe(
          `${sectionId}/${id}: registered`,
        )
      }
      // A claim belongs to a source the lesson actually cites.
      for (const id of Object.keys(claims)) {
        expect(`${sectionId}/${id}: cited`).toBe(
          `${sectionId}/${id}: ${evidenceIds.includes(id) ? 'cited' : 'orphan claim'}`,
        )
      }
    }
  })

  it('keeps every claim a surface makes, including two claims on one source', () => {
    // The pressure sections cite the four rows, and one record supports more than one row.
    const { claims } = ecmoFoundationStageSources('pump-and-pressure-zones')
    const multiple = Object.values(claims).filter((entries) => entries.length > 1)
    expect(multiple.length).toBeGreaterThan(0)
    for (const entries of Object.values(claims)) {
      expect(entries).toEqual([...new Set(entries)])
    }
  })
})

describe('where the stage puts them', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true }),
    })
  })

  function mount(sectionId: EcmoInteractiveFoundationSectionId) {
    return render(
      <EcmoFoundationLessonActivity
        sectionId={sectionId}
        supportMode={ecmoFoundationSupportMode(sectionId, 'vv')}
        initialPhase="recognize"
      />,
    )
  }

  it('cites the lesson once, in the footer, folded, and nowhere in the panes', () => {
    const { container } = mount('circuit-flow-path')
    const blocks = container.querySelectorAll('[data-ecmo-source-list]')
    expect(blocks).toHaveLength(1)
    const details = container.querySelector<HTMLDetailsElement>('[data-stage-sources]')
    expect(details).not.toBeNull()
    // Below the module: inside the shell's footer row, after the body that holds the panes.
    expect(details?.closest('[data-simulator-surfaces]')).toBeNull()
    expect(details?.closest('[data-pane]')).toBeNull()
    expect(blocks[0].closest('[data-stage-sources]')).toBe(details)
    // Shut, until someone wants it.
    expect(details?.open).toBe(false)
    // And less prominent: a footnote row per source, not a bordered card with a class chip.
    expect(container.querySelector('[data-citation-density="footnote"]')).not.toBeNull()
    expect(container.querySelector('[data-citation-density="card"]')).toBeNull()
  })

  it('says how many there are, and holds exactly the lesson’s set', () => {
    const { container } = mount('why-extracorporeal-support')
    const expected = ecmoFoundationStageSources('why-extracorporeal-support').evidenceIds
    const details = container.querySelector('[data-stage-sources]')
    expect(details?.querySelector('summary')?.textContent).toContain(String(expected.length))
    expect(renderedIds(details as ParentNode)).toEqual([...expected])
  })

  it('names the sources before the prediction and says what they are cited for after it', () => {
    const { container } = mount('why-extracorporeal-support')
    const details = () => container.querySelector('[data-stage-sources]')

    // Before: titles and references, no claim and no limit — a record's supports sentence names
    // the mechanism it is registered for, which is the thing the prediction is asking about.
    expect(details()).toHaveAttribute('data-stage-sources-claims', 'false')
    expect(details()?.querySelector('[data-citation-supports]')).toBeNull()
    expect(details()?.querySelector('[data-citation-limit]')).toBeNull()
    expect(details()?.querySelector('[data-stage-sources-note]')).not.toBeNull()
    // The titles are there either way, so provenance is never withheld outright.
    expect(details()?.querySelectorAll('[data-citation-title]').length).toBeGreaterThan(0)

    // Committing is what unfolds them, so get to the prediction the way a learner does.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    // The prediction's own radios, not the track chooser's, which also uses the radio role.
    const choice = container.querySelector<HTMLInputElement>('[data-prediction-choices] input')
    expect(choice).not.toBeNull()
    fireEvent.click(choice as HTMLInputElement)
    fireEvent.click(screen.getByRole('button', { name: 'Commit this prediction' }))

    expect(details()).toHaveAttribute('data-stage-sources-claims', 'true')
    expect(details()?.querySelector('[data-citation-supports]')).not.toBeNull()
    expect(details()?.querySelector('[data-stage-sources-note]')).toBeNull()
  })
})
