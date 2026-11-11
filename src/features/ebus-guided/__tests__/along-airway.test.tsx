import { isEbusConfig, isEbusObservation } from '@/lib/ebus-guided-bridge'
import {
  LINKED_AIRWAY_VIEW,
  LINKED_ALONG_AIRWAY,
  LINKED_VARIANTS,
  isLinkedFrameSource,
  linkedLateralPosition,
  linkedOpticView,
  linkedSetup,
} from '@/lib/ebus-linked-contract'
import { contentById, lessonById } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { labGoalMet, labGoalRequirements } from '../content/types'
import { acquired } from '../testing/linked-fixture'

/*
 * Advance and withdraw as a scan movement (2026-11-10). The scope-orientation lesson taught
 * rotation alone and said so. It now has a second task: the node is held in plane, the scope
 * starts past it, and the learner slides the plane along the airway until the node sits in the
 * middle of the image. The gate reads the node's position from the rendered frame.
 */
const unit = contentById('scope-orientation')!
const lab = unit.transferLab!
const done = () => acquired('scope-orientation', 'along-airway')
const open = (state: ReturnType<typeof done>) =>
  labGoalRequirements(lab, state)
    .filter((requirement) => !requirement.met)
    .map((requirement) => requirement.id)

it('adds the task after the rotation sweep, on its own lab', () => {
  const steps = activitiesForLesson(lessonById('scope-orientation')!)
  expect(steps.map((step) => step.id.split(':')[1])).toEqual([
    'plane-interpretation',
    'distal-scope',
    'acquire-sweep',
    'slide-plane',
    'review-acquisition',
    'apply-another-situation',
  ])
  const task = steps[3]
  expect(task).toMatchObject({ kind: 'acquisition', task: 'along-airway', interaction: 'acquire' })
  expect(task.instruction).toBe('The rotation is set. Now move the scope along the airway.')
  expect(lab).toMatchObject({
    linkedLesson: 'scope-orientation',
    linkedVariant: 'along-airway',
    goal: 'centre',
    // One movement at a time: rotation is not offered here.
    controls: ['advance'],
    initialRoll: LINKED_ALONG_AIRWAY.roll,
  })
  // The rotation task is unchanged.
  expect(unit.lab).toMatchObject({ goal: 'scan', controls: ['roll'], initialRoll: 85 })
})

it('starts the scope past the node, inside the window that keeps wall contact', () => {
  const setup = linkedSetup('scope-orientation', 'along-airway')
  expect(setup).toMatchObject({
    offsetMm: LINKED_ALONG_AIRWAY.startOffsetMm,
    initialRoll: LINKED_ALONG_AIRWAY.roll,
    presetKey: lab.presetKey,
  })
  expect(setup.offsetMm).toBeGreaterThan(0)
  expect(setup.offsetMm).toBeLessThanOrEqual(LINKED_ALONG_AIRWAY.maxOffsetMm)
  expect(LINKED_ALONG_AIRWAY.minOffsetMm).toBeLessThan(0)
  expect(LINKED_VARIANTS).toContain('along-airway')
})

it('reads the middle of the image as a band, and anything unseen as out', () => {
  const half = LINKED_ALONG_AIRWAY.centreHalfWidth
  expect(linkedLateralPosition(0.5)).toBe('centre')
  expect(linkedLateralPosition(0.5 - half)).toBe('centre')
  expect(linkedLateralPosition(0.5 + half)).toBe('centre')
  expect(linkedLateralPosition(0.5 - half - 0.01)).toBe('left')
  expect(linkedLateralPosition(0.5 + half + 0.01)).toBe('right')
  for (const unseen of [null, undefined, Number.NaN])
    expect(linkedLateralPosition(unseen)).toBe('out')
})

it('opens only when the scope was moved and the node finishes in the middle with contact', () => {
  expect(open(done())).toEqual([])
  expect(labGoalMet(lab, done())).toBe(true)
  // It asks for no landmark click and no rotation sweep.
  const ids = labGoalRequirements(lab, done()).map((requirement) => requirement.id)
  expect(ids).toEqual([
    'ready',
    'frame-ready',
    'used-a-control',
    'linked-frame',
    'centre-moved',
    'centre-position',
  ])
  // The node where the task starts: to one side.
  expect(open({ ...done(), targetLateral: 0.63 })).toEqual(['centre-position'])
  expect(open({ ...done(), targetLateral: 0.38 })).toEqual(['centre-position'])
  // Out of the image, or in the middle without a tissue window.
  expect(open({ ...done(), targetVisible: false, targetLateral: undefined })).toEqual([
    'centre-position',
  ])
  expect(open({ ...done(), contactQuality: 0.2 })).toContain('centre-position')
  // In the middle without having moved the scope does not count.
  expect(open({ ...done(), usedControls: [] })).toEqual(['centre-moved'])
  // What the list says is what the learner does.
  const text = Object.fromEntries(labGoalRequirements(lab, done()).map((r) => [r.id, r.text]))
  expect(text['centre-moved']).toBe('Advance or withdraw the scope with the Scope position slider.')
  expect(text['centre-position']).toBe(
    'Finish with the node in the middle of the ultrasound image.',
  )
})

