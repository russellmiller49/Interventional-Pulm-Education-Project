/**
 * Context-aware interpretation of the numbers this resource shows a learner.
 *
 * The model this replaces had two fields — `normalRange` and `actionableThresholds` — and both
 * names encouraged the wrong claim. A device specification is not a bedside target, a cut point
 * observed in one cohort is not a universal definition, and an alarm boundary invented for a
 * simulator is not clinical evidence. Those distinctions were carried in prose, where nothing could
 * check them.
 *
 * Here every number is attached to a `kind` that says what sort of reference it is, and to the
 * evidence it came from. Nothing renders without its kind.
 */

/** What sort of claim a number represents. Never collapse these into one another. */
export type CriticalCareValueReferenceKind =
  /** This patient's or circuit's own earlier value. The most transferable comparison there is. */
  | 'patient-baseline'
  /** Manufacturer labeling for a named device revision. Not a treatment target. */
  | 'device-specification'
  /** A cut point observed in a specific population. Not a universal definition. */
  | 'cohort-observation'
  /** A recommendation from a named guideline body, with its own scope. */
  | 'guideline-recommendation'
  /** A range a source states, retained as that source's claim rather than as consensus. */
  | 'source-reported-range'
  /** An institutional protocol value. Travels badly between institutions by definition. */
  | 'local-protocol'
  /** A boundary this simulator uses to behave. Carries no clinical authority whatsoever. */
  | 'educational-model-boundary'
  /** The definition of a calculation, not a judgement about its result. */
  | 'formula-definition'

/** What the live number on screen actually is. */
export type CriticalCareLiveValueType =
  /** Measured directly by an instrument. */
  | 'measured'
  /** Reported by the device's own display, with that device's conventions and limits. */
  | 'device-displayed'
  /** Inferred by a model from other quantities; no instrument reads it. */
  | 'estimated'
  /** Computed from other values by an authored formula. */
  | 'derived'
  /** A setting somebody chose, not an observation. */
  | 'configured'

export interface CriticalCareValueReference {
  readonly id: string
  readonly kind: CriticalCareValueReferenceKind
  /** The claim itself, stated as the source states it. */
  readonly statement: string
  /** Population, device revision, clinical context, or simulation context this applies within. */
  readonly appliesWhen: string
  readonly evidenceIds: readonly string[]
  readonly caveat?: string
}

/** Half-open or closed interval. Boundary inclusivity is explicit, never implied. */
export interface CriticalCareNumericInterval {
  readonly gt?: number
  readonly gte?: number
  readonly lt?: number
  readonly lte?: number
}

export interface CriticalCareValueInterpretationRule {
  readonly id: string
  /** Omitted for a fallback rule, which matches anything the earlier rules did not. */
  readonly interval?: CriticalCareNumericInterval
  readonly statement: string
  readonly referenceIds: readonly string[]
}

export interface CriticalCareDerivedValueGuide {
  readonly id: string
  readonly label: string
  readonly unit?: string
  readonly formula?: string
  readonly liveValueType: CriticalCareLiveValueType
  /** How to read this quantity at all, before any particular value is considered. */
  readonly interpretation: string
  readonly references: readonly CriticalCareValueReference[]
  /** Evaluated in authored order; the first match wins. */
  readonly rules?: readonly CriticalCareValueInterpretationRule[]
  readonly caveats: string
  /** Required. The inference a learner is most likely to make and should not. */
  readonly doNotInfer: string
  readonly conceptIds: readonly string[]
  readonly reviewStatus: 'draft' | 'sme-review' | 'released'
}

export function intervalContains(interval: CriticalCareNumericInterval, value: number): boolean {
  if (interval.gt !== undefined && !(value > interval.gt)) return false
  if (interval.gte !== undefined && !(value >= interval.gte)) return false
  if (interval.lt !== undefined && !(value < interval.lt)) return false
  if (interval.lte !== undefined && !(value <= interval.lte)) return false
  return true
}

export interface CriticalCareResolvedInterpretation {
  readonly rule: CriticalCareValueInterpretationRule
  readonly references: readonly CriticalCareValueReference[]
}

/**
 * Resolve a live value to its authored interpretation.
 *
 * Rules are evaluated in authored order and the first match wins, so a narrower band authored
 * earlier takes precedence over a wider one after it. Returns `null` when nothing matches and the
 * guide authored no fallback — a caller must then show no interpretation rather than inventing one.
 */
export function resolveInterpretation(
  guide: CriticalCareDerivedValueGuide,
  value: number,
): CriticalCareResolvedInterpretation | null {
  if (!guide.rules) return null
  const referenceById = new Map(guide.references.map((reference) => [reference.id, reference]))
  for (const rule of guide.rules) {
    if (rule.interval && !intervalContains(rule.interval, value)) continue
    return {
      rule,
      references: rule.referenceIds
        .map((id) => referenceById.get(id))
        .filter((reference): reference is CriticalCareValueReference => Boolean(reference)),
    }
  }
  return null
}

