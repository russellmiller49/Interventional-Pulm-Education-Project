import type { SupportMode } from '../engine/types'
import {
  ecmoCircuitSegmentById,
  ecmoPressureZone,
  ecmoPressureZoneById,
  ecmoSensorSite,
  ecmoSensorSiteById,
  resolveEcmoModeText,
  type EcmoCircuitSegmentId,
  type EcmoModeText,
  type EcmoPressureZoneId,
  type EcmoSensorSiteId,
} from './circuitSegments'
import { evidenceById, validateEvidenceIds } from './evidence'
import type { ecmoDerivedValueGuides } from './ecmoValueGuides'

/**
 * The one diagnostic grammar: which pattern moved, where the problem lives, what to inspect.
 *
 * The module taught this four times in four voices. Three of the sentences below were a private
 * array inside `PumpPressureZonesPanel` called "mechanism previews"; the fourth was prose in the
 * gas drill; and both integration capstones paraphrased all four again in a per-signal matrix. A
 * grammar that is paraphrased is a grammar that drifts, and a learner who meets "both post-pump
 * pressures rise together" in one lesson and "they rise together, and the gradient does not follow"
 * in the next cannot tell whether the second sentence is the same rule or a new one.
 *
 * So the sentences live here, once. A lesson selects a row and a depth; no lesson restates a row.
 *
 * What a row deliberately does not do: name a threshold, name a number, or promise that the
 * shortlist is exhaustive. The cause lists are what to inspect first, drawn from the reviewed
 * teaching in the drills that own each pattern — not a differential a learner should stop at.
 */

export const ecmoLocalizationRowIds = [
  'drainage-limitation',
  'return-path-resistance',
  'membrane-resistance',
  'gas-path-failure',
] as const
export type EcmoLocalizationRowId = (typeof ecmoLocalizationRowIds)[number]

/**
 * The four drill families that teach these patterns, VV and VA alike.
 *
 * Recorded on the row so a later package adapting the held drill panels selects a row by family
 * rather than renaming anything: `preload-drainage-collapse` and `va-preload-drainage-collapse` are
 * both `preload`, and both want the drainage row.
 */
export type EcmoDrillFamily =
  | 'preload'
  | 'return-obstruction'
  | 'oxygenator-resistance'
  | 'gas-source-interruption'

export interface EcmoLocalizationSourceSupport {
  readonly evidenceId: string
  /** The limited claim this row takes from that source — never the whole of what it covers. */
  readonly claim: string
}

export interface EcmoLocalizationRow {
  readonly id: EcmoLocalizationRowId
  readonly label: string
  /** The canonical signature sentence. Authored here and quoted nowhere else. */
  readonly signature: EcmoModeText
  /** Where the problem lives, which is not always where the pattern shows. */
  readonly problemLocation: string
  /** The reading groupings the pattern shows in, in the order a learner reads them. */
  readonly zoneIds: readonly [EcmoPressureZoneId, ...EcmoPressureZoneId[]]
  /**
   * How those groupings are introduced.
   *
   * Three rows send a learner to read a change. The gas row sends them to notice an absence — what
   * localizes it is that the blood-path pressures have *not* moved — and telling them to "read in"
   * those zones would send them hunting for a pressure change this model cannot produce. The lead
   * lives here rather than in a renderer because the card draws each row twice, as a block and as
   * prose, and the first version of that split had the block saying "quiet" while the paragraph
   * under it said "read in".
   */
  readonly zoneLead: 'read-in' | 'quiet'
  /** The channels that carry the pattern. */
  readonly sensorSiteIds: readonly [EcmoSensorSiteId, ...EcmoSensorSiteId[]]
  /** What the minimap marks when this row is the explanation. */
  readonly implicatedSegmentIds: readonly [EcmoCircuitSegmentId, ...EcmoCircuitSegmentId[]]
  /** What to inspect first. Four at most, because a longer list is not carried to a bedside. */
  readonly causes: readonly string[]
  /** The class of response that fits, never a prescription and never a setting. */
  readonly actionClass: string
  readonly harmfulReflex: string
  readonly modelBoundary: string
  readonly vaVariation: string
  readonly sourceSupport: readonly [
    EcmoLocalizationSourceSupport,
    ...EcmoLocalizationSourceSupport[],
  ]
  readonly valueGuideKeys?: readonly (keyof typeof ecmoDerivedValueGuides)[]
  /**
   * Whether any of this row may be shown before a learner commits a prediction.
   *
   * `never`, on all four, and stated as a field rather than left to each consumer to remember. A
   * row names a mechanism and the move that fits it; showing one beside an uncommitted prediction
   * would answer the question the drill is asking. The foundation scaffold is not an exception —
   * it shows a strictly smaller thing (pattern and location), built by its own text builder.
   */
  readonly precommitVisibility: 'never'
  readonly drillFamily: EcmoDrillFamily
}

