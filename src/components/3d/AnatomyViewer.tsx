'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { XR } from '@react-three/xr'
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
  CanvasTexture,
  DoubleSide,
  Euler,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { Group, Mesh, Object3D } from 'three'
import type { WebGLRenderer } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type VolumeSlice from 'three/examples/jsm/misc/VolumeSlice.js'
import type { ThreeEvent } from '@react-three/fiber'
import { createAnatomyXRStore } from './xr/xrStore'

const AXIS_LABELS: Record<'x' | 'y' | 'z', string> = {
  x: 'Sagittal',
  y: 'Coronal',
  z: 'Axial',
}

const ORTHOGONAL_AXES = ['z', 'y', 'x'] as const

type WindowPresetKey = 'default' | 'soft-tissue' | 'lung' | 'bone' | 'custom'
export type AnatomyAxis = (typeof ORTHOGONAL_AXES)[number]
export type OrthogonalClipMode = 'none' | 'hide-above' | 'hide-below'

const XR_CONTROL_CLIP_MODES: OrthogonalClipMode[] = ['none', 'hide-above', 'hide-below']
const XR_MIN_SPATIAL_SCALE = 0.001
const XR_MAX_SPATIAL_SCALE = 80
// World-space axes for the in-headset rotate controls (spin around vertical / tilt around horizontal).
const XR_ROTATE_WORLD_UP = new Vector3(0, 1, 0)
const XR_ROTATE_WORLD_RIGHT = new Vector3(1, 0, 0)
const XR_ROTATE_WORLD_FORWARD = new Vector3(0, 0, 1)

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
  immersiveVR: boolean
}

interface SpatialPlacement {
  position: [number, number, number]
  scale: number
}

type VolumeSliceInfo = Record<AnatomyAxis, { index: number; total: number }>

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
  // ~0.55 m fits in front without dominating the view; the control panel sits lower (see
  // XRControlPanel), so the model floats ahead at roughly eye level and behind the panel in depth.
  const scale = Math.min(Math.max(0.55 / maxDimension, 0.001), 12)

  return {
    position: [-center.x * scale, 1.5 - center.y * scale, -1.5 - center.z * scale],
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
      context.lineJoin = 'round'
      context.lineWidth = Math.max(6, Math.round(fontSize * 0.14))
      context.strokeStyle = 'rgba(2, 6, 23, 0.9)'
      context.strokeText(text, x, canvas.height / 2, canvas.width - padding * 2)
      context.fillText(text, x, canvas.height / 2, canvas.width - padding * 2)
    }

    const nextTexture = new CanvasTexture(canvas)
    nextTexture.colorSpace = SRGBColorSpace
    // Anisotropy + mipmaps keep text sharp at the oblique angles the panels are usually viewed from.
    // Plain LinearFilter (no mipmaps, no anisotropy) was the cause of the smeared/blurry text.
    nextTexture.anisotropy = 16
    nextTexture.generateMipmaps = true
    nextTexture.minFilter = LinearMipmapLinearFilter
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
      {/* toneMapped={false} keeps the canvas text at full white — the scene's ACES tone mapping
          was otherwise desaturating/darkening the labels, which is why they looked grey. */}
      <meshBasicMaterial
        depthWrite={false}
        map={texture}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  )
}

