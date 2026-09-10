export type CourseSurveyId = 'pre-course-2026' | 'post-course-2026';
export type CourseSurveyResponses = Record<string, string>;

interface CourseSurveyBaseItem {
  id: string;
  label: string;
}

export interface CourseSurveyChoiceOption {
  id: string;
  label: string;
  freeText?: {
    label: string;
    placeholder?: string;
    required?: boolean;
  };
}

export interface CourseSurveySingleChoiceItem extends CourseSurveyBaseItem {
  type: 'single-choice';
  options: CourseSurveyChoiceOption[];
}

export interface CourseSurveyScaleItem extends CourseSurveyBaseItem {
  type: 'scale';
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

export interface CourseSurveyTextItem extends CourseSurveyBaseItem {
  type: 'text';
  optional?: boolean;
  placeholder?: string;
  rows?: number;
}

export interface CourseSurveyRankingOption {
  id: string;
  label: string;
}

export interface CourseSurveyRankingItem extends CourseSurveyBaseItem {
  type: 'ranking';
  instructions: string;
  options: CourseSurveyRankingOption[];
  otherText?: {
    label: string;
    placeholder?: string;
  };
}

export type CourseSurveyItem =
  | CourseSurveySingleChoiceItem
  | CourseSurveyScaleItem
  | CourseSurveyTextItem
  | CourseSurveyRankingItem;

export interface CourseSurveyDefinition {
  id: CourseSurveyId;
  version: number;
  title: string;
  summary: string;
  items: CourseSurveyItem[];
}

export interface CourseSurveyResponseRow {
  questionId: string;
  prompt: string;
  response: string;
}

const countOptions = [
  { id: '0-25', label: '0-25' },
  { id: '26-50', label: '26-50' },
  { id: '51-75', label: '51-75' },
  { id: '76-100', label: '76-100' },
  { id: 'greater-than-100', label: '>100' },
];

const yesNoUnsureOptions = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: 'unsure', label: 'Unsure' },
];

const postGraduationPracticeOptions = [
  { id: 'yes-regularly', label: 'Yes, regularly' },
  { id: 'yes-occasionally', label: 'Yes, but only occasionally or if needed' },
  { id: 'no', label: 'No' },
  { id: 'unsure', label: 'Unsure' },
];

const knowledgeScalePrompts = [
  ['overall-cpebus-knowledge', 'OVERALL knowledge of cpEBUS bronchoscopy'],
  ['physics-knobology-knowledge', 'Knowledge of cpEBUS-associated physics and knobology'],
  ['scope-tools-knowledge', 'Knowledge of the cpEBUS scope and basic tools used during cpEBUS'],
  ['advanced-tools-knowledge', 'Knowledge of advanced tools used during cpEBUS'],
  ['sedation-anesthesia-knowledge', 'Knowledge of sedation and anesthesia for cpEBUS and advanced diagnostic bronchoscopy'],
  ['mediastinal-anatomy-knowledge', 'Knowledge of cpEBUS-relevant mediastinal anatomy'],
  ['lung-cancer-staging-knowledge', 'Knowledge of lung cancer staging'],
  ['respiratory-cytohistology-knowledge', 'Knowledge of cpEBUS-relevant respiratory cytohistology'],
  ['lung-cancer-evaluation-knowledge', 'Knowledge of the general approach to lung cancer evaluation'],
  [
    'bronchoscopy-utility-knowledge',
    'Knowledge of the utility of bronchoscopy for the evaluation of suspected lung cancer',
  ],
  ['molecular-biomarkers-knowledge', 'Knowledge of molecular and bio-markers for lung cancer'],
  [
    'non-malignant-disease-knowledge',
    'Knowledge of cpEBUS for evaluation of suspected non-malignant disease such as sarcoidosis',
  ],
  ['complications-rare-scenarios-knowledge', 'Knowledge of cpEBUS complications and rare scenarios'],
  ['cpebus-guidelines-knowledge', 'Knowledge of existing cpEBUS guidelines'],
] as const;

