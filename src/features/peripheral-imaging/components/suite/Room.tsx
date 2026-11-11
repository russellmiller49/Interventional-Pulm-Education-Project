'use client'
import { useEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { Color, ExtrudeGeometry, Shape } from 'three'
import { DEFAULT_GEOMETRY, type ImagingGeometry, type Point3 } from '../../lib/physics'
import type { SuiteLayer } from './types'
import { add, chainStopAnchors, suiteFrame, roomMonitorOffset, type SuiteFrame } from './suiteModel'
import { carmDimensions, carmToRoom, Strut } from './ParametricCarm'
import { DetectorImage } from './DetectorImage'
import type { DrrTextureSource } from './drrTextureSource'
import { PATIENT_BACK_Y } from './PatientBody'

export const ROOM_BACKGROUND = '#061519'

/**
 * The procedure table, in millimetres of the patient frame. The head end clears the vertex of the
 * skull and the foot end the patient's feet; the pedestal stands under the legs so the chest is
 * cantilevered clear of it, which is what lets the tube pass beneath.
 */
export const TABLE = {
  halfWidth: 290,
  headZ: 580,
  footZ: -1500,
  slabThickness: 26,
  padThickness: 11,
  pedestalZ: -960,
} as const

const tableTopY = PATIENT_BACK_Y
const slabCentreY = tableTopY - TABLE.padThickness - TABLE.slabThickness / 2
const tableCentreZ = (TABLE.headZ + TABLE.footZ) / 2
const tableLength = TABLE.headZ - TABLE.footZ

/** Where the monitor cart stands, from the two anchors the image-formation map already uses. */
function cartPlacement(geometry: ImagingGeometry, atRest: boolean) {
  const offset = atRest ? roomMonitorOffset(geometry) : ([0, 0, 0] as Point3)
  const anchors = chainStopAnchors(suiteFrame(0, 0, geometry), offset)
  return { processor: anchors.reconstruction, display: anchors.display }
}

/** The physical extent of the room's contents, for a camera that must frame all of it. */
export function roomBounds(frame: SuiteFrame): Point3[] {
  const { field: f } = frame.geometry
  const d = carmDimensions(frame.geometry)
  const cart = cartPlacement(frame.geometry, true)
  const box = ([x0, y0, z0]: Point3, [x1, y1, z1]: Point3): Point3[] =>
    [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z): Point3 => [x, y, z])))
  const furniture = [
    // Table and the patient on it, head to mid-thigh: the feet may leave the frame.
    ...box([-TABLE.halfWidth, d.floorY, -f * 1.25], [TABLE.halfWidth, f * 0.28, TABLE.headZ]),
    // C-arm stand.
    ...box([d.standX - f * 0.75, d.floorY, -f * 0.32], [d.standX, f * 0.2, f * 0.32]),
    // Monitor cart: processor cabinet and display.
    ...box(
      [cart.processor[0] - f * 0.3, d.floorY, cart.processor[2] - f * 0.3],
      [cart.display[0] + f * 0.45, cart.display[1] + f * 0.3, cart.display[2] + f * 0.1],
    ),
  ]
  const casing = frame.corners.map((point) =>
    add(point, frame.normal.map((n) => n * f * 0.2) as Point3),
  )
  const arm = Array.from({ length: 33 }, (_, index) => Math.PI / 2 + (Math.PI * index) / 32).map(
    (angle) =>
      add(
        frame.iso,
        carmToRoom(
          [
            (d.radius + d.channelHalfWidth) * Math.cos(angle),
            d.centreY + (d.radius + d.channelHalfWidth) * Math.sin(angle),
            0,
          ],
          frame.orbit,
          frame.tilt,
        ),
      ),
  )
  return [...furniture, ...casing, ...arm]
}

const groundVertex = `varying vec2 groundUv;
varying vec4 projected;
void main() { groundUv = uv; projected = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = projected; }`
const groundFragment = `varying vec2 groundUv;
varying vec4 projected;
uniform vec3 tint;
uniform float strength;
void main() {
  float radius = length((groundUv - 0.5) * 2.0);
  float alpha = (1.0 - smoothstep(0.25, 1.0, radius)) * strength;
  // Fade the floor cue into the shell before the frame's edges.
  vec2 screenUv = projected.xy / projected.w * 0.5 + 0.5;
  float edge = min(min(screenUv.x, 1.0 - screenUv.x), min(screenUv.y, 1.0 - screenUv.y));
  alpha *= smoothstep(0.015, 0.08, edge);
  gl_FragColor = vec4(tint, alpha);
  #include <colorspace_fragment>
}`

