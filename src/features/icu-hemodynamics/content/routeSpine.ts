import { hemodynamicsSourceById } from './sources'

/**
 * The spine: the pressure's path from the catheter tip to the number on the screen.
 *
 * Five stops. Four are places the tip sits — right atrium, right ventricle, pulmonary artery, the
 * balloon-occluded branch — and each writes its own waveform. The fifth is everything between the
 * tip and the displayed number: the tubing, the flush bag, the transducer and the scale, which is
 * where a signal is made trustworthy or quietly ruined before any chamber is read.
 *
 * Every term, control and check in the module is introduced at its stop. The route map draws the
 * stops as one schematic, lights the current one, and takes a location answer by pointing at it.
 * Ordinal 0 is the line because it is the first thing the pressure meets on the way out and the
 * first thing a learner checks on the way in; the anatomical stops keep the insertion order the
 * normal-waveform reference already uses (`normalWaveformReference[].order`).
 */
export const routeStopIds = ['line', 'ra', 'rv', 'pa', 'wedge'] as const

export type RouteStopId = (typeof routeStopIds)[number]

export interface RouteStop {
  readonly id: RouteStopId
  /** 0 for the line, then the insertion order. */
  readonly ordinal: number
  /** The plain name, said first. */
  readonly title: string
  /** What the monitor and the literature call it, said second. */
  readonly monitorLabel: string
  /** One concrete image; the only analogy this stop gets. */
  readonly analogy: string
  /** The precise statement the analogy stands for. */
  readonly precise: string
  /** At most four items; the thing later sections reference. */
  readonly checklist: readonly string[]
  /** One thing to try on the live monitor, and what to watch. */
  readonly wiggle: { readonly change: string; readonly watch: string }
  readonly sourceIds: readonly string[]
}

export const routeStops: readonly RouteStop[] = Object.freeze([
  {
    id: 'line',
    ordinal: 0,
    title: 'The line',
    monitorLabel: 'the transducer and the scale',
    analogy:
      'A garden hose running to a pressure gauge. Where the gauge hangs sets what it reads, what you call zero sets where the needle rests, and how stiff the hose is decides whether the gauge can follow a quick change.',
    precise:
      'Between the tip and the number sit a fluid-filled catheter and tubing, a transducer with a reference height and an atmospheric zero, and a display with a scale. Level and zero move the whole tracing up or down without changing its shape. Damping and scale change the shape or the size without moving it.',
    checklist: ['Level', 'Zero', 'Scale', 'Flush response'],
    wiggle: {
      change: 'Move the transducer a few centimetres and watch the numbers.',
      watch: 'The whole tracing shifts; not one wave changes its shape.',
    },
    sourceIds: [
      'arterial-pressure-five-step-2020',
      'clinical-hemodynamics-waveforms',
      'monitor-workflow-supplied',
    ],
  },
  {
    id: 'ra',
    ordinal: 1,
    title: 'Right atrium',
    monitorLabel: 'CVP, RA or RAP',
    analogy:
      'A filling room with a door that shuts. The room fills quietly, the door slams once a beat, and the level rises and falls by only a few millimetres of mercury.',
    precise:
      'A low-amplitude venous tracing with three positive waves (a, c, v) and two descents (x, y). The a wave follows the P wave, the c wave the QRS, the v wave peaks at the end of the T wave. Read the mean at end expiration, at the base of the c wave.',
    checklist: [
      'a, c and v waves present',
      'x and y descents present',
      'read the mean, not a peak',
      'at end expiration',
    ],
    wiggle: {
      change: 'Freeze the trace and find end expiration.',
      watch:
        'The slow envelope under the waves: the reading is taken at its trough, not at a peak.',
    },
    sourceIds: ['clinical-hemodynamics-waveforms', 'cvp-measurement-2017', 'pac-review-2014'],
  },
  {
    id: 'rv',
    ordinal: 2,
    title: 'Right ventricle',
    monitorLabel: 'RV',
    analogy:
      'The pump chamber. High while it squeezes, near the floor as it relaxes, then rising slowly as it fills again — and nothing in between marks a valve closing behind the tip.',
    precise:
      'A rapid systolic rise to a pressure far above the atrium, then a fall toward a low diastolic pressure that climbs gradually through filling. No diastolic step-up, no run-off and no dicrotic notch. Systolic pressure is normally the same as the pulmonary artery; the diastolic contour is what tells them apart.',
    checklist: [
      'sharp systolic peak',
      'diastole dips low, then rises',
      'no notch',
      'a transit position, not a resting one',
    ],
    wiggle: {
      change: 'Compare this trace with the one that follows it.',
      watch: 'The peaks match; only the floor and the notch differ.',
    },
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'pa',
    ordinal: 3,
    title: 'Pulmonary artery',
    monitorLabel: 'PA or PAP',
    analogy:
      'The pipe after the pump. The pump still throws the same peak, but now a valve shuts behind the tip — the notch — and the pressure never falls to the floor because the pipe holds it up between beats.',
    precise:
      'A systolic peak matching the ventricle, a dicrotic notch as the pulmonic valve closes, and a diastolic run-off that never reaches the ventricular floor: the diastolic step-up. This is the position every measurement starts from — the wedge, the thermistor, the mixed venous sample.',
    checklist: [
      'systolic peak (same as RV)',
      'dicrotic notch',
      'diastolic step-up and run-off',
      'confirmed here before anything else',
    ],
    wiggle: {
      change: 'Watch one beat from peak to floor.',
      watch: 'The notch on the way down, and a floor that sits well above zero.',
    },
    sourceIds: ['clinical-hemodynamics-waveforms', 'pac-waveforms-part-1-2021'],
  },
  {
    id: 'wedge',
    ordinal: 4,
    title: 'The wedge',
    monitorLabel: 'PAWP or PAOP',
    analogy:
      'Listening through a stopped branch. Inflate the balloon and the artery in front of the tip goes quiet; what is left is the left atrium, heard from far away and a little late.',
    precise:
      'With the branch occluded, the pulmonary-artery pulsatility disappears and an atrial tracing returns — a and v waves, delayed relative to the right atrium, with a mean that sits below pulmonary-artery diastolic pressure. It is taken briefly, at end expiration, and it is over when the balloon is down and the PA waveform is back.',
    checklist: [
      'atrial shape returns, notch gone',
      'mean below PA diastolic',
      'brief, at end expiration',
      'PA waveform comes back',
    ],
    wiggle: {
      change: 'Occlude, read, deflate.',
      watch: 'The PA shape must return on its own. If it does not, the position is unsafe.',
    },
    sourceIds: [
      'clinical-hemodynamics-waveforms',
      'pac-waveforms-part-1-2021',
      'edwards-swan-ganz-ifu-2023',
    ],
  },
])

