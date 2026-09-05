import { signalGrammarRow, signalGrammarRows, signalGrammarRowsFor } from '../content/signalGrammar'
import { hemodynamicsSectionIds, hemodynamicsSectionSpec } from '../content/sectionSpecs'
import { calculateDerivedHemodynamics } from '../engine/calculations'
import {
  cleanState,
  faultyLineState,
  reduceAll,
  standardTechnique,
  threeTrialState,
} from '../engine/stageRuntime'

/**
 * The one table, run against the engine.
 *
 * Every row that claims a direction is checked on the simulation rather than asserted: an offset
 * moves every pressure by the same amount and no shape; damping narrows the pulse pressure and
 * resonance widens it around a preserved mean; the ventricle and the artery share a peak and
 * differ in their floor; a false wedge sits above the artery's diastolic; a poor injection makes
 * a curve the series refuses; a calculation with a missing input is withheld.
 */
const pp = (s: ReturnType<typeof cleanState>) =>
  s.measurements.papSystolicMmHg - s.measurements.papDiastolicMmHg

describe('the rows the engine can check', () => {
  it('reference-offset: level and zero move every pressure by one amount and change no shape', () => {
    const clean = cleanState()
    const high = reduceAll(clean, [{ type: 'SET_TRANSDUCER_LEVEL', levelCm: 10 }])
    const systolicShift = high.measurements.papSystolicMmHg - clean.measurements.papSystolicMmHg
    const diastolicShift = high.measurements.papDiastolicMmHg - clean.measurements.papDiastolicMmHg
    const arterialShift = high.measurements.mapMmHg - clean.measurements.mapMmHg
    expect(systolicShift).toBeLessThan(0)
    expect(Math.abs(systolicShift - diastolicShift)).toBeLessThanOrEqual(1)
    expect(Math.abs(systolicShift - arterialShift)).toBeLessThanOrEqual(1)
    expect(Math.abs(pp(high) - pp(clean))).toBeLessThanOrEqual(1)
    expect(signalGrammarRow('reference-offset').shortlist).toEqual(['level', 'zero'])
  })

  it('display-scale: the scale changes nothing underneath it', () => {
    const clean = cleanState()
    const rescaled = reduceAll(clean, [{ type: 'SET_PRESSURE_SCALE', maximum: 40 }])
    expect(rescaled.measurements).toEqual(clean.measurements)
    expect(rescaled.pressureScaleMmHg).toBe(40)
  })

  it('overdamped: narrower pulse pressure around a preserved mean, and a sluggish flush', () => {
    const clean = cleanState()
    const damped = reduceAll(clean, [
      { type: 'SET_DAMPING', dampingRatio: 1.15 },
      { type: 'SET_ARTIFACT', artifact: 'overdamped' },
      { type: 'FAST_FLUSH', lineType: 'pulmonary-artery' },
    ])
    expect(pp(damped)).toBeLessThan(pp(clean))
    expect(
      Math.abs(damped.measurements.meanPapMmHg - clean.measurements.meanPapMmHg),
    ).toBeLessThanOrEqual(1)
    expect(damped.measurementSystem.lastFastFlushFinding).toMatch(/Sluggish/)
  })

  it('underdamped: wider pulse pressure around a preserved mean, and a ringing flush', () => {
    const clean = cleanState()
    const ringing = reduceAll(faultyLineState(), [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
      { type: 'ZERO_TRANSDUCER' },
      { type: 'FAST_FLUSH', lineType: 'pulmonary-artery' },
    ])
    expect(pp(ringing)).toBeGreaterThan(pp(clean))
    expect(
      Math.abs(ringing.measurements.meanPapMmHg - clean.measurements.meanPapMmHg),
    ).toBeLessThanOrEqual(1)
    expect(ringing.measurementSystem.lastFastFlushFinding).toMatch(/oscillations/)
  })

  it('ventricular-shape and arterial-shape: the same peak, a floor that steps up', () => {
    const state = cleanState()
    expect(state.measurements.rvSystolicMmHg).toBe(state.measurements.papSystolicMmHg)
    expect(state.measurements.papDiastolicMmHg).toBeGreaterThan(state.measurements.rvDiastolicMmHg)
    expect(state.measurements.rvDiastolicMmHg).toBeLessThanOrEqual(state.measurements.rapMmHg + 2)
  })

  it('atrial-shape: the atrium is the lowest of the four', () => {
    const state = cleanState()
    expect(state.measurements.rapMmHg).toBeLessThan(state.measurements.papDiastolicMmHg)
    expect(state.measurements.pawpMmHg ?? 0).toBeLessThan(state.measurements.papDiastolicMmHg)
  })

  it('false-wedge: a wedge that sits above the artery diastolic is not reading the atrium', () => {
    const clean = cleanState()
    const falseWedge = reduceAll(clean, [{ type: 'SET_ARTIFACT', artifact: 'false-wedge' }])
    expect(clean.measurements.pawpMmHg).not.toBeNull()
    expect(clean.measurements.pawpMmHg!).toBeLessThan(clean.measurements.papDiastolicMmHg)
    expect(falseWedge.measurements.pawpMmHg!).toBeGreaterThan(
      falseWedge.measurements.papDiastolicMmHg,
    )
  })

  it('spontaneous-wedge: a second inflation on an occluded branch is refused and recorded', () => {
    const occluded = reduceAll(cleanState(), [{ type: 'START_WEDGE' }])
    expect(occluded.catheter.position).toBe('wedge')
    const again = reduceAll(occluded, [{ type: 'START_WEDGE' }])
    expect(again.criticalErrors).toContain('overwedge-balloon-reinflation')
  })

  it('series-disagreement: a poor injection is a curve the series refuses until it is replaced', () => {
    const state = threeTrialState()
    const [good, poor] = state.thermodilutionTrials
    expect(good.quality).toBe('valid')
    expect(poor.quality).not.toBe('valid')
    const replaced = reduceAll(state, [
      { type: 'GENERATE_THERMODILUTION_TRIAL', technique: standardTechnique() },
    ])
    expect(replaced.thermodilutionTrials.at(-1)?.quality).toBe('valid')
  })

  it('derived-contradiction: a calculation with a missing input is withheld, never invented', () => {
    const withheld = calculateDerivedHemodynamics({
      measurements: { mapMmHg: 70, rapMmHg: 8 },
      bodySurfaceAreaM2: 1.9,
    })
    expect(withheld.systemicVascularResistance.status).toBe('not-interpretable')
    expect(withheld.systemicVascularResistance.value).toBeNull()
    const discordant = calculateDerivedHemodynamics({
      measurements: { mapMmHg: 8, rapMmHg: 10, cardiacOutputLMin: 5 },
      bodySurfaceAreaM2: 1.9,
    })
    expect(discordant.systemicVascularResistance.status).toBe('not-interpretable')
    expect(discordant.systemicVascularResistance.reason).toMatch(/reconcile/)
  })
})

describe('the table and the sections', () => {
  it('has every engine-checked row named above', () => {
    const checked = signalGrammarRows.filter((row) => row.engineCheck).map((row) => row.engineCheck)
    expect(new Set(checked)).toEqual(
      new Set([
        'level-offset',
        'scale-only',
        'overdamped',
        'underdamped',
        'ra-morphology',
        'rv-morphology',
        'pa-morphology',
        'spontaneous-wedge',
        'false-wedge',
        'thermodilution-technique',
        'derived-withholding',
      ]),
    )
  })

  it('is highlighted by every section a row names, and never restated', () => {
    for (const sectionId of hemodynamicsSectionIds) {
      const spec = hemodynamicsSectionSpec(sectionId)
      for (const row of signalGrammarRowsFor(sectionId)) {
        expect(spec.grammarRowIds).toContain(row.id)
      }
      // A section's own copy must not paraphrase a row's presentation.
      for (const row of signalGrammarRows) {
        expect(spec.newConcept).not.toBe(row.whatYouSee)
        expect(spec.objective).not.toBe(row.whatYouSee)
      }
    }
  })
})