/** Human-readable label for a reference kind. Used by the renderer's badge and its text alternative. */
export const criticalCareReferenceKindLabels: Readonly<
  Record<CriticalCareValueReferenceKind, string>
> = Object.freeze({
  'patient-baseline': 'This patient’s baseline',
  'device-specification': 'Device specification',
  'cohort-observation': 'Cohort observation',
  'guideline-recommendation': 'Guideline recommendation',
  'source-reported-range': 'Source-reported range',
  'local-protocol': 'Local protocol',
  'educational-model-boundary': 'Simulation boundary',
  'formula-definition': 'Formula definition',
})

export const criticalCareLiveValueTypeLabels: Readonly<Record<CriticalCareLiveValueType, string>> =
  Object.freeze({
    measured: 'Measured',
    'device-displayed': 'Device-displayed',
    estimated: 'Estimated',
    derived: 'Derived',
    configured: 'Configured setting',
  })

function malformedInterval(interval: CriticalCareNumericInterval): boolean {
  if (interval.gt !== undefined && interval.gte !== undefined) return true
  if (interval.lt !== undefined && interval.lte !== undefined) return true
  const low = interval.gt ?? interval.gte
  const high = interval.lt ?? interval.lte
  if (low === undefined && high === undefined) return true
  if (low !== undefined && high !== undefined && low > high) return true
  for (const bound of [interval.gt, interval.gte, interval.lt, interval.lte]) {
    if (bound !== undefined && !Number.isFinite(bound)) return true
  }
  return false
}

/**
 * Structural validation. Returns messages rather than throwing so both the import-time guard and
 * the audit harness can use it and report every problem at once.
 */
export function validateCriticalCareDerivedValueGuides(
  guides: readonly CriticalCareDerivedValueGuide[],
): readonly string[] {
  const errors: string[] = []
  const seenGuideIds = new Set<string>()
  const seenReferenceIds = new Set<string>()

  for (const guide of guides) {
    if (seenGuideIds.has(guide.id)) errors.push(`duplicate guide id: ${guide.id}`)
    seenGuideIds.add(guide.id)

    if (!guide.doNotInfer.trim()) errors.push(`${guide.id}: doNotInfer is required`)
    if (guide.references.length === 0)
      errors.push(`${guide.id}: at least one reference is required`)

    const localReferenceIds = new Set<string>()
    for (const reference of guide.references) {
      if (seenReferenceIds.has(reference.id)) {
        errors.push(`duplicate reference id: ${reference.id}`)
      }
      seenReferenceIds.add(reference.id)
      localReferenceIds.add(reference.id)
      if (reference.evidenceIds.length === 0) {
        errors.push(`${guide.id}/${reference.id}: evidenceIds must not be empty`)
      }
      if (!reference.appliesWhen.trim()) {
        errors.push(`${guide.id}/${reference.id}: appliesWhen must name a context`)
      }
    }

    const seenRuleIds = new Set<string>()
    for (const rule of guide.rules ?? []) {
      if (seenRuleIds.has(rule.id)) errors.push(`${guide.id}: duplicate rule id ${rule.id}`)
      seenRuleIds.add(rule.id)
      if (rule.referenceIds.length === 0) {
        errors.push(`${guide.id}/${rule.id}: a rule must resolve to at least one reference`)
      }
      for (const referenceId of rule.referenceIds) {
        if (!localReferenceIds.has(referenceId)) {
          errors.push(`${guide.id}/${rule.id}: unknown reference ${referenceId}`)
        }
      }
      if (rule.interval && malformedInterval(rule.interval)) {
        errors.push(`${guide.id}/${rule.id}: malformed interval`)
      }
    }
  }

  return errors
}

/** Registry of every module's guides, assembled by the module bindings that import this file. */
const registry = new Map<string, CriticalCareDerivedValueGuide>()

export function registerCriticalCareDerivedValueGuides(
  guides: readonly CriticalCareDerivedValueGuide[],
): readonly CriticalCareDerivedValueGuide[] {
  const errors = validateCriticalCareDerivedValueGuides(guides)
  if (errors.length > 0) {
    throw new Error(`Invalid critical-care derived-value guides:\n- ${errors.join('\n- ')}`)
  }
  for (const guide of guides) {
    if (registry.has(guide.id)) {
      throw new Error(
        `Invalid critical-care derived-value guides:\nduplicate guide id: ${guide.id}`,
      )
    }
    registry.set(guide.id, guide)
  }
  return guides
}

export function criticalCareDerivedValueGuide(
  id: string,
): CriticalCareDerivedValueGuide | undefined {
  return registry.get(id)
}

export function allCriticalCareDerivedValueGuides(): readonly CriticalCareDerivedValueGuide[] {
  return [...registry.values()]
}
