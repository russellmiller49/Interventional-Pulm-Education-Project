import knobologyData from '../../../../content/modules/knobology.json';

import { getKnobologyMedia } from '@/content/media';
import { getQuizQuestions } from '@/content/quiz';
import type { KnobologyControlId, KnobologyModuleContent } from '@/content/types';

export const knobologyContent = knobologyData as KnobologyModuleContent;

export const knobologyControlMeta: Record<
  KnobologyControlId,
  {
    icon: string;
    shortLabel: string;
  }
> = {
  depth: { icon: '↕', shortLabel: 'Depth' },
  gain: { icon: '☼', shortLabel: 'Gain' },
  contrast: { icon: '◐', shortLabel: 'Contrast' },
  'color-doppler': { icon: '◉', shortLabel: 'Doppler' },
  calipers: { icon: '⌟⌞', shortLabel: 'Calipers' },
  freeze: { icon: '⏸', shortLabel: 'Freeze' },
  save: { icon: '⬒', shortLabel: 'Save' },
};

export const knobologyReferenceCards = knobologyContent.quickReferenceCards.map((card) => ({
  ...card,
  media: getKnobologyMedia(card.id),
}));

export function getKnobologyQuizQuestions() {
  const questionIds = new Set(knobologyContent.quizQuestionIds);
  return getQuizQuestions('knobology').filter((question) => questionIds.has(question.id));
}
