import { describe, expect, it } from 'vitest';

import runtimeData from '../../../../../content/cases/case_001.runtime.json';

import { resolveCaseOverlay } from './useCaseOverlay';

import type { RuntimeCaseManifest } from '../../../../../features/case3d/types';

const manifest = runtimeData as unknown as RuntimeCaseManifest;

describe('resolveCaseOverlay', () => {
  it('keeps target-linked nodes visible by default', () => {
    const overlay = resolveCaseOverlay(
      manifest,
      {
        allAnatomy: false,
        airway: true,
        vessels: true,
        nodes: true,
      },
      'node_4R_1',
      [],
    );

    expect(overlay.selectedTarget?.id).toBe('node_4R_1');
    expect([...overlay.selectedSegmentIds]).toEqual([
      '2.25.121062370142623028444183689976439892722',
    ]);
    expect(overlay.visibleSegments.some((segment) => segment.id === '2.25.121062370142623028444183689976439892722')).toBe(true);
  });

  it('maps the "other" group through the vessels master toggle', () => {
    const vesselsOffOverlay = resolveCaseOverlay(
      manifest,
      {
        allAnatomy: false,
        airway: true,
        vessels: false,
        nodes: true,
      },
      'node_4R_1',
      [],
    );
    const vesselsOnOverlay = resolveCaseOverlay(
      manifest,
      {
        allAnatomy: false,
        airway: true,
        vessels: true,
        nodes: true,
      },
      'node_4R_1',
      [],
    );

    expect(vesselsOffOverlay.visibleSegments.some((segment) => segment.id === 'brachiocephalic_trunk')).toBe(false);
    expect(vesselsOnOverlay.visibleSegments.some((segment) => segment.id === 'brachiocephalic_trunk')).toBe(true);
  });

  it('removes hidden segments from both the visible set and selected target set', () => {
    const overlay = resolveCaseOverlay(
      manifest,
      {
        allAnatomy: false,
        airway: true,
        vessels: true,
        nodes: true,
      },
      'node_4R_1',
      ['2.25.121062370142623028444183689976439892722'],
    );

    expect(overlay.selectedSegmentIds.size).toBe(0);
    expect(overlay.visibleSegments.some((segment) => segment.id === '2.25.121062370142623028444183689976439892722')).toBe(false);
  });
});
