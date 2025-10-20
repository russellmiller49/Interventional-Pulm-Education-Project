import './style.css'

import { prepareFrameContext } from './geometry'
import { BRANCH_GROUPS, groupKeyForLabel, ensureGroupAssignment } from './grouping'
import { renderScene } from './render'
import { initUI, populateLegend, updateAngleDisplays } from './ui'
import type {
  AppState,
  Branch,
  CenterlinesFile,
  FluoroConfig,
  PreparedBranch,
  RadiusMap,
  RenderOptions,
  Vec3,
} from './types'

const GOLDEN_ORDER = BRANCH_GROUPS.map((group) => group.key)
const ORIGIN_GROUP = 'other'

async function bootstrap() {
  const ui = initUI()
  updateAngleDisplays(ui)

  const ctx = getRenderingContext(ui.canvas)

  const [config, rawCenterlines, radiusMap] = await Promise.all([
    fetchJson<FluoroConfig>('fluoro_config.json'),
    fetchRawCenterlines(),
    fetchRadiusMap(),
  ])

  if (config.units !== 'mm' || config.coordinateSystem !== 'LPS') {
    throw new Error('Configuration mismatch: expected mm + LPS.')
  }

  const prepared = prepareBranches(rawCenterlines, config, radiusMap)
  ensureGroupAssignment(rawCenterlines.branches)
  populateLegend(ui, buildLegendEntries(prepared))

  const state: AppState = {
    raoLao: config.default_view.rao_lao_deg,
    cranialCaudal: config.default_view.cranial_caudal_deg,
    useDts: false,
    useRadiusWidths: false,
    showLabels: true,
    activeGroups: new Set([...GOLDEN_ORDER, ORIGIN_GROUP]),
  }

  ui.raoSlider.value = state.raoLao.toString()
  ui.cranSlider.value = state.cranialCaudal.toString()
  ui.dtsToggle.checked = state.useDts
  ui.radiusToggle.checked = state.useRadiusWidths
  ui.labelsToggle.checked = state.showLabels
  updateAngleDisplays(ui)

  for (const [groupKey, input] of ui.groupToggles) {
    input.checked = true
    input.addEventListener('input', () => {
      if (input.checked) {
        state.activeGroups.add(groupKey)
      } else {
        state.activeGroups.delete(groupKey)
      }
      requestRender()
    })
  }

  ui.raoSlider.addEventListener('input', () => {
    state.raoLao = Number(ui.raoSlider.value)
    updateAngleDisplays(ui)
    requestRender()
  })

  ui.cranSlider.addEventListener('input', () => {
    state.cranialCaudal = Number(ui.cranSlider.value)
    updateAngleDisplays(ui)
    requestRender()
  })

  ui.dtsToggle.addEventListener('change', () => {
    state.useDts = ui.dtsToggle.checked
    requestRender()
  })

  ui.radiusToggle.addEventListener('change', () => {
    state.useRadiusWidths = ui.radiusToggle.checked
    requestRender()
  })

  ui.labelsToggle.addEventListener('change', () => {
    state.showLabels = ui.labelsToggle.checked
    requestRender()
  })

  let needsRender = true
  let lastTime = performance.now()
  let fps = 0

  function requestRender() {
    needsRender = true
  }

  function renderLoop(now: number) {
    requestAnimationFrame(renderLoop)
    if (!needsRender) {
      return
    }
    const delta = now - lastTime
    lastTime = now
    const instantFps = delta > 0 ? 1000 / delta : 0
    fps = fps * 0.85 + instantFps * 0.15

    resizeCanvasForDpr(ui.canvas, ctx, config.detector_pixels)
    const canvasSize: [number, number] = [ui.canvas.clientWidth, ui.canvas.clientHeight]
    const frame = prepareFrameContext({
      config: {
        sid: config.source_to_isocenter_mm,
        sdd: config.source_to_detector_mm,
        pixelPitch: config.pixel_pitch_mm,
        detectorPixels: config.detector_pixels,
        isocenter: config.isocenter_mm,
      },
      angles: {
        raoLao: state.raoLao,
        cranialCaudal: state.cranialCaudal,
      },
      canvasSize,
    })

    const renderOptions: RenderOptions = {
      canvas: ui.canvas,
      ctx,
      branches: prepared,
      frame,
      state,
      goldenOrder: GOLDEN_ORDER,
    }
    const stats = renderScene(renderOptions)
    ui.statsEl.textContent = `FPS ${fps.toFixed(1)} · segments ${stats.segmentsDrawn}`
    needsRender = false
  }

  window.addEventListener('resize', requestRender)
  requestAnimationFrame(renderLoop)
  requestRender()
}

