/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

import metadata from '../../../../public/peripheral-imaging/anatomy/manifest.json'
import { airwayLabels } from '../components/suite/AirwayOverlay'
import { suiteFrame } from '../components/suite/suiteModel'
import { visibleLabControls } from '../components/suite/LabDock'
import { AIRWAY_FACTS, airwayRouteText, frontalBeamShare } from '../content/airwayFacts'
import {
  AIRWAY_BRANCH_KEYS,
  AIRWAY_BRANCHES,
  AIRWAY_LOBE_KEYS,
  lobeOfSegments,
} from '../content/airwayNames'
import { INTERPRETATION_CHECKS } from '../content/interpretationChecks'
import { imagingStageLessons } from '../content/stageLessons'
import { fixedExampleValues, teachingDemonstration } from '../content/teachingExamples'
import { LESSONS } from '../data/lessons'
import { QUESTION_BY_ID } from '../data/questions'
import { emptyLabState, labStateAfterChange } from '../engine/labGoalEvaluation'
import { labDefaults, labReadouts } from '../engine/labMetrics'
import {
  AIRWAY_SEGMENTS_BY_LOBE,
  AIRWAY_SHOW_VALUES,
  AIRWAY_TREE,
  airwayAlongBeam,
  airwayColor,
  airwayCourse,
  airwayLegend,
  airwayOrigin,
  airwayRouteKeys,
  mostForeshortened,
  nearestAirway,
} from '../lib/airwayTree'
import { ANATOMY } from '../lib/anatomy'
import { LESION_CENTER, LESION_RADIUS, type Point3 } from '../lib/physics'

/*
 * The bronchial tree the course draws on its fluoroscopic image. Three things have to hold for it
 * to teach anatomy rather than decorate the picture: it lies inside the airways of the course's own
 * CT; every sentence the lesson says about where a bronchus runs is true of it; and it appears only
 * where a section asks for it, with its names withheld wherever the learner is being asked for them.
 */
const lesson = LESSONS.find((entry) => entry.id === 'airway-anatomy')!
const block = (title: string) => lesson.blocks.find((entry) => entry.title === title)!

describe('the named tree', () => {
  it('names every branch, uses every name, and hangs together as one tree', () => {
    expect(AIRWAY_TREE.length).toBeGreaterThan(400)
    expect(new Set(AIRWAY_TREE.map((branch) => branch.key))).toEqual(new Set(AIRWAY_BRANCH_KEYS))
    const ids = new Set(AIRWAY_TREE.map((branch) => branch.id))
    const roots = AIRWAY_TREE.filter((branch) => branch.parent === null)
    expect(roots.map((branch) => branch.key)).toEqual(['trachea'])
    for (const branch of AIRWAY_TREE)
      if (branch.parent !== null) expect(ids.has(branch.parent)).toBe(true)
  })

  it('keeps each segment in one piece: a branch below a segmental bronchus carries its name', () => {
    const byId = new Map(AIRWAY_TREE.map((branch) => [branch.id, branch]))
    for (const branch of AIRWAY_TREE) {
      const parent = branch.parent === null ? null : byId.get(branch.parent)!
      if (parent && AIRWAY_BRANCHES[parent.key].level === 'segment')
        expect(branch.key).toBe(parent.key)
    }
    for (const key of AIRWAY_BRANCH_KEYS) expect(() => airwayOrigin(key)).not.toThrow()
  })

  it('puts every segment on its own side and in its own lobe', () => {
    for (const lobe of AIRWAY_LOBE_KEYS)
      for (const segment of AIRWAY_SEGMENTS_BY_LOBE[lobe]) {
        expect(AIRWAY_BRANCHES[segment].lobe).toBe(lobe)
        // x is toward the patient's left: a right-sided bronchus ends right of the midline.
        const end = airwayCourse(segment, 40)
        const tip = end.origin[0] + end.direction[0] * 40
        expect(Math.sign(tip)).toBe(AIRWAY_BRANCHES[segment].side === 'left' ? 1 : -1)
      }
    expect(lobeOfSegments(['RB1', 'RB3'])).toBe('RUL-bronchus')
    expect(lobeOfSegments(['LB4', 'LB5'])).toBe('LUL-lingula')
    expect(lobeOfSegments(['LB1+2', 'LB4'])).toBe('LUL-bronchus')
    expect(lobeOfSegments(['RB4', 'RB6'])).toBeNull()
  })

  it('carries no path, name or identifier from its source', () => {
    const text = readFileSync(resolve('public/peripheral-imaging/anatomy/airway-tree.json'), 'utf8')
    expect(text).not.toMatch(/\/Users\/|\/home\/|New_patient|fluoro_2|PatientName|PatientID|\.mrk/)
  })
})

