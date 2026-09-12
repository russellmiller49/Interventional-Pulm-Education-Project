import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import {
  makeFrame,
  plus,
  minus,
  times,
  scalar,
  magnitude,
  rotate,
  unit,
  vector,
  type Point3,
  type OpticalFrame,
  type LumenCollider,
} from '@/lib/bronchoscopy-core/frame'
import type { PathologyPlacement } from '@/lib/airway-anatomy/pathology/geometry'
import {
  siteFor,
  type MorphologyId,
  type PathologySiteId,
} from '@/lib/airway-anatomy/pathology/model'
import type { TransportFrames } from '@/lib/airway-anatomy/transport-frames'
import type { TissueCut } from './tissue'

export type InstrumentId = 'forceps' | 'cryoprobe' | 'snare'
export const INSTRUMENTS = [
  {
    id: 'forceps',
    name: 'Biopsy forceps',
    description:
      'Close the cups on visible tumor; withdraw the closed forceps to retrieve the specimen.',
    diameterMm: 1.8,
  },
  {
    id: 'cryoprobe',
    name: 'Cryoprobe',
    description: 'Contact, freeze to attach tissue, then withdraw the scope and probe together.',
    diameterMm: 1.9,
  },
  {
    id: 'snare',
    name: 'Electrosurgical snare',
    description: 'Encircle a discrete stalk; tighten the loop before controlled resection.',
    diameterMm: 2.2,
  },
] as const
/** Generic authored dimensions; not a compatibility claim for a commercial scope or instrument. */
export const SCOPE_RADIUS_MM = 3
export const FORCEPS_BITE_RADIUS = 1.6
export const CRYO_BITE_RADIUS = 3.1
export interface InstrumentState {
  id: InstrumentId
  extension: number
  open: boolean
  rotation: number
  freezing: boolean
  adhesion: number
  loopCaptured: boolean
  oxygen: number
  returnElectrode: boolean
  pending: null | { instrument: InstrumentId; radius: number; volumeMm3: number }
  outside: boolean
  specimens: { instrument: InstrumentId; volumeMm3: number }[]
  blood: number
  bleedingRate: number
  suction: boolean
  status: string
  unsafe: boolean
  safetyEvents: number
}
export function initialInstrumentState(id: InstrumentId = 'forceps'): InstrumentState {
  return {
    id,
    extension: 0,
    open: false,
    rotation: 0,
    freezing: false,
    adhesion: 0,
    loopCaptured: false,
    oxygen: 0.3,
    returnElectrode: false,
    pending: null,
    outside: false,
    specimens: [],
    blood: 0,
    bleedingRate: 0,
    suction: false,
    status: 'Advance the instrument into view, then approach the target.',
    unsafe: false,
    safetyEvents: 0,
  }
}
export interface InstrumentContact {
  tip: Point3
  origin: Point3
  target: Point3 | null
  kind: 'tumor' | 'wall' | 'air'
  touching: boolean
  wallClearance: number
  maximumExtension: number
  stalkInLoop: boolean
  stalk: Point3
  inward: Point3
}
export function channelOrigin(frame: OpticalFrame) {
  return plus(frame.position, plus(times(frame.right, 1.3), times(frame.up, -1.4)))
}
export function makeTumorTarget(geometry: THREE.BufferGeometry | null) {
  if (!geometry || !geometry.getAttribute('position').count) return null
  return new MeshBVH(geometry, { maxLeafTris: 8 })
}
export function instrumentContact(
  frame: OpticalFrame,
  state: Pick<InstrumentState, 'id' | 'extension' | 'rotation'>,
  tumor: MeshBVH | null,
  lumen: LumenCollider,
  placement: PathologyPlacement,
  morphology: MorphologyId,
): InstrumentContact {
  const origin = channelOrigin(frame)
  const ray = new THREE.Ray(new THREE.Vector3(...origin), new THREE.Vector3(...frame.forward))
  const hit = tumor?.raycastFirst(ray, THREE.DoubleSide)
  let wallDistance = 40
  for (let d = 0.25; d <= 40; d += 0.25) {
    if (lumen.clearance(plus(origin, times(frame.forward, d))) < 0.15) {
      wallDistance = Math.max(0, d - 0.25)
      break
    }
  }
  const tumorFirst = hit && hit.distance < wallDistance
  const surfaceDistance = tumorFirst ? hit.distance : wallDistance
  const maximumExtension = Math.min(
    36,
    wallDistance,
    surfaceDistance + (state.id === 'snare' ? 8 : 0.3),
  )
  const tip = plus(origin, times(frame.forward, state.extension))
  const target = tumorFirst ? (hit.point.toArray() as Point3) : null
  const stalk = plus(placement.wallPoint, times(placement.inward, placement.projectionMm * 0.24))
  const loopCenter = plus(origin, times(frame.forward, state.extension - 4.5))
  const transverse = rotate(frame.right, frame.forward, (state.rotation * Math.PI) / 180)
  const normal = unit(vector(frame.forward, transverse))
  const delta = minus(stalk, loopCenter)
  const stalkInLoop =
    morphology === 'polypoid' &&
    state.extension >= 7 &&
    Math.abs(scalar(delta, normal)) < 2.3 &&
    (scalar(delta, transverse) / 5.8) ** 2 + (scalar(delta, frame.forward) / 4.5) ** 2 < 1 &&
    Math.abs(scalar(normal, placement.inward)) > 0.4
  return {
    origin,
    tip,
    target,
    kind: tumorFirst ? 'tumor' : wallDistance < 36 ? 'wall' : 'air',
    touching: state.extension >= 3 && Math.abs(state.extension - surfaceDistance) < 0.85,
    wallClearance: lumen.clearance(target ?? tip),
    maximumExtension,
    stalkInLoop,
    stalk,
    inward: placement.inward,
  }
}

