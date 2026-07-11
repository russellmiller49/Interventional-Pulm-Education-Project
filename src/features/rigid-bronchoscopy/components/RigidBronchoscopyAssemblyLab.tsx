'use client'

import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { useReducedMotion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Check,
  CircleHelp,
  Eye,
  Focus,
  Hand,
  Lightbulb,
  ListChecks,
  Move3D,
  Orbit,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Route,
  Scan,
  Undo2,
  Wind,
  Wrench,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box3,
  CatmullRomCurve3,
  DoubleSide,
  MOUSE,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Plane,
  PropertyBinding,
  TOUCH,
  Vector3,
} from 'three'
import type { Color, Group, Material, Object3D } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { Button } from '@/components/ui/button'
import {
  RIGID_BRONCHOSCOPY_AIRWAY_ASSET_PATH,
  transformVentilationScopePoint,
  VENTILATION_FENESTRATION_LOCAL_XS,
} from '@/features/rigid-bronchoscopy/content/assemblyAirway'
import {
  getVentilationComparison,
  ventilationAirwayGeometry,
  ventilationModeIds,
  ventilationPredictionIds,
  ventilationScopePositionIds,
  type VentilationComparison,
  type VentilationModeId,
  type VentilationPredictionId,
  type VentilationScopePositionId,
} from '@/features/rigid-bronchoscopy/content/assemblyVentilation'
import {
  ASSEMBLY_KIT_ASSET_PATH,
  ASSEMBLY_BASE_PART_ID,
  ANY_TUBE_PREREQUISITE_ID,
  assemblySteps,
  assemblyToolParts,
  bronchoscopeTubeOptions,
  getAssemblyPart,
  type AssemblyPartDefinition,
  type AssemblyPartId,
  type AssemblyTransform,
} from '@/features/rigid-bronchoscopy/content/assemblyParts'
import {
  assemblyPathwayIds,
  getAssemblyPathway,
  getTubeDistalX,
  type AssemblyPathwayId,
  type AssemblyPathwayLegendId,
  type AssemblyPathwaySegment,
} from '@/features/rigid-bronchoscopy/content/assemblyPathways'
import {
  canPlacePart,
  getRemainingAssemblyParts,
  getNextAssemblyStep,
  getPlacedTransform,
  isWithinSnapDistance,
  removeLastPlacedPart,
} from '@/features/rigid-bronchoscopy/engine/assembly'
import { cn } from '@/lib/cn'

type LabMode = 'assembly' | 'pathways' | 'tools'
type PositionTuple = readonly [number, number, number]
type ViewDragMode = 'orbit' | 'pan'
type ViewAction = 'center' | 'zoom-in' | 'zoom-out'
type AnimationStatus = 'ready' | 'playing' | 'paused' | 'complete'
type DistalEgressState = 'open' | 'blocked'

interface ViewCommand {
  action: ViewAction
  id: number
}

export function isPartDragGesture(
  event: Pick<PointerEvent, 'button' | 'ctrlKey' | 'metaKey' | 'pointerType' | 'shiftKey'>,
) {
  return (
    event.pointerType !== 'mouse' ||
    (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey)
  )
}

export interface RigidBronchoscopyAssemblyLabCopy {
  assemblyMode: string
  assemblyModeDescription: string
  animationComplete: string
  animationControlsLabel: string
  animationPaused: string
  animationPlaying: string
  animationReady: string
  animationStatusLabel: string
  centerView: string
  commitPrediction: string
  complete: string
  controlledProximalLeak: string
  conventionalPulsePattern: string
  conventionalVentilation: string
  conventionalVentilationDescription: string
  cutawayView: string
  description: string
  dragHelp: string
  egressBlocked: string
  egressBlockedDescription: string
  egressLabel: string
  egressOpen: string
  egressOpenDescription: string
  eyebrow: string
  fallbackTitle: string
  hint: string
  illuminationLegend: string
  inspiratoryFlowLegend: string
  imageLegend: string
  instrumentLegend: string
  instrumentRoute: string
  instrumentRouteDescription: string
  labModeLabel: string
  leakEffectLabel: string
  leakEgressContrast: string
  lowFrequencyJetPulsePattern: string
  lowFrequencyJetVentilation: string
  lowFrequencyJetVentilationDescription: string
  majorFenestrationLeak: string
  modelLabel: string
  modeledResultLabel: string
  orbitView: string
  opticsLight: string
  opticsLightDescription: string
  panView: string
  pathSafetyNote: string
  pathwayCanvasLabel: string
  pathwayHelp: string
  pathwayMode: string
  pathwayModeDescription: string
  pathwaySelectLabel: string
  pathwayTitle: string
  pauseAnimation: string
  playAnimation: string
  placeSelected: string
  removeLast: string
  reset: string
  resetAnimation: string
  resultBothBranches: string
  resultContralateralFenestrations: string
  resultMainstemOnly: string
  revealModeledFlow: string
  safetyNote: string
  sideFenestrationLegend: string
  sidePortAvailable: string
  sidePortFindingLabel: string
  sidePortNotApplicable: string
  sidePortUnavailable: string
  selectTube: string
  sequenceTitle: string
  title: string
  tipPositionLabel: string
  toolMode: string
  toolModeDescription: string
  toolsTitle: string
  viewControlsLabel: string
  viewHelp: string
  ventilationFlow: string
  ventilationFlowDescription: string
  ventilationLegend: string
  ventilationModeLabel: string
  ventilationScenarioIntro: string
  ventilationComparisonSafetyNote: string
  ventilationSourceNote: string
  bronchoscopePattern: string
  bronchoscopePatternDescription: string
  tracheoscopePattern: string
  tracheoscopePatternDescription: string
  tubePatternLabel: string
  positionAtCarina: string
  positionAtCarinaDescription: string
  positionPastCarina: string
  positionPastCarinaDescription: string
  positionProximalTrachea: string
  positionProximalTracheaDescription: string
  predictionCorrect: string
  predictionPrompt: string
  predictionReconsider: string
  predictionResetNotice: string
  predictionTitle: string
  predictBothBranches: string
  predictContralateralFenestrations: string
  predictMainstemOnly: string
  proximalLeakLegend: string
  pulsePatternLabel: string
  spontaneousAssistPulsePattern: string
  spontaneousAssistVentilation: string
  spontaneousAssistVentilationDescription: string
  openSystemProximalLeak: string
  tracheoscopeMainstemCaution: string
  highFrequencyJetPulsePattern: string
  highFrequencyJetVentilation: string
  highFrequencyJetVentilationDescription: string
  expiratoryEgressLegend: string
  yourPredictionLabel: string
  zoomIn: string
  zoomOut: string
}

