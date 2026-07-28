/**
 * The assertions every critical-care teaching panel must satisfy.
 *
 * Mechanical Ventilation's panel test bans threshold-shaped text outright, because that module's
 * source reconciliation was pending when it was written. ECMO, CRRT and MCS *do* carry numbers, so
 * a blanket ban is the wrong contract here. What matters instead is that a number never reads as a
 * universal bedside target, and that every number resolves to something authored.
 *
 * Not used by any panel yet — no panels exist. This is the contract E3 will be written against.
 */
import { allCriticalCareDerivedValueGuides } from '../content/derivedValueGuides'
import { criticalCareMeasurementClarifications } from '../content/measurementClarifications'
import { criticalCareSourceConflicts } from '../content/sourceConflicts'

/**
 * Phrasings that turn a contextual value into a universal instruction.
 *
 * Deliberately narrow. "At or below the cut point reported in the cited cohort" is fine; "keep it
 * above 0.6" is not. The difference is whether the sentence carries its context with it.
 */
const universalTargetPatterns: readonly RegExp[] = [
  /\btarget of\s*\d/i,
  /\bshould (always )?be (above|below|over|under|greater than|less than)\s*\d/i,
  /\bkeep\b[^.]{0,32}\b(above|below|over|under)\s*\d/i,
  /\bnormal is\s*\d/i,
  /\bnormal range is\s*\d/i,
  /\baim for\s*\d/i,
]

export function assertNoUniversalTargetLanguage(text: string): void {
  for (const pattern of universalTargetPatterns) {
    expect(text).not.toMatch(pattern)
  }
}

/** Every numeric interpretation shown must come from an authored guide. */
export function assertEveryDerivedValueResolvesToAGuide(container: HTMLElement): void {
  const authoredIds = new Set(allCriticalCareDerivedValueGuides().map((guide) => guide.id))
  const rendered = container.querySelectorAll('[data-derived-value]')
  for (const node of rendered) {
    const id = node.getAttribute('data-derived-value') ?? ''
    expect(authoredIds).toContain(id)
  }
}

/** A rendered interpretation rule must show at least one reference, and it must carry evidence. */
export function assertEveryRuleResolvesToReferences(container: HTMLElement): void {
  for (const node of container.querySelectorAll('[data-interpretation-rule]')) {
    const references = node.querySelectorAll('[data-reference-id]')
    expect(references.length).toBeGreaterThan(0)
    for (const reference of references) {
      const evidence = reference.querySelector('[data-evidence-ids]')
      expect(evidence?.textContent?.trim()).toBeTruthy()
    }
  }
}

/** A reference's kind must be visible as words, never as colour alone. */
export function assertReferenceKindsAreLabelled(container: HTMLElement): void {
  for (const node of container.querySelectorAll('[data-reference-kind]')) {
    expect(node.textContent?.trim()).toBeTruthy()
  }
}

/** An educational-model boundary must say so where a learner can read it. */
export function assertModelBoundariesAreLabelled(container: HTMLElement): void {
  for (const node of container.querySelectorAll(
    '[data-reference-kind="educational-model-boundary"]',
  )) {
    expect(node.textContent ?? '').toMatch(/simulation/i)
  }
}

/** A cohort observation must read as context-specific, not as a definition. */
export function assertCohortObservationsAreLabelled(container: HTMLElement): void {
  for (const node of container.querySelectorAll('[data-reference-kind="cohort-observation"]')) {
    expect(node.textContent ?? '').toMatch(/cohort/i)
  }
}

/** Every authored position of a rendered disagreement must actually appear. */
export function assertEveryConflictPositionRenders(container: HTMLElement): void {
  for (const node of container.querySelectorAll('[data-held-disagreement]')) {
    const id = node.getAttribute('data-held-disagreement')
    const authored = criticalCareSourceConflicts.find((conflict) => conflict.id === id)
    expect(authored).toBeDefined()
    expect(node.querySelectorAll('[data-conflict-position]').length).toBe(
      authored?.positions.length,
    )
  }
}

/** Every clarified quantity must appear, and must name what it measures. */
export function assertEveryClarifiedQuantityRenders(container: HTMLElement): void {
  for (const node of container.querySelectorAll('[data-measurement-clarification]')) {
    const id = node.getAttribute('data-measurement-clarification')
    const authored = criticalCareMeasurementClarifications.find(
      (clarification) => clarification.id === id,
    )
    expect(authored).toBeDefined()
    const quantities = node.querySelectorAll('[data-clarified-quantity]')
    expect(quantities.length).toBe(authored?.quantities.length)
    for (const quantity of quantities) {
      expect(quantity.querySelector('[data-measurand]')?.textContent?.trim()).toBeTruthy()
    }
  }
}

/**
 * How many held disagreements a panel may show inline.
 *
 * A learner meeting four source contradictions inside one figure takes away less than one who
 * meets a single well-framed one. Extra disagreements belong on an evidence surface.
 */
export function assertDisagreementDensity(
  container: HTMLElement,
  stage: 'foundation' | 'mechanism' | 'integration' | 'capstone',
): void {
  const inline = container.querySelectorAll('[data-held-disagreement]').length
  const allowed = stage === 'integration' || stage === 'capstone' ? 2 : 1
  expect(inline).toBeLessThanOrEqual(allowed)
}

/** The whole contract, for a panel that renders evidence surfaces. */
export function assertTeachingPanelContract(
  container: HTMLElement,
  stage: 'foundation' | 'mechanism' | 'integration' | 'capstone' = 'foundation',
): void {
  assertNoUniversalTargetLanguage(container.textContent ?? '')
  assertEveryDerivedValueResolvesToAGuide(container)
  assertEveryRuleResolvesToReferences(container)
  assertReferenceKindsAreLabelled(container)
  assertModelBoundariesAreLabelled(container)
  assertCohortObservationsAreLabelled(container)
  assertEveryConflictPositionRenders(container)
  assertEveryClarifiedQuantityRenders(container)
  assertDisagreementDensity(container, stage)
}
