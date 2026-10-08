import { SOURCE_BY_ID, type BronchSourceId } from '../data/sources'

/**
 * The numbers register: every clinical number the course teaches, written once.
 *
 * A lesson never types a clinical number. It writes `num('platelets-biopsy')`, which leaves a token
 * in the copy; the section registry resolves the token to the value before anything renders, and
 * records which rows each card used so the card can name its sources in one line. The validators
 * refuse a clinical digit typed by hand (`handTypedDigitErrors`), so a value cannot drift away from
 * its source, and a guideline update is one edit here.
 *
 * Each row carries its class, its sources with their grade, when it was checked and by whom, and
 * the faculty signature. Nothing ships to learners on an unsigned row: `unsignedNumberIds` is the
 * release gate, and it is checked whenever the module's release stage is `published`.
 *
 * Row numbers are the rows of the rewrite plan's register (2026-10-08). A plan row with several
 * values has one entry per value here, so a sentence can use each on its own.
 */
export type NumberClass =
  /** A value a guideline or consensus statement recommends. Taught exactly, with its source. */
  | 'guideline'
  /** A property of a device class, from the instructions for the scopes the unit uses. */
  | 'device'
  /** Set by the institution. Shown when configured; otherwise the row's fallback wording. */
  | 'local-slot'

export type NumberStatus =
  /** Checked against the source text; waiting for the faculty signature. */
  | 'verified'
  /** Signed by faculty. The only status a published course may use. */
  | 'signed'
  /** Named in the plan, value not yet taken from its source. Cannot be used in copy. */
  | 'to-extract'
  /** A local slot with no guideline value. */
  | 'local-slot'

export interface NumberCitation {
  readonly sourceId: BronchSourceId
  /** The source's own grade for this recommendation, as printed. */
  readonly grade: string | null
  /** Recommendation number, table, figure or page. Null until recorded. */
  readonly locator: string | null
}

export interface NumberRow {
  /** The plan's register row. */
  readonly row: number
  readonly label: string
  /** The words that replace the token. Null until extracted, and for a slot with no guideline value. */
  readonly value: string | null
  /** What a local slot says when the institution has not set it. */
  readonly fallback?: string
  readonly class: NumberClass
  readonly status: NumberStatus
  readonly sources: readonly NumberCitation[]
  /** ISO date the value was checked against its source. */
  readonly checkedOn: string | null
  readonly checkedBy: string | null
  /** Faculty signature. Null until Russell Miller signs the row. */
  readonly signedBy: string | null
  /** Anything the sources disagree on; shown in the sources panel, never in the lesson. */
  readonly note?: string
  /** A definition (a grading scale), not a threshold a local protocol could set differently. */
  readonly isDefinition?: true
}

const PLAN = { checkedOn: '2026-10-08', checkedBy: 'Rewrite plan register', signedBy: null }
const BTS = (grade: string | null): NumberCitation => ({ sourceId: 'U14', grade, locator: null })
const U2 = (grade: string | null): NumberCitation => ({ sourceId: 'U2', grade, locator: null })
const ATS_BAL: NumberCitation = { sourceId: 'U6', grade: null, locator: null }
const NASHVILLE: NumberCitation = {
  sourceId: 'U15',
  grade: 'Delphi consensus',
  locator: 'Results; Figure 5',
}
const NASHVILLE_CHECK = {
  checkedOn: '2026-10-08',
  checkedBy: 'Claude, against the PMC article text',
  signedBy: null,
  isDefinition: true,
} as const
const TO_EXTRACT = { value: null, status: 'to-extract', checkedOn: null, checkedBy: null } as const

