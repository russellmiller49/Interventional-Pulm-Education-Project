import {
  MODEL_GEOMETRY,
  MODEL_STEPS,
  NEEDLE_LAB,
  initialModelState,
  modelComplete,
  modelFrameId,
  modelReducer,
  needleGeometry,
  needlePath,
  needleStopValid,
  needleStopWindow,
  needleTipPlace,
  type ModelAction,
  type NeedleState,
} from '@/lib/ebus-model-contract'
import { isEbusConfig } from '@/lib/ebus-guided-bridge'
import {
  needleLengthSeen,
  needlePictureStatus,
  needlePictureSvg,
  needlePictureUri,
} from '@/lib/ebus-needle-picture'
import { CONTENT_LESSONS, LESSONS } from '../content/curriculum'
import { EBUS_NUMBERS } from '../content/teachingNumbers'
import { activitiesForLesson } from '../content/stage'

/*
 * The needle lab, rebuilt 2026-11-11: the learner makes one pass with the handle's own controls.
 * These tests hold the rules of the model; the picture and the 3D view only draw its state.
 */
const start = (options?: { needleMovements?: number }) =>
  initialModelState('needle', options) as NeedleState
const apply = (state: NeedleState, ...actions: ModelAction[]) =>
  actions.reduce((current, action) => modelReducer(current, action) as NeedleState, state)
const prepared = (stop = 19) =>
  apply(start(), { type: 'sheath', value: 1 }, { type: 'secure' }, { type: 'stop', value: stop })

describe('the geometry the picture and the model share', () => {
  it('puts the node on the needle path, past the airway wall, with a vessel beyond its far side', () => {
    const path = needlePath({ sheath: 1 })
    expect(path.wall).toBeGreaterThan(0)
    expect(path.nodeNear).toBeGreaterThan(path.wall)
    expect(path.nodeFar).toBeGreaterThan(path.nodeNear + 6)
    expect(path.vessel).toBeGreaterThan(path.nodeFar)
    // The far side of the node and the vessel are both within the needle's travel, so a stop set
    // too long has something to show for it.
    expect(path.nodeFar).toBeLessThan(MODEL_GEOMETRY.needle.maxTravel)
    expect(path.vessel).toBeLessThanOrEqual(MODEL_GEOMETRY.needle.maxTravel)
  })

  it('reads the depth from the end of the sheath, so it shortens as the sheath comes out', () => {
    expect(needlePath({ sheath: 2 }).nodeFar).toBeCloseTo(needlePath({ sheath: 1 }).nodeFar - 1, 6)
    expect(needleStopWindow({ sheath: 2 }).max).toBe(needleStopWindow({ sheath: 1 }).max - 1)
  })

  it('accepts a stop at the far side of the node and nothing beyond it', () => {
    const window = needleStopWindow({ sheath: 1 })
    expect(window.max - window.min).toBeGreaterThanOrEqual(1)
    for (let stop = 0; stop <= MODEL_GEOMETRY.needle.maxTravel; stop += 1) {
      const valid = needleStopValid({ sheath: 1, stop })
      expect(valid).toBe(stop >= window.min && stop <= window.max)
      if (valid) expect(needleTipPlace({ sheath: 1, extension: stop })).toBe('node')
      if (stop > window.max)
        expect(['beyond-node', 'vessel']).toContain(needleTipPlace({ sheath: 1, extension: stop }))
    }
  })

  it('draws the node and the vessel inside the ultrasound sector', () => {
    const { fan, node, vessel } = NEEDLE_LAB
    const inFan = (x: number, y: number) => {
      const radius = Math.hypot(x - fan.cx, y - fan.cy)
      const angle = (Math.atan2(x - fan.cx, y - fan.cy) * 180) / Math.PI
      return radius >= fan.near && radius <= fan.far && Math.abs(angle) <= fan.halfAngle
    }
    for (const [x, y] of [
      [node.cx - node.rx, node.cy],
      [node.cx + node.rx, node.cy],
      [node.cx, node.cy - node.ry],
      [node.cx, node.cy + node.ry],
      [vessel.cx - vessel.r, vessel.cy],
      [vessel.cx + vessel.r, vessel.cy],
      [vessel.cx, vessel.cy + vessel.r],
    ])
      expect(inFan(x, y)).toBe(true)
  })
})

