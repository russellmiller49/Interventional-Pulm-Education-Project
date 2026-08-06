import { fireEvent, render, screen, within } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'

import { CrrtLivePressureDevice } from '../components/CrrtLivePressureDevice'
import { CrrtPilotCircuit } from '../components/CrrtPilotCircuit'
import { crrtPressureSignalIds, type CrrtPressureSignalId } from '../content/circuitModel'
import {
  createInitialPrismaxPilotInterfaceState,
  selectPrismaxPilotCaseOperationsDisplay,
} from '../engine/deviceAdapters/prismax'
import { createInitialCrrtSimulationState } from '../engine/initialState'
import {
  advance,
  crrtLivePressureReviewStates,
  runningState,
  withBloodFlow,
} from '../engine/testSupport/livePressureStates'
import type { CrrtSimulationState } from '../engine/types'

const ui = createInitialPrismaxPilotInterfaceState()

function operationsFor(state: CrrtSimulationState) {
  return selectPrismaxPilotCaseOperationsDisplay(ui, state)
}

function reviewState(id: string): CrrtSimulationState {
  const found = crrtLivePressureReviewStates().find((entry) => entry.id === id)
  if (!found) throw new Error(`No review state ${id}`)
  return found.state
}

function renderProfile(state: CrrtSimulationState, selected: CrrtPressureSignalId = 'access') {
  const onSelect = jest.fn()
  const view = render(
    <CrrtLivePressureDevice
      operations={operationsFor(state)}
      selectedSignalId={selected}
      onSelectSignal={onSelect}
    />,
  )
  return { ...view, onSelect }
}

