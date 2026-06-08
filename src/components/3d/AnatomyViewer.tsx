'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Camera, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, RefObject, WheelEvent } from 'react'
import type { AnatomyModel, AnatomySegment } from '@/lib/types'
import {
  applySegmentColors,
  computePlaneConstant,
  useAnatomyAsset,
  useVolumeAsset,
} from '@/lib/3d-utils'
import type { VolumeAssetState } from '@/lib/3d-utils'
import {
  AxesHelper,
  Box3,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Euler,
  LinearFilter,
  Line,
  LineBasicMaterial,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { Group, Mesh, Object3D } from 'three'
import type { WebGLRenderer } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type VolumeSlice from 'three/examples/jsm/misc/VolumeSlice.js'

const AXIS_LABELS: Record<'x' | 'y' | 'z', string> = {
  x: 'Sagittal',
  y: 'Coronal',
  z: 'Axial',
}

const ORTHOGONAL_AXES = ['z', 'y', 'x'] as const

type WindowPresetKey = 'default' | 'soft-tissue' | 'lung' | 'bone' | 'custom'
type ImmersiveXRMode = 'immersive-ar' | 'immersive-vr'
export type AnatomyAxis = (typeof ORTHOGONAL_AXES)[number]
export type OrthogonalClipMode = 'none' | 'hide-above' | 'hide-below'

const XR_CONTROL_CLIP_MODES: OrthogonalClipMode[] = ['none', 'hide-above', 'hide-below']
const XR_CONTROL_ACTION_KEY = 'xrControlAction'

interface CtAlignmentVector {
  x: number
  y: number
  z: number
}

export interface CtAlignmentConfig {
  translationMm: CtAlignmentVector
  rotationDegrees: CtAlignmentVector
  scale: number
  flip: Record<AnatomyAxis, boolean>
}

export interface CtSliceOrientationConfig {
  rotationDegrees: number
  flipHorizontal: boolean
  flipVertical: boolean
}

export type CtSliceOrientationByAxis = Record<AnatomyAxis, CtSliceOrientationConfig>

export interface AnatomySceneMetrics {
  modelCenter: [number, number, number]
  volumeCenterPatient: [number, number, number]
  suggestedCtTranslationMm: [number, number, number]
}

const DEFAULT_CT_PLANE_VISIBILITY: Record<AnatomyAxis, boolean> = {
  x: true,
  y: true,
  z: true,
}

export const DEFAULT_CT_ALIGNMENT: CtAlignmentConfig = {
  translationMm: { x: 0, y: 0, z: 0 },
  rotationDegrees: { x: 0, y: 0, z: 0 },
  scale: 1,
  flip: { x: false, y: false, z: false },
}

export const DEFAULT_CT_SLICE_ORIENTATION: CtSliceOrientationByAxis = {
  x: { rotationDegrees: 90, flipHorizontal: false, flipVertical: false },
  y: { rotationDegrees: 180, flipHorizontal: false, flipVertical: false },
  z: { rotationDegrees: 0, flipHorizontal: true, flipVertical: false },
}

function normalizeCtAlignment(alignment?: Partial<CtAlignmentConfig>): CtAlignmentConfig {
  return {
    translationMm: {
      ...DEFAULT_CT_ALIGNMENT.translationMm,
      ...alignment?.translationMm,
    },
    rotationDegrees: {
      ...DEFAULT_CT_ALIGNMENT.rotationDegrees,
      ...alignment?.rotationDegrees,
    },
    scale: alignment?.scale ?? DEFAULT_CT_ALIGNMENT.scale,
    flip: {
      ...DEFAULT_CT_ALIGNMENT.flip,
      ...alignment?.flip,
    },
  }
}

function normalizeCtSliceOrientation(
  orientation?: Partial<CtSliceOrientationByAxis>,
): CtSliceOrientationByAxis {
  return Object.fromEntries(
    ORTHOGONAL_AXES.map((axis) => [
      axis,
      {
        ...DEFAULT_CT_SLICE_ORIENTATION[axis],
        ...orientation?.[axis],
      },
    ]),
  ) as CtSliceOrientationByAxis
}

interface XRCapabilities {
  checked: boolean
  hasWebXR: boolean
  immersiveAR: boolean
  immersiveVR: boolean
}

interface SpatialPlacement {
  position: [number, number, number]
  scale: number
}

type VolumeSliceInfo = Record<AnatomyAxis, { index: number; total: number }>

interface ActiveGrab {
  controller: Group
  offset: Vector3
  inverseStartControllerQuaternion: Quaternion
  startModelQuaternion: Quaternion
}

type XRControlAction = () => void

type XRControlUserData = {
  [XR_CONTROL_ACTION_KEY]?: XRControlAction
  xrControlLabel?: string
}

const WINDOW_PRESET_MAP: Record<
  Exclude<WindowPresetKey, 'default' | 'custom'>,
  { low: number; high: number; label: string }
> = {
  'soft-tissue': { label: 'Soft Tissue', low: -160, high: 240 },
  lung: { label: 'Lung', low: -1000, high: -300 },
  bone: { label: 'Bone', low: 200, high: 2000 },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sliceIndexToPercent(index: number, totalSlices: number): number {
  if (totalSlices <= 1) {
    return 0
  }
  return (clamp(index, 0, totalSlices - 1) / (totalSlices - 1)) * 100
}

function createEmptyVolumeSliceInfo(): VolumeSliceInfo {
  return {
    x: { index: 0, total: 0 },
    y: { index: 0, total: 0 },
    z: { index: 0, total: 0 },
  }
}

function createEmptyWheelRemainders(): Record<AnatomyAxis, number> {
  return {
    x: 0,
    y: 0,
    z: 0,
  }
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}

function getSliceTransform(
  axis: AnatomyAxis,
  orientation = DEFAULT_CT_SLICE_ORIENTATION[axis],
): string {
  const transforms: string[] = []
  const rotation = Number.isFinite(orientation.rotationDegrees)
    ? orientation.rotationDegrees % 360
    : 0
  if (rotation !== 0) {
    transforms.push(`rotate(${rotation}deg)`)
  }
  if (orientation.flipHorizontal || orientation.flipVertical) {
    transforms.push(
      `scale(${orientation.flipHorizontal ? -1 : 1}, ${orientation.flipVertical ? -1 : 1})`,
    )
  }
  return transforms.join(' ') || 'none'
}

function styleVolumeSliceCanvas(
  slice: VolumeSlice,
  axis: AnatomyAxis,
  orientation?: CtSliceOrientationConfig,
) {
  slice.canvas.style.width = '100%'
  slice.canvas.style.height = '100%'
  slice.canvas.style.display = 'block'
  slice.canvas.style.maxWidth = '100%'
  slice.canvas.style.maxHeight = '100%'
  slice.canvas.style.objectFit = 'contain'
  slice.canvas.style.background = '#000'
  slice.canvas.style.transformOrigin = 'center center'
  slice.canvas.style.transform = getSliceTransform(axis, orientation)
}

function isRenderableVolumeSlice(slice: VolumeSlice | null): slice is VolumeSlice {
  const candidate = slice as (VolumeSlice & { iLength?: number; jLength?: number }) | null
  return Boolean(
    candidate?.canvas &&
    candidate.canvas.width > 0 &&
    candidate.canvas.height > 0 &&
    (candidate.iLength ?? 0) > 0 &&
    (candidate.jLength ?? 0) > 0,
  )
}

function computeSpatialPlacement(boundingBox: Box3): SpatialPlacement {
  const size = boundingBox.getSize(new Vector3())
  const center = boundingBox.getCenter(new Vector3())
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
  const scale = Math.min(Math.max(1.05 / maxDimension, 0.001), 12)

  return {
    position: [-center.x * scale, 1.28 - center.y * scale, -1.35 - center.z * scale],
    scale,
  }
}

function getAxisIndex(axis: AnatomyAxis) {
  return axis === 'x' ? 0 : axis === 'y' ? 1 : 2
}

function getSliceIndex(percentage: number, totalSlices: number) {
  return clamp(
    Math.round((clamp(percentage, 0, 100) / 100) * (totalSlices - 1)),
    0,
    totalSlices - 1,
  )
}

function matrixFromRowMajor(values: readonly number[] | undefined): Matrix4 | null {
  if (!values || values.length !== 16 || values.some((value) => !Number.isFinite(value))) {
    return null
  }
  return new Matrix4().set(
    values[0],
    values[1],
    values[2],
    values[3],
    values[4],
    values[5],
    values[6],
    values[7],
    values[8],
    values[9],
    values[10],
    values[11],
    values[12],
    values[13],
    values[14],
    values[15],
  )
}

function getPatientToModelMatrix(group: Group, model: AnatomyModel) {
  group.updateMatrixWorld(true)
  const configuredMatrix = matrixFromRowMajor(model.volume?.patientToModelMatrix)
  if (configuredMatrix) {
    return group.matrixWorld.clone().multiply(configuredMatrix)
  }

  let firstMesh: Mesh | null = null
  group.traverse((child) => {
    if (!firstMesh && (child as Mesh).isMesh) {
      firstMesh = child as Mesh
    }
  })
  const mesh = firstMesh as Mesh | null
  return mesh ? mesh.matrixWorld.clone() : null
}

function getVolumeCenterPatientPoint(
  volumeState: Extract<VolumeAssetState, { status: 'success' }>,
  volumeCenterPatientMm?: readonly [number, number, number],
) {
  if (volumeCenterPatientMm?.every((value) => Number.isFinite(value))) {
    return new Vector3(volumeCenterPatientMm[0], volumeCenterPatientMm[1], volumeCenterPatientMm[2])
  }

  return new Vector3(
    volumeState.origin[0] + (volumeState.dimensions[0] - 1) / 2,
    volumeState.origin[1] + (volumeState.dimensions[1] - 1) / 2,
    volumeState.origin[2] + (volumeState.dimensions[2] - 1) / 2,
  )
}

function getCtAlignmentMatrix(ctAlignment: CtAlignmentConfig = DEFAULT_CT_ALIGNMENT) {
  const scale = Number.isFinite(ctAlignment.scale) ? ctAlignment.scale : 1
  const scaleMatrix = new Matrix4().makeScale(
    scale * (ctAlignment.flip.x ? -1 : 1),
    scale * (ctAlignment.flip.y ? -1 : 1),
    scale * (ctAlignment.flip.z ? -1 : 1),
  )
  const rotationMatrix = new Matrix4().makeRotationFromEuler(
    new Euler(
      degreesToRadians(ctAlignment.rotationDegrees.x),
      degreesToRadians(ctAlignment.rotationDegrees.y),
      degreesToRadians(ctAlignment.rotationDegrees.z),
      'XYZ',
    ),
  )
  const translationMatrix = new Matrix4().makeTranslation(
    ctAlignment.translationMm.x,
    ctAlignment.translationMm.y,
    ctAlignment.translationMm.z,
  )

  return translationMatrix.multiply(rotationMatrix).multiply(scaleMatrix)
}

function getCenteredVolumeToPatientMatrix(
  volumeState: Extract<VolumeAssetState, { status: 'success' }>,
  ctAlignment: CtAlignmentConfig = DEFAULT_CT_ALIGNMENT,
  volumeCenterPatientMm?: readonly [number, number, number],
) {
  const center = getVolumeCenterPatientPoint(volumeState, volumeCenterPatientMm)
  const centeredVolumeToPatient = new Matrix4().makeTranslation(center.x, center.y, center.z)
  const alignmentMatrix = getCtAlignmentMatrix(ctAlignment)
  const volumeSpaceToPatient =
    volumeState.space === 'left-posterior-superior'
      ? new Matrix4().makeScale(-1, -1, 1)
      : new Matrix4().identity()

  return centeredVolumeToPatient.multiply(alignmentMatrix).multiply(volumeSpaceToPatient)
}

function getVolumeToModelMatrix(
  patientToModelMatrix: Matrix4,
  volumeState: Extract<VolumeAssetState, { status: 'success' }>,
  ctAlignment: CtAlignmentConfig = DEFAULT_CT_ALIGNMENT,
  volumeCenterPatientMm?: readonly [number, number, number],
) {
  return patientToModelMatrix
    .clone()
    .multiply(getCenteredVolumeToPatientMatrix(volumeState, ctAlignment, volumeCenterPatientMm))
}

function getVolumePlanePoint(
  axis: AnatomyAxis,
  percentage: number,
  dimensions: [number, number, number],
) {
  const axisIndex = getAxisIndex(axis)
  const totalSlices = Math.max(1, Math.floor(dimensions[axisIndex] ?? 1))
  const targetIndex = getSliceIndex(percentage, totalSlices)
  const point = new Vector3()
  point[axis] = targetIndex - (dimensions[axisIndex] - 1) / 2
  return point
}

function getVolumePlaneNormal(axis: AnatomyAxis) {
  const normal = new Vector3()
  normal[axis] = 1
  return normal
}

function createVolumeClippingPlane({
  axis,
  mode,
  percentage,
  volumeState,
  volumeToModelMatrix,
}: {
  axis: AnatomyAxis
  mode: Exclude<OrthogonalClipMode, 'none'>
  percentage: number
  volumeState: Extract<VolumeAssetState, { status: 'success' }>
  volumeToModelMatrix: Matrix4
}) {
  const point = getVolumePlanePoint(axis, percentage, volumeState.dimensions).applyMatrix4(
    volumeToModelMatrix,
  )
  const normal = getVolumePlaneNormal(axis).transformDirection(volumeToModelMatrix)
  const clippingNormal = mode === 'hide-above' ? normal.negate() : normal

  return new Plane().setFromNormalAndCoplanarPoint(clippingNormal, point)
}

function removeVolumeSliceFromList(slice: VolumeSlice) {
  const sliceList = slice.volume.sliceList as VolumeSlice[] | undefined
  if (!sliceList) {
    return
  }
  const index = sliceList.indexOf(slice)
  if (index >= 0) {
    sliceList.splice(index, 1)
  }
}

function disposeVolumeSlice(slice: VolumeSlice) {
  removeVolumeSliceFromList(slice)
  slice.mesh.geometry.dispose()
  const materials = Array.isArray(slice.mesh.material) ? slice.mesh.material : [slice.mesh.material]
  materials.forEach((material) => {
    if (material instanceof MeshBasicMaterial) {
      material.map?.dispose()
    }
    material.dispose()
  })
}

function setVolumePlaneOpacity(slice: VolumeSlice, opacity: number) {
  const materials = Array.isArray(slice.mesh.material) ? slice.mesh.material : [slice.mesh.material]
  materials.forEach((material) => {
    material.transparent = true
    material.opacity = opacity
    material.depthWrite = false
    material.needsUpdate = true
  })
}

function OrthogonalVolumePlane({
  axis,
  ctAlignment,
  opacity,
  patientToModelMatrix,
  percentage,
  volumeCenterPatientMm,
  volumeState,
}: {
  axis: AnatomyAxis
  ctAlignment: CtAlignmentConfig
  opacity: number
  patientToModelMatrix: Matrix4
  percentage: number
  volumeCenterPatientMm?: [number, number, number]
  volumeState: Extract<VolumeAssetState, { status: 'success' }>
}) {
  const axisIndex = getAxisIndex(axis)
  const totalSlices = Math.max(1, Math.floor(volumeState.dimensions[axisIndex] ?? 1))
  const targetIndex = getSliceIndex(percentage, totalSlices)

  const slice = useMemo(() => {
    const nextSlice = volumeState.volume.extractSlice(axis, targetIndex)
    nextSlice.index = targetIndex
    nextSlice.mesh.name = `${AXIS_LABELS[axis]} CT plane`
    nextSlice.mesh.matrixAutoUpdate = false
    nextSlice.mesh.renderOrder = 8
    setVolumePlaneOpacity(nextSlice, opacity)
    nextSlice.repaint()
    return nextSlice
  }, [axis, opacity, targetIndex, volumeState.volume])

  useEffect(() => {
    return () => {
      disposeVolumeSlice(slice)
    }
  }, [slice, volumeState.volume])

  const volumeToModelMatrix = useMemo(
    () =>
      getVolumeToModelMatrix(patientToModelMatrix, volumeState, ctAlignment, volumeCenterPatientMm),
    [ctAlignment, patientToModelMatrix, volumeCenterPatientMm, volumeState],
  )

  return (
    <group matrix={volumeToModelMatrix} matrixAutoUpdate={false}>
      <primitive object={slice.mesh} visible={opacity > 0} />
    </group>
  )
}

function OrthogonalVolumePlanes({
  ctAlignment,
  opacity,
  patientToModelMatrix,
  planeSlices,
  planeVisibility,
  showPlanes,
  volumeCenterPatientMm,
  volumeState,
  windowKey,
}: {
  ctAlignment: CtAlignmentConfig
  opacity: number
  patientToModelMatrix: Matrix4 | null
  planeSlices: Record<AnatomyAxis, number>
  planeVisibility: Record<AnatomyAxis, boolean>
  showPlanes: boolean
  volumeCenterPatientMm?: [number, number, number]
  volumeState: VolumeAssetState
  windowKey: string
}) {
  if (!showPlanes || volumeState.status !== 'success' || !patientToModelMatrix) {
    return null
  }

  return (
    <>
      {ORTHOGONAL_AXES.map((axis) =>
        planeVisibility[axis] ? (
          <OrthogonalVolumePlane
            key={`${axis}-${windowKey}`}
            axis={axis}
            ctAlignment={ctAlignment}
            opacity={opacity}
            patientToModelMatrix={patientToModelMatrix}
            percentage={planeSlices[axis]}
            volumeCenterPatientMm={volumeCenterPatientMm}
            volumeState={volumeState}
          />
        ) : null,
      )}
    </>
  )
}

function applySpatialPlacement(group: Group, placement: SpatialPlacement) {
  group.position.set(...placement.position)
  group.scale.setScalar(placement.scale)
  group.quaternion.identity()
}

function resetDesktopPlacement(group: Group) {
  group.position.set(0, 0, 0)
  group.scale.setScalar(1)
  group.quaternion.identity()
}

function createControllerRay() {
  const geometry = new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, -1)])
  const material = new LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  })
  const ray = new Line(geometry, material)
  ray.name = 'XR select ray'
  ray.scale.z = 1.6
  return ray
}

