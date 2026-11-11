import { cleanup, fireEvent, render } from '@testing-library/react'

import manifest from '../../../../EBUS-course/apps/web/public/simulator/case-001/case_manifest.simplified.web.json'
import { isEbusConfig, isEbusObservation } from '@/lib/ebus-guided-bridge'
import {
  LANDMARK_HINTS,
  LANDMARK_NAMES,
  LINKED_LANDMARKS,
  LINKED_PRESETS,
  linkedLandmarkHint,
  linkedLandmarkName,
  linkedSetup,
} from '@/lib/ebus-linked-contract'
import { LessonHost } from '../components/LessonHost'
import { contentById, lessonById } from '../content/curriculum'
import { activitiesForLesson, labForActivity } from '../content/stage'
import { labGoalMet, labGoalRequirements } from '../content/types'
import { acquired } from '../testing/linked-fixture'

/*
 * Live scans for 4L, 2L and 11Ri (2026-11-10). The left paratracheal lesson had a plain
 * simulator view of 4L and nothing for 2L; the hilar and interlobar lesson had no scan at all.
 * Each station is now a linked lab: named landmarks found on ultrasound, a sweep, and the node in
 * view at the end.
 */
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/StationFigure', () => ({
  StationFigure: () => <figure data-mock-station-figure />,
}))
jest.mock('../components/Workbench', () => ({
  Workbench: ({
    lab,
    sessionId,
    locked,
  }: {
    lab: import('../content/types').Lab
    sessionId: string
    locked: boolean
  }) => (
    <section
      data-mock-workbench
      data-linked={lab.linkedLesson}
      data-preset={lab.presetKey}
      data-session={sessionId}
      data-locked={String(locked)}
    />
  ),
}))
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

const left = contentById('left-paratracheal')!
const hilar = contentById('hilar-interlobar')!
const labs = [
  ['left-paratracheal', left.lab!, 'station_4l'],
  ['left-upper-paratracheal', left.transferLab!, 'station_2l'],
  ['interlobar', hilar.lab!, 'station_11ri'],
] as const
const bench = () => document.querySelector('[data-mock-workbench]') as HTMLElement | null
const activityId = () =>
  document.querySelector('[data-ebus-flow]')!.getAttribute('data-activity-id')
function goTo(id: string) {
  for (let guard = 0; guard < 20 && activityId() !== id; guard++) {
    const skip = document.querySelector('[data-skip-acquisition]') as HTMLButtonElement | null
    fireEvent.click(skip ?? (document.querySelector('[data-now-primary]') as HTMLButtonElement))
  }
  expect(activityId()).toBe(id)
}