const confidenceScalePrompts = [
  ['advanced-diagnostic-planning-confidence', 'Confidence with planning advanced diagnostic bronchoscopy'],
  ['overall-cpebus-performance-confidence', 'OVERALL confidence with performing cpEBUS bronchoscopy'],
  ['cpebus-exam-confidence', 'Confidence with performing a cpEBUS exam'],
  ['routine-tbna-confidence', 'Confidence with performing routine cpEBUS-TBNA'],
  ['advanced-sampling-confidence', 'Confidence with performing advanced cpEBUS sampling (miniforceps, cryoprobe, etc.)'],
] as const;

function scaleItem(id: string, label: string, minLabel: string, maxLabel: string): CourseSurveyScaleItem {
  return {
    id,
    label,
    max: 10,
    maxLabel,
    min: 0,
    minLabel,
    type: 'scale',
  };
}

function knowledgeScaleItems(): CourseSurveyScaleItem[] {
  return knowledgeScalePrompts.map(([id, label]) => scaleItem(id, label, '0 = none', '10 = very high'));
}

function confidenceScaleItems(): CourseSurveyScaleItem[] {
  return confidenceScalePrompts.map(([id, label]) => scaleItem(id, label, '0 = not at all', '10 = extremely'));
}

export const preCourseSurveyDefinition: CourseSurveyDefinition = {
  id: 'pre-course-2026',
  version: 1,
  title: 'EBUS 2026 pre-course survey',
  summary: 'Baseline training background, goals, knowledge, and confidence before the course.',
  items: [
    {
      id: 'pgy-level',
      label: 'Please list your PGY level.',
      options: [
        { id: 'pgy-4', label: '4' },
        { id: 'pgy-5', label: '5' },
        { id: 'pgy-6', label: '6' },
        {
          id: 'other',
          label: 'Other',
          freeText: {
            label: 'Other PGY level',
            placeholder: 'Enter PGY level',
            required: true,
          },
        },
      ],
      type: 'single-choice',
    },
    {
      id: 'training-program-type',
      label: 'Please choose your training program type.',
      options: [
        { id: 'pulmonary-critical-care', label: 'Pulmonary-critical care' },
        { id: 'pulmonary', label: 'Pulmonary' },
        {
          id: 'other',
          label: 'Other',
          freeText: {
            label: 'Other training program type',
            placeholder: 'Enter program type',
            required: true,
          },
        },
      ],
      type: 'single-choice',
    },
    {
      id: 'dedicated-bronchoscopy-ip-rotation',
      label: 'Does your program have a dedicated bronchoscopy or interventional pulmonology rotation for pulmonary fellows?',
      options: yesNoUnsureOptions,
      type: 'single-choice',
    },
    {
      id: 'standard-bronchoscopy-count',
      label:
        'Approximately how many standard bronchoscopies (non-EBUS or navigational) have you performed as the primary operator?',
      options: countOptions,
      type: 'single-choice',
    },
    {
      id: 'cpebus-count',
      label: 'Approximately how many convex-probe (cp)EBUS bronchoscopies have you performed as the primary operator?',
      options: countOptions,
      type: 'single-choice',
    },
    {
      id: 'advanced-peripheral-bronchoscopy-count',
      label:
        'Approximately how many advanced peripheral bronchoscopies (radial-probe EBUS, navigational, robotic, etc.) have you performed as the primary operator?',
      options: countOptions,
      type: 'single-choice',
    },
    {
      id: 'formal-ebus-course-before',
      label: 'Have you ever attended a formal EBUS course before?',
      options: yesNoUnsureOptions,
      type: 'single-choice',
    },
    {
      id: 'post-graduation-cpebus-plan',
      label: 'Are you planning on performing cpEBUS or advanced diagnostic bronchoscopy after graduation from fellowship?',
      options: postGraduationPracticeOptions,
      type: 'single-choice',
    },
    {
      id: 'primary-course-goals',
      instructions: 'Rank in order of importance, 1 = most important and 5 = least important.',
      label: 'What are your primary goals for this course?',
      options: [
        { id: 'exam-scope-handling', label: 'Learn / improve EBUS exam and scope handling' },
        { id: 'lymph-node-identification', label: 'Learn / improve lymph node identification' },
        { id: 'basic-sampling-technique', label: 'Learn / improve basic sampling technique' },
        { id: 'advanced-tools', label: 'Learn / improve using advanced tools' },
        { id: 'baseline-board-prep', label: 'Baseline knowledge acquisition / Board prep' },
      ],
      otherText: {
        label: 'Other course goal',
        placeholder: 'Optional other goal',
      },
      type: 'ranking',
    },
    ...knowledgeScaleItems(),
    ...confidenceScaleItems(),
  ],
};