const MODEL = 'bounded-educational-model'

export const ecmoLocalizationRows: readonly EcmoLocalizationRow[] = Object.freeze([
  {
    id: 'drainage-limitation',
    label: 'Drainage limitation',
    signature:
      'Drainage pressure becomes more negative; flow stops following speed and may become unstable.',
    problemLocation: 'Upstream of the pump — the drainage path from patient to pump inlet.',
    zoneIds: ['upstream-of-pump', 'downstream-of-pump'],
    zoneLead: 'read-in',
    sensorSiteIds: ['pVen', 'pInt', 'pArt'],
    implicatedSegmentIds: ['drainage'],
    causes: [
      'Cannula position',
      'A kinked or compressed drainage limb',
      'Coughing, straining, or pressure around the vessel',
      'Volume state',
    ],
    actionClass:
      'Two acts, in order: ease pump demand so the collapse quiets — a holding action, which corrects nothing — then find and correct what venous return is short of, at the patient, the limb, and the cannula.',
    harmfulReflex: 'Raising the speed to chase the displayed flow.',
    modelBoundary:
      'The drainage this circuit can supply, and the point at which the limb starts to judder, are quantities this simulation authors for teaching. No universal drainage-pressure cut point exists.',
    vaVariation:
      'The pattern is the same. What changes is the reassessment: circuit flow is one contributor to systemic perfusion, so the endpoint is the patient rather than the flow display.',
    sourceSupport: [
      {
        evidenceId: 'ecmo-book-ch17',
        claim: 'Preload is one of the named limits on the blood flow a circuit can deliver.',
      },
      {
        evidenceId: 'ecmo-book-ch9',
        claim:
          'The centrifugal pump is preload dependent, and the drainage pressure sensor sits upstream of it.',
      },
      {
        evidenceId: 'elso-adult-vv-2021',
        claim: 'What you find at the patient belongs beside what the circuit is reporting.',
      },
      {
        evidenceId: MODEL,
        claim:
          'The drainage capacity, the judder, and the size of every response shown here are authored educational quantities.',
      },
    ],
    valueGuideKeys: ['pVen', 'circuitBloodFlow'],
    precommitVisibility: 'never',
    drillFamily: 'preload',
  },
  {
    id: 'return-path-resistance',
    label: 'Return-side resistance',
    signature:
      'Both post-pump pressures rise together; the gradient across the membrane changes little.',
    problemLocation:
      'Downstream of the membrane — the return path from membrane outlet to the patient.',
    zoneIds: ['downstream-of-pump', 'across-membrane'],
    zoneLead: 'read-in',
    sensorSiteIds: ['pInt', 'pArt', 'deltaP'],
    implicatedSegmentIds: ['post-membrane', 'return'],
    causes: [
      'A kinked or compressed return limb',
      'Thrombus in the return path',
      'Return-cannula position',
      'On VA, the arterial pressure the return is pushing against',
    ],
    actionClass:
      'Inspect the return path from membrane outlet to cannula. On VA, read the patient’s arterial pressure from its own monitor beside the circuit pressures rather than inferring it from them.',
    harmfulReflex: 'Driving the pump harder against the resistance.',
    modelBoundary:
      'This simulation authors the resistance so the pressure pattern can be read. It does not model what is causing it, or how such a cause would develop over time.',
    vaVariation:
      'Arterial afterload joins the shortlist, and the circuit return pressure still is not the patient’s arterial blood pressure — that comes from the independent monitor.',
    sourceSupport: [
      {
        evidenceId: 'elso-circuit-2022',
        claim: 'Circuit components are monitored for obstruction as part of circuit safety.',
      },
      {
        evidenceId: 'ecmo-book-ch9',
        claim:
          'The centrifugal pump is afterload sensitive, and both post-pump pressures sit downstream of it.',
      },
      {
        evidenceId: 'ecmo-book-ch17',
        claim: 'Afterload is one of the named limits on delivered blood flow.',
      },
      {
        evidenceId: MODEL,
        claim: 'The resistance and its effect on the pressures are authored for this case.',
      },
    ],
    valueGuideKeys: ['pInt', 'pArt', 'transmembraneDeltaP'],
    precommitVisibility: 'never',
    drillFamily: 'return-obstruction',
  },
  {
    id: 'membrane-resistance',
    label: 'Membrane resistance',
    signature:
      'The pre-membrane pressure separates from the return pressure; the gradient widens. Read that separation at similar blood flow, against this circuit’s own earlier gradient.',
    problemLocation: 'The membrane lung itself.',
    zoneIds: ['across-membrane', 'downstream-of-pump'],
    zoneLead: 'read-in',
    sensorSiteIds: ['pInt', 'pArt', 'deltaP', 'post-oxygenator-saturation'],
    implicatedSegmentIds: ['membrane'],
    causes: [
      'Progressive clot or fibrin burden, the leading clinical cause of a gradient that is genuinely widening',
      'A higher blood flow, which widens the gradient with no change in the membrane',
      'Changed blood viscosity or temperature, which does the same',
    ],
    actionClass:
      'Trend it against this circuit’s own baseline at matched flow, corroborate with what the membrane is returning, and escalate through the pathway your unit uses. A widening trend is a reason to plan, not a reason to act on one gradient.',
    harmfulReflex:
      'Acting on a single gradient — exchanging a component, or driving the circuit harder, on one number.',
    modelBoundary:
      'Clot burden, haemolysis, and change over time are not modelled. This simulation authors a resistance so the pattern can be read, and no universal gradient cut point exists.',
    vaVariation:
      'The pattern and the discipline are unchanged. The gradient belongs to the circuit and says nothing about the patient’s own arterial pressure.',
    sourceSupport: [
      {
        evidenceId: 'elso-circuit-2022',
        claim: 'The membrane is monitored through the pressure gradient across it.',
      },
      {
        evidenceId: 'ifu-anomaly-boundary',
        claim:
          'This console displays the pressure drop as a trend, without a fixed alarm-priority claim.',
      },
      {
        evidenceId: 'ecmo-book-ch9',
        claim: 'The circuit pressure zones place one sensor either side of the membrane.',
      },
      {
        evidenceId: MODEL,
        claim:
          'The resistance is authored so the pattern can be read; no clot burden is represented.',
      },
    ],
    valueGuideKeys: ['transmembraneDeltaP', 'pInt', 'pArt'],
    precommitVisibility: 'never',
    drillFamily: 'oxygenator-resistance',
  },
  {
    id: 'gas-path-failure',
    label: 'Gas-path failure',
    signature:
      'Blood-path pressures and flow sit where they were, while gas transfer falls away — what the membrane returns drops, and the patient’s carbon dioxide and pH follow.',
    problemLocation:
      'Not the blood path — the gas path: the source, the blender, the line into the membrane, and the membrane’s gas side.',
    zoneIds: ['upstream-of-pump', 'downstream-of-pump', 'across-membrane'],
    zoneLead: 'quiet',
    sensorSiteIds: ['post-oxygenator-saturation', 'pVen', 'pInt', 'pArt'],
    implicatedSegmentIds: ['gas-supply', 'membrane-gas-side'],
    causes: [
      'Supply interrupted at the source',
      'Blender settings, read against what is actually flowing',
      'The gas line into the membrane',
      'The membrane’s gas side',
    ],
    actionClass:
      'Trace the gas path in that order and re-establish delivery you have verified. A setting on a blender is a request, not proof that gas is reaching the membrane.',
    harmfulReflex: 'Raising pump speed because less oxygenated blood is reaching the patient.',
    modelBoundary:
      'Gas hardware and an inline gas analyser are not represented. How fast the values move in this simulation follows an authored curve rather than bedside kinetics.',
    vaVariation:
      'The same failure starves the arterial return of gas exchange. Circuit flow that has not changed is not evidence that the blood being returned is oxygenated.',
    sourceSupport: [
      {
        evidenceId: 'ecmo-book-ch18',
        claim:
          'Sweep gas primarily drives carbon-dioxide clearance, and sweep-gas oxygen fraction is a separate setting from sweep flow.',
      },
      {
        evidenceId: 'elso-circuit-2022',
        claim: 'The gas path is a monitored circuit component in its own right.',
      },
      {
        evidenceId: MODEL,
        claim: 'The response and how quickly it appears are bounded educational quantities.',
      },
    ],
    valueGuideKeys: ['circuitBloodFlow', 'transmembraneDeltaP'],
    precommitVisibility: 'never',
    drillFamily: 'gas-source-interruption',
  },
])

