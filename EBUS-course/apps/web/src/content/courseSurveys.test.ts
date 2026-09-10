import { describe, expect, it } from 'vitest';

import {
  assignUniqueRankingResponse,
  getChoiceFreeTextResponseKey,
  getCourseSurveyResponseRows,
  getRankingResponseKey,
  isCourseSurveyComplete,
  preCourseSurveyDefinition,
} from '@/content/courseSurveys';

describe('course survey content helpers', () => {
  it('requires conditional free text when Other is selected', () => {
    const pgyItem = preCourseSurveyDefinition.items.find((item) => item.id === 'pgy-level');

    if (!pgyItem || pgyItem.type !== 'single-choice') {
      throw new Error('Expected PGY level item.');
    }

    const otherTextKey = getChoiceFreeTextResponseKey(pgyItem, 'other');

    expect(isCourseSurveyComplete([pgyItem], { 'pgy-level': 'other' })).toBe(false);
    expect(isCourseSurveyComplete([pgyItem], { 'pgy-level': 'other', [otherTextKey]: 'PGY-7' })).toBe(true);
  });

  it('requires unique ranks for ranking questions', () => {
    const rankItem = preCourseSurveyDefinition.items.find((item) => item.id === 'primary-course-goals');

    if (!rankItem || rankItem.type !== 'ranking') {
      throw new Error('Expected primary course goals ranking item.');
    }

    const duplicateRanks = Object.fromEntries(
      rankItem.options.map((option, index) => [getRankingResponseKey(rankItem, option.id), index === 0 ? '1' : '2']),
    );
    const uniqueRanks = Object.fromEntries(
      rankItem.options.map((option, index) => [getRankingResponseKey(rankItem, option.id), String(index + 1)]),
    );

    expect(isCourseSurveyComplete([rankItem], duplicateRanks)).toBe(false);
    expect(isCourseSurveyComplete([rankItem], uniqueRanks)).toBe(true);
  });

  it('shifts ranking responses so each rank stays unique', () => {
    const rankItem = preCourseSurveyDefinition.items.find((item) => item.id === 'primary-course-goals');

    if (!rankItem || rankItem.type !== 'ranking') {
      throw new Error('Expected primary course goals ranking item.');
    }

    const responses = Object.fromEntries(
      rankItem.options.map((option, index) => [getRankingResponseKey(rankItem, option.id), String(index + 1)]),
    );
    const nextResponses = assignUniqueRankingResponse(rankItem, responses, 'advanced-tools', '1');

    expect(nextResponses).toMatchObject({
      [getRankingResponseKey(rankItem, 'advanced-tools')]: '1',
      [getRankingResponseKey(rankItem, 'exam-scope-handling')]: '2',
      [getRankingResponseKey(rankItem, 'lymph-node-identification')]: '3',
      [getRankingResponseKey(rankItem, 'basic-sampling-technique')]: '4',
      [getRankingResponseKey(rankItem, 'baseline-board-prep')]: '5',
    });
    expect(isCourseSurveyComplete([rankItem], nextResponses)).toBe(true);
  });

  it('preserves blank ranking rows when only a partial ranking has to shift', () => {
    const rankItem = preCourseSurveyDefinition.items.find((item) => item.id === 'primary-course-goals');

    if (!rankItem || rankItem.type !== 'ranking') {
      throw new Error('Expected primary course goals ranking item.');
    }

    const nextResponses = assignUniqueRankingResponse(
      rankItem,
      {
        [getRankingResponseKey(rankItem, 'exam-scope-handling')]: '1',
      },
      'lymph-node-identification',
      '1',
    );

    expect(nextResponses).toEqual({
      [getRankingResponseKey(rankItem, 'exam-scope-handling')]: '2',
      [getRankingResponseKey(rankItem, 'lymph-node-identification')]: '1',
    });
  });

  it('maps stored response ids back to dashboard-friendly labels', () => {
    const rows = getCourseSurveyResponseRows(preCourseSurveyDefinition, {
      'pgy-level': 'pgy-5',
      'standard-bronchoscopy-count': 'greater-than-100',
    });

    expect(rows).toEqual([
      {
        prompt: 'Please list your PGY level.',
        questionId: 'pgy-level',
        response: '5',
      },
      {
        prompt:
          'Approximately how many standard bronchoscopies (non-EBUS or navigational) have you performed as the primary operator?',
        questionId: 'standard-bronchoscopy-count',
        response: '>100',
      },
    ]);
  });
});