describe('the three station labs', () => {
  it.each(labs)('%s scans its own preset and ends on its own node', (lesson, lab, node) => {
    expect(lab).toMatchObject({
      kind: 'simulator',
      linkedLesson: lesson,
      goal: 'scan',
      controls: ['roll'],
      presetKey: LINKED_PRESETS[lesson],
    })
    const preset = manifest.presets.find((entry) => entry.preset_key === lab.presetKey)!
    expect(preset.station_key).toBe(node)
    const landmarks = LINKED_LANDMARKS[lesson]
    expect(landmarks[landmarks.length - 1]).toBe(node)
    expect(linkedSetup(lesson, 'guided')).toEqual({
      offsetMm: 0,
      initialRoll: lab.initialRoll,
      presetKey: lab.presetKey,
    })
    // Every landmark has a name and a hint the learner can read.
    for (const id of landmarks) {
      expect(linkedLandmarkName(lesson, id)).toBeTruthy()
      expect(linkedLandmarkHint(lesson, id)).toBeTruthy()
    }
  })

  it.each(labs)('%s opens on landmarks, a sweep and the node in view', (lesson, lab) => {
    const done = acquired(lesson)
    expect(isEbusObservation(done)).toBe(true)
    expect(labGoalMet(lab, done)).toBe(true)
    expect(labGoalRequirements(lab, done).map((requirement) => requirement.id)).toEqual([
      'ready',
      'frame-ready',
      'used-a-control',
      'linked-frame',
      'linked-landmarks',
      'linked-sweep',
      'scan',
    ])
    const unmet = (state: typeof done) =>
      labGoalRequirements(lab, state)
        .filter((requirement) => !requirement.met)
        .map((requirement) => requirement.id)
    const linked = done.linked!
    // One landmark short, no sweep, or the node out of the image at the end.
    expect(
      unmet({
        ...done,
        linked: { ...linked, identifiedStructures: linked.identifiedStructures!.slice(1) },
      }),
    ).toEqual(['linked-landmarks'])
    expect(unmet({ ...done, linked: { ...linked, sweeps: {} } })).toEqual(['linked-sweep'])
    expect(unmet({ ...done, targetVisible: false })).toEqual(['scan'])
    expect(
      isEbusConfig({
        sessionId: 's',
        kind: 'simulator',
        presetKey: lab.presetKey,
        controls: lab.controls,
        locked: false,
        reveal: false,
        view: 'sector',
        linkedLesson: lesson,
        linkedVariant: 'guided',
        linkedTaskVersion: 2,
        initialRoll: lab.initialRoll,
        initialDepth: 40,
        initialGain: 0,
      }),
    ).toBe(true)
  })

  it('names the vessels beside 2L and 4L as the lesson does, and nowhere else', () => {
    expect(LINKED_LANDMARKS['left-paratracheal']).toEqual([
      'aorta',
      'pulmonary_artery',
      'station_4l',
    ])
    expect(LINKED_LANDMARKS['left-upper-paratracheal']).toEqual(['aorta', 'station_2l'])
    expect(LINKED_LANDMARKS.interlobar).toEqual(['station_11ri'])
    expect(linkedLandmarkName('left-paratracheal', 'aorta')).toBe('aortic arch')
    expect(linkedLandmarkName('left-paratracheal', 'pulmonary_artery')).toBe(
      'left main pulmonary artery',
    )
    expect(linkedLandmarkName('left-upper-paratracheal', 'aorta')).toBe('aortic arch')
    // Station 7's labs keep the names and hints they had.
    expect(linkedLandmarkName('station-seven', 'pulmonary_artery')).toBe(
      LANDMARK_NAMES.pulmonary_artery,
    )
    expect(linkedLandmarkHint('station-seven', 'pulmonary_artery')).toBe(
      LANDMARK_HINTS.pulmonary_artery,
    )
    // The left-sided hints are the lesson's own boundaries.
    const text = left.paragraphs.join(' ')
    expect(text).toContain('The superior border of the aortic arch separates 2L from 4L')
    expect(linkedLandmarkHint('left-upper-paratracheal', 'aorta')).toContain(
      'Its superior border separates 2L from 4L',
    )
    expect(text).toContain('upper rim of the left main pulmonary artery')
    expect(linkedLandmarkHint('left-paratracheal', 'pulmonary_artery')).toContain(
      'Its upper rim is the lower limit of 4L',
    )
    expect(hilar.paragraphs.join(' ')).toContain('between the middle- and lower-lobe bronchi')
    expect(linkedLandmarkHint('interlobar', 'station_11ri')).toContain(
      'between the middle- and lower-lobe bronchi',
    )
  })
})

describe('in the lessons', () => {
  it('scans 4L, reads it, then scans 2L in a lab of its own', () => {
    const lesson = lessonById('left-paratracheal')!
    const steps = activitiesForLesson(lesson)
    expect(steps.map((step) => step.id.split(':')[1])).toEqual([
      'left-boundary',
      'left-region',
      'left-assisted',
      'review-acquisition',
      'left-upper',
      'apply-another-situation',
    ])
    expect(labForActivity(left, steps[2])).toBe(left.lab)
    expect(labForActivity(left, steps[4])).toBe(left.transferLab)
    // Both are ordinary guided tasks; only the lab differs.
    expect(steps[2].task).toBe('guided')
    expect(steps[4]).toMatchObject({ task: 'guided', secondLab: true })

    render(<LessonHost lesson={lesson} />)
    goTo('left-paratracheal:left-assisted')
    const first = { ...bench()!.dataset }
    expect(first).toMatchObject({
      linked: 'left-paratracheal',
      preset: 'station_4l_node_a::default',
      locked: 'false',
    })
    goTo('left-paratracheal:left-upper')
    const second = { ...bench()!.dataset }
    expect(second).toMatchObject({
      linked: 'left-upper-paratracheal',
      preset: 'station_2l_node_a::default',
      locked: 'false',
    })
    // A lab of its own: a new session, so nothing found in the 4L lab counts here.
    expect(second.session).not.toBe(first.session)
  })

  it('names the interlobar stations, then scans one of them', () => {
    const lesson = lessonById('hilar-interlobar')!
    const steps = activitiesForLesson(lesson)
    expect(steps.map((step) => step.id.split(':')[1])).toEqual([
      'first-decision',
      'bronchial-relations',
      'regional-identity',
      'interlobar-scan',
      'review-acquisition',
      'apply-another-situation',
    ])
    expect(labForActivity(hilar, steps[3])).toBe(hilar.lab)
    expect(hilar.transferLab).toBeUndefined()
    render(<LessonHost lesson={lesson} />)
    goTo('hilar-interlobar:interlobar-scan')
    expect(bench()!.dataset).toMatchObject({
      linked: 'interlobar',
      preset: 'station_11ri_node_a::default',
      locked: 'false',
    })
  })
})
