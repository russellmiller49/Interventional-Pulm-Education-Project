import { section as larynxAndEntry } from '../content/sections/larynx-and-entry'
import type { BronchSectionDefinition, ScopeLabAct } from '../content/types'

function lab(key: 'carina' | 'hold'): ScopeLabAct {
  const act = larynxAndEntry.moreActs?.[key]
  if (!act || act.kind !== 'scope-lab') throw new Error(`no scope task ${key}`)
  return act
}

/** The two carina tasks of "Larynx, trachea and carina": into each main bronchus, and the hold. */
export const carinaAct = lab('carina')
export const holdAct = lab('hold')

/**
 * The same two tasks in the shape the simulation tests address: the entry task as a section's
 * activity and the hold as its observation. The tasks were a section of their own before the
 * rewrite; the engine behaviour these tests pin did not change when they moved.
 */
export const carinaTasks: BronchSectionDefinition = {
  ...larynxAndEntry,
  act: {
    ...carinaAct,
    observe: { view: holdAct.view, goals: holdAct.goals, readouts: holdAct.view.readouts },
  },
}