it('carries the task and the node position across the bridge', () => {
  const observation = done()
  expect(isEbusObservation(observation)).toBe(true)
  expect(isLinkedFrameSource(observation.linked!.source)).toBe(true)
  expect(observation.linked!.source!.taskId).toBe('scope-orientation:along-airway')
  for (const bad of [-0.1, 1.2, Number.NaN, '0.5'])
    expect(isEbusObservation({ ...observation, targetLateral: bad })).toBe(false)
  expect(
    isEbusConfig({
      sessionId: 's',
      kind: 'simulator',
      presetKey: lab.presetKey,
      controls: lab.controls,
      locked: false,
      reveal: false,
      view: 'sector',
      linkedLesson: 'scope-orientation',
      linkedVariant: 'along-airway',
      linkedTaskVersion: 2,
      initialRoll: 0,
      initialDepth: 40,
      initialGain: 0,
    }),
  ).toBe(true)
})

it('teaches both movements before either task, and no longer says rotation alone', () => {
  const text = unit.paragraphs.join(' ')
  expect(text).not.toContain('rotation alone')
  expect(text).toContain('toward the green dot as you advance, away from it as you withdraw')
  expect(unit.objective).toContain('advancing and withdrawing')
  expect(unit.takeaways).toContain(
    'Rotation takes a structure out of the plane; advancing or withdrawing slides it across the image.',
  )
  // The task's own instruction does not say which way to go.
  expect(lab.instruction).not.toMatch(/short of|past the node|too far/)
  expect(lab.instruction).toContain('advance or withdraw')
})

/*
 * The scope lesson's task on the forward-oblique lens (2026-11-10). The console was an ungated
 * example only. It is now also asked for once: flex down until the lens looks along the airway,
 * then up until the lens is on the wall and tissue echoes return.
 */
describe('look along the airway, then bring back the image', () => {
  const scope = contentById('ebus-scope')!
  const task = scope.transferLab!
  const finished = () => acquired('scope-orientation', 'airway-view')
  const unmet = (state: ReturnType<typeof finished>) =>
    labGoalRequirements(task, state)
      .filter((requirement) => !requirement.met)
      .map((requirement) => requirement.id)

  it('classes the white-light view from the lens-to-wall distance and contact', () => {
    const { lumenMinMm, wallMaxMm, minContact } = LINKED_AIRWAY_VIEW
    expect(linkedOpticView(lumenMinMm, 0)).toBe('lumen')
    expect(linkedOpticView(21, 1)).toBe('lumen')
    expect(linkedOpticView(wallMaxMm, minContact)).toBe('wall')
    // Near the wall without tissue contact, or with contact but the lens still off the wall.
    expect(linkedOpticView(4, 0.5)).toBe('between')
    expect(linkedOpticView(9, 1)).toBe('between')
    for (const none of [null, undefined, Number.NaN])
      expect(linkedOpticView(none, 1)).toBe('between')
    expect(linkedSetup('scope-orientation', 'airway-view')).toMatchObject({
      offsetMm: 0,
      initialRoll: task.initialRoll,
      presetKey: task.presetKey,
    })
  })

  it('opens only after both views: the airway first, then the wall with an image', () => {
    expect(unmet(finished())).toEqual([])
    expect(labGoalMet(task, finished())).toBe(true)
    expect(labGoalRequirements(task, finished()).map((requirement) => requirement.id)).toEqual([
      'ready',
      'frame-ready',
      'used-a-control',
      'linked-frame',
      'airway-seen',
      'airway-wall',
    ])
    // On the wall without ever having looked along the airway.
    const linked = finished().linked!
    expect(unmet({ ...finished(), linked: { ...linked, airwayViewed: undefined } })).toEqual([
      'airway-seen',
    ])
    // Looked along the airway and still there: no image yet.
    expect(unmet({ ...finished(), opticalWallMm: 20, contactQuality: 0.04 })).toContain(
      'airway-wall',
    )
    // Flexed down so far that the model reports contact again: the lens is not on the wall.
    expect(unmet({ ...finished(), opticalWallMm: 21, contactQuality: 1 })).toEqual(['airway-wall'])
  })

  it('carries the evidence across the bridge', () => {
    expect(isEbusObservation(finished())).toBe(true)
    expect(finished().linked!.source!.taskId).toBe('scope-orientation:airway-view')
    expect(isEbusObservation({ ...finished(), opticalWallMm: -1 })).toBe(false)
    expect(isEbusObservation({ ...finished(), opticalWallMm: 900 })).toBe(false)
    expect(
      isEbusObservation({ ...finished(), linked: { ...finished().linked!, airwayViewed: 'yes' } }),
    ).toBe(false)
  })

  it('says what to do in the order it is done, with flexion alone', () => {
    expect(task.controls).toEqual(['flexion'])
    expect(task.instruction.indexOf('flex down')).toBeGreaterThan(-1)
    expect(task.instruction.indexOf('flex down')).toBeLessThan(task.instruction.indexOf('flex up'))
    const steps = activitiesForLesson(lessonById('ebus-scope')!)
    expect(steps.map((step) => step.id.split(':')[1])).toEqual([
      'first-decision',
      'scope-tip',
      'airway-then-wall',
      'tip-parts',
      'apply-another-situation',
    ])
    expect(steps[2].instruction).toBe('Now find both views yourself, one after the other.')
  })
})
