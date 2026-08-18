import { render } from '@testing-library/react'

import {
  EcmoDrillLocalization,
  EcmoLocalizationCard,
} from '../components/teaching/EcmoLocalizationCard'
import { resolveEcmoModeText } from '../content/circuitSegments'
import { evidenceById } from '../content/evidence'
import {
  ECMO_LOCALIZATION_FOOTER,
  ecmoLocalizationRow,
  ecmoLocalizationRowIds,
  ecmoLocalizationRowTextEquivalent,
  ecmoLocalizationRows,
  ecmoLocalizationScaffoldTextEquivalent,
} from '../content/localizationCards'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import { ecmoSimulationReducer } from '../engine/reducer'
import { createInitialSimulationState } from '../engine/simulation'
import type { EcmoSimulationState } from '../engine/types'

/**
 * The two depths the grammar is allowed to be shown at, and the gate between them.
 */

/*
 * Real drill scenarios, driven the way the drill-panel suite drives them. A support mode is not a
 * scenario id, and a reference-profile circuit arrives with a commitment already recorded — either
 * shortcut produces a state in which this gate cannot fail.
 */
const VV_DRILL = 'preload-drainage-collapse'
const VA_DRILL = 'va-afterload-arterial-return-obstruction'

function settled(scenarioId: string, steps = 12): EcmoSimulationState {
  let state = createInitialSimulationState(scenarioId, 'guided')
  for (let tick = 0; tick < steps; tick += 1) {
    state = ecmoSimulationReducer(state, { type: 'STEP' })
  }
  return state
}

function afterCommitment(state: EcmoSimulationState): EcmoSimulationState {
  const prediction = requireEcmoLearnPrediction(state.scenario.scenarioId)
  const best = prediction.item.choices.find((choice) => choice.plausibility === 'best')
  if (!best) throw new Error(`No best choice for ${state.scenario.scenarioId}`)
  const commitment = prediction.commitments[best.id]
  return ecmoSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    goalId: commitment.goalId,
    control: commitment.control,
    direction: commitment.direction,
  })
}

describe('ECMO localization card — the scaffolded table', () => {
  it('shows all four patterns with where each one lives', () => {
    const { container } = render(<EcmoLocalizationCard mode="scaffold-table" supportMode="vv" />)
    const rendered = [...container.querySelectorAll('[data-localization-row]')].map((node) =>
      node.getAttribute('data-localization-row'),
    )
    expect(rendered).toEqual([...ecmoLocalizationRowIds])

    for (const row of ecmoLocalizationRows) {
      const block = container.querySelector(`[data-localization-row="${row.id}"]`)
      expect(block?.textContent).toContain(resolveEcmoModeText(row.signature, 'vv'))
      expect(block?.querySelector('[data-row-location]')?.textContent).toContain(
        row.problemLocation,
      )
    }
  })

  it('stops at location: no shortlist, no response, no reflex, in either track', () => {
    for (const supportMode of ['vv', 'va'] as const) {
      const { container, unmount } = render(
        <EcmoLocalizationCard mode="scaffold-table" supportMode={supportMode} />,
      )
      expect(container.querySelector('[data-row-causes]')).toBeNull()
      expect(container.querySelector('[data-row-action]')).toBeNull()
      expect(container.querySelector('[data-row-reflex]')).toBeNull()
      expect(container.querySelector('[data-row-va-variation]')).toBeNull()
      expect(container.querySelector('[data-localization-sources]')).toBeNull()

      const text = container.textContent ?? ''
      for (const row of ecmoLocalizationRows) {
        for (const cause of row.causes) expect(text).not.toContain(cause)
        expect(text).not.toContain(row.actionClass)
        expect(text).not.toContain(row.harmfulReflex)
        expect(text).not.toContain(row.vaVariation)
      }
      unmount()
    }
  })

  it('says the circuit in front of the learner has nothing wrong with it', () => {
    const { container } = render(<EcmoLocalizationCard mode="scaffold-table" supportMode="vv" />)
    expect(container.querySelector('[data-localization-scaffold-note]')?.textContent).toMatch(
      /no injected problem/i,
    )
    expect(container.querySelector('[data-model-boundary]')?.textContent).toMatch(
      /simulation|model/i,
    )
    expect(container.querySelector('[data-text-equivalent]')?.textContent).toBe(
      ecmoLocalizationScaffoldTextEquivalent('vv'),
    )
  })

  it('does not tell a learner to go looking for a pressure change on the gas row', () => {
    const { container } = render(<EcmoLocalizationCard mode="scaffold-table" supportMode="vv" />)
    const gas = container.querySelector('[data-localization-row="gas-path-failure"]')
    expect(gas?.querySelector('[data-row-zones]')?.textContent).toMatch(/quiet/i)
    const drainage = container.querySelector('[data-localization-row="drainage-limitation"]')
    expect(drainage?.querySelector('[data-row-zones]')?.textContent).toMatch(/read in/i)
  })
})

