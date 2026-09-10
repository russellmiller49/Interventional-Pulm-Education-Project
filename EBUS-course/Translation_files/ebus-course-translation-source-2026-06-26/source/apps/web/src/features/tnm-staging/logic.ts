import { tnmCases, tnmStageMatrix, tnmStationRules, tnmTBuilderContent } from '@/content/tnmStaging';
import type {
  TnmBuilderState,
  TnmCaseContent,
  TnmMCategory,
  TnmPrimarySide,
  TnmSelection,
  TnmSeparateNoduleRuleId,
  TnmStageableNCategory,
  TnmStageableTCategory,
  TnmStageGroup,
  TnmStationRule,
  TnmStationStatusValue,
  TnmTBuilderInvasionRule,
} from '@/content/types';

const T_RANK: Record<TnmStageableTCategory, number> = {
  T1a: 1,
  T1b: 2,
  T1c: 3,
  T2a: 4,
  T2b: 5,
  T3: 6,
  T4: 7,
};

const N_ORDER: TnmStageableNCategory[] = ['N0', 'N1', 'N2a', 'N2b', 'N3'];
const M_ORDER: TnmMCategory[] = ['M0', 'M1a', 'M1b', 'M1c1', 'M1c2'];

export interface StageTnmResult {
  selection: TnmSelection;
  stage: TnmStageGroup;
  explanation: string;
  driver: string;
}

export interface TDescriptorResult {
  t: TnmStageableTCategory;
  driver: string;
  explanation: string;
  candidates: Array<{
    t: TnmStageableTCategory;
    reason: string;
  }>;
  suggestedM?: TnmMCategory;
}

export interface NDescriptorResult {
  n: TnmStageableNCategory;
  driver: string;
  explanation: string;
  positiveStations: TnmStationRule[];
  n2StationGroups: string[];
  n1StationGroups: string[];
  n3StationGroups: string[];
  assessedStations: string[];
  missingSystematicStations: string[];
}

export interface AdjacentStageComparison {
  axis: 'N' | 'M';
  label: string;
  selection: TnmSelection;
  stage: TnmStageGroup;
  explanation: string;
}

export interface TnmCaseScore {
  correct: boolean;
  correctCount: number;
  totalCount: number;
  percent: number;
  expectedStage: TnmStageGroup;
  selectedStage: TnmStageGroup;
  fields: Record<'t' | 'n' | 'm' | 'stage', boolean>;
  feedback: string;
}

function getStageRow(t: TnmStageableTCategory) {
  return tnmStageMatrix.rows.find((row) => row.t === t);
}

function getCategoryDescriptor<TValue extends string>(
  options: Array<{ id: TValue; descriptor: string }>,
  id: TValue,
) {
  return options.find((option) => option.id === id)?.descriptor ?? id;
}

function compareT(left: TnmStageableTCategory, right: TnmStageableTCategory) {
  return T_RANK[left] - T_RANK[right];
}

function getSizeT(sizeCm: number): TnmStageableTCategory {
  if (sizeCm <= 1) {
    return 'T1a';
  }

  if (sizeCm <= 2) {
    return 'T1b';
  }

  if (sizeCm <= 3) {
    return 'T1c';
  }

  if (sizeCm <= 4) {
    return 'T2a';
  }

  if (sizeCm <= 5) {
    return 'T2b';
  }

  if (sizeCm <= 7) {
    return 'T3';
  }

  return 'T4';
}

function getLocationRule(locationId: TnmBuilderState['locationId']): TnmTBuilderInvasionRule | null {
  if (locationId === 'central') {
    return tnmTBuilderContent.invasionRules.find((rule) => rule.id === 'main-bronchus') ?? null;
  }

  if (locationId === 'pleural') {
    return tnmTBuilderContent.invasionRules.find((rule) => rule.id === 'visceral-pleura') ?? null;
  }

  if (locationId === 'mediastinal') {
    return tnmTBuilderContent.invasionRules.find((rule) => rule.id === 'mediastinum') ?? null;
  }

  if (locationId === 'diaphragmatic') {
    return tnmTBuilderContent.invasionRules.find((rule) => rule.id === 'diaphragm') ?? null;
  }

  return null;
}

function getStationRule(stationId: string) {
  return tnmStationRules.find((rule) => rule.stationId === stationId);
}

function isAssessed(status: TnmStationStatusValue | undefined) {
  return status === 'sampled-negative' || status === 'positive';
}

function isContralateral(rule: TnmStationRule, primarySide: TnmPrimarySide) {
  return rule.side !== 'midline' && rule.side !== 'external' && rule.side !== primarySide;
}

