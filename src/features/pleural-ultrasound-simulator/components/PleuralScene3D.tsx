'use client'

import { useMemo } from 'react'

import type { LabelBounds, PleuralProbeState, PleuralSimulatorCase } from '../types'
import { HandoffContent } from '@/i18n/handoff'

interface PleuralScene3DProps {
  caseData: PleuralSimulatorCase
  probe: PleuralProbeState
  needleUnsafe: boolean
}

const viewBox = {
  width: 720,
  height: 430,
  padX: 58,
  padY: 48,
}

type BoundsRange = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function PleuralScene3D({ caseData, probe, needleUnsafe }: PleuralScene3DProps) {
  const map = useMemo(() => buildMapProjection(caseData), [caseData])
  const probePoint = map.point(probe.lateralMm, probe.craniocaudalMm)
  const fanLength = Math.min(168, Math.max(90, probe.depthCm * 9))
  const fanHalfWidth = Math.min(108, Math.max(42, probe.sectorAngleDeg * 1.15))
  const rotationOffset = Math.max(-54, Math.min(54, probe.rotationDeg * 2.4))
  const fanTip = {
    x: probePoint.x + rotationOffset,
    y: Math.min(viewBox.height - viewBox.padY * 0.55, probePoint.y + fanLength),
  }
  const fanLeft = {
    x: Math.max(viewBox.padX * 0.35, fanTip.x - fanHalfWidth),
    y: fanTip.y,
  }
  const fanRight = {
    x: Math.min(viewBox.width - viewBox.padX * 0.35, fanTip.x + fanHalfWidth),
    y: fanTip.y,
  }
  const pathColor = needleUnsafe ? '#f59e0b' : '#10b981'

  return (
    <HandoffContent>
      {
        <article className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border/80 px-5 py-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Scan-window map</h3>
              <p className="text-sm text-muted-foreground">
                Surface projection of the pocket, rib shadows, diaphragm, and path
              </p>
            </div>
            <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
              <LegendSwatch color="#2563eb" label="Fluid" />
              <LegendSwatch color="#94a3b8" label="Rib shadow" />
              <LegendSwatch color={pathColor} label="Path" />
            </div>
          </div>

          <div className="bg-slate-950 px-3 py-4">
            <svg
              aria-label="Projected pleural access window map"
              className="h-[32rem] w-full"
              role="img"
              viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
            >
              <defs>
                <linearGradient id="pleural-map-skin" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#7f1d1d" stopOpacity="0.34" />
                  <stop offset="50%" stopColor="#78350f" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#451a03" stopOpacity="0.16" />
                </linearGradient>
                <radialGradient id="pleural-map-fluid" cx="50%" cy="48%" r="64%">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.84" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.42" />
                </radialGradient>
                <filter id="pleural-map-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="10"
                    floodColor="#020617"
                    floodOpacity="0.35"
                    stdDeviation="8"
                  />
                </filter>
              </defs>

              <rect width={viewBox.width} height={viewBox.height} rx="18" fill="#020617" />
              <rect
                x={viewBox.padX - 22}
                y={viewBox.padY - 20}
                width={viewBox.width - viewBox.padX * 2 + 44}
                height={viewBox.height - viewBox.padY * 2 + 40}
                rx="28"
                fill="url(#pleural-map-skin)"
                stroke="#7c2d12"
                strokeOpacity="0.46"
              />

              {map.ribBands.map((band) => (
                <path
                  key={band.key}
                  d={band.path}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeLinecap="round"
                  strokeOpacity={band.major ? 0.44 : 0.24}
                  strokeWidth={band.major ? 7 : 4}
                />
              ))}

              {map.diaphragm ? (
                <path
                  d={map.diaphragm.path}
                  fill="none"
                  stroke="#f59e0b"
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                  strokeOpacity="0.62"
                  strokeWidth="6"
                />
              ) : null}

              {map.liver ? (
                <ellipse
                  cx={map.liver.cx}
                  cy={map.liver.cy}
                  fill="#b45309"
                  filter="url(#pleural-map-soft-shadow)"
                  opacity="0.36"
                  rx={map.liver.rx}
                  ry={map.liver.ry}
                  stroke="#f59e0b"
                  strokeOpacity="0.32"
                  strokeWidth="2"
                />
              ) : null}

              {map.spleen ? (
                <ellipse
                  cx={map.spleen.cx}
                  cy={map.spleen.cy}
                  fill="#7c3aed"
                  opacity="0.26"
                  rx={map.spleen.rx}
                  ry={map.spleen.ry}
                  stroke="#c4b5fd"
                  strokeOpacity="0.3"
                  strokeWidth="2"
                />
              ) : null}

              {map.fluid ? (
                <ellipse
                  cx={map.fluid.cx}
                  cy={map.fluid.cy}
                  fill="url(#pleural-map-fluid)"
                  filter="url(#pleural-map-soft-shadow)"
                  rx={map.fluid.rx}
                  ry={map.fluid.ry}
                  stroke="#bfdbfe"
                  strokeOpacity="0.72"
                  strokeWidth="3"
                />
              ) : null}

              <path
                d={`M ${probePoint.x.toFixed(1)} ${probePoint.y.toFixed(1)} L ${fanLeft.x.toFixed(1)} ${fanLeft.y.toFixed(1)} L ${fanRight.x.toFixed(1)} ${fanRight.y.toFixed(1)} Z`}
                fill="#38bdf8"
                opacity="0.12"
                stroke="#38bdf8"
                strokeDasharray="8 8"
                strokeOpacity="0.44"
                strokeWidth="2"
              />
              <line
                stroke={pathColor}
                strokeLinecap="round"
                strokeWidth="4"
                x1={probePoint.x}
                x2={fanTip.x}
                y1={probePoint.y - 18}
                y2={fanTip.y}
              />
              <g transform={`translate(${probePoint.x} ${probePoint.y - 25})`}>
                <rect
                  fill="#e5e7eb"
                  height="30"
                  opacity="0.94"
                  rx="8"
                  stroke="#f8fafc"
                  strokeOpacity="0.62"
                  strokeWidth="2"
                  width="74"
                  x="-37"
                  y="-15"
                />
                <rect fill="#111827" height="6" opacity="0.82" rx="3" width="42" x="-21" y="13" />
              </g>

              <MapLabel anchor="start" text="cranial" x={viewBox.padX - 14} y={28} />
              <MapLabel
                anchor="start"
                text="caudal"
                x={viewBox.padX - 14}
                y={viewBox.height - 18}
              />
              <MapLabel
                anchor="end"
                text={needleUnsafe ? 'hazard path' : 'teaching window'}
                x={viewBox.width - 34}
                y={34}
              />
            </svg>
          </div>
        </article>
      }
    </HandoffContent>
  )
}

