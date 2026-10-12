/**
 * Response planes that differ from the route export.
 *
 * The export puts both main-bronchus response points on slice 387, 5 mm below the tracheal node,
 * where the two bronchi still share one air column: there is nothing to tell apart there. They are
 * separate lumens from slice 375 down, so the tracheal bifurcation is identified on slice 372,
 * where the carina stands between two ovals 30 mm apart. The export itself is unchanged; this
 * table only moves the plane the learner identifies the daughters on, along each daughter's own
 * centreline.
 *
 * `scripts/branch-tracing/build-answer-plane-air.mjs` carries the same table (it is plain Node);
 * `__tests__/answer-plane-air.test.ts` holds the two together.
 */
export const RESPONSE_PLANE_OVERRIDES: Readonly<Record<string, number>> = {
  'junction-1': 372,
}
