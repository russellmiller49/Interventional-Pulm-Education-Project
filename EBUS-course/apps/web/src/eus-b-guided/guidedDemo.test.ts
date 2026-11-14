import { describe, expect, it } from 'vitest';

import type { EusScopeState } from '@/features/eus-b-simulator/types';
import {
  EUSB_HOLD_AREA_FRACTION,
  EUSB_LAB_IDS,
  eusbLab,
} from '../../../../../src/lib/eus-b-guided-contract';
import { frameAt, manifest, path, volume } from './caseFixture';
import {
  demoLegs,
  demoLegText,
  demoPoseAt,
  demoViewText,
  shaftRotationText,
  shortestTurnDeg,
} from './guidedDemo';
import { resolveStart, resolveTarget } from './guidedViews';
import { blockingLabelIds, referenceVisibleAreaMm2, targetAreaRatio } from './visibleArea';

const at = (sMm: number, rollDeg = 0, flexDeg = 0): EusScopeState => ({ sMm, rollDeg, flexDeg });
const shownLabs = EUSB_LAB_IDS.filter((id) => eusbLab(id).help?.includes('show'));

describe('the turn between two shaft rotations', () => {
  it('takes the short way round, clockwise positive', () => {
    expect(shortestTurnDeg(-39, 45)).toBe(84);
    expect(shortestTurnDeg(45, -39)).toBe(-84);
    expect(shortestTurnDeg(170, -170)).toBe(20);
    expect(shortestTurnDeg(-170, 170)).toBe(-20);
    expect(shortestTurnDeg(10, 10)).toBe(0);
    expect(shortestTurnDeg(0, 180)).toBe(180);
  });
});

describe('the movements of a demonstration', () => {
  it('travels first, then rotates, then angles the tip, one at a time', () => {
    const legs = demoLegs(path, at(170, -39), at(120, 27, 10));
    expect(legs.map((leg) => leg.move)).toEqual(['withdraw', 'rotate', 'angle']);
    expect(legs[0].from).toEqual(at(170, -39));
    expect(legs[0].to).toEqual(at(120, -39));
    expect(legs[1].to).toEqual(at(120, 27));
    expect(legs[2].to).toEqual(at(120, 27, 10));
    // Each leg starts where the one before it ended.
    for (let index = 1; index < legs.length; index += 1)
      expect(legs[index].from).toEqual(legs[index - 1].to);
  });

  it('leaves out a movement that is not needed', () => {
    expect(demoLegs(path, at(100, 20), at(160, 20)).map((leg) => leg.move)).toEqual(['advance']);
    expect(demoLegs(path, at(100, 20), at(100, -60)).map((leg) => leg.move)).toEqual(['rotate']);
    expect(demoLegs(path, at(100, 20), at(100, 20))).toEqual([]);
  });

  it('ends exactly on the view, even when the last difference is too small for a leg', () => {
    const legs = demoLegs(path, at(100, 20), at(160, 20.25));
    expect(legs.map((leg) => leg.move)).toEqual(['advance']);
    expect(legs[legs.length - 1].to).toEqual(at(160, 20.25));
  });

  it('starts and ends each leg on its end points and stays between them', () => {
    const [leg] = demoLegs(path, at(100, 20), at(160, 20));
    expect(demoPoseAt(path, leg, 0)).toEqual(leg.from);
    expect(demoPoseAt(path, leg, -1)).toEqual(leg.from);
    expect(demoPoseAt(path, leg, 1)).toEqual(leg.to);
    expect(demoPoseAt(path, leg, 3)).toEqual(leg.to);
    let last = leg.from.sMm;
    for (let step = 1; step < 10; step += 1) {
      const sMm = demoPoseAt(path, leg, step / 10).sMm;
      expect(sMm).toBeGreaterThan(last);
      expect(sMm).toBeLessThan(leg.to.sMm);
      last = sMm;
    }
  });

  it('rotates the short way through 180°', () => {
    const [leg] = demoLegs(path, at(100, 170), at(100, -170));
    const middle = demoPoseAt(path, leg, 0.5).rollDeg;
    expect(Math.abs(middle)).toBeCloseTo(180, 6);
  });

  it('says what it is doing in the words of the controls', () => {
    const legs = demoLegs(path, at(170, -39), at(259, 45, -5));
    expect(demoLegText(manifest, legs[0])).toMatch(/^Advancing to ≈ \d+ cm from the incisors$/);
    expect(demoLegText(manifest, legs[1])).toBe('Rotating the shaft to 45° clockwise');
    expect(demoLegText(manifest, legs[2])).toBe('Angling the tip to 5° down');
    const back = demoLegs(path, at(259, 45), at(170, 0));
    expect(demoLegText(manifest, back[0])).toMatch(/^Withdrawing to ≈ \d+ cm from the incisors$/);
    expect(demoLegText(manifest, back[1])).toBe('Rotating the shaft to 0°');
    expect(shaftRotationText(-39.4)).toBe('39° counterclockwise');
    expect(demoViewText(manifest, at(259, 45))).toMatch(
      /^≈ \d+ cm from the incisors, shaft at 45° clockwise$/,
    );
    expect(demoViewText(manifest, at(259, 45, 10))).toMatch(/, tip angled 10° up$/);
  });
});

describe('every task that offers to show its view, on the shipped case', () => {
  const blocking = blockingLabelIds(volume);

  it('has at least one such task', () => {
    expect(shownLabs.length).toBeGreaterThan(0);
  });

  it.each(shownLabs)('%s is driven from its start to a view that shows the target', (labId) => {
    const lab = eusbLab(labId);
    const start = resolveStart(manifest, path, lab.start)!;
    const target = resolveTarget(manifest, volume, path, lab.target!)!;
    const legs = demoLegs(path, start, target.pose);
    expect(legs.length).toBeGreaterThan(0);
    expect(legs[legs.length - 1].to).toEqual(target.pose);
    const reference = referenceVisibleAreaMm2(
      volume,
      path,
      manifest,
      target.pose,
      target.labelId,
      blocking,
    );
    const shown = targetAreaRatio(
      frameAt(demoPoseAt(path, legs[legs.length - 1], 1)),
      target.labelId,
      reference,
      blocking,
    );
    expect(shown).toBeGreaterThanOrEqual(EUSB_HOLD_AREA_FRACTION);
  });

  it.each(shownLabs)('%s offers only movements the scope can make from anywhere', (labId) => {
    const lab = eusbLab(labId);
    const target = resolveTarget(manifest, volume, path, lab.target!)!;
    // From either end of the path and the far side of the rotation.
    for (const from of [at(0, 179), at(path.totalLengthMm, -179), target.pose]) {
      const legs = demoLegs(path, from, target.pose);
      const end = legs.length ? legs[legs.length - 1].to : from;
      expect(end).toEqual(target.pose);
    }
  });
});
