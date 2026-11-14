import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import * as THREE from 'three'

import { CAMERA_FOV, CAMERA_POSITION, CAMERA_TARGET } from '../components/ecmo-circuit/constants'
import {
  BEDSIDE_LABEL_RAIL_PX,
  BEDSIDE_SIDE_MARGIN_PX,
  BEDSIDE_VIEW_EXTENT,
  BEDSIDE_ZOOM_RANGE,
  bedsideContentPoints,
  bedsideViewWindow,
} from '../components/ecmo-circuit/framing'
import { buildCircuitLayout } from '../components/ecmo-circuit/layout'
import {
  SCENE_LABEL_RAIL_GAP_PX,
  placeSceneLabelsOnRails,
  type SceneLabelBox,
} from '../components/ecmo-circuit/sceneLabelLayout'

/**
 * The bedside scene fills its pane, and its labels are off the model (November 2026).
 *
 * At 1600 × 852 the scene was a 610 px canvas in about 700 px of view, the model took the middle
 * 45 % of it, and eight pills rested on the patient and the pump head. Three things changed: the
 * canvas is as tall as the room it has, the view is fitted to the scene by a lens shift, and the
 * overview's pills sit in rails above and below the model with a leader to each object.
 *
 * jsdom draws nothing, so the arithmetic is held here (the same functions the frame runs) and the
 * rendered scene is measured in a browser (`e2e/ecmo-bedside-scene.spec.ts`).
 */

const css = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css'),
  'utf8',
)

function ruleBody(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  if (start < 0) throw new Error(`${selector} is not declared`)
  return css.slice(start, css.indexOf('\n}', start))
}

/** The authored camera, showing the fitted window, exactly as the scene's frame hook sets it. */
function fittedCamera(width: number, height: number) {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.05, 50)
  camera.position.set(...CAMERA_POSITION)
  camera.lookAt(new THREE.Vector3(...CAMERA_TARGET))
  const view = bedsideViewWindow(width, height)
  camera.setViewOffset(view.fullWidth, view.fullHeight, view.x, view.y, view.width, view.height)
  camera.updateMatrixWorld(true)
  return { camera, view }
}

function projected(camera: THREE.Camera, point: THREE.Vector3, width: number, height: number) {
  const ndc = point.clone().project(camera)
  return { x: ((ndc.x + 1) / 2) * width, y: ((1 - ndc.y) / 2) * height }
}

const PANES = [
  // The circuit view beside its readings at 1600, 1440 and 1280 wide, then the full-width view.
  { width: 692, height: 560 },
  { width: 600, height: 500 },
  { width: 520, height: 400 },
  { width: 1400, height: 560 },
  // A phone.
  { width: 340, height: 360 },
] as const