/** Soft pools of light and contact shadow that sit the equipment on the floor. Not a simulation. */
function GroundPatch({
  position,
  size,
  color,
  opacity,
}: {
  position: Point3
  size: [number, number]
  color: string
  opacity: number
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <planeGeometry args={size} />
      <shaderMaterial
        vertexShader={groundVertex}
        fragmentShader={groundFragment}
        uniforms={{ tint: { value: new Color(color) }, strength: { value: opacity } }}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function Table({
  floorY,
  shift,
  f,
  ghost,
}: {
  floorY: number
  shift: Point3
  f: number
  ghost: boolean
}) {
  const slabBottom = slabCentreY - TABLE.slabThickness / 2 + shift[1]
  const columnTop = slabBottom - 6
  const columnBottom = floorY + f * 0.1
  const telescopeBottom = floorY + f * 0.42
  return (
    <group name="procedure-table">
      {/* The top travels with the patient: it is what centres the lesion for a spin. */}
      <group position={shift}>
        <RoundedBox
          args={[TABLE.halfWidth * 2, TABLE.slabThickness, tableLength]}
          radius={11}
          smoothness={4}
          position={[0, slabCentreY, tableCentreZ]}
        >
          <meshStandardMaterial
            // Blending is compiled into the material, so a ghosted top is a different material.
            key={ghost ? 'ghost' : 'solid'}
            color="#27373f"
            metalness={0.35}
            roughness={0.42}
            transparent={ghost}
            opacity={ghost ? 0.1 : 1}
            depthWrite={!ghost}
          />
        </RoundedBox>
        <RoundedBox
          args={[TABLE.halfWidth * 2 - 26, TABLE.padThickness, tableLength - 30]}
          radius={5}
          smoothness={3}
          position={[0, tableTopY - TABLE.padThickness / 2, tableCentreZ]}
        >
          <meshStandardMaterial
            key={ghost ? 'ghost' : 'solid'}
            color="#5d7e8a"
            metalness={0}
            roughness={0.9}
            transparent={ghost}
            opacity={ghost ? 0.08 : 1}
            depthWrite={!ghost}
          />
        </RoundedBox>
        {/* Pillow under the occiput: it stays level when a wedge rolls the patient. */}
        <mesh position={[0, tableTopY + 14, 396]} scale={[165, 24, 112]}>
          <sphereGeometry args={[1, 28, 16]} />
          <meshStandardMaterial
            key={ghost ? 'ghost' : 'solid'}
            color="#c9d6d8"
            roughness={0.95}
            transparent={ghost}
            opacity={ghost ? 0.12 : 1}
            depthWrite={!ghost}
          />
        </mesh>
        {/* Accessory rails along the foot half, clear of the imaged chest. */}
        {[-1, 1].map((side) => (
          <RoundedBox
            key={side}
            args={[10, 24, 760]}
            radius={4}
            smoothness={2}
            position={[side * (TABLE.halfWidth + 9), slabCentreY - 2, -880]}
          >
            <meshStandardMaterial color="#8fa4ab" metalness={0.6} roughness={0.35} />
          </RoundedBox>
        ))}
      </group>
      <RoundedBox
        args={[f * 0.34, columnTop - telescopeBottom, f * 0.4]}
        radius={f * 0.05}
        smoothness={4}
        position={[shift[0] * 0.5, (columnTop + telescopeBottom) / 2, TABLE.pedestalZ]}
      >
        <meshStandardMaterial color="#b9c8cc" metalness={0.2} roughness={0.5} />
      </RoundedBox>
      <RoundedBox
        args={[f * 0.44, telescopeBottom - columnBottom + f * 0.06, f * 0.52]}
        radius={f * 0.06}
        smoothness={4}
        position={[0, (telescopeBottom + columnBottom) / 2, TABLE.pedestalZ]}
      >
        <meshStandardMaterial color="#8ea2a9" metalness={0.2} roughness={0.5} />
      </RoundedBox>
      <RoundedBox
        args={[f * 0.72, f * 0.1, f * 1.5]}
        radius={f * 0.04}
        smoothness={4}
        position={[0, floorY + f * 0.05, TABLE.pedestalZ + f * 0.1]}
      >
        <meshStandardMaterial color="#33474f" metalness={0.3} roughness={0.5} />
      </RoundedBox>
    </group>
  )
}

/**
 * The foam wedge that rolls the patient: under the lifted side, thin edge at the midline. Its slope
 * is the roll itself, so the figure's back lies along it.
 */
function PositioningWedge({ degrees }: { degrees: number }) {
  const geometry = useMemo(() => {
    const side = Math.sign(degrees)
    const run = 250
    const rise = run * Math.tan((Math.abs(degrees) * Math.PI) / 180)
    const shape = new Shape()
    shape.moveTo(-side * 20, 0)
    shape.lineTo(side * (run - 20), 0)
    shape.lineTo(side * (run - 20), rise)
    shape.closePath()
    const result = new ExtrudeGeometry(shape, { depth: 470, bevelEnabled: false })
    result.translate(0, tableTopY, -270)
    return result
  }, [degrees])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} name="positioning-wedge">
      <meshStandardMaterial color="#86b9c7" roughness={0.95} />
    </mesh>
  )
}