describe('on the course CT', () => {
  let volume: Uint8Array
  const [sx, sy, sz] = ANATOMY.sizeXyz

  beforeAll(async () => {
    const { data, info } = await sharp(resolve('public/peripheral-imaging/anatomy/ct-atlas.png'))
      .raw()
      .toBuffer({ resolveWithObject: true })
    const width = sx * metadata.atlasColumns
    volume = new Uint8Array(sx * sy * sz)
    for (let z = 0; z < sz; z++) {
      const col = z % metadata.atlasColumns
      const row = Math.floor(z / metadata.atlasColumns)
      for (let y = 0; y < sy; y++)
        for (let x = 0; x < sx; x++)
          volume[(z * sy + y) * sx + x] =
            data[((row * sy + y) * width + col * sx + x) * info.channels]
    }
  }, 30_000)

  const hu = (point: Point3): number | null => {
    const index = point.map((value, axis) =>
      Math.round((value - ANATOMY.originMm[axis]) / ANATOMY.spacingMm[axis]),
    )
    if (index.some((value, axis) => value < 0 || value >= ANATOMY.sizeXyz[axis])) return null
    const byte = volume[(index[2] * sy + index[1]) * sx + index[0]]
    return ANATOMY.huRange[0] + (byte / 255) * (ANATOMY.huRange[1] - ANATOMY.huRange[0])
  }
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  const central = (move: (point: Point3) => Point3) =>
    AIRWAY_TREE.filter((branch) => branch.radiusMm >= 3)
      .flatMap((branch) => branch.points.map((point) => hu(move(point))))
      .filter((value): value is number => value !== null)

  it('the centrelines of the wide airways lie in air', () => {
    const inPlace = central((point) => point)
    expect(inPlace.length).toBeGreaterThan(50)
    expect(median(inPlace)).toBeLessThan(-850)
    expect(inPlace.filter((value) => value < -600).length / inPlace.length).toBeGreaterThan(0.9)
  })

  it('and stop doing so when the tree is mirrored or shifted, so the fit is not an accident', () => {
    expect(median(central(([x, y, z]) => [-x, y, z]))).toBeGreaterThan(-400)
    expect(median(central(([x, y, z]) => [x + 10, y, z]))).toBeGreaterThan(-400)
    expect(median(central(([x, y, z]) => [x, -y, z]))).toBeGreaterThan(-400)
  })
})

