import { describe, expect, it } from 'vitest';

import { tnmCases, tnmReferenceCards, tnmStationRules } from '@/content/tnmStaging';
import { getStations } from '@/content/stations';
import {
  deriveNDescriptor,
  deriveTDescriptor,
  getAdjacentStageComparisons,
  getInitialTBuilderState,
  scoreTnmCase,
  stageTnm,
} from '@/features/tnm-staging/logic';

describe('TNM-9 staging logic', () => {
  it('looks up 9th-edition N2a and N2b stage groups', () => {
    expect(stageTnm({ t: 'T1c', n: 'N2a', m: 'M0' }).stage).toBe('IIB');
    expect(stageTnm({ t: 'T2b', n: 'N2b', m: 'M0' }).stage).toBe('IIIB');
    expect(stageTnm({ t: 'T3', n: 'N2a', m: 'M0' }).stage).toBe('IIIA');
  });

  it('lets metastatic categories override the T/N matrix', () => {
    expect(stageTnm({ t: 'T1a', n: 'N0', m: 'M1a' }).stage).toBe('IVA');
    expect(stageTnm({ t: 'T4', n: 'N3', m: 'M1c1' }).stage).toBe('IVB');
    expect(stageTnm({ t: 'T4', n: 'N3', m: 'M1c2' }).stage).toBe('IVB');
  });

  it('derives T from the highest applicable size, invasion, or separate-nodule rule', () => {
    expect(deriveTDescriptor({ ...getInitialTBuilderState(), sizeCm: 2.4 }).t).toBe('T1c');
    expect(
      deriveTDescriptor({
        ...getInitialTBuilderState(),
        sizeCm: 1.8,
        hasAtelectasisOrPneumonitis: true,
      }).t,
    ).toBe('T2a');
    expect(
      deriveTDescriptor({
        ...getInitialTBuilderState(),
        sizeCm: 4.8,
        hasAtelectasisOrPneumonitis: true,
      }).t,
    ).toBe('T2b');
    expect(
      deriveTDescriptor({
        ...getInitialTBuilderState(),
        sizeCm: 2.2,
        separateNodule: 'different-ipsilateral-lobe',
      }).t,
    ).toBe('T4');
  });

  it('flags contralateral pulmonary nodules as M1a guidance instead of a T upgrade', () => {
    const result = deriveTDescriptor({
      ...getInitialTBuilderState(),
      sizeCm: 2.2,
      separateNodule: 'contralateral-lobe',
    });

    expect(result.t).toBe('T1c');
    expect(result.suggestedM).toBe('M1a');
  });

  it('derives N2a, N2b, N3, and systematic staging reminders from station status', () => {
    expect(
      deriveNDescriptor({
        primarySide: 'right',
        stationStatuses: { '4R': 'positive', '4L': 'sampled-negative', '7': 'sampled-negative' },
      }).n,
    ).toBe('N2a');

    expect(
      deriveNDescriptor({
        primarySide: 'right',
        stationStatuses: { '4R': 'positive', '7': 'positive', '4L': 'sampled-negative' },
      }).n,
    ).toBe('N2b');

    expect(
      deriveNDescriptor({
        primarySide: 'right',
        stationStatuses: { '4L': 'positive', '4R': 'sampled-negative', '7': 'sampled-negative' },
      }).n,
    ).toBe('N3');

    expect(
      deriveNDescriptor({
        primarySide: 'left',
        stationStatuses: { '4L': 'sampled-negative' },
      }).missingSystematicStations,
    ).toEqual(['4R', '7']);
  });

  it('surfaces adjacent stage group comparisons', () => {
    const comparisons = getAdjacentStageComparisons({ t: 'T2b', n: 'N2a', m: 'M0' });

    expect(comparisons.some((comparison) => comparison.label === 'If N were N2b' && comparison.stage === 'IIIB')).toBe(true);
  });

  it('scores case answers against expected TNM and derived stage', () => {
    const tnmCase = tnmCases.find((entry) => entry.id === 'tnm-case-04-multistation-n2');

    expect(tnmCase).toBeDefined();

    const score = scoreTnmCase(tnmCase!, { t: 'T2b', n: 'N2b', m: 'M0' });

    expect(score.correct).toBe(true);
    expect(score.selectedStage).toBe('IIIB');
  });
});

describe('TNM content contracts', () => {
  it('keeps all case answer keys aligned with the stage matrix', () => {
    for (const tnmCase of tnmCases) {
      expect(stageTnm(tnmCase.expected).stage, tnmCase.title).toBe(tnmCase.expected.stage);
    }
  });

  it('includes change notes on every reference card', () => {
    for (const card of tnmReferenceCards) {
      expect(card.changedFrom8th.trim().length, card.title).toBeGreaterThan(0);
    }
  });

  it('references only known station ids or declared external nodal groups', () => {
    const knownStations = new Set(getStations().map((station) => station.id));

    for (const rule of tnmStationRules) {
      expect(rule.external || knownStations.has(rule.stationId), rule.stationId).toBe(true);
    }
  });
});
