import { airwayDisplayName } from '../content/airwayTree'
import type { AirwayInspectionRecord } from '../components/scope/types'
import type { BronchReport, BronchReportField } from '../content/types'
import type { SourceRef } from '../data/sources'
import type { BronchInspectionSnapshot, BronchRecord } from './learnProgress'

/**
 * The report exercise's evidence, and the report built from it (fellow walkthrough A35).
 *
 * Three kinds of evidence are kept apart, in the type and in every word the learner reads:
 * - `learner`: the learner's own finished survey — the one record `availableSurveySnapshot`
 *   returns. Nothing else is ever called "your" survey.
 * - `supplied`: a teaching record supplied by the course. It is not the learner's examination and
 *   is never described, stored or counted as one.
 * - `none`: no survey evidence. A missing record stays a limitation.
 *
 * The supplied record exists only in this module, as constants. It is never written to storage,
 * never offered to `withSurveySnapshot`, never shown in the survey section, and cannot change what
 * the learner's own record holds. No normal finding is inferred in any mode.
 */
export type SurveyEvidence =
  | { readonly kind: 'learner'; readonly snapshot: BronchInspectionSnapshot }
  | { readonly kind: 'supplied' }
  | { readonly kind: 'none' }

export type SurveyEvidenceKind = SurveyEvidence['kind']

/** On the supplied record's report, its choice and every field: the record is not the learner's. */
export const SUPPLIED_RECORD_IDENTITY = 'Supplied teaching record — not your examination'

/**
 * The supplied teaching record: the lower lobe already worked in the survey section's teaching
 * ("One lower lobe, recorded", block `lower-lobe-worked` of `systematic-survey`), as the four
 * record statuses that example states — inspected, inspected, entered without an inspection, and
 * an opening seen but not safely accessible. The example's two remaining lines (a variant and a
 * return) are not record statuses and are not represented.
 *
 * It is deliberately incomplete: one lobe, no other airway, no larynx, no finding. It introduces
 * no clinical narrative of its own; the words on the report are the model's status wording.
 */
export const SUPPLIED_TEACHING_RECORD_SOURCE = {
  sectionId: 'systematic-survey',
  blockId: 'lower-lobe-worked',
} as const

export const SUPPLIED_TEACHING_ROWS: readonly AirwayInspectionRecord[] = [
  {
    label: 'LB6',
    identified: true,
    ostiumVisualized: true,
    entered: true,
    distalViewObtained: true,
    inspected: 'declared',
    limitation: null,
  },
  {
    label: 'LB7+8',
    identified: true,
    ostiumVisualized: true,
    entered: true,
    distalViewObtained: true,
    inspected: 'declared',
    limitation: null,
  },
  {
    label: 'LB9',
    identified: true,
    ostiumVisualized: true,
    entered: true,
    distalViewObtained: false,
    inspected: 'no',
    limitation: null,
  },
  {
    label: 'LB10',
    identified: true,
    ostiumVisualized: true,
    entered: false,
    distalViewObtained: false,
    inspected: 'no',
    limitation: 'not-safely-accessible',
  },
]

export const SUPPLIED_TEACHING_REPORT_ID = 'report-from-supplied-teaching-record'

const REPORT_SOURCE_REFS: readonly SourceRef[] = [
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
]

/** What a row's record supports saying. `whose` names who declared an inspection. */
function rowStatus(row: AirwayInspectionRecord, supplied: boolean): string {
  return row.limitation === 'not-safely-accessible'
    ? 'Not safely accessible in this exercise'
    : row.inspected === 'declared'
      ? supplied
        ? 'Inspection declared in the supplied record; findings are not modeled'
        : 'Inspection declared by the learner; findings are not modeled'
      : row.inspected === 'declared-without-view'
        ? 'Inspection declaration was unsupported by the available view'
        : row.entered
          ? 'Entered; inspection not declared'
          : row.ostiumVisualized
            ? 'Opening visualized; inspection not declared'
            : 'Not observed in this exercise'
}

function rowFields(
  rows: readonly AirwayInspectionRecord[],
  supplied: boolean,
): BronchReportField[] {
  return rows.map((row) => {
    const status = rowStatus(row, supplied)
    return {
      id: `survey-${row.label}`,
      label: airwayDisplayName(row.label),
      evidence: `${supplied ? 'Supplied teaching record, not your examination' : 'Saved survey'}: ${status.toLowerCase()}. Entry recorded: ${row.entered ? 'yes' : 'no'}.`,
      options: [
        {
          id: 'recorded-status',
          label: status,
          supported: true,
          rationale: supplied
            ? 'This statement keeps the supplied record’s declaration and the model’s limits distinct. It supplies no invented normal finding.'
            : 'This statement keeps the learner’s declaration and the model’s limits distinct. It supplies no invented normal finding.',
        },
        {
          id: 'normal-airway',
          label: 'Inspected and normal throughout',
          supported: false,
          rationale:
            'The survey model records location and declarations. It does not establish normal mucosa, contents or a complete distal examination.',
        },
      ],
    }
  })
}

