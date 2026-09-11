import { fireEvent, render } from '@testing-library/react'

import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { ScopeFallback } from '../components/scope/ScopeFallback'
import { ScopePane } from '../components/scope/ScopePane'
import { SCOPE_MODES_READY } from '../components/scope/ScopeScenePane'
import {
  SCOPE_MODES,
  scopeControlId,
  treeChoiceInputId,
  type ScopeMode,
  type ScopePaneProps,
  type ScopeState,
  type ScopeViewSpec,
  type TreeAnswer,
} from '../components/scope/types'
import { scopeLocationCaption } from '../engine/scope/scopeCaption'
import { createScopeState } from '../engine/scope/scopeReducer'
import { scopeViewErrors } from '../engine/scope/scopeViewErrors'
import { ScopeDriver, teachingCase } from '../test-support/teachingCase'

/**
 * The DOM-only scope pane against the contract in `components/scope/types.ts`: every data
 * attribute, every control id, the commands each control sends, the tree answer's radios and
 * map pins, the view signal, and the learner copy gate over everything it prints.
 *
 * `ScopeScenePane` will load Codex's scene through `next/dynamic` once it lands; the stub below
 * keeps that import inert so this suite never pulls three.js while still reading the real
 * `SCOPE_MODES_READY`.
 */
jest.mock('next/dynamic', () => () => {
  const Inert = () => null
  return Inert
})

const PROFILE = 'adult-teaching-combined-left-basal-v1'
const BOUNDARY = 'A teaching model on the graph alone: no lumen, no patient.'

const walkView: ScopeViewSpec = {
  sectionId: 'fallback-check',
  mode: 'guided-walk',
  profile: PROFILE,
  start: { kind: 'airway', label: 'TR', at: 'proximal' },
  controls: [
    'advance',
    'withdraw',
    'rotate',
    'deflect',
    'suction',
    'declare',
    'branchLabels',
    'step',
    'reset',
  ],
  assists: { 'branch-labels': true },
  ledger: { expected: ['RMSB', 'LMSB'] },
  readouts: ['currentAirway', 'depthMm'],
  litAirways: ['TR'],
  boundary: BOUNDARY,
}

function paneProps(
  state: ScopeState,
  view: ScopeViewSpec = walkView,
  extra: Partial<ScopePaneProps> = {},
): ScopePaneProps {
  return {
    view,
    state,
    map: teachingCase().map,
    caption: scopeLocationCaption(state),
    goals: [],
    controlsEnabled: true,
    onCommand: jest.fn(),
    onReset: jest.fn(),
    ...extra,
  }
}

const treeAnswer: TreeAnswer = {
  name: 'which-side',
  legend: 'Which opening is the right main bronchus?',
  choices: [
    { id: 'right', label: 'The opening on this side', airway: 'RMSB' },
    { id: 'neither', label: 'Neither opening ahead', airway: null },
  ],
  selectedChoiceId: null,
  onSelect: jest.fn(),
  disabled: false,
}

/** Every learner-facing string the pane prints, on the page and in its accessible names. */
function copyGateFindings(): readonly string[] {
  const findings = [...flaggedLearnerCopyTerms(document.body.textContent ?? '')]
  for (const element of document.body.querySelectorAll('[aria-label], [title]')) {
    for (const attribute of ['aria-label', 'title']) {
      const value = element.getAttribute(attribute)
      if (value) findings.push(...flaggedLearnerCopyTerms(value))
    }
  }
  return findings
}

const q = (selector: string) => document.querySelector(selector)