function XRControlButton({
  disabled = false,
  label,
  onSelect,
  onPressStart,
  onPressEnd,
  position,
  selected = false,
  size = [0.26, 0.08],
}: {
  disabled?: boolean
  label: string
  onSelect?: () => void
  onPressStart?: () => void
  onPressEnd?: () => void
  position: [number, number, number]
  selected?: boolean
  size?: [number, number]
}) {
  // R3F pointer events dispatched by @react-three/xr cover controllers, hands, and Vision Pro pinch.
  // onSelect fires once on press (tap actions); onPressStart/onPressEnd drive press-and-hold actions
  // (e.g. the Turn/Tilt rotate buttons) — pointer capture keeps the hold alive until release.
  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (disabled) {
      return
    }
    if (onPressStart) {
      ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
        event.pointerId,
      )
      onPressStart()
    }
    onSelect?.()
  }

  const handleUp = (event: ThreeEvent<PointerEvent>) => {
    if (!onPressEnd) {
      return
    }
    onPressEnd()
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  const backgroundColor = disabled ? '#334155' : selected ? '#a5f3fc' : '#1e293b'
  const borderColor = disabled ? '#64748b' : selected ? '#ecfeff' : '#93c5fd'
  const textColor = disabled ? '#cbd5e1' : selected ? '#042f2e' : '#ffffff'

  return (
    <group
      position={position}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <mesh>
        <planeGeometry args={size} />
        <meshBasicMaterial
          color={backgroundColor}
          opacity={disabled ? 0.72 : 0.98}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <planeGeometry args={[size[0] + 0.006, size[1] + 0.006]} />
        <meshBasicMaterial
          color={borderColor}
          opacity={selected ? 0.42 : 0.28}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <XRTextPlane
        color={textColor}
        fontSize={50}
        fontWeight={800}
        height={size[1] * 0.64}
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
  const width = 0.82
  const height = Math.max(size * 2.25, 0.044)

  return (
    <XRTextPlane
      align="left"
      color="#ffffff"
      fontSize={Math.max(Math.round(size * 1800), 38)}
      fontWeight={size >= 0.03 ? 700 : 600}
      height={height}
      position={[position[0] + width / 2, position[1], position[2]]}
      text={reactTextToString(children)}
      width={width}
    />
  )
}

/**
 * Continuous in-scene slider built from plain meshes + R3F pointer events (no external UI lib),
 * so it works identically for Quest controllers, Quest hands, and Vision Pro pinch. Only the
 * origin-centred track mesh is interactive; the fill/knob opt out of raycasting so worldToLocal on
 * the track maps the hit point straight to a 0..1 fraction. Pointer capture keeps the drag smooth.
 */
function XRSlider({
  disabled = false,
  value,
  min,
  max,
  width = 0.6,
  position,
  throttleMs = 0,
  onChange,
}: {
  disabled?: boolean
  value: number
  min: number
  max: number
  width?: number
  position: [number, number, number]
  throttleMs?: number
  onChange?: (value: number) => void
}) {
  const draggingRef = useRef(false)
  const lastEmitRef = useRef(0)
  const range = max - min || 1
  const fraction = clamp((value - min) / range, 0, 1)
  const filledWidth = Math.max(fraction * width, 0.0001)
  const knobX = -width / 2 + fraction * width

  const applyFromEvent = (event: ThreeEvent<PointerEvent>, force = false) => {
    if (disabled || !onChange) {
      return
    }
    // Throttle continuous emits — slice scrubbing rebuilds CPU volume textures, the main
    // standalone-Quest cost. Press and release always force-emit so the final value is never dropped.
    if (!force && throttleMs > 0) {
      const now = Date.now()
      if (now - lastEmitRef.current < throttleMs) {
        return
      }
      lastEmitRef.current = now
    }
    const localX = event.object.worldToLocal(event.point.clone()).x
    const nextFraction = clamp(localX / width + 0.5, 0, 1)
    onChange(min + nextFraction * range)
  }

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (disabled || !onChange) {
      return
    }
    event.stopPropagation()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    draggingRef.current = true
    applyFromEvent(event, true)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) {
      return
    }
    event.stopPropagation()
    applyFromEvent(event)
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) {
      return
    }
    draggingRef.current = false
    applyFromEvent(event, true)
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  return (
    <group position={position}>
      <mesh
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <planeGeometry args={[width, 0.07]} />
        <meshBasicMaterial
          color={disabled ? '#1e293b' : '#0f172a'}
          opacity={disabled ? 0.5 : 0.96}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[-width / 2 + filledWidth / 2, 0, 0.002]} raycast={() => null}>
        <planeGeometry args={[filledWidth, 0.07]} />
        <meshBasicMaterial
          color={disabled ? '#475569' : '#38bdf8'}
          opacity={0.9}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[knobX, 0, 0.004]} raycast={() => null}>
        <planeGeometry args={[0.05, 0.1]} />
        <meshBasicMaterial color={disabled ? '#64748b' : '#a5f3fc'} side={DoubleSide} transparent />
      </mesh>
    </group>
  )
}

