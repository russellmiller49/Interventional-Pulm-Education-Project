import { EMPTY_EBUS_OBSERVATION } from '@/lib/ebus-guided-bridge'
import { isRecordedFrameSource, type RecordedFrameSource } from '@/lib/ebus-recorded-contract'
import { HISTORICAL_IMAGE_QUESTIONS, LESSONS } from '../content/curriculum'
import { labGoalMet } from '../content/types'
import { retainedImageAvailable } from '../engine/evidence'
import { emptyRecord, firstAttempt, parseRecord, recordLinkedObservation } from '../engine/progress'
import { acquired } from '../testing/linked-fixture'

const source: RecordedFrameSource = {
  type: 'recorded-frame',
  version: 1,
  sessionId: 'current',
  taskId: 'depth',
  frameId: 'current:real-pixels',
  segmentId: 'recorded-example',
  mediaTime: 4.025,
  width: 640,
  height: 480,
  settings: { depthMm: 40, gain: 43, contrast: 43, doppler: false },
  calipers: [],
  held: true,
  captured: false,
}
const state = {
  ...EMPTY_EBUS_OBSERVATION,
  acquisitionSession: 'current',
  ready: true,
  frameReady: true,
  actionCount: 1,
  lastAction: 'depth',
  depth: 40,
  gain: 43,
  contrast: 43,
  recorded: source,
}
it('requires current decoded evidence, matching settings and a held frame for recorded interpretation', () => {
  const lesson = LESSONS.find((item) => item.id === 'image-depth')!
  expect(labGoalMet(lesson.lab!, state)).toBe(true)
  expect(retainedImageAvailable(lesson.observation, lesson.lab, state, state)).toBe(true)
  for (const current of [
    { ...state, frameReady: false },
    { ...state, acquisitionSession: 'rebooted' },
    { ...state, recorded: { ...source, held: false } },
    { ...state, recorded: { ...source, frameId: 'different-pixels' } },
    { ...state, recorded: { ...source, sessionId: 'old' } },
  ])
    expect(retainedImageAvailable(lesson.observation, lesson.lab, state, current)).toBe(false)
  expect(labGoalMet(lesson.lab!, { ...state, recorded: undefined })).toBe(false)
  expect(labGoalMet(lesson.lab!, { ...state, depth: 30 })).toBe(false)
  expect(labGoalMet(lesson.lab!, { ...state, recorded: { ...source, taskId: 'gain' } })).toBe(false)
})
it('rejects malformed recording identities, dimensions, timing and calipers at the bridge boundary', () => {
  expect(isRecordedFrameSource(source)).toBe(true)
  for (const patch of [
    { version: 2 },
    { frameId: '' },
    { width: 0 },
    { mediaTime: NaN },
    { calipers: [{ x: -0.1, y: 0.5 }] },
    { held: 'yes' },
  ])
    expect(isRecordedFrameSource({ ...source, ...patch })).toBe(false)
})
it('keeps historic image responses when revised interpretations are recorded', () => {
  const prior = HISTORICAL_IMAGE_QUESTIONS.find((question) => question.id === 'depth-observe')!
  const current = LESSONS.find((lesson) => lesson.id === 'image-depth')!.observation
  let record = firstAttempt(emptyRecord(), 'image-depth:' + prior.id, prior, prior.choices[0].id)
  record = firstAttempt(record, 'image-depth:' + current.id, current, current.choices[1].id)
  expect(Object.keys(parseRecord(JSON.stringify(record)).firstAttempts)).toEqual([
    'image-depth:depth-observe',
    'image-depth:depth-observe-v2',
  ])
})
it('retains the previous skill observation when a new acquisition session is reviewed', () => {
  const lesson = LESSONS.find((item) => item.id === 'station-seven')!,
    first = acquired('station-seven')
  const second = {
    ...first,
    linked: {
      ...first.linked!,
      source: { ...first.linked!.source!, sessionId: 'another-session' },
    },
  }
  let record = recordLinkedObservation(emptyRecord(), lesson.lab!, first, lesson.observation, 'a')
  record = recordLinkedObservation(record, lesson.lab!, second, lesson.observation, 'b')
  expect(record.skillHistory['station-seven:guided:v2']).toHaveLength(1)
  expect(record.skillHistory['station-seven:guided:v2'][0].choiceId).toBe('a')
})
