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
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  Raycaster,
  type Material,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

import { createRotationMatrix, smoothstep } from './geometry'
import { ensureGroupAssignment, groupKeyForLabel } from './grouping'
import type { AppState, FluoroConfig, Mat3, PreparedSegment, RenderStats } from './types'

const DETECTOR_NORMAL = new Vector3(0, 1, 0)
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
  private readonly sourcePosition = new Vector3()
  private readonly renderMatrix = new Matrix4()
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

  private segments: PreparedSegment[] = []
  private instances: SegmentInstance[] = []

  constructor(options: {
    canvas: HTMLCanvasElement
    labelLayer: HTMLElement
    config: FluoroConfig
  }) {
    this.canvas = options.canvas
    this.labelLayer = options.labelLayer
    this.config = options.config

    const fov = computeVerticalFov(options.config)
    this.camera = new PerspectiveCamera(fov, 1, 10, options.config.source_to_detector_mm * 1.2)
    this.camera.position.set(0, -options.config.source_to_isocenter_mm, 0)
    this.camera.up.set(0, 0, 1)
    this.camera.lookAt(0, 0, 0)

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

    this.sourcePosition.set(0, -options.config.source_to_isocenter_mm, 0)
  }

  async loadGlb(path: string, options?: { dracoBaseUrl?: string }): Promise<PreparedSegment[]> {
    const { dracoBaseUrl = '/draco/' } = options ?? {}
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

    gltf.scene.scale.setScalar(1000)
    gltf.scene.position.set(
      -this.config.isocenter_mm[0],
      -this.config.isocenter_mm[1],
      -this.config.isocenter_mm[2],
    )
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
        object: child,
      }

      // Don't create labels for full tree, full lobes, or generic lobe labels
      const interactive =
        !/tree[_\s]?full|lobe[_\s]?\(full\)|lobe[_\s]?full|^(left|right)[_\s]+(upper|middle|lower)[_\s]+lobe[_\s]*$/i.test(
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

  render(state: AppState): RenderStats {
    this.updateRendererSize()
    applyRotationToGroup(
      this.root,
      createRotationMatrix(-state.raoLao, -state.cranialCaudal),
      this.renderMatrix,
    )
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
      segment.object.visible = isActive

      for (const helper of edgeHelpers) {
        const showWire = state.useWireframe && isActive
        helper.visible = showWire
        const lineMat = helper.material as LineBasicMaterial
        const targetEdgeOpacity = showWire ? 0.55 : 0
        if (lineMat.opacity !== targetEdgeOpacity) {
          lineMat.opacity = targetEdgeOpacity
          lineMat.needsUpdate = true
        }
      }

      const anchorLocal = this.tmpVec.set(segment.anchor[0], segment.anchor[1], segment.anchor[2])
      const worldAnchor = this.tmpWorld.copy(anchorLocal).applyMatrix4(this.root.matrixWorld)
      const rayDir = this.tmpRay.copy(worldAnchor).sub(this.sourcePosition).normalize()
      const depthWeight = smoothstep(0.35, 0.95, rayDir.dot(DETECTOR_NORMAL))

      for (const material of materials) {
        if ('opacity' in material && 'transparent' in material) {
          const solidOpacity = 0.82
          const minOpacity = state.useWireframe ? 0.2 : 0.35
          const targetOpacity = state.useDts
            ? MathUtils.lerp(minOpacity, solidOpacity, depthWeight)
            : solidOpacity
          if ((material as any).opacity !== targetOpacity) {
            ;(material as any).opacity = targetOpacity
            ;(material as any).transparent = true
            material.needsUpdate = true
          }
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

    if (hovered && hovered.labelEl && state.showLabels) {
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
        const depthWeight = state.useDts ? smoothstep(0.4, 0.95, rayDir.dot(DETECTOR_NORMAL)) : 1
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

function applyRotationToGroup(group: Group, mat: Mat3, target: Matrix4) {
  target.set(
    mat[0][0],
    mat[0][1],
    mat[0][2],
    0,
    mat[1][0],
    mat[1][1],
    mat[1][2],
    0,
    mat[2][0],
    mat[2][1],
    mat[2][2],
    0,
    0,
    0,
    0,
    1,
  )
  group.setRotationFromMatrix(target)
}

function computeVerticalFov(config: FluoroConfig): number {
  const sid = config.source_to_isocenter_mm
  const detectorHeight = config.detector_pixels[1] * config.pixel_pitch_mm
  const halfHeight = detectorHeight / 2
  const fovRad = 2 * Math.atan(halfHeight / sid)
  return (fovRad * 180) / Math.PI
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
      if ((mat as any).color) {
        return ((mat as any).color as Color).clone()
      }
    }
  } else if ((material as any).color) {
    return ((material as any).color as Color).clone()
  }
  return new Color(0x4ba1ff)
}

function configureMaterials(object: Object3D) {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of materials) {
        if ('side' in mat) (mat as any).side = DoubleSide
        if ('transparent' in mat) (mat as any).transparent = true
        if ('opacity' in mat) (mat as any).opacity = 0.68
        if ('depthWrite' in mat) (mat as any).depthWrite = false
        if ('toneMapped' in mat) (mat as any).toneMapped = false
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

function formatDisplayLabel(raw: string): string {
  const normalized = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()

  // Override specific labels for correct anatomical terminology
  const labelOverrides: Record<string, string> = {
    'lingula lateral segment (lb4)': 'Lingula Superior Segment (LB4)',
    'lingula medial segment (lb5)': 'Lingula Inferior Segment (LB5)',
  }

  const lowerKey = normalized.toLowerCase()
  return labelOverrides[lowerKey] || normalized
}