export const postCourseSurveyDefinition: CourseSurveyDefinition = {
  id: 'post-course-2026',
  version: 1,
  title: 'EBUS 2026 post-course survey',
  summary: 'Post-course plans, knowledge, confidence, and course feedback after the live course.',
  items: [
    {
      id: 'post-graduation-cpebus-plan',
      label: 'Are you planning on performing cpEBUS or advanced diagnostic bronchoscopy after graduation from fellowship?',
      options: postGraduationPracticeOptions,
      type: 'single-choice',
    },
    {
      id: 'planned-employment-model',
      label: 'In what type of employment model do you hope to / plan on practicing after graduation?',
      options: [
        { id: 'academic-tertiary-center', label: 'Academic / university-based tertiary center' },
        { id: 'community-hospital', label: 'Community-based hospital' },
        { id: 'va-government', label: 'VA / government' },
        { id: 'rural-private-practice', label: 'Rural private practice' },
        { id: 'hybrid', label: 'Hybrid' },
        { id: 'unsure', label: 'Unsure' },
      ],
      type: 'single-choice',
    },
    ...knowledgeScaleItems(),
    ...confidenceScaleItems(),
    scaleItem(
      'video-lecture-series-effectiveness',
      'Overall, how effective was the 2026 EBUS course video lecture series in teaching pulmonary fellows about cpEBUS basic knowledge?',
      '0 = not effective',
      '10 = extremely effective',
    ),
    scaleItem(
      'web-module-portal-effectiveness',
      'How effective was the 2026 EBUS course web-based module portal in providing supplementary education for cpEBUS bronchoscopy?',
      '0 = not effective',
      '10 = extremely effective',
    ),
    scaleItem(
      'live-simulation-day-effectiveness',
      'How effective was the 2026 EBUS course live hands-on simulation day in teaching pulmonary fellows about cpEBUS technical skill?',
      '0 = not effective',
      '10 = extremely effective',
    ),
    scaleItem(
      'faculty-learner-ratio-quality',
      'Please rate the overall quality of the faculty instructor to learner ratio.',
      '0 = not effective',
      '10 = extremely effective',
    ),
    scaleItem(
      'live-hands-on-faculty-effectiveness',
      'How effective was the live hands-on session faculty in teaching pulmonary fellows about cpEBUS technical skill?',
      '0 = not effective',
      '10 = extremely effective',
    ),
    scaleItem(
      'industry-representative-intrusiveness',
      'How intrusive were industry representatives in selling or marketing their product during the live course rotations?',
      '0 = not at all intrusive',
      '10 = extremely intrusive',
    ),
    {
      id: 'course-timing',
      label: 'Please comment on your thoughts on the timing of the EBUS course with regards to your fellowship training progress.',
      options: [
        { id: 'earlier', label: 'Would have preferred the course earlier in fellowship' },
        { id: 'later', label: 'Would have preferred the course later in fellowship' },
        { id: 'just-right', label: 'Timing is just about right' },
      ],
      type: 'single-choice',
    },
    {
      id: 'primary-goals-achieved',
      label: 'Did the course achieve your primary goals for learning EBUS?',
      options: yesNoUnsureOptions,
      type: 'single-choice',
    },
    scaleItem(
      'recommend-course-likelihood',
      'If asked, how likely are you to recommend this course to future pulmonary fellows?',
      '0 = not at all likely',
      '10 = extremely likely',
    ),
    {
      id: 'course-strengths-comments',
      label: 'Please provide any additional comments about the strengths of the course.',
      optional: true,
      rows: 5,
      type: 'text',
    },
    {
      id: 'course-improvement-comments',
      label: 'Please provide any additional comments about the weaknesses of the course and/or how it may be improved next year.',
      optional: true,
      rows: 5,
      type: 'text',
    },
  ],
};

