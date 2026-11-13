import { describe, expect, it } from 'vitest';

import {
  IDENTIFY_START,
  identifyAsked,
  identifyDone,
  identifyReducer,
  identifyReport,
  identifyRows,
  type IdentifyState,
} from './guidedIdentify';

const LANDMARKS = ['left_atrium', 'pulmonary_artery', 'station_7'] as const;
const click = (state: IdentifyState, key: string | null, at?: { x: number; y: number }) =>
  identifyReducer(state, { type: 'click', key, at }, LANDMARKS);
const show = (state: IdentifyState) => identifyReducer(state, { type: 'show' }, LANDMARKS);

describe('the mark-the-landmarks task', () => {
  it('asks for the landmarks in order, one at a time', () => {
    let state = IDENTIFY_START;
    expect(identifyAsked(state, LANDMARKS)).toBe('left_atrium');
    state = click(state, 'left_atrium', { x: 0.3, y: 0.7 });
    expect(state.keys).toEqual(['left_atrium']);
    expect(state.points.left_atrium).toEqual({ x: 0.3, y: 0.7 });
    expect(identifyAsked(state, LANDMARKS)).toBe('pulmonary_artery');
    expect(identifyDone(state, LANDMARKS)).toBe(false);
  });

  it('counts any other click as a miss and changes nothing else', () => {
    let state = click(IDENTIFY_START, 'station_7');
    expect(state.keys).toEqual([]);
    expect(state.wrong).toBe(1);
    expect(state.lastMiss).toBe('left_atrium');
    // A later landmark clicked early is a miss too, and so is a click on nothing.
    state = click(state, 'pulmonary_artery');
    state = click(state, null);
    expect(state.wrong).toBe(3);
    expect(state.keys).toEqual([]);
    expect(identifyAsked(state, LANDMARKS)).toBe('left_atrium');
  });

  it('forgets the miss once the landmark is marked', () => {
    let state = click(IDENTIFY_START, null);
    expect(state.lastMiss).toBe('left_atrium');
    state = click(state, 'left_atrium');
    expect(state.lastMiss).toBeNull();
    expect(state.wrong).toBe(1);
  });

  it('lists a landmark the learner asked to be shown as shown, never as marked', () => {
    let state = click(IDENTIFY_START, null);
    state = show(state);
    expect(state.shown).toEqual(['left_atrium']);
    expect(state.keys).toEqual([]);
    expect(state.lastMiss).toBeNull();
    expect(identifyAsked(state, LANDMARKS)).toBe('pulmonary_artery');
    // Clicking it afterwards cannot turn it into a marked one: it is no longer asked for.
    state = click(state, 'left_atrium');
    expect(state.keys).toEqual([]);
    expect(state.shown).toEqual(['left_atrium']);
    expect(state.wrong).toBe(2);
  });

  it('is done when every landmark is marked or shown, and stays as it is afterwards', () => {
    let state = click(IDENTIFY_START, 'left_atrium');
    state = show(state);
    expect(identifyDone(state, LANDMARKS)).toBe(false);
    state = click(state, 'station_7');
    expect(identifyDone(state, LANDMARKS)).toBe(true);
    expect(identifyAsked(state, LANDMARKS)).toBeNull();
    expect(click(state, 'aorta')).toBe(state);
    expect(click(state, 'station_7')).toBe(state);
    expect(show(state)).toBe(state);
    expect(identifyReport(state)).toEqual({
      keys: ['left_atrium', 'station_7'],
      shown: ['pulmonary_artery'],
      wrong: 0,
    });
  });

  it('gives each landmark its number and its state', () => {
    let state = click(IDENTIFY_START, 'left_atrium');
    state = show(state);
    expect(identifyRows(state, LANDMARKS)).toEqual([
      { key: 'left_atrium', number: 1, state: 'done' },
      { key: 'pulmonary_artery', number: 2, state: 'shown' },
      { key: 'station_7', number: 3, state: 'current' },
    ]);
    expect(identifyRows(IDENTIFY_START, LANDMARKS).map((row) => row.state)).toEqual([
      'current',
      'waiting',
      'waiting',
    ]);
  });

  it('starts over on reset', () => {
    const state = show(click(IDENTIFY_START, 'left_atrium', { x: 0.1, y: 0.2 }));
    expect(identifyReducer(state, { type: 'reset' }, LANDMARKS)).toEqual(IDENTIFY_START);
  });

  it('a task with nothing to ask for is never done and takes no clicks', () => {
    expect(identifyDone(IDENTIFY_START, [])).toBe(false);
    expect(identifyReducer(IDENTIFY_START, { type: 'click', key: 'aorta' }, [])).toBe(
      IDENTIFY_START,
    );
  });
});