describe('the fitted view', () => {
  it.each(PANES)('holds the whole scene inside a $width × $height canvas', ({ width, height }) => {
    const { camera, view } = fittedCamera(width, height)
    for (const mode of ['vv', 'va'] as const) {
      for (const point of bedsideContentPoints(mode)) {
        const pixel = projected(camera, point, width, height)
        // A phone is narrower than the scene at any useful size: there the fit stops at its
        // smallest zoom and the scene may run to the canvas edge, never past the rails.
        const side = view.zoom === BEDSIDE_ZOOM_RANGE.min ? -1 : BEDSIDE_SIDE_MARGIN_PX - 1
        expect(pixel.x).toBeGreaterThanOrEqual(side)
        expect(pixel.x).toBeLessThanOrEqual(width - side)
        expect(pixel.y).toBeGreaterThanOrEqual(BEDSIDE_LABEL_RAIL_PX - 1)
        expect(pixel.y).toBeLessThanOrEqual(height - BEDSIDE_LABEL_RAIL_PX + 1)
      }
    }
  })

  it.each(PANES.slice(0, 4))(
    'fills a $width × $height canvas to a margin or a rail',
    ({ width, height }) => {
      const { camera } = fittedCamera(width, height)
      const pixels = (['vv', 'va'] as const).flatMap((mode) =>
        bedsideContentPoints(mode).map((point) => projected(camera, point, width, height)),
      )
      const spanX = Math.max(...pixels.map((p) => p.x)) - Math.min(...pixels.map((p) => p.x))
      const spanY = Math.max(...pixels.map((p) => p.y)) - Math.min(...pixels.map((p) => p.y))
      const fillX = spanX / (width - 2 * BEDSIDE_SIDE_MARGIN_PX)
      const fillY = spanY / (height - 2 * BEDSIDE_LABEL_RAIL_PX)
      // One of the two directions is used up; neither overflows.
      expect(Math.max(fillX, fillY)).toBeGreaterThan(0.98)
      expect(Math.max(fillX, fillY)).toBeLessThanOrEqual(1.001)
      // And the scene is centred in the direction it does not fill.
      const midX = (Math.max(...pixels.map((p) => p.x)) + Math.min(...pixels.map((p) => p.x))) / 2
      const midY = (Math.max(...pixels.map((p) => p.y)) + Math.min(...pixels.map((p) => p.y))) / 2
      expect(Math.abs(midX - width / 2)).toBeLessThan(2)
      expect(Math.abs(midY - height / 2)).toBeLessThan(2)
    },
  )

  it('enlarges the authored view, which left the scene low and to one side', () => {
    // Authored: more of the content below and right of the view axis than above and left of it.
    expect(BEDSIDE_VIEW_EXTENT.down).toBeGreaterThan(BEDSIDE_VIEW_EXTENT.up * 2)
    expect(BEDSIDE_VIEW_EXTENT.right).toBeGreaterThan(BEDSIDE_VIEW_EXTENT.left)
    expect(bedsideViewWindow(692, 560).zoom).toBeGreaterThan(1.2)
  })

  it('leaves the camera rig alone: the same position, target and lens', () => {
    const { camera } = fittedCamera(692, 560)
    expect(camera.position.toArray()).toEqual([...CAMERA_POSITION])
    expect(camera.fov).toBe(CAMERA_FOV)
    // A degenerate canvas (not laid out yet) asks for the authored view, not a division by zero.
    expect(bedsideViewWindow(0, 0)).toMatchObject({ zoom: 1, x: 0, y: 0 })
  })

  it('every label names a point on its object, inside the fitted scene', () => {
    for (const mode of ['vv', 'va'] as const) {
      const layout = buildCircuitLayout(mode)
      expect(layout.labels.map((label) => label.id)).toEqual(
        mode === 'va'
          ? [
              'drainage-site',
              'return-site',
              'dpc',
              'drainage-clamp',
              'return-clamp',
              'hls-module',
              'sensor',
              'sweep',
              'console',
            ]
          : [
              'drainage-site',
              'return-site',
              'drainage-clamp',
              'return-clamp',
              'hls-module',
              'sensor',
              'sweep',
              'console',
            ],
      )
      const byId = new Map(layout.labels.map((label) => [label.id, label.target]))
      expect(byId.get('drainage-site')!.distanceTo(layout.drainageInsertion)).toBe(0)
      expect(byId.get('return-site')!.distanceTo(layout.returnInsertion)).toBe(0)
      expect(byId.get('sensor')!.distanceTo(layout.sensorPosition)).toBe(0)
      expect(
        byId
          .get('drainage-clamp')!
          .distanceTo(layout.drainageLine.getPointAt(layout.drainageClampU)),
      ).toBeLessThan(1e-9)
      expect(
        byId.get('return-clamp')!.distanceTo(layout.returnLine.getPointAt(layout.returnClampU)),
      ).toBeLessThan(1e-9)
      expect(layout.consoleBounds.containsPoint(byId.get('console')!)).toBe(true)
      expect(byId.get('hls-module')!.distanceTo(layout.hlsModulePosition)).toBeLessThan(0.2)
    }
  })
})

