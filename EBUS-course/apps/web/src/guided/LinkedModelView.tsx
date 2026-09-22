import {
  LINKED_LANDMARKS,
  LANDMARK_NAMES,
  LANDMARK_HINTS,
  STRUCTURE_FEATURES,
  type LinkedSweepEvent,
} from '../../../../../src/lib/ebus-linked-contract'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { canDiscoverImage } from './imageDiscoveryPixels'
import {
  createStructureCallouts,
  surfaceAnchor,
  linkedCalloutFocus,
  type StructureCalloutHandle,
} from './structureCallouts'
import { compassDirections, fitSphereDistance } from './observerCamera'
import { attachObserverControls, OBSERVER_CAPTION } from './observerControls'
import { describeLinkedSweep, SWEEP_TOLERANCE_NOTE } from './sweepStatus'

type Mode = 'scope' | 'anatomy' | 'section'
type Controller = {
  update: () => void
  orbit: (angle: number) => void
  zoom: (factor: number) => void
  reset: () => void
  release: () => void
}
/** What the sampler last did, reported by the workbench that owns the sweep state. */
export interface LinkedSweepReport {
  event: LinkedSweepEvent | null
  resetProgress: { samples: number; span: number } | null
}
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
  /** Current rendered frame: whether the model target is in this plane (EBUS-PRE-REVIEW-03). */
  targetVisible?: boolean
  frameReady?: boolean
  /** The model target's name, from the preset the workbench was configured with. */
  targetName?: string
  sweepReport?: LinkedSweepReport
}
const labelFor = (mesh: THREE.Object3D, reveal: boolean) =>
  mesh.userData.role === 'node' && !reveal
    ? 'Example node'
    : String(mesh.userData.label ?? mesh.name).replace(/_/g, ' ')
/**
 * Short names for the marker legend. Landmarks use the contract's names; the other candidates
 * are named from the model's own labels, shortened for a pill. Names are presentation only and
 * never enter the evidence.
 */
const SHORT_NAMES: Record<string, string> = {
  ...LANDMARK_NAMES,
  optical_lens: 'optical lens',
  channel_outlet: 'working-channel outlet',
  legacy_distal_body: 'distal body',
  brachiocephalic_trunk: 'brachiocephalic trunk',
  aorta: 'aorta',
}
/*
 * Colours with one meaning each (L3-4 / L3-9). Gold was both the optical-direction arrow and
 * the selection highlight, so selecting a part turned it the colour of the lens direction.
 * Selection is now violet everywhere — marker, leader, mesh emissive, section cross — and hover
 * is teal; the arrow keeps gold and the fan keeps cyan. Shape carries the state too: a selected
 * marker is filled and pressed, a hovered one is ringed.
 */
const SELECT_EMISSIVE = '#5a2d86'
const HOVER_EMISSIVE = '#1e6360'
const SELECT_MARKER = '#d9a5ff'