/** Image processor and display on one cart: the last two components of image formation. */
function MonitorCart({
  geometry,
  atRest,
  floorY,
  screen,
}: {
  geometry: ImagingGeometry
  atRest: boolean
  floorY: number
  screen: DrrTextureSource | null
}) {
  const f = geometry.field
  const { processor, display } = cartPlacement(geometry, atRest)
  const cabinetTop = processor[1] + f * 0.08
  const cabinetBottom = floorY + f * 0.13
  const mast: Point3 = [processor[0] + f * 0.08, 0, processor[2] - f * 0.12]
  const screenWidth = f * 0.84
  const screenHeight = f * 0.5
  return (
    <group name="monitor-cart">
      <RoundedBox
        args={[f * 0.66, f * 0.07, f * 0.74]}
        radius={f * 0.03}
        smoothness={3}
        position={[processor[0], floorY + f * 0.1, processor[2]]}
      >
        <meshStandardMaterial color="#33474f" metalness={0.3} roughness={0.5} />
      </RoundedBox>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`${x}:${z}`}
            position={[processor[0] + x * f * 0.27, floorY + f * 0.04, processor[2] + z * f * 0.31]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[f * 0.04, f * 0.04, f * 0.04, 20]} />
            <meshStandardMaterial color="#1c2a31" roughness={0.7} />
          </mesh>
        )),
      )}
      <RoundedBox
        args={[f * 0.5, cabinetTop - cabinetBottom, f * 0.56]}
        radius={f * 0.045}
        smoothness={4}
        position={[processor[0], (cabinetTop + cabinetBottom) / 2, processor[2]]}
        name="image-processor"
      >
        <meshStandardMaterial color="#c6d2d6" metalness={0.12} roughness={0.55} />
      </RoundedBox>
      {/* Vents and a status light on the face toward the operator. */}
      {[0, 1, 2, 3].map((row) => (
        <mesh
          key={row}
          position={[
            processor[0],
            cabinetBottom + f * 0.16 + row * f * 0.05,
            processor[2] + f * 0.283,
          ]}
        >
          <boxGeometry args={[f * 0.32, f * 0.014, f * 0.006]} />
          <meshStandardMaterial color="#51666e" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[processor[0] - f * 0.17, cabinetTop - f * 0.09, processor[2] + f * 0.283]}>
        <boxGeometry args={[f * 0.05, f * 0.016, f * 0.006]} />
        <meshStandardMaterial color="#7df0d8" emissive="#3fd6bd" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[mast[0], (cabinetTop + display[1]) / 2, mast[2]]}>
        <cylinderGeometry args={[f * 0.035, f * 0.045, display[1] - cabinetTop + f * 0.1, 24]} />
        <meshStandardMaterial color="#8fa4ab" metalness={0.5} roughness={0.35} />
      </mesh>
      <Strut
        start={[mast[0], display[1], mast[2]]}
        end={[display[0], display[1], display[2] - f * 0.06]}
        width={f * 0.05}
        color="#8fa4ab"
      />
      <RoundedBox
        args={[screenWidth + f * 0.05, screenHeight + f * 0.05, f * 0.05]}
        radius={f * 0.02}
        smoothness={3}
        position={[display[0], display[1], display[2] - f * 0.03]}
        name="display"
      >
        <meshStandardMaterial color="#141f24" metalness={0.3} roughness={0.5} />
      </RoundedBox>
      <mesh position={[display[0], display[1], display[2] - f * 0.003]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshBasicMaterial color="#0a2026" toneMapped={false} />
      </mesh>
      {/* The live image, the right way round for someone standing in front of the screen. */}
      <DetectorImage
        frame={{
          center: [display[0], display[1], display[2]],
          u: [-1, 0, 0],
          v: [0, 1, 0],
          field: screenHeight * 0.94,
        }}
        source={screen}
        doubleSided
        idle="#123138"
      />
    </group>
  )
}