function XRControlPanel({
  activeAxis,
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
  onResetPlacement,
  onScaleTarget,
  onCtPlaneOpacityChange,
  onSliceChange,
  onToggleActivePlane,
  onToggleCtPlanes,
  onRotateTarget,
  onToggleStructures,
  structuresOpen,
}: {
  activeAxis: AnatomyAxis
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
  onResetPlacement?: () => void
  onScaleTarget?: (factor: number) => void
  onCtPlaneOpacityChange?: (value: number) => void
  onSliceChange?: (axis: AnatomyAxis, value: number) => void
  onToggleActivePlane?: (axis: AnatomyAxis) => void
  onToggleCtPlanes?: () => void
  onRotateTarget?: (axis: 'x' | 'y' | 'z', radians: number) => void
  onToggleStructures?: () => void
  structuresOpen?: boolean
}) {
  const activeSlice = ctPlaneSlices[activeAxis] ?? 0
  const { gl } = useThree()
  const faceTmp = useMemo(() => new Vector3(), [])
  const placedRef = useRef(false)
  const panelDragRef = useRef<{ pointerId: number; distance: number; offset: Vector3 } | null>(null)
  const heldRotateRef = useRef<{ axis: 'x' | 'y' | 'z'; sign: number } | null>(null)

  // Yaw-only "face the user": turn the panel to face the viewer horizontally while staying upright.
  // (The previous version copied the camera's full orientation every frame, so the panel pitched and
  // rolled as the user turned their head — the "weird shifting angles".)
  const facePanelAtUser = () => {
    const panel = panelRef.current
    if (!panel) {
      return
    }
    faceTmp.setFromMatrixPosition(gl.xr.getCamera().matrixWorld)
    panel.rotation.set(0, Math.atan2(faceTmp.x - panel.position.x, faceTmp.z - panel.position.z), 0)
  }

  useEffect(() => {
    if (!visible) {
      placedRef.current = false
    }
  }, [visible])

  // Place once (off to the user's right, facing them); afterwards the panel stays LOCKED in world
  // space — it does NOT track the head, so it holds whatever spot/orientation it was dragged to.
  // The only per-frame work is applying continuous rotation while a Turn/Tilt button is held.
  useFrame((_, delta) => {
    const panel = panelRef.current
    if (!panel || !visible || !gl.xr.isPresenting) {
      return
    }
    if (!placedRef.current) {
      panel.position.set(0.95, 1.2, -1.0)
      facePanelAtUser()
      placedRef.current = true
    }
    const held = heldRotateRef.current
    if (held && onRotateTarget) {
      onRotateTarget(held.axis, held.sign * 1.6 * delta)
    }
  })

  const beginPanelDrag = (event: ThreeEvent<PointerEvent>) => {
    const panel = panelRef.current
    if (!panel) {
      return
    }
    event.stopPropagation()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    const distance = Number.isFinite(event.distance)
      ? event.distance
      : event.ray.origin.distanceTo(event.point)
    const anchor = event.ray.origin
      .clone()
      .addScaledVector(event.ray.direction.clone().normalize(), distance)
    panelDragRef.current = {
      pointerId: event.pointerId,
      distance,
      offset: panel.position.clone().sub(anchor),
    }
  }

  const movePanelDrag = (event: ThreeEvent<PointerEvent>) => {
    const drag = panelDragRef.current
    const panel = panelRef.current
    if (!drag || !panel || event.pointerId !== drag.pointerId) {
      return
    }
    event.stopPropagation()
    const anchor = event.ray.origin
      .clone()
      .addScaledVector(event.ray.direction.clone().normalize(), drag.distance)
    panel.position.copy(anchor).add(drag.offset)
    facePanelAtUser()
  }

  const endPanelDrag = (event: ThreeEvent<PointerEvent>) => {
    if (panelDragRef.current?.pointerId !== event.pointerId) {
      return
    }
    panelDragRef.current = null
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  return (
    <group ref={panelRef} visible={visible}>
      <mesh position={[0, 0, -0.008]}>
        <planeGeometry args={[1.22, 1.16]} />
        <meshBasicMaterial color="#020617" opacity={0.97} side={DoubleSide} transparent />
      </mesh>
      <mesh position={[0, 0, -0.004]}>
        <planeGeometry args={[1.26, 1.2]} />
        <meshBasicMaterial color="#22d3ee" opacity={0.1} side={DoubleSide} transparent />
      </mesh>
      {/* Header bar = drag handle. Grab anywhere on it (bar or title) to reposition the panel. */}
      <group
        onPointerDown={beginPanelDrag}
        onPointerMove={movePanelDrag}
        onPointerUp={endPanelDrag}
        onPointerCancel={endPanelDrag}
      >
        <mesh position={[0, 0.5, 0.006]}>
          <planeGeometry args={[1.2, 0.13]} />
          <meshBasicMaterial
            color="#0e7490"
            opacity={0.92}
            side={DoubleSide}
            toneMapped={false}
            transparent
          />
        </mesh>
        <XRControlLabel position={[-0.56, 0.52, 0.012]} size={0.034}>
          Spatial anatomy controls
        </XRControlLabel>
        <XRControlLabel position={[-0.56, 0.45, 0.012]} size={0.02}>
          Drag this bar to move
        </XRControlLabel>
      </group>

      <XRControlLabel position={[-0.56, 0.37, 0.012]}>Model placement</XRControlLabel>
      <XRControlButton
        disabled={!onResetPlacement}
        label="Center"
        onSelect={onResetPlacement}
        position={[0.04, 0.37, 0.014]}
        selected
        size={[0.22, 0.085]}
      />
      <XRControlButton
        disabled={!onScaleTarget}
        label="Size -"
        onSelect={() => onScaleTarget?.(0.82)}
        position={[0.28, 0.37, 0.014]}
        size={[0.2, 0.085]}
      />
      <XRControlButton
        disabled={!onScaleTarget}
        label="Size +"
        onSelect={() => onScaleTarget?.(1.22)}
        position={[0.5, 0.37, 0.014]}
        size={[0.2, 0.085]}
      />

      <XRControlButton
        disabled={!onRotateTarget}
        label="Turn L"
        onPressStart={() => {
          heldRotateRef.current = { axis: 'y', sign: 1 }
        }}
        onPressEnd={() => {
          heldRotateRef.current = null
        }}
        position={[-0.5, 0.25, 0.014]}
        size={[0.16, 0.085]}
      />
      <XRControlButton
        disabled={!onRotateTarget}
        label="Turn R"
        onPressStart={() => {
          heldRotateRef.current = { axis: 'y', sign: -1 }
        }}
        onPressEnd={() => {
          heldRotateRef.current = null
        }}
        position={[-0.31, 0.25, 0.014]}
        size={[0.16, 0.085]}
      />
      <XRControlButton
        disabled={!onRotateTarget}
        label="Tilt U"
        onPressStart={() => {
          heldRotateRef.current = { axis: 'x', sign: -1 }
        }}
        onPressEnd={() => {
          heldRotateRef.current = null
        }}
        position={[-0.12, 0.25, 0.014]}
        size={[0.16, 0.085]}
      />
      <XRControlButton
        disabled={!onRotateTarget}
        label="Tilt D"
        onPressStart={() => {
          heldRotateRef.current = { axis: 'x', sign: 1 }
        }}
        onPressEnd={() => {
          heldRotateRef.current = null
        }}
        position={[0.07, 0.25, 0.014]}
        size={[0.16, 0.085]}
      />
      <XRControlButton
        disabled={!onRotateTarget}
        label="Roll L"
        onPressStart={() => {
          heldRotateRef.current = { axis: 'z', sign: 1 }
        }}
        onPressEnd={() => {
          heldRotateRef.current = null
        }}
        position={[0.26, 0.25, 0.014]}
        size={[0.16, 0.085]}
      />
      <XRControlButton
        disabled={!onRotateTarget}
        label="Roll R"
        onPressStart={() => {
          heldRotateRef.current = { axis: 'z', sign: -1 }
        }}
        onPressEnd={() => {
          heldRotateRef.current = null
        }}
        position={[0.45, 0.25, 0.014]}
        size={[0.16, 0.085]}
      />

      <XRControlLabel position={[-0.56, 0.13, 0.012]}>Structures menu</XRControlLabel>
      <XRControlButton
        disabled={!onToggleStructures}
        label={structuresOpen ? 'Hide structures' : 'Show structures'}
        onSelect={onToggleStructures}
        position={[0.2, 0.13, 0.014]}
        selected={structuresOpen}
        size={[0.34, 0.085]}
      />

      <XRControlLabel position={[-0.56, 0.01, 0.012]}>
        CT planes{' '}
        {volumeAvailable
          ? `${showCtPlanes ? 'on' : 'off'} ${Math.round(ctPlaneOpacity * 100)}%`
          : 'unavailable'}
      </XRControlLabel>
      <XRControlButton
        disabled={!volumeAvailable || !onToggleCtPlanes}
        label={showCtPlanes ? 'Hide' : 'Show'}
        onSelect={onToggleCtPlanes}
        position={[0.09, 0.01, 0.014]}
        selected={showCtPlanes}
        size={[0.19, 0.085]}
      />
      <XRSlider
        disabled={!volumeAvailable || !onCtPlaneOpacityChange}
        max={1}
        min={0}
        onChange={onCtPlaneOpacityChange}
        position={[0.42, 0.01, 0.014]}
        value={ctPlaneOpacity}
        width={0.42}
      />

      <XRControlLabel position={[-0.56, -0.12, 0.012]}>CT planes — tap to show/hide</XRControlLabel>
      {ORTHOGONAL_AXES.map((axis, index) => (
        <XRControlButton
          key={axis}
          disabled={!volumeAvailable || !onToggleActivePlane}
          label={AXIS_LABELS[axis]}
          onSelect={() => {
            // Tapping a plane toggles its own visibility (independent show/hide of axial / coronal /
            // sagittal) and makes it the axis the slice slider below controls.
            onActiveAxisChange?.(axis)
            onToggleActivePlane?.(axis)
          }}
          position={[0.02 + index * 0.24, -0.12, 0.014]}
          selected={showCtPlanes && (ctPlaneVisibility[axis] ?? true)}
          size={[0.22, 0.085]}
        />
      ))}

      <XRControlLabel position={[-0.56, -0.25, 0.012]}>
        {AXIS_LABELS[activeAxis]} slice {formatXRPercent(activeSlice)}
      </XRControlLabel>
      <XRSlider
        disabled={!volumeAvailable || !onSliceChange}
        max={100}
        min={0}
        onChange={(value) => onSliceChange?.(activeAxis, value)}
        position={[0.2, -0.25, 0.014]}
        throttleMs={80}
        value={activeSlice}
        width={0.6}
      />

      <XRControlLabel position={[-0.56, -0.38, 0.012]}>
        Clipping {getClipModeLabel(ctClipMode)}
      </XRControlLabel>
      <XRControlButton
        disabled={!volumeAvailable || !onCycleClipMode}
        label="Cycle mode"
        onSelect={onCycleClipMode}
        position={[0.13, -0.38, 0.014]}
        selected={ctClipMode !== 'none'}
        size={[0.28, 0.085]}
      />
      <XRControlLabel position={[0.34, -0.38, 0.012]} size={0.022}>
        {ctClipMode === 'none' ? '' : AXIS_LABELS[ctClipAxis]}
      </XRControlLabel>
    </group>
  )
}

const STRUCTURES_PER_PAGE = 5

// Group a segment for the Structures menu. Explicit `segment.group` wins; otherwise derive a sensible
// bucket from the name so existing models (mostly named lymph nodes / vessels / heart) group sanely.
function deriveSegmentGroup(segment: AnatomySegment): string {
  if (segment.group) {
    return segment.group
  }
  const text = `${segment.name} ${segment.id}`.toLowerCase()
  if (/lymph|node/.test(text)) return 'Lymph nodes'
  if (/aorta|arter|vein|venous|vena|cava|vessel|brachioceph|carotid|subclavian/.test(text)) {
    return 'Vessels'
  }
  if (/heart|atri|ventric|cardiac/.test(text)) return 'Heart'
  if (/airway|trachea|bronch|lung|lobe|carina|stent|fistula/.test(text)) return 'Airway & lungs'
  return 'Other'
}

function groupSegments(
  segments: AnatomySegment[],
): Array<{ name: string; segments: AnatomySegment[] }> {
  const order: string[] = []
  const map = new Map<string, AnatomySegment[]>()
  segments.forEach((segment) => {
    const group = deriveSegmentGroup(segment)
    if (!map.has(group)) {
      map.set(group, [])
      order.push(group)
    }
    map.get(group)!.push(segment)
  })
  return order.map((name) => ({ name, segments: map.get(name) ?? [] }))
}

/**
 * Separate, draggable in-headset menu for showing/hiding individual structures and whole groups
 * (lymph nodes, vessels, heart, …). Two levels: a group list with per-group "Show/Hide all", and a
 * paginated per-structure list reached via "Open". Same lock/drag/face-the-user behaviour as the
 * control panel (parked to the user's left); it does not track the head once placed.
 */
function XRStructuresPanel({
  visible,
  segments,
  visibleSegments,
  onToggleSegment,
  onSetGroupVisibility,
  onClose,
}: {
  visible: boolean
  segments: AnatomySegment[]
  visibleSegments: Record<string, boolean>
  onToggleSegment: (id: string) => void
  onSetGroupVisibility: (ids: string[], nextVisible: boolean) => void
  onClose: () => void
}) {
  const { gl } = useThree()
  const panelRef = useRef<Group | null>(null)
  const faceTmp = useMemo(() => new Vector3(), [])
  const placedRef = useRef(false)
  const dragRef = useRef<{ pointerId: number; distance: number; offset: Vector3 } | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const groups = useMemo(() => groupSegments(segments), [segments])

  // The panel unmounts when closed (gated render in AnatomyViewer), so group/page selection and
  // placement reset naturally on the next open via fresh state — no reset effect needed.

  const facePanelAtUser = () => {
    const panel = panelRef.current
    if (!panel) {
      return
    }
    faceTmp.setFromMatrixPosition(gl.xr.getCamera().matrixWorld)
    panel.rotation.set(0, Math.atan2(faceTmp.x - panel.position.x, faceTmp.z - panel.position.z), 0)
  }

  useFrame(() => {
    const panel = panelRef.current
    if (!panel || !visible || !gl.xr.isPresenting || placedRef.current) {
      return
    }
    const camera = gl.xr.getCamera()
    camera.updateMatrixWorld()
    const camPos = new Vector3().setFromMatrixPosition(camera.matrixWorld)
    const forward = new Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-4) {
      forward.set(0, 0, -1)
    }
    forward.normalize()
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    right.y = 0
    right.normalize()
    // Open the menu in front of the user (and a little to their left so it doesn't land on top of
    // the control panel), at eye level, then lock it. It was previously parked far to the left,
    // out of view, so opening it appeared to do nothing.
    panel.position.copy(camPos).addScaledVector(forward, 0.95).addScaledVector(right, -0.5)
    panel.position.y = camPos.y - 0.05
    facePanelAtUser()
    placedRef.current = true
  })

  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    const panel = panelRef.current
    if (!panel) {
      return
    }
    event.stopPropagation()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    const distance = Number.isFinite(event.distance)
      ? event.distance
      : event.ray.origin.distanceTo(event.point)
    const anchor = event.ray.origin
      .clone()
      .addScaledVector(event.ray.direction.clone().normalize(), distance)
    dragRef.current = {
      pointerId: event.pointerId,
      distance,
      offset: panel.position.clone().sub(anchor),
    }
  }

  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current
    const panel = panelRef.current
    if (!drag || !panel || event.pointerId !== drag.pointerId) {
      return
    }
    event.stopPropagation()
    const anchor = event.ray.origin
      .clone()
      .addScaledVector(event.ray.direction.clone().normalize(), drag.distance)
    panel.position.copy(anchor).add(drag.offset)
    facePanelAtUser()
  }

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return
    }
    dragRef.current = null
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  const activeGroup = selectedGroup ? (groups.find((g) => g.name === selectedGroup) ?? null) : null
  const pageCount = activeGroup
    ? Math.max(1, Math.ceil(activeGroup.segments.length / STRUCTURES_PER_PAGE))
    : 1
  const clampedPage = Math.min(page, pageCount - 1)
  const pageSegments = activeGroup
    ? activeGroup.segments.slice(
        clampedPage * STRUCTURES_PER_PAGE,
        clampedPage * STRUCTURES_PER_PAGE + STRUCTURES_PER_PAGE,
      )
    : []

  return (
    <group ref={panelRef} visible={visible}>
      <mesh position={[0, 0, -0.008]}>
        <planeGeometry args={[1.04, 1.16]} />
        <meshBasicMaterial color="#020617" opacity={0.97} side={DoubleSide} transparent />
      </mesh>
      <mesh position={[0, 0, -0.004]}>
        <planeGeometry args={[1.08, 1.2]} />
        <meshBasicMaterial color="#22d3ee" opacity={0.1} side={DoubleSide} transparent />
      </mesh>
      <group
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <mesh position={[0, 0.5, 0.006]}>
          <planeGeometry args={[1.02, 0.13]} />
          <meshBasicMaterial
            color="#0e7490"
            opacity={0.92}
            side={DoubleSide}
            toneMapped={false}
            transparent
          />
        </mesh>
        <XRControlLabel position={[-0.47, 0.5, 0.012]} size={0.03}>
          {activeGroup ? activeGroup.name : 'Structures — drag to move'}
        </XRControlLabel>
      </group>
      <XRControlButton
        label="Close"
        onSelect={onClose}
        position={[0.36, 0.5, 0.014]}
        size={[0.18, 0.085]}
      />

      {segments.length === 0 ? (
        <XRControlLabel position={[-0.47, 0.3, 0.012]}>No structures in this model</XRControlLabel>
      ) : !activeGroup ? (
        groups.map((group, index) => {
          const ids = group.segments.map((segment) => segment.id)
          const allVisible = group.segments.every((segment) => visibleSegments[segment.id] ?? true)
          const rowY = 0.34 - index * 0.13
          return (
            <group key={group.name}>
              <XRControlLabel position={[-0.47, rowY, 0.012]} size={0.022}>
                {`${group.name} (${group.segments.length})`}
              </XRControlLabel>
              <XRControlButton
                label={allVisible ? 'Hide all' : 'Show all'}
                onSelect={() => onSetGroupVisibility(ids, !allVisible)}
                position={[0.16, rowY, 0.014]}
                selected={allVisible}
                size={[0.21, 0.085]}
              />
              <XRControlButton
                label="Open"
                onSelect={() => {
                  setSelectedGroup(group.name)
                  setPage(0)
                }}
                position={[0.41, rowY, 0.014]}
                size={[0.15, 0.085]}
              />
            </group>
          )
        })
      ) : (
        <>
          <XRControlButton
            label="‹ Groups"
            onSelect={() => setSelectedGroup(null)}
            position={[-0.34, 0.34, 0.014]}
            size={[0.26, 0.085]}
          />
          {pageSegments.map((segment, index) => {
            const segmentVisible = visibleSegments[segment.id] ?? true
            const rowY = 0.2 - index * 0.115
            return (
              <group key={segment.id}>
                <XRControlLabel position={[-0.47, rowY, 0.012]} size={0.019}>
                  {segment.name}
                </XRControlLabel>
                <XRControlButton
                  label={segmentVisible ? 'Hide' : 'Show'}
                  onSelect={() => onToggleSegment(segment.id)}
                  position={[0.4, rowY, 0.014]}
                  selected={segmentVisible}
                  size={[0.18, 0.08]}
                />
              </group>
            )
          })}
          {pageCount > 1 ? (
            <>
              <XRControlButton
                disabled={clampedPage <= 0}
                label="Prev"
                onSelect={() => setPage((p) => Math.max(0, p - 1))}
                position={[-0.22, -0.45, 0.014]}
                size={[0.2, 0.085]}
              />
              <XRControlLabel position={[0.04, -0.45, 0.012]} size={0.02}>
                {`Page ${clampedPage + 1}/${pageCount}`}
              </XRControlLabel>
              <XRControlButton
                disabled={clampedPage >= pageCount - 1}
                label="Next"
                onSelect={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                position={[0.32, -0.45, 0.014]}
                size={[0.2, 0.085]}
              />
            </>
          ) : null}
        </>
      )}
    </group>
  )
}