/**
 * The footer every view of the card carries.
 *
 * It is here rather than in the three pressure rows because it is one rule about one quantity, and
 * repeating it per row is how the qualification gets dropped from the row someone reads quickly.
 * The registered gradient guide states the same rule at length; this is the sentence, and the guide
 * is where a learner goes for the rest of it.
 */
export const ECMO_LOCALIZATION_FOOTER = {
  text: 'The gradient across the membrane is a resistance multiplied by a flow: compare it at similar blood flow, against this circuit’s own earlier value, never against a number carried from another circuit.',
  valueGuideKey: 'transmembraneDeltaP',
} as const satisfies {
  readonly text: string
  readonly valueGuideKey: keyof typeof ecmoDerivedValueGuides
}

/**
 * What the scaffolded table is, said where a learner meets it.
 *
 * The four rows each carry a boundary about the fault they explain, and none of those is the right
 * thing to say beside a table shown against a circuit with nothing wrong with it. This one answers
 * the question that view actually raises: these are directions the simulation can produce, not a
 * catalogue of everything a real circuit does.
 */
export const ECMO_LOCALIZATION_SCAFFOLD_BOUNDARY =
  'These are the patterns this simulation can produce and the places it can put them. A real circuit fails in ways this model does not represent, and none of these rows is a complete list of what could be wrong.'

