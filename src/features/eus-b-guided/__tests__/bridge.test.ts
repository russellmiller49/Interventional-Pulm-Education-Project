import {
  EMPTY_EUSB_OBSERVATION,
  eusbFrameId,
  isEusbConfig,
  isEusbMessage,
  isEusbObservation,
  sameEusbContract,
  type EusbWorkbenchConfig,
} from '@/lib/eus-b-guided-bridge'
import {
  EUSB_CONTRACT_REVISION,
  EUSB_CONTROLS,
  EUSB_LABS,
  EUSB_LAB_IDS,
  eusbLab,
  isEusbLabId,
} from '@/lib/eus-b-guided-contract'
import { held, marking, searching, shown } from '../testing/observations'

const config: EusbWorkbenchConfig = {
  sessionId: 'liver-0-1-abc',
  labId: 'liver-reach',
  phase: 'work',
  names: 'hidden',
  panes: ['ultrasound'],
  observationRequest: 16,
}

describe('the lab list', () => {
  it.each(EUSB_LAB_IDS)('%s is well formed', (id) => {
    const lab = eusbLab(id)
    expect(isEusbLabId(id)).toBe(true)
    expect(lab.controls.every((control) => EUSB_CONTROLS.includes(control))).toBe(true)
    if (lab.kind === 'reach' || lab.kind === 'rotate') expect(lab.target).toBeTruthy()
    if (lab.kind === 'rotate') expect(lab.controls).toEqual(['rotate'])
    // A task the learner drives offers something to drive; a still offers nothing.
    if (lab.kind === 'reach') expect(lab.controls.length).toBeGreaterThan(0)
    if (lab.kind === 'explore' && id.endsWith('-view')) expect(lab.controls).toEqual([])
  })

  it('does not take an inherited property for a lab', () => {
    expect(isEusbLabId('toString')).toBe(false)
    expect(isEusbLabId('constructor')).toBe(false)
    expect(isEusbLabId(undefined)).toBe(false)
    expect(Object.keys(EUSB_LABS)).toEqual(EUSB_LAB_IDS)
  })
})

