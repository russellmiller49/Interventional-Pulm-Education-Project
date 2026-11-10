'use client'

import { useId } from 'react'
import {
  RIMS,
  SECTORS,
  layoutArcMap,
  regionAncestry,
  rimSector,
  sectorAngle,
  type Anatomical,
  type MapLevel,
  type MapRegion,
  type Rim,
  type Sector,
} from '../engine/arc-map'
import { ANATOMICAL_LABEL, sectorWords } from '../content/plan-copy'
import styles from './nav-bench.module.css'

/**
 * The nested-arc map: the ostium circle with its four rim words, an arc for each branch at each
 * division, nested in the branch before, and a star on the branch that reaches the lesion.
 *
 * Map space is the unit circle, y down, angles clockwise from the top. The picture zooms on the
 * branch whose division is being drawn or driven, but never turns unless asked: the rim words sit
 * on the frame's edges, so a direction reads the same at any zoom.
 */
export interface ArcMapDrawing {
  placed: readonly Sector[]
  leadsOn: number | null
  /** How many branches this division has. */
  count: number
}
export interface ArcMapProps {
  /** The words round the circle, where the learner (or the model) put them. */
  rim: Record<Rim, Anatomical | null>
  /** Divisions already drawn, from the ostium out. */
  levels: readonly MapLevel[]
  /** The division being drawn now. */
  drawing?: ArcMapDrawing | null
  /** Zoom on the branch where this division (index into the drawn levels) takes place. */
  focus?: number | null
  /** Click a side of the focused branch to draw a branch there. */
  onPlace?: (sector: Sector) => void
  /** Degrees clockwise: the whole map turned to sit as the scope shows it. */
  rotation?: number
  /** The map reaches the lesion: star the last branch. */
  star?: boolean
  /** Accessible name: "Your map" / "Model map". */
  label: string
  variant?: 'large' | 'compact'
}

const unit = (angle: number): [number, number] => {
  const a = (angle * Math.PI) / 180
  return [Math.sin(a), -Math.cos(a)]
}
const fmt = (n: number) => Number(n.toFixed(4))

/** The region a division takes place in: the ostium, or the route's branch from the division before. */
function divisionHome(regions: readonly MapRegion[], level: number) {
  if (level === 0) return regions.find((r) => r.id === 'ostium')!
  return regions.find((r) => r.level === level - 1 && r.onRoute) ?? null
}

