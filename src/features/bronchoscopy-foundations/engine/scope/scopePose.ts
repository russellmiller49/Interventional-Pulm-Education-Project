import { plus, times, type OpticalFrame } from '@/lib/bronchoscopy-core/frame'
import {
  buildScopePathLps,
  buildScopePoseSnapshot,
  type ScopeState as EngineScopeState,
} from '@/lib/airway-anatomy/scope-state'
import type { TransportFrames } from '@/lib/airway-anatomy/transport-frames'
import type { ScopePoseSnapshot } from '@/lib/airway-anatomy/types'

import type { ScopeInputs, ScopeState, ScopeViewSpec } from '../../components/scope/types'
import { airwayDisplayName, labelAncestry } from '../../content/airwayTree'
import { spineStopForAirway } from './scopeCaption'
import type { ScopeCase } from './scopeCase'
import { scopeFrame } from './scopeFrame'
import { CARINA_ZONE_MM, LARYNX_GLOTTIS_MM, LARYNX_LENGTH_MM } from './scopeScripts'

/**
 * What a state derives from the tip's graph position and the five controls: the camera frame the
 * scene renders, the pose, the insertion depth and the location the caption names.
 *
 * The camera is always `scopeFrame(base, inputs)`: the transported centerline frame at the tip,
 * rolled by the control-section rotation and bent by the lever. The scene never integrates a
 * position or re-rolls; it renders `scopeOpticalFrame(state.pose)`, which returns this frame.
 */

/** The transport the view allows: with the reviewed reference roll (an assist) or without it. */
export function transportFor(
  view: Pick<ScopeViewSpec, 'assists'>,
  scopeCase: ScopeCase,
): TransportFrames {
  return view.assists['reference-orientation'] === true
    ? scopeCase.framesReference
    : scopeCase.framesPlain
}

/** The frame at the tip before rotation and deflection: the shaft assumed along the centerline. */
export function tipBaseFrame(
  engine: EngineScopeState,
  view: Pick<ScopeViewSpec, 'assists'>,
  scopeCase: ScopeCase,
): OpticalFrame {
  const base = transportFor(view, scopeCase).at(engine.edgeId, engine.distanceMm)
  return engine.freeFrame ? { ...base, position: engine.freeFrame.position } : base
}

export function tipOpticalFrame(
  engine: EngineScopeState,
  inputs: Pick<ScopeInputs, 'rotationDeg' | 'deflectionDeg'>,
  view: Pick<ScopeViewSpec, 'assists'>,
  scopeCase: ScopeCase,
): OpticalFrame {
  return scopeFrame(tipBaseFrame(engine, view, scopeCase), inputs)
}

export function buildScopePose(
  engine: EngineScopeState,
  inputs: Pick<ScopeInputs, 'rotationDeg' | 'deflectionDeg'>,
  view: Pick<ScopeViewSpec, 'assists'>,
  scopeCase: ScopeCase,
): ScopePoseSnapshot {
  const frame = tipOpticalFrame(engine, inputs, view, scopeCase)
  const snapshot = buildScopePoseSnapshot({
    state: { ...engine, freeFrame: undefined },
    graph: scopeCase.graph,
    labels: null,
    lookAheadMm: scopeCase.interaction.lookAheadMm,
  })
  return {
    ...snapshot,
    opticalFrame: frame,
    shaftPathLps:
      engine.freePath ?? buildScopePathLps(scopeCase.graph, engine.edgeId, engine.distanceMm),
    tipLps: frame.position,
    lookAtLps: plus(frame.position, times(frame.forward, 12)),
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
  }
}

/** On the trachea, near enough the main carina to see both main bronchial origins. */
export function inCarinaZone(engine: EngineScopeState, scopeCase: ScopeCase): boolean {
  const edge = scopeCase.index.edgesById.get(engine.edgeId)
  if (!edge || edge.endNodeId !== scopeCase.graph.carinaNodeId) return false
  return edge.lengthMm - engine.distanceMm <= CARINA_ZONE_MM
}

/** Depth along the airway path; the larynx mode counts from the start of the model larynx. */
export function airwayDepthMm(
  engine: EngineScopeState,
  view: Pick<ScopeViewSpec, 'mode'>,
  scopeCase: ScopeCase,
): number {
  const start = scopeCase.edgeStartDepthMm.get(engine.edgeId) ?? 0
  return start + engine.distanceMm + (view.mode === 'larynx-entry' ? LARYNX_LENGTH_MM : 0)
}

export const LOCATION_WORDS = {
  bench: 'On the bench, outside the airway',
  aboveGlottis: 'Larynx, above the glottis',
  belowGlottis: 'Subglottis, below the glottis',
  inTube: 'Trachea, inside the tube',
} as const

export function scopeLocation(
  place: ScopeState['place'],
  engine: EngineScopeState | null,
  larynxDepthMm: number,
  scopeCase: ScopeCase | null,
): ScopeState['location'] {
  switch (place) {
    case 'bench':
      return { label: null, fullLabel: LOCATION_WORDS.bench, parentage: [], spineStop: null }
    case 'larynx':
      return {
        label: null,
        fullLabel:
          larynxDepthMm < LARYNX_GLOTTIS_MM
            ? LOCATION_WORDS.aboveGlottis
            : LOCATION_WORDS.belowGlottis,
        parentage: [],
        spineStop: 'larynx',
      }
    case 'tube':
      return {
        label: 'TR',
        fullLabel: LOCATION_WORDS.inTube,
        parentage: ['TR'],
        spineStop: 'trachea',
      }
    case 'airway': {
      const label = engine && scopeCase ? scopeCase.labelAt(engine.edgeId) : null
      if (!label || !engine || !scopeCase) throw new Error('An airway place needs a graph position')
      return {
        label,
        fullLabel: airwayDisplayName(label),
        parentage: labelAncestry(label),
        spineStop: spineStopForAirway(label, inCarinaZone(engine, scopeCase)),
      }
    }
  }
}
