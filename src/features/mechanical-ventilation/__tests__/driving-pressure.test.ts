import { drivingPressureReadout } from '../content/drivingPressure'
import type { PlateauAcquisition } from '../content/plateauAcquisition'

/**
 * The lung-protection section tells the learner to read a driving pressure, plateau minus total
 * PEEP, and used to leave the subtraction to them. The read-out works it only from a plateau that
 * was acquired on a quiet patient under the settings in force, and otherwise says why not.
 */
const acquisition = (over: Partial<PlateauAcquisition>): PlateauAcquisition => ({
  hold: 'inspiratory',
  status: 'acquired-valid',
  valueCmH2O: 17.04,
  estimateCmH2O: 17.6,
  acquiredValueCmH2O: 17.04,
  supportsMechanicsClaim: true,
  acquired: true,
  acquiredAtSeconds: 12.4,
  label: 'acquired',
  detail: '',
  ...over,
})

describe('the driving-pressure read-out', () => {
  it('works plateau minus total PEEP from an acquired, valid plateau, in figures that add up', () => {
    const readout = drivingPressureReadout(acquisition({}), 5, 0)
    expect(readout.shown).toBe(true)
    expect(readout.valueCmH2O).toBe(12)
    expect(readout.text).toBe(
      'Driving pressure: plateau 17.0 − total PEEP 5.0 = 12.0 cmH₂O. Total PEEP is set PEEP 5.0 plus intrinsic PEEP 0.0 (model estimate).',
    )
  })

  it('counts intrinsic PEEP in total PEEP', () => {
    const readout = drivingPressureReadout(acquisition({ valueCmH2O: 24.5 }), 8, 3.26)
    expect(readout.text).toContain('plateau 24.5 − total PEEP 11.3 = 13.2 cmH₂O')
    expect(readout.text).toContain('set PEEP 8.0 plus intrinsic PEEP 3.3 (model estimate)')
    expect(readout.valueCmH2O).toBe(13.2)
  })

  it.each([
    [
      'reference-estimate',
      /waiting for an inspiratory hold\. The plateau on screen is an estimate/,
    ],
    ['not-acquired', /waiting for an inspiratory hold\.$/],
    ['pending', /the inspiratory hold has not finished/],
    ['acquired-invalid', /not read from this hold\. The patient was pulling through it/],
    ['stale', /have changed since the hold\. Perform it again/],
  ] as const)('gives no number when the plateau is %s, and says why', (status, why) => {
    const readout = drivingPressureReadout(
      // Even with a number on hand: the estimate, or what an invalid or stale hold recorded.
      acquisition({ status, supportsMechanicsClaim: false, valueCmH2O: 17 }),
      5,
      0,
    )
    expect(readout.shown).toBe(false)
    expect(readout.valueCmH2O).toBeNull()
    expect(readout.text).toMatch(why)
    expect(readout.text).not.toMatch(/\d/)
  })

  it('needs the gate as well as the status', () => {
    const readout = drivingPressureReadout(acquisition({ supportsMechanicsClaim: false }), 5, 0)
    expect(readout.shown).toBe(false)
    expect(readout.text).not.toMatch(/\d/)
  })
})