type ActivePointerGrab = {
  pointerId: number
  startDirection: Vector3
  distance: number
  anchorToModel: Vector3
  startQuaternion: Quaternion
}

/**
 * Grab/move/rotate the anatomy via R3F pointer events. @react-three/xr funnels Quest controllers,
 * Quest hand-tracking, and Vision Pro transient-pointer pinch through the same pointer-event model,
 * so this single implementation works on all of them — unlike the old getController(0/1) path that
 * never received Vision Pro's pinch. The pointer ray is the grab proxy: the model follows the ray
 * (translation) and rotates with the ray's direction change. Pointer capture keeps move events
 * flowing even when the ray leaves the model mid-grab.
 */
function XRGrabbableModel({
  enabled,
  targetRef,
  onSelectSegment,
  children,
}: {
  enabled: boolean
  targetRef: RefObject<Group | null>
  onSelectSegment: (label: string | null) => void
  children: ReactNode
}) {
  const grabRef = useRef<ActivePointerGrab | null>(null)

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    const target = targetRef.current
    if (!target) {
      return
    }
    event.stopPropagation()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    const direction = event.ray.direction.clone().normalize()
    const distance = Number.isFinite(event.distance)
      ? event.distance
      : event.ray.origin.distanceTo(event.point)
    const anchor = event.ray.origin.clone().addScaledVector(direction, distance)
    grabRef.current = {
      pointerId: event.pointerId,
      startDirection: direction,
      distance,
      anchorToModel: target.position.clone().sub(anchor),
      startQuaternion: target.quaternion.clone(),
    }
    onSelectSegment(getSegmentLabel(event.object))
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const grab = grabRef.current
    const target = targetRef.current
    if (!grab || !target || event.pointerId !== grab.pointerId) {
      return
    }
    event.stopPropagation()
    const direction = event.ray.direction.clone().normalize()
    const anchor = event.ray.origin.clone().addScaledVector(direction, grab.distance)
    const deltaQuaternion = new Quaternion().setFromUnitVectors(grab.startDirection, direction)
    target.position.copy(anchor).add(grab.anchorToModel.clone().applyQuaternion(deltaQuaternion))
    target.quaternion.copy(deltaQuaternion).multiply(grab.startQuaternion)
    target.updateMatrixWorld()
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const grab = grabRef.current
    if (!grab || event.pointerId !== grab.pointerId) {
      return
    }
    grabRef.current = null
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  const interactionHandlers = enabled
    ? {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
      }
    : {}

  return (
    <group ref={targetRef} {...interactionHandlers}>
      {children}
    </group>
  )
}

