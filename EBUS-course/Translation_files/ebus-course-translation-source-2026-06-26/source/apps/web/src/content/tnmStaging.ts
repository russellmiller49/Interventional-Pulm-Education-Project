import tBuilderData from '../../../../content/tnm-staging/t-builder-rules.json';
import casesData from '../../../../content/tnm-staging/cases.json';
import referenceData from '../../../../content/tnm-staging/reference.json';
import stageMatrixData from '../../../../content/tnm-staging/stage-matrix.json';
import stationRulesData from '../../../../content/tnm-staging/station-rules.json';

import type {
  TnmCaseContent,
  TnmReferenceCard,
  TnmStageMatrixContent,
  TnmStationRule,
  TnmTBuilderContent,
} from '@/content/types';

export const tnmStageMatrix = stageMatrixData as TnmStageMatrixContent;
export const tnmReferenceCards = referenceData as TnmReferenceCard[];
export const tnmTBuilderContent = tBuilderData as TnmTBuilderContent;
export const tnmStationRules = stationRulesData as TnmStationRule[];
export const tnmCases = casesData as TnmCaseContent[];

export function getTnmReferenceCards(category?: TnmReferenceCard['category']) {
  return category ? tnmReferenceCards.filter((card) => card.category === category) : tnmReferenceCards;
}
