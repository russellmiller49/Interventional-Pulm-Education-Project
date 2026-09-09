/**
 * @jest-environment node
 */
import {
  CHAIN_STOPS,
  chainCaption,
  chainStopIds,
  validateImagingChain,
} from '../content/imagingChain'
import { imagingLearnerCopyErrors } from '../content/learnerCopy'

describe('the imaging chain', () => {
  it('has six stops in order and validates clean at import', () => {
    expect(chainStopIds).toHaveLength(6)
    expect(CHAIN_STOPS.map((stop) => stop.id)).toEqual([...chainStopIds])
    expect(validateImagingChain()).toEqual([])
  })

  it('prints the stop number only in the caption', () => {
    expect(chainCaption('detector')).toBe('You are at: the detector. Stop 4 of 6.')
    expect(chainCaption(null)).toMatch(/not pointing anywhere/)
    for (const stop of CHAIN_STOPS) expect(stop.title).not.toMatch(/\d/)
  })
})

describe('the learner copy gate', () => {
  it('refuses the shared banned vocabulary and empty copy', () => {
    expect(imagingLearnerCopyErrors('x', 'Trace the airway route to the lesion')).toHaveLength(1)
    expect(imagingLearnerCopyErrors('x', '   ')).toHaveLength(1)
    expect(imagingLearnerCopyErrors('x', 'Trace the airway path to the lesion')).toEqual([])
  })

  it('refuses digits only where the caller says so', () => {
    expect(imagingLearnerCopyErrors('x', 'Rotate to 30 degrees')).toEqual([])
    expect(imagingLearnerCopyErrors('x', 'Stop 4', { allowDigits: false })).toHaveLength(1)
  })
})
