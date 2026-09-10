import type { SimulatorPreset, Vec3 } from './types';

/**
 * Station Quest — the simulator's optional gamified drill. A quest is a shuffled sequence of
 * station targets; the trainee free-drives the scope and must hold a coupled sector image of the
 * target station to capture it. All state transitions live here as pure functions so the rules
 * (scoring, streaks, hint costs) are unit-testable apart from the React wiring.
 */

export interface QuestTarget {
  presetKey: string;
  stationKey: string;
  /** Raw station id from the preset (formatted for display via formatSimulatorStation). */
  station: string;
  label: string;
  lineIndex: number;
  /** Curated node target position in web mm — where the hint beacon renders. */
  position: Vec3;
}

export interface QuestTargetResult {
  stationKey: string;
  station: string;
  elapsedMs: number;
  usedHint: boolean;
  skipped: boolean;
  points: number;
}

export interface QuestState {
  status: 'active' | 'complete';
  targets: QuestTarget[];
  currentIndex: number;
  score: number;
  streak: number;
  bestStreak: number;
  /** Whether the hint beacon was used on the current target (costs points at capture). */
  usedHint: boolean;
  results: QuestTargetResult[];
}

/** How long the target must stay imaged (coupled + in the sector) to count as captured. */
export const QUEST_HOLD_MS = 1500;
/** Minimum acoustic-coupling quality for the image to count — a veiled sector never captures. */
export const QUEST_CONTACT_QUALITY_MIN = 0.55;
export const QUEST_TARGET_COUNT = 5;
export const QUEST_BASE_POINTS = 1000;
export const QUEST_MIN_TIMED_POINTS = 250;
export const QUEST_TIME_DECAY_PER_SECOND = 12;
export const QUEST_HINT_COST = 250;
export const QUEST_STREAK_BONUS = 100;
export const QUEST_STREAK_BONUS_CAP = 5;
export const QUEST_MIN_TARGET_POINTS = 100;

/**
 * Pick the quest targets: one preset per station (a station with several curated nodes appears
 * once), shuffled with the supplied RNG so tests can seed the order.
 */
export function buildQuestTargets(
  presets: SimulatorPreset[],
  count = QUEST_TARGET_COUNT,
  random: () => number = Math.random,
): QuestTarget[] {
  const byStation = new Map<string, SimulatorPreset>();
  for (const preset of presets) {
    if (!preset.station_key || byStation.has(preset.station_key)) {
      continue;
    }
    byStation.set(preset.station_key, preset);
  }

  const pool = [...byStation.values()];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }

  return pool.slice(0, Math.max(1, Math.min(count, pool.length))).map((preset) => ({
    presetKey: preset.preset_key,
    stationKey: preset.station_key,
    station: preset.station,
    label: preset.label,
    lineIndex: preset.line_index,
    position: preset.target,
  }));
}

export function beginQuest(targets: QuestTarget[]): QuestState {
  return {
    status: 'active',
    targets,
    currentIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    usedHint: false,
    results: [],
  };
}

export function currentQuestTarget(state: QuestState | null): QuestTarget | null {
  if (!state || state.status !== 'active') {
    return null;
  }

  return state.targets[state.currentIndex] ?? null;
}

/**
 * Points for one captured target: a base that decays with time spent (floored so slow finds still
 * pay), minus the hint cost, plus a capped streak bonus. Never below the per-target floor.
 */
export function questTargetPoints({
  elapsedMs,
  streak,
  usedHint,
}: {
  elapsedMs: number;
  /** Consecutive captures BEFORE this one (0 for the first or after a skip). */
  streak: number;
  usedHint: boolean;
}): number {
  const timed = Math.max(
    QUEST_MIN_TIMED_POINTS,
    QUEST_BASE_POINTS - (Math.max(elapsedMs, 0) / 1000) * QUEST_TIME_DECAY_PER_SECOND,
  );
  const hintPenalty = usedHint ? QUEST_HINT_COST : 0;
  const streakBonus = QUEST_STREAK_BONUS * Math.min(Math.max(streak, 0), QUEST_STREAK_BONUS_CAP);

  return Math.max(QUEST_MIN_TARGET_POINTS, Math.round(timed - hintPenalty + streakBonus));
}

function advanceQuest(state: QuestState, result: QuestTargetResult, nextStreak: number): QuestState {
  const nextIndex = state.currentIndex + 1;

  return {
    ...state,
    status: nextIndex >= state.targets.length ? 'complete' : 'active',
    currentIndex: nextIndex,
    score: state.score + result.points,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    usedHint: false,
    results: [...state.results, result],
  };
}

/** The current target was held long enough — bank its points and move on. */
export function completeQuestTarget(state: QuestState, elapsedMs: number): QuestState {
  const target = currentQuestTarget(state);

  if (!target) {
    return state;
  }

  const points = questTargetPoints({ elapsedMs, streak: state.streak, usedHint: state.usedHint });
  const result: QuestTargetResult = {
    stationKey: target.stationKey,
    station: target.station,
    elapsedMs,
    usedHint: state.usedHint,
    skipped: false,
    points,
  };

  return advanceQuest(state, result, state.streak + 1);
}

/** Skipping pays nothing and breaks the streak, but the quest keeps moving. */
export function skipQuestTarget(state: QuestState, elapsedMs: number): QuestState {
  const target = currentQuestTarget(state);

  if (!target) {
    return state;
  }

  const result: QuestTargetResult = {
    stationKey: target.stationKey,
    station: target.station,
    elapsedMs,
    usedHint: state.usedHint,
    skipped: true,
    points: 0,
  };

  return advanceQuest(state, result, 0);
}

export function markQuestHintUsed(state: QuestState): QuestState {
  if (state.status !== 'active' || state.usedHint) {
    return state;
  }

  return { ...state, usedHint: true };
}

/**
 * Whether the live sector currently images the quest target: free drive only (a station snap is
 * a teleport, not a find), the transducer must be acoustically coupled, and the target station's
 * geometry must intersect the sector plane.
 */
export function questTargetImaged({
  contactQuality,
  intersectedStructureIds,
  stationKey,
  stationSnapActive,
}: {
  contactQuality: number;
  intersectedStructureIds: Set<string>;
  stationKey: string;
  stationSnapActive: boolean;
}): boolean {
  return (
    !stationSnapActive &&
    contactQuality >= QUEST_CONTACT_QUALITY_MIN &&
    intersectedStructureIds.has(stationKey)
  );
}

/** Star rating for the summary card, from average points per target. */
export function questStars(score: number, targetCount: number): 1 | 2 | 3 {
  const perTarget = targetCount > 0 ? score / targetCount : 0;

  if (perTarget >= 850) {
    return 3;
  }

  return perTarget >= 550 ? 2 : 1;
}

const QUEST_BEST_STORAGE_KEY = 'socal-ebus-prep:simulator-quest-best:v1';

export function readQuestBestScore(caseId: string): number | null {
  try {
    const raw = window.localStorage.getItem(QUEST_BEST_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : null;
    const value = parsed?.[caseId];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeQuestBestScore(caseId: string, score: number) {
  try {
    const raw = window.localStorage.getItem(QUEST_BEST_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    parsed[caseId] = score;
    window.localStorage.setItem(QUEST_BEST_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Best-score persistence is a convenience; the quest itself never depends on it.
  }
}
