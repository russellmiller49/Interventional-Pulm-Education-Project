import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import {
  CIRCUIT_MAP_BODY_MIDLINE_X,
  VA_RIGHT_ARM_SITE,
  circuitMapGeometry,
} from '../components/circuit-map/circuitMapGeometry'
import {
  PATIENT_ASSET,
  PATIENT_LEFT_AXIS,
  PATIENT_POSITION,
  PATIENT_SCALE,
} from '../components/ecmo-circuit/constants'
import { buildCircuitLayout } from '../components/ecmo-circuit/layout'
import { createReferenceSimulationState, ecmoSimulationReducer } from '../engine'
import type { SupportMode } from '../engine/types'

/**
 * ECMO-OWNER-12: the pressure-zone map and the bedside 3D scene cannulate the same groins.
 *
 * Section 2 shows one circuit on two tabs. The issue was recorded as the two figures draining from
 * opposite groins, because the scene drained from a constant named `GROIN_VEIN_LEFT` while the map
 * drains the patient's right femoral vein. The name was the error, not the picture: that constant
 * sits at −x in the patient model's frame, and in that frame the patient's left is +x. Both figures
 * have always drained the patient's RIGHT femoral vein and returned to the patient's LEFT groin.
 * The owner's decision (2026-11-10) was to leave both drawings alone and correct the names.
 *
 * These checks hold the two figures together from the anatomy up, so the next reading of a name
 * cannot reopen it: the model file says where the head and the front of the patient are, that
 * gives the patient's left, and each figure's cannulas are placed against it.
 */

jest.setTimeout(30_000)

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

afterEach(cleanup)

const MODES: readonly SupportMode[] = ['vv', 'va']

type Side = 'patient-left' | 'patient-right'
type Vec3 = readonly [number, number, number]

/** Anterior view: the patient faces the viewer, so the patient's left is on the viewer's right. */
const mapSide = (x: number): Side =>
  x > CIRCUIT_MAP_BODY_MIDLINE_X ? 'patient-left' : 'patient-right'

/** The patient is placed with a positive scale and no rotation, so world x keeps the model's sign. */
const sceneSide = (worldX: number): Side =>
  (worldX - PATIENT_POSITION[0]) * PATIENT_LEFT_AXIS[0] > 0 ? 'patient-left' : 'patient-right'

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

interface Bounds {
  readonly min: Vec3
  readonly max: Vec3
}

/** Position bounds of each material's primitive in the patient model, read from the GLB's JSON. */
function patientModelBounds(): Record<string, Bounds> {
  const file = readFileSync(join(process.cwd(), 'public', PATIENT_ASSET))
  const jsonLength = file.readUInt32LE(12)
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8')) as {
    nodes: { rotation?: number[]; scale?: number[]; matrix?: number[] }[]
    meshes: { primitives: { attributes: { POSITION: number }; material: number }[] }[]
    materials: { name: string }[]
    accessors: { min: number[]; max: number[] }[]
  }
  // No transform inside the file either: the vertex coordinates are the model's frame.
  for (const node of gltf.nodes) {
    expect(node.rotation).toBeUndefined()
    expect(node.scale).toBeUndefined()
    expect(node.matrix).toBeUndefined()
  }
  const bounds: Record<string, Bounds> = {}
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION]
      bounds[gltf.materials[primitive.material].name] = {
        min: accessor.min as unknown as Vec3,
        max: accessor.max as unknown as Vec3,
      }
    }
  }
  return bounds
}

const centre = (bounds: Bounds, axis: 0 | 1 | 2) => (bounds.min[axis] + bounds.max[axis]) / 2

function pathPoints(d: string): { x: number; y: number }[] {
  const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  const points: { x: number; y: number }[] = []
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] })
  }
  return points
}

function settled(mode: SupportMode) {
  let state = createReferenceSimulationState(mode === 'va' ? 'va-reference' : 'vv-reference')
  for (let tick = 0; tick < 8; tick += 1) state = ecmoSimulationReducer(state, { type: 'STEP' })
  return state
}

function renderMap(mode: SupportMode) {
  render(<CircuitAndMonitors state={settled(mode)} dispatch={jest.fn()} controlsEnabled={false} />)
  fireEvent.click(screen.getByRole('tab', { name: /Pressure-zone map/i }))
}

