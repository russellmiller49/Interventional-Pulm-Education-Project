import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  Raycaster,
  type Material,
  type Mesh,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

import {
  add,
  cross,
  detectorFrameForAngles,
  detectorFrameForSlicerProjection,
  dot,
  scale,
  smoothstep,
  subtract,
  type DetectorFrame,
} from './geometry'
import { ensureGroupAssignment, groupKeyForLabel } from './grouping'
import type {
  AppState,
  AssetTransform,
  FluoroConfig,
  PreparedSegment,
  RenderStats,
  SlicerFrontalProjection,
  Vec3,
} from './types'

const SOURCE_COLOR = 0xffffff

interface SegmentInstance {
  segment: PreparedSegment
  labelEl: HTMLElement | null
  materials: Material[]
  edgeHelpers: LineSegments[]
}

export class FluoroRenderer {
  readonly canvas: HTMLCanvasElement
  private readonly labelLayer: HTMLElement
  private readonly config: FluoroConfig
  private readonly renderer: WebGLRenderer
  private readonly scene: Scene
  private readonly camera: PerspectiveCamera
  private readonly root: Group
  private readonly calibrationProjection?: SlicerFrontalProjection
  private readonly sourcePosition = new Vector3()
  private readonly overlayCalibrationOffset = new Vector3()
  private readonly detectorNormal = new Vector3(0, 1, 0)
  private readonly pointer = new Vector2()
  private pointerActive = false
  private readonly tmpVec = new Vector3()
  private readonly tmpWorld = new Vector3()
  private readonly tmpNdc = new Vector3()
  private readonly tmpRay = new Vector3()
  private readonly raycaster = new Raycaster()
  private objectToInstance = new Map<Object3D, SegmentInstance>()
  private pickables: Object3D[] = []
  private lastCanvasWidth = 0
  private lastCanvasHeight = 0
  private lastPixelRatio = 0
  private assetScene: Object3D | null = null
  private assetBaseScale = 1000
  private assetBasePositionOffset: Vec3 = [0, 0, 0]

  private segments: PreparedSegment[] = []
  private instances: SegmentInstance[] = []

  constructor(options: {
    canvas: HTMLCanvasElement
    labelLayer: HTMLElement
    config: FluoroConfig
    calibrationProjection?: SlicerFrontalProjection
  }) {
    this.canvas = options.canvas
    this.labelLayer = options.labelLayer
    this.config = options.config
    this.calibrationProjection = options.calibrationProjection

    const fov = computeVerticalFov(options.config)
    this.camera = new PerspectiveCamera(
      fov,
      1,
      1,
      Math.max(4000, options.config.source_to_detector_mm * 4),
    )

    this.scene = new Scene()
    this.root = new Group()
    this.scene.add(this.root)

    addLights(this.scene)

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setClearColor(0x05070c, 0)

    this.applyDetectorFrame(this.frameForAngles(0, 0))
  }