function sourceField(evidence: SurveyEvidence): BronchReportField {
  if (evidence.kind === 'supplied')
    return {
      id: 'survey-source',
      label: 'Available examination evidence',
      evidence:
        'A supplied teaching record is shown: the lower lobe worked in “A systematic survey and its record”. It was written for this course. You did not perform it, and it is not a record of a patient.',
      options: [
        {
          id: 'supplied-evidence',
          label:
            'Report only the supplied teaching record and its stated limitations, named as supplied',
          supported: true,
          rationale:
            'State the evidence actually available and whose it is. A supplied example is reported as supplied; everything it does not cover remains unexamined.',
        },
        {
          id: 'own-examination',
          label: 'Report these airways as my own examination',
          supported: false,
          rationale:
            'Nothing in the supplied record was seen, entered or declared by you. Reading an example does not create an examination record.',
        },
        {
          id: 'complete-survey',
          label: 'A complete normal examination has been established',
          supported: false,
          rationale:
            'No complete normal examination follows from online progress, an entered airway or a played demonstration.',
        },
      ],
    }
  const available = evidence.kind === 'learner'
  return {
    id: 'survey-source',
    label: 'Available examination evidence',
    evidence: available
      ? 'A saved inspection record is available from your completed lower-airway survey exercise.'
      : 'No completed survey record is available on this device. Visiting a lesson or watching a demonstration does not create an examination record.',
    options: [
      {
        id: 'available-evidence',
        label: available
          ? 'Report only the saved survey and its declared limitations'
          : 'Examination evidence unavailable; do not infer findings',
        supported: true,
        rationale:
          'State the evidence actually available. A missing record remains a limitation, not a normal examination.',
      },
      {
        id: 'complete-survey',
        label: 'A complete normal examination has been established',
        supported: false,
        rationale:
          'No complete normal examination follows from online progress, an entered airway or a played demonstration.',
      },
    ],
  }
}

function larynxField(evidence: SurveyEvidence): BronchReportField {
  return {
    id: 'survey-larynx',
    label: 'Laryngeal examination',
    evidence:
      evidence.kind === 'supplied'
        ? 'The supplied teaching record covers one lower lobe. It holds nothing about the larynx.'
        : 'This record comes from the lower-airway survey exercise. Its start does not expose the native larynx.',
    options: [
      {
        id: 'not-assessed',
        label: 'Larynx not assessed in this exercise',
        supported: true,
        rationale:
          'The selected approach does not expose the larynx. A finding cannot be supplied for an unexamined structure.',
      },
      {
        id: 'larynx-normal',
        label: 'Larynx normal with symmetric vocal-fold movement',
        supported: false,
        rationale:
          'Neither laryngeal appearance nor vocal-fold motion was observed through this exercise’s selected approach.',
      },
    ],
  }
}

/** The report for one kind of evidence. Each kind has its own report id, title and wording. */
export function surveyReport(evidence: SurveyEvidence): BronchReport {
  const supplied = evidence.kind === 'supplied'
  const rows =
    evidence.kind === 'learner' ? evidence.snapshot.rows : supplied ? SUPPLIED_TEACHING_ROWS : []
  return {
    id: supplied
      ? SUPPLIED_TEACHING_REPORT_ID
      : evidence.kind === 'learner'
        ? 'report-from-your-survey'
        : 'report-without-survey-evidence',
    prompt: supplied
      ? 'Build a report from the supplied teaching record. It is an example written for this course: not your examination, and not a patient procedure.'
      : 'Build a report from the examination evidence available on this device. This is a record of a teaching exercise, not a patient procedure.',
    evidenceTitle: supplied
      ? SUPPLIED_RECORD_IDENTITY
      : evidence.kind === 'learner'
        ? 'Your completed survey record'
        : 'No saved survey examination',
    fields: [sourceField(evidence), ...rowFields(rows, supplied), larynxField(evidence)],
    sourceRefs: REPORT_SOURCE_REFS,
  }
}

/** The evidence a stored record holds: the learner's own survey, or none. Never the supplied one. */
export function learnerSurveyEvidence(snapshot: BronchInspectionSnapshot | null): SurveyEvidence {
  return snapshot ? { kind: 'learner', snapshot } : { kind: 'none' }
}

/** Records only the learner's declared examination; no normal findings are inferred. */
export function inspectionReport(record: Pick<BronchRecord, 'inspectionSnapshot'>): BronchReport {
  return surveyReport(learnerSurveyEvidence(record.inspectionSnapshot))
}