function getControllerTransform(controller: Group) {
  controller.updateMatrixWorld(true)
  const position = new Vector3().setFromMatrixPosition(controller.matrixWorld)
  const rotation = new Matrix4().extractRotation(controller.matrixWorld)
  const quaternion = new Quaternion().setFromRotationMatrix(rotation)
  return { position, quaternion, rotation }
}

function isObjectAndAncestorsVisible(object: Object3D) {
  let current: Object3D | null = object
  while (current) {
    if (!current.visible) {
      return false
    }
    current = current.parent
  }
  return true
}

function collectVisibleMeshes(root: Object3D) {
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh && isObjectAndAncestorsVisible(object)) {
      meshes.push(object as Mesh)
    }
  })
  return meshes
}

function getXRControlAction(object: Object3D): XRControlAction | null {
  let current: Object3D | null = object
  while (current) {
    const userData = current.userData as XRControlUserData
    if (typeof userData[XR_CONTROL_ACTION_KEY] === 'function') {
      return userData[XR_CONTROL_ACTION_KEY]!
    }
    current = current.parent
  }
  return null
}

function getSegmentLabel(object: Object3D) {
  let current: Object3D | null = object
  while (current) {
    if (typeof current.userData.segmentLabel === 'string') {
      return current.userData.segmentLabel
    }
    if (typeof current.userData.segmentId === 'string') {
      return current.userData.segmentId
    }
    current = current.parent
  }
  return object.name || 'Anatomy segment'
}

function formatXRPercent(value: number) {
  return `${Math.round(clamp(value, 0, 100))}%`
}

function getClipModeLabel(mode: OrthogonalClipMode) {
  if (mode === 'hide-above') {
    return 'Hide above'
  }
  if (mode === 'hide-below') {
    return 'Hide below'
  }
  return 'Clip off'
}

function reactTextToString(value: ReactNode): string {
  if (Array.isArray(value)) {
    return value.map(reactTextToString).join('')
  }
  if (value === null || value === undefined || typeof value === 'boolean') {
    return ''
  }
  return String(value)
}