describe('what the lesson says about the tree is read from it', () => {
  it('main bronchi: the right is short and the left about twice as long', () => {
    expect(AIRWAY_FACTS.rightMainMm).toBeGreaterThan(15)
    expect(AIRWAY_FACTS.rightMainMm).toBeLessThan(35)
    expect(AIRWAY_FACTS.leftMainMm).toBeGreaterThan(40)
    expect(AIRWAY_FACTS.leftMainMm).toBeLessThan(65)
    const text = block('Side and height: what the frontal image does show').body
    expect(text).toContain(`${AIRWAY_FACTS.rightMainMm} mm long`)
    expect(text).toContain(`${AIRWAY_FACTS.leftMainMm} mm long`)
    // "The apical bronchus on the right and the upper division on the left run toward the apex in
    // the plane of the image": upward, and hardly along the beam.
    for (const key of ['RB1', 'LUL-upper-division'] as const) {
      expect(airwayCourse(key).direction[2]).toBeGreaterThan(0.9)
      expect(frontalBeamShare(key)).toBeLessThan(15)
    }
    // "The bronchus intermedius and the lower lobe bronchi continue downward."
    for (const key of ['BI', 'RLL-bronchus', 'LLL-bronchus'] as const)
      expect(airwayCourse(key).direction[2]).toBeLessThan(-0.75)
  })

  it('depth: the bronchi it calls posterior and anterior run that way, mostly along the beam', () => {
    const text = block('Depth: what the frontal image does not show').body
    expect(text).toContain(`${frontalBeamShare('RB6')}% (RB6)`)
    expect(text).toContain(`${frontalBeamShare('LB6')}% (LB6)`)
    for (const key of ['RB6', 'LB6'] as const) {
      expect(airwayCourse(key).direction[1]).toBeLessThan(0)
      expect(frontalBeamShare(key)).toBeGreaterThan(75)
    }
    // "…run anteriorly by as much."
    for (const key of ['RB3', 'LB3', 'RB5', 'LB4'] as const) {
      expect(airwayCourse(key).direction[1]).toBeGreaterThan(0)
      expect(frontalBeamShare(key)).toBeGreaterThan(75)
    }
    // The summary points under it.
    expect(airwayCourse('RB2').direction[1]).toBeLessThan(-0.5)
    for (const key of ['RML-bronchus', 'LUL-lingula'] as const)
      expect(airwayCourse(key).direction[1]).toBeGreaterThan(0.45)
    const basal = ['RB7', 'RB8', 'RB9', 'RB10', 'LB7+8', 'LB9', 'LB10'] as const
    expect(basal.filter((key) => frontalBeamShare(key) < 50).length).toBeGreaterThanOrEqual(5)
  })

  it('overlap: the middle lobe bronchus and RB6 leave within a centimetre, front and back', () => {
    expect(AIRWAY_FACTS.middleLobeAboveSuperiorMm).toBeLessThanOrEqual(10)
    expect(airwayOrigin('RML-bronchus').points[0][2]).toBeGreaterThan(
      airwayOrigin('RB6').points[0][2],
    )
    expect(airwayCourse('RML-bronchus').direction[1]).toBeGreaterThan(0.5)
    expect(airwayCourse('RB6').direction[1]).toBeLessThan(-0.5)
    expect(block('Depth: what the frontal image does not show').body).toContain(
      `${AIRWAY_FACTS.middleLobeAboveSuperiorMm} mm lower`,
    )
  })

  it('the way to the nodule: left main bronchus, left lower lobe bronchus, LB7+8', () => {
    const near = nearestAirway(LESION_CENTER)
    expect(near.branch.key).toBe('LB7+8')
    // Within a few millimetres of the nodule's edge.
    expect(near.distanceMm).toBeLessThan(LESION_RADIUS + 4)
    expect(airwayRouteKeys(near.branch)).toEqual(['trachea', 'LMB', 'LLL-bronchus', 'LB7+8'])
    expect(airwayRouteText(AIRWAY_FACTS.noduleRoute)).toBe(
      'trachea, left main bronchus, left lower lobe bronchus, LB7+8',
    )
    const text = block('Name the airway to the lesion before the procedure').body
    expect(text).toContain(`within ${AIRWAY_FACTS.noduleBronchusMm} mm of the nodule’s centre`)
    // "The last bronchus runs laterally, across the beam … drawn at nearly its full length."
    expect(airwayCourse('LB7+8').direction[0]).toBeGreaterThan(0.8)
    expect(frontalBeamShare('LB7+8')).toBeLessThan(30)
    // "A catheter that turns at the top of the lower lobe bronchus … has entered LB6": LB6 is the
    // first segmental bronchus of the left lower lobe, and it is the foreshortened one.
    expect(mostForeshortened('LLL', 0).key).toBe('LB6')
    expect(airwayOrigin('LB6').points[0][2]).toBeGreaterThan(airwayOrigin('LB7+8').points[0][2])
    // The worked example: its tip turns laterally and a little upward.
    expect(airwayCourse('LB6').direction[0]).toBeGreaterThan(0.3)
    expect(airwayCourse('LB6').direction[2]).toBeGreaterThan(0)
  })

  it('the demonstrations: RB6 is the short one of the right lower lobe, and LB6 opens at LAO 30°', () => {
    expect(mostForeshortened('RLL', 0).key).toBe('RB6')
    expect(mostForeshortened('RML', 0).key).toBe('RB5')
    expect(airwayAlongBeam('LB6', 0)).toBeGreaterThan(0.75)
    expect(airwayAlongBeam('LB6', -30)).toBeLessThan(0.55)
    const titles = teachingDemonstration('airway-anatomy')!.examples.map((example) => example.title)
    expect(titles).toEqual([
      'Frontal · the image alone',
      'Frontal · whole tree by lobe',
      'Frontal · right lower lobe',
      'Frontal · right middle lobe',
      'Frontal · left lower lobe',
      'LAO 30° · left lower lobe',
    ])
  })

  it('the check: the lobe drawn is the left lower, and its keyed bronchus is LB6', () => {
    expect(INTERPRETATION_CHECKS['airway-anatomy']).toBeUndefined()
    expect(fixedExampleValues('airway-anatomy', 0)).toEqual({
      orbit: 0,
      tilt: 0,
      airways: 'LLL',
      airwayNames: false,
    })
    const question = QUESTION_BY_ID['airway-1']
    const keyed = question.choices.find((choice) => choice.id === question.correct)!
    expect(keyed.text).toMatch(/LB6/)
    // The distractor says LB7+8 is drawn at nearly its full length; LB4 is the anterior one.
    expect(frontalBeamShare('LB7+8')).toBeLessThan(30)
    expect(airwayCourse('LB4').direction[1]).toBeGreaterThan(0.7)
  })
})