const ROWS = {
  // 1 · Fasting
  'fasting-solids': {
    row: 1,
    label: 'Fasting before bronchoscopy: food',
    value: '4 hours',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D'), U2('3A')],
    ...PLAN,
  },
  'fasting-clear-fluids': {
    row: 1,
    label: 'Fasting before bronchoscopy: clear fluids',
    value: '2 hours',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D'), U2('3A')],
    ...PLAN,
  },
  // 2 · Oxygen trigger
  'oxygen-trigger': {
    row: 2,
    label: 'When to add oxygen',
    value: 'a fall of more than 4% from baseline, or SpO₂ under 90% for over 1 minute',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D'), U2('3A')],
    ...PLAN,
  },
  // 3 · Spray-as-you-go
  'lidocaine-spray-concentration': {
    row: 3,
    label: 'Lidocaine concentration for spray-as-you-go',
    value: '1%',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('A'), U2('1A')],
    ...PLAN,
  },
  // 4 · Nebulized lidocaine
  'nebulized-lidocaine': {
    row: 4,
    label: 'Nebulized lidocaine',
    value: 'not recommended',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('B'), U2('1A')],
    ...PLAN,
  },
  // 5 · Lidocaine ceiling
  'lidocaine-ceiling': {
    row: 5,
    label: 'Suggested upper limit for total lidocaine',
    value: '8.0 mg/kg',
    class: 'guideline',
    status: 'verified',
    sources: [U2('2A'), BTS('D')],
    note: 'BTS 2013 sets no ceiling: use the lowest dose that controls cough and record the cumulative dose. Older teaching quotes 8.2 mg/kg; cite 8.0 mg/kg from the 2019 guideline.',
    ...PLAN,
  },
  'lidocaine-toxicity-noted': {
    row: 5,
    label: 'Lidocaine dose at which symptoms were noted (BTS evidence review)',
    value: '9.6 mg/kg or more',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D')],
    ...PLAN,
  },
  // 6 · Midazolam
  'midazolam-draw-up-under-70': {
    row: 6,
    label: 'Midazolam drawn up at the start, patient under 70',
    value: '5 mg',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D')],
    ...PLAN,
  },
  'midazolam-draw-up-over-70': {
    row: 6,
    label: 'Midazolam drawn up at the start, patient over 70',
    value: '2 mg',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D')],
    ...PLAN,
  },
  'midazolam-stock-strength': {
    row: 6,
    label: 'Midazolam strength stocked in the suite',
    value: '1 mg/mL',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D')],
    ...PLAN,
  },
  // 7 · Platelets
  'platelets-bal': {
    row: 7,
    label: 'Minimum platelet count for BAL',
    value: '20,000/µL',
    class: 'guideline',
    status: 'verified',
    sources: [U2('3B'), BTS('D')],
    ...PLAN,
  },
  'platelets-biopsy': {
    row: 7,
    label: 'Minimum platelet count for endobronchial or transbronchial biopsy',
    value: '50,000/µL',
    class: 'guideline',
    status: 'verified',
    sources: [U2('3B')],
    ...PLAN,
  },
  // 8 · P2Y12 inhibitors
  'p2y12-hold': {
    row: 8,
    label: 'Stop clopidogrel, prasugrel or ticagrelor before biopsy',
    value: 'at least 5 days',
    class: 'guideline',
    status: 'verified',
    sources: [U2('2A')],
    note: 'BTS 2013 says stop clopidogrel 7 days before. Both guidelines continue low-dose aspirin.',
    ...PLAN,
  },
  'clopidogrel-hold-bts': {
    row: 8,
    label: 'Stop clopidogrel before biopsy (BTS)',
    value: '7 days',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('C')],
    ...PLAN,
  },
  // 9 · Warfarin and NOACs
  'warfarin-hold': {
    row: 9,
    label: 'Stop warfarin before biopsy',
    value: 'at least 5 days',
    class: 'guideline',
    status: 'verified',
    sources: [U2('3A')],
    ...PLAN,
  },
  'inr-before-biopsy': {
    row: 9,
    label: 'INR before biopsy',
    value: 'under 1.5',
    class: 'guideline',
    status: 'verified',
    sources: [U2('3A')],
    ...PLAN,
  },
  'noac-hold': {
    row: 9,
    label: 'Stop a NOAC before biopsy',
    value: 'at least 2 days',
    class: 'guideline',
    status: 'verified',
    sources: [U2('3A')],
    ...PLAN,
  },
  // 10 · After sedation
  'post-sedation-restriction': {
    row: 10,
    label: 'No driving, machinery or legal documents after sedation',
    value: '24 hours',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('good practice')],
    ...PLAN,
  },
  // 11 · Endobronchial biopsies
  'endobronchial-biopsy-minimum': {
    row: 11,
    label: 'Biopsies of a visible endobronchial tumour',
    value: 'at least 5',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D')],
    ...PLAN,
  },
  // 12 · Imaging after TBLB
  'cxr-after-tblb': {
    row: 12,
    label: 'Chest radiograph after transbronchial biopsy',
    value: 'only if the patient is symptomatic or pneumothorax is suspected',
    class: 'guideline',
    status: 'verified',
    sources: [BTS('D'), U2('3A')],
    ...PLAN,
  },
  // 13 · BAL technique
  'bal-total-volume': {
    row: 13,
    label: 'Total saline instilled for BAL',
    value: '100–300 mL',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  'bal-aliquots': {
    row: 13,
    label: 'Number of BAL aliquots',
    value: '3–5',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  'bal-suction-ceiling': {
    row: 13,
    label: 'Suction pressure during BAL',
    value: 'under 100 mmHg',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  // 14 · BAL return
  'bal-return-optimal': {
    row: 14,
    label: 'Optimal BAL return',
    value: '30% or more',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  'bal-return-minimum': {
    row: 14,
    label: 'Minimum BAL return',
    value: '5%',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  'bal-abort-rule': {
    row: 14,
    label: 'Abort the lavage when the return is',
    value: 'less than 5% of each aliquot',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  'bal-cell-analysis-volume': {
    row: 14,
    label: 'Pooled volume needed for cell analysis',
    value: '10–20 mL',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  'bal-cell-analysis-minimum': {
    row: 14,
    label: 'Least pooled volume for cell analysis',
    value: '5 mL',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  'bal-epithelial-flag': {
    row: 14,
    label: 'Epithelial cells that flag a suboptimal sample',
    value: 'over 5%',
    class: 'guideline',
    status: 'verified',
    sources: [ATS_BAL],
    ...PLAN,
  },
  // 15 · Quantitative cultures for VAP
  'vap-culture-thresholds': {
    row: 15,
    label: 'Quantitative culture thresholds for VAP (BAL and protected brush)',
    class: 'guideline',
    sources: [{ sourceId: 'U7', grade: null, locator: null }],
    signedBy: null,
    ...TO_EXTRACT,
  },
  // 16 · Tube and scope
  'tube-scope-margin': {
    row: 16,
    label: 'Tube inner diameter larger than the scope outer diameter by',
    value: 'at least 2.0 mm',
    class: 'guideline',
    status: 'verified',
    sources: [U2('good practice'), BTS('D')],
    ...PLAN,
  },
  'working-channel-minimum': {
    row: 16,
    label: 'Working channel for bronchoscopy in a ventilated patient',
    value: 'at least 2 mm',
    class: 'guideline',
    status: 'verified',
    sources: [U2('good practice')],
    ...PLAN,
  },
  // 17 · Ventilator settings
  'vent-fio2': {
    row: 17,
    label: 'FiO₂ for bronchoscopy on the ventilator',
    value: '100%',
    class: 'guideline',
    status: 'verified',
    sources: [U2('3A')],
    ...PLAN,
  },
  'vent-fio2-lead-time': {
    row: 17,
    label: 'Start the raised FiO₂ before the procedure',
    value: '5–10 minutes',
    class: 'guideline',
    status: 'verified',
    sources: [U2('3A')],
    ...PLAN,
  },
  'vent-tidal-volume-increase': {
    row: 17,
    label: 'Tidal volume increase during the procedure',
    value: '100–150 mL',
    class: 'guideline',
    status: 'verified',
    sources: [U2('good practice')],
    ...PLAN,
  },
  // 18 · Bleeding grades (Nashville)
  'nashville-grade-1': {
    row: 18,
    label: 'Nashville grade 1',
    value: 'suction for less than 1 minute, or a wedge, and the bleeding stops by itself',
    class: 'guideline',
    status: 'verified',
    sources: [NASHVILLE],
    ...NASHVILLE_CHECK,
  },
  'nashville-grade-2': {
    row: 18,
    label: 'Nashville grade 2',
    value:
      'suction for more than 1 minute, or a repeat wedge, or cold saline, a vasoactive drug or a thrombogenic agent',
    class: 'guideline',
    status: 'verified',
    sources: [NASHVILLE],
    ...NASHVILLE_CHECK,
  },
  'nashville-grade-3': {
    row: 18,
    label: 'Nashville grade 3',
    value:
      'selective intubation with a tube or a bronchial blocker for less than 20 minutes, or stopping the procedure early',
    class: 'guideline',
    status: 'verified',
    sources: [NASHVILLE],
    ...NASHVILLE_CHECK,
  },
  'nashville-grade-4': {
    row: 18,
    label: 'Nashville grade 4',
    value:
      'selective intubation for more than 20 minutes, new ICU admission, red-cell transfusion, bronchial artery embolization or resuscitation',
    class: 'guideline',
    status: 'verified',
    sources: [NASHVILLE],
    ...NASHVILLE_CHECK,
  },
  // 19 · Reversal and monitoring
  'reversal-agents': {
    row: 19,
    label: 'Reversal agents and their dosing',
    class: 'guideline',
    sources: [{ sourceId: 'U1', grade: null, locator: null }],
    signedBy: null,
    ...TO_EXTRACT,
  },
  'sedation-monitoring-standard': {
    row: 19,
    label: 'Monitoring standard for moderate sedation',
    class: 'guideline',
    sources: [{ sourceId: 'U1', grade: null, locator: null }],
    signedBy: null,
    ...TO_EXTRACT,
  },
  // 20 · Local anesthetic toxicity
  'last-treatment': {
    row: 20,
    label: 'Local anesthetic systemic toxicity: the treatment steps',
    class: 'guideline',
    sources: [{ sourceId: 'U4', grade: null, locator: null }],
    signedBy: null,
    ...TO_EXTRACT,
  },
  // 21 · Methemoglobinemia
  'methemoglobinemia-treatment': {
    row: 21,
    label: 'Methemoglobinemia: co-oximetry and the treatment',
    class: 'guideline',
    sources: [],
    signedBy: null,
    note: 'Source to add.',
    ...TO_EXTRACT,
  },
  // 22 · Scope diameters
  'scope-diameters': {
    row: 22,
    label: 'Outer and channel diameter by scope class',
    class: 'device',
    sources: [],
    signedBy: null,
    note: 'From the instructions for the scopes the unit uses.',
    ...TO_EXTRACT,
  },
  // 23 · Topical vasoconstrictor
  'topical-vasoconstrictor': {
    row: 23,
    label: 'Topical vasoconstrictor for airway bleeding: agent and concentration',
    value: null,
    fallback: 'the agent and concentration in your local protocol',
    class: 'local-slot',
    status: 'local-slot',
    sources: [],
    checkedOn: null,
    checkedBy: null,
    signedBy: null,
  },
} as const satisfies Record<string, NumberRow>

export type NumberId = keyof typeof ROWS

export const NUMBER_REGISTER: Readonly<Record<NumberId, NumberRow>> = ROWS
export const NUMBER_IDS = Object.keys(ROWS) as readonly NumberId[]

/**
 * The institution's own values, by register id. A configured value replaces the guideline value
 * wherever the row is used, and fills a local slot. Empty until the institution sets one.
 */
export const INSTITUTION_VALUES: Partial<Readonly<Record<NumberId, string>>> = {}

export function isNumberId(value: string): value is NumberId {
  return Object.prototype.hasOwnProperty.call(ROWS, value)
}

// ── Tokens ───────────────────────────────────────────────────────────────────────────────────────

const TOKEN = /\{\{num:([a-z0-9-]+)\}\}/g

/** The register value, as a token the registry resolves. Use inside a template literal. */
export function num(id: NumberId): string {
  return `{{num:${id}}}`
}

/** What a row says to the learner: the institution's value, the guideline value, or the fallback. */
export function numberText(id: NumberId): string | null {
  const row = NUMBER_REGISTER[id]
  return INSTITUTION_VALUES[id] ?? row.value ?? row.fallback ?? null
}

/** Every token id in a string, known or not, in order of appearance and without repeats. */
export function numberTokensIn(text: string): readonly string[] {
  return [...new Set([...text.matchAll(TOKEN)].map((match) => match[1]))]
}

export function numberIdsIn(text: string): readonly NumberId[] {
  return numberTokensIn(text).filter(isNumberId)
}

/** The copy with its tokens removed: what the digit rule and the word counts read. */
export function stripNumberTokens(text: string): string {
  return text.replace(TOKEN, ' ')
}

/** The copy as the learner reads it. A token that cannot be resolved throws: it never renders. */
export function resolveNumbers(text: string): string {
  return text.replace(TOKEN, (_, id: string) => {
    const value = isNumberId(id) ? numberText(id) : null
    if (value === null) throw new Error(`Number "${id}" has no value to render.`)
    return value
  })
}

/** What is wrong with the tokens in one string. */
export function numberTokenErrors(where: string, text: string): readonly string[] {
  return numberTokensIn(text).flatMap((id) => {
    if (!isNumberId(id)) return [`${where} names a number "${id}" that is not in the register.`]
    if (numberText(id) === null)
      return [
        `${where} uses "${id}", which is still to extract; the register has no value for it yet.`,
      ]
    return []
  })
}

// ── Hand-typed digits ────────────────────────────────────────────────────────────────────────────

/**
 * Digits that are names, not clinical numbers: segment codes (RB1, LB1+2, B6), a clock position
 * ("6 o'clock"), and a bleeding grade used as a label ("grade 2").
 */
const NOTATION = [
  /\b[RL]?B\d{1,2}(\s?[+–-]\s?\d{1,2})?\b/g,
  /\b\d{1,2}\s+o[’']clock\b/gi,
  /\bgrades?\s+[1-4](\s?(–|-|to|and|or)\s?[1-4])?\b/gi,
]

/**
 * A clinical number typed by hand. Teaching copy takes its numbers from the register, so what is
 * left after the tokens and the notation above must hold no digit.
 */
export function handTypedDigitErrors(where: string, text: string): readonly string[] {
  const rest = NOTATION.reduce(
    (current, pattern) => current.replace(pattern, ' '),
    stripNumberTokens(text),
  )
  const found = rest.match(/\S*\d\S*/g)
  return found
    ? [
        `${where} types a number by hand (${[...new Set(found)].join(', ')}); take it from the numbers register with num().`,
      ]
    : []
}

// ── Sources and the signature gate ───────────────────────────────────────────────────────────────

/** Short names for the one-line source note under a card. */
const SOURCE_SHORT_NAMES: Partial<Readonly<Record<BronchSourceId, string>>> = {
  U1: 'ASA 2018',
  U2: 'ICS/NCCP(I)/IAB 2019',
  U4: 'ASRA checklist',
  U6: 'ATS 2012',
  U7: 'IDSA/ATS 2016',
  U14: 'BTS 2013',
  U15: 'Nashville scale, Chest 2020',
  U16: 'ACCP 2011',
}

export function numberSourceName(sourceId: BronchSourceId): string {
  return SOURCE_SHORT_NAMES[sourceId] ?? SOURCE_BY_ID.get(sourceId)?.title ?? sourceId
}

/** The sources behind a card's numbers, each named once, in the order the card first uses them. */
export function numberSourceNames(ids: readonly NumberId[]): readonly string[] {
  return [
    ...new Set(
      ids.flatMap((id) =>
        NUMBER_REGISTER[id].sources.map((source) => numberSourceName(source.sourceId)),
      ),
    ),
  ]
}

/**
 * Whether a card using these rows should send the learner to the local protocol: it teaches a
 * guideline or device value. A definition is the same everywhere, and a local slot already says so.
 */
export function numbersNeedLocalCheck(ids: readonly NumberId[]): boolean {
  return ids.some((id) => {
    const row = NUMBER_REGISTER[id]
    return !row.isDefinition && row.class !== 'local-slot'
  })
}

/** The rows faculty has not signed yet. A published course may use none of them. */
export function unsignedNumberIds(ids: readonly NumberId[]): readonly NumberId[] {
  return ids.filter((id) => NUMBER_REGISTER[id].signedBy === null)
}

/** What is wrong with the register itself. Checked at import. */
export function numberRegisterErrors(): readonly string[] {
  const errors: string[] = []
  for (const id of NUMBER_IDS) {
    const row = NUMBER_REGISTER[id]
    const where = `Number ${id}`
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) errors.push(`${where} is not a kebab-case id.`)
    for (const source of row.sources)
      if (!SOURCE_BY_ID.has(source.sourceId))
        errors.push(`${where} cites an unregistered source ${source.sourceId}.`)
    if (row.status === 'to-extract' && row.value !== null)
      errors.push(`${where} is marked to extract but carries a value.`)
    if ((row.status === 'verified' || row.status === 'signed') && row.value === null)
      errors.push(`${where} is ${row.status} with no value.`)
    if ((row.status === 'verified' || row.status === 'signed') && row.sources.length === 0)
      errors.push(`${where} is ${row.status} with no source.`)
    if ((row.status === 'verified' || row.status === 'signed') && !(row.checkedOn && row.checkedBy))
      errors.push(`${where} is ${row.status} without the date and the person who checked it.`)
    if ((row.status === 'signed') !== (row.signedBy !== null))
      errors.push(`${where}: a row is signed exactly when it names who signed it.`)
    if (row.class === 'local-slot' && !row.fallback && row.value === null)
      errors.push(`${where} is a local slot with nothing to say when it is not configured.`)
  }
  for (const id of Object.keys(INSTITUTION_VALUES))
    if (!isNumberId(id)) errors.push(`An institution value is set for an unknown number "${id}".`)
  return errors
}

const registerErrors = numberRegisterErrors()
if (registerErrors.length > 0) {
  throw new Error(`The numbers register is invalid:\n${registerErrors.join('\n')}`)
}
