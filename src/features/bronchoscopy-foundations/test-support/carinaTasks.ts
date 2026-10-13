import type { ScopeViewSpec } from '../components/scope/types'
import { section as larynxAndEntry } from '../content/sections/larynx-and-entry'
import type { BronchSectionDefinition, ScopeLabAct } from '../content/types'

function lab(key: 'carina'): ScopeLabAct {
  const act = larynxAndEntry.moreActs?.[key]
  if (!act || act.kind !== 'scope-lab') throw new Error(`no scope task ${key}`)
  return act
}

/** The carina task of "Larynx, trachea and carina": into each main bronchus and back. */
export const carinaAct = lab('carina')

const HOLD_VIEW: ScopeViewSpec = {
  ...carinaAct.view,
  start: { kind: 'airway', label: 'TR', at: 'distal' },
  controls: ['advance', 'withdraw', 'rotate', 'deflect', 'capture', 'acknowledge'],
  readouts: ['depthMm', 'contactCount', 'holdRemaining'],
  litAirways: ['TR'],
  script: 'assistant-interrupt',
  boundary: 'The assistant speaks during this task. Drift is a change in depth.',
}

/**
 * The hold above the carina (drill D10): acknowledge the assistant, capture an image and stay put
 * until the scripted hold ends. The course no longer runs it as an activity (educator feedback,
 * 2026-10-13). The engine still carries the scripted hold, its clock and its drift reading, so the
 * task lives on here as the fixture the simulation tests drive them through.
 */
export const holdAct: ScopeLabAct = {
  kind: 'scope-lab',
  view: HOLD_VIEW,
  goals: [
    {
      id: 'acknowledge',
      label: 'Acknowledge the assistant',
      test: { type: 'event', event: 'acknowledged' },
    },
    {
      id: 'capture',
      label: 'Capture an image from above the main carina',
      test: {
        type: 'all',
        tests: [
          { type: 'event', event: 'captured' },
          { type: 'location', airway: 'TR' },
        ],
      },
    },
    {
      id: 'hold',
      label: 'Stay above the carina until the hold ends',
      test: {
        type: 'all',
        tests: [
          { type: 'event', event: 'hold-completed' },
          { type: 'location', airway: 'TR' },
        ],
      },
    },
    {
      id: 'no-drift',
      label: 'Finish the hold with no drift in depth recorded and no wall contact recorded',
      test: {
        type: 'all',
        tests: [
          { type: 'event', event: 'hold-completed' },
          { type: 'without', event: 'drift-detected' },
          { type: 'without', event: 'wall-contact' },
        ],
      },
    },
  ],
}

/**
 * The two tasks in the shape the simulation tests address: the entry task as a section's activity
 * and the hold as its observation. The tasks were a section of their own before the rewrite; the
 * engine behaviour these tests pin did not change when they moved.
 */
export const carinaTasks: BronchSectionDefinition = {
  ...larynxAndEntry,
  act: {
    ...carinaAct,
    observe: { view: holdAct.view, goals: holdAct.goals, readouts: holdAct.view.readouts },
  },
}
