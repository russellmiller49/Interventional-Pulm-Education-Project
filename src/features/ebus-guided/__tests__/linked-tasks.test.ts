import {
  emptyLinkedSweep,
  sampleLinkedSweep,
  linkedTaskKey,
  isLinkedFrameSource,
} from '@/lib/ebus-linked-contract'
import { acquired } from '../testing/linked-fixture'
import { LESSONS } from '../content/curriculum'
import { emptyRecord, parseRecord, firstAttempt, recordLinkedObservation } from '../engine/progress'

const frame = (roll: number, visible: boolean, contact = 1) => ({
  roll,
  visible,
  contact,
  frameId: 'frame-' + roll,
})
const cross = () =>
  [frame(40, false), ...[30, 20, 10, 0, -10].map((r) => frame(r, true)), frame(-20, false)].reduce(
    sampleLinkedSweep,
    emptyLinkedSweep(),
  )
it('requires a gradual one-direction crossing with several actual planes and both edges', () => {
  expect(sampleLinkedSweep(emptyLinkedSweep(), frame(0, true)).phase).toBe('find-edge')
  expect(cross()).toMatchObject({ phase: 'complete', samples: 5, span: 40 })
  let sweep = sampleLinkedSweep(emptyLinkedSweep(), frame(40, false))
  sweep = sampleLinkedSweep(sweep, frame(30, true))
  expect(sampleLinkedSweep(sweep, frame(30, true))).toBe(sweep)
  expect(sampleLinkedSweep(sweep, frame(-20, false)).phase).toBe('find-edge')
  expect(sampleLinkedSweep(sweep, frame(40, false)).phase).toBe('find-edge')
  expect(sampleLinkedSweep(sweep, frame(20, true, 0.2)).phase).toBe('find-edge')
  expect(emptyLinkedSweep().phase).toBe('find-edge')
})
it('stores current task evidence separately, with actual source settings and interpretation, without upgrading old completion', () => {
  const lesson = LESSONS.find((l) => l.id === 'station-seven')!
  const historical = firstAttempt(
    { ...emptyRecord(), completed: [lesson.id] },
    lesson.id + ':' + lesson.observation.id,
    lesson.observation,
    'a',
  )
  const raw = JSON.parse(JSON.stringify(historical))
  delete raw.skillObservations
  const restored = parseRecord(JSON.stringify(raw))
  expect(restored.completed).toEqual([lesson.id])
  expect(restored.skillObservations).toEqual({})
  const updated = recordLinkedObservation(
    restored,
    lesson.lab!,
    acquired('station-seven'),
    lesson.observation,
    'b',
  )
  expect(updated.firstAttempts).toEqual(historical.firstAttempts)
  expect(updated.skillObservations[linkedTaskKey('station-seven', 'guided')]).toMatchObject({
    source: { taskVersion: 2, frameId: 'test-frame', settings: { depthMm: 40 } },
    correct: true,
  })
  expect(parseRecord(JSON.stringify(updated))).toEqual(updated)
  expect(
    recordLinkedObservation(
      restored,
      lesson.transferLab!,
      acquired('station-seven'),
      lesson.transfer,
      'b',
    ),
  ).toEqual(restored)
  expect(
    isLinkedFrameSource({
      ...acquired('station-seven').linked!.source,
      pose: { originLps: [NaN, 0, 0] },
    }),
  ).toBe(false)
})
it('uses explicit image policies for the five lessons and fresh transfer tasks for the station checks', () => {
  for (const lesson of LESSONS.filter((l) => l.lab?.linkedLesson)) {
    for (const q of [lesson.question, lesson.observation, lesson.transfer])
      expect(q.imagePolicy).toBeDefined()
    expect(lesson.question.imagePolicy).toBe('none')
  }
  expect(LESSONS.find((l) => l.id === 'ct-map')!.observation.imagePolicy).toBe('none')
  for (const id of ['station-seven', 'right-paratracheal']) {
    const lesson = LESSONS.find((l) => l.id === id)!
    expect(lesson.transferLab?.linkedVariant).toBe('changed-window')
    expect(lesson.transfer.id).toContain('-v2')
  }
})