const defaultCopy: RigidBronchoscopyAssemblyLabCopy = {
  assemblyMode: 'Assembly puzzle',
  assemblyModeDescription: 'Choose from every loose piece and connect it to the correct interface.',
  animationComplete: 'Static pathway shown for reduced-motion mode.',
  animationControlsLabel: 'Pathway animation controls',
  animationPaused: 'Animation paused.',
  animationPlaying: 'Animation playing.',
  animationReady: 'Ready to play.',
  animationStatusLabel: 'Animation status',
  centerView: 'Center view',
  commitPrediction: 'Commit prediction',
  complete: 'Assembly complete. Review the connection order before moving to the instruments.',
  controlledProximalLeak:
    'The conventional setup caps the proximal opening and uses circuit seals. No distal fenestration escape route lies above the cords; any residual leak is not quantified.',
  conventionalPulsePattern: 'Intermittent controlled positive-pressure breaths',
  conventionalVentilation: 'Conventional (controlled positive-pressure)',
  conventionalVentilationDescription:
    'Intermittent positive-pressure breaths enter through the ventilation port; circuit measures are used to limit leak.',
  cutawayView: 'Cutaway view',
  description:
    'Build a ventilating rigid bronchoscope, compare conventional, spontaneous-assisted, and low- or high-frequency jet ventilation, and inspect instruments that pass through the working lumen.',
  dragHelp:
    'All loose pieces are on the field. Select and drag one to its connector; Hint reveals its target.',
  egressBlocked: 'Blocked egress',
  egressBlockedDescription:
    'Gas remains trapped on the lung side of the distal obstruction, illustrating gas-trapping and barotrauma risk.',
  egressLabel: 'Distal airway open for expiration',
  egressOpen: 'Open egress',
  egressOpenDescription:
    'Expiratory gas returns from the lungs through the unobstructed distal airway and tube, then exits through the configured proximal outlet.',
  eyebrow: 'Interactive 3D practice',
  fallbackTitle: 'Text assembly guide',
  hint: 'Hint',
  illuminationLegend: 'Illumination outward',
  inspiratoryFlowLegend: 'Delivered or inspired flow',
  imageLegend: 'Image return',
  instrumentLegend: 'Instrument tip',
  instrumentRoute: 'Instrument route',
  instrumentRouteDescription:
    'Trace an instrument from a lateral gate through the shared working lumen to the distal tip.',
  labModeLabel: '3D teaching lab mode',
  leakEffectLabel: 'Modeled leak effect',
  leakEgressContrast:
    'Do not confuse proximal leak with blocked expiratory egress: leak can reduce delivery; blocked egress can trap gas.',
  lowFrequencyJetPulsePattern: 'Discrete lower-frequency jet pulses',
  lowFrequencyJetVentilation: 'Low-frequency jet ventilation',
  lowFrequencyJetVentilationDescription:
    'Discrete high-velocity jets are delivered at lower frequency; expiration remains passive.',
  majorFenestrationLeak:
    'In this shallow position, distal fenestrations lie above the cords and add an escape route. This may increase leak and reduce distal delivery; the magnitude is not calculated.',
  modelLabel: 'EFER-DUMON educational reconstruction',
  modeledResultLabel: 'Anatomical route result',
  orbitView: 'Orbit',
  opticsLight: 'Optics and light',
  opticsLightDescription:
    'Follow illumination from the light cable to the distal field and the returning image through the telescope to the camera head.',
  panView: 'Pan',
  pathSafetyNote:
    'Schematic pathways only—not a gas-flow, pressure, caliber, or compatibility simulator. Actual ventilation and accessory use depend on anatomy, obstruction, the exact device setup, manufacturer instructions, procedural conditions, and clinical judgment.',
  pathwayCanvasLabel: 'Interactive rigid bronchoscopy pathway model',
  pathwayHelp:
    'Play each route, pause at any point, or switch on the cutaway to see the pathway inside the assembled bronchoscope.',
  pathwayMode: 'Pathway lab',
  pathwayModeDescription:
    'Animate ventilation, instrument travel, and the optical-light path through the assembled set.',
  pathwaySelectLabel: 'Teaching pathway',
  pathwayTitle: 'Choose a pathway',
  pauseAnimation: 'Pause animation',
  playAnimation: 'Play animation',
  placeSelected: 'Place selected part',
  removeLast: 'Remove last',
  reset: 'Reset',
  resetAnimation: 'Reset animation',
  resultBothBranches:
    'Anatomically, both main bronchi remain downstream of the tube tip, so two distal branch routes are available before egress is considered.',
  resultContralateralFenestrations:
    'Anatomically, the distal lumen serves the entered main bronchus while correctly aligned bronchoscope fenestrations preserve a route toward the opposite main bronchus.',
  resultMainstemOnly:
    'Anatomically, the tracheoscope has no distal fenestrations, so after mainstem entry only the entered main bronchus has a direct distal route.',
  revealModeledFlow: 'Reveal modeled flow',
  safetyNote:
    'Educational reconstruction only. Confirm the current manufacturer instructions for use, compatibility, and local equipment checks before clinical use.',
  selectTube: 'Select interchangeable tube',
  sideFenestrationLegend: 'Contralateral fenestration flow',
  sidePortAvailable:
    'A correctly aligned long bronchoscope fenestration preserves a modeled route toward the opposite main bronchus.',
  sidePortFindingLabel: 'Distal side-fenestration finding',
  sidePortNotApplicable:
    'The tip has not entered a main bronchus, so contralateral fenestrations are not the deciding feature.',
  sidePortUnavailable:
    'This tracheoscope has no distal fenestration route toward the opposite main bronchus after mainstem entry.',
  sequenceTitle: 'Assembly pieces',
  title: 'Assemble a rigid bronchoscopy set',
  tipPositionLabel: 'Distal tip position',
  toolMode: 'Tool explorer',
  toolModeDescription: 'Compare the shape, scale, and function of commonly used rigid instruments.',
  toolsTitle: 'Select an instrument',
  viewControlsLabel: '3D view controls',
  viewHelp: 'Drag empty space using Orbit or Pan. Scroll or pinch to zoom toward the pointer.',
  ventilationFlow: 'Ventilation flow',
  ventilationFlowDescription:
    'Compare four shared-airway ventilation patterns, tube geometry, tip depth, proximal leak, and expiratory egress.',
  ventilationLegend: 'Ventilation path',
  ventilationModeLabel: 'Ventilation mode',
  ventilationScenarioIntro:
    'Change one variable at a time, predict the anatomical branch route, then reveal how ventilation mode, leak, and expiratory egress affect the displayed flow.',
  ventilationComparisonSafetyNote:
    'Schematic educational comparison only. It does not calculate delivered tidal volume, airway pressure, carbon dioxide clearance, or patient suitability. Actual ventilation requires anesthesia monitoring, device-specific setup, adequate expiratory egress, and clinical judgment.',
  ventilationSourceNote:
    'Source basis: Interventions in Pulmonary Medicine (2023), rigid bronchoscopy pp. 52–54 and anesthesia pp. 82–84; Pathak et al. (2014); EFER manufacturer tube specifications; and the Yang et al. (2025) physical bench model.',
  bronchoscopePattern: 'Bronchoscope — long bronchial pattern',
  bronchoscopePatternDescription: 'Matched BT2103-3 bronchial tube, 360 mm, 10.0/9.2 mm.',
  tracheoscopePattern: 'Tracheoscope — short tracheal pattern',
  tracheoscopePatternDescription: 'Matched BT2203-3 tracheal tube, 260 mm, 10.0/9.2 mm.',
  tubePatternLabel: 'Rigid tube pattern',
  positionAtCarina: 'At the carina',
  positionAtCarinaDescription: 'The distal tip sits at the tracheal bifurcation.',
  positionPastCarina: 'Past the carina',
  positionPastCarinaDescription: 'The distal tip enters one main bronchus.',
  positionProximalTrachea: 'Proximal trachea',
  positionProximalTracheaDescription:
    'The tube is seated through the cords in a shallow proximal position.',
  predictionCorrect: 'Your prediction matches this schematic.',
  predictionPrompt:
    'Before considering the separate egress warning, which anatomical distal branch route do the tube and tip position provide?',
  predictionReconsider: 'Compare your prediction with the highlighted route.',
  predictionResetNotice: 'Scenario changed. Make a new prediction before revealing flow.',
  predictionTitle: 'Predict before reveal',
  predictBothBranches: 'Both main bronchi remain downstream of the tube tip',
  predictContralateralFenestrations:
    'The opposite main bronchus remains reachable through bronchoscope fenestrations',
  predictMainstemOnly: 'Only the entered main bronchus has a direct distal route',
  proximalLeakLegend: 'Proximal leak',
  pulsePatternLabel: 'Modeled pulse pattern',
  spontaneousAssistPulsePattern: 'Patient-driven cycles with assisted breaths',
  spontaneousAssistVentilation: 'Spontaneous ventilation with assistance',
  spontaneousAssistVentilationDescription:
    'Patient-generated breathing continues while manual or pressure assistance is added when needed.',
  openSystemProximalLeak:
    'Spontaneous and jet setups retain an open proximal outlet. No distal fenestration escape route lies above the cords; delivery is not quantified.',
  tracheoscopeMainstemCaution:
    'Counterfactual comparison: advancing this short tracheal tube into a main bronchus is not its intended central-tracheal use.',
  highFrequencyJetPulsePattern: 'Rapid small-volume jet pulses',
  highFrequencyJetVentilation: 'High-frequency jet ventilation',
  highFrequencyJetVentilationDescription:
    'Rapid small-volume jets form a high-frequency pulse pattern; expiration remains passive.',
  expiratoryEgressLegend: 'Expiratory return / passive egress',
  yourPredictionLabel: 'Your prediction',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
}

const kitAssetUrl = ASSEMBLY_KIT_ASSET_PATH
const DEFAULT_CAMERA_POSITION: PositionTuple = [0, 3.2, 10]
const ASSEMBLY_CAMERA_TARGET: PositionTuple = [-0.2, -0.08, 0]
const TOOL_CAMERA_TARGET: PositionTuple = [0, 0, 0]
const VIEWER_BACKGROUND = '#081827'
const VIEWER_GRID_MAJOR = '#20455b'
const VIEWER_GRID_MINOR = '#112b3d'

export interface ViewerMaterialVisibilityProfile {
  depthWrite: boolean
  emissiveScale: number
  lightnessOffset: number
  metalnessCap: number
  opacity: number
  roughnessFloor: number
  saturationOffset: number
  transparent: boolean
}

export function getViewerMaterialVisibilityProfile(
  cutaway: boolean,
): ViewerMaterialVisibilityProfile {
  return cutaway
    ? {
        depthWrite: false,
        emissiveScale: 0.32,
        lightnessOffset: 0.3,
        metalnessCap: 0.24,
        opacity: 0.55,
        roughnessFloor: 0.5,
        saturationOffset: -0.08,
        transparent: true,
      }
    : {
        depthWrite: true,
        emissiveScale: 0.18,
        lightnessOffset: 0.17,
        metalnessCap: 0.38,
        opacity: 1,
        roughnessFloor: 0.4,
        saturationOffset: -0.04,
        transparent: false,
      }
}

export function getAirwayMaterialVisibilityProfile(cutaway: boolean) {
  return cutaway
    ? { emissiveIntensity: 0.82, opacity: 0.37 }
    : { emissiveIntensity: 0.58, opacity: 0.56 }
}

function InteractiveOrbitControls({
  dragMode,
  enabled = true,
  initialPosition,
  maxDistance,
  maxPolarAngle,
  minDistance,
  minPolarAngle,
  target,
  viewCommand,
}: {
  dragMode: ViewDragMode
  enabled?: boolean
  initialPosition: PositionTuple
  maxDistance: number
  maxPolarAngle?: number
  minDistance: number
  minPolarAngle?: number
  target: PositionTuple
  viewCommand: ViewCommand | null
}) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()

  useEffect(() => {
    const currentControls = controls.current
    if (!currentControls || !viewCommand) return

    if (viewCommand.action === 'center') {
      camera.position.set(...initialPosition)
      currentControls.target.set(...target)
    } else {
      const offset = camera.position.clone().sub(currentControls.target)
      if (offset.lengthSq() < 0.0001) {
        offset.set(
          initialPosition[0] - target[0],
          initialPosition[1] - target[1],
          initialPosition[2] - target[2],
        )
      }
      const zoomFactor = viewCommand.action === 'zoom-in' ? 0.72 : 1 / 0.72
      const nextDistance = MathUtils.clamp(offset.length() * zoomFactor, minDistance, maxDistance)
      camera.position.copy(currentControls.target).add(offset.setLength(nextDistance))
    }

    camera.updateProjectionMatrix()
    currentControls.update()
  }, [camera, initialPosition, maxDistance, minDistance, target, viewCommand])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={enabled}
      enablePan
      enableRotate
      enableZoom
      screenSpacePanning
      zoomToCursor
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={minPolarAngle}
      maxPolarAngle={maxPolarAngle}
      target={target}
      mouseButtons={{
        LEFT: dragMode === 'pan' ? MOUSE.PAN : MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: dragMode === 'pan' ? MOUSE.ROTATE : MOUSE.PAN,
      }}
      touches={{
        ONE: dragMode === 'pan' ? TOUCH.PAN : TOUCH.ROTATE,
        TWO: TOUCH.DOLLY_PAN,
      }}
    />
  )
}

function transformProps(transform: AssemblyTransform) {
  return {
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale ?? 1,
  }
}

export function cloneSemanticNode(scene: Object3D, nodeName: string) {
  const source =
    scene.getObjectByName(nodeName) ??
    scene.getObjectByName(PropertyBinding.sanitizeNodeName(nodeName))
  return source?.clone(true) ?? null
}

function cloneVisibleSemanticNode(scene: Object3D, nodeName: string, cutaway: boolean) {
  const model = cloneSemanticNode(scene, nodeName)
  const ownedMaterials: Material[] = []
  if (!model) return { model: null, ownedMaterials }

  const profile = getViewerMaterialVisibilityProfile(cutaway)
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.raycast = () => {}
    child.renderOrder = cutaway ? 1 : 0

    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
    const materials = sourceMaterials.map((sourceMaterial) => {
      const material = sourceMaterial.clone() as Material & {
        color?: Color
        emissive?: Color
        emissiveIntensity?: number
        metalness?: number
        roughness?: number
      }

      material.color?.offsetHSL(0, profile.saturationOffset, profile.lightnessOffset)
      if (material.emissive && material.color) {
        material.emissive.copy(material.color).multiplyScalar(profile.emissiveScale)
        material.emissiveIntensity = 1
      }
      if (typeof material.metalness === 'number') {
        material.metalness = Math.min(material.metalness, profile.metalnessCap)
      }
      if (typeof material.roughness === 'number') {
        material.roughness = Math.max(material.roughness, profile.roughnessFloor)
      }
      material.depthWrite = profile.depthWrite
      material.forceSinglePass = true
      material.opacity = profile.opacity
      material.side = DoubleSide
      material.transparent = profile.transparent
      material.needsUpdate = true
      ownedMaterials.push(material)
      return material
    })
    child.material = Array.isArray(child.material) ? materials : materials[0]
  })

  return { model, ownedMaterials }
}

function useVisibleSemanticNode(scene: Object3D, nodeName: string, cutaway = false) {
  const clone = useMemo(
    () => cloneVisibleSemanticNode(scene, nodeName, cutaway),
    [cutaway, nodeName, scene],
  )

  useEffect(
    () => () => {
      clone.ownedMaterials.forEach((material) => material.dispose())
    },
    [clone],
  )

  return clone.model
}

