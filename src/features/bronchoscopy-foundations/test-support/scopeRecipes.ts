import type { AirwayLabel } from '../components/scope/types'
import type { BronchSectionId } from '../content/pathway'
import { LARYNX_GLOTTIS_MM } from '../engine/scope/scopeScripts'
import type { ScopePilot } from './scopePilot'
import { teachingCase } from './teachingCase'

/**
 * How a learner meets every authored goal of each scope-lab section, with the learner's own
 * controls: the same recipes the engine walkthroughs use, over whatever transport the pilot is
 * given. `act` runs on the Act step's pane, `observe` on the Observe step's.
 */
export interface ScopeRecipe {
  readonly act: (p: ScopePilot) => void
  readonly observe?: (p: ScopePilot) => void
}

const origin = (label: AirwayLabel) => teachingCase().originEdge.get(label)!

export const SCOPE_RECIPES: Partial<Record<BronchSectionId, ScopeRecipe>> = {
  'five-controls': {
    act: (p) => {
      p.send({ type: 'rotate', deg: 45 })
      p.send({ type: 'deflect', deg: 45 })
      p.send({ type: 'rotate', deg: 45 })
    },
    observe: (p) => {
      p.advance()
      p.withdraw()
      p.send({ type: 'suction', on: true })
      p.send({ type: 'suction', on: false })
    },
  },
  'branch-entry': {
    act: (p) => {
      p.goInto('RMSB')
      p.withdrawTo('TR')
      p.goInto('LMSB')
    },
    observe: (p) => {
      p.send({ type: 'acknowledge' })
      p.send({ type: 'capture' })
      for (let i = 0; i < 6; i += 1) p.send({ type: 'tick', seconds: 1 })
    },
  },
  'view-loss': {
    act: (p) => {
      p.withdraw()
      p.advanceUntil(() => p.state.events.includes('reached-carina'))
    },
    observe: (p) => {
      p.send({ type: 'clear-lens' })
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
  },
  'right-side': {
    act: (p) => {
      p.withdrawTo('RMSB')
      p.lookAt('RUL')
      p.goInto('RUL')
      for (const label of ['RB3', 'RB2', 'RB1'] as const) p.lookAt(label)
    },
    observe: (p) => {
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
      const inspect = (label: AirwayLabel) => {
        p.goInto(label)
        if (p.state.signals.view === 'contaminated') p.send({ type: 'clear-lens' })
        p.goDeep(label)
        p.send({ type: 'declare', airway: label, status: 'inspected' })
      }
      inspect('RLL')
      inspect('RB6')
      p.withdrawTo('RLL')
      inspect('RB7')
      p.withdrawTo('RLL')
      inspect('RB8')
      p.withdrawTo('RLL')
      inspect('RB9')
      p.withdrawTo('RLL')
      p.lookAt('RB10')
      p.send({ type: 'declare', airway: 'RB10', status: 'not-safely-accessible' })
      p.withdrawToEdge(origin('RLL'))
      p.goInto('RB6')
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
