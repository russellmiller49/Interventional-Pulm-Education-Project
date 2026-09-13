import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { AcousticVolume } from '@bronchoscopy-core/acoustic'
import type {
  EbusLinkedEvidence,
  EbusWorkbenchConfig,
} from '../../../../../src/lib/ebus-guided-bridge'
import {
  cephalicImageAxis,
  resolveEndoscopeCameraCalibration,
  type SimulatorProbePose,
} from '../features/simulator/pose'
import type { SimulatorCaseManifest } from '../features/simulator/types'
import {
  loadLinkedModels,
  opticalRay,
  teachingScopeMatrix,
  type LinkedModels,
} from './linkedModels'
import { ModelSection } from './ModelSection'

type Mode = 'scope' | 'anatomy' | 'section'
type Controller = { update: () => void; orbit: (angle: number) => void; reset: () => void }
interface Props {
  ultrasound: ReactNode
  config: EbusWorkbenchConfig
  pose: SimulatorProbePose
  caseData: SimulatorCaseManifest
  volume: AcousticVolume
  contactQuality: number
  flexion: number
  evidence: EbusLinkedEvidence
  onEvidence: (value: Partial<EbusLinkedEvidence>) => void
  onApproach: (approach: 'rms' | 'lms') => void
  onDemo: (action: 'roll' | 'flexion' | 'reset') => void
}
const labelFor = (mesh: THREE.Object3D, reveal: boolean) =>
  mesh.userData.role === 'node' && !reveal
    ? 'Example node'
    : String(mesh.userData.label ?? mesh.name).replace(/_/g, ' ')