function makeGhostClone(scene: Object3D, nodeName: string) {
  const clone = cloneSemanticNode(scene, nodeName)
  if (!clone) return null

  clone.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
    const materials = sourceMaterials.map((sourceMaterial) => {
      const material = sourceMaterial.clone() as Material & {
        color?: Color
        depthWrite: boolean
        opacity: number
        transparent: boolean
      }
      material.color?.set('#22d3ee')
      material.depthWrite = false
      material.opacity = 0.26
      material.transparent = true
      return material
    })
    child.material = Array.isArray(child.material) ? materials : materials[0]
    child.raycast = () => {}
  })

  return clone
}

function SemanticPart({
  part,
  scene,
  transform,
}: {
  part: AssemblyPartDefinition
  scene: Object3D
  transform: AssemblyTransform
}) {
  const model = useVisibleSemanticNode(scene, part.nodeName)

  if (!model) return null

  return (
    <group {...transformProps(transform)}>
      <primitive object={model} />
    </group>
  )
}

function TeachingSemanticPart({
  cutaway,
  part,
  scene,
}: {
  cutaway: boolean
  part: AssemblyPartDefinition
  scene: Object3D
}) {
  const model = useVisibleSemanticNode(scene, part.nodeName, cutaway)

  if (!model) return null

  return (
    <group {...transformProps(getPlacedTransform(part))}>
      <primitive object={model} />
    </group>
  )
}

function AnimatedPathwaySegment({
  playing,
  reducedMotion,
  resetVersion,
  segment,
}: {
  playing: boolean
  reducedMotion: boolean
  resetVersion: number
  segment: AssemblyPathwaySegment
}) {
  const phase = useRef(0)
  const burstPhase = useRef(0)
  const particles = useRef<Mesh[]>([])
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        segment.points.map(([x, y, z]) => new Vector3(x, y, z)),
        false,
        'centripetal',
      ),
    [segment.points],
  )

  useEffect(() => {
    phase.current = 0
    burstPhase.current = 0
  }, [resetVersion, segment.id])

  useFrame((_, delta) => {
    if (playing && !reducedMotion) {
      phase.current = (phase.current + delta * segment.speed) % 1
      burstPhase.current += delta
    }
    const burstVisible =
      !playing ||
      reducedMotion ||
      !segment.burstFrequencyHz ||
      (burstPhase.current * segment.burstFrequencyHz) % 1 < (segment.burstDutyCycle ?? 0.5)
    particles.current.forEach((particle, index) => {
      const offset = (index / Math.max(segment.particleCount - 1, 1)) * (segment.particleSpan ?? 1)
      const rawProgress = (phase.current + offset) % 1
      const progress = segment.reverse ? 1 - rawProgress : rawProgress
      curve.getPointAt(progress, particle.position)
      particle.visible = burstVisible
    })
  })

  return (
    <>
      <mesh renderOrder={3}>
        <tubeGeometry args={[curve, 72, segment.radius, 10, false]} />
        <meshBasicMaterial
          color={segment.color}
          depthTest={false}
          depthWrite={false}
          opacity={0.42}
          toneMapped={false}
          transparent
        />
      </mesh>
      {Array.from({ length: segment.particleCount }, (_, index) => (
        <mesh
          key={`${segment.id}-particle-${index}`}
          ref={(mesh) => {
            if (mesh) particles.current[index] = mesh
          }}
          renderOrder={4}
        >
          <sphereGeometry args={[segment.particleRadius, 14, 10]} />
          <meshBasicMaterial
            color={segment.particleColor}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  )
}

function DistalObstructionMarker({
  playing,
  position,
  reducedMotion,
}: {
  playing: boolean
  position: PositionTuple
  reducedMotion: boolean
}) {
  const halo = useRef<Mesh>(null)
  const phase = useRef(0)

  useFrame((_, delta) => {
    if (playing && !reducedMotion) phase.current += delta * 3.2
    const scale = reducedMotion ? 1 : 1 + Math.sin(phase.current) * 0.16
    halo.current?.scale.setScalar(scale)
  })

  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} renderOrder={5}>
        <cylinderGeometry args={[0.105, 0.105, 0.025, 32]} />
        <meshBasicMaterial
          color="#fb7185"
          depthTest={false}
          depthWrite={false}
          opacity={0.78}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh ref={halo} renderOrder={4}>
        <sphereGeometry args={[0.18, 20, 14]} />
        <meshBasicMaterial
          color="#f59e0b"
          depthTest={false}
          depthWrite={false}
          opacity={0.42}
          toneMapped={false}
          transparent
          wireframe
        />
      </mesh>
    </group>
  )
}

function TargetGhost({ part, scene }: { part: AssemblyPartDefinition; scene: Object3D }) {
  const ghost = useMemo(() => makeGhostClone(scene, part.nodeName), [part.nodeName, scene])

  if (!ghost) return null

  return (
    <group {...transformProps(getPlacedTransform(part))}>
      <primitive object={ghost} />
    </group>
  )
}