/**
 * three evaluates `material.clippingPlanes` in WORLD space, but the plane is authored in the model
 * group's LOCAL frame. Each frame we re-project local→world from the group's live matrix, so the
 * cut tracks the model through placement, scale, and grab. On desktop the group is at identity, so
 * world === local and clipping behaves exactly as before.
 */
function XRClippingController({
  enabled,
  localPlane,
  materials,
  targetRef,
}: {
  enabled: boolean
  localPlane: Plane | null
  materials: MeshStandardMaterial[]
  targetRef: RefObject<Group | null>
}) {
  const { gl } = useThree()
  const worldPlaneRef = useRef(new Plane())

  const projectToWorld = useCallback(() => {
    if (!localPlane) {
      return
    }
    const worldPlane = worldPlaneRef.current.copy(localPlane)
    const target = targetRef.current
    if (target) {
      target.updateMatrixWorld()
      worldPlane.applyMatrix4(target.matrixWorld)
    }
  }, [localPlane, targetRef])

  useEffect(() => {
    const active = enabled && localPlane != null
    // Toggling local clipping on the renderer is a required side effect (mirrors the prior code).
    // eslint-disable-next-line react-hooks/immutability
    gl.localClippingEnabled = active
    if (active) {
      projectToWorld()
    }
    materials.forEach((material) => {
      material.clippingPlanes = active ? [worldPlaneRef.current] : []
      material.needsUpdate = true
    })
    return () => {
      materials.forEach((material) => {
        material.clippingPlanes = []
        material.needsUpdate = true
      })
    }
  }, [enabled, localPlane, materials, gl, projectToWorld])

  useFrame(() => {
    if (!enabled || !localPlane) {
      return
    }
    projectToWorld()
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
  onToggleSegmentVisibility?: (id: string) => void
  onSetSegmentsVisibility?: (ids: string[], visible: boolean) => void
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
  onShowCtPlanesChange,
  onCtPlaneVisibilityChange,
  onCtPlaneSliceChange,
  onCtPlaneOpacityChange,
  onCtClipModeChange,
  onCtClipAxisChange,
  onVolumeSliceChange,
  onToggleSegmentVisibility,
  onSetSegmentsVisibility,
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
  const xrStore = useMemo(() => createAnatomyXRStore(), [])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [xrCapabilities, setXrCapabilities] = useState<XRCapabilities>({
    checked: false,
    hasWebXR: false,
    immersiveVR: false,
  })
  const [xrSessionActive, setXrSessionActive] = useState(false)
  const [spatialSelection, setSpatialSelection] = useState<string | null>(null)
  const [showStructuresPanel, setShowStructuresPanel] = useState(false)
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

  // The XR store owns the session; mirror its presence into local state so the existing
  // desktop/XR-gated logic (placement, OrbitControls toggle, control panel visibility) keeps working.
  useEffect(() => {
    const sync = (session: XRSession | undefined) => {
      const active = Boolean(session)
      setXrSessionActive(active)
      if (!active) {
        setSpatialSelection(null)
      }
    }
    sync(xrStore.getState().session)
    return xrStore.subscribe((state) => sync(state.session))
  }, [xrStore])

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
      setXrCapabilities({ checked: true, hasWebXR: false, immersiveVR: false })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const xrSystem = (navigator as Navigator & { xr?: XRSystem }).xr
        if (!xrSystem) {
          if (!cancelled) {
            setXrCapabilities({ checked: true, hasWebXR: false, immersiveVR: false })
          }
          return
        }

        if (!xrSystem.isSessionSupported) {
          if (!cancelled) {
            setXrCapabilities({ checked: true, hasWebXR: true, immersiveVR: false })
          }
          return
        }

        // VR is the single immersive mode we target: Vision Pro has no functional WebXR
        // immersive-ar, and we don't need passthrough, so VR works on both headsets.
        const vrSupported = await xrSystem.isSessionSupported('immersive-vr').catch(() => false)
        if (cancelled) return
        setXrCapabilities({ checked: true, hasWebXR: true, immersiveVR: vrSupported })
      } catch (error) {
        console.warn('WebXR session support check failed', error)
        if (!cancelled) {
          setXrCapabilities({ checked: true, hasWebXR: false, immersiveVR: false })
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

  // The XR store owns session lifecycle (request, reference space, features, teardown).
  // VR is the single mode; controllers, hands and Vision Pro transient-pointer are all wired by the store.
  const handleEnterXR = useCallback(() => {
    void xrStore.enterVR().then(
      (session) => {
        if (session) {
          setSpatialSelection(
            'Point at the anatomy and select to grab it. Use the panel to adjust.',
          )
        }
      },
      (error) => {
        console.error('Failed to start WebXR session', error)
        onError?.(
          'Unable to start immersive session. Please check browser settings and permissions.',
        )
      },
    )
  }, [onError, xrStore])

  const handleExitXR = useCallback(() => {
    void xrStore
      .getState()
      .session?.end()
      ?.catch(() => {})
  }, [xrStore])

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

  const handleXrResetPlacement = useCallback(() => {
    const root = spatialRootRef.current
    if (!root || !spatialPlacement) {
      return
    }
    applySpatialPlacement(root, spatialPlacement)
    setSpatialSelection('Anatomy centered')
  }, [spatialPlacement])

  const handleXrScaleTarget = useCallback((factor: number) => {
    const root = spatialRootRef.current
    if (!root || !Number.isFinite(factor)) {
      return
    }
    const nextScale = clamp(root.scale.x * factor, XR_MIN_SPATIAL_SCALE, XR_MAX_SPATIAL_SCALE)
    root.scale.setScalar(nextScale)
    root.updateMatrixWorld(true)
    setSpatialSelection(factor > 1 ? 'Anatomy enlarged' : 'Anatomy reduced')
  }, [])

  // Continuous rotate while a Turn/Tilt button is held. Called every frame by the panel with a small
  // per-frame angle; rotates about WORLD axes so "turn" always spins around vertical regardless of
  // the model's current orientation. No setState here — it runs every frame while a button is held.
  const handleXrRotateTarget = useCallback((axis: 'x' | 'y' | 'z', radians: number) => {
    const root = spatialRootRef.current
    if (!root || !Number.isFinite(radians)) {
      return
    }
    const worldAxis =
      axis === 'y'
        ? XR_ROTATE_WORLD_UP
        : axis === 'z'
          ? XR_ROTATE_WORLD_FORWARD
          : XR_ROTATE_WORLD_RIGHT
    root.rotateOnWorldAxis(worldAxis, radians)
    root.updateMatrixWorld(true)
  }, [])

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

  const clipMaterials = useMemo(() => {
    if (!preparedScene) {
      return [] as MeshStandardMaterial[]
    }
    return Object.values(preparedScene.segmentMeshes)
      .flat()
      .map((mesh) => mesh.material as MeshStandardMaterial)
  }, [preparedScene])

  // The clipping plane is computed here in the model group's LOCAL frame. XRClippingController
  // re-projects it into world space from the group's live matrix every frame, so the cut tracks
  // the model as it is placed, scaled, and grab-rotated in XR (three evaluates clippingPlanes in
  // world space — the previous code applied a model-space plane directly, so it drifted in XR).
  const localClipPlane = useMemo(() => {
    if (!preparedScene) {
      return null
    }
    const ctClippingEnabled =
      ctClipMode !== 'none' &&
      volumeState.status === 'success' &&
      Boolean(preparedScene.patientToModelMatrix)
    if (
      ctClippingEnabled &&
      volumeState.status === 'success' &&
      preparedScene.patientToModelMatrix
    ) {
      const volumeToModelMatrix = getVolumeToModelMatrix(
        preparedScene.patientToModelMatrix,
        volumeState,
        effectiveCtAlignment,
        model.volume?.volumeCenterPatientMm,
      )
      return createVolumeClippingPlane({
        axis: ctClipAxis,
        mode: ctClipMode,
        percentage: effectiveCtPlaneSlices[ctClipAxis],
        volumeState,
        volumeToModelMatrix,
      })
    }
    if (crossSection > 0) {
      return new Plane(
        new Vector3(0, -1, 0),
        computePlaneConstant(preparedScene.boundingBox, crossSection),
      )
    }
    return null
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

  const clippingEnabled = localClipPlane != null

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

    // three.js Volume window/level are intentionally mutable runtime properties; the
    // react-hooks/immutability rule false-positives on this three.js object mutation.
    /* eslint-disable react-hooks/immutability */
    volume.windowLow = windowLow
    volume.windowHigh = windowHigh
    volume.lowerThreshold = Number.NEGATIVE_INFINITY
    volume.upperThreshold = Number.POSITIVE_INFINITY
    /* eslint-enable react-hooks/immutability */

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
      void xrStore
        .getState()
        .session?.end()
        ?.catch(() => {})
    }
  }, [xrStore])

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
    if (!xrCapabilities.immersiveVR) {
      return 'WebXR is present, but no immersive VR session is available here.'
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
                onClick={handleEnterXR}
                className="inline-flex min-h-9 items-center rounded-full border border-cyan-300/35 bg-cyan-300/15 px-3 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/25"
              >
                Enter VR
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
            <XR store={xrStore}>
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
              {xrSessionActive ? (
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
                  <XRGrabbableModel
                    enabled={xrSessionActive}
                    targetRef={spatialRootRef}
                    onSelectSegment={setSpatialSelection}
                  >
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
                  </XRGrabbableModel>
                  <XRClippingController
                    enabled={clippingEnabled}
                    localPlane={localClipPlane}
                    materials={clipMaterials}
                    targetRef={spatialRootRef}
                  />
                  {xrSessionActive ? (
                    <XRControlPanel
                      activeAxis={xrControlAxis}
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
                      onResetPlacement={spatialPlacement ? handleXrResetPlacement : undefined}
                      onScaleTarget={handleXrScaleTarget}
                      onRotateTarget={handleXrRotateTarget}
                      onCtPlaneOpacityChange={onCtPlaneOpacityChange}
                      onSliceChange={
                        onCtPlaneSliceChange || onVolumeSliceChange
                          ? handleCtPlaneSliceChange
                          : undefined
                      }
                      onToggleActivePlane={
                        onCtPlaneVisibilityChange ? handleXrToggleActivePlane : undefined
                      }
                      onToggleCtPlanes={onShowCtPlanesChange ? handleXrToggleCtPlanes : undefined}
                      onToggleStructures={
                        onToggleSegmentVisibility
                          ? () => setShowStructuresPanel((open) => !open)
                          : undefined
                      }
                      structuresOpen={showStructuresPanel}
                    />
                  ) : null}
                  {xrSessionActive && showStructuresPanel && onToggleSegmentVisibility ? (
                    <XRStructuresPanel
                      visible
                      segments={model.segments}
                      visibleSegments={visibleSegments}
                      onToggleSegment={onToggleSegmentVisibility}
                      onSetGroupVisibility={onSetSegmentsVisibility ?? (() => undefined)}
                      onClose={() => setShowStructuresPanel(false)}
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
            </XR>
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