describe('the control, the readouts and the events', () => {
  it('draws nothing in any other section, and the whole tree when this one opens', () => {
    for (const other of LESSONS.filter((entry) => entry.lab === 'geometry'))
      expect(labDefaults('geometry', other.id).airways).toBe(
        other.id === 'airway-anatomy' ? 'all' : 'off',
      )
  })

  it('is offered only in the airway section: no other step gains a control', () => {
    for (const stageLesson of imagingStageLessons())
      for (const step of stageLesson.steps) {
        const keys = visibleLabControls(step.suite).map((control) => control.key)
        const offered = keys.includes('airways') || keys.includes('airwayNames')
        if (offered) expect(stageLesson.sectionId).toBe('airway-anatomy')
      }
    const own = imagingStageLessons().find((entry) => entry.sectionId === 'airway-anatomy')!
    const hands = own.steps.filter((step) =>
      ['lab-task', 'observe'].includes(step.interaction.kind),
    )
    expect(
      hands.map((step) => visibleLabControls(step.suite).map((control) => control.key)),
    ).toEqual([
      ['airways', 'airwayNames'],
      ['orbit', 'airways', 'airwayNames'],
    ])
  })

  it('names the most foreshortened bronchus of the lobe drawn, and nothing when names are hidden', () => {
    const read = (values: Record<string, string | number | boolean>) =>
      labReadouts(
        'geometry',
        { ...labDefaults('geometry', 'airway-anatomy'), ...values },
        'airway-anatomy',
      )
    expect(read({ airways: 'RLL' }).airwayShortest).toBe(
      `RB6, ${frontalBeamShare('RB6')}% along the beam`,
    )
    expect(read({ airways: 'RLL' }).airwaysDrawn).toBe('Right lower lobe: RB6, RB7, RB8, RB9, RB10')
    expect(read({ airways: 'all' }).airwayShortest).toMatch(/^Show one lobe/)
    const hidden = read({ airways: 'LLL', airwayNames: false })
    expect(`${hidden.airwaysDrawn} ${hidden.airwayShortest}`).not.toMatch(/[LR]B\d/)
  })

  it('records the lobes looked at and a lobe seen from a second angle', () => {
    let state = emptyLabState('geometry', 'airway-anatomy')
    const change = (patch: Record<string, string | number | boolean>) => {
      state = labStateAfterChange('geometry', state, patch, 'airway-anatomy')
    }
    change({ airways: 'RUL' })
    expect(state.events).not.toContain('airway-lower-lobe-seen')
    expect(state.events).not.toContain('airway-lobes-compared')
    change({ airways: 'LLL' })
    expect(state.events).toEqual(
      expect.arrayContaining(['airway-lower-lobe-seen', 'airway-lobes-compared']),
    )
    expect(state.events).not.toContain('airway-lobe-rotated')
    change({ orbit: -30 })
    expect(state.events).toContain('airway-lobe-rotated')
  })
})

