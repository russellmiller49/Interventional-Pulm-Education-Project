import { EMPTY_EUSB_OBSERVATION } from '@/lib/eus-b-guided-bridge'
import { EUSB_LABS, EUSB_LAB_IDS, eusbLab } from '@/lib/eus-b-guided-contract'
import { eusbOutstanding, eusbRequirements, eusbTaskMet, eusbViewShown } from '../content/tasks'
import { held, marking, searching, shown } from '../testing/observations'

const reachLabs = EUSB_LAB_IDS.filter((id) => eusbLab(id).kind === 'reach')

describe('what a scope task asks for', () => {
  it('has at least one find-the-view lab to check', () => {
    expect(reachLabs.length).toBeGreaterThan(0)
  })

  it.each(reachLabs)('%s: the list the learner reads is the gate', (labId) => {
    for (const observation of [
      null,
      EMPTY_EUSB_OBSERVATION,
      searching(labId),
      held(labId),
      shown(labId),
    ]) {
      const list = eusbRequirements(labId, observation)
      expect(list.length).toBeGreaterThan(0)
      expect(eusbTaskMet(labId, observation)).toBe(list.every((item) => item.met))
      expect(eusbOutstanding(labId, observation)).toEqual(
        list.filter((item) => !item.met).map((item) => item.text),
      )
    }
  })

  it.each(reachLabs)('%s: met only once its own target has been held', (labId) => {
    expect(eusbTaskMet(labId, null)).toBe(false)
    expect(eusbTaskMet(labId, EMPTY_EUSB_OBSERVATION)).toBe(false)
    expect(eusbTaskMet(labId, searching(labId))).toBe(false)
    expect(eusbTaskMet(labId, held(labId))).toBe(true)
    // Not ready, another lab's answer, another target, or found with no image to show for it.
    expect(eusbTaskMet(labId, { ...held(labId), ready: false })).toBe(false)
    expect(eusbTaskMet(labId, { ...held(labId), labId: 'some-other-lab' })).toBe(false)
    const other = held(labId)
    expect(eusbTaskMet(labId, { ...other, target: { ...other.target!, key: 'spleen' } })).toBe(
      false,
    )
    expect(eusbTaskMet(labId, { ...other, target: { ...other.target!, foundAt: undefined } })).toBe(
      false,
    )
  })

  it.each(reachLabs)('%s: says what to do without saying which way to move', (labId) => {
    const [item] = eusbRequirements(labId, null)
    expect(item.text).toMatch(
      /^Bring (the [a-z ]+|station \d+[A-Z]?) into the image and hold it for one second\.$/,
    )
    expect(item.text).not.toMatch(/clockwise|advance|withdraw|deeper|rotate|turn|toward/i)
  })

  it.each(reachLabs)(
    '%s: a view the learner was shown is listed as shown, never as found',
    (labId) => {
      expect(eusbLab(labId).help).toContain('show')
      expect(eusbViewShown(labId, searching(labId))).toBe(false)
      expect(eusbViewShown(labId, held(labId))).toBe(false)
      expect(eusbViewShown(labId, shown(labId))).toBe(true)
      // The learner may go on, and the list says why.
      expect(eusbTaskMet(labId, shown(labId))).toBe(true)
      const [item] = eusbRequirements(labId, shown(labId))
      expect(item.met).toBe(true)
      expect(item.text).toMatch(/^You were shown (the [a-z ]+|station \d+[A-Z]?)\.$/)
      expect(item.text).not.toMatch(/hold|found|your image/i)
      // Not ready, another lab's answer, another target, or shown with no image to show for it.
      const seen = shown(labId)
      expect(eusbViewShown(labId, { ...seen, ready: false })).toBe(false)
      expect(eusbViewShown(labId, { ...seen, labId: 'some-other-lab' })).toBe(false)
      expect(eusbViewShown(labId, { ...seen, target: { ...seen.target!, key: 'spleen' } })).toBe(
        false,
      )
      expect(
        eusbViewShown(labId, { ...seen, target: { ...seen.target!, shownAt: undefined } }),
      ).toBe(false)
      expect(eusbTaskMet(labId, { ...seen, target: { ...seen.target!, shownAt: undefined } })).toBe(
        false,
      )
    },
  )

  const identifyLabs = EUSB_LAB_IDS.filter((id) => eusbLab(id).kind === 'identify')

  it.each(identifyLabs)('%s: one line per landmark, and every line is the gate', (labId) => {
    const landmarks = [...eusbLab(labId).landmarks!]
    expect(landmarks.length).toBeGreaterThan(1)
    const none = eusbRequirements(labId, marking(labId))
    expect(none.map((item) => item.id)).toEqual(landmarks.map((key) => 'mark-' + key))
    expect(none.every((item) => !item.met)).toBe(true)
    for (const item of none)
      expect(item.text).toMatch(/^Click (the [a-z ]+|station \d+[A-Z]?) in the image\.$/)
    expect(eusbTaskMet(labId, marking(labId))).toBe(false)
    expect(eusbTaskMet(labId, null)).toBe(false)

    // All but the last: not yet.
    expect(eusbTaskMet(labId, marking(labId, landmarks.slice(0, -1)))).toBe(false)
    // Every landmark clicked, or some of them shown: done, and a shown one says so.
    expect(eusbTaskMet(labId, marking(labId, landmarks))).toBe(true)
    const mixed = marking(labId, landmarks.slice(1), landmarks.slice(0, 1))
    expect(eusbTaskMet(labId, mixed)).toBe(true)
    const [first, ...rest] = eusbRequirements(labId, mixed)
    expect(first.text).toMatch(/^You were shown /)
    expect(rest.every((item) => item.text.startsWith('Click '))).toBe(true)
    // Another lab's answer, or a lab that is not ready, meets nothing.
    expect(eusbTaskMet(labId, { ...marking(labId, landmarks), labId: 'some-other-lab' })).toBe(
      false,
    )
    expect(eusbTaskMet(labId, { ...marking(labId, landmarks), ready: false })).toBe(false)
    for (const observation of [null, marking(labId), mixed, marking(labId, landmarks)]) {
      const list = eusbRequirements(labId, observation)
      expect(eusbTaskMet(labId, observation)).toBe(list.every((item) => item.met))
      expect(eusbOutstanding(labId, observation)).toEqual(
        list.filter((item) => !item.met).map((item) => item.text),
      )
    }
  })

  it('asks nothing of a still image, and a still image is never "done"', () => {
    const stills = EUSB_LAB_IDS.filter((id) => EUSB_LABS[id].kind === 'explore')
    expect(stills.length).toBeGreaterThan(0)
    for (const labId of stills) {
      expect(eusbRequirements(labId, held(labId))).toEqual([])
      expect(eusbTaskMet(labId, held(labId))).toBe(false)
    }
  })
})
