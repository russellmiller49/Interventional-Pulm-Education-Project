import type { McsSimulationState } from '../engine/types'
import type { McsMonitorTargetId } from './primarySurfaces'
import type { McsMapSegmentId } from './supportSpine'

/**
 * Where each bedside reading is taken on the circulation.
 *
 * A fellow reading "Right atrial pressure 12 mm Hg" beside a drawing of the loop should be able to
 * point at the number and see the right atrium light. Each reading names the segments of the loop
 * it describes; the circulation map lights those segments and the three-dimensional heart lights
 * the matching structures. The same row names the monitor region that carries the reading, so the
 * open monitor marks it too.
 *
 * These are statements of where a number comes from, not thresholds: an arterial line reads the
 * arterial side, a wedge pressure stands in for left atrial pressure, native forward flow is what
 * crosses the aortic valve, and a left-sided pump moves blood from the left ventricle to the
 * ascending aorta. Electrical power and the pulsatility index are read at the controller, not at
 * a place on the loop, so they point only at their region of the monitor.
 */
export type McsReadingId =
  | 'mean-arterial-pressure'
  | 'right-atrial-pressure'
  | 'wedge-pressure'
  | 'native-flow'
  | 'left-pump-estimate'
  | 'right-pump-estimate'
  | 'effective-systemic-flow'
  | 'lv-volume'
  | 'pump-power'
  | 'pulsatility-index'

export interface McsPointedPlace {
  readonly readingId: McsReadingId
  /** The reading's own label, as the learner reads it. */
  readonly label: string
  /** "the right atrium": lower case, with its article. */
  readonly placeName: string
  /**
   * The highlight in words ("Right atrial pressure is read in the right atrium."), shown beside
   * the readings and as the map's caption, so the emphasis is never carried by colour alone.
   */
  readonly sentence: string
  readonly segmentIds: readonly McsMapSegmentId[]
  readonly monitorTarget: McsMonitorTargetId
}

export interface McsReadingPlace {
  /** Completes "{label} is read in …" / "… comes from …". */
  readonly sentence: (label: string) => string
  readonly placeName: string
  readonly segmentIds: readonly McsMapSegmentId[]
  readonly monitorTarget: McsMonitorTargetId
}

const LEFT_PUMP: readonly McsMapSegmentId[] = ['left-ventricle', 'ascending-aorta']

export function mcsReadingPlace(
  readingId: McsReadingId,
  deviceKind: McsSimulationState['deviceKind'],
): McsReadingPlace | null {
  switch (readingId) {
    case 'mean-arterial-pressure':
      return {
        placeName: 'the aorta, on the arterial side',
        sentence: (label) => `${label} is read on the arterial side: the aorta.`,
        segmentIds: ['ascending-aorta', 'descending-aorta'],
        monitorTarget: 'monitor:arterial-waveform',
      }
    case 'right-atrial-pressure':
      return {
        placeName: 'the right atrium',
        sentence: (label) => `${label} is read in the right atrium.`,
        segmentIds: ['right-atrium'],
        monitorTarget: 'monitor:filling-pressures',
      }
    case 'wedge-pressure':
      return {
        placeName: 'the left atrium',
        sentence: (label) => `${label} stands in for the pressure in the left atrium.`,
        segmentIds: ['left-atrium'],
        monitorTarget: 'monitor:filling-pressures',
      }
    case 'native-flow':
      return {
        placeName: 'the aortic valve',
        sentence: (label) => `${label} is what the heart ejects across the aortic valve.`,
        segmentIds: ['aortic-valve'],
        monitorTarget: 'monitor:flow-account',
      }
    case 'left-pump-estimate':
      return {
        placeName: 'the left ventricle to the ascending aorta',
        sentence: (label) =>
          deviceKind === 'lvad'
            ? `${label} is the pump’s path: left ventricular apex to ascending aorta.`
            : `${label} is the pump’s path: left ventricle to ascending aorta.`,
        segmentIds: LEFT_PUMP,
        monitorTarget: 'monitor:flow-account',
      }
    case 'right-pump-estimate':
      return {
        placeName: 'the venous return to the pulmonary artery',
        sentence: (label) => `${label} is the right pump’s path: vena cava to pulmonary artery.`,
        segmentIds: ['venous-return', 'pulmonary-artery'],
        monitorTarget: 'monitor:flow-account',
      }
    case 'effective-systemic-flow':
      return {
        placeName: 'the descending aorta and the body',
        sentence: (label) => `${label} is what leaves the aorta for the body.`,
        segmentIds: ['descending-aorta', 'systemic-bed'],
        monitorTarget: 'monitor:flow-account',
      }
    case 'lv-volume':
      return {
        placeName: 'the left ventricle',
        sentence: (label) => `${label} is the filling of the left ventricle.`,
        segmentIds: ['left-ventricle'],
        monitorTarget: 'monitor:filling-pressures',
      }
    case 'pump-power':
    case 'pulsatility-index':
      return null
  }
}

/**
 * The structures of the CT heart model that stand for each segment of the loop. The model has one
 * aorta, so both aortic segments light it; it has no lung or systemic bed, so those light nothing
 * there and the map carries them.
 */
export const MCS_SEGMENT_HEART_MESHES: Readonly<Record<McsMapSegmentId, readonly string[]>> = {
  'venous-return': ['CT_SVC', 'CT_IVC'],
  'right-atrium': ['CT_RA_Cavity'],
  'right-ventricle': ['CT_RV_Cavity'],
  'pulmonary-artery': ['CT_PulmonaryArteries'],
  lungs: [],
  'left-atrium': ['CT_LA_Cavity', 'CT_LeftPulmonaryVeins', 'CT_RightPulmonaryVeins'],
  'left-ventricle': ['CT_LV_Cavity'],
  'aortic-valve': ['CT_Valve_Aortic_LCC', 'CT_Valve_Aortic_NCC', 'CT_Valve_Aortic_RCC'],
  'ascending-aorta': ['CT_Aorta'],
  'descending-aorta': ['CT_Aorta'],
  'systemic-bed': [],
}

export function mcsHeartMeshesFor(segmentIds: readonly McsMapSegmentId[]): readonly string[] {
  return [...new Set(segmentIds.flatMap((id) => MCS_SEGMENT_HEART_MESHES[id]))]
}