export function LinkedModelView(props: Props) {
  const { config, volume, pose, evidence, onEvidence } = props
  const [models, setModels] = useState<LinkedModels | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>(
    config.linkedLesson === 'scope-orientation' || config.linkedLesson === 'acoustic-contact'
      ? 'scope'
      : // The ct-map demonstration is titled "Compare the model section and ultrasound plane";
        // it opens on that view instead of an isolated carina in an empty panel (L11-4).
        config.demonstration && config.linkedLesson === 'ct-map'
        ? 'section'
        : 'anatomy',
  )
  const [wholeScope, setWholeScope] = useState(false)
  const [selection, setSelection] = useState(
    config.demonstration && config.linkedLesson
      ? (LINKED_LANDMARKS[config.linkedLesson][0] ?? '')
      : '',
  )
  const [landmarkFeedback, setLandmarkFeedback] = useState('')
  const [selectedPoint, setSelectedPoint] = useState<THREE.Vector3 | null>(null)
  const regions = false
  const [isolate, setIsolate] = useState(
    !!config.demonstration && config.linkedLesson !== 'acoustic-contact',
  )
  // Presentation state only: which marker is hovered or focused, whether the legend shows names,
  // whether the anatomy camera frames the whole model or the landmark region, and whether the
  // canvas currently owns the wheel. None of it reaches the evidence.
  const [hovered, setHovered] = useState<string | null>(null)
  const [showNames, setShowNames] = useState(false)
  const [wholeAnatomy, setWholeAnatomy] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const roots = useMemo(
    () => (models ? (mode === 'scope' ? [models.scope] : [models.anatomy, models.nodes]) : []),
    [models, mode === 'scope'],
  )
  const options = useMemo(() => {
    const result: THREE.Mesh[] = []
    roots.forEach((root) =>
      root.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          object.userData.semanticId &&
          !object.name.startsWith('bending_ring_') &&
          object.userData.role !== 'node'
        )
          result.push(object)
      }),
    )
    return result
  }, [roots])
  const candidateIds =
    mode === 'scope'
      ? ['transducer_face', 'optical_lens', 'channel_outlet', 'legacy_distal_body']
      : [
          'carina',
          'right_main_bronchus',
          'left_main_bronchus',
          'azygous',
          'superior_vena_cava',
          'left_brachiocephalic_vein',
          'brachiocephalic_trunk',
          'aorta',
        ]
  // The selector, mesh picking and letter callouts share this exact order.
  const unnamedCandidates = options.filter((object) => candidateIds.includes(object.name))
  const identifying = !config.demonstration && !config.reveal
  const candidates = identifying ? unnamedCandidates : options
  const landmarkIds = config.linkedLesson ? LINKED_LANDMARKS[config.linkedLesson] : []
  const landmarkTarget = landmarkIds.find((id) => !evidence.identifiedStructures?.includes(id))
  const landmarkMode = landmarkTarget === 'transducer_face' ? 'scope' : 'anatomy'
  const host = useRef<HTMLDivElement>(null)
  const controller = useRef<Controller | null>(null)
  const latest = useRef({
    ...props,
    mode,
    selection,
    regions,
    isolate,
    wholeScope,
    identifying,
    unnamedCandidates,
    hovered,
    showNames,
    wholeAnatomy,
    landmarkTarget,
  })
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
          callback.current({ assetsReady: true, modelRevision: result.manifest.version })
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
    latest.current = {
      ...props,
      mode,
      selection,
      regions,
      isolate,
      wholeScope,
      identifying,
      unnamedCandidates,
      hovered,
      showNames,
      wholeAnatomy,
      landmarkTarget,
    }
    controller.current?.update()
  }, [props, mode, selection, regions, isolate, wholeScope, hovered, showNames, wholeAnatomy, landmarkTarget])
  const choose = useCallback((id: string, point?: THREE.Vector3) => {
    if (latest.current.config.locked) return
    setSelection(id)
    setLandmarkFeedback('')
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
      'Linked 3D teaching model. Use the structure selector, letter markers and observer buttons for keyboard access.',
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
    // Drawn after the example nodes so the plane is not hidden behind them (L3-11).
    fan.renderOrder = 5
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
      new THREE.MeshBasicMaterial({ color: SELECT_MARKER, depthTest: false }),
    )
    marker.renderOrder = 10
    scene.add(marker)
    /*
     * Model-frame compass (L3-11). Three letters used to sit at fixed world positions, so "S"
     * clipped at the top of the canvas and "R" collided with a marker's leader. This is a
     * screen-space overlay whose directions are projected from the camera basis and the verified
     * model axes (see `MODEL_FRAME_AXES`). It names the model coordinate frame only; it is not a
     * claim about how any clinical image is displayed.
     */
    const compass = document.createElement('div')
    compass.className = 'linked-compass'
    compass.setAttribute('role', 'img')
    compass.setAttribute(
      'aria-label',
      'Model frame compass: R right, L left, S superior, I inferior, A anterior, P posterior, in the model coordinate frame',
    )
    compass.title = 'Model coordinate frame — not a clinical image convention'
    const compassLabels = new Map<string, HTMLSpanElement>()
    for (const key of ['R', 'L', 'S', 'I', 'A', 'P']) {
      const span = document.createElement('span')
      span.textContent = key
      compass.appendChild(span)
      compassLabels.set(key, span)
    }
    const compassCaption = document.createElement('small')
    compassCaption.textContent = 'model frame'
    compass.appendChild(compassCaption)
    element.appendChild(compass)
    const renderCompass = () => {
      const radius = 27
      for (const axis of compassDirections(camera)) {
        const span = compassLabels.get(axis.key)!
        span.style.left = `${40 + axis.dx * radius}px`
        span.style.top = `${40 + axis.dy * radius}px`
        span.style.opacity = String(0.45 + 0.55 * (0.5 + 0.5 * -axis.toward))
        span.style.zIndex = axis.toward < 0 ? '2' : '1'
      }
    }
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
    const focusedMarker = () => {
      const active = document.activeElement
      return active instanceof HTMLButtonElement &&
        active.classList.contains('linked-structure-letter') &&
        element.contains(active) && active.offsetParent !== null
        ? active.dataset.structure ?? null
        : null
    }
    const markerHover = (id: string | null) => setHovered(focusedMarker() ?? id)
    const hideHover = () => {
      tooltip.hidden = true
      tooltip.textContent = ''
      if (hovered && latest.current.hovered === hovered.name) setHovered(focusedMarker())
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
          if (
            object instanceof THREE.Mesh &&
            object.userData.semanticId &&
            (!latest.current.identifying ||
              latest.current.unnamedCandidates.some((candidate) => candidate.name === object.name))
          )
            visible.push(object)
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
      const focused = focusedMarker()
      if (focused) {
        // A stationary pointer must not overwrite a keyboard-focused marker on the next frame.
        tooltip.hidden = true
        hovered = null
        if (state.hovered !== focused) setHovered(focused)
        return
      }
      if (
        !hoverPosition ||
        state.mode === 'section' ||
        (!state.config.reveal && (state.config.locked || !state.identifying))
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
      if (latest.current.hovered !== object.name) setHovered(object.name)
      tooltip.textContent = state.identifying
        ? 'Structure ' +
          String.fromCharCode(
            65 + state.unnamedCandidates.findIndex((candidate) => candidate.name === object.name),
          )
        : labelFor(object, state.config.reveal)
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
    /*
     * Observer camera framing (L3-2 / L3-11 / L11-3 / L11-4 / L13-3). The scope view opened on
     * the transducer face at a fixed offset and the whole-scope view at a fixed 415 mm, which made
     * the tip "a teal wedge and an oval" and the whole scope "a tiny fan and dot"; the anatomy view
     * opened on the whole mediastinum, where eight markers landed within ~120 px of each other.
     * Each view now frames the actual bounds of what it is for — the distal parts, the whole
     * device, the landmark region (marker anchors, the example node and the scope tip), an
     * isolated demonstration structure — from the same viewing direction as before, with the
     * whole model one control away. The camera is an observer; nothing about the pose, the
     * geometry or the evidence moves with it.
     */
    const WHOLE_TARGET = new THREE.Vector3(-10, 1222, 161)
    const WHOLE_EYE = new THREE.Vector3(135, 1275, 340)
    const frameBox = (
      box: THREE.Box3,
      direction: THREE.Vector3,
      up: THREE.Vector3,
      padding: number,
      minDistance: number,
    ) => {
      const center = box.getCenter(new THREE.Vector3())
      const radius = box.getSize(new THREE.Vector3()).length() / 2
      const aspect = element.clientHeight ? element.clientWidth / element.clientHeight : 4 / 3
      const distance = Math.max(minDistance, fitSphereDistance(radius, camera.fov, aspect, padding))
      orbit.target.copy(center)
      camera.up.copy(up)
      camera.position.copy(center).addScaledVector(direction.clone().normalize(), distance)
      orbit.update()
    }
    const reset = () => {
      const state = latest.current
      scene.updateMatrixWorld(true)
      if (state.mode === 'scope') {
        const basis = teachingScopeMatrix(state.pose, true)
        const distalRoles = ['transducer', 'optical', 'channel', 'distal-body', 'bending', 'balloon']
        const box = new THREE.Box3()
        scope.traverse((object) => {
          if (
            object instanceof THREE.Mesh &&
            object.visible &&
            (state.wholeScope || distalRoles.includes(object.userData.role))
          )
            box.expandByObject(object)
        })
        const direction = new THREE.Vector3(
          12,
          state.wholeScope ? 180 : 50,
          state.wholeScope ? 255 : 66,
        ).transformDirection(basis)
        if (box.isEmpty()) {
          const focus = new THREE.Vector3(state.wholeScope ? 99 : 12, state.wholeScope ? -1 : 10, 0).applyMatrix4(basis)
          orbit.target.copy(focus)
          camera.position.copy(focus).addScaledVector(direction, state.wholeScope ? 415 : 82)
          camera.up.copy(cephalicImageAxis(state.pose))
          orbit.update()
          return
        }
        frameBox(
          box,
          direction,
          cephalicImageAxis(state.pose),
          state.wholeScope ? 0.95 : 0.85,
          state.wholeScope ? 60 : 28,
        )
        return
      }
      const up = new THREE.Vector3(0, 1, 0)
      const direction = WHOLE_EYE.clone().sub(WHOLE_TARGET).normalize()
      const isolatedDemo = !!(state.config.demonstration && state.isolate && state.selection)
      if (state.wholeAnatomy && !isolatedDemo) {
        orbit.target.copy(WHOLE_TARGET)
        camera.position.copy(WHOLE_EYE)
        camera.up.copy(up)
        orbit.update()
        return
      }
      const box = new THREE.Box3()
      if (isolatedDemo) {
        const isolated = anatomy.getObjectByName(state.selection)
        if (isolated) box.expandByObject(isolated)
      } else {
        for (const candidate of state.unnamedCandidates) {
          const mesh = anatomy.getObjectByName(candidate.name)
          if (mesh instanceof THREE.Mesh) box.expandByPoint(surfaceAnchor(mesh, WHOLE_TARGET))
        }
        nodes.traverse((object) => {
          if (object instanceof THREE.Mesh && object.visible) box.expandByObject(object)
        })
        box.expandByPoint(state.pose.position)
      }
      if (box.isEmpty()) {
        orbit.target.copy(WHOLE_TARGET)
        camera.position.copy(WHOLE_EYE)
        camera.up.copy(up)
        orbit.update()
        return
      }
      box.expandByScalar(isolatedDemo ? 6 : 10)
      frameBox(box, direction, up, isolatedDemo ? 1.1 : 0.9, 40)
    }
    let callouts: StructureCalloutHandle | undefined
    const render = () => {
      renderer.render(scene, camera)
      const state = latest.current
      // Markers appear for an active identification task, or on request as a named reference —
      // not during an acquisition that has no landmark task (L4-4), and never while locked.
      const markersOn =
        !state.config.locked &&
        state.mode !== 'section' &&
        (state.identifying ? !!state.landmarkTarget || state.showNames : state.showNames)
      callouts?.render(camera, markersOn, state.selection, state.hovered, state.showNames ? SHORT_NAMES : null)
      renderCompass()
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
      scope.visible = deviceView || !state.isolate || state.config.locked
      fan.visible = deviceView || !state.isolate || state.config.locked
      scope.matrixAutoUpdate = false
      scope.matrix
        .copy(teachingScopeMatrix(state.pose, deviceView))
        .scale(new THREE.Vector3(1000, 1000, 1000))
      const rightLesson = state.config.linkedLesson === 'right-paratracheal'
      const meshes: THREE.Mesh[] = []
      anatomy.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const role = object.userData.role,
          selected = showSelection && object.name === state.selection,
          hot = !selected && state.hovered === object.name
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
        object.renderOrder = selected ? 3 : 0
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
          material.opacity = selected ? 1 : hot ? 0.82 : role === 'airway' ? 0.48 : 0.38
          material.depthWrite = selected
          material.needsUpdate = true
          material.emissive?.set(selected ? SELECT_EMISSIVE : hot ? HOVER_EMISSIVE : '#000000')
        })
      })
      nodes.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        object.visible =
          !state.isolate &&
          (rightLesson ? object.userData.stationId === '4R' : object.userData.stationId === '7')
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
        if (deviceView && state.config.demonstration && state.isolate)
          object.visible = object.name === state.selection
        meshes.push(object)
        ;(
          (Array.isArray(object.material)
            ? object.material
            : [object.material]) as THREE.MeshStandardMaterial[]
        ).forEach((material) => {
          material.emissive?.set(
            showSelection && state.selection === object.name
              ? SELECT_EMISSIVE
              : state.hovered === object.name
                ? HOVER_EMISSIVE
                : '#000000',
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
      optical.visible = deviceView && !state.isolate
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
    const observer = attachObserverControls(orbit, camera, renderer.domElement, {
      render,
      reset: () => {
        reset()
        render()
      },
      onEngagement: setEngaged,
    })
    controller.current = {
      update,
      reset: () => {
        reset()
        render()
      },
      orbit: observer.orbit,
      zoom: observer.zoom,
      release: observer.release,
    }
    update()
    reset()
    const calloutRoots = mode === 'scope' ? [scope] : [anatomy, nodes]
    const calloutMeshes = unnamedCandidates.map(
      (candidate) =>
        calloutRoots
          .map((root) => root.getObjectByName(candidate.name))
          .find(Boolean) as THREE.Mesh,
    )
    // Preserve the original surface anchors independently of observer-camera framing.
    // In particular, using the new regional camera target moves long-vessel anchors.
    const calloutFocus = linkedCalloutFocus(
      mode === 'scope' ? teachingScopeMatrix(latest.current.pose, true) : null,
      wholeScope,
    )
    callouts = createStructureCallouts(element, calloutMeshes, calloutFocus, choose, markerHover)
    render()
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
      observer.dispose()
      resize.disconnect()
      orbit.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      callouts?.dispose()
      element.replaceChildren()
      materials.forEach((m) => m.dispose())
      fanGeometry.dispose()
      fanMaterial.dispose()
      marker.geometry.dispose()
      ;(marker.material as THREE.Material).dispose()
      optical.dispose()
      compass.remove()
    }
  }, [models, choose, mode === 'scope', wholeScope])
  // Re-frame without rebuilding the scene when the framing choice or the isolated demo changes.
  useEffect(() => {
    controller.current?.reset()
  }, [wholeAnatomy, isolate])
  const sweep = evidence.sweeps?.[evidence.approach]
  const letterOf = (id: string) => {
    const index = unnamedCandidates.findIndex((object) => object.name === id)
    return index < 0 ? '' : String.fromCharCode(65 + index)
  }
  function checkLandmark() {
    if (config.locked || !landmarkTarget || !selection) return
    if (selection !== landmarkTarget) {
      const letter = letterOf(selection)
      setLandmarkFeedback(
        (letter ? 'Structure ' + letter + ' is the ' : 'That is the ') +
          (SHORT_NAMES[selection] ?? 'structure shown') +
          ', not the ' +
          LANDMARK_NAMES[landmarkTarget] +
          '. ' +
          LANDMARK_HINTS[landmarkTarget],
      )
      return
    }
    onEvidence({
      identifiedStructures: [...new Set([...(evidence.identifiedStructures ?? []), selection])],
    })
    setLandmarkFeedback(
      'Identified: ' +
        LANDMARK_NAMES[selection] +
        '. Compare its position with the neighboring structures.',
    )
    setSelection('')
  }
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
  const concealed = config.locked && !config.reveal
  const selectedIndex = candidates.findIndex((object) => object.name === selection)
  const structureSelector = (
    <label>
      {identifying ? 'Select an unnamed structure' : 'Inspect a structure'}
      <select
        aria-label={identifying ? 'Select an unnamed structure' : 'Inspect a structure'}
        value={identifying ? (selectedIndex < 0 ? '' : String(selectedIndex)) : selection}
        onChange={(e) =>
          selectNamed(
            identifying && e.target.value !== ''
              ? (candidates[Number(e.target.value)]?.name ?? '')
              : e.target.value,
          )
        }
      >
        <option value="">Choose a structure</option>
        {candidates.map((object, i) => (
          <option key={object.name} value={identifying ? String(i) : object.name}>
            {identifying
              ? 'Structure ' + String.fromCharCode(65 + i)
              : labelFor(object, config.reveal)}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <section className="linked-models" aria-label="Linked teaching models">
      <div hidden={concealed}>
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
            ? 'Cyan fan: ultrasound plane. Gold arrow: optical direction. Violet: your selected structure; teal: the structure under the pointer. Added mechanical parts are illustrative.'
            : 'Anatomy and ultrasound share one scope pose; the scope tip and cyan fan are drawn where that pose places them. Example nodes remain visible through surrounding structures for orientation. Violet: your selected structure; teal: the structure under the pointer. The compass names the model frame.'}
        </p>
        {config.linkedLesson === 'station-seven' && config.linkedVariant !== 'changed-window' && (
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
        {config.demonstration && isolate && (
          <p>
            Start with the {LANDMARK_NAMES[selection] ?? 'selected structure'}.{' '}
            <button onClick={() => setIsolate(false)}>Show neighboring anatomy</button>
          </p>
        )}
        {error && (
          <div role="alert" className="guided-error">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Retry teaching models</button>
          </div>
        )}
        {!models && !error && <p role="status">Checking and loading teaching models…</p>}
      </div>
      {identifying && !config.locked && landmarkTarget && (
        <div className="linked-landmark-task">
          <h3>Find the {LANDMARK_NAMES[landmarkTarget]}</h3>
          <p>
            Letters mark structures on the 3D {landmarkMode} model. Click or tap a letter, choose
            it from the list, or Tab to a letter and press Enter; hovering or focusing a letter
            highlights its structure. Then check your selection. Names are available at any time
            from “Show structure names” — using them is allowed and nothing here is scored.
          </p>
          {mode !== landmarkMode && (
            <button
              onClick={() => {
                setMode(landmarkMode)
                choose('')
              }}
            >
              Open {landmarkMode === 'scope' ? 'Scope' : 'Anatomy'} model for this check
            </button>
          )}
          {models && mode === landmarkMode && (
            <div className="linked-landmark-controls">
              {structureSelector}
              <button disabled={!selection} onClick={checkLandmark}>
                Check landmark
              </button>
            </div>
          )}
          {selectedIndex >= 0 && mode === landmarkMode && (
            <p className="linked-selection" aria-live="polite">
              Structure {String.fromCharCode(65 + selectedIndex)} selected — highlighted in violet
              {showNames && SHORT_NAMES[selection] ? ` (${SHORT_NAMES[selection]})` : ''}.
            </p>
          )}
          {landmarkFeedback && <p role="status">{landmarkFeedback}</p>}
        </div>
      )}
      <div className={concealed ? 'linked-pair linked-pair--retained' : 'linked-pair'}>
        <div className="linked-physical" hidden={concealed}>
          <div ref={host} className="linked-canvas" hidden={mode === 'section'} />
          {mode === 'section' && (
            <ModelSection
              volume={volume}
              pose={pose}
              selectedPoint={config.locked && !config.reveal ? null : selectedPoint}
              onViewed={viewed}
              discover={canDiscoverImage(config)}
            />
          )}
        </div>
        <div className="linked-ultrasound">{props.ultrasound}</div>
      </div>
      {!concealed && (
        <div>
          <div className="guided-tabs" role="group" aria-label="Observer camera">
            <button onClick={() => controller.current?.orbit(-0.3)}>Orbit left</button>
            <button onClick={() => controller.current?.orbit(0.3)}>Orbit right</button>
            <button onClick={() => controller.current?.zoom(1.3)}>Zoom in</button>
            <button onClick={() => controller.current?.zoom(1 / 1.3)}>Zoom out</button>
            <button onClick={() => controller.current?.reset()}>Reset view</button>
            {mode === 'scope' && (
              <button aria-pressed={wholeScope} onClick={() => setWholeScope((v) => !v)}>
                {wholeScope ? 'Show distal tip' : 'Show whole scope'}
              </button>
            )}
            {mode === 'anatomy' && (
              <button aria-pressed={wholeAnatomy} onClick={() => setWholeAnatomy((v) => !v)}>
                {wholeAnatomy ? 'Frame the landmark region' : 'Show whole model'}
              </button>
            )}
            {mode !== 'section' && (
              <button
                aria-pressed={showNames}
                data-structure-names
                onClick={() => setShowNames((v) => !v)}
              >
                {showNames ? 'Hide structure names' : 'Show structure names'}
              </button>
            )}
            {engaged && (
              <button data-release-observer onClick={() => controller.current?.release()}>
                Release wheel control
              </button>
            )}
          </div>
          <p className="guided-label" data-observer-caption>
            {config.reveal && mode !== 'section' && 'Hover, tap or focus a marker to name a structure. '}
            {identifying &&
              mode !== 'section' &&
              'Letters refer to the 3D model: hovering a letter highlights its structure, and hovering the model highlights its letter. '}
            {OBSERVER_CAPTION} Observer controls change your viewpoint only.
          </p>
          <p className="guided-label" data-observer-engaged={engaged} role="status">
            {engaged
              ? 'Wheel and one-finger control are on for the model. Press Escape or click elsewhere to release them; the page scrolls normally once released.'
              : 'The page scrolls normally over the model. Click, tap or focus the model to turn on wheel and one-finger control.'}
          </p>
        </div>
      )}
      {!config.locked && models && (
        <>
          {(!identifying || !landmarkTarget || mode !== landmarkMode) && structureSelector}
          {selection && !identifying && (
            <p className="linked-selection" role="status">
              Selected:{' '}
              {labelFor(
                roots.map((root) => root.getObjectByName(selection)).find(Boolean) ??
                  ({ name: selection, userData: {} } as THREE.Object3D),
                config.reveal,
              )}
            </p>
          )}
          {identifying && selection && STRUCTURE_FEATURES[selection] && (
            <p className="linked-selection-description">
              Selected structure: {STRUCTURE_FEATURES[selection]}
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
      {identifying && !config.locked && !landmarkTarget && landmarkIds.length > 0 && (
        <p role="status" data-landmarks-identified>
          Landmarks identified:{' '}
          {landmarkIds
            .map((id) => LANDMARK_NAMES[id] + (letterOf(id) ? ` (${letterOf(id)})` : ''))
            .join(' · ')}
          . Acquire the required ultrasound sweep.
        </p>
      )}
      {identifying &&
        config.linkedLesson !== 'acoustic-contact' &&
        !config.locked &&
        (() => {
          const status = describeLinkedSweep({
            sweep,
            targetVisible: !!props.targetVisible,
            frameReady: !!props.frameReady,
            contact: props.contactQuality,
            lastEvent: props.sweepReport?.event ?? null,
            lastResetProgress: props.sweepReport?.resetProgress ?? null,
            targetName: props.targetName ?? 'The model target',
          })
          return (
            <div
              className="linked-sweep"
              data-sweep-state={status.state}
              data-sweep-in-plane={props.frameReady ? String(!!props.targetVisible) : 'pending'}
              data-sweep-samples={sweep?.samples ?? 0}
              data-sweep-span={sweep?.span ?? 0}
            >
              <div role="status">
                <strong>{status.heading}</strong>
                <p data-sweep-in-plane-text>{status.inPlane}</p>
              </div>
              <p>{status.waiting}</p>
              {status.resetReason && <p data-sweep-reset-reason>{status.resetReason}</p>}
              {status.progress && (
                <p data-sweep-progress>
                  This pass so far: {status.progress.samples} of {status.progress.minSamples}{' '}
                  paused frames with the target, {status.progress.span}° of{' '}
                  {status.progress.minSpanDeg}° rotation. These are transient model samples for
                  this pass — not a score, a mastery measure or course progress.
                </p>
              )}
              <details>
                <summary>How this exercise counts a sweep</summary>
                <p>{SWEEP_TOLERANCE_NOTE}</p>
              </details>
            </div>
          )
        })()}
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
      {!concealed && (
        <p className="guided-label">
          Model revision {models?.manifest.version ?? '…'} · New semantic divisions and device
          additions await anatomical review.
        </p>
      )}
    </section>
  )
}
