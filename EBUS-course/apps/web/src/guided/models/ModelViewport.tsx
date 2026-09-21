import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { simulatorCaseAssetUrl } from '../../features/simulator/paths'
import {
  MODEL_GEOMETRY,
  modelFrameId,
  needleGeometry,
  routeDefinition,
  routeSupported,
  type ModelState,
  type ModelPackage,
} from '../../../../../../src/lib/ebus-model-contract'

const FILES: Record<ModelPackage, string> = {
  needle: 'ebus-needle-assembly.glb',
  contact: 'acoustic-contact-cutaway.glb',
  measurement: 'measurement-phantoms.glb',
  routes: 'eus-b-route-locators.glb',
}
const hash = async (b: ArrayBuffer) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
async function bytes(path: string) {
  const r = await fetch(simulatorCaseAssetUrl(path)).catch(() => {
    throw new Error('A teaching model could not be loaded. Retry the workbench.')
  })
  if (!r.ok) throw new Error('A teaching model could not be loaded. Retry the workbench.')
  return r.arrayBuffer()
}
interface AssetRecord {
  path: string
  sha256: string
  bytes?: number
}
async function load(pkg: ModelPackage) {
  const root = 'models/guided-v2/'
  const manifest = JSON.parse(
    new TextDecoder().decode(await bytes(root + 'asset-manifest.json')),
  ) as { assets: AssetRecord[]; contractSha256: string; dependencies: AssetRecord[] }
  const contractBytes = await bytes(root + 'model-contract.json')
  if (
    (await hash(contractBytes)) !== manifest.contractSha256 ||
    JSON.stringify(JSON.parse(new TextDecoder().decode(contractBytes))) !==
      JSON.stringify(MODEL_GEOMETRY)
  )
    throw new Error('The model geometry and activity definitions have different revisions.')
  const loader = new GLTFLoader()
  const records = [
    ...manifest.assets
      .filter((a) => a.path === FILES[pkg])
      .map((a) => ({ ...a, path: root + a.path })),
    ...(pkg === 'routes' ? manifest.dependencies : []),
  ]
  if (records.length !== (pkg === 'routes' ? 3 : 1))
    throw new Error('A model package is missing from its manifest.')
  return Promise.all(
    records.map(async (r) => {
      const data = await bytes(r.path)
      if ((r.bytes && data.byteLength !== r.bytes) || (await hash(data)) !== r.sha256)
        throw new Error('A teaching model failed its integrity check.')
      return (await loader.parseAsync(data, '')).scene
    }),
  )
}
function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose()
      ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose())
    }
  })
}
export function ModelViewport({
  state,
  reveal,
  onRendered,
  onError,
}: {
  state: ModelState
  reveal: boolean
  onRendered: (frameId: string) => void
  onError: (message: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const live = useRef({ state, reveal, onRendered, onError })
  live.current = { state, reveal, onRendered, onError }
  const update = useRef<(() => void) | null>(null)
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState('')
  const [structures, setStructures] = useState<{ id: string; label: string }[]>([])
  const resetCamera = useRef<(() => void) | null>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    let disposed = false
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor('#101e2c')
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D teaching model; drag to orbit the observer camera',
    )
    renderer.domElement.tabIndex = 0
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene(),
      root = new THREE.Group(),
      dynamic = new THREE.Group()
    root.scale.setScalar(1000)
    scene.add(root, dynamic)
    scene.add(new THREE.HemisphereLight(0xdcefff, 0x344154, 2.3))
    const light = new THREE.DirectionalLight(0xffffff, 2.6)
    light.position.set(60, 80, 120)
    scene.add(light)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000)
    if (state.package !== 'routes') camera.up.set(0, -1, 0)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = false
    controls.enablePan = true
    let groups: THREE.Group[] = []
    let lastRoute = ''
    const draw = () => {
      if (!disposed) renderer.render(scene, camera)
    }
    controls.addEventListener('change', draw)
    controls.addEventListener('start', () => setTooltip(null))
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      draw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    const clearDynamic = () => {
      for (const child of [...dynamic.children]) {
        child.traverse((o) => {
          if (o instanceof THREE.Line) {
            o.geometry.dispose()
            ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose())
          }
        })
        dispose(child)
        dynamic.remove(child)
      }
    }
    const setVisible = (name: string, visible: boolean) => {
      const o = root.getObjectByName(name)
      if (o) o.visible = visible
    }
    const setPosition = (name: string, p: number[]) =>
      root.getObjectByName(name)?.position.set(p[0] / 1000, p[1] / 1000, p[2] / 1000)
    const updateScene = () => {
      if (!groups.length || disposed) return
      const { state: s, reveal: r } = live.current
      clearDynamic()
      if (s.package === 'needle') {
        const d = MODEL_GEOMETRY.needle.axis
        setPosition(
          'sheath_motion',
          d.map((n) => n * s.sheath),
        )
        setPosition(
          'needle_motion',
          d.map((n) => n * (s.extension + s.sheath)),
        )
        setPosition('handle_motion', [s.extension, 0, 0])
        const shaft = root.getObjectByName('needle_shaft')
        if (shaft) {
          const base = shaft.userData.fixedBaseWebMm as number[]
          const tip = needleGeometry(s).tip
          const motion = d.map((v) => v * (s.extension + s.sheath))
          // A fixed channel entry and the state's true tip determine the displayed shaft length.
          shaft.position.set(
            ...(base.map((v, i) => ((v + tip[i]) / 2 - motion[i]) / 1000) as [
              number,
              number,
              number,
            ]),
          )
          shaft.scale.y = Math.hypot(...base.map((v, i) => tip[i] - v)) / shaft.userData.spanMm
        }
        setVisible('protected_needle_in_channel', !s.removed)
        setVisible('needle_motion', r || s.extension === 0)
        setVisible('needle_tip', r)
        for (const name of [
          'mount_connector',
          'sheath_adjuster',
          'sheath_lock',
          'extension_stop',
          'handle_motion',
          'suction_connection',
          'sheath_motion',
        ])
          setVisible(name, !s.removed)
        setVisible('needle_motion', !s.removed && (r || s.extension === 0))
        const material = new THREE.MeshBasicMaterial({
          color: 0x31bfae,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(50, 42), material)
        plane.position.set(-6 + s.sheath * 0.5, 20, 0)
        plane.rotation.y = (-s.plane * Math.PI) / 180
        dynamic.add(plane)
      }
      if (s.package === 'contact') {
        setVisible('fluid_balloon', s.mode === 'balloon' || s.mode === 'bubble')
        setVisible('air_gap', s.mode === 'gap')
        setVisible('air_bubble', s.mode === 'bubble')
        setVisible('calcified_focus', s.mode === 'shadow')
        // Move the transducer/body together: direct contact touches the wall; the balloon bridges it otherwise.
        setPosition('transducer', [0, s.mode === 'direct' || s.mode === 'shadow' ? 5 : 0, 0])
        // Exported mesh origins are centers; preserve center when translating.
        const tip = root.getObjectByName('scope_tip')
        if (tip) tip.position.y = (-5 + (s.mode === 'direct' || s.mode === 'shadow' ? 5 : 0)) / 1000
      }
      if (s.package === 'measurement') {
        for (const name of Object.keys(MODEL_GEOMETRY.phantoms))
          setVisible('phantom_' + name, name === s.shape)
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(60, 46),
          new THREE.MeshBasicMaterial({
            color: 0x2ed3c0,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        )
        plane.position.set(0, 23, s.offset)
        dynamic.add(plane)
      }
      if (s.package === 'routes') {
        root.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return
          const id = (o.userData.semanticId as string) || o.name
          if (id.startsWith('airway_window_') || id.startsWith('esophageal_window_'))
            o.visible =
              id === (s.route === 'airway' ? 'airway_window_' : 'esophageal_window_') + s.station &&
              routeSupported(s)
          if (id.startsWith('node_station_')) o.visible = id === routeDefinition(s)?.nodeId
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of mats) {
            if (!m.transparent) {
              m.transparent = true
              m.needsUpdate = true
            }
            m.opacity = id.startsWith('node_')
              ? 0.95
              : [
                    'trachea',
                    'carina',
                    'left_main_bronchus',
                    'right_main_bronchus',
                    'esophagus',
                    'aorta',
                    'pulmonary_artery',
                    'azygous',
                  ].includes(id)
                ? 0.32
                : 0.07
            m.depthWrite = false
          }
        })
        const route = routeDefinition(s)
        if (route && routeSupported(s)) {
          const p = route[s.route === 'airway' ? 'airway' : 'esophageal']!
          const a = new THREE.Vector3(...(p as [number, number, number])),
            b = new THREE.Vector3(...(route.target as [number, number, number]))
          const arrow = new THREE.ArrowHelper(
            b.clone().sub(a).normalize(),
            a,
            a.distanceTo(b),
            s.route === 'airway' ? 0x5ca9ff : 0x35e3ba,
            4,
            2,
          )
          dynamic.add(arrow)
          const routeKey = s.station + ':' + s.route
          if (lastRoute !== routeKey) {
            controls.target.copy(b)
            camera.position
              .copy(b)
              .add(a.clone().sub(b).normalize().multiplyScalar(125))
              .add(new THREE.Vector3(0, 24, 0))
            controls.update()
            lastRoute = routeKey
          }
        }
      }
      const items: { id: string; label: string }[] = []
      root.traverseVisible((o) => {
        if (o instanceof THREE.Mesh && o.userData.label) {
          const id = o.userData.semanticId || o.name
          const hiddenAnswer =
            !r &&
            (id === 'needle_tip' ||
              id === 'needle_shaft' ||
              id === 'air_gap' ||
              id === 'air_bubble' ||
              id === 'calcified_focus')
          if (!hiddenAnswer)
            items.push({
              id,
              label: !r && id.startsWith('node') ? 'Example node' : o.userData.label,
            })
        }
      })
      setStructures(items)
      draw()
      live.current.onRendered(modelFrameId(s))
    }
    update.current = updateScene
    load(state.package)
      .then((loaded) => {
        if (disposed) {
          loaded.forEach(dispose)
          return
        }
        groups = loaded
        groups.forEach((g) =>
          g.traverse((o) => {
            if (o instanceof THREE.Mesh)
              o.material = Array.isArray(o.material)
                ? o.material.map((m) => m.clone())
                : o.material.clone()
          }),
        )
        groups.forEach((g) => root.add(g))
        const home = () => {
          const s = live.current.state
          if (s.package === 'routes') {
            controls.target.set(0, 1190, 170)
            camera.position.set(245, 1270, 470)
          } else if (s.package === 'needle') {
            /*
             * Frame the assembly from its own bounds (EBUS-PRE-REVIEW-02, L21-2). The home view
             * was a fixed position 176 units back from a 38-degree camera, which left the
             * assembly a few dozen pixels inside a panel several hundred wide — the objective is
             * to relate sheath, needle, stylet and outlet, and at that size none of them can be
             * told apart. The direction of the view is unchanged; only the distance is now
             * derived, so it holds if the model is ever re-exported at another scale. Camera
             * framing is excluded from `modelFrameId`, so nothing about the acquisition moves.
             */
            // `root` carries the glTF metre-to-millimetre scale, so its world matrix has to be
            // current before the box means anything in the units the rest of this file uses.
            scene.updateMatrixWorld(true)
            const bounds = new THREE.Box3()
            for (const group of groups) bounds.expandByObject(group)
            const centre = bounds.getCenter(new THREE.Vector3())
            const size = bounds.getSize(new THREE.Vector3())
            const aspect = el.clientHeight > 0 ? el.clientWidth / el.clientHeight : 4 / 3
            const halfFov = Math.tan((camera.fov * Math.PI) / 360)
            // The assembly is long and shallow, so the width against the panel's aspect ratio is
            // what actually sets the distance; the old fixed position ignored both.
            const fit = Math.max(size.y / 2 / halfFov, size.x / 2 / halfFov / aspect)
            const distance =
              Number.isFinite(fit) && fit > 0 ? fit * 1.12 + size.z / 2 : 176
            controls.target.copy(Number.isFinite(centre.x) ? centre : new THREE.Vector3(-29, 4, 0))
            camera.position.set(
              controls.target.x + distance * 0.05,
              controls.target.y + distance * 0.15,
              controls.target.z + distance,
            )
          } else {
            controls.target.set(0, 18, 0)
            camera.position.set(46, 30, 94)
          }
          controls.update()
          draw()
        }
        resetCamera.current = home
        resize()
        home()
        updateScene()
        setReady(true)
      })
      .catch((e) => {
        if (!disposed)
          live.current.onError(e instanceof Error ? e.message : 'Unable to load teaching model.')
      })
    const ray = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const hover = (e: PointerEvent) => {
      if (e.buttons) {
        setTooltip(null)
        return
      }
      const box = renderer.domElement.getBoundingClientRect()
      pointer.set(
        ((e.clientX - box.left) / box.width) * 2 - 1,
        (-(e.clientY - box.top) / box.height) * 2 + 1,
      )
      ray.setFromCamera(pointer, camera)
      const visible: THREE.Object3D[] = []
      root.traverseVisible((o) => {
        if (o instanceof THREE.Mesh) visible.push(o)
      })
      const hit = ray.intersectObjects(visible, false)[0]?.object
      const id = hit?.userData.semanticId || hit?.name
      const r = live.current.reveal
      const hidden =
        !r &&
        ['needle_tip', 'needle_shaft', 'air_gap', 'air_bubble', 'calcified_focus'].includes(id)
      const label = hit?.userData.label
      setTooltip(
        label && !hidden
          ? {
              label: !r && id.startsWith('node') ? 'Example node' : label,
              x: Math.max(8, Math.min(box.width - 195, e.clientX - box.left + 12)),
              y: Math.max(8, Math.min(box.height - 44, e.clientY - box.top + 12)),
            }
          : null,
      )
    }
    const leave = () => setTooltip(null)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setTooltip(null)
      }
    }
    renderer.domElement.addEventListener('pointermove', hover)
    renderer.domElement.addEventListener('pointerleave', leave)
    renderer.domElement.addEventListener('keydown', key)
    return () => {
      disposed = true
      update.current = null
      resetCamera.current = null
      observer.disconnect()
      controls.dispose()
      groups.forEach(dispose)
      clearDynamic()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [state.package])
  useEffect(() => {
    setTooltip(null)
    setSelected('')
    update.current?.()
  }, [state, reveal])
  return (
    <section className="model-3d">
      <div className="model-heading">
        <h2>3D relationship</h2>
        <button onClick={() => resetCamera.current?.()}>Reset view</button>
      </div>
      <div className="model-viewport" ref={host}>
        {!ready && <p role="status">Loading model…</p>}
        {tooltip && (
          <div className="model-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            {tooltip.label}
          </div>
        )}
      </div>
      <div className="model-inspector">
        <label>
          Discover a structure{' '}
          <select
            aria-label="Discover a structure"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a visible structure</option>
            {structures.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {selected && <p role="status">{structures.find((o) => o.id === selected)?.label}</p>}
      </div>
      <p className="model-caption">
        Drag to orbit; scroll to zoom. Observer movement does not alter the acquisition.
        {state.package === 'needle' && !reveal
          ? ' Distal needle geometry is concealed; use the ultrasound schematic.'
          : ''}
      </p>
    </section>
  )
}