function buildMapProjection(caseData: PleuralSimulatorCase) {
  const bounds = caseData.labelBoundsLpsMm
  const range = buildRange([
    bounds.skin,
    bounds.rib,
    bounds.pleuralFluid,
    bounds.diaphragm,
    bounds.liver,
    bounds.spleen,
  ])

  function x(lateralMm: number) {
    return (
      viewBox.padX +
      ((lateralMm - range.minX) / Math.max(1, range.maxX - range.minX)) *
        (viewBox.width - viewBox.padX * 2)
    )
  }

  function y(craniocaudalMm: number) {
    return (
      viewBox.padY +
      ((range.maxZ - craniocaudalMm) / Math.max(1, range.maxZ - range.minZ)) *
        (viewBox.height - viewBox.padY * 2)
    )
  }

  function point(lateralMm: number, craniocaudalMm: number) {
    return {
      x: clamp(x(lateralMm), 26, viewBox.width - 26),
      y: clamp(y(craniocaudalMm), 34, viewBox.height - 26),
    }
  }

  function oval(labelBounds: LabelBounds | undefined, minRadius = 18) {
    if (!labelBounds) return null

    const centerX = (labelBounds.min[0] + labelBounds.max[0]) / 2
    const centerZ = (labelBounds.min[2] + labelBounds.max[2]) / 2
    const left = x(labelBounds.min[0])
    const right = x(labelBounds.max[0])
    const top = y(labelBounds.max[2])
    const bottom = y(labelBounds.min[2])
    const center = point(centerX, centerZ)

    return {
      cx: center.x,
      cy: center.y,
      rx: Math.max(minRadius, Math.abs(right - left) / 2),
      ry: Math.max(minRadius, Math.abs(bottom - top) / 2),
    }
  }

  const ribBands = buildRibBands(bounds.rib, x, y)
  const diaphragm = buildDiaphragmPath(bounds.diaphragm, x, y)

  return {
    diaphragm,
    fluid: oval(bounds.pleuralFluid, 28),
    liver: oval(bounds.liver, 24),
    point,
    ribBands,
    spleen: oval(bounds.spleen, 20),
  }
}

