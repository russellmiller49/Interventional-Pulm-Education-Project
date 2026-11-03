import fs from 'fs'
import path from 'path'
import * as THREE from 'three'

import { AIRWAY_NODES, SURVEY_STEPS } from '@/data/airway-anatomy-lesson/airway-map'
import { compassLetters } from '@/features/bronchial-branch-tracing/components/ScopeView'
import { NAV_LESSONS } from '@/features/bronchial-branch-tracing/content/nav-lessons'
import { traceById } from '@/features/bronchial-branch-tracing/geometry/native-ct'
import { stationCamera } from '@/features/bronchial-branch-tracing/geometry/route-stations'

import { getNode } from './airway-graph'
import type { PatientDirection, ViewReference } from './types'
import {
  CT_AXIAL_VIEW,
  CT_CORONAL_VIEW,
  HEAD_OF_BED_LOOKING_DOWN,
  MODEL_CAMERA_POSITION,
  MODEL_FRONT_VIEW,
  MODEL_ROTATION,
  clockDistance,
  clockOf,
  patientRightSide,
  rimLetters,
} from './view-orientation'

/**
 * Which side of the screen the patient's right falls on, view by view, checked against what each
 * view renders: the annotated recording, the schematic clock data, the CT correlation points, the
 * 3D model's own geometry, and the Branch Tracing scope. The lesson once taught the right main
 * bronchus on the image left while the recording, the physics of an unmirrored camera and Branch
 * Tracing all put it on the right.
 */

const PUBLIC = path.join(process.cwd(), 'public')
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(PUBLIC, file), 'utf8'))

describe('the camera rule', () => {
  it('puts the patient’s right on the right looking down from the head of the bed', () => {
    expect(clockOf(HEAD_OF_BED_LOOKING_DOWN, 'anterior')).toBe(12)
    expect(clockOf(HEAD_OF_BED_LOOKING_DOWN, 'right')).toBe(3)
    expect(clockOf(HEAD_OF_BED_LOOKING_DOWN, 'posterior')).toBe(6)
    expect(clockOf(HEAD_OF_BED_LOOKING_DOWN, 'left')).toBe(9)
    expect(patientRightSide(HEAD_OF_BED_LOOKING_DOWN)).toBe('right')
  })

  it('keeps the patient’s right a quarter turn clockwise from anterior however the scope rolls', () => {
    for (const top of ['anterior', 'right', 'posterior', 'left'] as PatientDirection[]) {
      const view: ViewReference = { looking: 'inferior', top }
      const turn = (clockOf(view, 'right')! - clockOf(view, 'anterior')! + 12) % 12
      expect(turn).toBeCloseTo(3)
    }
    // Facing the patient turns the picture half a turn: membranous wall up, right on the left.
    expect(patientRightSide({ looking: 'inferior', top: 'posterior' })).toBe('left')
  })

  it('puts the patient’s right on the left for CT and the 3D model', () => {
    expect(patientRightSide(CT_AXIAL_VIEW)).toBe('left')
    expect(patientRightSide(CT_CORONAL_VIEW)).toBe('left')
    expect(patientRightSide(MODEL_FRONT_VIEW)).toBe('left')
  })
})

