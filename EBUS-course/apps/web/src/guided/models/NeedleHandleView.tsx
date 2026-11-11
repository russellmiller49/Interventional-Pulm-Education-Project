import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { applyStageLighting } from '../stageLook'
import { MODEL_GEOMETRY, type NeedleState } from '../../../../../../src/lib/ebus-model-contract'
import { loadModel } from './ModelViewport'

/*
 * The needle handle, drawn on its own strip above the scope tip and the ultrasound picture
 * (rebuild of 2026-11-11). The handle is at true scale and the scope between it and the tip is
 * left out, so one camera cannot show both ends; here the hand end is always in view and its
 * parts move as the learner works the controls named after them.
 *
 * A fixed orthographic view of the same model file: no orbit, no evidence, nothing recorded.
 */
export type NeedleHandlePart =
  | 'sheath_adjuster'
  | 'sheath_lock'
  | 'extension_stop'
  | 'needle_handle'
  | 'stylet'
/*
 * Names sit above or below the handle so neighbours do not collide as the parts slide: the stop
 * and the slider come within a few millimetres of each other at full travel.
 */
const PARTS: { id: NeedleHandlePart; label: string; below?: boolean; lean?: 'left' }[] = [
  { id: 'sheath_adjuster', label: 'Sheath adjuster' },
  { id: 'sheath_lock', label: 'Sheath lock', below: true, lean: 'left' },
  { id: 'extension_stop', label: 'Needle stop', below: true },
  { id: 'needle_handle', label: 'Needle slider' },
  { id: 'stylet', label: 'Stylet', below: true },
]
/** Everything that is not the handle or the port it mounts on is left out of this strip. */
const KEEP = new Set(['handle_assembly', 'scope_port'])
interface Label {
  id: NeedleHandlePart
  label: string
  x: number
  y: number
  below: boolean
  lean: boolean
}
export function NeedleHandleView({
  state,
  focus,
}: {
  state: NeedleState
  focus: NeedleHandlePart | ''
}) {
  const host = useRef<HTMLDivElement>(null)
  const live = useRef({ state, focus })
  live.current = { state, focus }
  const update = useRef<(() => void) | null>(null)
  const [labels, setLabels] = useState<Label[]>([])
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const el = host.current
    if (!el) return
    let disposed = false
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.setAttribute('aria-hidden', 'true')
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene(),
      root = new THREE.Group()
    root.scale.setScalar(1000)
    scene.add(root)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000)
    // The same way up as the scope-tip view: distal to the left, the wall side downward.
    camera.up.set(0, -1, 0)
    const disposeLighting = applyStageLighting(renderer, scene, camera)
    const bounds = new THREE.Box3()
    let loaded = false
    const frame = () => {
      const w = el.clientWidth,
        h = el.clientHeight
      if (!w || !h || !loaded) return
      renderer.setSize(w, h)
      const centre = bounds.getCenter(new THREE.Vector3())
      // Seen a little from above and from its distal end, so the knob, scale and slider separate.
      camera.position.copy(centre).add(new THREE.Vector3(0.1, -0.3, 1).normalize().multiplyScalar(600))
      camera.lookAt(centre)
      camera.updateMatrixWorld(true)
      const view = camera.matrixWorldInverse
      const seen = new THREE.Box3()
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            seen.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(view))
      const wide = seen.max.x - seen.min.x,
        tall = seen.max.y - seen.min.y
      // Room above and below the handle for the names of its parts.
      const width = Math.max(wide * 1.04, tall * 1.55 * (w / h))
      const height = width / (w / h)
      const cx = (seen.max.x + seen.min.x) / 2,
        cy = (seen.max.y + seen.min.y) / 2
      camera.left = cx - width / 2
      camera.right = cx + width / 2
      camera.top = cy + height / 2
      camera.bottom = cy - height / 2
      camera.updateProjectionMatrix()
    }
    const set = (name: string, mm: number) => {
      const o = root.getObjectByName(name)
      if (o) o.position.x = mm / 1000
    }
    const draw = () => {
      if (disposed || !loaded) return
      const { state: s, focus: chosen } = live.current
      set('handle_body_motion', s.sheath)
      set('handle_motion', s.extension)
      set(
        'extension_stop',
        (s.stop > 0 ? s.stop : MODEL_GEOMETRY.needle.maxTravel) - MODEL_GEOMETRY.needle.maxTravel,
      )
      const lock = root.getObjectByName('sheath_lock')
      if (lock) lock.rotation.z = s.secured ? Math.PI / 2 : 0
      // The part whose control has the focus is lit, so the control and the part read as one.
      for (const part of PARTS)
        root.getObjectByName(part.id)?.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m instanceof THREE.MeshStandardMaterial) {
              m.emissive.set(part.id === chosen ? 0x2bb8a8 : 0x000000)
              m.emissiveIntensity = part.id === chosen ? 0.55 : 0
            }
        })
      scene.updateMatrixWorld(true)
      renderer.render(scene, camera)
      const w = el.clientWidth,
        h = el.clientHeight
      setLabels(
        PARTS.flatMap((part) => {
          const o = root.getObjectByName(part.id)
          if (!o) return []
          const box = new THREE.Box3().setFromObject(o)
          const p = box.getCenter(new THREE.Vector3()).project(camera)
          return [
            {
              id: part.id,
              label: part.label,
              x: Math.round(((p.x + 1) / 2) * w),
              y: Math.round(((1 - p.y) / 2) * h),
              below: !!part.below,
              lean: part.lean === 'left',
            },
          ]
        }),
      )
    }
    update.current = draw
    const resize = () => {
      frame()
      draw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    loadModel('needle')
      .then((groups) => {
        if (disposed) return
        for (const group of groups) {
          group.traverse((o) => {
            if (o instanceof THREE.Mesh)
              o.material = Array.isArray(o.material)
                ? o.material.map((m) => m.clone())
                : o.material.clone()
          })
          for (const child of group.children) child.visible = KEEP.has(child.name)
          root.add(group)
        }
        scene.updateMatrixWorld(true)
        const handle = root.getObjectByName('handle_assembly')
        if (handle) bounds.setFromObject(handle)
        const port = root.getObjectByName('scope_port')
        if (port) bounds.expandByObject(port)
        loaded = !bounds.isEmpty()
        resize()
      })
      // The scope-tip view reports a model that cannot load; this strip then stays empty.
      .catch(() => !disposed && setFailed(true))
    return () => {
      disposed = true
      update.current = null
      observer.disconnect()
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose())
        }
      })
      disposeLighting()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])
  useEffect(() => {
    update.current?.()
  }, [state, focus])
  return (
    <section className="needle-handle" aria-label="Needle handle">
      <h2>Needle handle</h2>
      <div className="needle-handle-view" ref={host} data-needle-handle={failed ? 'failed' : 'ready'}>
        {labels.map((part) => (
          <span
            key={part.id}
            className="needle-handle-name"
            data-part={part.id}
            data-below={part.below || undefined}
            data-lean={part.lean || undefined}
            data-focus={focus === part.id || undefined}
            style={{ left: part.x }}
          >
            {part.label}
          </span>
        ))}
      </div>
    </section>
  )
}
