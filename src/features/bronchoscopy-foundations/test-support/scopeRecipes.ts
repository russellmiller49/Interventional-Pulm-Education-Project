import type { AirwayLabel } from '../components/scope/types'
import type { BronchSectionId } from '../content/pathway'
import { LARYNX_GLOTTIS_MM } from '../engine/scope/scopeScripts'
import type { ScopePilot } from './scopePilot'

/**
 * How a learner meets every authored goal of each scope-lab section, with the learner's own
 * controls: the same recipes the engine walkthroughs use, over whatever transport the pilot is
 * given. `act` runs on the Act step's pane, `observe` on the Observe step's.
 */
export interface ScopeRecipe {
  readonly act: (p: ScopePilot) => void
  readonly observe?: (p: ScopePilot) => void
  /** Recipes for a section's further scope tasks, by the activity's name in `moreActs`. */
  readonly more?: Readonly<Record<string, (p: ScopePilot) => void>>
}

/** The recipe for one scope task of a section: its own, or the named further activity's. */
export function scopeRecipe(
  sectionId: BronchSectionId,
  activity?: string,
): (p: ScopePilot) => void {
  const recipe = SCOPE_RECIPES[sectionId]
  const run = activity ? recipe?.more?.[activity] : recipe?.act
  if (!run) throw new Error(`No scope recipe for ${sectionId}${activity ? ` (${activity})` : ''}`)
  return run
}

/** Into the right main bronchus, back to the trachea, then into the left. */
export const CARINA_RECIPE = (p: ScopePilot) => {
  p.goInto('RMSB')
  p.withdrawTo('TR')
  p.goInto('LMSB')
}
/** Acknowledge the assistant, capture, and stay still until the hold ends. */
export const HOLD_RECIPE = (p: ScopePilot) => {
  p.send({ type: 'acknowledge' })
  p.send({ type: 'capture' })
  for (let i = 0; i < 6; i += 1) p.send({ type: 'tick', seconds: 1 })
}

export const SCOPE_RECIPES: Partial<Record<BronchSectionId, ScopeRecipe>> = {
  'five-controls': {
    act: (p) => {
      p.send({ type: 'rotate', deg: 45 })
      p.send({ type: 'deflect', deg: 45 })
      p.send({ type: 'rotate', deg: 45 })
    },
  },
  'view-loss': {
    act: (p) => {
      p.withdraw()
      p.advanceUntil(() => p.state.events.includes('reached-carina'))
    },
    more: {
      lens: (p) => {
        p.send({ type: 'clear-lens' })
      },
    },
  },
  'larynx-and-entry': {
    act: (p) => {
      while (p.state.depthMm + p.state.inputs.stepMm < LARYNX_GLOTTIS_MM) p.advance()
      for (let i = 0; p.state.inputs.cords !== 'abducted'; i += 1) {
        if (i > 20) throw new Error('The folds never opened')
        p.send({ type: 'tick', seconds: 0.5 })
      }
      p.advanceUntil(() => p.state.place === 'airway')
      p.send({ type: 'declare', airway: 'TR', status: 'identified' })
    },
    more: { carina: CARINA_RECIPE, hold: HOLD_RECIPE },
  },
  'right-side': {
    act: (p) => {
      p.goInto('RB4')
      p.withdrawTo('RML')
      p.goInto('RB5')
      p.withdrawTo('BI')
      p.goInto('RB6')
    },
  },
  'left-side': {
    act: (p) => {
      p.goInto('LB4+5')
      p.goInto('LB4')
      p.withdrawTo('LB4+5')
      p.goInto('LB5')
      p.withdrawTo('LMSB')
      p.goInto('LB6')
    },
  },
  'systematic-survey': {
    act: (p) => {
      // To a segment from wherever the tip is: back out until it is on the way, then in.
      const reach = (label: AirwayLabel) => {
        for (let guard = 0; ; guard += 1) {
          try {
            p.goInto(label)
            return
          } catch (error) {
            if (guard > 400 || !/is not on the way/.test(String(error))) throw error
            p.straighten()
            p.withdraw()
          }
        }
      }
      const see = (label: AirwayLabel) => {
        reach(label)
        p.goDeep(label)
        p.send({ type: 'declare', airway: label, status: 'inspected' })
      }
      for (const label of ['RB1', 'RB2', 'RB3', 'RB4', 'RB5', 'RB6', 'RB7', 'RB8', 'RB9'] as const)
        see(label)
      // RB10 is narrowed: looked at from the lower lobe and recorded, never entered.
      p.withdrawTo('RLL')
      p.lookAt('RB10')
      p.send({ type: 'declare', airway: 'RB10', status: 'not-safely-accessible' })
      for (const label of ['LB1+2', 'LB3', 'LB4', 'LB5', 'LB6', 'LB7+8', 'LB9', 'LB10'] as const)
        see(label)
    },
  },
  'protected-accessories': {
    act: (p) => {
      p.send({ type: 'accessory-move', to: 'in-channel' })
      p.send({ type: 'accessory-move', to: 'extended' })
      p.send({ type: 'accessory', state: 'brush-exposed' })
      p.send({ type: 'accessory', state: 'brush-sheathed' })
      p.send({ type: 'verify-accessory' })
      p.send({ type: 'accessory', state: 'brush-sheathed' })
      p.send({ type: 'verify-accessory' })
      p.send({ type: 'accessory-move', to: 'in-channel' })
    },
  },
  'scope-in-a-tube': {
    act: (p) => {
      p.advanceUntil(() => p.state.events.includes('reached-carina'))
    },
    observe: (p) => {
      p.advanceUntil(() => p.state.events.includes('tube-exited'))
    },
  },
}