describe('the annotated recording', () => {
  type Poly = number[]
  const overlays = readJson('airway-lesson/airway-survey-overlays.json') as {
    structures: { key: string }[]
    frames: [number, Poly[]][]
  }
  const keys = overlays.structures.map((structure) => structure.key)
  const centroid = (poly: Poly): [number, number] => {
    const xs = poly.filter((_, i) => i % 2 === 1)
    const ys = poly.filter((_, i) => i > 0 && i % 2 === 0)
    return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length]
  }
  /**
   * Image clocks (12 up, clockwise) of the vectors from one structure's centroid to each target's,
   * one row per frame in which all of them are outlined.
   */
  function clocksFrom(from: string, targets: string[]): number[][] {
    const indices = [from, ...targets].map((key) => keys.indexOf(key))
    for (const index of indices) expect(index).toBeGreaterThanOrEqual(0)
    const rows: number[][] = []
    for (const [, polys] of overlays.frames) {
      const found = indices.map((index) => polys.find((poly) => poly[0] === index))
      if (found.some((poly) => !poly)) continue
      const [[ax, ay], ...others] = found.map((poly) => centroid(poly!))
      rows.push(
        others.map(([bx, by]) => {
          const degrees = ((Math.atan2(bx - ax, -(by - ay)) * 180) / Math.PI + 360) % 360
          return degrees / 30
        }),
      )
    }
    return rows
  }
  const clocksBetween = (from: string, to: string) => clocksFrom(from, [to]).map(([c]) => c)
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1]
  const reference = (id: string) => getNode(id)!.endoscopicView!.reference

  it('shows the right main bronchus to the right of the left main bronchus in every frame', () => {
    const clocks = clocksBetween('LMB', 'RMB')
    expect(clocks.length).toBeGreaterThan(100)
    for (const clock of clocks) expect(clock).toBeGreaterThan(0.5)
    for (const clock of clocks) expect(clock).toBeLessThan(6)
    expect(clockDistance(median(clocks), clockOf(reference('trachea'), 'right')!)).toBeLessThan(1.5)
  })

  it('is not mirrored: in the lower lobe, medial lies a quarter turn counterclockwise of anterior', () => {
    // From the lower lobe bronchus: the middle lobe is anterior, RB7 is medial (the patient's left).
    // A mirrored picture would put medial a quarter turn clockwise instead; the roll cancels out.
    const rows = clocksFrom('RLL', ['RML', 'RB7_Medial_Basal'])
    expect(rows.length).toBeGreaterThan(40)
    const turns = rows.map(([anterior, medial]) => ((medial - anterior + 18) % 12) - 6)
    const expected =
      clockOf(HEAD_OF_BED_LOOKING_DOWN, 'left')! - clockOf(HEAD_OF_BED_LOOKING_DOWN, 'anterior')!
    expect(expected).toBe(-3)
    for (const turn of turns) expect(turn).toBeLessThan(-1)
    for (const turn of turns) expect(turn).toBeGreaterThan(-5)
    expect(Math.abs(median(turns) - expected)).toBeLessThan(1.5)
  })

  it.each([
    ['rul', 'RB3_Anterior', 'RB2_Posterior', 'posterior'],
    ['rml', 'RB5_Medial', 'RB4_Lateral', 'right'],
    ['lmb', 'LLL', 'LUL', 'anterior'],
    ['lingula', 'LB5_Inferior', 'LB4_Superior', 'superior'],
  ] as const)(
    'places the %s openings where its stated view puts them (%s to %s)',
    (nodeId, from, to, toward) => {
      const clocks = clocksBetween(from, to)
      expect(clocks.length).toBeGreaterThan(10)
      expect(clockDistance(median(clocks), clockOf(reference(nodeId), toward)!)).toBeLessThan(1.5)
    },
  )
})

describe('the schematic endoscopic views', () => {
  const views = AIRWAY_NODES.flatMap((node) =>
    node.endoscopicView ? [{ id: node.id, view: node.endoscopicView }] : [],
  )

  it('draw every opening and wall feature where its anatomical direction falls', () => {
    expect(views.length).toBeGreaterThan(10)
    for (const { id, view } of views) {
      for (const mark of [...view.openings, ...(view.wallFeatures ?? [])]) {
        const label = `${id} → ${'childId' in mark ? mark.childId : mark.label}`
        expect({ label, toward: mark.toward }).toEqual({ label, toward: expect.anything() })
        const expected = clockOf(view.reference, mark.toward!)
        if (expected === null) continue // straight ahead: no side
        expect({ label, off: clockDistance(mark.clock, expected) <= 1.5 }).toEqual({
          label,
          off: true,
        })
      }
    }
  })

  it('opens the right main bronchus at 3 o’clock with the R mark beside it', () => {
    const trachea = getNode('trachea')!.endoscopicView!
    expect(trachea.reference).toEqual(HEAD_OF_BED_LOOKING_DOWN)
    expect(trachea.openings.find((opening) => opening.childId === 'rmb')?.clock).toBe(3)
    expect(trachea.openings.find((opening) => opening.childId === 'lmb')?.clock).toBe(9)
    expect(rimLetters(trachea.reference)).toEqual(
      expect.arrayContaining([
        { clock: 12, letter: 'A' },
        { clock: 3, letter: 'R' },
        { clock: 6, letter: 'P' },
        { clock: 9, letter: 'L' },
      ]),
    )
  })
})

describe('the lesson copy', () => {
  const sentences = [
    ...AIRWAY_NODES.flatMap((node) => [
      node.summary,
      ...node.whatYouSee,
      ...node.pearls,
      node.endoscopicView?.orientation ?? '',
    ]),
    ...SURVEY_STEPS.flatMap((step) => step.narration),
  ].flatMap((text) => text.split(/(?<=\.)\s+/))
  // One clause (no comma or semicolon) that places something on the patient's right on the left.
  const rightOnImageLeft =
    /(patient(’|')s right|right main bronchus|right upper lobe|RUL)[^.,;]*(left of (the|your) (image|picture|video)|toward the left|to your left|image(’|')s left)/i

  it('never puts the patient’s right on the scope image’s left', () => {
    expect(sentences.filter((sentence) => rightOnImageLeft.test(sentence))).toEqual([])
  })

  it('states the side under the carina video the way the recording shows it', () => {
    expect(getNode('trachea')!.endoscopicView!.orientation).toMatch(
      /patient's right is on the right of the image/,
    )
    const carina = SURVEY_STEPS.find((step) => step.nodeId === 'trachea')!
    expect(carina.narration.join(' ')).toMatch(
      /right main bronchus opens on the right of the image and the left main bronchus on the left/,
    )
  })
})

