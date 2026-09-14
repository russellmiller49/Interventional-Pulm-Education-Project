import * as THREE from 'three'

/** Letter references only: anatomical names never enter these elements. */
export function createStructureCallouts(
  host: HTMLElement,
  meshes: THREE.Mesh[],
  focus: THREE.Vector3,
  choose: (id: string, point: THREE.Vector3) => void,
) {
  const overlay = document.createElement('div')
  overlay.className = 'linked-structure-callouts'
  overlay.hidden = true
  overlay.setAttribute('role', 'group')
  overlay.setAttribute('aria-label', 'Letter markers on the 3D model')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('aria-hidden', 'true')
  overlay.appendChild(svg)
  host.appendChild(overlay)
  const world = new THREE.Vector3()
  const vertex = new THREE.Vector3()
  const markers = meshes.map((mesh, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'linked-structure-letter'
    button.textContent = String.fromCharCode(65 + index)
    button.setAttribute('aria-label', 'Structure ' + button.textContent)
    const line = document.createElementNS(svg.namespaceURI, 'path')
    const dot = document.createElementNS(svg.namespaceURI, 'circle')
    dot.setAttribute('r', '3')
    svg.append(line, dot)
    overlay.appendChild(button)
    // Attach to an actual surface vertex, not empty space at a bounding-box center.
    const bounds = new THREE.Box3().setFromObject(mesh)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    // Long vessels extend below this teaching window. Label their nearby portion.
    if (size.y > 2 * Math.max(size.x, size.z)) center.y = bounds.clampPoint(focus, world).y
    mesh.worldToLocal(center)
    const position = mesh.geometry.getAttribute('position')
    const anchor = new THREE.Vector3()
    let distance = Infinity
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i)
      const next = vertex.distanceToSquared(center)
      if (next < distance) {
        distance = next
        anchor.copy(vertex)
      }
    }
    button.addEventListener('click', () => choose(mesh.name, mesh.localToWorld(anchor.clone())))
    return { mesh, button, line, dot, anchor }
  })
  return {
    render(camera: THREE.Camera, enabled: boolean, selected: string) {
      overlay.hidden = !enabled
      if (!enabled) return
      const width = host.clientWidth,
        height = host.clientHeight
      const projected = markers.map((marker) => {
        const point = marker.mesh.localToWorld(world.copy(marker.anchor)).project(camera)
        return {
          ...marker,
          x: ((point.x + 1) * width) / 2,
          y: ((1 - point.y) * height) / 2,
          visible:
            marker.mesh.visible &&
            Math.abs(point.x) < 1 &&
            Math.abs(point.y) < 1 &&
            Math.abs(point.z) < 1,
        }
      })
      // Balance the two columns, then spread labels vertically without overlap.
      // Letter identity stays fixed when the observer camera moves.
      projected.sort((a, b) => a.x - b.x)
      const split = Math.ceil(projected.length / 2)
      for (const [side, column] of [projected.slice(0, split), projected.slice(split)].entries()) {
        column.sort((a, b) => a.y - b.y)
        const left = side === 0
        const x = left ? 26 : width - 26
        const gap = Math.min(42, (height - 52) / Math.max(1, column.length - 1))
        let previous = -Infinity
        column.forEach((marker, i) => {
          const active = marker.mesh.name === selected
          const y = Math.min(
            height - 26 - gap * (column.length - 1 - i),
            Math.max(26, previous + gap, marker.y),
          )
          previous = y
          marker.button.style.left = `${x}px`
          marker.button.style.top = `${y}px`
          marker.button.setAttribute('aria-pressed', String(active))
          marker.button.title = marker.visible
            ? 'Select structure ' + marker.button.textContent
            : !marker.mesh.visible
              ? 'Select this structure to show it in isolation.'
              : 'Structure outside this view. Reset view to see its marker.'
          marker.line.setAttribute('d', `M ${x + (left ? 16 : -16)} ${y} L ${marker.x} ${marker.y}`)
          marker.dot.setAttribute('cx', String(marker.x))
          marker.dot.setAttribute('cy', String(marker.y))
          for (const item of [marker.line, marker.dot]) {
            item.setAttribute('visibility', marker.visible ? 'visible' : 'hidden')
            item.classList.toggle('is-selected', active)
          }
        })
      }
    },
    dispose() {
      overlay.remove()
    },
  }
}