function buildRange(items: Array<LabelBounds | undefined>): BoundsRange {
  const present = items.filter((item): item is LabelBounds => Boolean(item))
  const minX = Math.min(...present.map((item) => item.min[0]))
  const maxX = Math.max(...present.map((item) => item.max[0]))
  const minZ = Math.min(...present.map((item) => item.min[2]))
  const maxZ = Math.max(...present.map((item) => item.max[2]))
  const xPad = Math.max(24, (maxX - minX) * 0.08)
  const zPad = Math.max(24, (maxZ - minZ) * 0.08)

  return {
    minX: minX - xPad,
    maxX: maxX + xPad,
    minZ: minZ - zPad,
    maxZ: maxZ + zPad,
  }
}

function buildRibBands(
  ribBounds: LabelBounds | undefined,
  x: (value: number) => number,
  y: (value: number) => number,
) {
  if (!ribBounds) return []

  const count = 7
  const x1 = x(ribBounds.min[0])
  const x2 = x(ribBounds.max[0])
  const zMin = ribBounds.min[2]
  const zMax = ribBounds.max[2]

  return Array.from({ length: count }, (_, index) => {
    const fraction = index / (count - 1)
    const z = zMin + (zMax - zMin) * fraction
    const yCenter = y(z)
    const sway = index % 2 === 0 ? 18 : -14
    return {
      key: `rib-${index}`,
      major: index % 2 === 0,
      path: `M ${x1.toFixed(1)} ${yCenter.toFixed(1)} C ${(x1 + 150).toFixed(1)} ${(yCenter - 20).toFixed(1)}, ${(x2 - 150).toFixed(1)} ${(yCenter + sway).toFixed(1)}, ${x2.toFixed(1)} ${(yCenter - 6).toFixed(1)}`,
    }
  })
}

function buildDiaphragmPath(
  diaphragmBounds: LabelBounds | undefined,
  x: (value: number) => number,
  y: (value: number) => number,
) {
  if (!diaphragmBounds) return null

  const x1 = x(diaphragmBounds.min[0])
  const x2 = x(diaphragmBounds.max[0])
  const yCenter = y((diaphragmBounds.min[2] + diaphragmBounds.max[2]) / 2)
  const controlY = yCenter - 28

  return {
    path: `M ${x1.toFixed(1)} ${yCenter.toFixed(1)} C ${(x1 + 130).toFixed(1)} ${controlY.toFixed(1)}, ${(x2 - 130).toFixed(1)} ${(controlY + 16).toFixed(1)}, ${x2.toFixed(1)} ${(yCenter + 10).toFixed(1)}`,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <HandoffContent>
      {
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
      }
    </HandoffContent>
  )
}

function MapLabel({
  anchor,
  text,
  x,
  y,
}: {
  anchor: 'end' | 'start'
  text: string
  x: number
  y: number
}) {
  return (
    <HandoffContent>
      {
        <text
          fill="#cbd5e1"
          fontSize="13"
          fontWeight="700"
          letterSpacing="0"
          opacity="0.74"
          textAnchor={anchor}
          x={x}
          y={y}
        >
          {text}
        </text>
      }
    </HandoffContent>
  )
}
