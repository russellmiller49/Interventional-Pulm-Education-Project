import { describe, expect, it } from 'vitest';

import {
  beginQuest,
  buildQuestTargets,
  completeQuestTarget,
  currentQuestTarget,
  markQuestHintUsed,
  QUEST_BASE_POINTS,
  QUEST_HINT_COST,
  QUEST_MIN_TARGET_POINTS,
  QUEST_MIN_TIMED_POINTS,
  QUEST_STREAK_BONUS,
  QUEST_STREAK_BONUS_CAP,
  questStars,
  questTargetImaged,
  questTargetPoints,
  skipQuestTarget,
} from './questMode';
import type { SimulatorPreset } from './types';

function presetFixture(overrides: Partial<SimulatorPreset>): SimulatorPreset {
  return {
    approach: 'default',
    centerline_s_mm: 100,
    contact: [0, 0, 0],
    contact_to_target_distance_mm: 10,
    label: 'Station',
    line_index: 1,
    node: 'a',
    preset_id: 'preset',
    preset_key: 'preset::default',
    station: '4L',
    station_key: 'station_4l',
    target: [1, 2, 3],
    target_lps: [0, 0, 0],
    vessel_overlays: [],
    ...overrides,
  };
}

const PRESETS: SimulatorPreset[] = [
  presetFixture({ preset_key: 'p1', station: '4L', station_key: 'station_4l', line_index: 1 }),
  presetFixture({ preset_key: 'p2', station: '4L', station_key: 'station_4l', node: 'b' }),
  presetFixture({ preset_key: 'p3', station: '7', station_key: 'station_7', line_index: 2 }),
  presetFixture({ preset_key: 'p4', station: '10R', station_key: 'station_10r', line_index: 3 }),
  presetFixture({ preset_key: 'p5', station: '11L', station_key: 'station_11l', line_index: 4 }),
];

describe('station quest targets', () => {
  it('dedupes presets by station and caps at the requested count', () => {
    const targets = buildQuestTargets(PRESETS, 3, () => 0);
    expect(targets).toHaveLength(3);
    expect(new Set(targets.map((target) => target.stationKey)).size).toBe(3);
  });

  it('uses at most one preset per station even when count exceeds the pool', () => {
    const targets = buildQuestTargets(PRESETS, 10, () => 0);
    expect(targets).toHaveLength(4);
  });

  it('shuffles with the provided rng and skips presets without a station key', () => {
    const noStation = presetFixture({ preset_key: 'p6', station_key: '' });
    const a = buildQuestTargets([...PRESETS, noStation], 4, () => 0);
    const b = buildQuestTargets([...PRESETS, noStation], 4, () => 0.99);
    expect(a.map((target) => target.stationKey)).not.toEqual(b.map((target) => target.stationKey));
    expect([...a, ...b].every((target) => target.stationKey.length > 0)).toBe(true);
  });

  it('carries the preset target position for the hint beacon', () => {
    const targets = buildQuestTargets(PRESETS, 1, () => 0);
    expect(targets[0].position).toEqual([1, 2, 3]);
  });
});

describe('station quest scoring', () => {
  it('decays with time but never below the timed floor', () => {
    const fast = questTargetPoints({ elapsedMs: 0, streak: 0, usedHint: false });
    const slow = questTargetPoints({ elapsedMs: 30_000, streak: 0, usedHint: false });
    const glacial = questTargetPoints({ elapsedMs: 30 * 60_000, streak: 0, usedHint: false });
    expect(fast).toBe(QUEST_BASE_POINTS);
    expect(slow).toBeLessThan(fast);
    expect(glacial).toBe(QUEST_MIN_TIMED_POINTS);
  });

  it('charges the hint and pays the capped streak bonus', () => {
    const base = questTargetPoints({ elapsedMs: 1000, streak: 0, usedHint: false });
    expect(questTargetPoints({ elapsedMs: 1000, streak: 0, usedHint: true })).toBe(base - QUEST_HINT_COST);
    expect(questTargetPoints({ elapsedMs: 1000, streak: 2, usedHint: false })).toBe(base + 2 * QUEST_STREAK_BONUS);
    expect(questTargetPoints({ elapsedMs: 1000, streak: 40, usedHint: false })).toBe(
      base + QUEST_STREAK_BONUS_CAP * QUEST_STREAK_BONUS,
    );
  });

  it('never pays less than the per-target floor', () => {
    expect(
      questTargetPoints({ elapsedMs: 60 * 60_000, streak: 0, usedHint: true }),
    ).toBe(QUEST_MIN_TARGET_POINTS);
  });
});

describe('station quest state machine', () => {
  const targets = buildQuestTargets(PRESETS, 3, () => 0);

  it('advances through captures, builds streaks, and completes', () => {
    let state = beginQuest(targets);
    expect(state.status).toBe('active');
    expect(currentQuestTarget(state)?.stationKey).toBe(targets[0].stationKey);

    state = completeQuestTarget(state, 2000);
    state = completeQuestTarget(state, 2000);
    expect(state.streak).toBe(2);
    expect(state.bestStreak).toBe(2);
    expect(state.status).toBe('active');

    state = completeQuestTarget(state, 2000);
    expect(state.status).toBe('complete');
    expect(state.results).toHaveLength(3);
    expect(state.score).toBe(state.results.reduce((sum, result) => sum + result.points, 0));
    expect(currentQuestTarget(state)).toBeNull();
  });

  it('skip pays nothing and breaks the streak but keeps the best streak', () => {
    let state = beginQuest(targets);
    state = completeQuestTarget(state, 1000);
    state = skipQuestTarget(state, 5000);
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(1);
    expect(state.results[1]).toMatchObject({ points: 0, skipped: true });
  });

  it('hint marks the current target once and resets on advance', () => {
    let state = beginQuest(targets);
    state = markQuestHintUsed(state);
    expect(state.usedHint).toBe(true);
    expect(markQuestHintUsed(state)).toBe(state);
    state = completeQuestTarget(state, 1000);
    expect(state.usedHint).toBe(false);
    expect(state.results[0].usedHint).toBe(true);
  });
});

describe('station quest detection gate', () => {
  const base = {
    contactQuality: 1,
    intersectedStructureIds: new Set(['station_4l']),
    stationKey: 'station_4l',
    stationSnapActive: false,
  };

  it('requires the target in the sector, coupling, and free drive', () => {
    expect(questTargetImaged(base)).toBe(true);
    expect(questTargetImaged({ ...base, intersectedStructureIds: new Set(['station_7']) })).toBe(false);
    expect(questTargetImaged({ ...base, contactQuality: 0.2 })).toBe(false);
    expect(questTargetImaged({ ...base, stationSnapActive: true })).toBe(false);
  });
});

describe('station quest stars', () => {
  it('rates by average points per target', () => {
    expect(questStars(5 * 900, 5)).toBe(3);
    expect(questStars(5 * 600, 5)).toBe(2);
    expect(questStars(5 * 300, 5)).toBe(1);
    expect(questStars(0, 0)).toBe(1);
  });
});