describe('ScopeFallback', () => {
  const state = createScopeState(walkView, teachingCase())

  it('prints the DOM contract for a guided walk from the trachea', () => {
    render(<ScopeFallback {...paneProps(state)} />)
    expect(
      q(
        '[data-scope-scene][data-scope-mode="guided-walk"][data-scope-state="fallback"][data-anatomy-profile]',
      ),
    ).not.toBeNull()
    expect(q(`[data-anatomy-profile="${PROFILE}"]`)).not.toBeNull()
    expect(q('[data-view-signal="clear"]')).not.toBeNull()
    expect(q('[data-airway-map] [data-airway-pin="TR"][aria-current="location"]')).not.toBeNull()
    expect(q('[data-airway-map] [data-airway-pin="RMSB"]')).not.toBeNull()
    expect(q('[data-airway-map] [data-airway-pin="RMSB"][aria-current]')).toBeNull()
    expect(q('[data-airway-map] path[data-airway-path="TR"][data-lit="true"]')).not.toBeNull()
    expect(q('[data-airway-map] path[data-airway-path="RMSB"][data-lit]')).toBeNull()
    expect(q('[data-readouts] [data-readout="depthMm"]')).not.toBeNull()
    expect(q('[data-readouts] [data-readout="currentAirway"]')).not.toBeNull()
    expect(
      q('[data-inspection-ledger] [data-ledger-row="RMSB"][data-ledger-status="not-observed"]'),
    ).not.toBeNull()
    expect(
      q('[data-inspection-ledger] [data-ledger-row="LMSB"][data-ledger-status="not-observed"]'),
    ).not.toBeNull()
    expect(q('[data-model-boundary]')?.textContent).toContain(BOUNDARY)
    expect(q('[data-location-caption]')?.textContent).toBe(scopeLocationCaption(state))
    expect(q('[data-spine-strip] [data-spine-stop="trachea"][aria-current="step"]')).not.toBeNull()
    expect(q('[data-input-mode=""]')).not.toBeNull()
    expect(q('[data-assists-used]')?.getAttribute('data-assists-used')).toBe(
      state.assistsUsed.join(','),
    )
    expect(q('[data-scope-controls]')).not.toBeDisabled()
  })

  it('offers one native control per key the view lists, with the contract ids', () => {
    render(<ScopeFallback {...paneProps(state)} />)
    for (const key of walkView.controls) {
      expect(document.getElementById(scopeControlId(key))).not.toBeNull()
    }
    expect(document.getElementById(scopeControlId('capture'))).toBeNull()
    expect(document.getElementById(scopeControlId('declare-RMSB'))).not.toBeNull()
    expect(document.getElementById(scopeControlId('declare-LMSB'))).not.toBeNull()
  })

  it('sends advance, withdraw, rotation, deflection, suction, labels, a step and a reset', () => {
    const props = paneProps(state)
    render(<ScopeFallback {...props} />)
    const step = state.inputs.stepMm

    fireEvent.click(document.getElementById(scopeControlId('advance'))!)
    expect(props.onCommand).toHaveBeenLastCalledWith({ type: 'advance', mm: step }, 'pointer')

    fireEvent.click(document.getElementById(scopeControlId('withdraw'))!)
    expect(props.onCommand).toHaveBeenLastCalledWith({ type: 'advance', mm: -step }, 'pointer')

    fireEvent.change(document.getElementById(scopeControlId('rotate'))!, {
      target: { value: '30' },
    })
    expect(props.onCommand).toHaveBeenLastCalledWith({ type: 'set-rotation', deg: 30 }, 'pointer')

    fireEvent.change(document.getElementById(scopeControlId('deflect'))!, {
      target: { value: '-45' },
    })
    expect(props.onCommand).toHaveBeenLastCalledWith(
      { type: 'set-deflection', deg: -45 },
      'pointer',
    )

    fireEvent.click(document.getElementById(scopeControlId('suction'))!)
    expect(props.onCommand).toHaveBeenLastCalledWith({ type: 'suction', on: true }, 'pointer')

    fireEvent.click(document.getElementById(scopeControlId('branchLabels'))!)
    expect(props.onCommand).toHaveBeenLastCalledWith({ type: 'branch-labels', on: true }, 'pointer')

    fireEvent.click(document.getElementById(scopeControlId('step'))!)
    expect(props.onCommand).toHaveBeenLastCalledWith({ type: 'tick', seconds: 1 }, 'pointer')

    fireEvent.click(document.getElementById(scopeControlId('reset'))!)
    expect(props.onReset).toHaveBeenCalledTimes(1)
  })

  it('offers only the declarations the record supports now, and sends the one chosen', () => {
    const props = paneProps(state)
    render(<ScopeFallback {...props} />)
    const select = document.getElementById(scopeControlId('declare-RMSB')) as HTMLSelectElement
    const option = (value: string) =>
      select.querySelector<HTMLOptionElement>(`option[value="${value}"]`)!
    // Not observed yet: naming it or calling it inspected is not supported; not observed is.
    expect(option('identified')).toBeDisabled()
    expect(option('inspected')).toBeDisabled()
    expect(option('not-safely-accessible')).toBeDisabled()
    expect(option('not-observed')).not.toBeDisabled()

    fireEvent.change(select, { target: { value: 'not-observed' } })
    expect(props.onCommand).toHaveBeenLastCalledWith(
      { type: 'declare', airway: 'RMSB', status: 'not-observed' },
      'pointer',
    )
    expect(select.value).toBe('')
  })

  it('enables identification once the opening has been in a clear view', () => {
    const driver = new ScopeDriver(walkView)
    let guard = 0
    while (!driver.state.ostia.some((pin) => pin.label === 'RMSB' && pin.inView) && guard < 80) {
      driver.send({ type: 'advance', mm: driver.state.inputs.stepMm })
      guard += 1
    }
    const seen = driver.state
    expect(seen.ledger.RMSB?.ostiumVisualized).toBe(true)
    const props = paneProps(seen)
    render(<ScopeFallback {...props} />)
    expect(
      q(
        '[data-inspection-ledger] [data-ledger-row="RMSB"][data-ledger-status="ostium-visualized"]',
      ),
    ).not.toBeNull()
    expect(q('[data-ostium-pin="RMSB"]')).not.toBeNull()
    const select = document.getElementById(scopeControlId('declare-RMSB')) as HTMLSelectElement
    expect(select.querySelector('option[value="identified"]')).not.toBeDisabled()
    fireEvent.change(select, { target: { value: 'identified' } })
    expect(props.onCommand).toHaveBeenLastCalledWith(
      { type: 'declare', airway: 'RMSB', status: 'identified' },
      'pointer',
    )
  })

  it('disables the dock and prints the reason while the learner decides', () => {
    render(
      <ScopeFallback
        {...paneProps(state, walkView, {
          controlsEnabled: false,
          lockedReason: 'Answer the prediction first.',
        })}
      />,
    )
    expect(q('[data-scope-controls]')).toBeDisabled()
    expect(document.getElementById(scopeControlId('declare-RMSB'))).toBeDisabled()
    expect(q('[role="status"]')?.textContent).toBe('Answer the prediction first.')
  })

  it('renders a tree answer as a radio group with a map pin pointing at its choice', () => {
    render(<ScopeFallback {...paneProps(state, walkView, { treeAnswer })} />)
    const fieldset = q('[data-tree-answer="which-side"]')
    expect(fieldset).not.toBeNull()
    expect(fieldset?.hasAttribute('data-tree-outcome')).toBe(false)
    const rightId = treeChoiceInputId('which-side', 'right')
    const neitherId = treeChoiceInputId('which-side', 'neither')
    expect(document.getElementById(rightId)).toHaveAttribute('type', 'radio')
    expect(document.getElementById(neitherId)).toHaveAttribute('type', 'radio')
    expect(q(`[data-tree-answer] label[for="${neitherId}"][data-off-tree]`)).not.toBeNull()
    expect(q(`[data-tree-answer] label[for="${rightId}"][data-off-tree]`)).toBeNull()
    const pin = q(`[data-airway-map] label[for="${rightId}"][data-airway-pin="RMSB"]`)
    expect(pin).not.toBeNull()
    expect(q('[data-airway-map] label[data-airway-pin="LMSB"]')).toBeNull()

    fireEvent.click(document.getElementById(rightId)!)
    expect(treeAnswer.onSelect).toHaveBeenCalledWith('right')
  })

  it('marks the outcome only after the answer is committed', () => {
    render(
      <ScopeFallback
        {...paneProps(state, walkView, {
          treeAnswer: {
            ...treeAnswer,
            selectedChoiceId: 'neither',
            committedChoiceId: 'neither',
            correctChoiceIds: ['right'],
            disabled: true,
          },
        })}
      />,
    )
    expect(q('[data-tree-answer][data-tree-outcome="other"]')).not.toBeNull()
    expect(q('[data-tree-answer] label[data-outcome="best"]')).not.toBeNull()
    expect(q('[data-tree-answer] label[data-outcome="chosen"][data-off-tree]')).not.toBeNull()
    expect(q('[data-tree-answer]')).toBeDisabled()
  })

  it('shows the view signal the state carries', () => {
    const redOut: ScopeState = { ...state, signals: { ...state.signals, view: 'red-out' } }
    render(<ScopeFallback {...paneProps(redOut)} />)
    expect(q('[data-view-signal="red-out"]')).not.toBeNull()
    expect(q('[data-view-signal="clear"]')).toBeNull()
  })

  it('prints the goals, the message and the place when the tip is off the tree', () => {
    const driver = new ScopeDriver(walkView)
    driver.send({ type: 'declare', airway: 'RMSB', status: 'identified' })
    const refused = driver.state
    expect(refused.message).not.toBeNull()
    const { unmount } = render(
      <ScopeFallback
        {...paneProps(refused, walkView, {
          goals: [
            {
              goal: {
                id: 'enter-rmsb',
                label: 'Enter the right main bronchus',
                test: { type: 'location', airway: 'RMSB' },
              },
              met: false,
            },
          ],
        })}
      />,
    )
    expect(q('[data-scope-message]')?.textContent).toBe(refused.message)
    expect(q('[data-scope-goals] li[data-met="false"]')?.textContent).toBe(
      'Enter the right main bronchus',
    )
    unmount()

    const benchView: ScopeViewSpec = {
      ...walkView,
      mode: 'controls-isolated',
      start: { kind: 'bench' },
      controls: ['rotate', 'deflect', 'suction', 'step'],
      assists: {},
      ledger: undefined,
      litAirways: undefined,
    }
    const bench = createScopeState(benchView, null)
    render(<ScopeFallback {...paneProps(bench, benchView, { map: null })} />)
    expect(q('[data-scope-place="bench"]')).not.toBeNull()
    expect(q('[data-airway-map] [role="status"]')).not.toBeNull()
    expect(q('[data-inspection-ledger]')).toBeNull()
    expect(q('[data-spine-strip] [aria-current]')).toBeNull()
  })

  it('spotlights the control the host names', () => {
    render(<ScopeFallback {...paneProps(state, walkView, { spotlightKey: 'rotate' })} />)
    expect(q('[data-spotlight="true"] #' + scopeControlId('rotate'))).not.toBeNull()
    expect(document.querySelectorAll('[data-spotlight="true"]')).toHaveLength(1)
  })

  it('passes the learner copy gate on everything it prints', () => {
    const driver = new ScopeDriver(walkView)
    driver.send({ type: 'declare', airway: 'RMSB', status: 'identified' })
    const { unmount } = render(
      <ScopeFallback
        {...paneProps(driver.state, walkView, {
          treeAnswer,
          goals: [
            {
              goal: {
                id: 'enter-rmsb',
                label: 'Enter the right main bronchus',
                test: { type: 'location', airway: 'RMSB' },
              },
              met: true,
            },
          ],
        })}
      />,
    )
    expect(copyGateFindings()).toEqual([])
    unmount()

    render(
      <ScopeFallback
        {...paneProps(driver.state, walkView, {
          controlsEnabled: false,
          pausedReason: 'Looking back at the step.',
        })}
      />,
    )
    expect(copyGateFindings()).toEqual([])
  })
})