  async loadGlb(
    path: string,
    options?: { dracoBaseUrl?: string; transform?: AssetTransform },
  ): Promise<PreparedSegment[]> {
    const { dracoBaseUrl = '/draco/', transform } = options ?? {}
    const loader = new GLTFLoader()
    const draco = new DRACOLoader()
    draco.setDecoderPath(ensureTrailingSlash(dracoBaseUrl))
    loader.setDRACOLoader(draco)

    const gltf = await loader.loadAsync(path)

    this.root.clear()
    this.labelLayer.innerHTML = ''
    this.instances = []
    this.pickables = []
    this.objectToInstance = new Map<Object3D, SegmentInstance>()
    this.assetScene = gltf.scene
    this.assetBaseScale = transform?.sceneScale ?? 1000
    this.assetBasePositionOffset = transform?.positionOffsetMm ?? [0, 0, 0]

    gltf.scene.scale.setScalar(this.assetBaseScale)
    if (transform?.rotationDeg) {
      gltf.scene.rotation.set(
        MathUtils.degToRad(transform.rotationDeg[0]),
        MathUtils.degToRad(transform.rotationDeg[1]),
        MathUtils.degToRad(transform.rotationDeg[2]),
      )
    }
    this.setModelAdjustment()
    gltf.scene.updateMatrixWorld(true)

    this.root.add(gltf.scene)

    const prepared: PreparedSegment[] = []

    for (const child of gltf.scene.children) {
      const mesh = findFirstMesh(child)
      if (!mesh) continue

      const label = child.name || mesh.name || 'Unnamed Segment'
      const color = extractColor(mesh)
      const colorRgb: [number, number, number] = [
        Math.round(color.r * 255),
        Math.round(color.g * 255),
        Math.round(color.b * 255),
      ]

      configureMaterials(child)
      const materials = collectMaterials(child)

      const anchor = getAnchor(child)
      const displayLabel = formatDisplayLabel(label)
      const segment: PreparedSegment = {
        label,
        displayLabel,
        color: `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`,
        colorRgb,
        groupKey: groupKeyForLabel(label),
        anchor: [anchor.x, anchor.y, anchor.z],
        meshSamplePointsLps: sampleMeshSurfacePointsLps(
          child,
          this.config.isocenter_mm,
          this.assetBasePositionOffset,
          /complete[_\s]?airway/i.test(label) ? 24000 : 1200,
        ),
        object: child,
      }

      // Don't create labels for full tree, full lobes, or generic lobe labels
      const interactive =
        !/complete[_\s]?airway|tree[_\s]?full|lobe[_\s]?\(full\)|lobe[_\s]?full|^(left|right)[_\s]+(upper|middle|lower)[_\s]+lobe[_\s]*$/i.test(
          label.toLowerCase(),
        )
      const labelEl = interactive ? document.createElement('div') : null
      if (labelEl) {
        labelEl.className = 'fluoro-segment-label'
        labelEl.style.borderColor = segment.color
        labelEl.textContent = segment.displayLabel
        this.labelLayer.appendChild(labelEl)
      }

      const instance: SegmentInstance = {
        segment,
        labelEl,
        materials,
        edgeHelpers: [],
      }
      this.instances.push(instance)

      if (interactive) {
        segment.object.traverse((obj) => {
          this.objectToInstance.set(obj, instance)
        })
        this.pickables.push(segment.object)
        instance.edgeHelpers = addEdgeHelpers(segment.object, color)
      }

      prepared.push(segment)
    }

    ensureGroupAssignment(prepared)
    this.segments = prepared

    return prepared
  }

  getSegments(): PreparedSegment[] {
    return this.segments
  }

  setModelAdjustment(options?: { offsetMm?: Vec3; scale?: number }) {
    if (!this.assetScene) return
    const offset = options?.offsetMm ?? [0, 0, 0]
    const scaleFactor = Number.isFinite(options?.scale) ? Math.max(0.1, options?.scale ?? 1) : 1
    this.assetScene.scale.setScalar(this.assetBaseScale * scaleFactor)
    this.assetScene.position.set(
      -this.config.isocenter_mm[0] + this.assetBasePositionOffset[0] + offset[0],
      -this.config.isocenter_mm[1] + this.assetBasePositionOffset[1] + offset[1],
      -this.config.isocenter_mm[2] + this.assetBasePositionOffset[2] + offset[2],
    )
    this.assetScene.updateMatrixWorld(true)
  }