describe('which way the 3D patient’s left points', () => {
  it('is +x: the model lies supine with its head toward −z, and is placed unrotated', () => {
    const model = patientModelBounds()
    const skin = model.patient_skin
    const cap = model.surgical_cap
    const pillow = model.hospital_linen
    const drape = model.sterile_drape

    // Head end: the cap and the pillow are at the −z end of the body; the feet reach further +z.
    expect(cap.max[2]).toBeLessThan(centre(skin, 2))
    expect(pillow.max[2]).toBeLessThan(centre(skin, 2))
    expect(Math.abs(skin.max[2])).toBeGreaterThan(Math.abs(cap.min[2]))
    const superior: Vec3 = [0, 0, -1]

    // Supine: the pillow is under the head and the drape lies on top, so the front of the patient
    // faces +y.
    expect(pillow.max[1]).toBeLessThan(centre(cap, 1))
    expect(drape.max[1]).toBeGreaterThan(skin.max[1])
    const anterior: Vec3 = [0, 1, 0]

    // Standing and facing you, a person's left is on your right: left = superior × anterior.
    expect(cross([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0])
    const left = cross(superior, anterior).map((value) => value + 0)
    expect(left).toEqual([...PATIENT_LEFT_AXIS])

    // The scene adds no transform that could flip it.
    expect(PATIENT_SCALE).toBeGreaterThan(0)
    const scene = readFileSync(
      join(process.cwd(), 'src/features/cardiohelp-ecmo/components/ecmo-circuit/BedsideScene.tsx'),
      'utf8',
    )
    expect(scene).toContain('<group position={PATIENT_POSITION} scale={PATIENT_SCALE}>')
  })
})

describe.each(MODES)('%s: the map and the bedside scene use the same groins', (mode) => {
  it('drains the patient’s right femoral vein and returns to the left groin, in both figures', () => {
    const geometry = circuitMapGeometry(mode)
    const scene = buildCircuitLayout(mode)

    // On the map, blood leaves along the drainage cannula, which ends at its insertion site.
    const mapDrainage = pathPoints(geometry.drainageCannula).at(-1)!
    const mapReturn = pathPoints(geometry.returnCannula)[0]
    expect(mapReturn.x).toBe(geometry.returnPortX)

    expect(mapSide(mapDrainage.x)).toBe('patient-right')
    expect(mapSide(mapReturn.x)).toBe('patient-left')
    expect(sceneSide(scene.drainageInsertion.x)).toBe('patient-right')
    expect(sceneSide(scene.returnInsertion.x)).toBe('patient-left')

    expect(mapSide(mapDrainage.x)).toBe(sceneSide(scene.drainageInsertion.x))
    expect(mapSide(mapReturn.x)).toBe(sceneSide(scene.returnInsertion.x))
  })

  it('draws the map’s insertion sites and their labels on those sides', () => {
    renderMap(mode)
    const siteX = (className: string) =>
      Number(document.querySelector(`circle[class*="${className}"]`)?.getAttribute('cx'))
    expect(mapSide(siteX('drainageInsertionSite'))).toBe('patient-right')
    expect(mapSide(siteX('returnInsertionSite'))).toBe('patient-left')

    const label = (text: string) =>
      [...document.querySelectorAll('svg text')].find(
        (node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim() === text,
      )
    expect(mapSide(Number(label('Femoral vein drainage')?.getAttribute('x')))).toBe('patient-right')
    const returnLabel = label(mode === 'va' ? 'Femoral artery return' : 'Femoral vein return')
    expect(returnLabel).toBeDefined()
    // The return label ends beside the return limb's rise, toward the midline from the port.
    expect(Number(returnLabel?.getAttribute('x'))).toBeLessThan(siteX('returnInsertionSite'))
    expect(document.querySelector('[data-map-view="anterior"]')?.textContent).toMatch(
      /Anterior view/,
    )
  })
})

describe('the VA track', () => {
  it('keeps the distal perfusion catheter on the leg with the arterial return, the left', () => {
    const scene = buildCircuitLayout('va')
    expect(scene.dpc).not.toBeNull()
    for (const point of scene.dpc!.getPoints(12)) {
      expect(sceneSide(point.x)).toBe(sceneSide(scene.returnInsertion.x))
    }
    expect(buildCircuitLayout('vv').dpc).toBeNull()
  })

  it('samples the right arm on the patient’s right, the side away from the arterial return', () => {
    expect(mapSide(VA_RIGHT_ARM_SITE.cx)).toBe('patient-right')
    expect(mapSide(circuitMapGeometry('va').returnPortX)).toBe('patient-left')
  })
})
