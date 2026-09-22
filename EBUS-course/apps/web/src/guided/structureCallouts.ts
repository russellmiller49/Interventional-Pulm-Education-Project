import * as THREE from 'three'
import { assignColumns, projectPoint, spreadColumn, type CalloutSide } from './observerCamera'

/**
 * Screen-space markers for modelled structures (EBUS-PRE-REVIEW-03, L3-3 / L11-3 / L13-3).
 *
 * Each marker is a button anchored to a real surface vertex of its mesh — the vertex nearest the
 * mesh's bounding-box centre, or, for a long vessel, nearest the focus level — so the leader ends
 * on the structure itself. What changed from the first version: a marker keeps its column instead
 * of swapping sides whenever the camera or the scope moved; hovering or focusing a marker reports
 * its structure so the mesh can be highlighted (and vice versa); labels can carry names when the
 * view is a reference rather than an identification task; and the layout is a pure function
 * with tests. Letter identity is the caller's index order and never changes within a task.
 */
/**
 * The real surface point a marker attaches to: the mesh vertex nearest its bounding-box centre,
 * or, for a vessel more than twice as tall as it is wide, nearest the focus level, so a long
 * vein is labelled where it passes the region of interest. Returned in the mesh's local frame.
 */
export function surfaceAnchorLocal(mesh: THREE.Mesh, focus: THREE.Vector3): THREE.Vector3 {
  const scratch = new THREE.Vector3()
  const bounds = new THREE.Box3().setFromObject(mesh)
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  if (size.y > 2 * Math.max(size.x, size.z)) center.y = bounds.clampPoint(focus, scratch).y
  mesh.worldToLocal(center)
  const position = mesh.geometry.getAttribute('position')
  const anchor = new THREE.Vector3()
  let distance = Infinity
  for (let i = 0; i < position.count; i++) {
    scratch.fromBufferAttribute(position, i)
    const next = scratch.distanceToSquared(center)
    if (next < distance) {
      distance = next
      anchor.copy(scratch)
    }
  }
  return anchor
}
/** The same anchor in world coordinates. */
export function surfaceAnchor(mesh: THREE.Mesh, focus: THREE.Vector3): THREE.Vector3 {
  return mesh.localToWorld(surfaceAnchorLocal(mesh, focus))
}
export interface StructureCalloutHandle {
  render(
    camera: THREE.Camera,
    enabled: boolean,
    selected: string,
    hovered: string | null,
    names: Record<string, string> | null,
  ): void
  /** Screen geometry of the last render, for tests and evidence. */
  geometry(): { id: string; letter: string; x: number; y: number; ax: number; ay: number; side: CalloutSide; visible: boolean }[]
  dispose(): void
}
export function createStructureCallouts(
  host: HTMLElement,
  meshes: THREE.Mesh[],
  focus: THREE.Vector3,
  choose: (id: string, point: THREE.Vector3) => void,
  onHover: (id: string | null) => void = () => undefined,
  letterFor: (index: number) => string = (index) => String.fromCharCode(65 + index),
  /** Drop markers for meshes that are not currently visible instead of parking them at the edge. */
  hideInvisible = false,
): StructureCalloutHandle {
  const overlay = document.createElement('div')
  overlay.className = 'linked-structure-callouts'
  overlay.hidden = true
  overlay.setAttribute('role', 'group')
  overlay.setAttribute('aria-label', 'Markers on the 3D model')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('aria-hidden', 'true')
  overlay.appendChild(svg)
  host.appendChild(overlay)
  const world = new THREE.Vector3()
  const sides = new Map<string, CalloutSide>()
  const isShown = (object: THREE.Object3D) => {
    for (let node: THREE.Object3D | null = object; node; node = node.parent)
      if (!node.visible) return false
    return true
  }
  let last: ReturnType<StructureCalloutHandle['geometry']> = []
  const markers = meshes.map((mesh, index) => {
    const letter = letterFor(index)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'linked-structure-letter'
    button.dataset.structure = mesh.name
    const glyph = document.createElement('span')
    glyph.className = 'linked-structure-glyph'
    glyph.textContent = letter
    const name = document.createElement('span')
    name.className = 'linked-structure-name'
    name.hidden = true
    button.append(glyph, name)
    button.setAttribute('aria-label', 'Structure ' + letter)
    const line = document.createElementNS(svg.namespaceURI, 'path')
    const dot = document.createElementNS(svg.namespaceURI, 'circle')
    dot.setAttribute('r', '3.5')
    svg.append(line, dot)
    overlay.appendChild(button)
    const anchor = surfaceAnchorLocal(mesh, focus)
    button.addEventListener('click', () => choose(mesh.name, mesh.localToWorld(anchor.clone())))
    button.addEventListener('pointerenter', () => onHover(mesh.name))
    button.addEventListener('pointerleave', () => onHover(null))
    button.addEventListener('focus', () => onHover(mesh.name))
    button.addEventListener('blur', () => onHover(null))
    return { mesh, letter, button, glyph, name, line, dot, anchor }
  })
  return {
    render(camera, enabled, selected, hovered, names) {
      overlay.hidden = !enabled
      if (!enabled) {
        last = []
        return
      }
      const width = host.clientWidth,
        height = host.clientHeight
      if (!width || !height) return
      const projected = markers
        .map((marker) => {
          const point = projectPoint(
            marker.mesh.localToWorld(world.copy(marker.anchor)),
            camera,
            width,
            height,
          )
          const shown = isShown(marker.mesh)
          marker.button.hidden = hideInvisible && !shown
          return {
            ...marker,
            ax: point.x,
            ay: point.y,
            visible: shown && point.inView,
            skip: hideInvisible && !shown,
          }
        })
        .filter((marker) => !marker.skip)
      const columns = assignColumns(
        projected.map((m) => ({ id: m.mesh.name, x: m.ax })),
        width,
        sides,
      )
      columns.forEach((side, id) => sides.set(id, side))
      const named = !!names
      const glyphSize = 34
      const gap = named ? 30 : 40
      const margin = named ? 18 : 26
      last = []
      for (const side of ['left', 'right'] as const) {
        const column = projected.filter((m) => columns.get(m.mesh.name) === side)
        const ys = spreadColumn(
          column.map((m) => ({ id: m.mesh.name, y: m.ay })),
          height,
          gap,
          margin,
        )
        for (const marker of column) {
          const y = ys.get(marker.mesh.name)!
          const active = marker.mesh.name === selected
          const hot = marker.mesh.name === hovered
          marker.name.hidden = !named
          marker.name.textContent = named ? (names![marker.mesh.name] ?? '') : ''
          marker.button.classList.toggle('is-named', named)
          marker.button.classList.toggle('is-hovered', hot)
          marker.button.classList.toggle('is-visible', marker.visible)
          marker.button.setAttribute(
            'aria-label',
            'Structure ' + marker.letter + (named && names![marker.mesh.name] ? ': ' + names![marker.mesh.name] : ''),
          )
          // Named pills hang from the canvas edge; letters sit centred on their column line.
          const buttonWidth = named ? marker.button.offsetWidth || glyphSize : glyphSize
          const x = side === 'left' ? 8 + buttonWidth / 2 : width - 8 - buttonWidth / 2
          marker.button.style.left = `${x}px`
          marker.button.style.top = `${y}px`
          marker.button.setAttribute('aria-pressed', String(active))
          marker.button.title = marker.visible
            ? 'Select structure ' + marker.letter
            : !marker.mesh.visible
              ? 'Select this structure to show it in isolation.'
              : 'Structure outside this view. Reset view to see its marker.'
          const edge = side === 'left' ? x + buttonWidth / 2 - 2 : x - buttonWidth / 2 + 2
          marker.line.setAttribute('d', `M ${edge} ${y} L ${marker.ax} ${marker.ay}`)
          marker.dot.setAttribute('cx', String(marker.ax))
          marker.dot.setAttribute('cy', String(marker.ay))
          for (const item of [marker.line, marker.dot]) {
            item.setAttribute('visibility', marker.visible ? 'visible' : 'hidden')
            item.classList.toggle('is-selected', active)
            item.classList.toggle('is-hovered', hot)
          }
          last.push({ id: marker.mesh.name, letter: marker.letter, x, y, ax: marker.ax, ay: marker.ay, side, visible: marker.visible })
        }
      }
      overlay.dataset.calloutGeometry = JSON.stringify(
        last.map((g) => ({ id: g.id, letter: g.letter, x: Math.round(g.x), y: Math.round(g.y), ax: Math.round(g.ax * 10) / 10, ay: Math.round(g.ay * 10) / 10, side: g.side, visible: g.visible })),
      )
    },
    geometry() {
      return last
    },
    dispose() {
      overlay.remove()
    },
  }
}