bootstrap().catch((err) => {
  console.error(err)
  const app = document.getElementById('app')
  if (app) {
    app.innerHTML = `<pre class="error">Failed to load viewer:\n${String(err)}</pre>`
  }
})

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function fetchRawCenterlines(): Promise<CenterlinesFile> {
  const raw = await fetchJson<{
    units: 'mm'
    coordinateSystem: 'LPS'
    labels: {
      name: string
      color_rgb: [number, number, number]
      polylines: number[][][]
    }[]
  }>('airway_centerlines_labeled.json')

  if (raw.units !== 'mm' || raw.coordinateSystem !== 'LPS') {
    throw new Error('Centerline file must be mm/LPS.')
  }

  const branches: Branch[] = raw.labels.map((label) => ({
    label: label.name,
    color: label.color_rgb,
    polylines: label.polylines as Branch['polylines'],
  }))

  return {
    units: raw.units,
    coordinateSystem: raw.coordinateSystem,
    branches,
  }
}

async function fetchRadiusMap(): Promise<RadiusMap> {
  try {
    return await fetchJson<RadiusMap>('label_radius_map.json')
  } catch (err) {
    console.warn('radius map unavailable, continuing with constant widths.', err)
    return {}
  }
}

function prepareBranches(
  data: CenterlinesFile,
  config: FluoroConfig,
  radiusMap: RadiusMap,
): PreparedBranch[] {
  const isocenter = config.isocenter_mm
  const branches: PreparedBranch[] = []

  for (const branch of data.branches) {
    const centered = branch.polylines.map((poly) =>
      poly.map((pt) => [pt[0] - isocenter[0], pt[1] - isocenter[1], pt[2] - isocenter[2]] as Vec3),
    )

    const anchor = pickAnchorPoint(centered)
    const rgb = branch.color
    const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
    const groupKey = groupKeyForLabel(branch.label)

    branches.push({
      label: branch.label,
      color,
      colorRgb: rgb,
      polylines: centered,
      anchorPoint: anchor,
      groupKey: groupKey ?? ORIGIN_GROUP,
      medianRadiusMm: radiusMap[branch.label]?.medianRadiusMm,
    })
  }

  return branches
}

function pickAnchorPoint(polylines: Vec3[][]): Vec3 {
  let candidate: Vec3 = polylines[0]?.[Math.floor(polylines[0].length * 0.66)] ?? [0, 0, 0]
  let bestLength = -1
  for (const poly of polylines) {
    const length = poly.length
    if (length > bestLength) {
      bestLength = length
      candidate = poly[Math.floor(length * 0.66)] ?? poly[length - 1]
    }
  }
  return candidate ?? [0, 0, 0]
}

function buildLegendEntries(branches: PreparedBranch[]) {
  return BRANCH_GROUPS.map((group) => ({
    groupKey: group.key,
    groupLabel: group.label,
    items: branches
      .filter((branch) => branch.groupKey === group.key)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((branch) => ({
        label: branch.label,
        color: branch.color,
      })),
  })).filter((entry) => entry.items.length > 0)
}

function getRenderingContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not acquire 2D context')
  return ctx
}

function resizeCanvasForDpr(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  detectorPixels: [number, number],
) {
  const [width, height] = detectorPixels
  const dpr = window.devicePixelRatio || 1
  const displayWidth = width
  const displayHeight = height
  canvas.style.width = `${displayWidth}px`
  canvas.style.height = `${displayHeight}px`

  const desiredWidth = Math.round(displayWidth * dpr)
  const desiredHeight = Math.round(displayHeight * dpr)

  if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
    canvas.width = desiredWidth
    canvas.height = desiredHeight
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
}