export const ecmoLocalizationRowById: ReadonlyMap<EcmoLocalizationRowId, EcmoLocalizationRow> =
  new Map(ecmoLocalizationRows.map((row) => [row.id, row]))

export function ecmoLocalizationRow(id: EcmoLocalizationRowId): EcmoLocalizationRow {
  const row = ecmoLocalizationRowById.get(id)
  if (!row) throw new Error(`Unknown ECMO localization row: ${id}`)
  return row
}

const ZONE_LEAD_TEXT: Readonly<Record<EcmoLocalizationRow['zoneLead'], string>> = {
  'read-in': 'Read in',
  quiet: 'Quiet, and that is the finding',
}

/**
 * Where the pattern shows, phrased the way this row needs it phrased.
 *
 * Used by the rendered row block and by the row's prose equivalent, so the two cannot disagree
 * about whether a learner is being sent to read a change or to notice its absence.
 */
export function ecmoLocalizationZoneSentence(rowId: EcmoLocalizationRowId): string {
  const row = ecmoLocalizationRow(rowId)
  const zones = row.zoneIds.map((zoneId) => ecmoPressureZone(zoneId).label)
  return `${ZONE_LEAD_TEXT[row.zoneLead]}: ${zones.join(', ')}.`
}

export function ecmoLocalizationRowsForZone(
  zoneId: EcmoPressureZoneId,
): readonly EcmoLocalizationRow[] {
  return ecmoLocalizationRows.filter((row) => row.zoneIds.includes(zoneId))
}

/**
 * The revealed row, in prose.
 *
 * Everything the row block shows, in the order it shows it, so a learner reading with a screen
 * reader gets the same grammar in the same sequence rather than a table read cell by cell.
 */
export function ecmoLocalizationRowTextEquivalent(
  supportMode: SupportMode,
  rowId: EcmoLocalizationRowId,
): string {
  const row = ecmoLocalizationRow(rowId)
  const sites = row.sensorSiteIds
    .map((siteId) => {
      const site = ecmoSensorSite(siteId)
      return `${site.plainName} (${site.deviceLabel})`
    })
    .join(', ')
  const sentences = [
    `${row.label}. ${resolveEcmoModeText(row.signature, supportMode)}`,
    `${ecmoLocalizationZoneSentence(rowId)} Carried by ${sites}.`,
    `Where the problem lives: ${row.problemLocation}`,
    `What to inspect: ${row.causes.join('; ')}.`,
    `What fits: ${row.actionClass}`,
    `The reflex to avoid: ${row.harmfulReflex}`,
  ]
  if (supportMode === 'va') sentences.push(`On VA: ${row.vaVariation}`)
  sentences.push(`Model boundary: ${row.modelBoundary}`)
  return sentences.join(' ')
}

/**
 * The scaffolded table, in prose.
 *
 * Deliberately shorter than the revealed row: pattern and location only, because the table it
 * describes is shown to a learner who has not been asked to diagnose anything yet. Building it from
 * the same records rather than from its own copy is what keeps the two views of one grammar from
 * becoming two grammars.
 */
export function ecmoLocalizationScaffoldTextEquivalent(supportMode: SupportMode): string {
  const rows = ecmoLocalizationRows
    .map(
      (row) =>
        `${row.label}: ${resolveEcmoModeText(row.signature, supportMode)} ${row.problemLocation}`,
    )
    .join(' ')
  return `Four patterns, and where each one lives. ${rows} ${ECMO_LOCALIZATION_FOOTER.text}`
}

