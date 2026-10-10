import * as copy from '../content/bench-copy'
import {
  PRIMER,
  PRIMER_TITLE,
  TEACHING_SIMULATOR_STATEMENT,
  alongSliceSentence,
  arrivalSentence,
  chooseDeclined,
  chooseTaken,
  forkPatternSentence,
  identifyInstruction,
  identifyVerdict,
  lesionSentence,
  lookCaption,
  matchNoteSentence,
  matchVerdict,
  moveSentence,
  openingInScope,
  openingLevelSentence,
  openingName,
  openingNumber,
  openingShort,
  summaryLines,
} from '../content/bench-copy'
import type { CtTrace } from '../content/ct-types'
import { forkFacts, lesionFromFork, type ForkFacts, type LesionFacts } from '../engine/fork-facts'
import {
  optionLocators,
  optionVerdict,
  responsePlane,
  type MarkVerdict,
  type VerdictResult,
} from '../engine/junction-feedback'
import type { NavSummary } from '../engine/nav-session'
import {
  ALL_ORIENTATIONS,
  readMatch,
  stationMatch,
  type OrientationMatch,
} from '../engine/orientation-match'
import { CT_TARGETS, CT_TRACES, targetForTrace, traceById } from '../geometry/native-ct'
import { STANDARD_ORIENTATION, orientationName, type CtOrientation } from '../geometry/orientation'
import { lookingDirection } from '../geometry/reference-frames'
import { arrivalPose, lookKind, stationCamera } from '../geometry/route-stations'

/**
 * Every sentence the bench prints about a fork is built here from the route geometry. These tests
 * run each function on real forks and hold its output to the facts it was given and to the words
 * the course may use.
 */
interface Station {
  trace: CtTrace
  index: number
  id: string
  facts: ForkFacts
  match: OrientationMatch
  lesion: LesionFacts
}
const STATIONS: Station[] = CT_TRACES.flatMap((trace) =>
  trace.checkpoints.flatMap((checkpoint, index) =>
    checkpoint.decision
      ? [
          {
            trace,
            index,
            id: checkpoint.id,
            facts: forkFacts(trace, index)!,
            match: stationMatch(trace, index)!,
            lesion: lesionFromFork(trace, index, targetForTrace(trace))!,
          },
        ]
      : [],
  ),
)
const OPENINGS = STATIONS.flatMap((station) =>
  station.facts.openings.map((opening) => ({ ...station, opening })),
)
const stationOn = (traceId: string, checkpointId: string) =>
  STATIONS.find((station) => station.trace.id === traceId && station.id === checkpointId)!

const MIRROR: CtOrientation = { turns: 0, reflected: true }
const VERDICTS: MarkVerdict[] = ['intended-lumen', 'near-fork', 'other-airway', 'not-in-airway']
const verdictOf = (verdict: MarkVerdict, move = { mm: 6, leftMm: -4, posteriorMm: 4.5 }) =>
  ({
    verdict,
    markInAir: verdict !== 'not-in-airway',
    reached: [],
    nearest: null,
    toIntended: move,
  }) satisfies VerdictResult

/** The same gate the lesson text is held to (nav-lessons.test.ts). */
const GATE =
  /\b(score|scored|points|grade|graded|pass|passed|mastery|correct|incorrect|wrong|synthetic|authored|NOT\s+REVIEWED|pending|faculty)\b/i
