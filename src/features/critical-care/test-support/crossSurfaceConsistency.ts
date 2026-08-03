/**
 * The cross-surface causal invariant.
 *
 * A learner meets the same action on more than one surface. Learn lets them do it and watch the
 * simulation respond; Practice classifies it and scores it; the debriefs explain it. Nothing in the
 * codebase previously made those surfaces agree, and they had drifted: VV recirculation was
 * classified harmful in a Practice case whose authored patch forced the patient's saturation down,
 * while the Learn engine rewarded exactly the same action with a rising saturation. Each surface
 * was internally consistent and the curriculum as a whole taught the opposite of itself.
 *
 * The invariant, stated once:
 *
 *   An action classified as harmful in Practice must not improve the corresponding learner-visible
 *   outcome in Learn, unless an explicitly authored contextual difference explains the change.
 *
 * Written module-agnostically on purpose. ECMO is the first caller; the plan reuses this for CRRT
 * and MCS, where the same shape recurs (prescribed dose versus delivered dose, selected setting
 * versus effective perfusion).
 */

/** How the learner's situation is judged to have moved. */
export type OutcomeMovement = 'improved' | 'worsened' | 'unchanged'

export interface CrossSurfaceObservable<TState> {
  /** What the learner sees move, in their words. */
  readonly label: string
  readonly read: (state: TState) => number
  /** Which direction counts as the patient being better off. */
  readonly betterWhen: 'higher' | 'lower'
  /**
   * Movement smaller than this is noise rather than a claim. Keep it tight: a deadband wide enough
   * to hide a real improvement would defeat the test it is part of.
   */
  readonly deadband: number
}

export interface CrossSurfaceCausalClaim<TState> {
  /** Stable id, used in failure messages. */
  readonly id: string
  /** Scenario identity or family the two surfaces share. */
  readonly scenarioFamily: string
  /** The action, described the way both surfaces describe it. */
  readonly action: string
  /** How Practice classifies that action. */
  readonly practiceClassification: 'harmful' | 'protective' | 'neutral'
  readonly observable: CrossSurfaceObservable<TState>
  /** Load the Learn-side state this action is performed from. */
  readonly loadLearnState: () => TState
  /** Perform the action on the Learn side. */
  readonly performOnLearnSurface: (state: TState) => TState
  /**
   * Set ONLY when the two surfaces legitimately differ because the context differs, and say why.
   * Providing this suppresses the direction assertion, so it must never be used to wave away a
   * contradiction — it is a claim that the difference is authored and intended.
   */
  readonly authoredContextDifference?: string
  /**
   * Learner-facing sentences from either surface about this action — Learn rationale, Practice
   * response, debrief causal chain, model boundary. Checked for phrasing that promises the
   * improvement the classification denies.
   */
  readonly narratives?: readonly string[]
}

/** Phrasings that promise the learner the action helps. Narrow on purpose. */
const improvementPhrases: readonly RegExp[] = [
  /\bimproves? (?:the )?(?:patient|systemic|oxygenation|saturation|support|perfusion)/i,
  /\bincreases? effective (?:support|flow|perfusion)/i,
  /\brestores? (?:effective )?(?:support|perfusion|oxygenation)/i,
  /\bmore effective support\b/i,
]

function movement(
  before: number,
  after: number,
  observable: CrossSurfaceObservable<never>,
): OutcomeMovement {
  const delta = after - before
  if (Math.abs(delta) <= observable.deadband) return 'unchanged'
  const rose = delta > 0
  const better = observable.betterWhen === 'higher' ? rose : !rose
  return better ? 'improved' : 'worsened'
}

/**
 * Runs the action on the Learn surface and returns what actually happened, so a caller can assert
 * more than the invariant when it wants to (for example that the harmful action makes things
 * measurably worse rather than merely failing to help).
 */
export function measureLearnOutcome<TState>(claim: CrossSurfaceCausalClaim<TState>): {
  readonly before: number
  readonly after: number
  readonly movement: OutcomeMovement
} {
  const loaded = claim.loadLearnState()
  const before = claim.observable.read(loaded)
  const acted = claim.performOnLearnSurface(loaded)
  const after = claim.observable.read(acted)
  return {
    before,
    after,
    movement: movement(before, after, claim.observable as CrossSurfaceObservable<never>),
  }
}

/**
 * Assert the invariant for one claim.
 *
 * Deliberately asserts on the Learn side only. Practice's classification is authored content and is
 * taken as the statement of intent; what has to be checked is whether the simulation the learner
 * actually drives agrees with it.
 */
export function assertCrossSurfaceCausalConsistency<TState>(
  claim: CrossSurfaceCausalClaim<TState>,
): void {
  const outcome = measureLearnOutcome(claim)

  if (claim.practiceClassification === 'harmful') {
    if (claim.authoredContextDifference) {
      // An authored exception still has to say something. A blank or throwaway string would let a
      // contradiction through under the cover of having been declared.
      expect(claim.authoredContextDifference.trim().length).toBeGreaterThan(40)
    } else {
      expect({
        claim: claim.id,
        scenarioFamily: claim.scenarioFamily,
        action: claim.action,
        observable: claim.observable.label,
        before: outcome.before,
        after: outcome.after,
        movement: outcome.movement,
      }).toMatchObject({ movement: expect.not.stringMatching(/^improved$/) })
    }
  }

  if (claim.practiceClassification === 'protective') {
    expect(outcome.movement).not.toBe('worsened')
  }

  for (const narrative of claim.narratives ?? []) {
    if (claim.practiceClassification !== 'harmful') continue
    for (const phrase of improvementPhrases) {
      expect(narrative).not.toMatch(phrase)
    }
  }
}

/** Assert a whole registry at once, so adding a claim is the only work a new module has to do. */
export function assertCrossSurfaceCausalConsistencyAll<TState>(
  claims: readonly CrossSurfaceCausalClaim<TState>[],
): void {
  expect(claims.length).toBeGreaterThan(0)
  for (const claim of claims) assertCrossSurfaceCausalConsistency(claim)
}
