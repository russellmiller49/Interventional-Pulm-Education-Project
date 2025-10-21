import './style.css'

import { BRANCH_GROUPS } from './grouping'
import { FluoroRenderer } from './render'
import { initUI, populateLegend, updateAngleDisplays } from './ui'
import type { AppState, FluoroConfig, PreparedSegment } from './types'

const GOLDEN_ORDER = BRANCH_GROUPS.map((group) => group.key)
const ORIGIN_GROUP = 'other'
function resolveAsset(base: string | undefined, relative: string): string {
  if (!base || base === '.') {
    return relative
  }
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmed}/${relative}`
}

async function bootstrap() {
  const ui = initUI()
  updateAngleDisplays(ui)

  const config = await fetchJson<FluoroConfig>('fluoro_config.json')
  if (config.units !== 'mm' || config.coordinateSystem !== 'LPS') {
    throw new Error('Configuration mismatch: expected mm + LPS.')
  }

  const renderer = new FluoroRenderer({
    canvas: ui.canvas,
    labelLayer: ui.labelLayer,
    config,
  })

  function updatePointer(event: PointerEvent) {
    const rect = ui.canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return
    }
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    if (renderer.setPointer(x, y)) {
      requestRender()
    }
  }

  function clearPointer() {
    if (renderer.clearPointer()) {
      requestRender()
    }
  }

  ui.canvas.addEventListener('pointermove', updatePointer)
  ui.canvas.addEventListener('pointerdown', updatePointer)
  ui.canvas.addEventListener('pointerleave', clearPointer)
  ui.canvas.addEventListener('pointerup', updatePointer)
  ui.canvas.addEventListener('pointercancel', clearPointer)

  const assetBase = config.asset_base_url
  const glbPath = resolveAsset(assetBase, 'airway_segments.glb')
  const dracoBase = resolveAsset(assetBase, 'draco')
  const segments = await renderer.loadGlb(glbPath, { dracoBaseUrl: dracoBase })
  populateLegend(ui, buildLegendEntries(segments))

  const state: AppState = {
    raoLao: config.default_view.rao_lao_deg,
    cranialCaudal: config.default_view.cranial_caudal_deg,
    useDts: false,
    useWireframe: false,
    showLabels: true,
    activeGroups: new Set([...GOLDEN_ORDER, ORIGIN_GROUP]),
  }

  ui.raoSlider.value = state.raoLao.toString()
  ui.cranSlider.value = state.cranialCaudal.toString()
  ui.dtsToggle.checked = state.useDts
  ui.radiusToggle.checked = state.useWireframe
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
    state.useWireframe = ui.radiusToggle.checked
    requestRender()
  })

  ui.labelsToggle.addEventListener('change', () => {
    state.showLabels = ui.labelsToggle.checked
    requestRender()
  })

  let needsRender = true
  let lastTime = performance.now()
  let smoothFps = 0

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
    smoothFps = smoothFps * 0.85 + instantFps * 0.15

    const stats = renderer.render(state)
    ui.statsEl.textContent = `FPS ${smoothFps.toFixed(1)} · segments ${stats.visibleSegments}`
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

function buildLegendEntries(segments: PreparedSegment[]) {
  const entries = BRANCH_GROUPS.map((group) => ({
    groupKey: group.key,
    groupLabel: group.label,
    items: segments
      .filter((segment) => segment.groupKey === group.key)
      .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel))
      .map((segment) => ({
        label: segment.displayLabel,
        color: segment.color,
      })),
  })).filter((entry) => entry.items.length > 0)

  const otherSegments = segments.filter(
    (segment) =>
      segment.groupKey === ORIGIN_GROUP && !segment.label.includes('Tracheobronchial_tree_full'),
  )
  if (otherSegments.length) {
    entries.push({
      groupKey: ORIGIN_GROUP,
      groupLabel: 'Other',
      items: otherSegments
        .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel))
        .map((segment) => ({
          label: segment.displayLabel,
          color: segment.color,
        })),
    })
  }
  return entries
}
