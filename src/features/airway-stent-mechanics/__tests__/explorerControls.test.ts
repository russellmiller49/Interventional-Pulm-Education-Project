import {
  createDefaultStentExplorerControlState,
  deriveStentMechanicsModifiers,
  normalizeStentExplorerControlState,
  resetStentExplorerControlState,
  setStentExplorerControlValue,
} from '../explorer/controlState'
import {
  applyStentMechanicsModifiers,
  getStentExplorerAirwayPose,
  getStentExplorerPose,
} from '../explorer/pose'
import { stentExplorerStations } from '../explorer/stations'
import {
  STENT_MECHANICS_MODIFIER_IDS,
  type StentExplorerArchitectureId,
  type StentExplorerControl,
} from '../explorer/types'

function alternateControlValue(
  control: StentExplorerControl,
  currentValue: unknown = control.defaultValue,
  architectureId?: StentExplorerArchitectureId,
) {
  if (control.kind === 'toggle') return !(currentValue as boolean)
  if (control.kind === 'range') {
    return currentValue === control.min ? control.max : control.min
  }
  return control.options.find(
    (option) =>
      option.id !== currentValue &&
      (!architectureId ||
        !option.architectureIds ||
        option.architectureIds.includes(architectureId)),
  )?.id
}

function renderedSemanticSignature(
  station: (typeof stentExplorerStations)[number],
  state: ReturnType<typeof createDefaultStentExplorerControlState>,
  architectureId = station.defaultArchitectureId,
) {
  const modifiers = deriveStentMechanicsModifiers(station, state, architectureId)
  const poses = [0, 0.5, 1].map((progress) =>
    applyStentMechanicsModifiers(
      station.id,
      getStentExplorerPose(station.id, architectureId, progress),
      modifiers,
    ),
  )
  const airwayPoses = poses.map((pose) => getStentExplorerAirwayPose(station.id, pose, modifiers))

  return JSON.stringify({
    poses,
    airwayPoses,
    directGeometry: {
      branchAngleMismatch: modifiers.branchAngleMismatch,
      coverInspection: modifiers.coverInspection,
      comparisonReveal: modifiers.comparisonReveal,
      distalDisplacement: modifiers.distalDisplacement,
      distalOrificeCompromise: modifiers.distalOrificeCompromise,
      endTracking: modifiers.endTracking,
      focalContact: modifiers.focalContact,
      inspectionReveal: modifiers.inspectionReveal,
      landmarkTracking: modifiers.landmarkTracking,
      proximalDisplacement: modifiers.proximalDisplacement,
      retentionPocket: modifiers.retentionPocket,
      saddleMismatch: modifiers.saddleMismatch,
      structuralHotspot: modifiers.structuralHotspot,
      wallOccupancy: modifiers.wallOccupancy,
    },
  })
}