describe('live pressure profile — direct sites versus calculated relationships', () => {
  it('names four sites and two relationships in words, not only by styling', () => {
    renderProfile(runningState())
    expect(screen.getAllByText('Directly modelled site')).toHaveLength(5) // 4 cards + the open detail
    expect(screen.getAllByText('Calculated relationship')).toHaveLength(2)
  })

  it('says a relationship has no place of its own, and names what it is built from', () => {
    renderProfile(runningState(), 'tmp')
    expect(screen.getByText(/Nowhere\. TMP has no transducer of its own/)).toBeInTheDocument()
    expect(
      screen.getByText(/Read those first — there is no transducer here to go and inspect/),
    ).toBeInTheDocument()
  })

  it('gives a direct site a physical location instead', () => {
    renderProfile(runningState(), 'access')
    // Twice on purpose: once visibly, once in the text equivalent.
    expect(
      screen.getAllByText(/On the access line, between the access lumen and the blood pump/).length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('supplies no target, normal range, or alarm threshold', () => {
    const { container } = renderProfile(runningState())
    const text = container.textContent ?? ''
    assertNoUniversalTargetLanguage(text)
    // The only mention of a normal range is the sentence refusing to give one.
    expect(text).toMatch(/supplies no target, no normal range, and no alarm setting/i)
    expect(text.match(/normal range/gi)).toHaveLength(1)
    expect(text).not.toMatch(/\bshould be (?:below|above)\b/i)
    expect(text).not.toMatch(/\b(?:target|threshold|limit) of \d/i)
  })
})

describe('live pressure profile — live behaviour', () => {
  it('changes what it shows when a supported engine input changes', () => {
    const base = runningState()
    const faster = advance(withBloodFlow(base, 180), 1_800)

    const first = render(
      <CrrtLivePressureDevice
        operations={operationsFor(base)}
        selectedSignalId="access"
        onSelectSignal={() => {}}
      />,
    )
    const baseText = first.container.textContent ?? ''
    first.unmount()

    const second = renderProfile(faster)
    const fasterText = second.container.textContent ?? ''

    expect(baseText).toContain('120 mL/min')
    expect(fasterText).toContain('180 mL/min')
    expect(baseText).not.toEqual(fasterText)
  })

  it('does not call a flow-driven change an obstruction', () => {
    const faster = advance(withBloodFlow(runningState(), 180), 1_800)
    const { container } = renderProfile(faster)
    const text = container.textContent ?? ''
    // Every mention of obstruction here is a denial that one has occurred.
    expect(text).toMatch(
      /A value that moves after a flow change is not by itself evidence of a new obstruction/i,
    )
    expect(text).toMatch(
      /A more negative access pressure after a blood-flow increase is not by itself evidence of a new obstruction/i,
    )
    for (const sentence of text.split(/(?<=\.)\s*/)) {
      if (/obstruct/i.test(sentence))
        expect([sentence, /\bnot\b/i.test(sentence)]).toEqual([sentence, true])
    }
  })

  it('says the pump is stopped rather than presenting zero-flow values as readings', () => {
    const { container } = renderProfile(reviewState('stopped-therapy'))
    expect(screen.getByText('Therapy paused')).toBeInTheDocument()
    expect(
      screen.getByText(/read them as the circuit at rest, not as a treatment reading/i),
    ).toBeInTheDocument()
    // The engine really does still publish numbers here.
    expect(container.textContent).toMatch(/5 mmHg/)
  })

  it('renders an unavailable pressure as unavailable, never as zero', () => {
    renderProfile(createInitialCrrtSimulationState())
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(6)
    for (const card of screen.getAllByRole('button')) {
      expect(card.textContent).not.toMatch(/\b0 mmHg\b/)
    }
    expect(screen.getByText(/not a reading of zero/i)).toBeInTheDocument()
  })

  it('draws a recorded series only where the model kept one', () => {
    const { container: withHistory } = renderProfile(runningState(), 'access')
    expect(withHistory.querySelector('svg')).not.toBeNull()
    expect(screen.getByText(/points the model kept, one every 5 minutes/)).toBeInTheDocument()

    const withoutHistory = render(
      <CrrtLivePressureDevice
        operations={operationsFor(runningState())}
        selectedSignalId="effluent"
        onSelectSignal={() => {}}
      />,
    )
    expect(
      within(withoutHistory.container).getAllByText(/current value only/i).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      within(withoutHistory.container).getByText(/Effluent pressure: current value only/),
    ).toBeInTheDocument()
  })

  it('never invents a series for a channel the model does not sample', () => {
    for (const id of ['effluent', 'filter-drop'] as const) {
      const view = render(
        <CrrtLivePressureDevice
          operations={operationsFor(runningState())}
          selectedSignalId={id}
          onSelectSignal={() => {}}
        />,
      )
      expect(view.container.querySelector('svg')).toBeNull()
      view.unmount()
    }
  })
})

describe('live pressure profile — keyboard and text equivalent', () => {
  it('exposes every channel as a keyboard-operable control with a pressed state', () => {
    const { onSelect } = renderProfile(runningState(), 'filter')
    const group = screen.getByRole('group', {
      name: /Pressure channels; select one to see where it comes from/,
    })
    const buttons = within(group).getAllByRole('button')
    expect(buttons).toHaveLength(crrtPressureSignalIds.length)
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)

    const tmp = buttons.find((b) => b.textContent?.includes('TMP'))!
    fireEvent.click(tmp)
    expect(onSelect).toHaveBeenCalledWith('tmp')
  })

  it('has no nested interactive element inside a channel control', () => {
    renderProfile(runningState())
    for (const button of screen.getAllByRole('button')) {
      expect(button.querySelector('button, a, input, select, textarea')).toBeNull()
    }
  })

  it('puts every visible value and state into the text equivalent', () => {
    const state = runningState()
    const { container } = renderProfile(state, 'tmp')
    const summary = container.querySelector('.liveVisuallyHidden')?.textContent ?? ''

    for (const signal of operationsFor(state).pressureSignals) {
      expect(summary).toContain(signal.label)
      expect(summary).toContain(`${Math.round(signal.valueMmHg!)} millimetres of mercury`)
    }
    expect(summary).toContain('Directly modelled site')
    expect(summary).toContain('Calculated relationship')
    expect(summary).toMatch(/Selected: TMP, a calculated relationship/)
    expect(summary).toMatch(/current value only, no recorded series/)
  })
})

describe('live pressure profile — circuit linkage', () => {
  function renderLinked(selected: CrrtPressureSignalId) {
    const state = runningState()
    const operations = operationsFor(state)
    return render(
      <CrrtLivePressureDevice
        operations={operations}
        selectedSignalId={selected}
        onSelectSignal={() => {}}
      >
        <CrrtPilotCircuit
          running={true}
          setReady={true}
          fluidsReady={true}
          bloodFlowMlMin={operations.treatmentContext.bloodFlowMlMin}
          dialysateFlowMlHour={operations.treatmentContext.dialysateFlowMlHour}
          patientFluidRemovalMlHour={operations.treatmentContext.patientFluidRemovalMlHour}
          flows={operations.flows}
          initialOverlayId="pressure-profile"
          highlightedSignalId={selected}
          pressure={{
            access: operations.pressures.accessPressureMmHg,
            filter: operations.pressures.filterPressureMmHg,
            return: operations.pressures.returnPressureMmHg,
            effluent: operations.pressures.effluentPressureMmHg,
            TMP: operations.pressures.transmembranePressureMmHg,
            filterDrop: operations.pressures.filterPressureDropMmHg,
          }}
        />
      </CrrtLivePressureDevice>,
    )
  }

  function highlightedNodes(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[data-highlighted="true"]')].map(
      (node) => node.getAttribute('data-node') ?? '',
    )
  }

  it('marks a direct site at its own circuit node', () => {
    const expected: Readonly<Record<string, string>> = {
      access: 'access-pressure',
      filter: 'filter-pressure',
      return: 'return-pressure',
      effluent: 'effluent-pressure',
    }
    for (const [signalId, nodeId] of Object.entries(expected)) {
      const view = renderLinked(signalId as CrrtPressureSignalId)
      expect(highlightedNodes(view.container)).toEqual([nodeId])
      view.unmount()
    }
  })

  it('marks the contributing sites for a relationship and gives it no node', () => {
    const tmp = renderLinked('tmp')
    expect(highlightedNodes(tmp.container)).toEqual([
      'filter-pressure',
      'return-pressure',
      'effluent-pressure',
    ])
    expect(tmp.container.querySelector('[data-node="tmp"]')).toBeNull()
    tmp.unmount()

    const drop = renderLinked('filter-drop')
    expect(highlightedNodes(drop.container)).toEqual(['filter-pressure', 'return-pressure'])
    expect(drop.container.querySelector('[data-node="filter-drop"]')).toBeNull()
    drop.unmount()
  })

  it('keeps every circuit coordinate fixed across all six selections', () => {
    const coordinates = crrtPressureSignalIds.map((signalId) => {
      const view = renderLinked(signalId)
      const nodes = [...view.container.querySelectorAll('[data-node]')].map(
        (node) => `${node.getAttribute('data-node')}:${node.getAttribute('transform')}`,
      )
      view.unmount()
      return nodes.join('|')
    })
    expect(new Set(coordinates).size).toBe(1)
  })

  it('names the selected pressure and its kind in the circuit text equivalent', () => {
    const view = renderLinked('filter-drop')
    expect(view.container.textContent).toMatch(
      /Selected pressure: Filter pressure drop, a calculated relationship with no site of its own/,
    )
    view.unmount()

    const site = renderLinked('return')
    expect(site.container.textContent).toMatch(
      /Selected pressure: Return pressure, a directly modelled site, marked on this circuit/,
    )
    site.unmount()
  })
})

describe('live pressure profile — architecture', () => {
  const componentDirectory = join(process.cwd(), 'src/features/baxter-crrt/components')

  /**
   * The rule the package exists to hold: a presentation component may format a
   * value, but it may not work one out. If this fails, something started doing
   * clinical arithmetic in React instead of extending the adapter.
   */
  it('reaches no pressure or fluid arithmetic from the live surface', () => {
    const forbidden = [
      /engine\/pressureModel/,
      /engine\/clinicalMath/,
      /engine\/fluidModel/,
      /engine\/soluteModel/,
      /circuitFluidLedger/,
      /deviceAdapters\/calculations/,
    ]
    for (const entry of ['CrrtLivePressureDevice.tsx', 'CrrtLivePressureStation.tsx']) {
      const source = readFileSync(join(componentDirectory, entry), 'utf8')
      const imports = [...source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)].map(
        (match) => match[1],
      )
      for (const pattern of forbidden) {
        expect([entry, imports.filter((specifier) => pattern.test(specifier))]).toEqual([entry, []])
      }
    }
  })

  it('does not restate either display offset in the presentation layer', () => {
    for (const entry of ['CrrtLivePressureDevice.tsx', 'CrrtLivePressureStation.tsx']) {
      const source = readFileSync(join(componentDirectory, entry), 'utf8')
      expect(source).not.toMatch(/-\s*18\b/)
      expect(source).not.toMatch(/-\s*25\b/)
      expect(source).not.toMatch(/HYDROSTATIC_OFFSET/)
    }
  })

  it('takes its pressures only from the adapter view model', () => {
    const source = readFileSync(join(componentDirectory, 'CrrtLivePressureDevice.tsx'), 'utf8')
    // No direct reach into engine state; the component never sees a simulation.
    expect(source).not.toMatch(/circuit\.pressures/)
    expect(source).not.toMatch(/prismaxTransmembranePressureMmHg/)
    expect(source).not.toMatch(/\.trends\b/)
  })

  it('publishes no withheld fluid-conservation quantity', () => {
    const { container } = renderProfile(runningState())
    expect(container.textContent).not.toMatch(/patient fluid balance/i)
    expect(container.textContent).not.toMatch(/machine removal/i)
    const source = readFileSync(join(componentDirectory, 'CrrtLivePressureDevice.tsx'), 'utf8')
    expect(source).not.toMatch(/cumulativeMachinePatientFluidRemovalMl/)
    expect(source).not.toMatch(/cumulativeWholePatientBalanceMl/)
  })

  it('claims no exact-device fidelity', () => {
    const { container } = renderProfile(runningState())
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/menu|softkey|press the .* button|alarm limit|alarm threshold/i)
    expect(text).toMatch(
      /belongs to the manufacturer(?:’|')s instructions and your local training/i,
    )
  })

  it('uses no developer vocabulary in learner copy', () => {
    const { container } = renderProfile(runningState())
    const text = container.textContent ?? ''
    for (const word of [
      'adapter',
      'registry',
      'reducer',
      'observer',
      'source ID',
      'DTO',
      'runtime state',
      'C4',
    ]) {
      expect([word, text.includes(word)]).toEqual([word, false])
    }
  })
})

