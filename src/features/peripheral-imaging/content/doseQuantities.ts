import type { SourceId } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * The four dose quantities of Section 18, as a table, and the whole-procedure record as a template.
 *
 * Report 7.2 (fellow walkthrough, PDF p.43): the four quantities arrived in one paragraph, and the
 * "record the whole procedure once" list was what the reader wanted for the procedure note. Every
 * cell below is taken from the section's own teaching — the blocks "Know the quantity before
 * comparing the number", "A smaller field and a higher local index can coexist" and "Record the
 * whole procedure once" — and the course glossary; the sources are the ones those blocks cite. The
 * template carries no value at all: an educational aid never prefills a patient measurement.
 */
export interface DoseQuantityRow {
  readonly id: 'reference-air-kerma' | 'kap' | 'peak-skin-dose' | 'effective-dose'
  readonly name: string
  readonly unit: string
  readonly tells: string
  readonly doesNot: string
  readonly sourceIds: readonly SourceId[]
}

export const DOSE_QUANTITIES: readonly DoseQuantityRow[] = [
  {
    id: 'reference-air-kerma',
    name: 'Cumulative reference air kerma (Kₐ,r)',
    unit: 'mGy or Gy',
    tells:
      'An equipment-reference index of the air kerma accumulated at a defined reference point, across every exposure it includes.',
    doesNot:
      'It is not the highest skin dose: the entrance field moves with the projection, and skin dose needs geometry and corrections.',
    sourceIds: ['aapm12', 'skin', 'wabip'],
  },
  {
    id: 'kap',
    name: 'Kerma–area product (KAP, also called DAP)',
    unit: 'Gy·cm²',
    tells:
      'Air kerma integrated over the beam area. In this model’s uniform free-air field, it is air kerma multiplied by area and is equal at the two displayed planes.',
    doesNot:
      'It is not skin dose or organ dose. Collimation can lower it while automatic exposure regulation raises the air kerma in the remaining field.',
    sourceIds: ['wabip', 'aapm12', 'tg125'],
  },
  {
    id: 'peak-skin-dose',
    name: 'Peak skin dose',
    unit: 'Gy',
    tells: 'The highest absorbed dose to any one area of skin.',
    doesNot:
      'It is not read off a console index: estimating it needs the field positions, the geometry and tissue corrections.',
    sourceIds: ['skin', 'aapm12'],
  },
  {
    id: 'effective-dose',
    name: 'Effective dose',
    unit: 'mSv',
    tells:
      'A tissue-weighted population-protection estimate, with the assumptions behind it disclosed.',
    doesNot:
      'It is not an individual measurement, and a comparison with a CT scan without the method behind it is not a report.',
    sourceIds: ['wabip', 'aapm12'],
  },
]

/**
 * The whole-procedure record, line by line, from the block "Record the whole procedure once".
 * Each line is a field and nothing else. No number, unit value or mode is filled in.
 */
export const DOSE_NOTE_TEMPLATE_LINES: readonly string[] = [
  'Total kerma–area product (KAP): ______ Gy·cm², modes included: ______',
  'Cumulative reference air kerma: ______ mGy, modes included: ______',
  'Fluoroscopy time: ______ min',
  'DTS acquisitions: number ______, protocol ______',
  'CBCT spins: number ______, protocol ______',
  'Reason for each repeated acquisition: ______',
  'Component subtotals kept separate from the total: yes / no',
  'Dose notifications, limitations and dose-management follow-up: ______',
]

export const DOSE_NOTE_TEMPLATE_TEXT = DOSE_NOTE_TEMPLATE_LINES.join('\n')

export function validateImagingDoseQuantities(): readonly string[] {
  const errors: string[] = []
  for (const row of DOSE_QUANTITIES) {
    const where = `Dose quantity ${row.id}`
    errors.push(
      ...imagingLearnerCopyErrors(`${where} name`, row.name),
      ...imagingLearnerCopyErrors(`${where} tells`, row.tells),
      ...imagingLearnerCopyErrors(`${where} does not`, row.doesNot),
    )
    if (row.sourceIds.length === 0) errors.push(`${where} cites nothing.`)
  }
  for (const line of DOSE_NOTE_TEMPLATE_LINES) {
    errors.push(...imagingLearnerCopyErrors('Dose note template line', line))
    // An educational template must never carry a value that could be read as a measurement.
    if (/\d/.test(line)) errors.push(`Dose note template line carries a number: "${line}"`)
  }
  return errors
}

const doseQuantityErrors = validateImagingDoseQuantities()
if (doseQuantityErrors.length > 0) {
  throw new Error(`The dose quantities are invalid:\n${doseQuantityErrors.join('\n')}`)
}