function DraggablePart({
  part,
  reducedMotion,
  resetVersion,
  scene,
  onDragChange,
  onDrop,
  onSelect,
}: {
  part: AssemblyPartDefinition
  reducedMotion: boolean
  resetVersion: number
  scene: Object3D
  onDragChange: (dragging: boolean) => void
  onDrop: (position: PositionTuple) => boolean
  onSelect: () => void
}) {
  const group = useRef<Group>(null)
  const drag = useRef<{
    offset: Vector3
    plane: Plane
    pointerId: number
  } | null>(null)
  const returning = useRef(false)
  const model = useVisibleSemanticNode(scene, part.nodeName)
  const start = part.start.position

  useEffect(() => {
    drag.current = null
    returning.current = false
    group.current?.position.set(...start)
  }, [part.id, resetVersion, start])

  useFrame((_, delta) => {
    if (!group.current || !returning.current) return
    const target = new Vector3(...start)
    if (reducedMotion) {
      group.current.position.copy(target)
      returning.current = false
      return
    }

    group.current.position.x = MathUtils.damp(group.current.position.x, target.x, 9, delta)
    group.current.position.y = MathUtils.damp(group.current.position.y, target.y, 9, delta)
    group.current.position.z = MathUtils.damp(group.current.position.z, target.z, 9, delta)
    if (group.current.position.distanceTo(target) < 0.015) {
      group.current.position.copy(target)
      returning.current = false
    }
  })

  if (!model) return null

  function beginDrag(event: ThreeEvent<PointerEvent>) {
    const target = group.current
    if (!target || !isPartDragGesture(event.nativeEvent)) return
    event.stopPropagation()
    onSelect()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    const targetPlaneZ = part.target.position[2]
    const plane = new Plane(new Vector3(0, 0, 1), -targetPlaneZ)
    const anchor = event.ray.intersectPlane(plane, new Vector3())
    if (!anchor) return
    drag.current = {
      offset: new Vector3(target.position.x - anchor.x, target.position.y - anchor.y, 0),
      plane,
      pointerId: event.pointerId,
    }
    target.position.z = targetPlaneZ
    returning.current = false
    onDragChange(true)
  }

  function moveDrag(event: ThreeEvent<PointerEvent>) {
    const activeDrag = drag.current
    const target = group.current
    if (!activeDrag || !target || activeDrag.pointerId !== event.pointerId) return
    event.stopPropagation()
    const anchor = event.ray.intersectPlane(activeDrag.plane, new Vector3())
    if (!anchor) return
    target.position.copy(anchor).add(activeDrag.offset)
  }

  function endDrag(event: ThreeEvent<PointerEvent>) {
    const activeDrag = drag.current
    const target = group.current
    if (!activeDrag || !target || activeDrag.pointerId !== event.pointerId) return
    event.stopPropagation()
    drag.current = null
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
    const position = target.position.toArray() as [number, number, number]
    const placed = onDrop(position)
    if (!placed) returning.current = true
    onDragChange(false)
  }

  return (
    <group
      ref={group}
      position={part.start.position}
      rotation={part.start.rotation}
      scale={part.start.scale ?? 1}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {part.interactionRadius ? (
        <mesh>
          <sphereGeometry args={[part.interactionRadius, 16, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
      <primitive object={model} />
    </group>
  )
}

function AssemblyScene({
  hintPart,
  placedParts,
  remainingParts,
  reducedMotion,
  resetVersion,
  viewCommand,
  viewDragMode,
  onDrop,
  onSelect,
}: {
  hintPart: AssemblyPartDefinition | null
  placedParts: readonly AssemblyPartDefinition[]
  remainingParts: readonly AssemblyPartDefinition[]
  reducedMotion: boolean
  resetVersion: number
  viewCommand: ViewCommand | null
  viewDragMode: ViewDragMode
  onDrop: (part: AssemblyPartDefinition, position: PositionTuple) => boolean
  onSelect: (partId: AssemblyPartId) => void
}) {
  const { scene } = useGLTF(kitAssetUrl)
  const [dragging, setDragging] = useState(false)

  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#dff8ff', '#0b1220', 1.55]} />
      <directionalLight position={[4, 6, 5]} intensity={2.45} color="#f8fafc" />
      <directionalLight position={[-4, 1, -2]} intensity={1.15} color="#38bdf8" />
      <directionalLight position={[0, -1, 6]} intensity={1.6} color="#dbeafe" />
      <pointLight position={[-1.7, 1.4, 2.3]} intensity={0.7} color="#fbbf24" />

      {placedParts.map((part) => (
        <SemanticPart
          key={part.id}
          part={part}
          scene={scene}
          transform={getPlacedTransform(part)}
        />
      ))}

      {hintPart ? <TargetGhost part={hintPart} scene={scene} /> : null}

      {remainingParts.map((part) => (
        <DraggablePart
          key={`${part.id}-${resetVersion}`}
          part={part}
          reducedMotion={reducedMotion}
          resetVersion={resetVersion}
          scene={scene}
          onDragChange={setDragging}
          onDrop={(position) => onDrop(part, position)}
          onSelect={() => onSelect(part.id)}
        />
      ))}

      <gridHelper args={[12, 24, VIEWER_GRID_MAJOR, VIEWER_GRID_MINOR]} position={[0, -1.08, 0]} />
      <InteractiveOrbitControls
        dragMode={viewDragMode}
        enabled={!dragging}
        initialPosition={DEFAULT_CAMERA_POSITION}
        minDistance={1.35}
        maxDistance={14}
        minPolarAngle={0.45}
        maxPolarAngle={2.55}
        target={ASSEMBLY_CAMERA_TARGET}
        viewCommand={viewCommand}
      />
    </>
  )
}

function RealisticAirwaySurface({ cutaway }: { cutaway: boolean }) {
  const { scene } = useGLTF(RIGID_BRONCHOSCOPY_AIRWAY_ASSET_PATH)
  const airwayClone = useMemo(() => {
    const model = scene.clone(true)
    const materials: Material[] = []
    const profile = getAirwayMaterialVisibilityProfile(cutaway)

    model.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const material = new MeshStandardMaterial({
        color: '#eda58f',
        depthWrite: false,
        emissive: '#54251e',
        emissiveIntensity: profile.emissiveIntensity,
        metalness: 0,
        opacity: profile.opacity,
        roughness: 0.74,
        side: DoubleSide,
        transparent: true,
      })
      material.forceSinglePass = true
      child.material = material
      child.raycast = () => {}
      child.renderOrder = 0
      materials.push(material)
    })

    return { materials, model }
  }, [cutaway, scene])

  useEffect(
    () => () => {
      airwayClone.materials.forEach((material) => material.dispose())
    },
    [airwayClone],
  )

  return <primitive object={airwayClone.model} />
}

function VentilationAirwayContext({ cutaway }: { cutaway: boolean }) {
  return (
    <>
      <RealisticAirwaySurface cutaway={cutaway} />

      <group position={ventilationAirwayGeometry.glottis}>
        <mesh rotation={[0, Math.PI / 2, 0]} renderOrder={2}>
          <torusGeometry args={[0.19, 0.014, 10, 42]} />
          <meshBasicMaterial color="#f59e0b" opacity={0.72} transparent toneMapped={false} />
        </mesh>
        <mesh position={[0.01, 0.075, 0]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.025, 0.105, 0.12]} />
          <meshBasicMaterial color="#fde68a" opacity={0.7} transparent toneMapped={false} />
        </mesh>
        <mesh position={[0.01, -0.075, 0]} rotation={[0, 0, -0.15]}>
          <boxGeometry args={[0.025, 0.105, 0.12]} />
          <meshBasicMaterial color="#fde68a" opacity={0.7} transparent toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}

function FenestrationMarkers({ comparison }: { comparison: VentilationComparison }) {
  const markerWorldPositions = VENTILATION_FENESTRATION_LOCAL_XS.map((x) =>
    transformVentilationScopePoint(
      [x, ventilationAirwayGeometry.airwayY, 0.052],
      comparison.scopePose,
    ),
  )
  const carina = ventilationAirwayGeometry.carina
  const nearestCarinaIndex = markerWorldPositions.reduce((nearestIndex, point, index) => {
    const nearest = markerWorldPositions[nearestIndex]
    const nearestDistance = Math.hypot(
      nearest[0] - carina[0],
      nearest[1] - carina[1],
      nearest[2] - carina[2],
    )
    const distance = Math.hypot(point[0] - carina[0], point[1] - carina[1], point[2] - carina[2])
    return distance < nearestDistance ? index : nearestIndex
  }, 0)

  return (
    <>
      {VENTILATION_FENESTRATION_LOCAL_XS.map((x, index) => {
        const worldPosition = markerWorldPositions[index]
        const highlightsContralateralRoute =
          comparison.sideFenestrationFinding === 'available' && index === nearestCarinaIndex
        const highlightsProximalLeak =
          comparison.leakSeverity === 'fenestrations-above-cords' &&
          worldPosition[0] <= ventilationAirwayGeometry.glottisX + 0.02
        const highlighted = highlightsContralateralRoute || highlightsProximalLeak

        return (
          <mesh
            key={x}
            position={[x, ventilationAirwayGeometry.airwayY, 0.052]}
            renderOrder={highlighted ? 5 : 1}
            scale={[0.62, 0.19, 1]}
          >
            <torusGeometry args={[0.058, highlighted ? 0.012 : 0.008, 8, 24]} />
            <meshBasicMaterial
              color={
                highlightsContralateralRoute
                  ? '#fbbf24'
                  : highlightsProximalLeak
                    ? '#fb923c'
                    : '#64748b'
              }
              depthTest={!highlighted}
              depthWrite={false}
              opacity={highlighted ? 0.9 : 0.38}
              toneMapped={false}
              transparent
            />
          </mesh>
        )
      })}
    </>
  )
}

function VentilationComparisonScene({
  animationPlaying,
  animationResetVersion,
  comparison,
  cutaway,
  distalEgress,
  reducedMotion,
  revealed,
  tube,
  viewCommand,
  viewDragMode,
}: {
  animationPlaying: boolean
  animationResetVersion: number
  comparison: VentilationComparison
  cutaway: boolean
  distalEgress: DistalEgressState
  reducedMotion: boolean
  revealed: boolean
  tube: AssemblyPartDefinition
  viewCommand: ViewCommand | null
  viewDragMode: ViewDragMode
}) {
  const { scene } = useGLTF(kitAssetUrl)
  const { size } = useThree()
  const narrowCanvas = size.width < 600
  const visibleParts = useMemo(
    () =>
      [
        getAssemblyPart(ASSEMBLY_BASE_PART_ID),
        tube,
        getAssemblyPart('double-gate-lateral-obturator'),
        ...(comparison.mode === 'conventional'
          ? [getAssemblyPart('red-main-cap-5p5mm'), getAssemblyPart('rigid-telescope-bx5500-fa')]
          : []),
      ].filter((part): part is AssemblyPartDefinition => Boolean(part)),
    [comparison.mode, tube],
  )
  const assemblyProximalPoint = useMemo(
    () =>
      transformVentilationScopePoint(
        [-3.05, ventilationAirwayGeometry.airwayY, 0],
        comparison.scopePose,
      ),
    [comparison.scopePose],
  )
  const cameraTarget = useMemo<PositionTuple>(() => {
    const minX = Math.min(ventilationAirwayGeometry.boundsMin[0], assemblyProximalPoint[0])
    const maxX = Math.max(ventilationAirwayGeometry.boundsMax[0], assemblyProximalPoint[0])
    const minY = Math.min(ventilationAirwayGeometry.boundsMin[1], assemblyProximalPoint[1])
    const maxY = Math.max(ventilationAirwayGeometry.boundsMax[1], assemblyProximalPoint[1])
    return [
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (ventilationAirwayGeometry.boundsMin[2] + ventilationAirwayGeometry.boundsMax[2]) / 2,
    ]
  }, [assemblyProximalPoint])
  const cameraPosition = useMemo<PositionTuple>(() => {
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.45)
    const horizontalSpan =
      Math.max(ventilationAirwayGeometry.boundsMax[0], assemblyProximalPoint[0]) -
      Math.min(ventilationAirwayGeometry.boundsMin[0], assemblyProximalPoint[0])
    const verticalSpan =
      Math.max(ventilationAirwayGeometry.boundsMax[1], assemblyProximalPoint[1]) -
      Math.min(ventilationAirwayGeometry.boundsMin[1], assemblyProximalPoint[1])
    const horizontalDistance =
      (horizontalSpan * 0.56) / (Math.tan(MathUtils.degToRad(38 / 2)) * aspect)
    const verticalDistance = (verticalSpan * 0.7) / Math.tan(MathUtils.degToRad(38 / 2))
    const distance = MathUtils.clamp(
      Math.max(horizontalDistance, verticalDistance),
      narrowCanvas ? 18 : 11,
      narrowCanvas ? 28 : 18,
    )
    return [cameraTarget[0], cameraTarget[1] + 3.2, cameraTarget[2] + distance]
  }, [assemblyProximalPoint, cameraTarget, narrowCanvas, size.height, size.width])

  return (
    <>
      <ambientLight intensity={0.88} />
      <hemisphereLight args={['#dff8ff', '#0b1220', 1.5]} />
      <directionalLight position={[4, 6, 5]} intensity={2.35} color="#f8fafc" />
      <directionalLight position={[-4, 1, -2]} intensity={1.05} color="#38bdf8" />
      <directionalLight position={[0, -1, 6]} intensity={1.8} color="#dbeafe" />

      <VentilationAirwayContext cutaway={cutaway} />

      <group position={comparison.scopePose.worldTip} quaternion={comparison.scopePose.quaternion}>
        <group
          position={[
            -comparison.scopePose.localTip[0],
            -comparison.scopePose.localTip[1],
            -comparison.scopePose.localTip[2],
          ]}
        >
          {visibleParts.map((part) => (
            <TeachingSemanticPart key={part.id} cutaway={cutaway} part={part} scene={scene} />
          ))}
          {revealed && tube.hasDistalFenestrations ? (
            <FenestrationMarkers comparison={comparison} />
          ) : null}
        </group>
      </group>

      {revealed
        ? comparison.segments.map((segment) => (
            <AnimatedPathwaySegment
              key={`${segment.id}-${animationResetVersion}`}
              playing={animationPlaying}
              reducedMotion={reducedMotion}
              resetVersion={animationResetVersion}
              segment={segment}
            />
          ))
        : null}

      {revealed && distalEgress === 'blocked' ? (
        <DistalObstructionMarker
          playing={animationPlaying}
          position={comparison.obstructionPosition}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <gridHelper args={[12, 24, VIEWER_GRID_MAJOR, VIEWER_GRID_MINOR]} position={[0, -1.18, 0]} />
      <InteractiveOrbitControls
        dragMode={viewDragMode}
        initialPosition={cameraPosition}
        minDistance={1.35}
        maxDistance={narrowCanvas ? 30 : 20}
        minPolarAngle={0.45}
        maxPolarAngle={2.55}
        target={cameraTarget}
        viewCommand={viewCommand}
      />
    </>
  )
}

function PathwayScene({
  animationPlaying,
  animationResetVersion,
  cutaway,
  distalEgress,
  pathwayId,
  reducedMotion,
  tube,
  viewCommand,
  viewDragMode,
}: {
  animationPlaying: boolean
  animationResetVersion: number
  cutaway: boolean
  distalEgress: DistalEgressState
  pathwayId: AssemblyPathwayId
  reducedMotion: boolean
  tube: AssemblyPartDefinition
  viewCommand: ViewCommand | null
  viewDragMode: ViewDragMode
}) {
  const { scene } = useGLTF(kitAssetUrl)
  const assembledParts = useMemo(() => {
    const base = getAssemblyPart(ASSEMBLY_BASE_PART_ID)
    return [base, ...getAssemblyStepsForTube(tube)].filter((part): part is AssemblyPartDefinition =>
      Boolean(part),
    )
  }, [tube])
  const pathway = useMemo(
    () =>
      getAssemblyPathway(pathwayId, tube, {
        distalEgressOpen: distalEgress === 'open',
      }),
    [distalEgress, pathwayId, tube],
  )

  return (
    <>
      <ambientLight intensity={0.88} />
      <hemisphereLight args={['#dff8ff', '#0b1220', 1.5]} />
      <directionalLight position={[4, 6, 5]} intensity={2.35} color="#f8fafc" />
      <directionalLight position={[-4, 1, -2]} intensity={1.05} color="#38bdf8" />
      <directionalLight position={[0, -1, 6]} intensity={1.6} color="#dbeafe" />

      {assembledParts.map((part) => (
        <TeachingSemanticPart key={part.id} cutaway={cutaway} part={part} scene={scene} />
      ))}

      {pathway.segments.map((segment) => (
        <AnimatedPathwaySegment
          key={`${segment.id}-${animationResetVersion}`}
          playing={animationPlaying}
          reducedMotion={reducedMotion}
          resetVersion={animationResetVersion}
          segment={segment}
        />
      ))}

      {pathwayId === 'ventilation' && distalEgress === 'blocked' ? (
        <DistalObstructionMarker
          playing={animationPlaying}
          position={[getTubeDistalX(tube), -0.3, 0]}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <gridHelper args={[12, 24, VIEWER_GRID_MAJOR, VIEWER_GRID_MINOR]} position={[0, -1.08, 0]} />
      <InteractiveOrbitControls
        dragMode={viewDragMode}
        initialPosition={DEFAULT_CAMERA_POSITION}
        minDistance={1.35}
        maxDistance={14}
        minPolarAngle={0.45}
        maxPolarAngle={2.55}
        target={ASSEMBLY_CAMERA_TARGET}
        viewCommand={viewCommand}
      />
    </>
  )
}

function ToolScene({
  part,
  viewCommand,
  viewDragMode,
}: {
  part: AssemblyPartDefinition
  viewCommand: ViewCommand | null
  viewDragMode: ViewDragMode
}) {
  const { scene } = useGLTF(kitAssetUrl)
  const visibleModel = useVisibleSemanticNode(scene, part.nodeName)
  const normalized = useMemo(() => {
    const model = visibleModel
    if (!model) return null
    const bounds = new Box3().setFromObject(model)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
    return {
      model,
      offset: center.multiplyScalar(-1),
      scale: 4.7 / maxDimension,
    }
  }, [visibleModel])

  if (!normalized) return null

  return (
    <>
      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#e0f2fe', '#111827', 1.55]} />
      <directionalLight position={[4, 6, 6]} intensity={2.4} color="#f8fafc" />
      <directionalLight position={[-4, 1, -3]} intensity={1.1} color="#22d3ee" />
      <directionalLight position={[0, -1, 6]} intensity={1.8} color="#dbeafe" />
      <group scale={normalized.scale} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={normalized.model} position={normalized.offset} />
      </group>
      <gridHelper args={[10, 20, VIEWER_GRID_MAJOR, VIEWER_GRID_MINOR]} position={[0, -1.65, 0]} />
      <InteractiveOrbitControls
        dragMode={viewDragMode}
        initialPosition={DEFAULT_CAMERA_POSITION}
        minDistance={1.2}
        maxDistance={12}
        target={TOOL_CAMERA_TARGET}
        viewCommand={viewCommand}
      />
    </>
  )
}

function TextFallback({
  copy,
  steps,
}: {
  copy: RigidBronchoscopyAssemblyLabCopy
  steps: readonly AssemblyPartDefinition[]
}) {
  return (
    <div className="h-full min-h-[520px] overflow-y-auto p-7 text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
        {copy.fallbackTitle}
      </p>
      <ol className="mt-4 space-y-3 text-sm leading-6">
        {steps.map((part, index) => (
          <li key={part.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <span className="font-semibold text-white">
              {index + 1}. {part.label}
            </span>{' '}
            {part.description}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs leading-5 text-amber-100">{copy.safetyNote}</p>
    </div>
  )
}

function getAssemblyStepsForTube(tube: AssemblyPartDefinition) {
  const defaultTubeIndex = assemblySteps.findIndex((part) => part.category === 'tube')
  if (defaultTubeIndex < 0) return [tube, ...assemblySteps]
  return assemblySteps.map((part, index) => (index === defaultTubeIndex ? tube : part))
}

function partName(partId: AssemblyPartId) {
  if (partId === ANY_TUBE_PREREQUISITE_ID) return 'the selected ventilating tube'
  return getAssemblyPart(partId)?.shortLabel ?? getAssemblyPart(partId)?.label ?? partId
}

export function RigidBronchoscopyAssemblyLab({
  copy: copyOverrides,
  experience = 'practice',
}: {
  copy?: Partial<RigidBronchoscopyAssemblyLabCopy>
  experience?: 'practice' | 'demonstration'
}) {
  const copy = useMemo(() => ({ ...defaultCopy, ...copyOverrides }), [copyOverrides])
  const demonstration = experience === 'demonstration'
  const reducedMotion = Boolean(useReducedMotion())
  const defaultTube =
    assemblySteps.find((part) => part.category === 'tube') ?? bronchoscopeTubeOptions[0]
  const [mode, setMode] = useState<LabMode>('assembly')
  const [selectedTubeId, setSelectedTubeId] = useState<AssemblyPartId>(defaultTube.id)
  const [selectedPartId, setSelectedPartId] = useState<AssemblyPartId | null>(defaultTube.id)
  const [selectedToolId, setSelectedToolId] = useState<AssemblyPartId>(assemblyToolParts[0].id)
  const [placedIds, setPlacedIds] = useState<AssemblyPartId[]>([ASSEMBLY_BASE_PART_ID])
  const [feedback, setFeedback] = useState(
    'Start by selecting and seating an interchangeable tube.',
  )
  const [hintVisible, setHintVisible] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const [viewDragMode, setViewDragMode] = useState<ViewDragMode>('orbit')
  const [viewCommand, setViewCommand] = useState<ViewCommand | null>(null)
  const [selectedPathwayId, setSelectedPathwayId] = useState<AssemblyPathwayId>('ventilation')
  const [animationStatus, setAnimationStatus] = useState<AnimationStatus>('ready')
  const [animationResetVersion, setAnimationResetVersion] = useState(0)
  const [cutaway, setCutaway] = useState(false)
  const [distalEgress, setDistalEgress] = useState<DistalEgressState>('open')
  const [ventilationMode, setVentilationMode] = useState<VentilationModeId>('conventional')
  const [ventilationTubeId, setVentilationTubeId] = useState<AssemblyPartId>('tube-bt2103-3')
  const [ventilationPosition, setVentilationPosition] =
    useState<VentilationScopePositionId>('past-carina')
  const [ventilationPrediction, setVentilationPrediction] =
    useState<VentilationPredictionId | null>(null)
  const [committedVentilationPrediction, setCommittedVentilationPrediction] =
    useState<VentilationPredictionId | null>(null)
  const [ventilationRevealed, setVentilationRevealed] = useState(false)
  const [ventilationScenarioNotice, setVentilationScenarioNotice] = useState<{
    id: number
    message: string
  } | null>(null)

  const selectedTube =
    bronchoscopeTubeOptions.find((part) => part.id === selectedTubeId) ?? defaultTube
  const activeSteps = useMemo(() => getAssemblyStepsForTube(selectedTube), [selectedTube])
  const remainingParts = getRemainingAssemblyParts(placedIds, activeSteps)
  const recommendedPart = getNextAssemblyStep(placedIds, activeSteps)
  const selectedPart = demonstration
    ? recommendedPart
    : (remainingParts.find((part) => part.id === selectedPartId) ?? recommendedPart)
  const selectedTool =
    assemblyToolParts.find((part) => part.id === selectedToolId) ?? assemblyToolParts[0]
  const ventilationTube =
    bronchoscopeTubeOptions.find((part) => part.id === ventilationTubeId) ??
    bronchoscopeTubeOptions.find((part) => part.id === 'tube-bt2103-3') ??
    defaultTube
  const placedParts = placedIds
    .map((partId) => getAssemblyPart(partId))
    .filter((part): part is AssemblyPartDefinition => Boolean(part))
  const complete = remainingParts.length === 0
  const selectedPathway = useMemo(
    () =>
      getAssemblyPathway(selectedPathwayId, selectedTube, {
        distalEgressOpen: distalEgress === 'open',
      }),
    [distalEgress, selectedPathwayId, selectedTube],
  )
  const ventilationComparison = useMemo(
    () =>
      getVentilationComparison(ventilationMode, ventilationTube, {
        distalEgressOpen: distalEgress === 'open',
        position: ventilationPosition,
      }),
    [distalEgress, ventilationMode, ventilationPosition, ventilationTube],
  )
  const showVentilation = demonstration || ventilationRevealed
  const visiblePathwaySegments =
    selectedPathwayId === 'ventilation'
      ? showVentilation
        ? ventilationComparison.segments
        : []
      : selectedPathway.segments
  const visiblePathwayLegendSegments = visiblePathwaySegments.filter(
    (segment, index, segments) =>
      segments.findIndex((candidate) => candidate.legendId === segment.legendId) === index,
  )
  const pathwayTitle =
    selectedPathwayId === 'ventilation'
      ? copy.ventilationFlow
      : selectedPathwayId === 'instrument'
        ? copy.instrumentRoute
        : copy.opticsLight
  const pathwayDescription =
    selectedPathwayId === 'ventilation'
      ? copy.ventilationFlowDescription
      : selectedPathwayId === 'instrument'
        ? copy.instrumentRouteDescription
        : copy.opticsLightDescription
  const displayedAnimationStatus =
    reducedMotion && animationStatus === 'playing' ? 'complete' : animationStatus
  const animationStatusText =
    displayedAnimationStatus === 'playing'
      ? copy.animationPlaying
      : displayedAnimationStatus === 'paused'
        ? copy.animationPaused
        : displayedAnimationStatus === 'complete'
          ? copy.animationComplete
          : copy.animationReady

  function issueViewCommand(action: ViewAction) {
    setViewCommand((current) => ({ action, id: (current?.id ?? 0) + 1 }))
  }

  function changeMode(nextMode: LabMode) {
    setMode(nextMode)
    setViewDragMode('orbit')
    issueViewCommand('center')
    setAnimationStatus('ready')
    setAnimationResetVersion((version) => version + 1)
  }

  function selectPathway(pathwayId: AssemblyPathwayId) {
    setSelectedPathwayId(pathwayId)
    setAnimationStatus('ready')
    setAnimationResetVersion((version) => version + 1)
  }

  function resetVentilationReveal(announceScenarioChange = false) {
    setVentilationPrediction(null)
    setCommittedVentilationPrediction(null)
    setVentilationRevealed(false)
    setAnimationStatus('ready')
    setAnimationResetVersion((version) => version + 1)
    setVentilationScenarioNotice((current) =>
      announceScenarioChange
        ? {
            id: (current?.id ?? 0) + 1,
            message: copy.predictionResetNotice,
          }
        : null,
    )
  }

  function changeVentilationMode(nextMode: VentilationModeId) {
    setVentilationMode(nextMode)
    resetVentilationReveal(true)
    issueViewCommand('center')
  }

  function changeVentilationTube(nextTubeId: AssemblyPartId) {
    setVentilationTubeId(nextTubeId)
    resetVentilationReveal(true)
    issueViewCommand('center')
  }

  function changeVentilationPosition(nextPosition: VentilationScopePositionId) {
    setVentilationPosition(nextPosition)
    resetVentilationReveal(true)
    issueViewCommand('center')
  }

  function selectVentilationPrediction(prediction: VentilationPredictionId) {
    setVentilationPrediction(prediction)
    setCommittedVentilationPrediction(null)
    setVentilationRevealed(false)
    setVentilationScenarioNotice(null)
    setAnimationStatus('ready')
    setAnimationResetVersion((version) => version + 1)
  }

  function commitVentilationPrediction() {
    if (!ventilationPrediction) return
    setCommittedVentilationPrediction(ventilationPrediction)
    setVentilationRevealed(false)
    setVentilationScenarioNotice(null)
    setAnimationStatus('ready')
  }

  function revealVentilationFlow() {
    if (!committedVentilationPrediction) return
    setVentilationRevealed(true)
    setVentilationScenarioNotice(null)
    setAnimationResetVersion((version) => version + 1)
    setAnimationStatus(reducedMotion ? 'complete' : 'playing')
  }

  function toggleAnimation() {
    if (reducedMotion) {
      setAnimationStatus('complete')
      setAnimationResetVersion((version) => version + 1)
      return
    }
    setAnimationStatus((status) => (status === 'playing' ? 'paused' : 'playing'))
  }

  function resetAnimation() {
    setAnimationStatus('ready')
    setAnimationResetVersion((version) => version + 1)
  }

  function changeDistalEgress(nextState: DistalEgressState) {
    setDistalEgress(nextState)
    if (selectedPathwayId === 'ventilation') {
      resetVentilationReveal(true)
    } else {
      setAnimationStatus('ready')
      setAnimationResetVersion((version) => version + 1)
    }
  }

  function pathwayLegendLabel(legendId: AssemblyPathwayLegendId) {
    if (legendId === 'ventilation-flow') return copy.ventilationLegend
    if (legendId === 'inspiratory-flow') return copy.inspiratoryFlowLegend
    if (legendId === 'expiratory-egress') return copy.expiratoryEgressLegend
    if (legendId === 'side-fenestration-flow') return copy.sideFenestrationLegend
    if (legendId === 'proximal-leak') return copy.proximalLeakLegend
    if (legendId === 'instrument-tip') return copy.instrumentLegend
    if (legendId === 'illumination-outward') return copy.illuminationLegend
    return copy.imageLegend
  }

  function pathwayChoiceTitle(pathwayId: AssemblyPathwayId) {
    if (pathwayId === 'ventilation') return copy.ventilationFlow
    if (pathwayId === 'instrument') return copy.instrumentRoute
    return copy.opticsLight
  }

  function pathwayChoiceDescription(pathwayId: AssemblyPathwayId) {
    if (pathwayId === 'ventilation') return copy.ventilationFlowDescription
    if (pathwayId === 'instrument') return copy.instrumentRouteDescription
    return copy.opticsLightDescription
  }

  function ventilationModeTitle(modeId: VentilationModeId) {
    if (modeId === 'conventional') return copy.conventionalVentilation
    if (modeId === 'spontaneous-assist') return copy.spontaneousAssistVentilation
    if (modeId === 'low-frequency-jet') return copy.lowFrequencyJetVentilation
    return copy.highFrequencyJetVentilation
  }

  function ventilationModeDescription(modeId: VentilationModeId) {
    if (modeId === 'conventional') return copy.conventionalVentilationDescription
    if (modeId === 'spontaneous-assist') return copy.spontaneousAssistVentilationDescription
    if (modeId === 'low-frequency-jet') return copy.lowFrequencyJetVentilationDescription
    return copy.highFrequencyJetVentilationDescription
  }

  function ventilationPulsePattern(modeId: VentilationModeId) {
    if (modeId === 'conventional') return copy.conventionalPulsePattern
    if (modeId === 'spontaneous-assist') return copy.spontaneousAssistPulsePattern
    if (modeId === 'low-frequency-jet') return copy.lowFrequencyJetPulsePattern
    return copy.highFrequencyJetPulsePattern
  }

  function ventilationPositionTitle(positionId: VentilationScopePositionId) {
    if (positionId === 'proximal-trachea') return copy.positionProximalTrachea
    if (positionId === 'at-carina') return copy.positionAtCarina
    return copy.positionPastCarina
  }

  function ventilationPositionDescription(positionId: VentilationScopePositionId) {
    if (positionId === 'proximal-trachea') return copy.positionProximalTracheaDescription
    if (positionId === 'at-carina') return copy.positionAtCarinaDescription
    return copy.positionPastCarinaDescription
  }

  function predictionLabel(predictionId: VentilationPredictionId) {
    if (predictionId === 'both-branches') return copy.predictBothBranches
    if (predictionId === 'contralateral-fenestrations') {
      return copy.predictContralateralFenestrations
    }
    return copy.predictMainstemOnly
  }

  function ventilationResultText(predictionId: VentilationPredictionId) {
    if (predictionId === 'both-branches') return copy.resultBothBranches
    if (predictionId === 'contralateral-fenestrations') {
      return copy.resultContralateralFenestrations
    }
    return copy.resultMainstemOnly
  }

  function selectPart(partId: AssemblyPartId) {
    if (partId === selectedPartId) return
    setSelectedPartId(partId)
    setHintVisible(false)
    const part = activeSteps.find((candidate) => candidate.id === partId)
    if (part) setFeedback(`${part.label} selected. Find and connect its matching interface.`)
  }

  function placePart(
    part: AssemblyPartDefinition,
    requireProximity: boolean,
    position?: PositionTuple,
  ) {
    if (placedIds.includes(part.id)) return false

    const eligibility = canPlacePart(part, placedIds)
    if (!eligibility.allowed) {
      const missingNames = eligibility.missing.map(partName).join(', ')
      setFeedback(`Connect ${missingNames} before placing ${part.label}.`)
      return false
    }

    if (requireProximity && position && !isWithinSnapDistance(position, part)) {
      setFeedback(
        `${part.label} is not seated yet. Move it closer to its connector, or choose Hint to reveal the target.`,
      )
      return false
    }

    const nextPlacedIds = [...placedIds, part.id]
    setPlacedIds(nextPlacedIds)
    setSelectedPartId(getNextAssemblyStep(nextPlacedIds, activeSteps)?.id ?? null)
    setFeedback(`${part.label} seated. ${part.function ?? part.description}`)
    setHintVisible(false)
    return true
  }

  function resetAssembly(
    message = 'Assembly reset. Choose any loose piece and find its connector.',
    nextSelectedPartId: AssemblyPartId = selectedTubeId,
  ) {
    setPlacedIds([ASSEMBLY_BASE_PART_ID])
    setSelectedPartId(nextSelectedPartId)
    setFeedback(message)
    setHintVisible(false)
    setResetVersion((version) => version + 1)
  }

  function changeTube(nextTubeId: AssemblyPartId) {
    setSelectedTubeId(nextTubeId)
    resetAssembly('Tube changed. The newly selected tube is ready on the puzzle field.', nextTubeId)
    setAnimationStatus('ready')
    setAnimationResetVersion((version) => version + 1)
  }

  function removeLast() {
    const removedPartId = placedIds.findLast((id) => id !== ASSEMBLY_BASE_PART_ID)
    const nextIds = removeLastPlacedPart(placedIds)
    if (nextIds.length === placedIds.length) {
      setFeedback('The universal base stays on the field as the assembly starting point.')
      return
    }
    setPlacedIds(nextIds)
    setSelectedPartId(removedPartId ?? selectedTubeId)
    setFeedback('Last component removed. Replace it to continue.')
    setHintVisible(false)
    setResetVersion((version) => version + 1)
  }

  const selectedHint = selectedPart
    ? `Move ${selectedPart.shortLabel ?? selectedPart.label} to the cyan outline. ${
        selectedPart.prerequisites?.length
          ? `Its connection follows ${selectedPart.prerequisites.map(partName).join(', ')}.`
          : ''
      }`
    : copy.complete

  return (
    <section
      id="rigid-bronchoscopy-assembly-lab"
      className="rounded-3xl border border-slate-700/70 bg-slate-950 text-white shadow-xl"
      aria-labelledby="rigid-bronchoscopy-assembly-title"
    >
      <header className="rounded-t-3xl border-b border-slate-700/70 bg-gradient-to-r from-cyan-950/70 via-slate-950 to-slate-950 px-5 py-6 md:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          {copy.eyebrow}
        </p>
        <h2
          id="rigid-bronchoscopy-assembly-title"
          className="mt-2 text-2xl font-semibold md:text-3xl"
        >
          {copy.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{copy.description}</p>
      </header>

      <div className="grid items-start lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="relative h-[560px] overflow-hidden border-b border-slate-700/70 lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:max-h-[760px] lg:min-h-[620px] lg:border-b-0 lg:border-r">
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {feedback}
          </p>
          <CanvasErrorBoundary fallback={<TextFallback copy={copy} steps={activeSteps} />}>
            <Canvas
              key={`${mode}-${resetVersion}`}
              aria-label={
                mode === 'assembly'
                  ? 'Interactive rigid bronchoscope assembly model'
                  : mode === 'pathways'
                    ? copy.pathwayCanvasLabel
                    : `Interactive model of ${selectedTool.label}`
              }
              dpr={[1, 1.8]}
              camera={{ position: [0, 3.2, 10], fov: 38, near: 0.01, far: 100 }}
              gl={{ antialias: true, alpha: false }}
            >
              <color attach="background" args={[VIEWER_BACKGROUND]} />
              <Suspense fallback={null}>
                {mode === 'assembly' ? (
                  <AssemblyScene
                    hintPart={demonstration || hintVisible ? selectedPart : null}
                    placedParts={placedParts}
                    remainingParts={demonstration ? [] : remainingParts}
                    reducedMotion={reducedMotion}
                    resetVersion={resetVersion}
                    viewCommand={viewCommand}
                    viewDragMode={viewDragMode}
                    onDrop={(part, position) => placePart(part, true, position)}
                    onSelect={selectPart}
                  />
                ) : mode === 'pathways' ? (
                  selectedPathwayId === 'ventilation' ? (
                    <VentilationComparisonScene
                      animationPlaying={displayedAnimationStatus === 'playing'}
                      animationResetVersion={animationResetVersion}
                      comparison={ventilationComparison}
                      cutaway={cutaway}
                      distalEgress={distalEgress}
                      reducedMotion={reducedMotion}
                      revealed={showVentilation}
                      tube={ventilationTube}
                      viewCommand={viewCommand}
                      viewDragMode={viewDragMode}
                    />
                  ) : (
                    <PathwayScene
                      animationPlaying={displayedAnimationStatus === 'playing'}
                      animationResetVersion={animationResetVersion}
                      cutaway={cutaway}
                      distalEgress={distalEgress}
                      pathwayId={selectedPathwayId}
                      reducedMotion={reducedMotion}
                      tube={selectedTube}
                      viewCommand={viewCommand}
                      viewDragMode={viewDragMode}
                    />
                  )
                ) : (
                  <ToolScene
                    part={selectedTool}
                    viewCommand={viewCommand}
                    viewDragMode={viewDragMode}
                  />
                )}
              </Suspense>
            </Canvas>
          </CanvasErrorBoundary>

          <div className="absolute left-4 top-4 max-w-[min(320px,calc(100%-2rem))] rounded-xl border border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              {copy.modelLabel}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {mode === 'assembly'
                ? demonstration
                  ? (selectedPart?.description ?? copy.complete)
                  : copy.dragHelp
                : mode === 'pathways'
                  ? copy.pathwayHelp
                  : copy.viewHelp}
            </p>
            {mode !== 'tools' ? (
              <p className="mt-1 text-[11px] leading-4 text-cyan-100/80">{copy.viewHelp}</p>
            ) : null}
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              role="toolbar"
              aria-label={copy.viewControlsLabel}
            >
              <button
                type="button"
                aria-pressed={viewDragMode === 'orbit'}
                onClick={() => setViewDragMode('orbit')}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                  viewDragMode === 'orbit'
                    ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-50'
                    : 'border-slate-600 bg-slate-900/85 text-slate-200 hover:bg-slate-800',
                )}
              >
                <Orbit className="h-3.5 w-3.5" aria-hidden />
                {copy.orbitView}
              </button>
              <button
                type="button"
                aria-pressed={viewDragMode === 'pan'}
                onClick={() => setViewDragMode('pan')}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                  viewDragMode === 'pan'
                    ? 'border-cyan-300/60 bg-cyan-400/20 text-cyan-50'
                    : 'border-slate-600 bg-slate-900/85 text-slate-200 hover:bg-slate-800',
                )}
              >
                <Move3D className="h-3.5 w-3.5" aria-hidden />
                {copy.panView}
              </button>
              <button
                type="button"
                aria-label={copy.zoomIn}
                title={copy.zoomIn}
                onClick={() => issueViewCommand('zoom-in')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/85 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={copy.zoomOut}
                title={copy.zoomOut}
                onClick={() => issueViewCommand('zoom-out')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/85 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <ZoomOut className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={copy.centerView}
                title={copy.centerView}
                onClick={() => issueViewCommand('center')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/85 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <Focus className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {mode === 'assembly' && selectedPart ? (
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-cyan-400/25 bg-slate-950/90 p-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">
                  <Hand className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {demonstration ? selectedPart.label : `Selected piece: ${selectedPart.label}`}
                  </p>
                  <p className="text-xs text-slate-300">
                    {demonstration
                      ? (selectedPart.function ?? selectedPart.description)
                      : 'Drag it to the matching connector. Hint reveals the cyan target.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {mode === 'pathways' ? (
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-cyan-400/25 bg-slate-950/92 p-3 backdrop-blur">
              <div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{pathwayTitle}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{pathwayDescription}</p>
                </div>
                {visiblePathwayLegendSegments.length ? (
                  <div className="mt-2 flex flex-wrap gap-2" aria-label={copy.pathwaySelectLabel}>
                    {visiblePathwayLegendSegments.map((segment) => (
                      <span
                        key={segment.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/80 px-2.5 py-1 text-[10px] font-medium text-slate-100"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: segment.color }}
                          aria-hidden
                        />
                        {pathwayLegendLabel(segment.legendId)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-5 p-5 md:p-7">
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1"
            role="group"
            aria-label={copy.labModeLabel}
          >
            <button
              type="button"
              aria-pressed={mode === 'assembly'}
              onClick={() => changeMode('assembly')}
              className={cn(
                'rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                mode === 'assembly'
                  ? 'border-cyan-300/60 bg-cyan-400/15 text-white'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500',
              )}
            >
              <ListChecks className="h-4 w-4" aria-hidden />
              <span className="mt-2 block text-sm font-semibold">{copy.assemblyMode}</span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                {copy.assemblyModeDescription}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={mode === 'pathways'}
              onClick={() => changeMode('pathways')}
              className={cn(
                'rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                mode === 'pathways'
                  ? 'border-cyan-300/60 bg-cyan-400/15 text-white'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500',
              )}
            >
              <Route className="h-4 w-4" aria-hidden />
              <span className="mt-2 block text-sm font-semibold">{copy.pathwayMode}</span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                {copy.pathwayModeDescription}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={mode === 'tools'}
              onClick={() => changeMode('tools')}
              className={cn(
                'rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                mode === 'tools'
                  ? 'border-cyan-300/60 bg-cyan-400/15 text-white'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500',
              )}
            >
              <Wrench className="h-4 w-4" aria-hidden />
              <span className="mt-2 block text-sm font-semibold">{copy.toolMode}</span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                {copy.toolModeDescription}
              </span>
            </button>
          </div>

          {mode === 'assembly' ? (
            <>
              <div>
                <label
                  htmlFor="rigid-bronchoscopy-tube-select"
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400"
                >
                  {copy.selectTube}
                </label>
                <select
                  id="rigid-bronchoscopy-tube-select"
                  value={selectedTubeId}
                  onChange={(event) => changeTube(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                >
                  {bronchoscopeTubeOptions.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                      {complete
                        ? 'Set assembled'
                        : `${activeSteps.length - remainingParts.length} of ${activeSteps.length} pieces seated`}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {selectedPart?.label ?? 'Functional assembly complete'}
                    </h3>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                      complete
                        ? 'bg-emerald-400/15 text-emerald-200'
                        : 'bg-cyan-400/15 text-cyan-100',
                    )}
                  >
                    {complete ? 'Ready to review' : 'Selected'}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {selectedPart?.description ?? copy.complete}
                </p>
                {selectedPart ? (
                  <a
                    href={selectedPart.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs font-medium text-cyan-300 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-200"
                  >
                    Source: {selectedPart.source.label}
                  </a>
                ) : null}
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-cyan-300 transition-[width]"
                    style={{
                      width: `${Math.min(
                        100,
                        ((activeSteps.length - remainingParts.length) /
                          Math.max(activeSteps.length, 1)) *
                          100,
                      )}%`,
                      transitionDuration: reducedMotion ? '0ms' : undefined,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
                <p className="text-sm leading-6 text-slate-200" role="status" aria-live="polite">
                  {demonstration
                    ? (selectedPart?.function ?? selectedPart?.description ?? copy.complete)
                    : feedback}
                </p>
                {!demonstration && hintVisible ? (
                  <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                    <Lightbulb className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {selectedHint}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => selectedPart && placePart(selectedPart, false)}
                    disabled={!selectedPart}
                    className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    {copy.placeSelected}
                  </Button>
                  {!demonstration ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setHintVisible((value) => !value)}
                      disabled={!selectedPart}
                      className="border-slate-600 bg-slate-950 text-white hover:bg-slate-800"
                      aria-expanded={hintVisible}
                    >
                      <CircleHelp className="h-4 w-4" aria-hidden />
                      {copy.hint}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={removeLast}
                    className="text-slate-200 hover:bg-white/10 hover:text-white"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden />
                    {copy.removeLast}
                  </Button>
                  {!demonstration ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => resetAssembly()}
                      className="text-slate-200 hover:bg-white/10 hover:text-white"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      {copy.reset}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {copy.sequenceTitle}
                </p>
                <ol className="mt-3 space-y-2">
                  {activeSteps.map((part, index) => {
                    const isPlaced = placedIds.includes(part.id)
                    const isSelected = selectedPart?.id === part.id
                    return (
                      <li key={part.id}>
                        <button
                          type="button"
                          onClick={() => selectPart(part.id)}
                          disabled={demonstration || isPlaced}
                          aria-pressed={isSelected}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-default',
                            isSelected
                              ? 'border-cyan-300/55 bg-cyan-400/12 text-white'
                              : 'border-slate-800 bg-slate-900/50 text-slate-300',
                            isPlaced && 'opacity-75',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                              isPlaced
                                ? 'bg-emerald-400/20 text-emerald-200'
                                : 'bg-slate-700 text-slate-300',
                            )}
                          >
                            {isPlaced ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span>{part.shortLabel ?? part.label}</span>
                            {isSelected ? (
                              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                                Selected piece
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </>
          ) : mode === 'pathways' ? (
            <>
              {selectedPathwayId !== 'ventilation' ? (
                <div>
                  <label
                    htmlFor="rigid-bronchoscopy-pathway-tube-select"
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400"
                  >
                    {copy.selectTube}
                  </label>
                  <select
                    id="rigid-bronchoscopy-pathway-tube-select"
                    value={selectedTubeId}
                    onChange={(event) => changeTube(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    {bronchoscopeTubeOptions.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {copy.pathwayTitle}
                </p>
                <div className="mt-3 grid gap-2" role="group" aria-label={copy.pathwaySelectLabel}>
                  {assemblyPathwayIds.map((pathwayId) => {
                    const selected = selectedPathwayId === pathwayId
                    const PathwayIcon =
                      pathwayId === 'ventilation' ? Wind : pathwayId === 'instrument' ? Wrench : Eye
                    return (
                      <button
                        type="button"
                        key={pathwayId}
                        onClick={() => selectPathway(pathwayId)}
                        aria-pressed={selected}
                        className={cn(
                          'rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                          selected
                            ? 'border-cyan-300/55 bg-cyan-400/10 text-white'
                            : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500',
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <PathwayIcon className="h-4 w-4 text-cyan-200" aria-hidden />
                          {pathwayChoiceTitle(pathwayId)}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">
                          {pathwayChoiceDescription(pathwayId)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedPathwayId === 'ventilation' ? (
                <div className="space-y-4">
                  <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                    {ventilationScenarioNotice ? (
                      <span key={ventilationScenarioNotice.id}>
                        {ventilationScenarioNotice.message}
                      </span>
                    ) : null}
                  </p>
                  <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4 text-sm leading-6 text-cyan-50">
                    {copy.ventilationScenarioIntro}
                  </p>

                  <fieldset className="rounded-2xl border border-slate-700 bg-slate-900/55 p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {copy.ventilationModeLabel}
                    </legend>
                    <div className="mt-1 grid gap-2">
                      {ventilationModeIds.map((modeId) => (
                        <button
                          type="button"
                          key={modeId}
                          aria-pressed={ventilationMode === modeId}
                          onClick={() => changeVentilationMode(modeId)}
                          className={cn(
                            'rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                            ventilationMode === modeId
                              ? 'border-cyan-300/55 bg-cyan-400/10 text-white'
                              : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500',
                          )}
                        >
                          <span className="flex items-center gap-2 text-xs font-semibold">
                            <Activity className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
                            {ventilationModeTitle(modeId)}
                          </span>
                          <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                            {ventilationModeDescription(modeId)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {ventilationTube.tubeType === 'tracheal' &&
                  ventilationPosition === 'past-carina' ? (
                    <p className="flex gap-2 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {copy.tracheoscopeMainstemCaution}
                    </p>
                  ) : null}

                  <fieldset className="rounded-2xl border border-slate-700 bg-slate-900/55 p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {copy.tubePatternLabel}
                    </legend>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      {[
                        {
                          id: 'tube-bt2103-3',
                          title: copy.bronchoscopePattern,
                          description: copy.bronchoscopePatternDescription,
                        },
                        {
                          id: 'tube-bt2203-3',
                          title: copy.tracheoscopePattern,
                          description: copy.tracheoscopePatternDescription,
                        },
                      ].map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          aria-pressed={ventilationTubeId === option.id}
                          onClick={() => changeVentilationTube(option.id)}
                          className={cn(
                            'rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                            ventilationTubeId === option.id
                              ? 'border-amber-300/55 bg-amber-400/10 text-white'
                              : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500',
                          )}
                        >
                          <span className="text-xs font-semibold">{option.title}</span>
                          <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                            {option.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="rounded-2xl border border-slate-700 bg-slate-900/55 p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {copy.tipPositionLabel}
                    </legend>
                    <div className="mt-1 grid gap-2">
                      {ventilationScopePositionIds.map((positionId) => (
                        <button
                          type="button"
                          key={positionId}
                          aria-pressed={ventilationPosition === positionId}
                          onClick={() => changeVentilationPosition(positionId)}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                            ventilationPosition === positionId
                              ? 'border-violet-300/55 bg-violet-400/10 text-white'
                              : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500',
                          )}
                        >
                          <span className="text-xs font-semibold">
                            {ventilationPositionTitle(positionId)}
                          </span>
                          <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                            {ventilationPositionDescription(positionId)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="rounded-2xl border border-slate-700 bg-slate-900/55 p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {copy.egressLabel}
                    </legend>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-pressed={distalEgress === 'open'}
                        onClick={() => changeDistalEgress('open')}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                          distalEgress === 'open'
                            ? 'border-emerald-300/55 bg-emerald-400/12 text-emerald-100'
                            : 'border-slate-700 bg-slate-950/60 text-slate-300',
                        )}
                      >
                        {copy.egressOpen}
                      </button>
                      <button
                        type="button"
                        aria-pressed={distalEgress === 'blocked'}
                        onClick={() => changeDistalEgress('blocked')}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                          distalEgress === 'blocked'
                            ? 'border-rose-300/55 bg-rose-400/12 text-rose-100'
                            : 'border-slate-700 bg-slate-950/60 text-slate-300',
                        )}
                      >
                        {copy.egressBlocked}
                      </button>
                    </div>
                    <p
                      className={cn(
                        'mt-3 text-xs leading-5',
                        distalEgress === 'open' ? 'text-emerald-100' : 'text-amber-100',
                      )}
                    >
                      {distalEgress === 'open'
                        ? copy.egressOpenDescription
                        : copy.egressBlockedDescription}
                    </p>
                    <p className="mt-2 text-[11px] leading-4 text-slate-400">
                      {copy.leakEgressContrast}
                    </p>
                  </fieldset>

                  {!demonstration ? (
                    <section
                      className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4"
                      aria-labelledby="ventilation-prediction-title"
                    >
                      <h3 id="ventilation-prediction-title" className="text-lg font-semibold">
                        {copy.predictionTitle}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {copy.predictionPrompt}
                      </p>
                      <div
                        className="mt-3 grid gap-2"
                        role="group"
                        aria-label={copy.predictionPrompt}
                      >
                        {ventilationPredictionIds.map((predictionId) => (
                          <button
                            type="button"
                            key={predictionId}
                            aria-pressed={ventilationPrediction === predictionId}
                            onClick={() => selectVentilationPrediction(predictionId)}
                            className={cn(
                              'rounded-xl border px-3 py-2.5 text-left text-xs leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                              ventilationPrediction === predictionId
                                ? 'border-cyan-300/55 bg-cyan-400/10 text-white'
                                : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500',
                            )}
                          >
                            {predictionLabel(predictionId)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!ventilationPrediction}
                          onClick={commitVentilationPrediction}
                          className="border-slate-600 bg-slate-950 text-white hover:bg-slate-800"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                          {copy.commitPrediction}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!committedVentilationPrediction}
                          onClick={revealVentilationFlow}
                          className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                        >
                          <Play className="h-4 w-4" aria-hidden />
                          {copy.revealModeledFlow}
                        </Button>
                      </div>
                      {committedVentilationPrediction ? (
                        <p className="mt-3 text-xs text-slate-300">
                          <span className="font-semibold text-slate-100">
                            {copy.yourPredictionLabel}:
                          </span>{' '}
                          {predictionLabel(committedVentilationPrediction)}
                        </p>
                      ) : null}
                    </section>
                  ) : null}

                  {showVentilation && (demonstration || committedVentilationPrediction) ? (
                    <section
                      className="rounded-2xl border border-cyan-400/25 bg-slate-900/80 p-4"
                      aria-labelledby="ventilation-modeled-result-title"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                            {copy.modeledResultLabel}
                          </p>
                          <h3
                            id="ventilation-modeled-result-title"
                            className="mt-1 text-lg font-semibold"
                          >
                            {ventilationResultText(ventilationComparison.expectedPrediction)}
                          </h3>
                        </div>
                        {demonstration ? (
                          <Eye className="mt-1 h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
                        ) : committedVentilationPrediction ===
                          ventilationComparison.expectedPrediction ? (
                          <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                        ) : (
                          <AlertTriangle
                            className="mt-1 h-5 w-5 shrink-0 text-amber-300"
                            aria-hidden
                          />
                        )}
                      </div>
                      {!demonstration ? (
                        <p
                          className={cn(
                            'mt-3 rounded-xl border px-3 py-2 text-xs leading-5',
                            committedVentilationPrediction ===
                              ventilationComparison.expectedPrediction
                              ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                              : 'border-amber-300/25 bg-amber-400/10 text-amber-100',
                          )}
                          role="status"
                        >
                          {committedVentilationPrediction ===
                          ventilationComparison.expectedPrediction
                            ? copy.predictionCorrect
                            : copy.predictionReconsider}
                        </p>
                      ) : null}

                      <dl className="mt-4 space-y-3 text-xs leading-5">
                        <div>
                          <dt className="font-semibold text-slate-100">{copy.pulsePatternLabel}</dt>
                          <dd className="text-slate-300">
                            {ventilationPulsePattern(ventilationMode)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-100">{copy.leakEffectLabel}</dt>
                          <dd className="text-slate-300">
                            {ventilationComparison.leakSeverity === 'fenestrations-above-cords'
                              ? copy.majorFenestrationLeak
                              : ventilationMode === 'conventional'
                                ? copy.controlledProximalLeak
                                : copy.openSystemProximalLeak}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-100">
                            {copy.sidePortFindingLabel}
                          </dt>
                          <dd className="text-slate-300">
                            {ventilationComparison.sideFenestrationFinding === 'available'
                              ? copy.sidePortAvailable
                              : ventilationComparison.sideFenestrationFinding === 'unavailable'
                                ? copy.sidePortUnavailable
                                : copy.sidePortNotApplicable}
                          </dd>
                        </div>
                      </dl>

                      {distalEgress === 'blocked' ? (
                        <p className="mt-4 flex gap-2 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-xs leading-5 text-rose-100">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          {copy.egressBlockedDescription}
                        </p>
                      ) : null}

                      <div
                        className="mt-4 flex flex-wrap gap-2"
                        role="group"
                        aria-label={copy.animationControlsLabel}
                      >
                        {!reducedMotion ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={toggleAnimation}
                              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                            >
                              {displayedAnimationStatus === 'playing' ? (
                                <Pause className="h-4 w-4" aria-hidden />
                              ) : (
                                <Play className="h-4 w-4" aria-hidden />
                              )}
                              {displayedAnimationStatus === 'playing'
                                ? copy.pauseAnimation
                                : copy.playAnimation}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={resetAnimation}
                              className="border-slate-600 bg-slate-950 text-white hover:bg-slate-800"
                            >
                              <RefreshCw className="h-4 w-4" aria-hidden />
                              {copy.resetAnimation}
                            </Button>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-pressed={cutaway}
                          onClick={() => setCutaway((value) => !value)}
                          className={cn(
                            'border-slate-600 bg-slate-950 text-white hover:bg-slate-800',
                            cutaway && 'border-cyan-300/60 bg-cyan-400/15 text-cyan-50',
                          )}
                        >
                          <Scan className="h-4 w-4" aria-hidden />
                          {copy.cutawayView}
                        </Button>
                      </div>
                      <p
                        className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-200"
                        role="status"
                        aria-label={copy.animationStatusLabel}
                      >
                        {animationStatusText}
                      </p>
                      <p className="mt-4 text-xs leading-5 text-amber-100">
                        {copy.ventilationComparisonSafetyNote}
                      </p>
                      <p className="mt-2 text-[11px] leading-4 text-slate-400">
                        {copy.ventilationSourceNote}
                      </p>
                    </section>
                  ) : (
                    <p className="text-xs leading-5 text-amber-100">
                      {copy.ventilationComparisonSafetyNote}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                        {copy.pathwaySelectLabel}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">{pathwayTitle}</h3>
                    </div>
                    <Scan className="mt-1 h-5 w-5 text-cyan-200" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{pathwayDescription}</p>

                  <div
                    className="mt-4 flex flex-wrap gap-2"
                    role="group"
                    aria-label={copy.animationControlsLabel}
                  >
                    <Button
                      type="button"
                      size="sm"
                      onClick={toggleAnimation}
                      className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    >
                      {displayedAnimationStatus === 'playing' ? (
                        <Pause className="h-4 w-4" aria-hidden />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden />
                      )}
                      {displayedAnimationStatus === 'playing'
                        ? copy.pauseAnimation
                        : copy.playAnimation}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={resetAnimation}
                      className="border-slate-600 bg-slate-950 text-white hover:bg-slate-800"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      {copy.resetAnimation}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-pressed={cutaway}
                      onClick={() => setCutaway((value) => !value)}
                      className={cn(
                        'border-slate-600 bg-slate-950 text-white hover:bg-slate-800',
                        cutaway && 'border-cyan-300/60 bg-cyan-400/15 text-cyan-50',
                      )}
                    >
                      <Scan className="h-4 w-4" aria-hidden />
                      {copy.cutawayView}
                    </Button>
                  </div>

                  <p
                    className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-200"
                    role="status"
                    aria-label={copy.animationStatusLabel}
                  >
                    {animationStatusText}
                  </p>
                  <p className="mt-4 text-xs leading-5 text-amber-100">{copy.pathSafetyNote}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {copy.toolsTitle}
                </p>
                <div className="mt-3 grid gap-2">
                  {assemblyToolParts.map((part) => (
                    <button
                      type="button"
                      key={part.id}
                      onClick={() => setSelectedToolId(part.id)}
                      aria-pressed={selectedToolId === part.id}
                      className={cn(
                        'rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                        selectedToolId === part.id
                          ? 'border-cyan-300/55 bg-cyan-400/10 text-white'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500',
                      )}
                    >
                      <span className="text-sm font-semibold">{part.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        {part.function ?? part.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <article className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                  Selected instrument
                </p>
                <h3 className="mt-1 text-lg font-semibold">{selectedTool.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedTool.description}</p>
                {selectedTool.specs?.length ? (
                  <dl className="mt-4 space-y-2">
                    {selectedTool.specs.map((spec) => (
                      <div
                        key={spec}
                        className="rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-xs text-slate-200"
                      >
                        {spec}
                      </div>
                    ))}
                  </dl>
                ) : null}
                {selectedTool.safetyNote ? (
                  <p className="mt-4 text-xs leading-5 text-amber-100">{selectedTool.safetyNote}</p>
                ) : null}
                <a
                  href={selectedTool.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-xs font-medium text-cyan-300 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-200"
                >
                  Source: {selectedTool.source.label}
                </a>
              </article>
            </>
          )}

          <details className="rounded-2xl border border-slate-700 bg-slate-900/45 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-100">
              Read the assembly sequence without 3D
            </summary>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
              {activeSteps.map((part, index) => (
                <li key={part.id}>
                  <span className="font-semibold text-white">
                    {index + 1}. {part.label}:
                  </span>{' '}
                  {part.description}
                </li>
              ))}
            </ol>
          </details>

          <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">
            {copy.safetyNote}
          </p>
        </div>
      </div>
    </section>
  )
}

useGLTF.preload(kitAssetUrl)
useGLTF.preload(RIGID_BRONCHOSCOPY_AIRWAY_ASSET_PATH)