export const preCourseSurveyItems = preCourseSurveyDefinition.items;
export const postCourseSurveyItems = postCourseSurveyDefinition.items;

export function getChoiceFreeTextResponseKey(item: CourseSurveySingleChoiceItem, optionId: string) {
  return `${item.id}.${optionId}.text`;
}

export function getRankingResponseKey(item: CourseSurveyRankingItem, optionId: string) {
  return `${item.id}.${optionId}`;
}

export function getRankingOtherTextResponseKey(item: CourseSurveyRankingItem) {
  return `${item.id}.other`;
}

function readRankValue(value: string | undefined, maxRank: number) {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maxRank ? parsed : null;
}

export function assignUniqueRankingResponse(
  item: CourseSurveyRankingItem,
  responses: CourseSurveyResponses,
  optionId: string,
  rankValue: string,
) {
  const optionIds = item.options.map((option) => option.id);
  const maxRank = optionIds.length;
  const targetRank = readRankValue(rankValue, maxRank);
  const targetKey = getRankingResponseKey(item, optionId);
  const nextResponses: CourseSurveyResponses = { ...responses };

  if (!optionIds.includes(optionId)) {
    return nextResponses;
  }

  if (targetRank === null) {
    delete nextResponses[targetKey];
    return nextResponses;
  }

  const targetIndex = targetRank - 1;
  const previousRank = readRankValue(responses[targetKey], maxRank);
  const previousIndex = previousRank === null ? null : previousRank - 1;
  const slots: Array<string | null> = Array.from({ length: maxRank }, () => null);
  const overflowOptionIds: string[] = [];

  for (const option of item.options) {
    if (option.id === optionId) {
      continue;
    }

    const rank = readRankValue(responses[getRankingResponseKey(item, option.id)], maxRank);

    if (rank === null) {
      continue;
    }

    const index = rank - 1;

    if (slots[index]) {
      overflowOptionIds.push(option.id);
    } else {
      slots[index] = option.id;
    }
  }

  for (const overflowOptionId of overflowOptionIds) {
    const openIndex = slots.findIndex((slot) => slot === null);

    if (openIndex >= 0) {
      slots[openIndex] = overflowOptionId;
    }
  }

  if (slots[targetIndex] && previousIndex !== null && previousIndex > targetIndex) {
    for (let index = previousIndex; index > targetIndex; index -= 1) {
      slots[index] = slots[index - 1];
    }
  } else if (slots[targetIndex] && previousIndex !== null && previousIndex < targetIndex) {
    for (let index = previousIndex; index < targetIndex; index += 1) {
      slots[index] = slots[index + 1];
    }
  } else if (slots[targetIndex]) {
    const openIndexAfterTarget = slots.findIndex((slot, index) => index > targetIndex && slot === null);

    if (openIndexAfterTarget >= 0) {
      for (let index = openIndexAfterTarget; index > targetIndex; index -= 1) {
        slots[index] = slots[index - 1];
      }
    } else {
      for (let index = targetIndex - 1; index >= 0; index -= 1) {
        if (slots[index] === null) {
          for (let shiftIndex = index; shiftIndex < targetIndex; shiftIndex += 1) {
            slots[shiftIndex] = slots[shiftIndex + 1];
          }
          break;
        }
      }
    }
  }

  slots[targetIndex] = optionId;

  for (const option of item.options) {
    const responseKey = getRankingResponseKey(item, option.id);
    const rankIndex = slots.indexOf(option.id);

    if (rankIndex >= 0) {
      nextResponses[responseKey] = String(rankIndex + 1);
    } else {
      delete nextResponses[responseKey];
    }
  }

  return nextResponses;
}

