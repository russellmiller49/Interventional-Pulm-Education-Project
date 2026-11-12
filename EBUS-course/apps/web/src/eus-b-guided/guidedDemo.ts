import { insertionDepthCm } from '@/features/eus-b-simulator/eusPose';
import type {
  EusCaseManifest,
  EusScopePath,
  EusScopeState,
} from '@/features/eus-b-simulator/types';
import { applyScopeChange } from '@/features/eus-b-simulator/useEusScopeSession';

/**
 * "Show me": the lab drives the scope from where the learner left it to the target's view.
 *
 * The movement is split into the movements an operator makes, one at a time and in the order they
 * are made: travel along the esophagus first, then rotation of the shaft, then tip angulation.
 * Each is a leg. Pure functions of time, so the component can step them with a timer.
 */
export type DemoMove = 'advance' | 'withdraw' | 'rotate' | 'angle';

export interface DemoLeg {
  move: DemoMove;
  from: EusScopeState;
  to: EusScopeState;
}

/** How long one leg takes on screen. */
export const DEMO_LEG_MS = 1600;
/** Gap between two drawn positions of a leg. */
export const DEMO_STEP_MS = 50;
/** A difference smaller than this is not worth a leg of its own. */
const WORTH_A_LEG = 0.5;

/** Shortest turn from one shaft rotation to another, in (-180, 180]; clockwise positive. */
export function shortestTurnDeg(fromDeg: number, toDeg: number) {
  const turn = (((toDeg - fromDeg) % 360) + 360) % 360;
  return turn > 180 ? turn - 360 : turn;
}

export function demoLegs(
  path: Pick<EusScopePath, 'totalLengthMm'>,
  from: EusScopeState,
  to: EusScopeState,
): DemoLeg[] {
  const end = applyScopeChange(path, to, {});
  let at = applyScopeChange(path, from, {});
  const legs: DemoLeg[] = [];
  const leg = (move: DemoMove, next: EusScopeState) => {
    legs.push({ move, from: at, to: next });
    at = next;
  };
  if (Math.abs(end.sMm - at.sMm) >= WORTH_A_LEG)
    leg(end.sMm > at.sMm ? 'advance' : 'withdraw', { ...at, sMm: end.sMm });
  if (Math.abs(shortestTurnDeg(at.rollDeg, end.rollDeg)) >= WORTH_A_LEG)
    leg('rotate', { ...at, rollDeg: end.rollDeg });
  if (Math.abs(end.flexDeg - at.flexDeg) >= WORTH_A_LEG)
    leg('angle', { ...at, flexDeg: end.flexDeg });
  // Whatever was too small for a leg of its own is taken up by the last one.
  if (legs.length) legs[legs.length - 1] = { ...legs[legs.length - 1], to: end };
  return legs;
}

/** Scope position a share `t` of the way through a leg; it starts and stops gently. */
export function demoPoseAt(
  path: Pick<EusScopePath, 'totalLengthMm'>,
  leg: DemoLeg,
  t: number,
): EusScopeState {
  if (!(t > 0)) return leg.from;
  if (t >= 1) return leg.to;
  const eased = t * t * (3 - 2 * t);
  const between = (a: number, b: number) => a + (b - a) * eased;
  return applyScopeChange(path, leg.from, {
    sMm: between(leg.from.sMm, leg.to.sMm),
    rollDeg: leg.from.rollDeg + shortestTurnDeg(leg.from.rollDeg, leg.to.rollDeg) * eased,
    flexDeg: between(leg.from.flexDeg, leg.to.flexDeg),
  });
}

const cmFromIncisors = (manifest: EusCaseManifest, sMm: number) =>
  `≈ ${insertionDepthCm(sMm, manifest.path.incisorOffsetMm).toFixed(0)} cm from the incisors`;

/** Shaft rotation as the rotation control shows it. */
export function shaftRotationText(rollDeg: number) {
  const degrees = Math.round(rollDeg);
  if (degrees === 0) return '0°';
  return `${Math.abs(degrees)}° ${degrees > 0 ? 'clockwise' : 'counterclockwise'}`;
}

const tipAngleText = (flexDeg: number) => {
  const degrees = Math.round(flexDeg);
  if (degrees === 0) return 'neutral';
  return `${Math.abs(degrees)}° ${degrees > 0 ? 'up' : 'down'}`;
};

/** What the lab says while a leg runs. */
export function demoLegText(manifest: EusCaseManifest, leg: DemoLeg) {
  if (leg.move === 'advance') return `Advancing to ${cmFromIncisors(manifest, leg.to.sMm)}`;
  if (leg.move === 'withdraw') return `Withdrawing to ${cmFromIncisors(manifest, leg.to.sMm)}`;
  if (leg.move === 'rotate') return `Rotating the shaft to ${shaftRotationText(leg.to.rollDeg)}`;
  return `Angling the tip to ${tipAngleText(leg.to.flexDeg)}`;
}

/** Where the view lies, for the learner who will now look for it again. */
export function demoViewText(manifest: EusCaseManifest, view: EusScopeState) {
  const tip = Math.round(view.flexDeg) === 0 ? '' : `, tip angled ${tipAngleText(view.flexDeg)}`;
  return `${cmFromIncisors(manifest, view.sMm)}, shaft at ${shaftRotationText(view.rollDeg)}${tip}`;
}