describe('ECMO localization card — one revealed row', () => {
  it.each(ecmoLocalizationRowIds)('renders %s in full, and no other row', (rowId) => {
    const row = ecmoLocalizationRow(rowId)
    const { container } = render(
      <EcmoLocalizationCard mode="revealed-row" rowId={rowId} supportMode="vv" />,
    )
    const rendered = [...container.querySelectorAll('[data-localization-row]')].map((node) =>
      node.getAttribute('data-localization-row'),
    )
    expect(rendered).toEqual([rowId])

    const text = container.textContent ?? ''
    expect(text).toContain(resolveEcmoModeText(row.signature, 'vv'))
    expect(text).toContain(row.problemLocation)
    for (const cause of row.causes) expect(text).toContain(cause)
    expect(text).toContain(row.actionClass)
    expect(text).toContain(row.harmfulReflex)
    expect(container.querySelector('[data-model-boundary]')?.textContent).toContain(
      row.modelBoundary,
    )
    expect(container.querySelector('[data-text-equivalent]')?.textContent).toBe(
      ecmoLocalizationRowTextEquivalent('vv', rowId),
    )
  })

  it('names each source by its title and the claim this row takes from it', () => {
    const row = ecmoLocalizationRow('membrane-resistance')
    const { container } = render(
      <EcmoLocalizationCard mode="revealed-row" rowId={row.id} supportMode="vv" />,
    )
    for (const support of row.sourceSupport) {
      const entry = container.querySelector(`[data-evidence-id="${support.evidenceId}"]`)
      expect(entry).not.toBeNull()
      expect(entry?.textContent).toContain(evidenceById.get(support.evidenceId)?.title)
      expect(entry?.textContent).toContain(support.claim)
      expect(entry?.textContent).toContain(evidenceById.get(support.evidenceId)?.limitations)
    }
    // Registry identifiers stay in data attributes, never in anything a learner reads.
    expect(container.textContent).not.toContain('bounded-educational-model')
    expect(container.textContent).not.toContain('elso-circuit-2022')
  })

  it('adds the VA reading only on a VA circuit', () => {
    const row = ecmoLocalizationRow('return-path-resistance')
    const vv = render(<EcmoLocalizationCard mode="revealed-row" rowId={row.id} supportMode="vv" />)
    expect(vv.container.querySelector('[data-row-va-variation]')).toBeNull()
    expect(vv.container.textContent).not.toContain(row.vaVariation)
    vv.unmount()

    const va = render(<EcmoLocalizationCard mode="revealed-row" rowId={row.id} supportMode="va" />)
    expect(va.container.querySelector('[data-row-va-variation]')?.textContent).toContain(
      row.vaVariation,
    )
  })

  it('carries the gradient rule in both views', () => {
    for (const element of [
      <EcmoLocalizationCard key="s" mode="scaffold-table" supportMode="vv" />,
      <EcmoLocalizationCard
        key="r"
        mode="revealed-row"
        rowId="membrane-resistance"
        supportMode="vv"
      />,
    ]) {
      const { container, unmount } = render(element)
      expect(container.querySelector('[data-localization-footer]')?.textContent).toBe(
        ECMO_LOCALIZATION_FOOTER.text,
      )
      unmount()
    }
  })

  it('adds no scroller and no keyboard stop of its own', () => {
    const { container } = render(<EcmoLocalizationCard mode="scaffold-table" supportMode="vv" />)
    expect(container.querySelector('.overflow-x-auto')).toBeNull()
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('[tabindex]')).toBeNull()
    expect(container.querySelector('button, a, input, select')).toBeNull()
  })
})

describe('ECMO drill localization gate', () => {
  it('renders nothing at all before the learner commits', () => {
    const state = settled(VV_DRILL)
    expect(state.scenario.prediction.committed).toBe(false)
    const { container } = render(
      <EcmoDrillLocalization state={state} rowId="drainage-limitation" />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the row once the engine has recorded a commitment', () => {
    const { container } = render(
      <EcmoDrillLocalization
        state={afterCommitment(settled(VV_DRILL))}
        rowId="drainage-limitation"
      />,
    )
    expect(container.querySelector('[data-localization-row="drainage-limitation"]')).not.toBeNull()
    expect(
      container.querySelector('[data-localization-card]')?.getAttribute('data-localization-mode'),
    ).toBe('revealed-row')
  })

  it('takes the track from the circuit rather than from the caller', () => {
    const state = afterCommitment(settled(VA_DRILL))
    expect(state.supportMode).toBe('va')
    const { container } = render(
      <EcmoDrillLocalization state={state} rowId="return-path-resistance" />,
    )
    expect(
      container.querySelector('[data-localization-card]')?.getAttribute('data-support-mode'),
    ).toBe('va')
    expect(container.querySelector('[data-row-va-variation]')).not.toBeNull()
  })

  it('closes again when the scenario is reloaded', () => {
    const reloaded = ecmoSimulationReducer(afterCommitment(settled(VV_DRILL)), {
      type: 'LOAD_SCENARIO',
      scenarioId: VV_DRILL,
    })
    expect(reloaded.scenario.prediction.committed).toBe(false)
    const { container } = render(
      <EcmoDrillLocalization state={reloaded} rowId="drainage-limitation" />,
    )
    expect(container.innerHTML).toBe('')
  })
})