describe('the order of a pass', () => {
  it('starts with nothing done and every control at rest', () => {
    const state = start()
    expect(state).toMatchObject({ sheath: 0, secured: false, stop: 0, extension: 0, plane: 0 })
    expect(state.steps).toEqual([])
    expect(MODEL_STEPS.needle).toEqual([
      'sheath',
      'stop',
      'in-node',
      'tip-recovered',
      'agitate',
      'protected-removal',
    ])
  })

  it('credits the sheath only when it is out and locked', () => {
    expect(apply(start(), { type: 'secure' }).steps).not.toContain('sheath')
    expect(apply(start(), { type: 'secure' }).notice).toContain('locked inside the channel')
    expect(apply(start(), { type: 'sheath', value: 1 }).steps).not.toContain('sheath')
    const locked = apply(start(), { type: 'sheath', value: 1 }, { type: 'secure' })
    expect(locked.steps).toContain('sheath')
    // A locked sheath does not move, and releasing the lock takes the step back.
    expect(apply(locked, { type: 'sheath', value: 2 })).toMatchObject({ sheath: 1 })
    expect(apply(locked, { type: 'secure' }).steps).not.toContain('sheath')
  })

  it('takes the stop back when it is moved off the far side of the node', () => {
    const good = prepared(19)
    expect(good.steps).toContain('stop')
    expect(apply(good, { type: 'stop', value: 12 }).steps).not.toContain('stop')
    expect(apply(good, { type: 'stop', value: 12 }).notice).toContain('short of the far side')
    expect(apply(good, { type: 'stop', value: 22 }).steps).not.toContain('stop')
  })

  it('stops the needle at the stop', () => {
    const state = apply(prepared(19), { type: 'needle', value: 22 })
    expect(state.extension).toBe(19)
    expect(state.notice).toBe('The needle is at the stop.')
    expect(state.steps).toContain('in-node')
    // The sheath, the lock and the stop are fixed while the needle is out.
    expect(apply(state, { type: 'stop', value: 22 })).toMatchObject({ stop: 19 })
    expect(apply(state, { type: 'secure' })).toMatchObject({ secured: true })
    expect(apply(state, { type: 'sheath', value: 2 })).toMatchObject({ sheath: 1 })
  })

  it('does not credit a needle that stops short because the stop is short', () => {
    const state = apply(prepared(12), { type: 'needle', value: 22 })
    expect(state.extension).toBe(12)
    expect(state.steps).not.toContain('in-node')
    expect(state.notice).toContain('short of the far side')
  })

  it('reaches the vessel only through a stop set too long, and says so', () => {
    const state = apply(prepared(22), { type: 'needle', value: 22 })
    expect(needleTipPlace(state)).toBe('vessel')
    expect(state.notice).toContain('The tip is at the vessel beyond the node')
    expect(state.steps).not.toContain('in-node')
    expect(state.steps).not.toContain('stop')
  })

  it('will not advance a needle into a plane that would not show its tip', () => {
    const turned = apply(prepared(19), { type: 'rotate', value: 8 })
    const state = apply(turned, { type: 'needle', value: 19 })
    expect(state.extension).toBe(0)
    expect(state.notice).toContain('Turn the scope back before advancing')
  })
})