function XRTextPlane({
  align = 'center',
  color = '#f8fafc',
  fontSize = 42,
  fontWeight = 600,
  height,
  position,
  text,
  width,
}: {
  align?: CanvasTextAlign
  color?: string
  fontSize?: number
  fontWeight?: number
  height: number
  position: [number, number, number]
  text: string
  width: number
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = color
      context.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      context.textAlign = align
      context.textBaseline = 'middle'
      const padding = 32
      const x =
        align === 'left' ? padding : align === 'right' ? canvas.width - padding : canvas.width / 2
      context.fillText(text, x, canvas.height / 2, canvas.width - padding * 2)
    }

    const nextTexture = new CanvasTexture(canvas)
    nextTexture.colorSpace = SRGBColorSpace
    nextTexture.minFilter = LinearFilter
    nextTexture.magFilter = LinearFilter
    nextTexture.needsUpdate = true
    return nextTexture
  }, [align, color, fontSize, fontWeight, text])

  useEffect(() => {
    return () => {
      texture.dispose()
    }
  }, [texture])

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial depthWrite={false} map={texture} side={DoubleSide} transparent />
    </mesh>
  )
}

function XRControlButton({
  disabled = false,
  label,
  onSelect,
  position,
  selected = false,
  size = [0.26, 0.08],
}: {
  disabled?: boolean
  label: string
  onSelect?: XRControlAction
  position: [number, number, number]
  selected?: boolean
  size?: [number, number]
}) {
  const buttonRef = useRef<Group | null>(null)

  useEffect(() => {
    const button = buttonRef.current
    if (!button) {
      return
    }

    const userData = button.userData as XRControlUserData
    userData.xrControlLabel = label
    if (disabled || !onSelect) {
      delete userData[XR_CONTROL_ACTION_KEY]
    } else {
      userData[XR_CONTROL_ACTION_KEY] = onSelect
    }

    return () => {
      delete userData[XR_CONTROL_ACTION_KEY]
      delete userData.xrControlLabel
    }
  }, [disabled, label, onSelect])

  const backgroundColor = disabled ? '#1e293b' : selected ? '#67e8f9' : '#0f172a'
  const borderColor = disabled ? '#334155' : selected ? '#a5f3fc' : '#475569'
  const textColor = disabled ? '#64748b' : selected ? '#082f49' : '#f8fafc'

  return (
    <group ref={buttonRef} position={position}>
      <mesh>
        <planeGeometry args={size} />
        <meshBasicMaterial
          color={backgroundColor}
          opacity={disabled ? 0.5 : 0.94}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <planeGeometry args={[size[0] + 0.006, size[1] + 0.006]} />
        <meshBasicMaterial
          color={borderColor}
          opacity={selected ? 0.24 : 0.14}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <XRTextPlane
        color={textColor}
        fontSize={42}
        height={size[1] * 0.58}
        position={[0, 0, 0.012]}
        text={label}
        width={size[0] * 0.88}
      />
    </group>
  )
}

function XRControlLabel({
  children,
  position,
  size = 0.024,
}: {
  children: ReactNode
  position: [number, number, number]
  size?: number
}) {
  const width = 0.74
  const height = Math.max(size * 2.25, 0.044)

  return (
    <XRTextPlane
      align="left"
      color="#cbd5e1"
      fontSize={Math.max(Math.round(size * 1600), 30)}
      fontWeight={size >= 0.03 ? 700 : 600}
      height={height}
      position={[position[0] + width / 2, position[1], position[2]]}
      text={reactTextToString(children)}
      width={width}
    />
  )
}

function XRControlPanel({
  activeAxis,
  crossSection,
  ctClipAxis,
  ctClipMode,
  ctPlaneOpacity,
  ctPlaneSlices,
  ctPlaneVisibility,
  panelRef,
  showCtPlanes,
  visible,
  volumeAvailable,
  onActiveAxisChange,
  onCycleClipMode,
  onStepCrossSection,
  onStepCtPlaneOpacity,
  onStepCtPlaneSlice,
  onToggleActivePlane,
  onToggleCtPlanes,
}: {
  activeAxis: AnatomyAxis
  crossSection: number
  ctClipAxis: AnatomyAxis
  ctClipMode: OrthogonalClipMode
  ctPlaneOpacity: number
  ctPlaneSlices: Record<AnatomyAxis, number>
  ctPlaneVisibility: Record<AnatomyAxis, boolean>
  panelRef: RefObject<Group | null>
  showCtPlanes: boolean
  visible: boolean
  volumeAvailable: boolean
  onActiveAxisChange?: (axis: AnatomyAxis) => void
  onCycleClipMode?: () => void
  onStepCrossSection?: (delta: number) => void
  onStepCtPlaneOpacity?: (delta: number) => void
  onStepCtPlaneSlice?: (axis: AnatomyAxis, delta: number) => void
  onToggleActivePlane?: (axis: AnatomyAxis) => void
  onToggleCtPlanes?: () => void
}) {
  const { camera } = useThree()
  const activeSlice = ctPlaneSlices[activeAxis] ?? 0
  const activePlaneVisible = ctPlaneVisibility[activeAxis] ?? true

  useFrame(() => {
    if (!visible || !panelRef.current) {
      return
    }
    panelRef.current.lookAt(camera.position)
  })

  return (
    <group ref={panelRef} position={[0.86, 1.42, -1.28]} visible={visible}>
      <mesh position={[0, 0, -0.008]}>
        <planeGeometry args={[1.08, 0.92]} />
        <meshBasicMaterial color="#020617" opacity={0.9} side={DoubleSide} transparent />
      </mesh>
      <XRControlLabel position={[-0.49, 0.39, 0.012]} size={0.032}>
        VR anatomy controls
      </XRControlLabel>
      <XRControlLabel position={[-0.49, 0.33, 0.012]} size={0.019}>
        Select a button with the controller ray
      </XRControlLabel>

      <XRControlLabel position={[-0.49, 0.23, 0.012]}>
        Cut plane {formatXRPercent(crossSection)}
      </XRControlLabel>
      <XRControlButton
        disabled={!onStepCrossSection}
        label="-10"
        onSelect={() => onStepCrossSection?.(-10)}
        position={[0.21, 0.23, 0.014]}
        size={[0.17, 0.075]}
      />
      <XRControlButton
        disabled={!onStepCrossSection}
        label="+10"
        onSelect={() => onStepCrossSection?.(10)}
        position={[0.41, 0.23, 0.014]}
        size={[0.17, 0.075]}
      />

      <XRControlLabel position={[-0.49, 0.11, 0.012]}>
        CT planes{' '}
        {volumeAvailable
          ? `${showCtPlanes ? 'on' : 'off'} ${Math.round(ctPlaneOpacity * 100)}%`
          : 'unavailable'}
      </XRControlLabel>
      <XRControlButton
        disabled={!volumeAvailable || !onToggleCtPlanes}
        label={showCtPlanes ? 'Hide' : 'Show'}
        onSelect={onToggleCtPlanes}
        position={[0.12, 0.11, 0.014]}
        selected={showCtPlanes}
        size={[0.19, 0.075]}
      />
      <XRControlButton
        disabled={!volumeAvailable || !onStepCtPlaneOpacity}
        label="Opacity -"
        onSelect={() => onStepCtPlaneOpacity?.(-0.1)}
        position={[0.32, 0.11, 0.014]}
        size={[0.19, 0.075]}
      />
      <XRControlButton
        disabled={!volumeAvailable || !onStepCtPlaneOpacity}
        label="Opacity +"
        onSelect={() => onStepCtPlaneOpacity?.(0.1)}
        position={[0.52, 0.11, 0.014]}
        size={[0.19, 0.075]}
      />

      <XRControlLabel position={[-0.49, -0.01, 0.012]}>Plane axis</XRControlLabel>
      {ORTHOGONAL_AXES.map((axis, index) => (
        <XRControlButton
          key={axis}
          disabled={!volumeAvailable || !onActiveAxisChange}
          label={AXIS_LABELS[axis]}
          onSelect={() => onActiveAxisChange?.(axis)}
          position={[-0.12 + index * 0.22, -0.01, 0.014]}
          selected={axis === activeAxis}
          size={[0.2, 0.075]}
        />
      ))}

      <XRControlLabel position={[-0.49, -0.13, 0.012]}>
        {AXIS_LABELS[activeAxis]} slice {formatXRPercent(activeSlice)}
      </XRControlLabel>
      <XRControlButton
        disabled={!volumeAvailable || !onStepCtPlaneSlice}
        label="-5"
        onSelect={() => onStepCtPlaneSlice?.(activeAxis, -5)}
        position={[0.12, -0.13, 0.014]}
        size={[0.15, 0.075]}
      />
      <XRControlButton
        disabled={!volumeAvailable || !onStepCtPlaneSlice}
        label="+5"
        onSelect={() => onStepCtPlaneSlice?.(activeAxis, 5)}
        position={[0.3, -0.13, 0.014]}
        size={[0.15, 0.075]}
      />
      <XRControlButton
        disabled={!volumeAvailable || !onToggleActivePlane}
        label={activePlaneVisible ? 'Axis on' : 'Axis off'}
        onSelect={() => onToggleActivePlane?.(activeAxis)}
        position={[0.5, -0.13, 0.014]}
        selected={activePlaneVisible}
        size={[0.19, 0.075]}
      />

      <XRControlLabel position={[-0.49, -0.25, 0.012]}>
        Clipping {getClipModeLabel(ctClipMode)}
      </XRControlLabel>
      <XRControlButton
        disabled={!volumeAvailable || !onCycleClipMode}
        label="Cycle mode"
        onSelect={onCycleClipMode}
        position={[0.17, -0.25, 0.014]}
        selected={ctClipMode !== 'none'}
        size={[0.27, 0.075]}
      />
      <XRControlLabel position={[0.34, -0.25, 0.012]} size={0.02}>
        {ctClipMode === 'none' ? '' : AXIS_LABELS[ctClipAxis]}
      </XRControlLabel>

      <XRControlLabel position={[-0.49, -0.37, 0.012]} size={0.019}>
        Squeeze still recenters the model
      </XRControlLabel>
    </group>
  )
}