export function LinkedModelView(props: Props) {
  const { config, volume, pose, evidence, onEvidence } = props
  const [models, setModels] = useState<LinkedModels | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>(
    config.linkedLesson === 'scope-orientation' || config.linkedLesson === 'acoustic-contact'
      ? 'scope'
      : 'anatomy',
  )
  const [wholeScope, setWholeScope] = useState(false)
  const [selection, setSelection] = useState('')
  const [selectedPoint, setSelectedPoint] = useState<THREE.Vector3 | null>(null)
  const [regions, setRegions] = useState(false)
  const [isolate, setIsolate] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const controller = useRef<Controller | null>(null)
  const latest = useRef({ ...props, mode, selection, regions, isolate, wholeScope })
  const callback = useRef(onEvidence)
  useEffect(() => {
    callback.current = onEvidence
  }, [onEvidence])
  useEffect(() => {
    let cancelled = false
    loadLinkedModels(volume)
      .then((result) => {
        if (!cancelled) {
          setModels(result)
          callback.current({ assetsReady: true })
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Unable to load models.')
          callback.current({ assetsReady: false })
        }
      })
    return () => {
      cancelled = true
    }
  }, [volume])
  useEffect(() => {
    latest.current = { ...props, mode, selection, regions, isolate, wholeScope }
    controller.current?.update()
  }, [props, mode, selection, regions, isolate, wholeScope])
  const choose = useCallback((id: string, point?: THREE.Vector3) => {
    if (latest.current.config.locked) return
    setSelection(id)
    if (point) setSelectedPoint(point)
    if (!latest.current.config.demonstration) callback.current({ selectedStructure: id })
  }, [])
  const viewed = useCallback(() => {
    if (!latest.current.config.locked && !latest.current.config.demonstration)
      callback.current({ modelSectionViewed: true })
  }, [])
  // One observer camera. Its state never enters the acquisition pose or activity evidence.
  useEffect(() => {
    if (!host.current || !models) return
    const element = host.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b242e')
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 6000)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch {
      setError('WebGL could not open the linked model view. Retry the workbench.')
      callback.current({ assetsReady: false })
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const contextLost = (event: Event) => {
      event.preventDefault()
      stopHover()
      setError('The 3D context was lost. Retry the teaching models to restart this acquisition.')
      callback.current({ assetsReady: false })
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    renderer.domElement.setAttribute(
      'aria-label',
      'Linked 3D teaching model. Use the named structure selector and observer buttons for keyboard access.',
    )
    element.appendChild(renderer.domElement)
    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = false
    orbit.minDistance = 10
    orbit.maxDistance = 650
    const anatomy = models.anatomy.clone(true),
      nodes = models.nodes.clone(true),
      scope = models.scope.clone(true),
      aids = models.regions.clone(true)
    const copies = [anatomy, nodes, scope, aids]
    const materials: THREE.Material[] = []
    copies.forEach((root) => {
      root.scale.setScalar(1000)
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const multiple = Array.isArray(object.material)
        const cloned = (Array.isArray(object.material) ? object.material : [object.material]).map(
          (material) => {
            const copy = material.clone()
            materials.push(copy)
            return copy
          },
        )
        object.material = multiple ? cloned : cloned[0]
        object.frustumCulled = false
      })
      scene.add(root)
    })
    scene.add(new THREE.HemisphereLight('#effaff', '#38505c', 2.5))
    const light = new THREE.DirectionalLight('#fff0d6', 3)
    light.position.set(-100, 1400, 500)
    scene.add(light)
    const fanGeometry = new THREE.BufferGeometry()
    const fanMaterial = new THREE.MeshBasicMaterial({
      color: '#65d8dd',
      transparent: true,
      opacity: 0.23,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const fan = new THREE.Mesh(fanGeometry, fanMaterial)
    scene.add(fan)
    const optical = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(),
      25,
      '#eec574',
      3,
      1.7,
    )
    scene.add(optical)
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#f6c96c', depthTest: false }),
    )
    marker.renderOrder = 10
    scene.add(marker)
    // Discovery labels are local to the observer view and never supply activity evidence.
    const tooltip = document.createElement('div')
    tooltip.className = 'linked-model-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.hidden = true
    element.appendChild(tooltip)
    const raycaster = new THREE.Raycaster()
    const pointerVector = new THREE.Vector2()
    let hoverPosition: { x: number; y: number } | null = null
    let hovered: THREE.Object3D | null = null
    let dismissed: THREE.Object3D | null = null
    let hoverFrame = 0
    const hideHover = () => {
      tooltip.hidden = true
      tooltip.textContent = ''
      hovered = null
    }
    const stopHover = () => {
      hoverPosition = null
      dismissed = null
      hideHover()
    }
    const pickStructure = (x: number, y: number) => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return undefined
      raycaster.setFromCamera(
        pointerVector.set(
          (2 * (x - rect.left)) / rect.width - 1,
          1 - (2 * (y - rect.top)) / rect.height,
        ),
        camera,
      )
      const roots = latest.current.mode === 'scope' ? [scope] : [anatomy, nodes]
      const visible: THREE.Object3D[] = []
      roots.forEach((root) =>
        root.traverseVisible((object) => {
          if (object instanceof THREE.Mesh && object.userData.semanticId) visible.push(object)
        }),
      )
      // Example nodes render over surrounding anatomy; picking follows that visible order.
      return raycaster
        .intersectObjects(visible, false)
        .sort((a, b) => b.object.renderOrder - a.object.renderOrder || a.distance - b.distance)[0]
        ?.object
    }
    const refreshHover = () => {
      hoverFrame = 0
      const state = latest.current
      if (
        !hoverPosition ||
        state.mode === 'section' ||
        (state.config.locked && !state.config.reveal)
      ) {
        hideHover()
        return
      }
      const object = pickStructure(hoverPosition.x, hoverPosition.y)
      if (!object || object === dismissed) {
        if (!object) dismissed = null
        hideHover()
        return
      }
      dismissed = null
      hovered = object
      tooltip.textContent = labelFor(object, state.config.reveal)
      tooltip.hidden = false
      const rect = element.getBoundingClientRect()
      const x = hoverPosition.x - rect.left,
        y = hoverPosition.y - rect.top
      tooltip.style.left = `${Math.max(6, Math.min(x + 12, element.clientWidth - tooltip.offsetWidth - 6))}px`
      tooltip.style.top = `${Math.max(6, Math.min(y + 16, element.clientHeight - tooltip.offsetHeight - 6))}px`
    }
    const queueHover = () => {
      if (hoverPosition && !hoverFrame) hoverFrame = requestAnimationFrame(refreshHover)
    }
    const reset = () => {
      const state = latest.current
      if (state.mode === 'scope') {
        const basis = teachingScopeMatrix(state.pose, true)
        const focus = new THREE.Vector3(
          state.wholeScope ? 99 : 12,
          state.wholeScope ? -1 : 10,
          0,
        ).applyMatrix4(basis)
        const eye = new THREE.Vector3(12, state.wholeScope ? 180 : 50, state.wholeScope ? 255 : 66)
          .transformDirection(basis)
          .multiplyScalar(state.wholeScope ? 415 : 82)
        orbit.target.copy(focus)
        camera.position.copy(focus).add(eye)
        camera.up.copy(cephalicImageAxis(state.pose))
      } else {
        orbit.target.set(-10, 1222, 161)
        camera.position.set(135, 1275, 340)
        camera.up.set(0, 1, 0)
      }
      orbit.update()
    }
    const render = () => {
      renderer.render(scene, camera)
      element.dataset.modelTriangles = String(renderer.info.render.triangles)
      queueHover()
    }
    const update = () => {
      const state = latest.current,
        deviceView = state.mode === 'scope',
        showSelection = !state.config.locked || state.config.reveal
      anatomy.visible = !deviceView
      nodes.visible = !deviceView
      aids.visible = !deviceView && state.regions && state.config.reveal
      scope.matrixAutoUpdate = false
      scope.matrix
        .copy(teachingScopeMatrix(state.pose, deviceView))
        .scale(new THREE.Vector3(1000, 1000, 1000))
      const rightLesson = state.config.linkedLesson === 'right-paratracheal'
      const meshes: THREE.Mesh[] = []
      anatomy.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const role = object.userData.role,
          selected = showSelection && object.name === state.selection
        object.visible =
          state.isolate && showSelection
            ? selected
            : role !== 'heart' &&
              object.name !== 'distal_airway_branches' &&
              ![
                'pulmonary_venous_system',
                'right_common_carotid_artery',
                'left_common_carotid_artery',
                'right_subclavian_artery',
                'left_subclavian_artery',
              ].includes(object.name)
        meshes.push(object)
        const mats = (
          Array.isArray(object.material) ? object.material : [object.material]
        ) as THREE.MeshStandardMaterial[]
        mats.forEach((material) => {
          const vein = /vena|vein|azyg/.test(object.name)
          material.color.set(
            role === 'airway'
              ? '#d5a49d'
              : role === 'esophagus'
                ? '#be936f'
                : vein
                  ? '#719bdf'
                  : '#d67672',
          )
          material.transparent = true
          material.opacity = selected ? 1 : role === 'airway' ? 0.48 : 0.38
          material.depthWrite = selected
          material.needsUpdate = true
          material.emissive?.set(selected ? '#453323' : '#000000')
        })
      })
      nodes.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        object.visible =
          !state.isolate &&
          (rightLesson
            ? ['4R', '10R'].includes(object.userData.stationId)
            : object.userData.stationId === '7')
        meshes.push(object)
        ;(
          (Array.isArray(object.material)
            ? object.material
            : [object.material]) as THREE.MeshStandardMaterial[]
        ).forEach((material) => {
          material.color.set('#c8bd79')
          material.transparent = false
          material.opacity = 1
          material.depthTest = false
          object.renderOrder = 4
        })
      })
      scope.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const role = object.userData.role
        object.visible = deviceView
          ? state.wholeScope || !['handle', 'lever', 'port', 'shaft'].includes(role)
          : !['handle', 'lever', 'port', 'shaft', 'bending'].includes(role)
        if (role === 'balloon') object.visible = state.contactQuality >= 0.45
        if (role === 'retracted-needle') object.visible = false
        meshes.push(object)
        ;(
          (Array.isArray(object.material)
            ? object.material
            : [object.material]) as THREE.MeshStandardMaterial[]
        ).forEach((material) => {
          material.emissive?.set(
            showSelection && state.selection === object.name ? '#306c69' : '#000000',
          )
        })
      })
      // Lever angle illustrates the current flexion command; pose/contact remain engine-owned.
      const bendAngle = -THREE.MathUtils.degToRad(state.flexion),
        bendLength = 18.4
      const bendPoint = (distance: number) =>
        Math.abs(bendAngle) < 1e-7
          ? new THREE.Vector3(7.2 + distance, 1.2, 0)
          : new THREE.Vector3(
              7.2 + (bendLength / bendAngle) * Math.sin((bendAngle * distance) / bendLength),
              1.2 + (bendLength / bendAngle) * (1 - Math.cos((bendAngle * distance) / bendLength)),
              0,
            )
      for (let i = 0; i < 8; i++) {
        const ring = scope.getObjectByName('bending_ring_' + i)
        if (ring) {
          const distance = i * 2.3 + 0.9
          ring.position.copy(bendPoint(distance)).multiplyScalar(0.001)
          ring.rotation.z = (bendAngle * distance) / bendLength
        }
      }
      const proximal = scope.getObjectByName('proximal_frame')
      if (proximal) {
        proximal.matrixAutoUpdate = false
        const end = bendPoint(bendLength).multiplyScalar(0.001)
        proximal.matrix
          .makeTranslation(end.x, end.y, end.z)
          .multiply(new THREE.Matrix4().makeRotationZ(bendAngle))
          .multiply(new THREE.Matrix4().makeTranslation(-0.0256, -0.0012, 0))
      }
      const lever = scope.getObjectByName('angulation_lever_pivot')
      if (lever) lever.rotation.z = THREE.MathUtils.degToRad(-state.flexion * 0.45)
      const origin = deviceView ? new THREE.Vector3() : state.pose.position
      const cephalic = cephalicImageAxis(state.pose),
        half =
          ((state.caseData.ultrasound_probe?.sector_angle_deg ??
            state.caseData.render_defaults.sector_angle_deg) *
            Math.PI) /
          360
      const vertices: number[] = []
      for (let step = 0; step < 30; step++) {
        vertices.push(...origin.toArray())
        for (const theta of [-half + (2 * half * step) / 30, -half + (2 * half * (step + 1)) / 30])
          vertices.push(
            ...origin
              .clone()
              .addScaledVector(state.pose.depthAxis, 40 * Math.cos(theta))
              .addScaledVector(cephalic, 40 * Math.sin(theta))
              .toArray(),
          )
      }
      fanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      fanGeometry.computeBoundingSphere()
      const ray = opticalRay(
        state.pose,
        resolveEndoscopeCameraCalibration(state.caseData.endoscope_camera),
      )
      optical.position.copy(ray.origin)
      if (deviceView) optical.position.sub(state.pose.position)
      optical.setDirection(ray.direction)
      optical.visible = deviceView
      scene.updateMatrixWorld(true)
      const selected = meshes.find((object) => object.name === state.selection)
      marker.visible = !!selected && showSelection && !deviceView
      if (selected) {
        const center = new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3())
        marker.position.copy(center)
      }
      render()
    }
    const resize = new ResizeObserver(() => {
      const width = element.clientWidth,
        height = element.clientHeight
      if (!width || !height) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      render()
    })
    resize.observe(element)
    orbit.addEventListener('change', render)
    let pointer: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY }
      stopHover()
    }
    const up = (e: PointerEvent) => {
      const start = pointer
      pointer = null
      if (
        !start ||
        Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5 ||
        latest.current.config.locked
      )
        return
      const hit = pickStructure(e.clientX, e.clientY)
      // Use the same structure center for pointer selection, named selection and section marker.
      if (hit) choose(hit.name, new THREE.Box3().setFromObject(hit).getCenter(new THREE.Vector3()))
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.buttons) {
        stopHover()
        return
      }
      hoverPosition = { x: e.clientX, y: e.clientY }
      queueHover()
    }
    const leave = () => {
      pointer = null
      stopHover()
    }
    const dismiss = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !hovered) return
      dismissed = hovered
      hideHover()
    }
    renderer.domElement.addEventListener('pointerdown', down)
    renderer.domElement.addEventListener('pointerup', up)
    renderer.domElement.addEventListener('pointermove', move)
    renderer.domElement.addEventListener('pointerleave', leave)
    renderer.domElement.addEventListener('pointercancel', leave)
    window.addEventListener('keydown', dismiss)
    controller.current = {
      update,
      reset,
      orbit: (angle) => {
        const offset = camera.position.clone().sub(orbit.target).applyAxisAngle(camera.up, angle)
        camera.position.copy(orbit.target).add(offset)
        orbit.update()
      },
    }
    reset()
    update()
    return () => {
      cancelAnimationFrame(hoverFrame)
      window.removeEventListener('keydown', dismiss)
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      renderer.domElement.removeEventListener('pointerdown', down)
      renderer.domElement.removeEventListener('pointerup', up)
      renderer.domElement.removeEventListener('pointermove', move)
      renderer.domElement.removeEventListener('pointerleave', leave)
      renderer.domElement.removeEventListener('pointercancel', leave)
      controller.current = null
      resize.disconnect()
      orbit.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      element.replaceChildren()
      materials.forEach((m) => m.dispose())
      fanGeometry.dispose()
      fanMaterial.dispose()
      marker.geometry.dispose()
      ;(marker.material as THREE.Material).dispose()
      optical.dispose()
    }
  }, [models, choose, mode === 'scope', wholeScope])
  const roots = models ? (mode === 'scope' ? [models.scope] : [models.anatomy, models.nodes]) : []
  const options: THREE.Object3D[] = []
  roots.forEach((root) =>
    root.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.userData.semanticId &&
        !object.name.startsWith('bending_ring_') &&
        object.userData.role !== 'node'
      )
        options.push(object)
    }),
  )
  const selectNamed = (id: string) => {
    const object = roots.flatMap((root) => {
      const found = root.getObjectByName(id)
      return found ? [found] : []
    })[0]
    const point = object
      ? new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).multiplyScalar(1000)
      : null
    choose(id, point && mode !== 'scope' ? point : undefined)
  }
  return (
    <section className="linked-models" aria-label="Linked teaching models">
      <div className="guided-tabs" role="group" aria-label="Linked model view">
        {(['scope', 'anatomy', 'section'] as const).map((view) => (
          <button
            key={view}
            aria-pressed={mode === view}
            onClick={() => {
              if ((view === 'scope') !== (mode === 'scope')) {
                setSelection('')
                setSelectedPoint(null)
              }
              setMode(view)
            }}
          >
            {view === 'scope'
              ? 'Scope model'
              : view === 'anatomy'
                ? 'Anatomy model'
                : 'Model section'}
          </button>
        ))}
      </div>
      <p className="guided-label">
        {mode === 'scope'
          ? 'Cyan fan: ultrasound plane. Gold arrow: optical direction. Added mechanical parts are illustrative.'
          : 'Anatomy and ultrasound share one scope pose. Example nodes remain visible through surrounding structures for orientation.'}
      </p>
      {config.linkedLesson === 'station-seven' && (
        <div className="guided-tabs" role="group" aria-label="Bronchial approach">
          {(['rms', 'lms'] as const).map((approach) => (
            <button
              key={approach}
              disabled={config.locked}
              aria-pressed={evidence.approach === approach}
              onClick={() => props.onApproach(approach)}
            >
              {approach === 'rms' ? 'Right main bronchus' : 'Left main bronchus'}
              {evidence.scannedApproaches.includes(approach) ? ' · scanned' : ''}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div role="alert" className="guided-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry teaching models</button>
        </div>
      )}
      {!models && !error && <p role="status">Checking and loading teaching models…</p>}
      <div className="linked-pair">
        <div className="linked-physical">
          <div ref={host} className="linked-canvas" hidden={mode === 'section'} />
          {mode === 'section' && (
            <ModelSection
              volume={volume}
              pose={pose}
              selectedPoint={config.locked && !config.reveal ? null : selectedPoint}
              onViewed={viewed}
            />
          )}
        </div>
        <div className="linked-ultrasound">{props.ultrasound}</div>
      </div>
      <div className="guided-tabs" role="group" aria-label="Observer camera">
        <button onClick={() => controller.current?.orbit(-0.3)}>Orbit left</button>
        <button onClick={() => controller.current?.orbit(0.3)}>Orbit right</button>
        <button onClick={() => controller.current?.reset()}>Reset view</button>
        {mode === 'scope' && (
          <button aria-pressed={wholeScope} onClick={() => setWholeScope((v) => !v)}>
            {wholeScope ? 'Show distal tip' : 'Show whole scope'}
          </button>
        )}
      </div>
      <p className="guided-label">
        {(!config.locked || config.reveal) && mode !== 'section' && 'Hover to name a structure. '}
        Drag to orbit; scroll to zoom. Observer controls change your viewpoint only.
      </p>
      {!config.locked && models && (
        <>
          <label>
            Inspect a structure
            <select
              aria-label="Inspect a structure"
              value={selection}
              onChange={(e) => selectNamed(e.target.value)}
            >
              <option value="">Choose a structure</option>
              {options.map((object) => (
                <option key={object.name} value={object.name}>
                  {labelFor(object, config.reveal)}
                </option>
              ))}
            </select>
          </label>
          {selection && (
            <p className="linked-selection" role="status">
              Selected:{' '}
              {labelFor(
                roots.map((root) => root.getObjectByName(selection)).find(Boolean) ??
                  ({ name: selection, userData: {} } as THREE.Object3D),
                config.reveal,
              )}
            </p>
          )}
          {mode !== 'scope' && (
            <label>
              <input
                type="checkbox"
                checked={isolate}
                onChange={(e) => setIsolate(e.target.checked)}
              />{' '}
              Isolate selected structure
            </label>
          )}
        </>
      )}
      {config.reveal && mode !== 'scope' && (
        <label>
          <input type="checkbox" checked={regions} onChange={(e) => setRegions(e.target.checked)} />{' '}
          Show draft boundary levels (anatomical review pending)
        </label>
      )}
      {config.demonstration && (
        <div className="linked-demo">
          <strong>Worked demonstration</strong>
          <p>Change one command at a time and watch both views.</p>
          <div className="guided-tabs">
            <button onClick={() => props.onDemo('roll')}>Demonstrate rotation</button>
            <button onClick={() => props.onDemo('flexion')}>Demonstrate flexion</button>
            <button onClick={() => props.onDemo('reset')}>Reset example</button>
          </div>
          <p className="guided-label">Demonstration actions do not complete the activity.</p>
        </div>
      )}
      <p className="guided-label">
        Model revision {models?.manifest.version ?? '…'} · New semantic divisions and device
        additions await anatomical review.
      </p>
    </section>
  )
}