describe('movements within the node', () => {
  const inNode = () => apply(prepared(19), { type: 'needle', value: 19 })
  const movement = (state: NeedleState) =>
    apply(state, { type: 'needle', value: 14 }, { type: 'needle', value: 19 })

  it('counts a movement from the stop, back toward the near side, and to the stop again', () => {
    let state = inNode()
    expect(state.movements).toBe(0)
    state = movement(state)
    expect(state.movements).toBe(1)
    // A short jiggle at the stop is not a movement.
    state = apply(state, { type: 'needle', value: 17 }, { type: 'needle', value: 19 })
    expect(state.movements).toBe(1)
  })

  it('does not count a movement that takes the tip out of the node', () => {
    const state = apply(inNode(), { type: 'needle', value: 6 }, { type: 'needle', value: 19 })
    expect(state.movements).toBe(0)
  })

  it('does not count a movement made while the tip is out of the image', () => {
    const state = apply(
      inNode(),
      { type: 'rotate', value: 6 },
      { type: 'needle', value: 14 },
      { type: 'rotate', value: 0 },
      { type: 'needle', value: 19 },
    )
    expect(state.movements).toBe(0)
  })

  it('asks for the number the lesson passes, and keeps it through a reset', () => {
    let state = apply(
      start({ needleMovements: 3 }),
      { type: 'sheath', value: 1 },
      { type: 'secure' },
      { type: 'stop', value: 19 },
      { type: 'needle', value: 19 },
    )
    for (let done = 0; done < 2; done += 1) state = movement(state)
    expect(state.steps).not.toContain('agitate')
    state = movement(state)
    expect(state.steps).toContain('agitate')
    expect((modelReducer(state, { type: 'reset' }) as NeedleState).movementsNeeded).toBe(3)
  })

  it('takes its number of movements from the sourced register, at the low end of the range', () => {
    const lab = CONTENT_LESSONS.find((lesson) => lesson.id === 'needle-assembly-model')!.lab!
    expect(lab.needleMovements).toBe(Number.parseInt(EBUS_NUMBERS.value('agitations-per-pass'), 10))
    expect(lab.needleMovements).toBeGreaterThanOrEqual(1)
    expect(start().movementsNeeded).toBe(lab.needleMovements)
  })
})

describe('finishing the pass', () => {
  const pass = () => {
    let state = apply(
      prepared(19),
      { type: 'needle', value: 19 },
      { type: 'rotate', value: 6 },
      { type: 'rotate', value: 0 },
    )
    for (let done = 0; done < state.movementsNeeded; done += 1)
      state = apply(state, { type: 'needle', value: 14 }, { type: 'needle', value: 19 })
    return state
  }

  it('is complete only with the needle in its sheath and the assembly out', () => {
    const worked = pass()
    expect(worked.steps).toEqual(MODEL_STEPS.needle.slice(0, 5))
    expect(modelComplete(worked)).toBe(false)
    expect(apply(worked, { type: 'remove' })).toMatchObject({ removed: false })
    const out = apply(worked, { type: 'needle', value: 0 }, { type: 'remove' })
    expect(out.steps).toEqual([...MODEL_STEPS.needle])
    expect(modelComplete(out)).toBe(true)
    // Nothing moves once the assembly is out.
    expect(apply(out, { type: 'needle', value: 5 })).toMatchObject({ extension: 0, removed: true })
  })

  it('identifies a frame by the pose, not by the history of the pass', () => {
    const first = apply(prepared(19), { type: 'needle', value: 19 })
    const again = apply(first, { type: 'needle', value: 14 }, { type: 'needle', value: 19 })
    expect(again.movements).toBe(1)
    expect(modelFrameId(again)).toBe(modelFrameId(first))
    expect(modelFrameId(apply(first, { type: 'rotate', value: 6 }))).not.toBe(modelFrameId(first))
  })

  it('shows the whole needle only while the tip is in the plane', () => {
    const state = apply(prepared(19), { type: 'needle', value: 19 })
    expect(needleGeometry(state).tipVisible).toBe(true)
    for (const degrees of [-8, -5, 5, 8])
      expect(needleGeometry(apply(state, { type: 'rotate', value: degrees })).tipLost).toBe(true)
    for (const degrees of [-2, -1, 1, 2])
      expect(needleGeometry(apply(state, { type: 'rotate', value: degrees })).tipVisible).toBe(true)
  })
})