  render(state: AppState): RenderStats {
    this.updateRendererSize()
    const overlayMode = state.overlayMode ?? 'surface'
    const overlayOpacity = MathUtils.clamp(state.overlayOpacity ?? 0.7, 0, 1)
    const frame = this.frameForAngles(state.raoLao, state.cranialCaudal)
    this.applyDetectorFrame(frame)
    const calibrationOffset = detectorLocalOffsetToLps(frame)
    this.overlayCalibrationOffset.set(
      calibrationOffset[0],
      calibrationOffset[1],
      calibrationOffset[2],
    )
    this.root.position.copy(this.overlayCalibrationOffset)
    this.root.rotation.set(0, 0, 0)
    this.root.updateMatrixWorld(true)

    let hovered: SegmentInstance | null = null
    if (this.pointerActive && state.showLabels) {
      this.raycaster.setFromCamera(this.pointer, this.camera)
      const hits = this.raycaster.intersectObjects(this.pickables, true)
      for (const hit of hits) {
        const instance = this.objectToInstance.get(hit.object)
        if (instance && state.activeGroups.has(instance.segment.groupKey)) {
          hovered = instance
          break
        }
      }
    }

    let visibleSegments = 0
    for (const instance of this.instances) {
      const { segment, labelEl, materials, edgeHelpers } = instance
      const isActive = state.activeGroups.has(segment.groupKey)
      segment.object.visible = isActive && overlayMode !== 'off'

      for (const helper of edgeHelpers) {
        const showWire =
          (state.useWireframe || overlayMode === 'wireframe' || overlayMode === 'centerline') &&
          isActive &&
          overlayMode !== 'off'
        helper.visible = showWire
        const lineMat = helper.material as LineBasicMaterial
        const targetEdgeOpacity = showWire ? 0.65 * overlayOpacity : 0
        if (lineMat.opacity !== targetEdgeOpacity) {
          lineMat.opacity = targetEdgeOpacity
          lineMat.needsUpdate = true
        }
      }

      const anchorLocal = this.tmpVec.set(segment.anchor[0], segment.anchor[1], segment.anchor[2])
      const worldAnchor = this.tmpWorld.copy(anchorLocal).applyMatrix4(this.root.matrixWorld)
      const rayDir = this.tmpRay.copy(worldAnchor).sub(this.sourcePosition).normalize()
      const depthWeight = smoothstep(0.35, 0.95, rayDir.dot(this.detectorNormal))

      for (const material of materials) {
        const solidOpacity = 0.82
        const minOpacity = state.useWireframe || overlayMode === 'wireframe' ? 0.12 : 0.35
        const surfaceOpacity =
          overlayMode === 'wireframe' || overlayMode === 'centerline' ? 0.12 : solidOpacity
        const targetOpacity =
          (state.useDts ? MathUtils.lerp(minOpacity, solidOpacity, depthWeight) : surfaceOpacity) *
          overlayOpacity
        if (material.opacity !== targetOpacity) {
          material.opacity = targetOpacity
          material.transparent = true
          material.needsUpdate = true
        }
        if ('depthWrite' in material && material.depthWrite !== false) {
          material.depthWrite = false
        }
      }

      if (labelEl) {
        labelEl.style.opacity = '0'
      }

      if (isActive) {
        visibleSegments += 1
      }
    }

    if (hovered && hovered.labelEl && state.showLabels && overlayMode !== 'off') {
      const { segment, labelEl } = hovered
      const anchor = this.tmpVec.set(segment.anchor[0], segment.anchor[1], segment.anchor[2])
      const world = this.tmpWorld.copy(anchor).applyMatrix4(this.root.matrixWorld)
      const ndc = this.tmpNdc.copy(world).project(this.camera)

      if (ndc.z >= -1 && ndc.z <= 1) {
        const layerRect = this.labelLayer.getBoundingClientRect()
        const canvasRect = this.canvas.getBoundingClientRect()
        const x = ((ndc.x + 1) / 2) * canvasRect.width
        const y = ((-ndc.y + 1) / 2) * canvasRect.height

        const left = canvasRect.left - layerRect.left + x
        const top = canvasRect.top - layerRect.top + y

        labelEl.style.left = `${left}px`
        labelEl.style.top = `${top}px`

        const rayDir = this.tmpVec.copy(world).sub(this.sourcePosition).normalize()
        const depthWeight = state.useDts
          ? smoothstep(0.4, 0.95, rayDir.dot(this.detectorNormal))
          : 1
        labelEl.style.opacity = depthWeight > 0.05 ? depthWeight.toFixed(2) : '0'
      }
    }

    this.renderer.render(this.scene, this.camera)
    return { visibleSegments }
  }