describe('the label rails', () => {
  const bounds = { width: 692, height: 560 }
  const pill = (id: string, x: number, y: number, width = 150, height = 38): SceneLabelBox => ({
    id,
    x,
    y,
    width,
    height,
  })
  const rectOf = (box: SceneLabelBox, placements: ReturnType<typeof placeSceneLabelsOnRails>) => {
    const placement = placements.get(box.id)!
    const left = box.x + placement.offsetX - box.width / 2
    const top = box.y + placement.offsetY - box.height / 2
    return { left, right: left + box.width, top, bottom: top + box.height }
  }

  // Eight objects clustered in the middle of the view, as the bedside scene's are.
  const cluster = [
    pill('drainage-site', 250, 300),
    pill('return-site', 290, 285),
    pill('drainage-clamp', 320, 330),
    pill('return-clamp', 340, 250),
    pill('hls-module', 430, 290),
    pill('sensor', 390, 320),
    pill('sweep', 560, 240),
    pill('console', 500, 330),
  ]

  it('puts every pill in the top or bottom rail, none on the model', () => {
    const placements = placeSceneLabelsOnRails(cluster, { bounds })
    for (const box of cluster) {
      const placement = placements.get(box.id)!
      expect(placement.visible).toBe(true)
      const rect = rectOf(box, placements)
      const onTop = Math.abs(rect.top - SCENE_LABEL_RAIL_GAP_PX) < 0.5
      const onBottom = Math.abs(rect.bottom - (bounds.height - SCENE_LABEL_RAIL_GAP_PX)) < 0.5
      expect(onTop || onBottom).toBe(true)
      // Inside the band the fitted view keeps clear of the scene.
      expect(
        rect.bottom <= BEDSIDE_LABEL_RAIL_PX || rect.top >= bounds.height - BEDSIDE_LABEL_RAIL_PX,
      ).toBe(true)
      expect(rect.left).toBeGreaterThanOrEqual(SCENE_LABEL_RAIL_GAP_PX)
      expect(rect.right).toBeLessThanOrEqual(bounds.width - SCENE_LABEL_RAIL_GAP_PX)
    }
  })

  it('keeps the pills of a rail apart and in the left-to-right order of their objects', () => {
    const placements = placeSceneLabelsOnRails(cluster, { bounds })
    for (const side of ['above', 'below'] as const) {
      const rail = cluster
        .filter((box) => placements.get(box.id)!.side === side)
        .sort((a, b) => a.x - b.x)
      expect(rail.length).toBeGreaterThan(0)
      for (let index = 1; index < rail.length; index += 1) {
        const previous = rectOf(rail[index - 1], placements)
        const current = rectOf(rail[index], placements)
        expect(current.left - previous.right).toBeGreaterThanOrEqual(SCENE_LABEL_RAIL_GAP_PX - 0.5)
      }
    }
  })

  it('runs each leader from the pill edge to the object itself', () => {
    const placements = placeSceneLabelsOnRails(cluster, { bounds })
    for (const box of cluster) {
      const placement = placements.get(box.id)!
      const rect = rectOf(box, placements)
      // The vertical run of the leader is the distance from the object to the pill's near edge.
      expect(placement.leader).toBeCloseTo(
        placement.side === 'above' ? box.y - rect.bottom : rect.top - box.y,
        6,
      )
      expect(placement.leader).toBeGreaterThanOrEqual(10)
    }
  })

  it('shares the pills between the rails when one side is crowded', () => {
    // Every object in the upper half: the top rail cannot hold eight 150 px pills in 692 px.
    const upper = cluster.map((box) => ({ ...box, y: 180 + (box.x % 40) }))
    const placements = placeSceneLabelsOnRails(upper, { bounds })
    const sides = upper.map((box) => placements.get(box.id)!)
    expect(sides.every((placement) => placement.visible)).toBe(true)
    expect(sides.filter((placement) => placement.side === 'above')).toHaveLength(4)
    expect(sides.filter((placement) => placement.side === 'below')).toHaveLength(4)
  })

  it('starts a second row inside a full rail, so nine names fit a 690 px pane', () => {
    // Nine 150 px pills: four to a row, so the ninth takes a second row on its own rail.
    const nine = [...cluster, pill('dpc', 300, 310)]
    const placements = placeSceneLabelsOnRails(nine, { bounds })
    expect(nine.every((box) => placements.get(box.id)!.visible)).toBe(true)
    const second = nine.filter((box) => placements.get(box.id)!.row === 1)
    expect(second).toHaveLength(1)
    const rect = rectOf(second[0], placements)
    // Inside the first row, clear of it, and still off the middle of the scene.
    const firstRowEdge = SCENE_LABEL_RAIL_GAP_PX + 38 + SCENE_LABEL_RAIL_GAP_PX
    expect(
      Math.abs(rect.top - firstRowEdge) < 0.5 ||
        Math.abs(bounds.height - rect.bottom - firstRowEdge) < 0.5,
    ).toBe(true)
  })

  it('leaves out what four full rows cannot hold, never the pill a step is pointing at', () => {
    const many = Array.from({ length: 20 }, (_, index) => pill(`p${index}`, 120 + index * 22, 280))
    const placements = placeSceneLabelsOnRails(many, { bounds, priorityIds: ['p19'] })
    const shown = many.filter((box) => placements.get(box.id)!.visible)
    expect(shown.length).toBeLessThan(many.length)
    expect(shown.length).toBe(16)
    expect(placements.get('p19')!.visible).toBe(true)
    expect(placements.get('p19')!.row).toBe(0)
    // Nothing shown overlaps anything else shown.
    for (const [index, box] of shown.entries()) {
      const a = rectOf(box, placements)
      for (const other of shown.slice(index + 1)) {
        const b = rectOf(other, placements)
        const apart =
          a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
        expect(apart).toBe(true)
      }
    }
  })

  it('does not label an object that is off the canvas or under an overlay', () => {
    const placements = placeSceneLabelsOnRails(
      [pill('off', -40, 300), pill('covered', 120, 300), pill('clear', 500, 300)],
      { bounds, obstacles: [{ left: 0, right: 300, top: 0, bottom: 60 }] },
    )
    expect(placements.get('off')!.visible).toBe(false)
    expect(placements.get('clear')!.visible).toBe(true)
    // `covered` goes to the top rail (its object is in the upper half), where the overlay is.
    const covered = placeSceneLabelsOnRails([pill('covered', 120, 200)], {
      bounds,
      obstacles: [{ left: 0, right: 300, top: 0, bottom: 60 }],
    })
    expect(covered.get('covered')!.visible).toBe(false)
    expect(placements.get('covered')).toBeDefined()
  })
})