describe('live pressure profile — stylesheet contract', () => {
  it('encodes focus, 44-pixel targets, responsive reflow, and reduced motion', () => {
    const directory = join(process.cwd(), 'src/features/baxter-crrt/components')
    for (const file of [
      'crrt-live-pressure-device.module.css',
      'crrt-live-pressure-station.module.css',
    ]) {
      const css = readFileSync(join(directory, file), 'utf8')
      expect(css).toContain('focus-visible')
      expect(css).toContain('min-height: 44px')
      expect(css).toContain('@media (max-width: 780px)')
      expect(css).toContain('@media (prefers-reduced-motion: reduce)')
      expect(css).toContain('min-width: 0')
      expect(css).toContain('@media (forced-colors: active)')
    }
  })

  it('separates the two kinds by border treatment, not colour alone', () => {
    const css = readFileSync(
      join(
        process.cwd(),
        'src/features/baxter-crrt/components/crrt-live-pressure-device.module.css',
      ),
      'utf8',
    )
    expect(css).toMatch(/\[data-kind='directly-modelled-site'\][\s\S]*?border-left: 4px solid/)
    expect(css).toMatch(/\[data-kind='calculated-relationship'\][\s\S]*?border-left: 4px dashed/)
    expect(css).toMatch(/\[data-selected='true'\][\s\S]*?border-left-width: 9px/)
  })

  it('marks a highlighted circuit node without moving it', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/features/baxter-crrt/components/crrt-pilot-circuit.module.css'),
      'utf8',
    )
    expect(css).toMatch(/\[data-highlighted='true'\]/)
    // A transform here would shift a node that every other view keeps fixed.
    expect(css).not.toMatch(/\[data-highlighted='true'\][^{]*\{[^}]*transform:/)
  })
})

describe('live pressure profile — composition', () => {
  it('is reachable from the Learn surface', () => {
    const reachable = collectLocalTypeScriptDependencies(
      join(process.cwd(), 'src/features/baxter-crrt/components/BaxterCrrtLearn.tsx'),
    )
    const graph = [...reachable].join('\n')
    expect(graph).toMatch(/CrrtLivePressureStation/)
    expect(graph).toMatch(/CrrtLivePressureDevice/)
  })
})

function collectLocalTypeScriptDependencies(entry: string): Set<string> {
  const visited = new Set<string>()
  function visit(file: string) {
    if (visited.has(file)) return
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)) {
      const dependency = resolveLocalTypeScriptImport(file, match[1])
      if (dependency) visit(dependency)
    }
  }
  visit(entry)
  return visited
}

function resolveLocalTypeScriptImport(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith('.')
    ? resolve(dirname(fromFile), specifier)
    : specifier.startsWith('@/')
      ? join(process.cwd(), 'src', specifier.slice(2))
      : null
  if (!base) return null
  const candidates =
    base.endsWith('.ts') || base.endsWith('.tsx')
      ? [base]
      : [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  return candidates.find(existsSync) ?? null
}
