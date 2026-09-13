import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import { projectOptical } from '@/lib/bronchoscopy-core/frame'
import type { Vec3 } from '@/lib/airway-anatomy/types'
import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from '../../engine/scope/scopeOstia'
import { benchTargetObservation } from '../../engine/scope/scopeBenchTarget'
import type { ScopePaneProps } from './types'

/** Accessible fallback: project a fixed reference card with the actual camera frame. */
export function BenchSchematic({ state, view }: Pick<ScopePaneProps, 'state' | 'view'>) {
  if (!state.pose) return null
  const frame = scopeOpticalFrame(state.pose)
  const project = (point: Vec3) => {
    const p = projectOptical(point, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)
    return p ? [(p.x + 1) * 200, (1 - p.y) * 150] : null
  }
  const corners = (
    [
      [-28, -28, 65],
      [28, -28, 65],
      [28, 28, 65],
      [-28, 28, 65],
    ] as Vec3[]
  ).map(project)
  const target = view.benchTarget ? project(view.benchTarget.point) : null
  const observation = view.benchTarget
    ? benchTargetObservation(state, view.benchTarget.point)
    : null
  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-label={`Schematic scope view. ${observation ? `Gold target ${observation.position}. ` : ''}Depth ${Math.round(state.depthMm)} mm; rotation ${Math.round(state.inputs.rotationDeg)} degrees; deflection ${Math.round(state.inputs.deflectionDeg)} degrees.`}
      style={{ width: '100%', background: '#07111c' }}
    >
      {corners.every(Boolean) ? (
        <polygon
          points={corners.map((point) => point!.join(',')).join(' ')}
          fill="#c7d6d5"
          stroke="#65cecc"
          strokeWidth="2"
        />
      ) : null}
      {(
        [
          [-15, 15, 64],
          [15, -15, 64],
        ] as Vec3[]
      ).map((point, i) => {
        const p = project(point)
        return p ? (
          <circle key={i} cx={p[0]} cy={p[1]} r="8" fill={i ? '#3275a6' : '#ab4346'} />
        ) : null
      })}
      {target ? (
        <circle
          cx={target[0]}
          cy={target[1]}
          r="9"
          fill="#ffce57"
          stroke="#fff0b0"
          strokeWidth="2"
        />
      ) : null}
      <path d="M190 150 H210 M200 140 V160" stroke="#f4faff" strokeWidth="2" />
    </svg>
  )
}
