import { minus, projectOptical, scalar, unit } from '@/lib/bronchoscopy-core/frame'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import type { Vec3 } from '@/lib/airway-anatomy/types'
import type { ScopeState } from '../../components/scope/types'
import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from './scopeOstia'

/** Read the real engine optical frame; never derive a second motion response from slider values. */
export function benchTargetObservation(state: ScopeState, point: Vec3) {
  if (!state.pose || state.place !== 'bench') return null
  const frame = scopeOpticalFrame(state.pose)
  const relative = minus(point, frame.position)
  const direction = unit(relative, frame.forward)
  const angleDeg =
    (Math.acos(Math.max(-1, Math.min(1, scalar(direction, frame.forward)))) * 180) / Math.PI
  const projected = projectOptical(point, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)
  const position =
    !projected || scalar(relative, frame.forward) <= 0
      ? 'outside the forward view'
      : angleDeg <= 5
        ? 'centered'
        : [
            projected.y > 0.04 ? 'above' : projected.y < -0.04 ? 'below' : '',
            projected.x > 0.04 ? 'right of' : projected.x < -0.04 ? 'left of' : '',
          ]
            .filter(Boolean)
            .join(' and ') + ' center'
  return { angleDeg, projected, position }
}