export function getScaleOptions(item: CourseSurveyScaleItem) {
  return Array.from({ length: item.max - item.min + 1 }, (_, index) => String(item.min + index));
}

function hasRequiredFreeText(item: CourseSurveySingleChoiceItem, responses: CourseSurveyResponses) {
  const selectedOption = item.options.find((option) => option.id === responses[item.id]);

  if (!selectedOption?.freeText?.required) {
    return true;
  }

  return Boolean(responses[getChoiceFreeTextResponseKey(item, selectedOption.id)]?.trim());
}

function hasCompleteRanking(item: CourseSurveyRankingItem, responses: CourseSurveyResponses) {
  const ranks = item.options.map((option) => responses[getRankingResponseKey(item, option.id)]);

  if (ranks.some((rank) => !rank)) {
    return false;
  }

  return new Set(ranks).size === item.options.length;
}

export function isCourseSurveyItemComplete(item: CourseSurveyItem, responses: CourseSurveyResponses) {
  if (item.type === 'single-choice') {
    return Boolean(responses[item.id]) && hasRequiredFreeText(item, responses);
  }

  if (item.type === 'scale') {
    const numericValue = Number(responses[item.id]);

    return Number.isInteger(numericValue) && numericValue >= item.min && numericValue <= item.max;
  }

  if (item.type === 'ranking') {
    return hasCompleteRanking(item, responses);
  }

  return item.optional || Boolean(responses[item.id]?.trim());
}

export function isCourseSurveyComplete(items: CourseSurveyItem[], responses: CourseSurveyResponses) {
  return items.every((item) => isCourseSurveyItemComplete(item, responses));
}

function readChoiceResponse(item: CourseSurveySingleChoiceItem, responses: CourseSurveyResponses): CourseSurveyResponseRow[] {
  const selectedOptionId = responses[item.id];
  const selectedOption = item.options.find((option) => option.id === selectedOptionId);
  const response = selectedOption?.label ?? selectedOptionId;

  if (!response) {
    return [];
  }

  const rows: CourseSurveyResponseRow[] = [
    {
      prompt: item.label,
      questionId: item.id,
      response,
    },
  ];

  if (selectedOption?.freeText) {
    const detail = responses[getChoiceFreeTextResponseKey(item, selectedOption.id)]?.trim();

    if (detail) {
      rows.push({
        prompt: `${item.label} - ${selectedOption.freeText.label}`,
        questionId: getChoiceFreeTextResponseKey(item, selectedOption.id),
        response: detail,
      });
    }
  }

  return rows;
}

function readRankingResponse(item: CourseSurveyRankingItem, responses: CourseSurveyResponses): CourseSurveyResponseRow[] {
  const rankRows = item.options.flatMap((option) => {
    const rank = responses[getRankingResponseKey(item, option.id)];

    return rank
      ? [
          {
            prompt: `${item.label} - ${option.label}`,
            questionId: getRankingResponseKey(item, option.id),
            response: `Rank ${rank}`,
          },
        ]
      : [];
  });
  const other = item.otherText ? responses[getRankingOtherTextResponseKey(item)]?.trim() : '';

  return other
    ? [
        ...rankRows,
        {
          prompt: `${item.label} - ${item.otherText?.label ?? 'Other'}`,
          questionId: getRankingOtherTextResponseKey(item),
          response: other,
        },
      ]
    : rankRows;
}

export function getCourseSurveyResponseRows(
  definition: Pick<CourseSurveyDefinition, 'items'>,
  responses: CourseSurveyResponses,
) {
  return definition.items.flatMap((item): CourseSurveyResponseRow[] => {
    if (item.type === 'single-choice') {
      return readChoiceResponse(item, responses);
    }

    if (item.type === 'ranking') {
      return readRankingResponse(item, responses);
    }

    const response = responses[item.id]?.trim();

    return response
      ? [
          {
            prompt: item.label,
            questionId: item.id,
            response,
          },
        ]
      : [];
  });
}