const routeStopById = new Map(routeStops.map((stop) => [stop.id, stop]))

export function routeStop(id: RouteStopId): RouteStop {
  const stop = routeStopById.get(id)
  if (!stop) throw new Error(`Unknown route stop: ${id}`)
  return stop
}

export function isRouteStopId(value: unknown): value is RouteStopId {
  return typeof value === 'string' && routeStopById.has(value as RouteStopId)
}

/** The anatomical stops, in insertion order — the walk the waveform section takes. */
export const heartRouteStopIds: readonly RouteStopId[] = ['ra', 'rv', 'pa', 'wedge']

export function validateRouteSpine(stops: readonly RouteStop[] = routeStops): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  stops.forEach((stop, index) => {
    if (ids.has(stop.id)) errors.push(`Route stop ${stop.id} is declared twice.`)
    ids.add(stop.id)
    if (stop.ordinal !== index) {
      errors.push(`Route stop ${stop.id} has ordinal ${stop.ordinal}; expected ${index}.`)
    }
    if (stop.checklist.length === 0 || stop.checklist.length > 4) {
      errors.push(`Route stop ${stop.id} needs one to four checklist items.`)
    }
    if (stop.sourceIds.length === 0) errors.push(`Route stop ${stop.id} cites nothing.`)
    for (const sourceId of stop.sourceIds) {
      if (!hemodynamicsSourceById.has(sourceId)) {
        errors.push(`Route stop ${stop.id} cites an unregistered source: ${sourceId}.`)
      }
    }
    if (/\d/.test(`${stop.analogy} ${stop.precise} ${stop.checklist.join(' ')}`)) {
      errors.push(`Route stop ${stop.id} carries a number in learner copy.`)
    }
  })
  for (const id of routeStopIds) {
    if (!ids.has(id)) errors.push(`Route stop ${id} is missing.`)
  }
  return errors
}

const routeSpineErrors = validateRouteSpine()
if (routeSpineErrors.length > 0) {
  throw new Error(`Route spine is invalid:\n${routeSpineErrors.join('\n')}`)
}