function XRSpatialControllers({
  controlRootRef,
  enabled,
  targetRef,
  placement,
  onSelectSegment,
}: {
  controlRootRef?: RefObject<Group | null>
  enabled: boolean
  targetRef: RefObject<Group | null>
  placement: SpatialPlacement | null
  onSelectSegment: (label: string | null) => void
}) {
  const { gl, scene } = useThree()
  const activeGrabRef = useRef<ActiveGrab | null>(null)
  const raycasterRef = useRef(new Raycaster())

  useEffect(() => {
    if (!enabled) {
      activeGrabRef.current = null
      return
    }

    const controllers = [gl.xr.getController(0), gl.xr.getController(1)]
    const rays = controllers.map(() => createControllerRay())

    const beginGrab = (controller: Group) => {
      const target = targetRef.current
      if (!target) {
        return
      }

      const { position, quaternion, rotation } = getControllerTransform(controller)
      const raycaster = raycasterRef.current
      raycaster.ray.origin.copy(position)
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation)

      const controlRoot = controlRootRef?.current
      if (controlRoot) {
        const controlIntersections = raycaster.intersectObjects(
          collectVisibleMeshes(controlRoot),
          false,
        )
        const controlAction = controlIntersections.length
          ? getXRControlAction(controlIntersections[0].object)
          : null
        if (controlIntersections.length) {
          controlAction?.()
          return
        }
      }

      const intersections = raycaster.intersectObjects(collectVisibleMeshes(target), false)
      if (!intersections.length) {
        return
      }

      onSelectSegment(getSegmentLabel(intersections[0].object))
      activeGrabRef.current = {
        controller,
        offset: target.position.clone().sub(position),
        inverseStartControllerQuaternion: quaternion.clone().invert(),
        startModelQuaternion: target.quaternion.clone(),
      }
    }

    const endGrab = (controller: Group) => {
      if (activeGrabRef.current?.controller === controller) {
        activeGrabRef.current = null
      }
    }

    const resetPlacement = () => {
      const target = targetRef.current
      if (!target || !placement) {
        return
      }
      applySpatialPlacement(target, placement)
      activeGrabRef.current = null
      onSelectSegment('Spatial placement reset')
    }

    const cleanupHandlers: Array<() => void> = []

    controllers.forEach((controller, index) => {
      const ray = rays[index]
      controller.add(ray)
      scene.add(controller)

      const handleSelectStart = () => beginGrab(controller)
      const handleSelectEnd = () => endGrab(controller)
      const handleSqueezeStart = () => resetPlacement()

      controller.addEventListener('selectstart', handleSelectStart)
      controller.addEventListener('selectend', handleSelectEnd)
      controller.addEventListener('squeezestart', handleSqueezeStart)

      cleanupHandlers.push(() => {
        controller.removeEventListener('selectstart', handleSelectStart)
        controller.removeEventListener('selectend', handleSelectEnd)
        controller.removeEventListener('squeezestart', handleSqueezeStart)
        controller.remove(ray)
        scene.remove(controller)
        ray.geometry.dispose()
        ;(ray.material as LineBasicMaterial).dispose()
      })
    })

    return () => {
      activeGrabRef.current = null
      cleanupHandlers.forEach((cleanup) => cleanup())
    }
  }, [controlRootRef, enabled, gl, onSelectSegment, placement, scene, targetRef])

  useFrame(() => {
    if (!enabled) {
      return
    }

    const grab = activeGrabRef.current
    const target = targetRef.current
    if (!grab || !target) {
      return
    }

    const { position, quaternion } = getControllerTransform(grab.controller)
    target.position.copy(position).add(grab.offset)
    const controllerDelta = quaternion.multiply(grab.inverseStartControllerQuaternion)
    target.quaternion.copy(controllerDelta.multiply(grab.startModelQuaternion))
  })

  return null
}

export interface AnatomyViewerProps {
  model: AnatomyModel
  visibleSegments: Record<string, boolean>
  crossSection: number
  volumeSlice: number
  showCtPlanes?: boolean
  ctPlaneVisibility?: Record<AnatomyAxis, boolean>
  ctPlaneSlices?: Record<AnatomyAxis, number>
  ctPlaneOpacity?: number
  ctClipMode?: OrthogonalClipMode
  ctClipAxis?: AnatomyAxis
  ctAlignment?: CtAlignmentConfig
  ctSliceOrientation?: CtSliceOrientationByAxis
  showAnnotations: boolean
  resetSignal: number
  showDebugHelpers?: boolean
  rotation?: { x: number; y: number; z: number }
  controlPanel?: ReactNode
  onScreenshot?: (dataUrl: string) => void
  onError?: (message: string) => void
  onSceneMetrics?: (metrics: AnatomySceneMetrics | null) => void
  onSegmentsChanged?: (segments: AnatomySegment[]) => void
  onCrossSectionChange?: (value: number) => void
  onShowCtPlanesChange?: (visible: boolean) => void
  onCtPlaneVisibilityChange?: (axis: AnatomyAxis, visible: boolean) => void
  onCtPlaneSliceChange?: (axis: AnatomyAxis, value: number) => void
  onCtPlaneOpacityChange?: (value: number) => void
  onCtClipModeChange?: (mode: OrthogonalClipMode) => void
  onCtClipAxisChange?: (axis: AnatomyAxis) => void
  onVolumeSliceChange?: (value: number) => void
}