describe('the lesson around the lab', () => {
  it('passes the number of movements through the lab configuration', () => {
    const config = {
      sessionId: 'needle',
      kind: 'model',
      modelPackage: 'needle',
      presetKey: 'needle',
      controls: [],
      locked: false,
      reveal: false,
      view: 'sector',
      initialRoll: 0,
      initialDepth: 40,
      initialGain: 0,
    }
    expect(isEbusConfig({ ...config, needleMovements: 5 })).toBe(true)
    expect(isEbusConfig({ ...config, needleMovements: 0 })).toBe(false)
    expect(isEbusConfig({ ...config, needleMovements: 2.5 })).toBe(false)
  })

  it('keeps the three steps of the unit, named for what the learner does', () => {
    const steps = activitiesForLesson(
      LESSONS.find((lesson) => lesson.id === 'needle-safety')!,
    ).filter((activity) => activity.lessonId === 'needle-assembly-model')
    expect(steps.map((activity) => activity.id)).toEqual([
      'needle-assembly-model:needle-components',
      'needle-assembly-model:needle-states',
      'needle-assembly-model:review-acquisition',
    ])
    expect(steps[1].title).toBe('Make one needle pass')
  })

  it('uses no builder words in what the learner reads', () => {
    const unit = CONTENT_LESSONS.find((lesson) => lesson.id === 'needle-assembly-model')!
    const copy = [
      unit.title,
      unit.objective,
      unit.recall,
      unit.concept,
      ...unit.paragraphs,
      ...unit.checklist,
      unit.worked.context,
      unit.worked.reasoning,
      unit.lab!.instruction,
      unit.boundary,
      ...unit.takeaways,
    ].join(' ')
    expect(copy).not.toMatch(/demonstration window|conceptual|schematic|supported|illustrat/i)
  })
})

describe('the ultrasound picture', () => {
  const atStop = () => apply(prepared(19), { type: 'needle', value: 19 })

  it('draws the whole needle and its tip only while the tip is in the plane', () => {
    const seen = atStop()
    expect(needleLengthSeen(seen)).toBe(19)
    expect(needlePictureStatus(seen)).toBe('Needle tip in the image.')
    const lost = apply(seen, { type: 'rotate', value: 6 })
    expect(needleLengthSeen(lost)).toBeLessThan(19)
    expect(needleLengthSeen(lost)).toBeGreaterThan(5)
    expect(needlePictureStatus(lost)).toBe('Needle tip not in the image. The line is shaft.')
    // The tip echo is a filled circle of this radius; a lost tip has none.
    expect(needlePictureSvg(seen)).toContain('r="0.55"')
    expect(needlePictureSvg(lost)).not.toContain('r="0.55"')
  })

  it('marks where the tip really is only when the picture is revealed', () => {
    const lost = apply(atStop(), { type: 'rotate', value: 6 })
    expect(needlePictureSvg(lost)).not.toContain('out of the image')
    expect(needlePictureSvg(lost, { reveal: true })).toContain('tip, out of the image')
    expect(needlePictureSvg(atStop(), { reveal: true })).not.toContain('out of the image')
  })

  it('shows the stop on the needle path, and leaves the scale off when asked', () => {
    expect(needlePictureSvg(prepared(19))).toContain('stop 19')
    expect(needlePictureSvg(start())).not.toMatch(/>stop \d/)
    expect(needlePictureSvg(prepared(19), { scale: false })).not.toContain('stop 19')
  })

  it('draws no needle once the assembly is out, and is a self-contained image', () => {
    const svg = needlePictureSvg({ ...atStop(), extension: 0, removed: true })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).not.toContain('stroke-linecap="round"')
    expect(needlePictureUri(start()).startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
  })
})
