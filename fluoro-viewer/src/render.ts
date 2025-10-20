import { DETECTOR_NORMAL, applyRotation, dot, projectPoint, smoothstep } from './geometry'
import type { ProjectedPoint } from './geometry'
import type { PreparedBranch, RenderOptions, RenderStats } from './types'

const RADIUS_SCALE = 0.35
const MIN_WIDTH = 0.4
const MAX_WIDTH = 2.2

export function renderScene(options: RenderOptions): RenderStats {
  const { ctx, canvas, branches, frame, state, goldenOrder } = options
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const sortedBranches = [...branches].sort((a, b) => {
    return orderValue(a, goldenOrder) - orderValue(b, goldenOrder)
  })

  let segmentsDrawn = 0

  for (const branch of sortedBranches) {
    if (!state.activeGroups.has(branch.groupKey)) {
      continue
    }

    const strokeWidth = pickStrokeWidth(branch, state.useRadiusWidths)
    ctx.strokeStyle = branch.color
    ctx.lineWidth = strokeWidth

    for (const poly of branch.polylines) {
      if (poly.length < 2) continue
      let prev = null

      for (const point of poly) {
        const rotated = applyRotation(frame.rotation, point)
        const projected = projectPoint(frame, rotated)
        if (!projected) {
          prev = null
          continue
        }

        if (prev) {
          const alpha = state.useDts
            ? (computeAlpha(frame, prev) + computeAlpha(frame, projected)) / 2
            : 1
          if (alpha <= 0.015) {
            prev = projected
            continue
          }
          ctx.globalAlpha = alpha
          ctx.beginPath()
          ctx.moveTo(prev.screen[0], prev.screen[1])
          ctx.lineTo(projected.screen[0], projected.screen[1])
          ctx.stroke()
          segmentsDrawn += 1
        }
        prev = projected
      }
    }
  }

  if (state.showLabels) {
    ctx.globalAlpha = 1
    ctx.font = "14px 'Inter', 'Helvetica Neue', Arial, sans-serif"
    ctx.fillStyle = '#f3f5ff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const branch of sortedBranches) {
      if (!state.activeGroups.has(branch.groupKey)) continue
      const rotated = applyRotation(frame.rotation, branch.anchorPoint)
      const projected = projectPoint(frame, rotated)
      if (!projected) continue
      const alpha = state.useDts ? computeAlpha(frame, projected) : 1
      if (alpha <= 0.05) continue
      ctx.globalAlpha = alpha
      const textX = projected.screen[0] + 6
      const textY = projected.screen[1]
      drawLabelBackground(ctx, branch.label, textX, textY)
      ctx.fillText(branch.label, textX + 4, textY)
    }
  }

  ctx.restore()
  ctx.globalAlpha = 1

  return {
    segmentsDrawn,
  }
}

function orderValue(branch: PreparedBranch, goldenOrder: string[]): number {
  const index = goldenOrder.indexOf(branch.groupKey)
  return index === -1 ? goldenOrder.length + 1 : index
}

function pickStrokeWidth(branch: PreparedBranch, radiusMode: boolean): number {
  if (!radiusMode || branch.medianRadiusMm === undefined) {
    return 1.0
  }
  const width = branch.medianRadiusMm * RADIUS_SCALE
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

function computeAlpha(frame: RenderOptions['frame'], proj: ProjectedPoint) {
  if (!proj) return 0
  if (proj.t <= 0 || proj.t >= frame.maxT) return 0
  const dotValue = dot(proj.rayDir, DETECTOR_NORMAL)
  const [edge0, edge1] = frame.smoothstepRange
  return smoothstep(edge0, edge1, dotValue)
}

function drawLabelBackground(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const paddingX = 6
  const paddingY = 4
  const metrics = ctx.measureText(text)
  const width = metrics.width + paddingX * 2 + 4
  const height = 16 // approximate
  ctx.save()
  ctx.fillStyle = 'rgba(8, 10, 18, 0.75)'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1
  const rectX = x
  const rectY = y - height / 2
  roundRect(ctx, rectX, rectY, width, height, 6)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