export function AnatomyViewer({
  model,
  visibleSegments,
  crossSection,
  volumeSlice,
  showCtPlanes = false,
  ctPlaneVisibility = DEFAULT_CT_PLANE_VISIBILITY,
  ctPlaneSlices,
  ctPlaneOpacity = 0.3,
  ctClipMode = 'none',
  ctClipAxis = 'z',
  ctAlignment,
  ctSliceOrientation,
  showAnnotations,
  resetSignal,
  showDebugHelpers = false,
  rotation = { x: 0, y: 0, z: 0 },
  controlPanel,
  onScreenshot,
  onError,
  onSceneMetrics,
  onSegmentsChanged,
  onCrossSectionChange,
  onShowCtPlanesChange,
  onCtPlaneVisibilityChange,
  onCtPlaneSliceChange,
  onCtPlaneOpacityChange,
  onCtClipModeChange,
  onCtClipAxisChange,
  onVolumeSliceChange,
}: AnatomyViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const glRef = useRef<WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const spatialRootRef = useRef<Group | null>(null)
  const xrControlPanelRef = useRef<Group | null>(null)
  const assetState = useAnatomyAsset(model)
  const volumeState = useVolumeAsset(model)
  const effectiveCtAlignment = useMemo(
    () => normalizeCtAlignment(ctAlignment ?? model.volume?.ctAlignment),
    [ctAlignment, model.volume?.ctAlignment],
  )
  const effectiveCtSliceOrientation = useMemo(
    () => normalizeCtSliceOrientation(ctSliceOrientation ?? model.volume?.ctSliceOrientation),
    [ctSliceOrientation, model.volume?.ctSliceOrientation],
  )
  const ctContainerRefs = useRef<Record<AnatomyAxis, HTMLDivElement | null>>({
    x: null,
    y: null,
    z: null,
  })
  const ctSliceRefs = useRef<Partial<Record<AnatomyAxis, VolumeSlice>>>({})
  const volumeInfoRef = useRef<VolumeSliceInfo>(createEmptyVolumeSliceInfo())
  const ctWheelRemainderRef = useRef<Record<AnatomyAxis, number>>(createEmptyWheelRemainders())
  const xrSessionRef = useRef<XRSession | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [xrCapabilities, setXrCapabilities] = useState<XRCapabilities>({
    checked: false,
    hasWebXR: false,
    immersiveAR: false,
    immersiveVR: false,
  })
  const [xrSessionActive, setXrSessionActive] = useState(false)
  const [xrSessionMode, setXrSessionMode] = useState<ImmersiveXRMode>('immersive-vr')
  const [spatialSelection, setSpatialSelection] = useState<string | null>(null)
  const [xrControlAxis, setXrControlAxis] = useState<AnatomyAxis>(ctClipAxis)
  const [debugCoords, setDebugCoords] = useState({
    position: [0, 0, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  })
  const [volumeInfo, setVolumeInfo] = useState<VolumeSliceInfo>(() => createEmptyVolumeSliceInfo())
  const effectiveCtPlaneSlices = useMemo(
    () => ctPlaneSlices ?? { x: volumeSlice, y: volumeSlice, z: volumeSlice },
    [ctPlaneSlices, volumeSlice],
  )

  useEffect(() => {
    setXrControlAxis(ctClipAxis)
  }, [ctClipAxis])

  useEffect(() => {
    volumeInfoRef.current = volumeInfo
  }, [volumeInfo])

  const initialWindow = useMemo(
    () => ({
      low: model.volume?.window?.low ?? -1000,
      high: model.volume?.window?.high ?? 500,
    }),
    [model.volume?.window?.high, model.volume?.window?.low],
  )
  const [windowPreset, setWindowPreset] = useState<WindowPresetKey>('default')
  const [windowValues, setWindowValues] = useState(initialWindow)
  const appliedWindow = useMemo(() => {
    if (windowPreset === 'default') {
      return initialWindow
    }
    if (windowPreset === 'custom') {
      return windowValues
    }
    const preset = WINDOW_PRESET_MAP[windowPreset]
    return { low: preset.low, high: preset.high }
  }, [initialWindow, windowPreset, windowValues])
  const presetButtons = useMemo<WindowPresetKey[]>(
    () => ['default', 'soft-tissue', 'lung', 'bone', 'custom'],
    [],
  )
  const pathname = usePathname()
  const prevSegmentsRef = useRef<AnatomySegment[] | null>(null)

  useEffect(() => {
    const resetInfo = createEmptyVolumeSliceInfo()
    volumeInfoRef.current = resetInfo
    ctWheelRemainderRef.current = createEmptyWheelRemainders()
    setVolumeInfo(resetInfo)
    ctSliceRefs.current = {}
  }, [model.id])

  useEffect(() => {
    setWindowPreset('default')
    setWindowValues(initialWindow)
  }, [initialWindow])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('xr' in navigator)) {
      setXrCapabilities({
        checked: true,
        hasWebXR: false,
        immersiveAR: false,
        immersiveVR: false,
      })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const xrSystem = (navigator as Navigator & { xr?: XRSystem }).xr
        if (!xrSystem) {
          if (!cancelled) {
            setXrCapabilities({
              checked: true,
              hasWebXR: false,
              immersiveAR: false,
              immersiveVR: false,
            })
          }
          return
        }

        if (!xrSystem.isSessionSupported) {
          if (!cancelled) {
            setXrCapabilities({
              checked: true,
              hasWebXR: true,
              immersiveAR: false,
              immersiveVR: false,
            })
          }
          return
        }

        const [arSupported, vrSupported] = await Promise.all([
          xrSystem.isSessionSupported('immersive-ar').catch(() => false),
          xrSystem.isSessionSupported('immersive-vr').catch(() => false),
        ])
        if (cancelled) return
        setXrCapabilities({
          checked: true,
          hasWebXR: true,
          immersiveAR: arSupported,
          immersiveVR: vrSupported,
        })
        setXrSessionMode(arSupported ? 'immersive-ar' : 'immersive-vr')
      } catch (error) {
        console.warn('WebXR session support check failed', error)
        if (!cancelled) {
          setXrCapabilities({
            checked: true,
            hasWebXR: false,
            immersiveAR: false,
            immersiveVR: false,
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleWindowPresetChange = useCallback(
    (key: WindowPresetKey) => {
      setWindowPreset(key)
      if (key === 'custom') {
        return
      }
      if (key === 'default') {
        setWindowValues(initialWindow)
        return
      }
      const preset = WINDOW_PRESET_MAP[key]
      setWindowValues({ low: preset.low, high: preset.high })
    },
    [initialWindow],
  )

  const handleCustomWindowChange = useCallback((field: 'low' | 'high', value: number) => {
    if (!Number.isFinite(value)) {
      return
    }
    setWindowPreset('custom')
    setWindowValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleCtPlaneSliceChange = useCallback(
    (axis: AnatomyAxis, value: number) => {
      if (!Number.isFinite(value)) {
        return
      }
      const clamped = clamp(value, 0, 100)
      onCtPlaneSliceChange?.(axis, clamped)
      onVolumeSliceChange?.(clamped)
    },
    [onCtPlaneSliceChange, onVolumeSliceChange],
  )

  const handleXrStepCrossSection = useCallback(
    (delta: number) => {
      if (!onCrossSectionChange) {
        return
      }
      const nextValue = clamp(crossSection + delta, 0, 100)
      onCrossSectionChange(nextValue)
      setSpatialSelection(`Cut plane ${formatXRPercent(nextValue)}`)
    },
    [crossSection, onCrossSectionChange],
  )

  const handleXrToggleCtPlanes = useCallback(() => {
    if (!onShowCtPlanesChange) {
      return
    }
    const nextValue = !showCtPlanes
    onShowCtPlanesChange(nextValue)
    setSpatialSelection(nextValue ? 'CT planes visible' : 'CT planes hidden')
  }, [onShowCtPlanesChange, showCtPlanes])

  const handleXrSetControlAxis = useCallback(
    (axis: AnatomyAxis) => {
      setXrControlAxis(axis)
      onCtClipAxisChange?.(axis)
      setSpatialSelection(`${AXIS_LABELS[axis]} plane selected`)
    },
    [onCtClipAxisChange],
  )

  const handleXrToggleActivePlane = useCallback(
    (axis: AnatomyAxis) => {
      if (!onCtPlaneVisibilityChange) {
        return
      }
      const nextValue = !(ctPlaneVisibility[axis] ?? true)
      onCtPlaneVisibilityChange(axis, nextValue)
      setSpatialSelection(`${AXIS_LABELS[axis]} plane ${nextValue ? 'visible' : 'hidden'}`)
    },
    [ctPlaneVisibility, onCtPlaneVisibilityChange],
  )

  const handleXrStepCtPlaneSlice = useCallback(
    (axis: AnatomyAxis, delta: number) => {
      const nextValue = clamp((effectiveCtPlaneSlices[axis] ?? 0) + delta, 0, 100)
      handleCtPlaneSliceChange(axis, nextValue)
      setSpatialSelection(`${AXIS_LABELS[axis]} slice ${formatXRPercent(nextValue)}`)
    },
    [effectiveCtPlaneSlices, handleCtPlaneSliceChange],
  )

  const handleXrStepCtPlaneOpacity = useCallback(
    (delta: number) => {
      if (!onCtPlaneOpacityChange) {
        return
      }
      const nextValue = clamp(ctPlaneOpacity + delta, 0, 1)
      onCtPlaneOpacityChange(nextValue)
      setSpatialSelection(`CT plane opacity ${Math.round(nextValue * 100)}%`)
    },
    [ctPlaneOpacity, onCtPlaneOpacityChange],
  )

  const handleXrCycleClipMode = useCallback(() => {
    if (!onCtClipModeChange) {
      return
    }
    const currentIndex = Math.max(0, XR_CONTROL_CLIP_MODES.indexOf(ctClipMode))
    const nextMode = XR_CONTROL_CLIP_MODES[(currentIndex + 1) % XR_CONTROL_CLIP_MODES.length]
    onCtClipModeChange(nextMode)
    if (nextMode !== 'none') {
      onCtClipAxisChange?.(xrControlAxis)
    }
    setSpatialSelection(
      nextMode === 'none'
        ? 'CT clipping off'
        : `${AXIS_LABELS[xrControlAxis]} clipping: ${getClipModeLabel(nextMode)}`,
    )
  }, [ctClipMode, onCtClipAxisChange, onCtClipModeChange, xrControlAxis])

  const stepCtPlaneSlice = useCallback(
    (axis: AnatomyAxis, delta: number) => {
      const currentInfo = volumeInfoRef.current[axis]
      if ((!onCtPlaneSliceChange && !onVolumeSliceChange) || currentInfo.total <= 1) {
        return
      }

      const nextIndex = clamp(currentInfo.index + delta, 0, currentInfo.total - 1)
      if (nextIndex === currentInfo.index) {
        return
      }

      const nextInfo = { index: nextIndex, total: currentInfo.total }
      volumeInfoRef.current = {
        ...volumeInfoRef.current,
        [axis]: nextInfo,
      }
      setVolumeInfo((current) => ({
        ...current,
        [axis]: nextInfo,
      }))
      handleCtPlaneSliceChange(axis, sliceIndexToPercent(nextIndex, currentInfo.total))
    },
    [handleCtPlaneSliceChange, onCtPlaneSliceChange, onVolumeSliceChange],
  )

  const handleCtSliceWheel = useCallback(
    (axis: AnatomyAxis, event: WheelEvent<HTMLElement>) => {
      const currentInfo = volumeInfoRef.current[axis]
      if (
        volumeState.status !== 'success' ||
        (!onCtPlaneSliceChange && !onVolumeSliceChange) ||
        currentInfo.total <= 1
      ) {
        return
      }

      const primaryDelta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      if (primaryDelta === 0) {
        return
      }

      event.preventDefault()
      const modeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1
      const normalizedDelta = primaryDelta * modeMultiplier

      if (
        ctWheelRemainderRef.current[axis] !== 0 &&
        Math.sign(ctWheelRemainderRef.current[axis]) !== Math.sign(normalizedDelta)
      ) {
        ctWheelRemainderRef.current[axis] = 0
      }

      ctWheelRemainderRef.current[axis] += normalizedDelta
      const rawSteps = Math.trunc(ctWheelRemainderRef.current[axis] / 24)
      if (rawSteps === 0) {
        return
      }

      ctWheelRemainderRef.current[axis] -= rawSteps * 24
      const cappedSteps = clamp(rawSteps, -12, 12)
      stepCtPlaneSlice(axis, cappedSteps * (event.shiftKey ? 5 : 1))
    },
    [onCtPlaneSliceChange, onVolumeSliceChange, stepCtPlaneSlice, volumeState.status],
  )

  const handleCtSliceKeyDown = useCallback(
    (axis: AnatomyAxis, event: KeyboardEvent<HTMLDivElement>) => {
      const currentInfo = volumeInfoRef.current[axis]
      if (
        volumeState.status !== 'success' ||
        (!onCtPlaneSliceChange && !onVolumeSliceChange) ||
        currentInfo.total <= 1
      ) {
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        handleCtPlaneSliceChange(axis, 0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        handleCtPlaneSliceChange(axis, 100)
        return
      }

      const largeStep = event.shiftKey ? 10 : 5
      const keySteps: Record<string, number> = {
        ArrowDown: 1,
        ArrowRight: 1,
        ArrowUp: -1,
        ArrowLeft: -1,
        PageDown: largeStep,
        PageUp: -largeStep,
      }
      const delta = keySteps[event.key]
      if (!delta) {
        return
      }

      event.preventDefault()
      stepCtPlaneSlice(axis, delta)
    },
    [
      handleCtPlaneSliceChange,
      onCtPlaneSliceChange,
      onVolumeSliceChange,
      stepCtPlaneSlice,
      volumeState.status,
    ],
  )

  const handleEnterXR = useCallback(
    async (mode: ImmersiveXRMode) => {
      if (typeof navigator === 'undefined' || !('xr' in navigator)) {
        return
      }
      if (!glRef.current) {
        return
      }

      try {
        const xrSystem = (navigator as Navigator & { xr?: XRSystem }).xr
        if (!xrSystem?.requestSession) {
          return
        }

        glRef.current.xr.enabled = true
        glRef.current.xr.setReferenceSpaceType?.('local-floor')
        glRef.current.setClearAlpha(mode === 'immersive-ar' ? 0 : 1)

        const optionalFeatures: XRSessionInit['optionalFeatures'] = ['local-floor', 'hand-tracking']
        if (mode === 'immersive-ar') {
          optionalFeatures.push('hit-test')
        } else {
          optionalFeatures.push('bounded-floor')
        }

        const sessionInit: XRSessionInit = {
          optionalFeatures,
        }

        const session = await xrSystem.requestSession(mode, sessionInit)

        if (!session) {
          return
        }

        setXrSessionMode(mode)
        xrSessionRef.current = session
        session.addEventListener('end', () => {
          xrSessionRef.current = null
          setXrSessionActive(false)
          setSpatialSelection(null)
          glRef.current?.setClearAlpha(1)
        })

        await glRef.current.xr.setSession(session)
        setXrSessionActive(true)
        setSpatialSelection(
          mode === 'immersive-ar'
            ? 'Pinch/select a visible segment to move it in space.'
            : 'Select and hold a visible segment to move it. Squeeze to recenter.',
        )
      } catch (error) {
        console.error('Failed to start WebXR session', error)
        onError?.(
          'Unable to start immersive session. Please check browser settings and permissions.',
        )
        glRef.current?.setClearAlpha(1)
      }
    },
    [onError],
  )

  const handleExitXR = useCallback(async () => {
    try {
      if (xrSessionRef.current) {
        await xrSessionRef.current.end()
      }
    } catch (error) {
      console.warn('Failed to end XR session', error)
    } finally {
      xrSessionRef.current = null
      setXrSessionActive(false)
      setSpatialSelection(null)
      glRef.current?.setClearAlpha(1)
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches)
    }
    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    const listener = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', listener)
    return () => document.removeEventListener('fullscreenchange', listener)
  }, [])

  useEffect(() => {
    if (assetState.status === 'error' && onError) {
      onError(assetState.error)
    }
  }, [assetState, onError])
  const preparedScene = useMemo(() => {
    if (assetState.status !== 'success') {
      return null
    }
    const groupClone = assetState.group.clone(true)
    const rotationRadians = {
      x: (rotation.x * Math.PI) / 180,
      y: (rotation.y * Math.PI) / 180,
      z: (rotation.z * Math.PI) / 180,
    }
    groupClone.rotation.x += rotationRadians.x
    groupClone.rotation.y += rotationRadians.y
    groupClone.rotation.z += rotationRadians.z
    groupClone.updateMatrixWorld(true)
    const segmentSeed =
      assetState.segments && assetState.segments.length ? assetState.segments : model.segments
    const effectiveModel: AnatomyModel =
      segmentSeed === model.segments ? model : { ...model, segments: segmentSeed }
    const { meshesBySegment, segments: hydratedSegments } = applySegmentColors(
      groupClone,
      effectiveModel,
    )
    const boundingBox = new Box3().setFromObject(groupClone)
    return {
      group: groupClone,
      segmentMeshes: meshesBySegment,
      boundingBox,
      patientToModelMatrix: getPatientToModelMatrix(groupClone, model),
      segments: hydratedSegments,
    }
  }, [assetState, model, rotation])

  useEffect(() => {
    if (!preparedScene || !onSegmentsChanged) {
      return
    }
    const prev = prevSegmentsRef.current
    const next = preparedScene.segments
    const hasChanged =
      !prev ||
      prev.length !== next.length ||
      prev.some((prevSegment, index) => {
        const segment = next[index]
        return (
          !segment ||
          prevSegment.id !== segment.id ||
          prevSegment.color !== segment.color ||
          prevSegment.visibleByDefault !== segment.visibleByDefault
        )
      })

    if (hasChanged) {
      prevSegmentsRef.current = next.map((segment) => ({ ...segment }))
      onSegmentsChanged(next.map((segment) => ({ ...segment })))
    }
  }, [preparedScene, onSegmentsChanged])

  useEffect(() => {
    if (
      !onSceneMetrics ||
      !preparedScene?.patientToModelMatrix ||
      volumeState.status !== 'success'
    ) {
      onSceneMetrics?.(null)
      return
    }

    const modelCenter = preparedScene.boundingBox.getCenter(new Vector3())
    const patientAtModelCenter = modelCenter
      .clone()
      .applyMatrix4(preparedScene.patientToModelMatrix.clone().invert())
    const volumeCenter = getVolumeCenterPatientPoint(
      volumeState,
      model.volume?.volumeCenterPatientMm,
    )
    const suggestedTranslation = patientAtModelCenter.sub(volumeCenter)

    onSceneMetrics({
      modelCenter: [modelCenter.x, modelCenter.y, modelCenter.z],
      volumeCenterPatient: [volumeCenter.x, volumeCenter.y, volumeCenter.z],
      suggestedCtTranslationMm: [
        suggestedTranslation.x,
        suggestedTranslation.y,
        suggestedTranslation.z,
      ],
    })
  }, [model.volume?.volumeCenterPatientMm, onSceneMetrics, preparedScene, volumeState])

  const boundingSize = useMemo(() => {
    if (!preparedScene) {
      return null
    }
    return preparedScene.boundingBox.getSize(new Vector3())
  }, [preparedScene])

  const spatialPlacement = useMemo(() => {
    if (!preparedScene) {
      return null
    }
    return computeSpatialPlacement(preparedScene.boundingBox)
  }, [preparedScene])

  useEffect(() => {
    const root = spatialRootRef.current
    if (!root) {
      return
    }

    if (xrSessionActive && spatialPlacement) {
      applySpatialPlacement(root, spatialPlacement)
      return
    }

    resetDesktopPlacement(root)
  }, [preparedScene, spatialPlacement, xrSessionActive])

  const radius = useMemo(() => {
    if (!boundingSize) {
      return 1
    }
    return boundingSize.length() / 2
  }, [boundingSize])

  const cameraTarget = useMemo<[number, number, number]>(() => {
    if (model.defaultCamera?.target) {
      return model.defaultCamera.target
    }
    if (!boundingSize) {
      return [0, 0, 0]
    }
    return [0, boundingSize.y * 0.05, 0]
  }, [model.defaultCamera, boundingSize])

  const cameraPosition = useMemo<[number, number, number]>(() => {
    if (model.defaultCamera?.position) {
      return model.defaultCamera.position
    }
    if (!boundingSize) {
      return [0, 1.5, 6]
    }
    return [0, boundingSize.y * 0.1, radius * 2.8]
  }, [model.defaultCamera, boundingSize, radius])

  const maxDistance = useMemo(() => {
    // For GLB models, use larger max distance
    if (model.downloads.some((d) => d.format === 'glb')) {
      return Math.max(radius * 10, 20)
    }
    return Math.max(radius * 3.5, 10)
  }, [radius, model.downloads])

  const minDistance = useMemo(() => {
    // For GLB models, allow much closer viewing
    if (model.downloads.some((d) => d.format === 'glb')) {
      return Math.max(radius * 0.1, 0.1)
    }
    return Math.max(Math.min(radius * 0.25, 2.5), 1.2)
  }, [radius, model.downloads])

  const axesHelper = useMemo(() => new AxesHelper(2.5), [])

  useEffect(() => {
    if (controlsRef.current && model.defaultCamera?.target && model.defaultCamera?.position) {
      controlsRef.current.target.set(...model.defaultCamera.target)
      controlsRef.current.object.position.set(...model.defaultCamera.position)
      controlsRef.current.update()
    }
  }, [model.defaultCamera])

  // Ensure camera position is set after OrbitControls initializes
  useEffect(() => {
    if (controlsRef.current && model.defaultCamera?.position) {
      const timer = setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.object.position.set(...model.defaultCamera.position)
          controlsRef.current.update()
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [model.defaultCamera, model.downloads, preparedScene])

  // Force camera position on initial load
  useEffect(() => {
    if (controlsRef.current && model.defaultCamera?.position && preparedScene) {
      const timer = setTimeout(() => {
        if (controlsRef.current) {
          const shouldAutoFit =
            model.downloads.some((d) => d.format === 'glb') &&
            preparedScene.boundingBox &&
            model.defaultCamera?.autoFit !== false

          if (shouldAutoFit) {
            const size = preparedScene.boundingBox.getSize(new Vector3())
            const center = preparedScene.boundingBox.getCenter(new Vector3())
            const maxDim = Math.max(size.x, size.y, size.z)
            const distance = Math.max(maxDim * 4.5, maxDim + 1.5)

            controlsRef.current.object.position.set(distance, distance, distance)
            controlsRef.current.target.set(center.x, center.y, center.z)

            console.log('Auto-positioned camera for GLB:', {
              position: [distance, distance, distance],
              target: center,
              modelSize: size,
              maxDim: maxDim,
            })
          } else {
            controlsRef.current.object.position.set(...model.defaultCamera.position)
            controlsRef.current.target.set(...model.defaultCamera.target)
          }
          controlsRef.current.update()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [preparedScene, model.defaultCamera, model.downloads])

  useEffect(() => {
    if (!showDebugHelpers) {
      return
    }

    let cleanup: (() => void) | undefined
    let frameId: number | undefined

    const attach = () => {
      const controls = controlsRef.current
      if (!controls) {
        frameId = requestAnimationFrame(attach)
        return
      }

      const update = () => {
        const { x: px, y: py, z: pz } = controls.object.position
        const { x: tx, y: ty, z: tz } = controls.target
        setDebugCoords({ position: [px, py, pz], target: [tx, ty, tz] })
      }

      update()
      controls.addEventListener('change', update)
      cleanup = () => controls.removeEventListener('change', update)
    }

    attach()

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
      if (cleanup) {
        cleanup()
      }
    }
  }, [showDebugHelpers, resetSignal, preparedScene])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2])
      controlsRef.current.update()
    }
  }, [cameraTarget])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.reset()
      controlsRef.current.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2])
      if (model.defaultCamera?.position) {
        controlsRef.current.object.position.set(...model.defaultCamera.position)
      }
      controlsRef.current.update()
    }
  }, [resetSignal, pathname, cameraTarget, model.defaultCamera])

  useEffect(() => {
    if (!preparedScene) {
      return
    }
    Object.entries(preparedScene.segmentMeshes).forEach(([segmentId, meshes]) => {
      const visible = visibleSegments[segmentId] ?? true
      meshes.forEach((mesh) => {
        mesh.visible = visible
        if (mesh.material && mesh.material instanceof MeshStandardMaterial) {
          mesh.material.opacity = visible ? 0.9 : 0.15
          mesh.material.transparent = true
          mesh.material.needsUpdate = true
        }
      })
    })
  }, [preparedScene, visibleSegments])

  useEffect(() => {
    if (!preparedScene || !glRef.current) {
      return
    }
    const ctClippingEnabled =
      ctClipMode !== 'none' &&
      volumeState.status === 'success' &&
      Boolean(preparedScene.patientToModelMatrix)
    const volumeToModelMatrix =
      ctClippingEnabled && volumeState.status === 'success' && preparedScene.patientToModelMatrix
        ? getVolumeToModelMatrix(
            preparedScene.patientToModelMatrix,
            volumeState,
            effectiveCtAlignment,
            model.volume?.volumeCenterPatientMm,
          )
        : null
    const ctPlane =
      ctClippingEnabled && volumeState.status === 'success' && volumeToModelMatrix
        ? createVolumeClippingPlane({
            axis: ctClipAxis,
            mode: ctClipMode,
            percentage: effectiveCtPlaneSlices[ctClipAxis],
            volumeState,
            volumeToModelMatrix,
          })
        : null
    const clippingEnabled = Boolean(ctPlane) || crossSection > 0
    const gl = glRef.current
    gl.localClippingEnabled = clippingEnabled
    const plane =
      ctPlane ??
      new Plane(
        new Vector3(0, -1, 0),
        computePlaneConstant(preparedScene.boundingBox, crossSection),
      )
    Object.values(preparedScene.segmentMeshes).forEach((meshes) => {
      meshes.forEach((mesh) => {
        const material = mesh.material as MeshStandardMaterial
        material.clippingPlanes = clippingEnabled ? [plane] : []
        material.needsUpdate = true
      })
    })
  }, [
    ctClipAxis,
    ctClipMode,
    effectiveCtPlaneSlices,
    effectiveCtAlignment,
    model.volume?.volumeCenterPatientMm,
    preparedScene,
    volumeState,
    crossSection,
  ])

  useEffect(() => {
    if (volumeState.status !== 'success') {
      ORTHOGONAL_AXES.forEach((axis) => {
        ctContainerRefs.current[axis]?.replaceChildren()
        const slice = ctSliceRefs.current[axis]
        if (slice) {
          disposeVolumeSlice(slice)
          delete ctSliceRefs.current[axis]
        }
      })
      const resetInfo = createEmptyVolumeSliceInfo()
      volumeInfoRef.current = resetInfo
      ctWheelRemainderRef.current = createEmptyWheelRemainders()
      setVolumeInfo(resetInfo)
      return
    }

    const { volume, dimensions } = volumeState

    let windowLow = appliedWindow.low
    let windowHigh = appliedWindow.high
    if (!Number.isFinite(windowLow)) {
      windowLow = -1000
    }
    if (!Number.isFinite(windowHigh)) {
      windowHigh = 500
    }
    if (windowHigh <= windowLow) {
      const midpoint = (windowHigh + windowLow) / 2
      windowLow = midpoint - 1
      windowHigh = midpoint + 1
    }

    volume.windowLow = windowLow
    volume.windowHigh = windowHigh
    volume.lowerThreshold = Number.NEGATIVE_INFINITY
    volume.upperThreshold = Number.POSITIVE_INFINITY

    if (!dimensions || dimensions.some((dim) => !dim || dim <= 0)) {
      console.warn('Invalid volume dimensions:', dimensions)
      return
    }

    const nextVolumeInfo = createEmptyVolumeSliceInfo()

    ORTHOGONAL_AXES.forEach((axis) => {
      const container = ctContainerRefs.current[axis]
      if (!container) {
        return
      }

      const axisIndex = getAxisIndex(axis)
      const totalSlices = Math.max(1, Math.floor(dimensions[axisIndex] ?? 1))
      const targetIndex = getSliceIndex(effectiveCtPlaneSlices[axis], totalSlices)

      let slice = ctSliceRefs.current[axis]
      if (!slice || slice.volume !== volume || slice.axis !== axis) {
        if (slice) {
          disposeVolumeSlice(slice)
          delete ctSliceRefs.current[axis]
        }

        try {
          slice = volume.extractSlice(axis, targetIndex)

          if (!slice.canvas || slice.canvas.width === 0 || slice.canvas.height === 0) {
            console.warn('Invalid slice canvas dimensions:', {
              width: slice.canvas?.width,
              height: slice.canvas?.height,
              axis,
              targetIndex,
              totalSlices,
            })
            return
          }

          styleVolumeSliceCanvas(slice, axis, effectiveCtSliceOrientation[axis])
          container.replaceChildren(slice.canvas)
          ctSliceRefs.current[axis] = slice
        } catch (error) {
          console.error(`Error extracting ${AXIS_LABELS[axis]} volume slice:`, error)
          return
        }
      }

      if (!slice) {
        return
      }

      try {
        if (slice.index !== targetIndex || !isRenderableVolumeSlice(slice)) {
          slice.index = targetIndex
        }
        slice.repaint()
        styleVolumeSliceCanvas(slice, axis, effectiveCtSliceOrientation[axis])
      } catch (error) {
        console.error(`Error repainting ${AXIS_LABELS[axis]} volume slice:`, error)
      }

      nextVolumeInfo[axis] = { index: targetIndex, total: totalSlices }
    })

    volumeInfoRef.current = nextVolumeInfo
    setVolumeInfo((current) => {
      const unchanged = ORTHOGONAL_AXES.every(
        (axis) =>
          current[axis].index === nextVolumeInfo[axis].index &&
          current[axis].total === nextVolumeInfo[axis].total,
      )
      return unchanged ? current : nextVolumeInfo
    })
  }, [volumeState, effectiveCtPlaneSlices, appliedWindow, effectiveCtSliceOrientation])

  useEffect(() => {
    const sliceContainers = ctContainerRefs.current
    const slices = ctSliceRefs.current

    return () => {
      ORTHOGONAL_AXES.forEach((axis) => {
        sliceContainers[axis]?.replaceChildren()
        const slice = slices[axis]
        if (slice) {
          disposeVolumeSlice(slice)
          delete slices[axis]
        }
      })
      if (xrSessionRef.current) {
        xrSessionRef.current.end().catch(() => {})
        xrSessionRef.current = null
      }
      setXrSessionActive(false)
    }
  }, [])

  const handleFullscreenToggle = () => {
    const element = containerRef.current
    if (!element) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void element.requestFullscreen?.()
    }
  }

  const handleScreenshot = () => {
    if (!glRef.current) {
      return
    }
    const dataUrl = glRef.current.domElement.toDataURL('image/png')
    if (onScreenshot) {
      onScreenshot(dataUrl)
      return
    }
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${model.slug}-viewer.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const xrStatusMessage = useMemo(() => {
    if (!xrCapabilities.checked) {
      return 'Checking headset support...'
    }
    if (!xrCapabilities.hasWebXR) {
      return 'Open in a WebXR headset browser to enter spatial view.'
    }
    if (!xrCapabilities.immersiveAR && !xrCapabilities.immersiveVR) {
      return 'WebXR is present, but no immersive headset session is available here.'
    }
    return null
  }, [xrCapabilities])

  if (assetState.status === 'error') {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-3xl border border-border/60 bg-muted/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Unable to load the 3D model. Please try again later.
        </p>
      </div>
    )
  }

  const workbenchColumns = controlPanel
    ? 'xl:grid-cols-[minmax(280px,0.78fr)_minmax(460px,1.55fr)_minmax(300px,0.82fr)]'
    : 'xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.82fr)]'
  const legendSegments = model.segments.slice(0, 6)
  const hiddenLegendCount = Math.max(0, model.segments.length - legendSegments.length)
  const volumeAvailable = volumeState.status === 'success'

  return (
    <div
      data-testid="anatomy-workbench"
      className={`relative grid gap-3 overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(8,18,32,0.97),rgba(3,8,14,0.98))] p-3 shadow-sm ${workbenchColumns} xl:h-[clamp(720px,calc(100dvh_-_14rem),980px)]`}
    >
      {controlPanel ? (
        <aside
          data-testid="anatomy-control-panel"
          className="min-h-0 overflow-auto rounded-2xl border border-slate-500/20 bg-slate-950/55 p-4 text-slate-100"
          aria-label="Scene controls"
        >
          {controlPanel}
        </aside>
      ) : null}

      <main
        data-testid="anatomy-scene-panel"
        className="grid min-h-[560px] grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-500/20 bg-slate-950/40 p-4 text-slate-100"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
              Shared Scene
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">{model.name}</h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {xrSessionActive ? (
              <button
                type="button"
                onClick={handleExitXR}
                className="inline-flex min-h-9 items-center rounded-full border border-emerald-300/40 bg-emerald-400/20 px-3 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-400/30"
              >
                Exit spatial view
              </button>
            ) : null}
            {!xrSessionActive && xrCapabilities.immersiveVR ? (
              <button
                type="button"
                onClick={() => handleEnterXR('immersive-vr')}
                className="inline-flex min-h-9 items-center rounded-full border border-cyan-300/35 bg-cyan-300/15 px-3 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/25"
              >
                Enter VR
              </button>
            ) : null}
            {!xrSessionActive && xrCapabilities.immersiveAR ? (
              <button
                type="button"
                onClick={() => handleEnterXR('immersive-ar')}
                className="inline-flex min-h-9 items-center rounded-full border border-cyan-300/35 bg-cyan-300/15 px-3 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/25"
              >
                Enter AR
              </button>
            ) : null}
            {xrStatusMessage ? (
              <span className="max-w-44 text-right text-[11px] leading-snug text-slate-400">
                {xrStatusMessage}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => controlsRef.current?.reset()}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-400/20 bg-slate-900/80 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              onClick={handleScreenshot}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-400/20 bg-slate-900/80 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
              Capture
            </button>
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-400/20 bg-slate-900/80 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              )}
              {isFullscreen ? 'Exit' : 'Full'}
            </button>
          </div>
        </div>

        <div
          data-testid="anatomy-scene-viewport"
          ref={containerRef}
          className="relative h-[clamp(480px,64vh,760px)] min-h-[480px] w-full overflow-hidden rounded-2xl border border-slate-500/20 bg-slate-950 xl:h-full xl:min-h-0"
        >
          {assetState.status === 'loading' ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/85">
              <span className="text-sm text-slate-300">Loading 3D anatomy…</span>
            </div>
          ) : null}
          <Canvas
            shadows
            dpr={[1, isMobile ? 1 : 1.5]}
            gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              glRef.current = gl
              gl.outputColorSpace = SRGBColorSpace
              gl.toneMappingExposure = 1.2
              gl.setClearColor('#0b172b', 1)
              gl.xr.enabled = true
              gl.domElement.addEventListener('webglcontextlost', (event) => {
                console.debug('WebGL context lost')
                event.preventDefault()
              })
              gl.domElement.addEventListener('webglcontextrestored', () => {
                console.debug('WebGL context restored')
              })
            }}
          >
            <color attach="background" args={['#0b172b']} />
            <AdaptiveDpr pixelated />
            <PerspectiveCamera makeDefault position={cameraPosition} fov={45} />
            <ambientLight intensity={0.85} />
            <hemisphereLight color="#f8fafc" groundColor="#111827" intensity={0.85} />
            <directionalLight position={[6, 7, 6]} intensity={1.0} castShadow />
            <directionalLight position={[-5, -3, -6]} intensity={0.5} />
            <spotLight
              position={[0, 9, 5]}
              intensity={0.75}
              angle={0.8}
              penumbra={0.55}
              castShadow
            />
            {showDebugHelpers ? <primitive object={axesHelper} /> : null}
            {xrSessionActive && xrSessionMode === 'immersive-vr' ? (
              <gridHelper args={[4, 8, '#38bdf8', '#1e293b']} position={[0, 0.02, -1.35]} />
            ) : null}
            {preparedScene ? (
              <Suspense
                fallback={
                  <Html center className="text-xs text-slate-300">
                    Preparing anatomy…
                  </Html>
                }
              >
                <group ref={spatialRootRef}>
                  <primitive object={preparedScene.group} />
                  <OrthogonalVolumePlanes
                    ctAlignment={effectiveCtAlignment}
                    opacity={ctPlaneOpacity}
                    patientToModelMatrix={preparedScene.patientToModelMatrix}
                    planeSlices={effectiveCtPlaneSlices}
                    planeVisibility={ctPlaneVisibility}
                    showPlanes={showCtPlanes}
                    volumeCenterPatientMm={model.volume?.volumeCenterPatientMm}
                    volumeState={volumeState}
                    windowKey={`${appliedWindow.low}:${appliedWindow.high}`}
                  />
                </group>
                <XRSpatialControllers
                  controlRootRef={xrControlPanelRef}
                  enabled={xrSessionActive}
                  targetRef={spatialRootRef}
                  placement={spatialPlacement}
                  onSelectSegment={setSpatialSelection}
                />
                {xrSessionActive && xrSessionMode === 'immersive-vr' ? (
                  <XRControlPanel
                    activeAxis={xrControlAxis}
                    crossSection={crossSection}
                    ctClipAxis={ctClipAxis}
                    ctClipMode={ctClipMode}
                    ctPlaneOpacity={ctPlaneOpacity}
                    ctPlaneSlices={effectiveCtPlaneSlices}
                    ctPlaneVisibility={ctPlaneVisibility}
                    panelRef={xrControlPanelRef}
                    showCtPlanes={showCtPlanes}
                    visible
                    volumeAvailable={volumeAvailable}
                    onActiveAxisChange={handleXrSetControlAxis}
                    onCycleClipMode={onCtClipModeChange ? handleXrCycleClipMode : undefined}
                    onStepCrossSection={onCrossSectionChange ? handleXrStepCrossSection : undefined}
                    onStepCtPlaneOpacity={
                      onCtPlaneOpacityChange ? handleXrStepCtPlaneOpacity : undefined
                    }
                    onStepCtPlaneSlice={
                      onCtPlaneSliceChange || onVolumeSliceChange
                        ? handleXrStepCtPlaneSlice
                        : undefined
                    }
                    onToggleActivePlane={
                      onCtPlaneVisibilityChange ? handleXrToggleActivePlane : undefined
                    }
                    onToggleCtPlanes={onShowCtPlanesChange ? handleXrToggleCtPlanes : undefined}
                  />
                ) : null}
              </Suspense>
            ) : null}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enabled={!xrSessionActive}
              enablePan={!isMobile}
              minDistance={minDistance}
              maxDistance={maxDistance}
              target={cameraTarget}
              autoRotate={false}
              enableDamping={false}
            />
          </Canvas>

          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
            <div className="pointer-events-auto w-fit max-w-[min(420px,calc(100%_-_1rem))] rounded-full border border-cyan-300/25 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur">
              Drag rotates. Scroll zooms. Shift + drag pans.
            </div>
            <div className="flex flex-col gap-3">
              {xrSessionActive && spatialSelection ? (
                <div className="pointer-events-auto max-w-sm rounded-2xl border border-cyan-400/30 bg-slate-950/85 px-3 py-2 text-xs text-slate-300 shadow-lg backdrop-blur">
                  <span className="font-semibold text-white">Spatial mode: </span>
                  {spatialSelection}
                </div>
              ) : null}
              {showDebugHelpers ? (
                <div className="pointer-events-auto inline-flex max-w-xs flex-col gap-1 self-start rounded-lg border border-slate-400/20 bg-slate-950/85 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
                  <span className="font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Camera
                  </span>
                  <span>
                    Pos: {debugCoords.position.map((value) => value.toFixed(2)).join(', ')}
                  </span>
                  <span>
                    Target: {debugCoords.target.map((value) => value.toFixed(2)).join(', ')}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="pointer-events-auto max-w-[min(560px,100%)] rounded-2xl border border-slate-400/20 bg-slate-950/75 px-3 py-2 text-xs text-slate-300 shadow-lg backdrop-blur">
                  {showAnnotations ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {legendSegments.map((segment) => (
                        <span key={segment.id} className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: segment.color }}
                          />
                          {segment.name}
                        </span>
                      ))}
                      {hiddenLegendCount > 0 ? <span>+{hiddenLegendCount} more</span> : null}
                    </div>
                  ) : (
                    'Annotations hidden'
                  )}
                </div>
                <div className="pointer-events-auto ml-auto inline-flex items-center gap-2 rounded-full border border-slate-400/20 bg-slate-950/75 px-3 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur">
                  <span>
                    {ctClipMode === 'none'
                      ? `${crossSection}% cross-section`
                      : `${AXIS_LABELS[ctClipAxis]} CT clipping`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside
        data-testid="anatomy-ct-panel"
        className="grid min-h-0 auto-rows-max gap-3 overflow-auto rounded-2xl border border-slate-500/20 bg-slate-950/55 p-4 text-slate-100"
        aria-label="CT slice controls"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
              Orthogonal CT
            </div>
            <h3 className="mt-1 text-base font-semibold text-white">Synced slices</h3>
          </div>
          {volumeState.status === 'success' ? (
            <span className="rounded-full border border-slate-400/20 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300">
              {ORTHOGONAL_AXES.length} planes
            </span>
          ) : null}
        </div>
        <div className="grid gap-3">
          {ORTHOGONAL_AXES.map((axis) => {
            const info = volumeInfo[axis]
            const sliceStep = info.total > 1 ? 100 / (info.total - 1) : 100

            return (
              <article
                key={axis}
                className="grid gap-2 rounded-2xl border border-slate-500/20 bg-slate-950/45 p-3"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span className="font-semibold text-white">{AXIS_LABELS[axis]}</span>
                  <span>
                    Slice {info.total > 0 ? info.index + 1 : 0}/{info.total}
                  </span>
                </div>
                <div
                  className="relative aspect-[4/3] w-full overscroll-contain rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
                  onWheel={(event) => handleCtSliceWheel(axis, event)}
                  onKeyDown={(event) => handleCtSliceKeyDown(axis, event)}
                  tabIndex={volumeState.status === 'success' ? 0 : -1}
                  aria-label={`${AXIS_LABELS[axis]} CT slice viewport`}
                >
                  <div
                    ref={(node) => {
                      ctContainerRefs.current[axis] = node
                    }}
                    className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl border border-slate-500/20 bg-black/80"
                  />
                  {volumeState.status === 'loading' ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/85">
                      <span className="text-sm text-slate-300">Loading CT volume…</span>
                    </div>
                  ) : null}
                  {volumeState.status === 'error' ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/85 p-4 text-center">
                      <span className="text-xs text-slate-300">
                        Unable to load CT volume: {volumeState.error}
                      </span>
                    </div>
                  ) : null}
                  {volumeState.status === 'idle' ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/85 p-4 text-center">
                      <span className="text-xs text-slate-300">
                        CT volume not available for this model.
                      </span>
                    </div>
                  ) : null}
                </div>
                {volumeState.status === 'success' ? (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={Math.max(sliceStep, 0.01)}
                    value={effectiveCtPlaneSlices[axis]}
                    onChange={(event) => handleCtPlaneSliceChange(axis, Number(event.target.value))}
                    onInput={(event) =>
                      handleCtPlaneSliceChange(axis, Number(event.currentTarget.value))
                    }
                    onWheel={(event) => handleCtSliceWheel(axis, event)}
                    className="w-full accent-cyan-300"
                    aria-label={`${AXIS_LABELS[axis]} CT slice position`}
                    disabled={!onCtPlaneSliceChange && !onVolumeSliceChange}
                  />
                ) : null}
              </article>
            )
          })}
        </div>
        {volumeState.status === 'success' ? (
          <>
            <div className="flex flex-wrap gap-1 text-xs">
              {presetButtons.map((key) => {
                const isActive = windowPreset === key
                const label =
                  key === 'default'
                    ? `Default (${initialWindow.low.toFixed(0)}/${initialWindow.high.toFixed(0)})`
                    : key === 'custom'
                      ? 'Custom'
                      : WINDOW_PRESET_MAP[key].label
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleWindowPresetChange(key)}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      isActive
                        ? 'bg-cyan-200 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {windowPreset === 'custom' ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <label className="flex flex-col gap-1">
                  <span className="uppercase tracking-[0.3em] text-slate-500">Low (HU)</span>
                  <input
                    type="number"
                    value={windowValues.low}
                    step={25}
                    onChange={(event) =>
                      handleCustomWindowChange('low', Number(event.target.value))
                    }
                    className="rounded-md border border-slate-500/25 bg-slate-900/80 px-2 py-1 text-xs text-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="uppercase tracking-[0.3em] text-slate-500">High (HU)</span>
                  <input
                    type="number"
                    value={windowValues.high}
                    step={25}
                    onChange={(event) =>
                      handleCustomWindowChange('high', Number(event.target.value))
                    }
                    className="rounded-md border border-slate-500/25 bg-slate-900/80 px-2 py-1 text-xs text-white"
                  />
                </label>
              </div>
            ) : null}
            <div className="text-xs text-slate-400">
              Window: {appliedWindow.low.toFixed(0)} / {appliedWindow.high.toFixed(0)} HU
            </div>
          </>
        ) : null}
      </aside>
    </div>
  )
}
