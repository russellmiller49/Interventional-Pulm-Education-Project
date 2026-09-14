import { airwayDisplayName } from '../content/airwayTree'
import type { BronchReport, BronchReportField } from '../content/types'
import type { BronchRecord } from './learnProgress'

/** Records only the learner's declared examination; no normal findings are inferred. */
export function inspectionReport(record: Pick<BronchRecord, 'inspectionSnapshot'>): BronchReport {
  const snapshot = record.inspectionSnapshot
  const fields: BronchReportField[] = (snapshot?.rows ?? []).map((row) => {
    const name = airwayDisplayName(row.label)
    const status =
      row.limitation === 'not-safely-accessible'
        ? 'Not safely accessible in this exercise'
        : row.inspected === 'declared'
          ? 'Inspection declared by the learner; findings are not modeled'
          : row.inspected === 'declared-without-view'
            ? 'Inspection declaration was unsupported by the available view'
            : row.entered
              ? 'Entered; inspection not declared'
              : row.ostiumVisualized
                ? 'Opening visualized; inspection not declared'
                : 'Not observed in this exercise'
    return {
      id: `survey-${row.label}`,
      label: name,
      evidence: `Saved survey: ${status.toLowerCase()}. Entry recorded: ${row.entered ? 'yes' : 'no'}.`,
      options: [
        {
          id: 'recorded-status',
          label: status,
          supported: true,
          rationale:
            'This statement keeps the learner’s declaration and the model’s limits distinct. It supplies no invented normal finding.',
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
  fields.unshift({
    id: 'survey-source',
    label: 'Available examination evidence',
    evidence: snapshot
      ? 'A saved inspection record is available from your completed lower-airway survey exercise.'
      : 'No completed survey record is available on this device. Visiting a lesson or watching a demonstration does not create an examination record.',
    options: [
      {
        id: 'available-evidence',
        label: snapshot
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
  })
  fields.push({
    id: 'survey-larynx',
    label: 'Laryngeal examination',
    evidence:
      'This record comes from the lower-airway survey exercise. Its start does not expose the native larynx.',
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
  })
  return {
    id: 'report-from-your-survey',
    prompt:
      'Build a report from the examination evidence available on this device. This is a record of a teaching exercise, not a patient procedure.',
    evidenceTitle: snapshot ? 'Your completed survey record' : 'No saved survey examination',
    fields,
    sourceRefs: [{ sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } }],
  }
}