export type InstrumentAction =
  | { type: 'select'; id: InstrumentId }
  | { type: 'deploy'; extension: number }
  | { type: 'rotate'; degrees: number }
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'freeze' }
  | { type: 'thaw' }
  | { type: 'extract' }
  | { type: 'energize' }
  | { type: 'retrieve' }
  | { type: 'transfer' }
  | { type: 'reenter' }
  | { type: 'oxygen'; value: number }
  | { type: 'return-electrode'; value: boolean }
  | { type: 'suction'; value: boolean }
  | { type: 'tick'; dt: number }
  | { type: 'cut-complete'; instrument: InstrumentId; removedMm3: number; radius?: number }
  | { type: 'bleeding'; amount: number; rate: number }

export function instrumentTransition(
  state: InstrumentState,
  action: InstrumentAction,
  contact: InstrumentContact,
): { state: InstrumentState; cut?: TissueCut } {
  const next = { ...state, unsafe: false }
  const reject = (message: string) => ({
    state: { ...state, status: message, unsafe: true, safetyEvents: state.safetyEvents + 1 },
  })
  if (action.type === 'tick') {
    next.unsafe = state.unsafe
    const dt = Math.max(0, Math.min(0.1, action.dt))
    next.blood = Math.max(
      0,
      Math.min(1, state.blood + (state.bleedingRate - (state.suction ? 0.22 : 0)) * dt),
    )
    if (state.freezing) {
      if (!contact.touching || contact.kind !== 'tumor')
        return {
          state: {
            ...next,
            freezing: false,
            adhesion: 0,
            status: 'Contact was lost; the probe is no longer attached.',
          },
        }
      // This 2.5-second animation is an authored visual cue, not a clinical freeze prescription.
      next.adhesion = Math.min(1, state.adhesion + dt / 2.5)
      next.status =
        next.adhesion >= 1
          ? 'Visible tissue adhesion. Withdraw scope and probe together.'
          : 'Ice is forming at the tissue contact.'
    }
    return { state: next }
  }
  if (action.type === 'cut-complete') {
    if (action.removedMm3 <= 0.01)
      return {
        state: {
          ...next,
          freezing: false,
          adhesion: 0,
          loopCaptured: false,
          status: 'No additional tissue was captured. Reposition on residual tumor.',
        },
      }
    next.pending = {
      instrument: action.instrument,
      volumeMm3: action.removedMm3,
      radius:
        action.radius ??
        (action.instrument === 'forceps'
          ? FORCEPS_BITE_RADIUS
          : action.instrument === 'cryoprobe'
            ? CRYO_BITE_RADIUS
            : 4),
    }
    next.open = false
    next.freezing = false
    next.blood = Math.min(1, state.blood + (action.instrument === 'forceps' ? 0.055 : 0.14))
    next.bleedingRate = Math.min(
      0.018,
      state.bleedingRate + (action.instrument === 'snare' ? 0.001 : 0.003),
    )
    next.status =
      action.instrument === 'forceps'
        ? 'Tissue held in the closed jaws. Retrieve the forceps.'
        : 'Tissue is detached and retained. Withdraw the assembly en bloc.'
    return { state: next }
  }
  if (action.type === 'bleeding')
    return { state: { ...next, blood: action.amount, bleedingRate: action.rate } }
  if (action.type === 'oxygen')
    return { state: { ...next, oxygen: Math.min(1, Math.max(0.21, action.value)) } }
  if (action.type === 'return-electrode')
    return { state: { ...next, returnElectrode: action.value } }
  if (action.type === 'transfer') {
    if (!state.pending || !state.outside)
      return reject('Withdraw the retained tissue before transferring it.')
    next.specimens = [
      ...state.specimens,
      { instrument: state.pending.instrument, volumeMm3: state.pending.volumeMm3 },
    ]
    next.pending = null
    next.adhesion = 0
    next.loopCaptured = false
    next.status = 'Specimen transferred. Re-enter to inspect the residual lesion and bleeding.'
    return { state: next }
  }
  if (action.type === 'reenter') {
    if (state.pending) return reject('Transfer the specimen before re-entering.')
    return {
      state: {
        ...next,
        outside: false,
        extension: 0,
        status: 'Scope returned to the approach view. Inspect the remaining tissue.',
      },
    }
  }
  if (action.type === 'retrieve') {
    if (state.freezing && !state.pending)
      return reject(
        'Use cryoextraction while adhesion is maintained; do not pull the frozen probe into the channel.',
      )
    if (state.pending && state.pending.instrument !== 'forceps')
      return {
        state: {
          ...next,
          outside: true,
          extension: 0,
          status:
            'Scope, instrument and retained tissue are outside the airway. Transfer the specimen.',
        },
      }
    if (state.open)
      return reject('Close the instrument before withdrawing it into the working channel.')
    if (state.pending) {
      next.specimens = [
        ...state.specimens,
        { instrument: state.pending.instrument, volumeMm3: state.pending.volumeMm3 },
      ]
      next.pending = null
    }
    return {
      state: {
        ...next,
        extension: 0,
        suction: false,
        status: state.pending
          ? 'Forceps specimen retrieved. Inspect the biopsy site.'
          : 'Instrument withdrawn into the channel.',
      },
    }
  }
  if (state.outside) return reject('Re-enter the airway before manipulating an instrument.')
  if (action.type === 'select') {
    if (state.pending || state.freezing || state.extension > 0)
      return reject('Retrieve the instrument before changing tools.')
    return {
      state: {
        ...next,
        id: action.id,
        open: false,
        adhesion: 0,
        loopCaptured: false,
        status: 'Instrument selected. Advance it into view.',
      },
    }
  }
  if (action.type === 'suction') {
    if (action.value && (state.extension > 0 || state.pending))
      return reject(
        'This model uses an empty working channel for suction. Retrieve the instrument first.',
      )
    return {
      state: {
        ...next,
        suction: action.value,
        status: action.value
          ? 'Suction clears visible blood; the bleeding source remains active.'
          : 'Suction released.',
      },
    }
  }
  if (action.type === 'deploy') {
    if (state.pending || state.freezing || state.loopCaptured)
      return reject('The instrument is holding tissue. Complete retrieval before repositioning.')
    if (state.open && action.extension < 4)
      return reject('Close the instrument before withdrawing it into the channel.')
    return {
      state: {
        ...next,
        extension: Math.max(0, Math.min(contact.maximumExtension, action.extension)),
        adhesion: 0,
        suction: false,
        status:
          action.extension > contact.maximumExtension
            ? 'Instrument contact limits further advance. Redirect the scope to reach another surface.'
            : 'Instrument position updated.',
      },
    }
  }
  if (action.type === 'rotate') {
    if (state.pending || state.freezing || state.loopCaptured)
      return reject('Release or retrieve the attached instrument before rotating it.')
    return { state: { ...next, rotation: action.degrees } }
  }
  if (action.type === 'open') {
    if (state.id === 'cryoprobe') return reject('The cryoprobe has no jaws or loop to open.')
    if (state.pending || state.freezing)
      return reject('Retrieve the retained tissue before reopening the instrument.')
    if (state.extension < (state.id === 'snare' ? 8 : 4))
      return reject('Advance the tip fully into view before opening the instrument.')
    return {
      state: {
        ...next,
        open: true,
        loopCaptured: false,
        status:
          state.id === 'snare'
            ? 'Loop opened. Enclose the stalk before tightening.'
            : 'Jaws opened. Place them against visible tumor.',
      },
    }
  }
  if (action.type === 'close' && state.id === 'cryoprobe')
    return reject('The cryoprobe uses contact and freezing, not jaw closure.')
  if (action.type === 'thaw' && state.id !== 'cryoprobe')
    return reject('Thawing applies to the cryoprobe.')
  if (action.type === 'thaw')
    return {
      state: {
        ...next,
        freezing: false,
        adhesion: 0,
        status: 'Probe thawed and released. No tissue was removed by freezing alone.',
      },
    }
  if (state.pending) return reject('Retrieve the retained specimen before another tissue action.')
  if (state.blood > 0.65)
    return reject(
      'Blood obscures the target. Withdraw the instrument and restore the view before taking tissue.',
    )
  if (action.type === 'close' && state.id === 'snare') {
    if (!state.open) return { state: { ...next, status: 'Open and position the loop first.' } }
    return {
      state: {
        ...next,
        open: false,
        loopCaptured: contact.stalkInLoop,
        status: contact.stalkInLoop
          ? 'Stalk encircled. Review the thermal precautions before activating.'
          : 'The loop closed without capturing a stalk. Reopen and reposition.',
      },
    }
  }
  if (action.type === 'energize') {
    if (state.id !== 'snare')
      return reject('The selected instrument does not deliver electrosurgical energy.')
    if (state.oxygen >= 0.4)
      return reject(
        'Thermal activation blocked: the modeled inspired oxygen must be below 40%. This alone does not establish airway fire safety.',
      )
    if (!state.returnElectrode)
      return reject('Monopolar activation blocked: confirm the return-electrode circuit first.')
    if (!state.loopCaptured)
      return reject('No stalk is captured. Do not activate a free loop against the airway wall.')
    return {
      state: { ...next, status: 'Resecting the captured stalk…' },
      cut: { kind: 'snare', origin: contact.stalk, normal: contact.inward },
    }
  }
  if (action.type === 'close' && !state.open)
    return { state: { ...next, status: 'Open the jaws before taking a bite.' } }
  if (!contact.touching || contact.kind !== 'tumor' || !contact.target) {
    if (action.type === 'close') next.open = false
    return {
      state: {
        ...next,
        status:
          contact.kind === 'wall' && contact.touching
            ? 'Normal airway wall is not a tissue target. Reposition on the lesion.'
            : 'The instrument has not engaged tumor. Advance under direct view.',
        unsafe: contact.kind === 'wall' && contact.touching,
        safetyEvents: state.safetyEvents + (contact.kind === 'wall' && contact.touching ? 1 : 0),
      },
    }
  }
  const radius =
    state.id === 'forceps'
      ? Math.min(FORCEPS_BITE_RADIUS, contact.wallClearance - 0.4)
      : CRYO_BITE_RADIUS
  if (radius < 0.35 || (state.id !== 'forceps' && contact.wallClearance < radius + 0.5))
    return reject(
      'The proposed bite is too close to the normal airway wall. Choose a more protruding part of the lesion.',
    )
  if (action.type === 'freeze' && state.id !== 'cryoprobe')
    return reject('Select the cryoprobe for freezing.')
  if (action.type === 'freeze')
    return {
      state: {
        ...next,
        freezing: true,
        adhesion: 0,
        status: 'Ice is forming at the tissue contact.',
      },
    }
  if (
    action.type === 'extract' &&
    (state.id !== 'cryoprobe' || state.adhesion < 1 || !state.freezing)
  )
    return reject('Maintain tumor contact until visible adhesion develops before cryoextraction.')
  if (
    (action.type === 'close' && state.id === 'forceps') ||
    (action.type === 'extract' && state.id === 'cryoprobe')
  ) {
    return {
      state: { ...next, open: false, status: 'Separating the engaged tissue…' },
      cut: { kind: 'bite', center: contact.target, radius },
    }
  }
  return { state: next }
}