describe('messages between the lesson and the lab', () => {
  it('accepts a well-formed configuration and refuses a malformed one', () => {
    expect(isEusbConfig(config)).toBe(true)
    expect(isEusbConfig({ ...config, held: [held('liver-reach').target!.foundAt] })).toBe(true)
    expect(isEusbConfig({ ...config, labId: 'no-such-lab' })).toBe(false)
    expect(isEusbConfig({ ...config, phase: 'play' })).toBe(false)
    expect(isEusbConfig({ ...config, names: 'maybe' })).toBe(false)
    expect(isEusbConfig({ ...config, panes: ['ct', 'ultrasound'] })).toBe(false)
    // A scope task also draws the white light view; the ultrasound image stays first.
    expect(isEusbConfig({ ...config, panes: ['ultrasound', 'endoscope'] })).toBe(true)
    expect(isEusbConfig({ ...config, panes: ['endoscope', 'ultrasound'] })).toBe(false)
    // The view a learner was shown can be handed back as the picture to review.
    expect(isEusbConfig({ ...config, held: [shown('liver-reach').target!.shownAt] })).toBe(true)
    expect(isEusbConfig({ ...config, panes: [] })).toBe(false)
    expect(isEusbConfig({ ...config, sessionId: '' })).toBe(false)
    expect(isEusbConfig({ ...config, observationRequest: -1 })).toBe(false)
    expect(isEusbConfig({ ...config, observationRequest: 1.5 })).toBe(false)
    expect(
      isEusbConfig({ ...config, held: new Array(7).fill(held('liver-reach').target!.foundAt) }),
    ).toBe(false)
  })

  it('accepts the observations the lab sends', () => {
    expect(isEusbObservation(EMPTY_EUSB_OBSERVATION)).toBe(true)
    expect(isEusbObservation(searching('liver-reach'))).toBe(true)
    expect(isEusbObservation(held('liver-reach'))).toBe(true)
  })

  it('refuses an observation with a value out of range or of the wrong kind', () => {
    const good = held('liver-reach')
    const seen = shown('liver-reach')
    expect(isEusbObservation(seen)).toBe(true)
    const marked = marking('station-4l-landmarks', ['aorta'], ['pulmonary_artery'], 3)
    expect(isEusbObservation(marked)).toBe(true)
    const bad: unknown[] = [
      { ...good, pose: { ...good.pose, sMm: Number.NaN } },
      { ...good, pose: { ...good.pose, rollDeg: 181 } },
      { ...good, pose: { ...good.pose, flexDeg: -46 } },
      { ...good, depthMm: 500 },
      { ...good, gainDb: 40 },
      { ...good, usedControls: ['needle'] },
      { ...good, lastAction: 'needle' },
      { ...good, region: 'duodenum' },
      { ...good, frameReady: true, frameId: '' },
      { ...good, inView: new Array(13).fill({ key: 'liver', fraction: 0.1 }) },
      { ...good, inView: [{ key: 'Liver!', fraction: 0.1 }] },
      { ...good, inView: [{ key: 'liver', fraction: 1.2 }] },
      { ...good, target: { ...good.target!, foundAt: undefined } },
      { ...good, target: { ...good.target!, areaRatio: -1 } },
      { ...good, panes: ['bronchoscope'] },
      // A landmark is clicked or shown, never both, and both lists are always there.
      { ...marked, identified: { keys: ['aorta'], shown: ['aorta'], wrong: 0 } },
      { ...marked, identified: { keys: ['aorta'], wrong: 0 } },
      { ...marked, identified: { keys: ['Aorta!'], shown: [], wrong: 0 } },
      { ...marked, identified: { keys: [], shown: [], wrong: -1 } },
      // A found view is never also a shown one, and a shown view has the lab's own image.
      { ...good, target: { ...good.target!, shown: true, shownAt: seen.target!.shownAt } },
      { ...seen, target: { ...seen.target!, shownAt: undefined } },
      { ...seen, target: { ...seen.target!, shownAt: good.target!.foundAt } },
      { ...seen, target: { ...seen.target!, shown: 'yes' } },
      null,
      'observation',
    ]
    for (const value of bad) expect(isEusbObservation(value)).toBe(false)
  })

  it('accepts only version 1 messages of a known kind', () => {
    const observation = held('liver-reach')
    expect(
      isEusbMessage({ version: 1, type: 'ready', contractRevision: EUSB_CONTRACT_REVISION }),
    ).toBe(true)
    expect(isEusbMessage({ version: 1, type: 'ready' })).toBe(false)
    expect(isEusbMessage({ version: 1, type: 'configure', config })).toBe(true)
    expect(isEusbMessage({ version: 2, type: 'configure', config })).toBe(false)
    expect(
      isEusbMessage({
        version: 1,
        type: 'observation',
        sessionId: 's',
        observationRequest: 3,
        observation,
      }),
    ).toBe(true)
    expect(isEusbMessage({ version: 1, type: 'observation', sessionId: 's', observation })).toBe(
      false,
    )
    expect(isEusbMessage({ version: 1, type: 'resize', sessionId: 's', height: 640 })).toBe(true)
    expect(isEusbMessage({ version: 1, type: 'resize', sessionId: 's', height: 20 })).toBe(false)
    expect(
      isEusbMessage({ version: 1, type: 'error', sessionId: 's', message: 'x'.repeat(501) }),
    ).toBe(false)
    expect(isEusbMessage({ version: 1, type: 'reset', sessionId: 's' })).toBe(false)
  })

  it('names a drawn image by what decides it, and knows its own revision', () => {
    const pose = { sMm: 259.04, rollDeg: 45, flexDeg: 0 }
    expect(eusbFrameId('case', 'v3', pose, 50, 0)).toBe('case:v3:259:45:0:50:0')
    expect(eusbFrameId('case', 'v3', { ...pose, rollDeg: 46 }, 50, 0)).not.toBe(
      eusbFrameId('case', 'v3', pose, 50, 0),
    )
    expect(sameEusbContract(EUSB_CONTRACT_REVISION)).toBe(true)
    expect(sameEusbContract(EUSB_CONTRACT_REVISION + 1)).toBe(false)
  })
})
