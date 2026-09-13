/** Authored passive, single-compartment illustration, never a second live engine run.
 * Volumes start at the displayed breath reference. No effort, leak, pressure limit or adaptation.
 */
export interface IdealInputs {
  compliance: number // L/cmH2O
  resistance: number // cmH2O/(L/s), including tube
  peep: number // cmH2O
  volume: number // L
  pressure: number // cmH2O above PEEP
  ti: number // s
  duration: number // s; fixed across columns and mechanics comparisons
}
export interface IdealBreath {
  time: number[]
  pressure: number[]
  flow: number[] // L/min
  volume: number[] // mL
  deliveredVolume: number // mL at the exact end of inspiration
}
export type IdealAxes = Record<'pressure' | 'flow' | 'volume', readonly [number, number]>

export function idealBreaths(input: IdealInputs) {
  const { compliance: c, resistance: r, peep, volume: vt, pressure: dp, ti, duration } = input
  if (![c, r, ti, duration].every((n) => Number.isFinite(n) && n > 0) || duration <= ti)
    throw new Error('The comparison needs positive mechanics and time, with expiration after Ti.')
  const tau = r * c
  const pcVt = dp * c * -Math.expm1(-ti / tau)
  const vc: IdealBreath = {
    time: [],
    pressure: [],
    flow: [],
    volume: [],
    deliveredVolume: vt * 1000,
  }
  const pc: IdealBreath = {
    time: [],
    pressure: [],
    flow: [],
    volume: [],
    deliveredVolume: pcVt * 1000,
  }
  // Include BOTH sides of the exact transition at the same x. Pressure/flow can step;
  // volume must stay continuous. All x coordinates are actual seconds, never sample indices.
  for (let phase = 0; phase < 2; phase++) {
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * (phase === 0 ? ti : duration - ti)
      const time = phase === 0 ? t : ti + t
      const vvc = phase === 0 ? (vt * t) / ti : vt * Math.exp(-t / tau)
      const vpc = phase === 0 ? dp * c * -Math.expm1(-t / tau) : pcVt * Math.exp(-t / tau)
      vc.time.push(time)
      pc.time.push(time)
      vc.volume.push(vvc * 1000)
      pc.volume.push(vpc * 1000)
      vc.flow.push(60 * (phase === 0 ? vt / ti : -vvc / tau))
      pc.flow.push(60 * (phase === 0 ? (dp / r) * Math.exp(-t / tau) : -vpc / tau))
      vc.pressure.push(phase === 0 ? peep + (r * vt) / ti + vvc / c : peep)
      pc.pressure.push(phase === 0 ? peep + dp : peep)
    }
  }
  return { volumeTargeted: vc, pressureTargeted: pc }
}

/** One scale per physical variable, common to both columns AND the allowed controlled changes. */
export function idealComparisonAxes(reference: IdealInputs): IdealAxes {
  const breaths = [0.5, 1, 2].flatMap((c) =>
    [0.25, 1, 4].flatMap((r) =>
      Object.values(
        idealBreaths({
          ...reference,
          compliance: reference.compliance * c,
          resistance: reference.resistance * r,
        }),
      ),
    ),
  )
  const pressure = Math.ceil(Math.max(...breaths.flatMap((b) => b.pressure)) / 5) * 5
  const flow = Math.ceil(Math.max(...breaths.flatMap((b) => b.flow.map(Math.abs))) / 20) * 20
  const volume = Math.ceil(Math.max(...breaths.flatMap((b) => b.volume)) / 100) * 100
  return { pressure: [0, pressure], flow: [-flow, flow], volume: [0, volume] }
}

export function idealSeriesPath(
  breath: IdealBreath,
  variable: keyof IdealAxes,
  axes: IdealAxes,
  width = 260,
  height = 70,
) {
  const [min, max] = axes[variable]
  const duration = breath.time.at(-1)!
  return breath[variable]
    .map(
      (value, index) =>
        `${index ? 'L' : 'M'}${((breath.time[index] / duration) * width).toFixed(2)} ${(height - ((value - min) / (max - min)) * height).toFixed(2)}`,
    )
    .join(' ')
}