export function canRepositionScope(state: InstrumentState) {
  return state.extension === 0 && !state.pending && !state.freezing && !state.outside
}
export function contactDescription(contact: InstrumentContact, instrument: InstrumentState) {
  if (instrument.outside) return 'Assembly outside the airway'
  if (instrument.pending) return 'Tissue retained on instrument — complete retrieval'
  if (!instrument.extension) return 'Instrument inside channel'
  if (instrument.id === 'snare')
    return instrument.loopCaptured
      ? 'Stalk retained by loop'
      : contact.stalkInLoop
        ? 'Stalk within open loop'
        : 'Position loop around a discrete stalk'
  if (contact.touching)
    return contact.kind === 'tumor' ? 'Tip contacts tumor' : 'Tip contacts normal wall'
  return contact.target
    ? `${Math.max(0, magnitude(minus(contact.target, contact.tip))).toFixed(1)} mm to tumor along tool axis`
    : 'No tumor along tool axis'
}

/** Reviewed centerline approach; the working-channel axis is aimed at tissue, not the optical center. */
export function approachPose(
  frames: TransportFrames,
  placement: PathologyPlacement,
  collider: LumenCollider,
  siteId: PathologySiteId,
  instrument: InstrumentId,
) {
  const site = siteFor(siteId)
  let pose = frames.at(site.edgeId, Math.max(0, site.distanceMm - 25))
  for (let d = 25; d >= 8; d--) {
    const p = frames.at(site.edgeId, Math.max(0, site.distanceMm - d))
    if (collider.clearance(p.position) >= SCOPE_RADIUS_MM + 0.2) {
      pose = p
      break
    }
  }
  if (collider.clearance(pose.position) < SCOPE_RADIUS_MM) return null
  const target = plus(
    placement.wallPoint,
    times(placement.inward, placement.projectionMm * (instrument === 'snare' ? 0.24 : 0.83)),
  )
  for (let i = 0; i < 5; i++)
    pose = makeFrame(
      pose.position,
      unit(minus(target, channelOrigin(pose))),
      instrument === 'snare' ? placement.inward : pose.up,
    )
  return pose
}