export function validateEcmoLocalizationCardRegistry(): readonly string[] {
  const errors: string[] = []
  const declared = ecmoLocalizationRows.map((row) => row.id)

  if (new Set(ecmoLocalizationRowIds).size !== ecmoLocalizationRowIds.length) {
    errors.push('duplicate row id in the tuple')
  }
  if (new Set(declared).size !== declared.length) errors.push('duplicate row record')
  for (const id of ecmoLocalizationRowIds) {
    if (!declared.includes(id)) errors.push(`row ${id} is declared but has no record`)
  }
  for (const id of declared) {
    if (!(ecmoLocalizationRowIds as readonly string[]).includes(id)) {
      errors.push(`row ${id} has a record but is not declared`)
    }
  }

  const families = ecmoLocalizationRows.map((row) => row.drillFamily)
  if (new Set(families).size !== families.length) {
    errors.push('two rows claim the same drill family, so a family cannot select one row')
  }

  for (const row of ecmoLocalizationRows) {
    for (const zoneId of row.zoneIds) {
      if (!ecmoPressureZoneById.has(zoneId))
        errors.push(`${row.id}: unknown pressure zone ${zoneId}`)
    }
    for (const siteId of row.sensorSiteIds) {
      if (!ecmoSensorSiteById.has(siteId)) errors.push(`${row.id}: unknown sensor site ${siteId}`)
    }
    for (const segmentId of row.implicatedSegmentIds) {
      if (!ecmoCircuitSegmentById.has(segmentId)) {
        errors.push(`${row.id}: unknown implicated segment ${segmentId}`)
      }
    }

    if (row.causes.length === 0) errors.push(`${row.id}: no cause shortlist`)
    if (row.causes.length > 4) errors.push(`${row.id}: more causes than a learner will carry`)
    if (row.actionClass.length === 0) errors.push(`${row.id}: no action class`)
    if (row.harmfulReflex.length === 0) errors.push(`${row.id}: no harmful reflex`)
    if (row.problemLocation.length === 0) errors.push(`${row.id}: does not say where it lives`)
    if (row.vaVariation.length === 0) errors.push(`${row.id}: does not say what VA changes`)

    // The teaching-panel contract looks for these words when it checks a boundary is a boundary.
    if (!/simulation|model/i.test(row.modelBoundary)) {
      errors.push(`${row.id}: the model boundary does not say it is about this simulation`)
    }

    if (row.sourceSupport.length === 0) errors.push(`${row.id}: no source support`)
    if (!validateEvidenceIds(row.sourceSupport.map((support) => support.evidenceId))) {
      errors.push(`${row.id}: names a source that is not registered`)
    }
    for (const support of row.sourceSupport) {
      if (support.claim.length === 0) {
        errors.push(`${row.id}: cites ${support.evidenceId} without saying what it supports`)
      }
      const record = evidenceById.get(support.evidenceId)
      if (record && record.supports.length === 0) {
        errors.push(`${row.id}: cites ${support.evidenceId}, which supports nothing`)
      }
    }
    if (!row.sourceSupport.some((support) => support.evidenceId === MODEL)) {
      errors.push(`${row.id}: authored simulation behaviour is not attributed to the bounded model`)
    }

    /*
     * No number, anywhere on a row.
     *
     * The rule this module is strictest about is that a learner should leave with a direction and a
     * comparison rather than a threshold. A row is the most quotable thing here, so it is the last
     * place a number should be allowed to appear.
     */
    for (const value of [
      row.label,
      resolveEcmoModeText(row.signature, 'vv'),
      resolveEcmoModeText(row.signature, 'va'),
      row.problemLocation,
      row.actionClass,
      row.harmfulReflex,
      row.modelBoundary,
      row.vaVariation,
      ...row.causes,
      ...row.sourceSupport.map((support) => support.claim),
    ]) {
      if (/\d/.test(value)) errors.push(`${row.id}: a number appears in learner-facing copy`)
    }
  }

  if (/\d/.test(ECMO_LOCALIZATION_FOOTER.text))
    errors.push('footer: a number appears in the footer')

  if (/\d/.test(ECMO_LOCALIZATION_SCAFFOLD_BOUNDARY)) {
    errors.push('scaffold boundary: a number appears in it')
  }
  if (!/simulation|model/i.test(ECMO_LOCALIZATION_SCAFFOLD_BOUNDARY)) {
    errors.push('scaffold boundary: does not say which simulation it is about')
  }

  return errors
}

const localizationErrors = validateEcmoLocalizationCardRegistry()
if (localizationErrors.length > 0) {
  throw new Error(`Invalid ECMO localization-card registry:\n- ${localizationErrors.join('\n- ')}`)
}