  private updateRendererSize() {
    const canvas = this.canvas
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    const dpr = window.devicePixelRatio ?? 1

    const needsResize =
      this.lastCanvasWidth !== width ||
      this.lastCanvasHeight !== height ||
      this.lastPixelRatio !== dpr

    if (needsResize) {
      this.renderer.setPixelRatio(dpr)
      this.renderer.setSize(width, height, false)
      this.labelLayer.style.width = `${width}px`
      this.labelLayer.style.height = `${height}px`
      this.lastCanvasWidth = width
      this.lastCanvasHeight = height
      this.lastPixelRatio = dpr
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
  }

  private frameForAngles(raoLaoDeg: number, cranialCaudalDeg: number): DetectorFrame {
    return this.calibrationProjection
      ? detectorFrameForSlicerProjection(
          this.config,
          this.calibrationProjection,
          raoLaoDeg,
          cranialCaudalDeg,
        )
      : detectorFrameForAngles(this.config, raoLaoDeg, cranialCaudalDeg)
  }

  private applyDetectorFrame(frame: DetectorFrame) {
    const sourceLocal = subtract(frame.sourceLps, this.config.isocenter_mm)
    const detectorCenterLocal = subtract(frame.detectorCenterLps, this.config.isocenter_mm)
    const sourceToDetectorMm = Math.max(
      1,
      dot(subtract(frame.detectorCenterLps, frame.sourceLps), frame.detectorNormalLps),
    )
    const nextFov =
      (2 * Math.atan(frame.detectorSizeMm[1] / 2 / sourceToDetectorMm) * 180) / Math.PI
    const cameraRight = cross(frame.detectorNormalLps, frame.detectorVAxisLps)
    const mirrorX = dot(cameraRight, frame.detectorUAxisLps) < 0

    this.camera.position.set(sourceLocal[0], sourceLocal[1], sourceLocal[2])
    this.camera.up.set(
      frame.detectorVAxisLps[0],
      frame.detectorVAxisLps[1],
      frame.detectorVAxisLps[2],
    )
    this.camera.lookAt(detectorCenterLocal[0], detectorCenterLocal[1], detectorCenterLocal[2])
    this.camera.fov = nextFov
    this.camera.updateProjectionMatrix()
    if (mirrorX) {
      this.camera.projectionMatrix.elements[0] *= -1
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert()
    }
    this.sourcePosition.set(sourceLocal[0], sourceLocal[1], sourceLocal[2])
    this.detectorNormal.set(
      frame.detectorNormalLps[0],
      frame.detectorNormalLps[1],
      frame.detectorNormalLps[2],
    )
  }

  setPointer(x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return this.clearPointer()
    }
    if (this.pointerActive && this.pointer.x === x && this.pointer.y === y) {
      return false
    }
    this.pointer.set(x, y)
    this.pointerActive = true
    return true
  }

  clearPointer(): boolean {
    if (!this.pointerActive) {
      return false
    }
    this.pointerActive = false
    return true
  }
}

function ensureTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`
}

function computeVerticalFov(config: FluoroConfig): number {
  const sid = config.source_to_detector_mm
  const detectorHeight = config.detector_pixels[1] * config.pixel_pitch_mm
  const halfHeight = detectorHeight / 2
  const fovRad = 2 * Math.atan(halfHeight / sid)
  return (fovRad * 180) / Math.PI
}

function detectorLocalOffsetToLps(frame: DetectorFrame): Vec3 {
  return add(
    add(
      scale(frame.detectorUAxisLps, frame.calibrationOffsetLocalMm[0]),
      scale(frame.detectorNormalLps, frame.calibrationOffsetLocalMm[1]),
    ),
    scale(frame.detectorVAxisLps, frame.calibrationOffsetLocalMm[2]),
  )
}

function addLights(scene: Scene) {
  const ambient = new AmbientLight(0xffffff, 0.55)
  scene.add(ambient)

  const key = new DirectionalLight(SOURCE_COLOR, 0.9)
  key.position.set(0, -800, 600)
  scene.add(key)

  const rim = new DirectionalLight(0xffffff, 0.4)
  rim.position.set(0, 400, -400)
  scene.add(rim)
}

function findFirstMesh(object: Object3D): Mesh | null {
  if ((object as Mesh).isMesh) {
    return object as Mesh
  }
  for (const child of object.children) {
    const mesh = findFirstMesh(child)
    if (mesh) return mesh
  }
  return null
}

function extractColor(mesh: Mesh): Color {
  const material = mesh.material
  if (Array.isArray(material)) {
    for (const mat of material) {
      if (hasMaterialColor(mat)) {
        return mat.color.clone()
      }
    }
  } else if (hasMaterialColor(material)) {
    return material.color.clone()
  }
  return new Color(0x4ba1ff)
}

function hasMaterialColor(material: Material): material is Material & { color: Color } {
  return 'color' in material && material.color instanceof Color
}

function configureMaterials(object: Object3D) {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of materials) {
        mat.side = DoubleSide
        mat.transparent = true
        mat.opacity = 0.68
        mat.depthWrite = false
        mat.toneMapped = false
      }
    }
  })
}

function collectMaterials(object: Object3D): Material[] {
  const materials: Material[] = []
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      if (Array.isArray(mesh.material)) {
        materials.push(...mesh.material)
      } else {
        materials.push(mesh.material)
      }
    }
  })
  return materials
}

function addEdgeHelpers(object: Object3D, baseColor: Color): LineSegments[] {
  const helpers: LineSegments[] = []
  const lineColor = baseColor.clone().lerp(new Color(0xffffff), 0.3)
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      const geometry = mesh.geometry
      const lineMaterial = new LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
      const edges = new LineSegments(new EdgesGeometry(geometry), lineMaterial)
      edges.visible = false
      mesh.add(edges)
      helpers.push(edges)
    }
  })
  return helpers
}

function getAnchor(object: Object3D): Vector3 {
  const box = new Box3().setFromObject(object)
  const center = new Vector3()
  box.getCenter(center)
  return center
}

function sampleMeshSurfacePointsLps(
  object: Object3D,
  isocenterMm: Vec3,
  positionOffsetMm: Vec3,
  maxPoints: number,
): Float32Array | undefined {
  const meshes: Mesh[] = []
  object.traverse((child) => {
    const mesh = child as Mesh
    const geometry = mesh.geometry
    if (geometry?.getAttribute?.('position')) {
      meshes.push(mesh)
    }
  })

  const totalVertices = meshes.reduce(
    (total, mesh) => total + mesh.geometry.getAttribute('position').count,
    0,
  )
  if (totalVertices === 0) return undefined

  const stride = Math.max(1, Math.ceil(totalVertices / Math.max(1, maxPoints)))
  const sampled: number[] = []
  const point = new Vector3()
  let ordinal = 0

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false)
    const position = mesh.geometry.getAttribute('position')
    for (let index = 0; index < position.count; index += 1) {
      if (ordinal % stride === 0) {
        point.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld)
        sampled.push(
          point.x + isocenterMm[0] - positionOffsetMm[0],
          point.y + isocenterMm[1] - positionOffsetMm[1],
          point.z + isocenterMm[2] - positionOffsetMm[2],
        )
      }
      ordinal += 1
    }
  }

  return sampled.length > 0 ? new Float32Array(sampled) : undefined
}

function formatDisplayLabel(raw: string): string {
  const normalized = raw
    .replace(/\.\d+$/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Override specific labels for correct anatomical terminology
  const labelOverrides: Record<string, string> = {
    'lingula lateral segment (lb4)': 'Lingula Superior Segment (LB4)',
    'lingula medial segment (lb5)': 'Lingula Inferior Segment (LB5)',
  }

  const lowerKey = normalized.toLowerCase()
  return labelOverrides[lowerKey] || normalized
}
