/** @jest-environment node */
import {
  anchorBounds,
  ASSEMBLY_SECONDS,
  ASSEMBLY_STEPS,
  assemblyGeometry,
  cameraAt,
  cutawaySuggestedAt,
  explodedParams,
  jawsClearOfChannel,
  kitAssemblyAnchors,
  kitJawOpeningDeg,
  paramsAt,
  posesFor,
  STEP_STARTS,
  stepAt,
} from '../engine/deviceExplorer/assembly'
import {
  applyPose,
  applyPoseToDirection,
  cross,
  distance,
  dot,
  length,
  sub,
  type Vec3,
} from '../engine/deviceExplorer/vector'

/**
 * The explorer's assembly is placed by anchors from the committed kit manifest. These tests hold
 * each relationship to the anchors, and the sequence to being a pure, continuous function of time.
 */
const SEAT_MM = 58.761336519744475 // frame 13's fit, from the staging manifest
const anchors = kitAssemblyAnchors()
const geometry = assemblyGeometry(anchors, SEAT_MM, kitJawOpeningDeg())
const END = ASSEMBLY_SECONDS

function distanceFromLine(point: Vec3, origin: Vec3, direction: Vec3): number {
  return length(cross(sub(point, origin), direction)) / length(direction)
}

describe('device explorer assembly', () => {
  it('seats the forceps handle front on the telescope channel entry, facing the same way', () => {
    const poses = posesFor(paramsAt(END, geometry), geometry)
    const handleFront = applyPose(poses.forceps, anchors.forceps.handleFront.position)
    expect(distance(handleFront, anchors.telescope.channelEntry.position)).toBeLessThan(1e-9)
    const facing = applyPoseToDirection(poses.forceps, anchors.forceps.handleFront.direction)
    expect(dot(facing, anchors.telescope.channelEntry.direction)).toBeCloseTo(1, 12)
  })

  it('puts the forceps on the channel axis from entry to exit', () => {
    const poses = posesFor(paramsAt(END, geometry), geometry)
    const entry = anchors.telescope.channelEntry.position
    const axis = sub(anchors.telescope.channelExit.position, entry)
    for (const anchor of [anchors.forceps.sheathEnd, anchors.forceps.toolTip]) {
      expect(distanceFromLine(applyPose(poses.forceps, anchor.position), entry, axis)).toBeLessThan(
        1e-9,
      )
    }
  })

  it('stands the sheath end 330 − 291.5 mm beyond the distal face when fully inserted', () => {
    expect(geometry.sheathBeyondDistalFaceMm).toBeCloseTo(330 - 291.5, 9)
  })

  it('seats the sleeve coaxially at the measured position on the shaft', () => {
    const poses = posesFor(paramsAt(END, geometry), geometry)
    const distalEnd = applyPose(poses.sleeve, anchors.sleeve.distalEnd.position)
    const along = dot(
      sub(distalEnd, anchors.telescope.distalFace.position),
      anchors.telescope.shaftAxis.direction,
    )
    expect(along).toBeCloseTo(SEAT_MM, 9)
    const lumen = applyPose(poses.sleeve, anchors.sleeve.lumenAxis.position)
    expect(
      distanceFromLine(
        lumen,
        anchors.telescope.shaftAxis.position,
        anchors.telescope.shaftAxis.direction,
      ),
    ).toBeLessThan(1e-9)
    const lumenDirection = applyPoseToDirection(poses.sleeve, anchors.sleeve.lumenAxis.direction)
    expect(dot(lumenDirection, anchors.telescope.shaftAxis.direction)).toBeCloseTo(1, 12)
  })

  it('reads each landmark of the forceps travel from the anchors', () => {
    const { forcepsWithdrawal } = geometry
    expect(forcepsWithdrawal.tipAtChannelEntry).toBeCloseTo(291.5 + 11 + 330 - 291.5, 9)
    expect(forcepsWithdrawal.tipAtChannelExit).toBeCloseTo(38.5 + 11, 9)
    expect(forcepsWithdrawal.workingElementAtChannelExit).toBeCloseTo(38.5 - 1, 9)
    expect(forcepsWithdrawal.aligned).toBeGreaterThan(forcepsWithdrawal.tipAtChannelEntry)
  })

  it('advances the jaw tips from the channel entry to the channel exit during that step', () => {
    const advance = ASSEMBLY_STEPS.findIndex((step) => step.id === 'forceps-advances')
    const start = STEP_STARTS[advance]
    const end = start + ASSEMBLY_STEPS[advance].seconds
    const along = (seconds: number) => {
      const poses = posesFor(paramsAt(seconds, geometry), geometry)
      return dot(poses.toolTip, geometry.forcepsInsertion)
    }
    const entry = dot(anchors.telescope.channelEntry.position, geometry.forcepsInsertion)
    const exit = dot(anchors.telescope.channelExit.position, geometry.forcepsInsertion)
    expect(along(start)).toBeLessThan(entry)
    expect(along(end)).toBeCloseTo(exit, 6)
    // Monotonic: the tip only ever moves distally through the channel.
    let previous = -Infinity
    for (let t = start; t <= end; t += 0.05) {
      const now = along(t)
      expect(now).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = now
    }
  })

  it('brings the telescope through the sleeve cap and the sleeve end', () => {
    const { telescopeWithdrawal } = geometry
    const cap = applyPose(geometry.sleevePose, anchors.sleeve.proximalEnd.position)
    expect(telescopeWithdrawal.tipAtSleeveCap).toBeCloseTo(cap[2], 9)
    expect(telescopeWithdrawal.tipAtSleeveEnd).toBeCloseTo(SEAT_MM, 9)
    expect(paramsAt(END, geometry).telescopeWithdrawalMm).toBe(0)
  })

  it('opens the jaws only in the jaw step, and fully to the measured opening', () => {
    const jaws = ASSEMBLY_STEPS.findIndex((step) => step.id === 'jaws')
    let widest = 0
    for (let t = 0; t <= END; t += 0.02) {
      const params = paramsAt(t, geometry)
      if (stepAt(t).index !== jaws) expect(params.jawOpen).toBe(0)
      widest = Math.max(widest, posesFor(params, geometry).jawEachDeg * 2)
      if (params.jawOpen > 0) expect(jawsClearOfChannel(params, geometry)).toBe(true)
    }
    expect(widest).toBeCloseTo(kitJawOpeningDeg(), 6)
  })

  it('is a pure function of time: scrubbing backward shows what playing forward showed', () => {
    const forward = []
    for (let t = 0; t <= END; t += 0.25) forward.push(paramsAt(t, geometry))
    const backward = []
    for (let t = Math.floor(END / 0.25) * 0.25; t >= 0; t -= 0.25)
      backward.unshift(paramsAt(t, geometry))
    expect(backward).toEqual(forward)
  })

  it('never jumps: a small step in time moves every part a small distance', () => {
    const probe = (seconds: number) => {
      const poses = posesFor(paramsAt(seconds, geometry), geometry)
      return [
        applyPose(poses.sleeve, anchors.sleeve.proximalEnd.position),
        applyPose(poses.telescope, anchors.telescope.channelEntry.position),
        poses.toolTip,
      ]
    }
    const dt = 1 / 120
    let previous = probe(0)
    for (let t = dt; t <= END; t += dt) {
      const now = probe(t)
      now.forEach((point, index) => expect(distance(point, previous[index])).toBeLessThan(2.5))
      previous = now
    }
  })

  it('lays the exploded view out coaxially with every part clear of the next', () => {
    const poses = posesFor(explodedParams(geometry), geometry)
    const tip = applyPose(poses.telescope, anchors.telescope.distalFace.position)
    const cap = applyPose(poses.sleeve, anchors.sleeve.proximalEnd.position)
    expect(dot(sub(tip, cap), anchors.telescope.shaftAxis.direction)).toBeGreaterThan(30)
    const entry = applyPose(poses.telescope, anchors.telescope.channelEntry.position)
    expect(dot(sub(poses.toolTip, entry), anchors.telescope.shaftAxis.direction)).toBeGreaterThan(
      20,
    )
    expect(
      distanceFromLine(poses.toolTip, entry, anchors.telescope.channelEntry.direction),
    ).toBeLessThan(1e-9)
  })

  it('suggests the cutaway from the cutaway step until the assembled system', () => {
    const cutaway = STEP_STARTS[ASSEMBLY_STEPS.findIndex((step) => step.id === 'cutaway')]
    const assembled = STEP_STARTS[ASSEMBLY_STEPS.findIndex((step) => step.id === 'assembled')]
    expect(cutawaySuggestedAt(cutaway - 0.01)).toBe(false)
    expect(cutawaySuggestedAt(cutaway + 0.01)).toBe(true)
    expect(cutawaySuggestedAt(assembled - 0.01)).toBe(true)
    expect(cutawaySuggestedAt(assembled + 0.01)).toBe(false)
  })

  it('keeps the sequence camera finite and continuous', () => {
    const bounds = anchorBounds(geometry)
    let previous = cameraAt(0, paramsAt(0, geometry), geometry, bounds)
    for (let t = 0.02; t <= END; t += 0.02) {
      const camera = cameraAt(t, paramsAt(t, geometry), geometry, bounds)
      expect(camera.radius).toBeGreaterThan(0)
      expect(Number.isFinite(camera.target[0] + camera.target[1] + camera.target[2])).toBe(true)
      expect(Math.abs(Math.log(camera.radius / previous.radius))).toBeLessThan(0.2)
      previous = camera
    }
  })
})
