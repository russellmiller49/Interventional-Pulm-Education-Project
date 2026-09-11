'use client'

import type { ReactNode } from 'react'

import { HandoffContent } from '@/i18n/handoff'
import { clamp } from '@/lib/airway-anatomy/geometry'
import type { OstiumLabel } from '@/lib/airway-anatomy/ostia'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import type { ScopePoseSnapshot, Vec3 } from '@/lib/airway-anatomy/types'
import { projectOptical, type LumenCollider } from '@/lib/bronchoscopy-core/frame'

/** The virtual bronchoscope's nominal field of view, in degrees across the wider axis. */
export const BRONCH_FOV_DEG = 88

export interface PlacedOstium extends OstiumLabel {
  leftPct: number
  topPct: number
  depthMm: number
}

/**
 * The in-view ostium labels over the optical viewport: each opening ahead, projected through the
 * scope's optical frame, hidden when the lumen wall occludes it or it sits outside the frame.
 *
 * `renderPin` lets a caller draw each pin its own way (a `<label htmlFor>` for an answer input);
 * omitted, the pin is the admin module's align button, unchanged.
 */
export function BronchLabelOverlay({
  ostia,
  pose,
  aspect,
  onAlignBranch,
  collider,
  renderPin,
}: {
  collider: LumenCollider | null
  ostia: OstiumLabel[]
  pose: ScopePoseSnapshot
  aspect: number
  onAlignBranch: (edgeId: number) => void
  renderPin?: (item: PlacedOstium, labelScale: number) => ReactNode
}) {
  const placed = ostia
    .map((ostium) => {
      if (collider && !collider.visible(pose.tipLps, ostium.pointLps)) return null
      const projected = projectToViewport(ostium.pointLps, pose, aspect)
      if (!projected || projected.depthMm < 1.5 || projected.depthMm > 130) return null
      if (
        projected.leftPct < 1 ||
        projected.leftPct > 99 ||
        projected.topPct < 3 ||
        projected.topPct > 97
      ) {
        return null
      }
      return { ...ostium, ...projected }
    })
    .filter((item): item is NonNullable<typeof item> => item != null)

  if (!placed.length) return <HandoffContent>{null}</HandoffContent>

  return (
    <HandoffContent>
      {
        <div className="pointer-events-none absolute inset-0 z-10">
          {placed.map((item) => {
            const labelScale = clamp(34 / item.depthMm, 0.78, 1.35)
            if (renderPin) return renderPin(item, labelScale)
            return (
              <button
                type="button"
                key={`${item.abbr}-${item.edgeId}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onAlignBranch(item.edgeId)}
                title={`Align scope toward ${item.abbr}`}
                className="pointer-events-auto absolute cursor-pointer text-center leading-tight transition-opacity hover:opacity-80 focus:outline-none"
                style={{
                  left: `${item.leftPct}%`,
                  top: `${item.topPct}%`,
                  transform: `translate(-50%, -50%) scale(${labelScale})`,
                }}
              >
                <span
                  className="block text-[15px] font-semibold tracking-wide"
                  style={{
                    color: '#8fe3d9',
                    textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)',
                  }}
                >
                  {item.abbr}
                </span>
                {item.descriptor && (
                  <span
                    className="block text-[12px] font-medium"
                    style={{
                      color: '#9ce8de',
                      textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)',
                    }}
                  >
                    {item.descriptor}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      }
    </HandoffContent>
  )
}

export function projectToViewport(
  pointLps: Vec3,
  pose: ScopePoseSnapshot,
  aspect: number,
  fovDeg: number = BRONCH_FOV_DEG,
): { leftPct: number; topPct: number; depthMm: number } | null {
  const projected = projectOptical(pointLps, scopeOpticalFrame(pose), aspect, fovDeg)
  if (!projected) return null
  return {
    leftPct: (0.5 + projected.x / 2) * 100,
    topPct: (0.5 - projected.y / 2) * 100,
    depthMm: projected.depth,
  }
}
