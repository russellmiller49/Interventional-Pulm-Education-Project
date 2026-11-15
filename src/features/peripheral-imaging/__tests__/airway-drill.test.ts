import { resolveSuiteInputs } from '../components/suite/suiteViewSpec'
import { visibleLabControls } from '../components/suite/LabDock'
import {
  AIRWAY_DRILL,
  DRILL_ANSWER_LABELS,
  airwayDrillLinkTarget,
  airwayDrillValues,
  airwayDrillView,
  drillDebrief,
  drillVerdict,
} from '../content/airwayDrill'
import { AIRWAY_BRANCHES } from '../content/airwayNames'
import { imagingStageLessons } from '../content/stageLessons'
import { LAB_CONTROLS, labDefaults } from '../engine/labMetrics'
import {
  AIRWAY_DRILL_CASES,
  DRILL_ANSWERS,
  DRILL_NODULE_BRONCHUS,
  DRILL_ORBIT_LIMIT,
  airwayDrillCase,
  drillFrontalSide,
  drillShift,
} from '../lib/airwayDrill'
import { AIRWAY_CARINA, AIRWAY_TREE, LESION_AIRWAYS } from '../lib/airwayTree'
import { LESION_CENTER } from '../lib/physics'

/*
 * Practice drill, "Where is the nodule from the catheter tip?" (airway anatomy, part 4).
 *
 * Every position is a point on the named airway tree of the course CT, and everything the drill
 * says about it is computed from that point. These tests hold the positions to what makes them
 * fair questions, and the feedback to the geometry the learner was shown.
 */
