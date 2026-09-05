import type { RouteStopId } from '../../content/routeSpine'
import type { CatheterPosition } from '../../engine/types'

/**
 * The catheter map's geometry, held once so the drawing and its halos cannot disagree.
 *
 * The right-heart schematic is the one `NormalWaveformAnatomyFigure` draws (SVC, RA, tricuspid
 * valve, RV, pulmonic valve, main PA, a distal branch), shifted right to make room for the line —
 * the tubing, the stopcock, the flush bag, the transducer and the monitor — drawn to its left as
 * one continuous path from the catheter hub. Every coordinate is in the view box below.
 */
export const CATHETER_MAP_VIEW = { width: 520, height: 190 } as const

/** How far the heart is shifted right of the anatomy figure's own coordinates. */
export const HEART_OFFSET_X = 180

export const HEART_ROUTE_PATH =
  'M 262 14 L 262 58 C 262 74, 268 82, 276 84 C 298 90, 312 104, 332 128 C 346 112, 356 100, 368 90 C 388 74, 412 56, 432 44 C 448 35, 462 32, 480 30'

export const HEART_ROUTE_LENGTH = 330

export const HEART_ROUTE_PROGRESS: Readonly<Record<CatheterPosition, number>> = {
  introducer: 0.04,
  ra: 0.23,
  rv: 0.45,
  pa: 0.73,
  wedge: 1,
}

export const TIP_POINTS: Readonly<
  Record<CatheterPosition, { readonly x: number; readonly y: number }>
> = {
  introducer: { x: 262, y: 26 },
  ra: { x: 276, y: 84 },
  rv: { x: 332, y: 128 },
  pa: { x: 398, y: 62 },
  wedge: { x: 472, y: 32 },
}

/** The line, from the transducer to the catheter hub at the top of the SVC. */
export const LINE_TUBING_PATH = 'M 150 46 L 204 46 C 236 46, 252 30, 262 10'

export const LINE_PARTS = {
  monitor: { x: 12, y: 18, width: 74, height: 54 },
  transducer: { x: 112, y: 35, width: 38, height: 22 },
  flushBag: { x: 118, y: 74, width: 26, height: 34 },
  stopcock: { x: 204, y: 46 },
  cable: 'M 86 45 L 112 45',
  bagLine: 'M 131 74 L 131 57',
} as const

/** Where each stop's halo and pin sit. */
export const STOP_POINTS: Readonly<
  Record<RouteStopId, { readonly x: number; readonly y: number }>
> = {
  line: { x: 131, y: 46 },
  ra: TIP_POINTS.ra,
  rv: TIP_POINTS.rv,
  pa: TIP_POINTS.pa,
  wedge: TIP_POINTS.wedge,
}

export const STOP_HALO_RADIUS: Readonly<Record<RouteStopId, number>> = {
  line: 30,
  ra: 30,
  rv: 28,
  pa: 24,
  wedge: 20,
}

export const HEART_SHAPES = {
  svc: 'M 250 8 L 274 8 L 274 60 L 250 60 Z',
  rightVentricle:
    'M 298 96 C 326 96, 350 108, 358 128 C 348 152, 324 162, 306 152 C 290 142, 286 118, 298 96 Z',
  pulmonaryArtery:
    'M 352 104 C 376 82, 406 60, 434 46 C 452 37, 468 32, 486 28 L 490 42 C 472 46, 456 51, 440 60 C 414 74, 386 96, 364 116 Z',
  rightAtrium: { cx: 276, cy: 84, rx: 32, ry: 27 },
  tricuspid: { x1: 290, y1: 100, x2: 308, y2: 90 },
  pulmonic: { x1: 350, y1: 112, x2: 366, y2: 100 },
} as const

/** The stops as they sit along the pressure's path from the tip outward, for numbering pins. */
export const STOP_ORDER: readonly RouteStopId[] = ['line', 'ra', 'rv', 'pa', 'wedge']