describe('ScopePane', () => {
  const viewFor = (mode: ScopeMode): ScopeViewSpec => {
    const base = {
      sectionId: `pane-${mode}`,
      mode,
      profile: PROFILE,
      assists: {},
      boundary: BOUNDARY,
    } as const
    switch (mode) {
      case 'controls-isolated':
        return { ...base, start: { kind: 'bench' }, controls: ['rotate', 'deflect', 'suction'] }
      case 'larynx-entry':
        return {
          ...base,
          start: { kind: 'larynx' },
          controls: ['advance', 'withdraw', 'deflect', 'step'],
          script: 'breathing-cords',
          readouts: ['cordsState'],
        }
      case 'tube':
        return {
          ...base,
          start: { kind: 'tube' },
          controls: ['advance', 'withdraw', 'deflect'],
          defaults: { tube: { kind: 'ett', idMm: 8 } },
          readouts: ['annularAreaFraction', 'annularAreaMm2'],
        }
      case 'accessory':
        return {
          ...base,
          start: { kind: 'airway', label: 'RMSB', at: 'mid' },
          controls: ['accessory', 'verifyAccessory'],
          readouts: ['accessoryState'],
        }
      case 'idle':
        return { ...base, start: { kind: 'airway', label: 'TR', at: 'mid' }, controls: [] }
      case 'guided-walk':
      case 'free-drive':
        return {
          ...base,
          start: { kind: 'airway', label: 'TR', at: 'proximal' },
          controls: ['advance', 'withdraw', 'rotate', 'deflect'],
          readouts: ['currentAirway', 'parentage'],
        }
    }
  }

  it('routes every mode without a ready scene to the fallback', () => {
    const pending = SCOPE_MODES.filter((mode) => !SCOPE_MODES_READY.has(mode))
    expect(pending.length).toBeGreaterThan(0)
    for (const mode of pending) {
      const view = viewFor(mode)
      expect(scopeViewErrors(view)).toEqual([])
      const scopeCase = view.start.kind === 'bench' ? null : teachingCase()
      const state = createScopeState(view, scopeCase)
      const { unmount } = render(
        <ScopePane {...paneProps(state, view, { map: scopeCase?.map ?? null })} />,
      )
      expect(
        q(`[data-scope-scene][data-scope-mode="${mode}"][data-scope-state="fallback"]`),
      ).not.toBeNull()
      for (const key of view.controls) {
        expect(document.getElementById(scopeControlId(key))).not.toBeNull()
      }
      expect(copyGateFindings()).toEqual([])
      unmount()
    }
  })
})
