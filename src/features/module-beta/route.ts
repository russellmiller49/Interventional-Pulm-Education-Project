import { betaModuleById } from './catalog'

/**
 * A suggested order through a group of hub modules.
 *
 * The five critical care modules were listed in the order they were built (ECMO, CRRT,
 * hemodynamics, ventilation, MCS), and nothing on the reviewer hub said which to open first. The
 * order below is the one the critical care plan settled (owner, 2026-11-10): each module uses
 * what an earlier one taught. It is a suggestion on the hub and nothing else: every module still
 * opens on its own, and no module is locked behind another.
 *
 * `why` is one sentence per module, said to a reviewer. It names what the module adds at that
 * point and claims nothing about the module's content beyond its own hub note.
 */
export interface BetaRouteStep {
  readonly moduleId: string
  readonly why: string
}

export interface BetaRoute {
  /** The hub group the route orders. */
  readonly group: string
  readonly title: string
  readonly intro: string
  readonly steps: readonly BetaRouteStep[]
}

export const criticalCareRoute: BetaRoute = {
  group: 'Critical care',
  title: 'Critical care route',
  intro:
    'A suggested order. Each module can be reviewed on its own; taken in this order, what one teaches is already in hand when the next one uses it.',
  steps: [
    {
      moduleId: 'icu-hemodynamics',
      why: 'First: the pressures, cardiac output and shock profiles that the later modules read their patients with.',
    },
    {
      moduleId: 'mechanical-ventilation',
      why: 'Second: the ventilator, one mechanism at a time. Its settings return in the ECMO module.',
    },
    {
      moduleId: 'baxter-crrt',
      why: 'Third: a first extracorporeal circuit, with access, circuit pressures and a filter, and no gas exchange.',
    },
    {
      moduleId: 'mechanical-circulatory-support',
      why: 'Fourth: devices that support a failing ventricle, read with the hemodynamics from the first module.',
    },
    {
      moduleId: 'cardiohelp-ecmo',
      why: 'Last: a circuit that takes over gas exchange, and on VA the circulation as well. It draws on all four before it.',
    },
  ],
}

export const betaRoutes: readonly BetaRoute[] = [criticalCareRoute]

export interface BetaRoutePlace {
  readonly route: BetaRoute
  /** 1-based. */
  readonly position: number
  readonly total: number
  readonly why: string
}

/** Where a module sits in a route, if it is in one. */
export function betaRoutePlace(moduleId: string): BetaRoutePlace | null {
  for (const route of betaRoutes) {
    const index = route.steps.findIndex((step) => step.moduleId === moduleId)
    if (index >= 0)
      return {
        route,
        position: index + 1,
        total: route.steps.length,
        why: route.steps[index].why,
      }
  }
  return null
}

/** The route that orders this hub group, if one does. */
export function betaRouteForGroup(group: string): BetaRoute | null {
  return betaRoutes.find((route) => route.group === group) ?? null
}

/** A route's modules in order first, then the group's other modules as they were. */
export function inRouteOrder<T extends { readonly id: string }>(
  entries: readonly T[],
  route: BetaRoute | null,
): readonly T[] {
  if (!route) return entries
  const place = (entry: T) => {
    const index = route.steps.findIndex((step) => step.moduleId === entry.id)
    return index < 0 ? route.steps.length : index
  }
  return [...entries].sort((a, b) => place(a) - place(b))
}

/** Every step names a module the catalog has, in the route's own group (checked in the test). */
export function betaRouteErrors(): readonly string[] {
  const errors: string[] = []
  for (const route of betaRoutes) {
    const seen = new Set<string>()
    for (const step of route.steps) {
      const entry = betaModuleById(step.moduleId)
      if (!entry) errors.push(`${route.title}: unknown module ${step.moduleId}`)
      else if (entry.group !== route.group)
        errors.push(`${route.title}: ${step.moduleId} is in ${entry.group}, not ${route.group}`)
      if (seen.has(step.moduleId)) errors.push(`${route.title}: ${step.moduleId} is listed twice`)
      seen.add(step.moduleId)
    }
  }
  return errors
}