describe('the scene takes the room it has', () => {
  it('is sized from the window less whatever is pinned, not from the window width', () => {
    const viewport = ruleBody('.circuit3dViewport')
    expect(viewport).not.toContain('46vw')
    expect(viewport).toMatch(/height:\s*clamp\(\s*20rem,/)
    for (const token of [
      '100dvh',
      'var(--site-header-height, 0px)',
      'var(--ecmo-lesson-bar-height, 0px)',
      'var(--ecmo-sticky-strip-height, 0px)',
      'var(--ecmo-pinned-footer-height, 0px)',
    ]) {
      expect(viewport).toContain(token)
    }
    expect(viewport).toMatch(/610px\s*\);/)
  })

  it('sets the status row and the label switch on one line under the scene', () => {
    expect(ruleBody('.circuit3dShell')).toContain('grid-template-columns: minmax(0, 1fr) auto')
    expect(ruleBody('.circuit3dShell > .circuit3dHud')).toContain('grid-column: 1')
    expect(ruleBody('.circuit3dShell > .circuit3dLabelsToggle')).toContain('grid-column: 2')
    expect(ruleBody('.circuit3dHud')).toContain('display: flex')
  })

  it('marks the end of each leader with a dot on the object', () => {
    const anchor = ruleBody('.circuit3dSceneAnchor')
    expect(anchor).toContain('position: absolute')
    expect(anchor).toContain('top: 50%')
    expect(anchor).toContain('left: 50%')
  })
})