describe('stent explorer station controls', () => {
  it('keeps every station control registry bounded, qualitative, and internally valid', () => {
    expect(
      stentExplorerStations.reduce((total, station) => total + station.controls.length, 0),
    ).toBe(38)
    for (const station of stentExplorerStations) {
      expect(station.controls.length).toBeGreaterThanOrEqual(2)
      expect(station.controls.length).toBeLessThanOrEqual(4)
      expect(new Set(station.controls.map((control) => control.id)).size).toBe(
        station.controls.length,
      )

      for (const control of station.controls) {
        expect(control.label.length).toBeGreaterThan(4)
        expect(control.description.length).toBeGreaterThan(30)
        const controlArchitectureIds =
          'architectureIds' in control ? control.architectureIds : undefined
        for (const architectureId of controlArchitectureIds ?? []) {
          expect(station.architectureOptions.map((option) => option.id)).toContain(architectureId)
        }

        if (control.kind === 'range') {
          expect(control.min).toBe(0)
          expect(control.max).toBe(1)
          expect(control.step).toBeGreaterThan(0)
          expect(control.step).toBeLessThanOrEqual(0.25)
          expect(control.defaultValue).toBeGreaterThanOrEqual(control.min)
          expect(control.defaultValue).toBeLessThanOrEqual(control.max)
          expect(control.valueLabels.length).toBeGreaterThanOrEqual(3)
          for (const binding of control.modifiers) {
            expect(STENT_MECHANICS_MODIFIER_IDS).toContain(binding.id)
          }
        } else if (control.kind === 'preset') {
          expect(control.options.length).toBeGreaterThanOrEqual(2)
          expect(control.options.map((option) => option.id)).toContain(control.defaultValue)
          expect(new Set(control.options.map((option) => option.id)).size).toBe(
            control.options.length,
          )
          for (const option of control.options) {
            const optionArchitectureIds =
              'architectureIds' in option ? option.architectureIds : undefined
            for (const architectureId of optionArchitectureIds ?? []) {
              expect(station.architectureOptions.map((architecture) => architecture.id)).toContain(
                architectureId,
              )
            }
            for (const [modifierId, value] of Object.entries(option.modifiers)) {
              expect(STENT_MECHANICS_MODIFIER_IDS).toContain(modifierId)
              expect(value).toBeGreaterThanOrEqual(0)
              expect(value).toBeLessThanOrEqual(1)
            }
          }
        } else {
          for (const binding of control.modifiers) {
            expect(STENT_MECHANICS_MODIFIER_IDS).toContain(binding.id)
          }
        }
      }

      const learnerCopy = JSON.stringify(station.controls)
      expect(learnerCopy).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:mm|cm|newtons?|cycles?)\b/i)
      expect(learnerCopy).not.toMatch(/\b\d+(?:\.\d+)?\s*%/)
    }
  })

  it('creates complete defaults and resets to a fresh canonical state', () => {
    for (const station of stentExplorerStations) {
      const defaults = createDefaultStentExplorerControlState(station)
      expect(Object.keys(defaults)).toEqual(station.controls.map((control) => control.id))

      for (const control of station.controls) {
        expect(defaults[control.id]).toBe(control.defaultValue)
      }

      const firstControl: StentExplorerControl = station.controls[0]
      const changedValue = alternateControlValue(firstControl)
      const changed = setStentExplorerControlValue(station, defaults, firstControl.id, changedValue)
      const reset = resetStentExplorerControlState(station)

      expect(reset).toEqual(defaults)
      expect(reset).not.toBe(defaults)
      expect(reset).not.toBe(changed)
    }
  })

  it('clamps and snaps ranges, restores invalid values, and drops unknown keys', () => {
    const architectureStation = stentExplorerStations.find(
      (station) => station.id === 'architecture-lumen',
    )!
    const migrationStation = stentExplorerStations.find((station) => station.id === 'migration')!

    expect(
      normalizeStentExplorerControlState(architectureStation, {
        'wall-occupancy': 4,
        'comparison-reveal': 'yes',
        unexpected: true,
      }),
    ).toEqual({
      'wall-occupancy': 1,
      'comparison-reveal': true,
    })

    expect(
      normalizeStentExplorerControlState(architectureStation, {
        'wall-occupancy': 0.62,
        'comparison-reveal': false,
      }),
    ).toEqual({
      'wall-occupancy': 0.5,
      'comparison-reveal': false,
    })

    expect(
      normalizeStentExplorerControlState(migrationStation, {
        'apposition-loss': -5,
        'displacement-direction': 'not-a-preset',
        'landmark-tracking': true,
      }),
    ).toEqual({
      'apposition-loss': 0,
      'displacement-direction': 'distal',
      'landmark-tracking': true,
    })
  })

  it('derives a complete normalized modifier contract for scene integration', () => {
    const migrationStation = stentExplorerStations.find((station) => station.id === 'migration')!
    const state = normalizeStentExplorerControlState(migrationStation, {
      'apposition-loss': 0.75,
      'displacement-direction': 'proximal',
      'landmark-tracking': false,
    })
    const modifiers = deriveStentMechanicsModifiers(migrationStation, state)

    expect(Object.keys(modifiers)).toEqual(STENT_MECHANICS_MODIFIER_IDS)
    expect(modifiers.appositionLoss).toBe(0.75)
    expect(modifiers.proximalDisplacement).toBe(1)
    expect(modifiers.distalDisplacement).toBe(0)
    expect(modifiers.landmarkTracking).toBe(0)

    for (const value of Object.values(modifiers)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('makes every registered control change rendered semantic state and reset restores defaults', () => {
    for (const station of stentExplorerStations) {
      for (const architecture of station.architectureOptions) {
        const defaults = createDefaultStentExplorerControlState(station, architecture.id)
        const defaultSignature = renderedSemanticSignature(station, defaults, architecture.id)
        const visibleControls = station.controls.filter(
          (control) =>
            !control.architectureIds || control.architectureIds.includes(architecture.id),
        )

        for (const control of visibleControls) {
          const alternate = alternateControlValue(control, defaults[control.id], architecture.id)
          if (alternate === undefined) continue
          const changed = setStentExplorerControlValue(
            station,
            defaults,
            control.id,
            alternate,
            architecture.id,
          )
          expect(renderedSemanticSignature(station, changed, architecture.id)).not.toBe(
            defaultSignature,
          )
          expect(
            renderedSemanticSignature(
              station,
              resetStentExplorerControlState(station, architecture.id),
              architecture.id,
            ),
          ).toBe(defaultSignature)
        }
      }
    }
  })

  it('ignores hidden architecture-specific controls and unsupported preset options', () => {
    const tumorStation = stentExplorerStations.find(
      (station) => station.id === 'tumor-ingrowth-overgrowth',
    )!
    const modifiers = deriveStentMechanicsModifiers(
      tumorStation,
      {
        'tissue-pathway': 'through-cover-defect',
        'tissue-extent': 1,
        'cover-discontinuity': true,
      },
      'free-crossing-braid',
    )

    expect(modifiers.tumorIngrowth).toBe(1)
    expect(modifiers.coverFailure).toBe(0)
  })
})