const said: string[] = []
/** Records a sentence for the vocabulary gate and checks it is a real sentence. */
function sentence(text: string) {
  expect(typeof text).toBe('string')
  expect(text.trim().length).toBeGreaterThan(0)
  expect(text).toBe(text.trim())
  expect(text).not.toMatch(/undefined|null|NaN|\[object|  /)
  said.push(text)
  return text
}
function band<T extends { headline: string; detail: string }>(value: T): T {
  sentence(value.headline)
  sentence(value.detail)
  return value
}
const withCode = (code: string) =>
  new RegExp(`(^|[^A-Za-z0-9+/])${code.replace(/[+/]/g, '\\$&')}($|[^A-Za-z0-9+/])`)

test('every function the bench can call is exercised below', () => {
  const functions = Object.entries(copy)
    .filter(([, value]) => typeof value === 'function')
    .map(([name]) => name)
    .sort()
  expect(functions).toEqual([
    'alongSliceSentence',
    'arrivalSentence',
    'chooseDeclined',
    'chooseTaken',
    'forkPatternSentence',
    'identifyInstruction',
    'identifyVerdict',
    'lesionSentence',
    'lookCaption',
    'matchNoteSentence',
    'matchVerdict',
    'moveSentence',
    'openingInScope',
    'openingLevelSentence',
    'openingName',
    'openingNumber',
    'openingShort',
    'summaryLines',
  ])
  expect(STATIONS).toHaveLength(128)
  expect(OPENINGS).toHaveLength(257)
})

describe('naming an opening', () => {
  test('openings are numbered from one, never lettered', () => {
    expect([0, 1, 2].map(openingNumber)).toEqual(['1', '2', '3'])
    for (const { opening } of OPENINGS) {
      expect(openingName(opening, false)).toBe(`Opening ${opening.index + 1}`)
      expect(openingShort(opening, false)).toBe(`opening ${opening.index + 1}`)
    }
  })

  test('while its name is withheld, an opening’s name and short form never carry its airway code', () => {
    for (const { opening } of OPENINGS)
      for (const text of [
        sentence(openingName(opening, false)),
        sentence(openingShort(opening, false)),
      ]) {
        expect(text).not.toMatch(withCode(opening.airway.code))
        expect(text).not.toContain(opening.airway.name)
      }
  })

  test('once named, it carries its code, and its side where the code alone does not name it', () => {
    for (const { opening } of OPENINGS) {
      const name = sentence(openingName(opening, true))
      const short = sentence(openingShort(opening, true))
      expect(name.startsWith(`${opening.index + 1} · ${opening.airway.code}`)).toBe(true)
      expect(short).toContain(opening.airway.code)
      if (opening.repeatedName) {
        expect(name).toBe(
          `${opening.index + 1} · ${opening.airway.code}, the ${opening.side} branch`,
        )
        expect(short).toBe(`the ${opening.side} branch of ${opening.airway.code}`)
      } else expect(short).toBe(opening.airway.code)
      expect(sentence(openingInScope(opening))).toBe(`the ${opening.side} opening in the scope`)
    }
    // At a fork, no two openings read the same, named or not.
    for (const { facts } of STATIONS)
      for (const named of [true, false]) {
        expect(new Set(facts.openings.map((o) => openingName(o, named))).size).toBe(
          facts.openings.length,
        )
        expect(new Set(facts.openings.map((o) => openingShort(o, named))).size).toBe(
          facts.openings.length,
        )
        expect(new Set(facts.openings.map(openingInScope)).size).toBe(facts.openings.length)
      }
    const carina = stationOn('central-right', 'junction-1').facts
    expect(carina.openings.map((o) => openingName(o, true))).toEqual([
      '1 · RMSB · Right main bronchus',
      '2 · LMSB · Left main bronchus',
    ])
    const rb4 = stationOn('middle-lobe-lateral', 'junction-19').facts
    expect(openingName(rb4.openings[0], true)).toBe('1 · RB4, the left branch')
    expect(openingShort(rb4.openings[0], true)).toBe('the left branch of RB4')
  })
})

describe('match', () => {
  test('the caption says where the scope is, which way it looks and what is at the top', () => {
    expect(sentence(lookCaption('Trachea', 'down', 'caudally', 'anterior'))).toBe(
      'In Trachea, looking caudally, with anterior at the top of the view.',
    )
    expect(sentence(lookCaption('RB1', 'up', 'cranially', 'the patient’s left'))).toBe(
      'In RB1, looking cranially, with the patient’s left at the top of the view.',
    )
    // Only a level look is said to run along the slice.
    expect(sentence(lookCaption('RB5', 'level', 'anteriorly', 'the head'))).toBe(
      'In RB5, looking anteriorly, with the head at the top of the view. It is looking along the CT slice, not through it.',
    )
    for (const { trace, index, facts } of STATIONS) {
      const camera = stationCamera(trace, index)!
      const look = lookKind(camera.direction)
      const caption = sentence(
        lookCaption(facts.parent.code, look, lookingDirection(camera.direction), 'the head'),
      )
      expect(caption.startsWith(`In ${facts.parent.code}, looking `)).toBe(true)
      expect(caption.includes('along the CT slice')).toBe(look === 'level')
    }
  })

  test('a matching display reads as in; a mismatch names its kind and one letter out of place', () => {
    for (const { match } of STATIONS)
      for (const orientation of ALL_ORIENTATIONS) {
        const reading = readMatch(match, orientation)
        for (const help of [true, false]) {
          const verdict = band(matchVerdict(reading, orientation, help))
          if (reading.kind === 'matches') {
            expect(verdict.tone).toBe('in')
            expect(verdict.headline).toBe('The CT matches the scope.')
            expect(verdict.detail).toContain(orientationName(orientation).toLowerCase())
          } else {
            expect(verdict.tone).toBe('miss')
            expect(verdict.headline).toBe(
              {
                mirrored: 'Mirrored.',
                rotated: 'Rotated.',
                'rotated-and-mirrored': 'Rotated and mirrored.',
              }[reading.kind],
            )
            // What to do about it is said only when help is on.
            expect(/\b(flip|rotate (left|right))\b/i.test(verdict.detail)).toBe(help)
          }
        }
      }
  })

  test('at the carina a standard CT is mirrored: R is on the scope’s right and the CT’s left', () => {
    const { match } = stationOn('central-right', 'junction-1')
    const reading = readMatch(match, STANDARD_ORIENTATION)
    expect(matchVerdict(reading, STANDARD_ORIENTATION, false)).toEqual({
      tone: 'miss',
      headline: 'Mirrored.',
      detail: 'The scope has R (patient’s right) on the right; your CT has it on the left.',
    })
    expect(matchVerdict(reading, STANDARD_ORIENTATION, true).detail).toBe(
      'The scope has R (patient’s right) on the right; your CT has it on the left. Flip.',
    )
    expect(matchVerdict(readMatch(match, MIRROR), MIRROR, true)).toMatchObject({
      tone: 'in',
      headline: 'The CT matches the scope.',
    })
    // A reading without an example still says something.
    expect(
      band(matchVerdict({ kind: 'rotated', example: null, operations: ['left'] }, MIRROR, false))
        .detail,
    ).toBe('A letter sits on a different side of the two pictures.')
  })

  test('a CT the learner did not turn is accounted for: kept, or turned by the bench', () => {
    for (const orientation of ALL_ORIENTATIONS)
      for (const note of ['kept', 'set'] as const)
        for (const firstFork of [true, false]) {
          const text = sentence(matchNoteSentence(note, orientation, firstFork))
          // The display is named whenever the bench turned the CT, and at a trip's first fork.
          if (note === 'set' || firstFork)
            expect(text).toContain(orientationName(orientation).toLowerCase())
          expect(/has been turned/.test(text)).toBe(note === 'set')
          // Only a later fork can speak of the fork before.
          if (firstFork) expect(text).not.toMatch(/last fork|has turned,/)
        }
    expect(matchNoteSentence('kept', MIRROR, false)).toBe(
      'The CT still matches the scope from the last fork.',
    )
  })

  test('a sideways look is explained, naming the axis that runs into the picture', () => {
    const seen = new Set<string | null>()
    for (const { match } of STATIONS) {
      const text = sentence(alongSliceSentence(match))
      seen.add(match.weakAxis)
      expect(text).toContain('scrolling toward the head')
      expect(text.includes('R and L are not on the scope’s rim')).toBe(
        match.weakAxis === 'left-right',
      )
      expect(text.includes('A and P are not on the scope’s rim')).toBe(
        match.weakAxis === 'anterior-posterior',
      )
    }
    expect(seen).toEqual(new Set([null, 'left-right', 'anterior-posterior']))
  })
})

describe('identify', () => {
  test('the instruction says which opening, and which way to scroll to its slice', () => {
    for (const { opening } of OPENINGS) {
      const here = sentence(identifyInstruction(opening, opening.slice))
      expect(here).toBe(
        `Opening ${opening.index + 1} is the ${opening.side} opening in the scope. You are on its slice, ${opening.slice}. Click inside its lumen.`,
      )
      const below = sentence(identifyInstruction(opening, opening.slice - 7))
      const above = sentence(identifyInstruction(opening, opening.slice + 7))
      for (const text of [below, above]) {
        expect(text).toContain(`slice ${opening.slice}`)
        expect(text).not.toMatch(withCode(opening.airway.code))
      }
      // Slice numbers rise toward the head on this CT.
      expect(below).toContain('scroll toward the head')
      expect(above).toContain('scroll toward the feet')
      expect(here).not.toMatch(/scroll/)
    }
  })

  test('directions follow the native axes: +x is the patient’s left, +y is posterior', () => {
    expect(moveSentence({ mm: 5, leftMm: 0, posteriorMm: 5 })).toBe('about 5 mm posterior')
    expect(moveSentence({ mm: 5, leftMm: -5, posteriorMm: 0 })).toBe(
      'about 5 mm toward the patient’s right',
    )
    expect(moveSentence({ mm: 7.1, leftMm: 5, posteriorMm: -5 })).toBe(
      'about 7 mm anterior and toward the patient’s left',
    )
    expect(moveSentence({ mm: 1.2, leftMm: 1.2, posteriorMm: 0 })).toBe(
      '1 to 2 mm toward the patient’s left',
    )
    // A small component is left out of the direction.
    expect(moveSentence({ mm: 10, leftMm: 9.5, posteriorMm: 3 })).toBe(
      'about 10 mm toward the patient’s left',
    )
    sentence(moveSentence({ mm: 6, leftMm: -4, posteriorMm: 4.5 }))
  })

  test('every verdict has a band; without help it gives no distance and no way to move', () => {
    for (const { opening } of OPENINGS)
      for (const verdict of VERDICTS)
        for (const named of [true, false])
          for (const nearestName of [null, named ? 'RB9' : 'opening 9']) {
            const result = verdictOf(verdict)
            const quiet = band(identifyVerdict(opening, result, named, nearestName, false))
            const helped = band(identifyVerdict(opening, result, named, nearestName, true))
            expect(quiet.tone).toBe(
              {
                'intended-lumen': 'in',
                'near-fork': 'near',
                'other-airway': 'miss',
                'not-in-airway': 'miss',
              }[verdict],
            )
            expect(helped.tone).toBe(quiet.tone)
            expect(helped.headline).toBe(quiet.headline)
            for (const text of [quiet.headline, quiet.detail]) {
              expect(text).not.toMatch(/\bmm\b/)
              expect(text).not.toMatch(/from your mark/)
            }
            // With help, a mark that is not in the lumen is told how far and which way.
            if (verdict === 'intended-lumen') expect(helped.detail).toBe(quiet.detail)
            else
              expect(helped.detail).toBe(
                `${quiet.detail} Opening ${opening.index + 1} is about 6 mm posterior and toward the patient’s right from your mark.`,
              )
            // While names are withheld, the band does not give the opening's own name away.
            if (!named)
              for (const text of [quiet.headline, quiet.detail, helped.detail]) {
                expect(text).not.toMatch(withCode(opening.airway.code))
                expect(text).not.toContain(opening.airway.name)
              }
          }
  })

  test('the band says what the mark landed in', () => {
    const { facts } = stationOn('central-right', 'junction-1')
    const [rmsb] = facts.openings
    expect(identifyVerdict(rmsb, verdictOf('intended-lumen'), true, null, false)).toEqual({
      tone: 'in',
      headline: 'In the lumen.',
      detail:
        'Opening 1 is RMSB, right main bronchus. It runs to the patient’s right and down from the fork.',
    })
    expect(identifyVerdict(rmsb, verdictOf('intended-lumen'), false, null, false).detail).toBe(
      'That is opening 1. It runs to the patient’s right and down from the fork.',
    )
    expect(identifyVerdict(rmsb, verdictOf('other-airway'), true, 'LMSB', false)).toEqual({
      tone: 'miss',
      headline: 'That lumen is LMSB.',
      detail: 'Your mark is inside an airway, but not opening 1.',
    })
    expect(identifyVerdict(rmsb, verdictOf('other-airway'), false, null, false).headline).toBe(
      'That is another airway.',
    )
    expect(identifyVerdict(rmsb, verdictOf('near-fork'), true, 'LMSB', false)).toMatchObject({
      tone: 'near',
      headline: 'Near the fork.',
    })
    expect(identifyVerdict(rmsb, verdictOf('near-fork'), true, null, false).detail).toContain(
      'on the side of the other airway',
    )
    expect(identifyVerdict(rmsb, verdictOf('not-in-airway'), true, null, false)).toEqual({
      tone: 'miss',
      headline: 'Not in an airway.',
      detail:
        'An airway is a dark lumen with a thin bright wall. Your mark is on wall, vessel or lung.',
    })
  })

  test('on real marks at the carina the band and the engine agree', () => {
    const trace = traceById('central-right')
    const { facts } = stationOn('central-right', 'junction-1')
    const [rmsb, lmsb] = facts.openings
    const at = (option: number) => ({ slice: 372, pixel: responsePlane(trace, 0, option)!.pixel })
    const own = optionVerdict(trace, 0, 0, at(0))!
    expect(band(identifyVerdict(rmsb, own, true, null, true)).headline).toBe('In the lumen.')
    const other = optionVerdict(trace, 0, 0, at(1))!
    expect(other.verdict).toBe('other-airway')
    const told = band(identifyVerdict(rmsb, other, true, openingShort(lmsb, true), true))
    expect(told.headline).toBe('That lumen is LMSB.')
    // The right main bronchus is 30 mm toward the patient's right of a mark in the left.
    expect(told.detail).toBe(
      'Your mark is inside an airway, but not opening 1. Opening 1 is about 31 mm toward the patient’s right from your mark.',
    )
    // A fork that still shares one air column: the middle lobe bronchus, on RB5's side.
    const rml = stationOn('middle-lobe-lateral', 'junction-10')
    const sibling = optionLocators(rml.trace, rml.index, 0).find((l) => l.role === 'daughter')!
    const near = optionVerdict(rml.trace, rml.index, 0, {
      slice: rml.facts.openings[0].slice,
      pixel: sibling.pixel,
    })!
    expect(near.verdict).toBe('near-fork')
    const nearBand = band(
      identifyVerdict(
        rml.facts.openings[0],
        near,
        true,
        openingShort(rml.facts.openings[1], true),
        false,
      ),
    )
    expect(nearBand).toEqual({
      tone: 'near',
      headline: 'Near the fork.',
      detail:
        'On this slice the two lumens are still one air column, and your mark is on the side of RB5.',
    })
  })
})

describe('choose', () => {
  test('the lesion is placed from the fork: segment, level, distance and bearing', () => {
    for (const { trace, lesion } of STATIONS) {
      const target = targetForTrace(trace)
      const text = sentence(lesionSentence(target, lesion))
      expect(text.startsWith(`The lesion is in ${target.segment.code}, the `)).toBe(true)
      expect(text).toContain(`(slice ${target.slice})`)
      expect(text).toContain(`about ${Math.round(lesion.mm)} mm away, ${lesion.bearing}.`)
      // Above the fork is toward the head, below it toward the feet.
      expect(text.includes('toward the head of this fork')).toBe(lesion.slicesFromFork > 0)
      expect(text.includes('toward the feet of this fork')).toBe(lesion.slicesFromFork < 0)
      expect(text.includes('on this fork’s own slice')).toBe(lesion.slicesFromFork === 0)
    }
  })

  test('an opening that leads away is told why, and the route’s opening is confirmed', () => {
    for (const { opening, lesion } of OPENINGS) {
      if (opening.onRoute) {
        const taken = band(chooseTaken(opening, lesion))
        expect(taken.headline).toBe(`${opening.airway.code} leads toward the lesion.`)
        expect(taken.detail).toContain(`runs ${opening.course} from the fork`)
        expect(taken.detail).toContain(`The lesion lies ${lesion.bearing}, `)
        continue
      }
      for (const named of [true, false]) {
        const declined = band(chooseDeclined(opening, named, lesion))
        expect(declined.headline.endsWith(' leads away from the lesion.')).toBe(true)
        expect(declined.headline[0]).toBe(declined.headline[0].toUpperCase())
        expect(declined.detail).toContain(`It runs ${opening.course} from the fork.`)
        expect(declined.detail).toContain(`The lesion lies ${lesion.bearing}, `)
        expect(declined.detail).toContain('First move: back to the fork')
        if (!named)
          for (const text of [declined.headline, declined.detail]) {
            expect(text).not.toMatch(withCode(opening.airway.code))
            expect(text).not.toContain(opening.airway.name)
          }
        else expect(declined.headline).toContain(opening.airway.code)
      }
    }
    const { facts, lesion } = stationOn('central-right', 'junction-1')
    expect(chooseDeclined(facts.openings[1], false, lesion).headline).toBe(
      'Opening 2 leads away from the lesion.',
    )
    expect(chooseDeclined(facts.openings[1], true, lesion).headline).toBe(
      'LMSB leads away from the lesion.',
    )
    expect(chooseTaken(facts.openings[0], lesion).headline).toBe('RMSB leads toward the lesion.')
  })

  test('a lesion within two slices of the fork is at about its level; farther off, the level is given', () => {
    const { facts } = stationOn('central-right', 'junction-1')
    const [rmsb] = facts.openings
    const lesionAt = (slicesFromFork: number): LesionFacts => ({
      slice: 300,
      slicesFromFork,
      mm: 40,
      bearing: 'forward',
    })
    for (const near of [-2, 0, 2])
      expect(chooseTaken(rmsb, lesionAt(near)).detail).toContain(
        'The lesion lies forward, at about this fork’s level.',
      )
    expect(chooseTaken(rmsb, lesionAt(-3)).detail).toContain(
      'The lesion lies forward, 3 slices (1.5 mm) toward the feet of this fork.',
    )
    expect(chooseDeclined(rmsb, true, lesionAt(12)).detail).toContain(
      'The lesion lies forward, 12 slices (6 mm) toward the head of this fork.',
    )
  })
})

describe('fork facts, arrival and the summary', () => {
  test('each opening’s level is its slice and how far that is from the fork', () => {
    for (const { opening } of OPENINGS) {
      const text = sentence(openingLevelSentence(opening))
      expect(text.startsWith(`slice ${opening.slice}, `)).toBe(true)
      expect(text.includes('toward the head')).toBe(opening.slicesFromFork > 0)
      expect(text.includes('toward the feet')).toBe(opening.slicesFromFork < 0)
      expect(text.includes('on the fork’s own slice')).toBe(opening.slicesFromFork === 0)
    }
    const carina = stationOn('central-right', 'junction-1').facts
    expect(openingLevelSentence(carina.openings[0])).toBe(
      'slice 372, 20 slices (10 mm) toward the feet',
    )
  })

  test('the pattern sentence names a direction only where a daughter is found that way', () => {
    for (const { facts } of STATIONS) {
      const text = sentence(forkPatternSentence(facts))
      expect(text.includes('within the plane')).toBe(facts.inPlane)
      if (facts.inPlane) continue
      // Within a slice of the fork counts as the fork's own level.
      const up = facts.openings.some((opening) => opening.slicesFromFork > 1)
      const down = facts.openings.some((opening) => opening.slicesFromFork < -1)
      const level = facts.openings.some((opening) => Math.abs(opening.slicesFromFork) <= 1)
      expect([facts.checkpointId, text.includes('toward the head')]).toEqual([
        facts.checkpointId,
        up,
      ])
      expect([facts.checkpointId, text.includes('toward the feet')]).toEqual([
        facts.checkpointId,
        down,
      ])
      expect([facts.checkpointId, text.includes('fork’s own level')]).toEqual([
        facts.checkpointId,
        level,
      ])
    }
    expect(forkPatternSentence(stationOn('central-right', 'junction-2').facts)).toBe(
      'One daughter is found by scrolling toward the head and the other toward the feet.',
    )
    expect(forkPatternSentence(stationOn('middle-lobe-lateral', 'junction-10').facts)).toBe(
      'The daughters are identified on the same slice: they part side to side, within the plane.',
    )
    expect(forkPatternSentence(stationOn('central-right', 'junction-5').facts)).toBe(
      'Both daughters are found by scrolling toward the feet, at different levels.',
    )
    // RB1/B2: one daughter stays on the fork's slice while the other climbs.
    expect(forkPatternSentence(stationOn('right-upper-apical', 'junction-7').facts)).toBe(
      'One daughter is at the fork’s own level; the other is found by scrolling toward the head.',
    )
    // The three-way fork: one up, two down.
    expect(forkPatternSentence(stationOn('right-lower-basal', 'junction-138').facts)).toBe(
      'Three daughters here: one toward the head, two toward the feet.',
    )
  })

  test('arrival says where the scope stopped and how far beyond it the lesion sits', () => {
    for (const trace of CT_TRACES) {
      const target = targetForTrace(trace)
      const tip = arrivalPose(trace).position
      const gapMm = Math.hypot(...target.centerLps.map((v, axis) => v - tip[axis]))
      const text = sentence(arrivalSentence(target, gapMm))
      expect(text).toBe(
        `The scope is at the end of ${target.approachCode} in this airway model. The lesion sits about ${Math.round(gapMm)} mm beyond it, in ${target.segment.code}. On the CT the lesion is ringed on slice ${target.slice}.`,
      )
      expect(gapMm).toBeGreaterThan(0)
    }
    expect(CT_TARGETS).toHaveLength(13)
  })

  test('the summary gives one line for each step that was asked, and none for a step that was not', () => {
    const summary: NavSummary = {
      forks: 6,
      match: { asked: 3, firstTry: 2 },
      identify: { asked: 4, firstTry: 1 },
      choose: { asked: 6, firstTry: 6 },
      slowest: { station: 1, tries: 4 },
    }
    const names = ['Trachea', 'RMSB', 'BI']
    const lines = summaryLines(summary, names)
    lines.forEach(sentence)
    expect(lines).toEqual([
      'CT matched to the scope first try: 2 of 3.',
      'Openings identified first try: 1 of 4.',
      'Opening toward the lesion chosen first try: 6 of 6.',
      'The fork that took longest: RMSB, 4 tries.',
    ])
    // A step no fork asked for has no line.
    const none = { asked: 0, firstTry: 0 }
    expect(summaryLines({ ...summary, identify: none, slowest: null }, names)).toEqual([
      'CT matched to the scope first try: 2 of 3.',
      'Opening toward the lesion chosen first try: 6 of 6.',
    ])
    expect(summaryLines({ ...summary, match: none, identify: none, slowest: null }, names)).toEqual(
      ['Opening toward the lesion chosen first try: 6 of 6.'],
    )
    expect(
      summaryLines({ forks: 2, match: none, identify: none, choose: none, slowest: null }, names),
    ).toEqual([])
    // A fork whose name is not known is still mentioned.
    expect(summaryLines({ ...summary, slowest: { station: 5, tries: 2 } }, names).at(-1)).toBe(
      'The fork that took longest: one fork, 2 tries.',
    )
  })
})

describe('the words the bench uses', () => {
  test('the primer and the boundary statement say what the module is and is not', () => {
    expect(PRIMER_TITLE.trim().length).toBeGreaterThan(0)
    expect(PRIMER).toHaveLength(4)
    PRIMER.forEach(sentence)
    sentence(PRIMER_TITLE)
    sentence(TEACHING_SIMULATOR_STATEMENT)
    // The four moves are named in the order they are worked.
    const moves = ['Match:', 'Identify:', 'Choose:', 'Drive:'].map((move) =>
      PRIMER[2].indexOf(move),
    )
    expect(moves.every((at) => at >= 0)).toBe(true)
    expect(moves).toEqual([...moves].sort((a, b) => a - b))
    expect(TEACHING_SIMULATOR_STATEMENT).toMatch(/teaching simulator built on one CT scan/)
    expect(TEACHING_SIMULATOR_STATEMENT).toMatch(/does not replace supervised practice on patients/)
  })

  test('nothing the bench can say uses a scoring, answer-leak or project-record word', () => {
    // Every function, on every fork and opening of every route, in every mode it can be called in.
    const all: string[] = [...PRIMER, PRIMER_TITLE, TEACHING_SIMULATOR_STATEMENT]
    const bands = (value: { headline: string; detail: string }) =>
      all.push(value.headline, value.detail)
    for (const { trace, index, facts, match, lesion } of STATIONS) {
      const target = targetForTrace(trace)
      const camera = stationCamera(trace, index)!
      all.push(
        lookCaption(
          facts.parent.code,
          lookKind(camera.direction),
          lookingDirection(camera.direction),
          'the head',
        ),
        alongSliceSentence(match),
        forkPatternSentence(facts),
        lesionSentence(target, lesion),
        arrivalSentence(target, 12),
      )
      for (const orientation of ALL_ORIENTATIONS) {
        for (const help of [true, false])
          bands(matchVerdict(readMatch(match, orientation), orientation, help))
        for (const note of ['kept', 'set'] as const)
          for (const firstFork of [true, false])
            all.push(matchNoteSentence(note, orientation, firstFork))
      }
      for (const opening of facts.openings) {
        all.push(
          openingNumber(opening.index),
          openingInScope(opening),
          openingLevelSentence(opening),
        )
        all.push(identifyInstruction(opening, opening.slice), identifyInstruction(opening, 300))
        bands(chooseTaken(opening, lesion))
        for (const named of [true, false]) {
          all.push(openingName(opening, named), openingShort(opening, named))
          bands(chooseDeclined(opening, named, lesion))
          for (const verdict of VERDICTS)
            for (const help of [true, false])
              bands(
                identifyVerdict(
                  opening,
                  verdictOf(verdict),
                  named,
                  openingShort(opening, named),
                  help,
                ),
              )
        }
      }
    }
    all.push(moveSentence({ mm: 6, leftMm: -4, posteriorMm: 4.5 }))
    all.push(
      ...summaryLines(
        {
          forks: 3,
          match: { asked: 3, firstTry: 2 },
          identify: { asked: 2, firstTry: 1 },
          choose: { asked: 3, firstTry: 3 },
          slowest: { station: 1, tries: 3 },
        },
        ['Trachea', 'RMSB', 'BI'],
      ),
    )
    // And whatever the tests above produced, when they ran.
    all.push(...said)
    const unique = [...new Set(all)]
    expect(unique.length).toBeGreaterThan(1000)
    for (const text of unique) expect(text.trim().length).toBeGreaterThan(0)
    expect(unique.filter((text) => GATE.test(text))).toEqual([])
    // The gate itself reads whole words in any case.
    expect(GATE.test('Correct!')).toBe(true)
    expect(GATE.test('Not  reviewed')).toBe(true)
    expect(GATE.test('The scope passes the bypass and is incorrectly underscored.')).toBe(false)
  })
})