describe('the drawing', () => {
  it('gives every lobe, and every segment of a lobe, a colour of its own', () => {
    const lobes = airwayLegend('all')
    expect(lobes.map((entry) => entry.key)).toEqual(AIRWAY_LOBE_KEYS)
    expect(new Set(lobes.map((entry) => entry.color)).size).toBe(lobes.length)
    for (const lobe of AIRWAY_LOBE_KEYS) {
      const legend = airwayLegend(lobe)
      expect(legend.map((entry) => entry.key)).toEqual(AIRWAY_SEGMENTS_BY_LOBE[lobe])
      expect(new Set(legend.map((entry) => entry.color)).size).toBe(legend.length)
      for (const branch of AIRWAY_TREE) {
        const color = airwayColor(branch, lobe)
        const entry = legend.find((item) => item.key === branch.key)
        if (entry) expect(color).toBe(entry.color)
        if (AIRWAY_BRANCHES[branch.key].lobe !== lobe) expect(color).toBeNull()
      }
    }
    expect(AIRWAY_TREE.every((branch) => airwayColor(branch, 'off') === null)).toBe(true)
  })

  it('labels each setting once per name, on the image, with no two names on top of one another', () => {
    for (const show of AIRWAY_SHOW_VALUES)
      for (const orbit of [0, -30, 30]) {
        const labels = airwayLabels(suiteFrame(orbit, 0), show, [0, 0, 0])
        expect(labels.length).toBe(
          show === 'off' ? 0 : show === 'all' ? 9 : AIRWAY_SEGMENTS_BY_LOBE[show].length,
        )
        expect(new Set(labels.map((label) => label.key)).size).toBe(labels.length)
        for (const label of labels) {
          expect(label.x).toBeGreaterThan(0)
          expect(label.x).toBeLessThan(512)
          expect(label.y).toBeGreaterThan(0)
          expect(label.y).toBeLessThan(512)
        }
        for (let i = 0; i < labels.length; i++)
          for (let j = 0; j < i; j++)
            expect(
              Math.abs(labels[i].x - labels[j].x) > 30 || Math.abs(labels[i].y - labels[j].y) > 18,
            ).toBe(true)
      }
  })

  it('draws the patient’s left lung on the right of the frontal image, as the caption says', () => {
    const labels = airwayLabels(suiteFrame(0, 0), 'all', [0, 0, 0])
    const x = (key: string) => labels.find((label) => label.key === key)!.x
    expect(x('LUL')).toBeGreaterThan(256)
    expect(x('LLL')).toBeGreaterThan(256)
    expect(x('RUL')).toBeLessThan(256)
    expect(x('RLL')).toBeLessThan(256)
    const y = (key: string) => labels.find((label) => label.key === key)!.y
    // Top of the image is superior: the upper lobes are named above the lower.
    expect(y('RUL')).toBeLessThan(y('RLL'))
    expect(y('LUL')).toBeLessThan(y('LLL'))
  })
})