function isIpsilateral(rule: TnmStationRule, primarySide: TnmPrimarySide) {
  return rule.side === primarySide || rule.side === 'midline';
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function stageTnm(selection: TnmSelection): StageTnmResult {
  if (selection.m !== 'M0') {
    const stage = tnmStageMatrix.mStageOverrides[selection.m];

    if (!stage) {
      throw new Error(`No stage override found for ${selection.m}.`);
    }

    return {
      selection,
      stage,
      driver: selection.m,
      explanation: `${selection.m} disease maps to stage ${stage} regardless of T or N category in this teaching matrix.`,
    };
  }

  const row = getStageRow(selection.t);
  const stage = row?.stages[selection.n];

  if (!row || !stage) {
    throw new Error(`No 9th-edition stage group found for ${selection.t}${selection.n}${selection.m}.`);
  }

  const tDescriptor = getCategoryDescriptor(tnmStageMatrix.tCategories, selection.t);
  const nDescriptor = getCategoryDescriptor(tnmStageMatrix.nCategories, selection.n);

  return {
    selection,
    stage,
    driver: `${selection.t}${selection.n}`,
    explanation: `${selection.t} (${tDescriptor}) with ${selection.n} (${nDescriptor}) and M0 maps to stage ${stage}.`,
  };
}

export function deriveTDescriptor(state: TnmBuilderState): TDescriptorResult {
  const normalizedSize = Math.max(0.1, state.sizeCm);
  const candidates: TDescriptorResult['candidates'] = [
    {
      t: getSizeT(normalizedSize),
      reason: `${normalizedSize.toFixed(1)} cm primary tumor size`,
    },
  ];
  const locationRule = getLocationRule(state.locationId);

  if (locationRule) {
    candidates.push({
      t: locationRule.t,
      reason: locationRule.label,
    });
  }

  if (state.hasAtelectasisOrPneumonitis) {
    candidates.push({
      t: 'T2a',
      reason: 'Atelectasis or obstructive pneumonitis extending to the hilar region',
    });
  }

  for (const invasionId of state.invasionIds) {
    const rule = tnmTBuilderContent.invasionRules.find((entry) => entry.id === invasionId);

    if (rule) {
      candidates.push({
        t: rule.t,
        reason: rule.label,
      });
    }
  }

  const noduleRule = tnmTBuilderContent.separateNoduleRules.find((rule) => rule.id === state.separateNodule);
  let suggestedM: TnmMCategory | undefined;

  if (noduleRule?.t) {
    candidates.push({
      t: noduleRule.t,
      reason: noduleRule.label,
    });
  }

  if (noduleRule?.m) {
    suggestedM = noduleRule.m;
  }

  const winning = [...candidates].sort((left, right) => compareT(right.t, left.t))[0] ?? candidates[0];
  const stageDescriptor = getCategoryDescriptor(tnmStageMatrix.tCategories, winning.t);
  const mNote = suggestedM
    ? ` A contralateral pulmonary nodule should be handled as ${suggestedM} in the M selector.`
    : '';

  return {
    t: winning.t,
    driver: winning.reason,
    explanation: `${winning.t} is driven by ${winning.reason}. ${stageDescriptor}.${mNote}`,
    candidates,
    suggestedM,
  };
}

export function deriveNDescriptor({
  primarySide,
  stationStatuses,
}: {
  primarySide: TnmPrimarySide;
  stationStatuses: Record<string, TnmStationStatusValue | undefined>;
}): NDescriptorResult {
  const assessedStations = Object.entries(stationStatuses)
    .filter(([, status]) => isAssessed(status))
    .map(([stationId]) => stationId);
  const positiveStations = Object.entries(stationStatuses)
    .filter(([, status]) => status === 'positive')
    .flatMap(([stationId]) => {
      const rule = getStationRule(stationId);
      return rule ? [rule] : [];
    });
  const n3StationGroups = unique(
    positiveStations
      .filter((rule) => rule.external || isContralateral(rule, primarySide))
      .map((rule) => rule.groupId),
  );
  const n2StationGroups = unique(
    positiveStations
      .filter((rule) => {
        return rule.basin === 'mediastinal' && isIpsilateral(rule, primarySide) && !n3StationGroups.includes(rule.groupId);
      })
      .map((rule) => rule.groupId),
  );
  const n1StationGroups = unique(
    positiveStations
      .filter((rule) => {
        return (
          (rule.basin === 'hilar' || rule.basin === 'intrapulmonary') &&
          isIpsilateral(rule, primarySide) &&
          !n3StationGroups.includes(rule.groupId)
        );
      })
      .map((rule) => rule.groupId),
  );
  const missingSystematicStations = ['4R', '4L', '7'].filter((stationId) => !isAssessed(stationStatuses[stationId]));

  if (n3StationGroups.length > 0) {
    return {
      n: 'N3',
      driver: n3StationGroups.join(', '),
      explanation: `N3 is assigned because ${n3StationGroups.join(', ')} represents contralateral or scalene/supraclavicular nodal disease for a ${primarySide}-sided primary.`,
      positiveStations,
      n2StationGroups,
      n1StationGroups,
      n3StationGroups,
      assessedStations,
      missingSystematicStations,
    };
  }

  if (n2StationGroups.length > 1) {
    return {
      n: 'N2b',
      driver: n2StationGroups.join(', '),
      explanation: `N2b is assigned because more than one ipsilateral mediastinal or subcarinal station is positive: ${n2StationGroups.join(', ')}.`,
      positiveStations,
      n2StationGroups,
      n1StationGroups,
      n3StationGroups,
      assessedStations,
      missingSystematicStations,
    };
  }

  if (n2StationGroups.length === 1) {
    return {
      n: 'N2a',
      driver: n2StationGroups[0] ?? 'single N2 station',
      explanation: `N2a is assigned because a single ipsilateral mediastinal or subcarinal station is positive: ${n2StationGroups[0]}.`,
      positiveStations,
      n2StationGroups,
      n1StationGroups,
      n3StationGroups,
      assessedStations,
      missingSystematicStations,
    };
  }

  if (n1StationGroups.length > 0) {
    return {
      n: 'N1',
      driver: n1StationGroups.join(', '),
      explanation: `N1 is assigned because ipsilateral hilar or intrapulmonary disease is positive: ${n1StationGroups.join(', ')}.`,
      positiveStations,
      n2StationGroups,
      n1StationGroups,
      n3StationGroups,
      assessedStations,
      missingSystematicStations,
    };
  }

  return {
    n: 'N0',
    driver: positiveStations.length === 0 ? 'No positive regional nodes selected' : 'No qualifying positive nodal group',
    explanation:
      assessedStations.length > 0
        ? 'No selected station is positive, so this teaching calculator returns N0.'
        : 'No positive stations are selected. In clinical practice, cN0 depends on adequate imaging and sampling context.',
    positiveStations,
    n2StationGroups,
    n1StationGroups,
    n3StationGroups,
    assessedStations,
    missingSystematicStations,
  };
}

export function getAdjacentStageComparisons(selection: TnmSelection): AdjacentStageComparison[] {
  const comparisons: AdjacentStageComparison[] = [];
  const current = stageTnm(selection);

  for (const n of N_ORDER) {
    if (n === selection.n) {
      continue;
    }

    const candidateSelection = { ...selection, n };
    const candidate = stageTnm(candidateSelection);

    if (candidate.stage !== current.stage) {
      comparisons.push({
        axis: 'N',
        label: `If N were ${n}`,
        selection: candidateSelection,
        stage: candidate.stage,
        explanation: `${candidateSelection.t}${n}${candidateSelection.m} would be stage ${candidate.stage}.`,
      });
    }
  }

  for (const m of M_ORDER) {
    if (m === selection.m) {
      continue;
    }

    const candidateSelection = { ...selection, m };
    const candidate = stageTnm(candidateSelection);

    if (candidate.stage !== current.stage) {
      comparisons.push({
        axis: 'M',
        label: `If M were ${m}`,
        selection: candidateSelection,
        stage: candidate.stage,
        explanation: `${candidateSelection.t}${candidateSelection.n}${m} would be stage ${candidate.stage}.`,
      });
    }
  }

  return comparisons.slice(0, 8);
}

export function scoreTnmCase(tnmCase: TnmCaseContent, answer: TnmSelection): TnmCaseScore {
  const selectedStage = stageTnm(answer).stage;
  const expectedStage = tnmCase.expected.stage;
  const fields = {
    t: answer.t === tnmCase.expected.t,
    n: answer.n === tnmCase.expected.n,
    m: answer.m === tnmCase.expected.m,
    stage: selectedStage === expectedStage,
  };
  const correctCount = Object.values(fields).filter(Boolean).length;
  const totalCount = Object.values(fields).length;

  return {
    correct: correctCount === totalCount,
    correctCount,
    totalCount,
    percent: Math.round((correctCount / totalCount) * 100),
    expectedStage,
    selectedStage,
    fields,
    feedback: tnmCase.feedback,
  };
}

export function getInitialTnmSelection(): TnmSelection {
  return {
    t: 'T1c',
    n: 'N0',
    m: 'M0',
  };
}

export function getInitialTBuilderState(): TnmBuilderState {
  return {
    primarySide: 'right',
    sizeCm: 2.4,
    locationId: 'peripheral',
    invasionIds: [],
    hasAtelectasisOrPneumonitis: false,
    separateNodule: 'none',
  };
}

export function getInitialStationStatuses(): Record<string, TnmStationStatusValue> {
  return Object.fromEntries(tnmStationRules.map((rule) => [rule.stationId, 'unassessed' as TnmStationStatusValue]));
}

export function getNextStationStatus(current: TnmStationStatusValue): TnmStationStatusValue {
  if (current === 'unassessed') {
    return 'sampled-negative';
  }

  if (current === 'sampled-negative') {
    return 'positive';
  }

  return 'unassessed';
}

export function formatSeparateNoduleId(value: TnmSeparateNoduleRuleId) {
  return value.replace(/-/g, ' ');
}

export function getTnmCaseById(caseId: string) {
  return tnmCases.find((tnmCase) => tnmCase.id === caseId);
}