export function Room({
  layers,
  geometry = DEFAULT_GEOMETRY,
  floorSpan,
  atRest = false,
  tableShift = [0, 0, 0],
  screen = null,
  ghostTable = false,
  wedgeDeg = 0,
}: {
  layers: readonly SuiteLayer[]
  geometry?: ImagingGeometry
  floorSpan?: number
  atRest?: boolean
  /** How far the table top has carried the patient from its home position. */
  tableShift?: Point3
  /** The live projection, shown on the cart's display as well as on the detector. */
  screen?: DrrTextureSource | null
  /** The beam's-eye view looks up through the table top, as the beam does. */
  ghostTable?: boolean
  /** The patient rolled on a wedge; positive lifts the patient's left side. */
  wedgeDeg?: number
}) {
  const f = geometry.field
  const d = carmDimensions(geometry)
  const floorY = d.floorY
  const cart = cartPlacement(geometry, atRest)
  return (
    <group>
      <mesh position={[0, floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[floorSpan ?? f * 9, floorSpan ?? f * 9]} />
        {atRest ? (
          <meshBasicMaterial color={ROOM_BACKGROUND} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#172a33" roughness={1} />
        )}
      </mesh>
      <group name="room-grounding">
        <GroundPatch
          position={[f * 0.2, floorY + 0.5, -f * 0.5]}
          size={[f * 7, f * 5]}
          color={atRest ? '#2c464e' : '#2a434c'}
          opacity={atRest ? 0.6 : 0.5}
        />
        {layers.includes('table') && (
          <GroundPatch
            position={[0, floorY + 1, TABLE.pedestalZ + f * 0.1]}
            size={[f * 1.3, f * 2.2]}
            color="#000000"
            opacity={0.7}
          />
        )}
        {layers.includes('gantry') && (
          <GroundPatch
            position={[d.standX - f * 0.2, floorY + 1, 0]}
            size={[f * 1.9, f * 1.3]}
            color="#000000"
            opacity={0.7}
          />
        )}
        {layers.includes('monitor') && (
          <GroundPatch
            position={[cart.processor[0], floorY + 1, cart.processor[2]]}
            size={[f * 1.2, f * 1.3]}
            color="#000000"
            opacity={0.7}
          />
        )}
      </group>
      {layers.includes('table') && (
        <Table floorY={floorY} shift={tableShift} f={f} ghost={ghostTable} />
      )}
      {layers.includes('table') && Math.abs(wedgeDeg) >= 1 && !ghostTable && (
        <PositioningWedge degrees={wedgeDeg} />
      )}
      {layers.includes('monitor') && (
        <MonitorCart geometry={geometry} atRest={atRest} floorY={floorY} screen={screen} />
      )}
      {layers.includes('fieldGenerator') && (
        <RoundedBox
          args={[f * 0.62, f * 0.035, f * 0.56]}
          radius={f * 0.012}
          smoothness={3}
          position={[0, slabCentreY - TABLE.slabThickness / 2 - f * 0.02, 0]}
          name="field-generator"
        >
          <meshStandardMaterial color="#6f9a9c" metalness={0.1} roughness={0.6} />
        </RoundedBox>
      )}
    </group>
  )
}