export function ArcMap({
  rim,
  levels,
  drawing,
  focus = null,
  onPlace,
  rotation = 0,
  star = false,
  label,
  variant = 'large',
}: ArcMapProps) {
  const uid = useId().replace(/:/g, '')
  const all: MapLevel[] = [
    ...levels,
    ...(drawing ? [{ angles: drawing.placed.map(sectorAngle), route: drawing.leadsOn }] : []),
  ]
  const regions = layoutArcMap(all)
  const drawingLevel = drawing ? levels.length : null
  const home = focus === null ? null : divisionHome(regions, focus)
  const zoomed = home && home.id !== 'ostium' ? home : null
  const cx = zoomed ? zoomed.inner.cx : 0,
    cy = zoomed ? zoomed.inner.cy : 0
  // Zoomed far enough to keep the branch around the current one in view.
  const half = zoomed ? Math.max(zoomed.inner.r * 2.1, 0.12) : 1.06
  const viewBox = `${fmt(cx - half)} ${fmt(cy - half)} ${fmt(2 * half)} ${fmt(2 * half)}`
  const clip = (id: string) => `${uid}-clip-${id.replace(':', '-')}`
  const byId = new Map(regions.map((r) => [r.id, r]))
  const target = regions.find((r) => r.target)
  const homeChain = home ? new Set(regionAncestry(regions, home.id).map((r) => r.id)) : null
  const textSize = half * 0.09

  return (
    <div
      className={styles.arcMap}
      data-arc-map={label}
      data-arc-map-variant={variant}
      data-arc-zoomed={zoomed ? true : undefined}
      role="img"
      aria-label={`${label}: ${RIMS.map((r) => `${r} ${rim[r] ?? 'blank'}`).join(', ')}. ${all.length} ${all.length === 1 ? 'division' : 'divisions'} drawn.`}
    >
      <svg viewBox={viewBox} aria-hidden>
        <defs>
          {regions.map((region) => {
            const parent = region.parent ? byId.get(region.parent)! : null
            const shape = region.cut ?? { cx: 0, cy: 0, r: 1 }
            return (
              <clipPath
                key={region.id}
                id={clip(region.id)}
                clipPath={parent ? `url(#${clip(parent.id)})` : undefined}
              >
                <circle cx={fmt(shape.cx)} cy={fmt(shape.cy)} r={fmt(shape.r)} />
              </clipPath>
            )
          })}
        </defs>
        <g transform={`rotate(${fmt(rotation)})`}>
          <circle className={styles.arcOstium} cx={0} cy={0} r={1} />
          {home && (
            <circle
              className={styles.arcHome}
              cx={0}
              cy={0}
              r={1.5}
              clipPath={`url(#${clip(home.id)})`}
              data-arc-home={home.id}
            />
          )}
          {regions.map((region) => {
            if (!region.cut || !region.parent) return null
            const pending = drawingLevel !== null && region.level === drawingLevel
            return (
              <circle
                key={region.id}
                className={styles.arc}
                cx={fmt(region.cut.cx)}
                cy={fmt(region.cut.cy)}
                r={fmt(region.cut.r)}
                clipPath={`url(#${clip(region.parent)})`}
                data-arc={region.id}
                data-arc-route={region.onRoute || undefined}
                data-arc-pending={pending || undefined}
                data-arc-reference={region.reference || undefined}
                data-arc-in-home={homeChain?.has(region.parent) || undefined}
              />
            )
          })}
          {/* The divisions, numbered in the order the scope meets them, at the carina's place. */}
          {all.map((_, level) => {
            const at = divisionHome(regions, level)
            if (!at) return null
            return (
              <text
                key={`n${level}`}
                className={styles.arcNumber}
                x={fmt(at.inner.cx)}
                y={fmt(at.inner.cy)}
                fontSize={fmt(Math.max(textSize, at.inner.r * 0.28))}
                transform={`rotate(${fmt(-rotation)} ${fmt(at.inner.cx)} ${fmt(at.inner.cy)})`}
                data-arc-division={level + 1}
              >
                {level + 1}
              </text>
            )
          })}
          {drawing &&
            regions
              .filter((r) => r.level === drawingLevel && !r.reference)
              .map((region) => (
                <text
                  key={`b${region.id}`}
                  className={styles.arcBranchNumber}
                  x={fmt(region.inner.cx)}
                  y={fmt(region.inner.cy)}
                  fontSize={fmt(Math.max(textSize, region.inner.r * 0.5))}
                  data-arc-branch={region.daughter! + 1}
                >
                  {region.daughter! + 1}
                </text>
              ))}
          {star && target && (
            <text
              className={styles.arcStar}
              x={fmt(target.inner.cx)}
              y={fmt(target.inner.cy + target.inner.r * 0.32)}
              fontSize={fmt(Math.max(textSize * 1.4, target.inner.r * 0.9))}
              data-arc-star
            >
              ★
            </text>
          )}
          {onPlace &&
            home &&
            SECTORS.map((sector) => {
              const { cx: hx, cy: hy, r } = home.inner
              const a0 = sectorAngle(sector) - 22.5,
                a1 = sectorAngle(sector) + 22.5
              const [x0, y0] = unit(a0),
                [x1, y1] = unit(a1)
              const inner = r * 0.3,
                outer = r * 1.08
              const d = `M ${fmt(hx + x0 * inner)} ${fmt(hy + y0 * inner)} L ${fmt(hx + x0 * outer)} ${fmt(hy + y0 * outer)} A ${fmt(outer)} ${fmt(outer)} 0 0 1 ${fmt(hx + x1 * outer)} ${fmt(hy + y1 * outer)} L ${fmt(hx + x1 * inner)} ${fmt(hy + y1 * inner)} A ${fmt(inner)} ${fmt(inner)} 0 0 0 ${fmt(hx + x0 * inner)} ${fmt(hy + y0 * inner)} Z`
              const taken = drawing?.placed.includes(sector)
              return (
                <path
                  key={sector}
                  className={styles.arcSector}
                  d={d}
                  data-arc-sector={sector}
                  data-arc-sector-taken={taken || undefined}
                  onClick={() => onPlace(sector)}
                />
              )
            })}
        </g>
      </svg>
      {RIMS.map((position) => {
        const [x, y] = unit(sectorAngle(rimSector[position]) + rotation)
        const word = rim[position]
        return (
          <span
            key={position}
            className={styles.arcRimWord}
            style={{ left: `${50 + 44 * x}%`, top: `${50 + 44 * y}%` }}
            data-arc-rim={position}
          >
            {word ? ANATOMICAL_LABEL[word] : '?'}
          </span>
        )
      })}
    </div>
  )
}

/** The eight places round the focused branch, named by the circle's words, for the keyboard. */
export function sectorChoices(rim: Record<Rim, Anatomical | null>) {
  return SECTORS.map((sector) => ({ sector, words: sectorWords(sector, rim) }))
}