describe('the CT correlation', () => {
  it('marks right-sided airways on the patient’s right (negative LPS x)', () => {
    const manifest = readJson('airway-lesson/airway-survey-ct.json') as {
      structures: Record<string, { lps: [number, number, number] }>
    }
    const lungOf = (id: string) => getNode(id)?.lobe ?? ''
    let checked = 0
    for (const [id, entry] of Object.entries(manifest.structures)) {
      const side = /^R/.test(lungOf(id)) || ['rmb', 'bronchus-intermedius'].includes(id) ? -1 : 0
      const left = /^L|lingula/.test(lungOf(id)) || id === 'lmb' ? 1 : 0
      if (side) expect({ id, x: Math.sign(entry.lps[0]) }).toEqual({ id, x: -1 })
      if (left) expect({ id, x: Math.sign(entry.lps[0]) }).toEqual({ id, x: 1 })
      checked += Math.abs(side) + left
    }
    expect(checked).toBeGreaterThan(20)
  })
})

describe('the 3D model', () => {
  /** Mesh centres straight from the GLB: POSITION accessor bounds times the node's scale. */
  function glbCentres(file: string): Record<string, THREE.Vector3> {
    const bytes = fs.readFileSync(path.join(PUBLIC, file))
    const jsonLength = bytes.readUInt32LE(12)
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'))
    const out: Record<string, THREE.Vector3> = {}
    for (const node of gltf.nodes as {
      name: string
      mesh?: number
      scale?: number[]
    }[]) {
      if (node.mesh === undefined) continue
      const accessor =
        gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION as number]
      const scale = node.scale?.[0] ?? 1
      out[node.name] = new THREE.Vector3(
        ((accessor.min[0] + accessor.max[0]) / 2) * scale,
        ((accessor.min[1] + accessor.max[1]) / 2) * scale,
        ((accessor.min[2] + accessor.max[2]) / 2) * scale,
      )
    }
    return out
  }
  const centres = glbCentres('fluoroview/airway_segments_new.glb')
  const find = (pattern: RegExp) => {
    const name = Object.keys(centres).find((key) => pattern.test(key))
    expect(name).toBeDefined()
    return centres[name!]
  }
  const rightMain = find(/^Right Mainstem/)
  const leftMain = find(/^Left Mainstem/)
  const trachea = find(/^Trachea/)
  const rb10 = find(/\(RB10\)/)
  const rb2 = find(/\(RB2\)/)
  const rb3 = find(/\(RB3\)/)

  it('stores the tree with x to the patient’s left, y superior and z anterior', () => {
    expect(leftMain.x).toBeGreaterThan(rightMain.x)
    expect(trachea.y).toBeGreaterThan(rb10.y)
    expect(rb3.z).toBeGreaterThan(rb2.z)
  })

  it('opens seen from the front: head up, patient’s right on the left of the screen', () => {
    const rotation = new THREE.Euler(...MODEL_ROTATION)
    const superior = new THREE.Vector3(0, 1, 0).applyEuler(rotation)
    const anterior = new THREE.Vector3(0, 0, 1).applyEuler(rotation)
    const camera = new THREE.PerspectiveCamera(35, 600 / 440, 0.01, 100)
    camera.position.set(...MODEL_CAMERA_POSITION)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const towardCamera = camera.position.clone().normalize()
    expect(superior.y).toBeGreaterThan(0.9)
    expect(anterior.dot(towardCamera)).toBeGreaterThan(0.9)

    const middle = rightMain.clone().add(leftMain).multiplyScalar(0.5)
    const onScreen = (p: THREE.Vector3) =>
      p.clone().sub(middle).multiplyScalar(10).applyEuler(rotation).project(camera)
    expect(onScreen(rightMain).x).toBeLessThan(onScreen(leftMain).x)
    expect(onScreen(trachea).y).toBeGreaterThan(onScreen(rb10).y)
    expect(patientRightSide(MODEL_FRONT_VIEW)).toBe('left')
  })
})

describe('Branch Tracing agrees', () => {
  it('shows the patient’s right on the right of the scope at the carina, as both modules teach', () => {
    const trace = traceById('central-right')
    const index = trace.checkpoints.findIndex((checkpoint) => checkpoint.id === 'junction-1')
    const camera = stationCamera(trace, index)!
    const letters = Object.fromEntries(
      compassLetters(camera.direction, camera.up, false).map((letter) => [letter.letter, letter]),
    )
    expect(letters.R.x).toBeGreaterThan(55)
    expect(letters.L.x).toBeLessThan(45)
    expect(letters.A.y).toBeLessThan(45)

    const carinaLesson = NAV_LESSONS.find((lesson) => lesson.id === 'carina-orientation')!
    const teach = carinaLesson.trips[0].stations?.['junction-1']?.teach ?? ''
    expect(teach).toMatch(/The scope shows the patient’s right on the right/)
    expect(patientRightSide(HEAD_OF_BED_LOOKING_DOWN)).toBe('right')
  })
})