describe('the catheter positions', () => {
  it('are eight, two for each answer, and no answer follows itself', () => {
    expect(AIRWAY_DRILL_CASES).toHaveLength(8)
    for (const answer of DRILL_ANSWERS)
      expect(AIRWAY_DRILL_CASES.filter((entry) => entry.answer === answer)).toHaveLength(2)
    for (let i = 1; i < AIRWAY_DRILL_CASES.length; i++)
      expect(AIRWAY_DRILL_CASES[i].answer).not.toBe(AIRWAY_DRILL_CASES[i - 1].answer)
    expect(AIRWAY_DRILL_CASES.map((entry) => entry.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('have addresses that name neither the bronchus nor the answer', () => {
    for (const entry of AIRWAY_DRILL_CASES) {
      expect(entry.id).toMatch(/^position-\d$/)
      expect(airwayDrillCase(entry.id)).toBe(entry)
      expect(airwayDrillLinkTarget(entry.id)).toEqual({
        pathname: '/peripheral-imaging/practice',
        query: { drill: entry.id },
      })
    }
    expect(airwayDrillCase('none')).toBeUndefined()
    expect(airwayDrillCase(undefined)).toBeUndefined()
  })

  it('lie in the bronchi the lesson named, near the nodule and not at it', () => {
    expect(AIRWAY_DRILL_CASES.map((entry) => entry.bronchus)).toEqual([
      'LB9',
      'LB5',
      'LB7+8',
      'LB5',
      'LB10',
      'LB5',
      'LB7+8',
      'LB5',
    ])
    expect(DRILL_NODULE_BRONCHUS).toBe('LB7+8')
    for (const entry of AIRWAY_DRILL_CASES) {
      // Each is one of the bronchi the reveal colours and names.
      expect(LESION_AIRWAYS).toContain(entry.bronchus)
      expect(entry.distanceMm).toBeGreaterThan(14)
      expect(entry.distanceMm).toBeLessThan(45)
      // Neither half of the answer is a close call.
      expect(Math.abs(entry.anteriorMm)).toBeGreaterThanOrEqual(12)
      expect(Math.abs(entry.lateralMm)).toBeGreaterThanOrEqual(10)
      // The tip is in the left lung, with the nodule, so "medial" means toward the midline for both.
      expect(entry.tip[0]).toBeGreaterThan(40)
    }
  })

  it('draw the catheter from the trachea to the tip along the airway tree', () => {
    const onTree = new Set(AIRWAY_TREE.flatMap((branch) => branch.points.map((p) => p.join(','))))
    const trachea = AIRWAY_TREE.find((branch) => branch.parent === null)!
    for (const entry of AIRWAY_DRILL_CASES) {
      expect(entry.path[0]).toEqual(trachea.points[0])
      expect(entry.path[entry.path.length - 1]).toEqual(entry.tip)
      for (const point of entry.path) expect(onTree.has(point.join(','))).toBe(true)
      // No point is repeated where two branches meet, so the line has no zero-length step.
      for (let i = 1; i < entry.path.length; i++)
        expect(entry.path[i].join(',')).not.toBe(entry.path[i - 1].join(','))
    }
  })
})

describe('what the image shows for each position', () => {
  it('the frontal image gives the side: the nodule is drawn on the side it lies', () => {
    for (const entry of AIRWAY_DRILL_CASES) {
      expect(`${entry.id} ${drillFrontalSide(entry)}`).toBe(
        `${entry.id} ${entry.answer.split('-')[1]}`,
      )
      // Measured from the carina instead of the middle of the CT, the side is the same.
      const fromCarina =
        Math.abs(LESION_CENTER[0] - AIRWAY_CARINA[0]) > Math.abs(entry.tip[0] - AIRWAY_CARINA[0])
      expect(fromCarina ? 'lateral' : 'medial').toBe(entry.answer.split('-')[1])
    }
  })

  it('the rotation gives the depth: in front moves with the heart, behind with the spine', () => {
    for (const entry of AIRWAY_DRILL_CASES) {
      const lao = drillShift(entry, -DRILL_ORBIT_LIMIT)
      const rao = drillShift(entry, DRILL_ORBIT_LIMIT)
      if (entry.answer.startsWith('anterior')) {
        // Toward the midline at LAO, as the heart moves; toward the chest wall at RAO.
        expect(lao).toBeLessThan(0)
        expect(rao).toBeGreaterThan(0)
      } else {
        expect(lao).toBeGreaterThan(0)
        expect(rao).toBeLessThan(0)
      }
      // Within the 30° the room allows, at least one direction moves the nodule plainly.
      expect(Math.max(Math.abs(lao), Math.abs(rao))).toBeGreaterThanOrEqual(12)
      expect(drillShift(entry, 0)).toBe(0)
    }
  })
})

describe('the feedback', () => {
  it('states the distances, the reading and the bronchus of each position', () => {
    for (const entry of AIRWAY_DRILL_CASES) {
      const [depth, side] = entry.answer.split('-')
      const debrief = drillDebrief(entry)
      expect(debrief.position).toContain(
        `${Math.round(Math.abs(entry.anteriorMm))} mm ${depth} and ${Math.round(Math.abs(entry.lateralMm))} mm ${side} to the catheter tip`,
      )
      expect(debrief.side).toContain(
        side === 'lateral' ? 'further from the midline' : 'nearer the midline',
      )
      expect(debrief.depth).toContain(
        depth === 'anterior' ? 'the way the heart moves' : 'the way the spine moves',
      )
      expect(debrief.depth).toContain(
        depth === 'anterior'
          ? 'toward the midline against the tip'
          : 'toward the chest wall against the tip',
      )
      expect(debrief.depth).toMatch(depth === 'anterior' ? /lies in front\.$/ : /lies behind\.$/)
      expect(debrief.next).toContain(AIRWAY_BRANCHES[entry.bronchus].short)
      expect(debrief.next).toContain('LB7+8')
    }
  })

  it('sends a catheter in another segment back to the bronchus it shares with the nodule', () => {
    const by = (bronchus: string) =>
      drillDebrief(AIRWAY_DRILL_CASES.find((entry) => entry.bronchus === bronchus)!).next
    expect(by('LB9')).toBe(
      'The catheter is in LB9. The nodule is reached through LB7+8: withdraw to the left lower lobe bronchus, then take LB7+8.',
    )
    expect(by('LB5')).toBe(
      'The catheter is in LB5. The nodule is reached through LB7+8: withdraw to the left main bronchus, then take the left lower lobe bronchus and LB7+8.',
    )
    expect(by('LB7+8')).toMatch(
      /^The catheter is in LB7\+8, the bronchus that leads to the nodule, in a neighbouring branch of it\. Withdraw to the last division/,
    )
  })

  it('tells the learner which half of their answer agreed with the image', () => {
    const entry = AIRWAY_DRILL_CASES[0]
    expect(entry.answer).toBe('anterior-lateral')
    expect(drillVerdict(entry, 'anterior-lateral')).toBe(
      'Yes: the nodule lies anterior and lateral to the tip.',
    )
    expect(drillVerdict(entry, 'anterior-medial')).toMatch(
      /^The depth is as you read it, the side is not/,
    )
    expect(drillVerdict(entry, 'posterior-lateral')).toMatch(
      /^The side is as you read it, the depth is not/,
    )
    expect(drillVerdict(entry, 'posterior-medial')).toMatch(/^Neither the depth nor the side/)
    expect(Object.keys(DRILL_ANSWER_LABELS)).toEqual(DRILL_ANSWERS)
  })
})

describe('the screen', () => {
  const view = airwayDrillView()
  const entry = AIRWAY_DRILL_CASES[0]

  it('offers rotation only, held to 30° either way, and prints no readout', () => {
    expect(visibleLabControls(view, true).map((control) => control.key)).toEqual(['drillOrbit'])
    expect(visibleLabControls(view, false).map((control) => control.key)).toEqual(['drillOrbit'])
    const control = LAB_CONTROLS.geometry.find((item) => item.key === 'drillOrbit')!
    expect([control.min, control.max]).toEqual([-DRILL_ORBIT_LIMIT, DRILL_ORBIT_LIMIT])
    expect(view.readouts).toEqual([])
    expect(resolveSuiteInputs(view, airwayDrillValues(entry, 75, false)).orbit).toBe(30)
    expect(resolveSuiteInputs(view, airwayDrillValues(entry, -75, false)).orbit).toBe(-30)
    expect(AIRWAY_DRILL.situation).toContain(`${DRILL_ORBIT_LIMIT}° of obliquity either way`)
  })

  it('draws the catheter without a tool, and the bronchi only once an answer is in', () => {
    const asked = resolveSuiteInputs(view, airwayDrillValues(entry, 0, false))
    expect(asked.drillCase).toBe(entry.id)
    expect(asked.showTool).toBe(false)
    expect(asked.airwayShow).toBe('off')
    const revealed = resolveSuiteInputs(view, airwayDrillValues(entry, 0, true))
    expect(revealed.airwayShow).toBe('lesion')
    expect(revealed.airwayNames).toBe(true)
    expect(revealed.drillCase).toBe(entry.id)
  })

  it('leaves every section of the course as it was: no catheter, and no drill control offered', () => {
    for (const stageLesson of imagingStageLessons())
      for (const step of stageLesson.steps) {
        expect(visibleLabControls(step.suite).map((control) => control.key)).not.toContain(
          'drillOrbit',
        )
        if (step.suite.lab === 'geometry')
          expect(
            resolveSuiteInputs(step.suite, labDefaults('geometry', stageLesson.sectionId))
              .drillCase,
          ).toBe('none')
      }
    // The position drawn is set by the drill's own screen: it is not a control anywhere.
    expect(LAB_CONTROLS.geometry.map((control) => control.key)).not.toContain('drillCase')
  })

  it('says nothing before an answer that an answer would give away', () => {
    const before = [
      AIRWAY_DRILL.title,
      AIRWAY_DRILL.situation,
      AIRWAY_DRILL.question,
      AIRWAY_DRILL.method,
      AIRWAY_DRILL.imageLegend,
      AIRWAY_DRILL.summary,
    ].join(' ')
    expect(before).not.toMatch(/[LR]B\d/)
    expect(before).not.toMatch(/\d+ mm/)
    expect(before).not.toMatch(/heart|spine/i)
  })
})
