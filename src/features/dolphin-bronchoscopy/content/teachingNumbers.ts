import {
  defineTeachingNumbers,
  teachingNumberErrors,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'
import { DOLPHIN_SOURCE_IDS } from '../data/sources'
import { DOLPHIN_BRONCHOSCOPY_MODULE_ID } from './release'

/**
 * Every number the Dolphin Bronchoscopy module teaches, with its source.
 *
 * Copy states these values in its own words and names the rows it uses (`numberIds`); the
 * authoring rules refuse a digit in learner copy that no cited row, airway label or case value
 * accounts for. Where sources differ, both rows are taught side by side and say which source gives
 * which.
 *
 * Checked 2026-11-03 against the files in the owner's Drive, read in place. The 2024 deck exports
 * without slide numbers, so its locators are slide titles. Corrections that check made to the
 * build plan: Tsang's 4–5 cm nasopharynx is its width, not its length; Ivančić's doses are for CT
 * transport, not bronchoscopy; "9" branches comes from the poster and the 2019 form, not from
 * Harper; the poster's "frequent" paired branches occur in 1 to 4 of the 10 animals in the data
 * sheet, and the module teaches the counts.
 *
 * Not here because no source gives them: premedication doses (oral diazepam, tramadol), furosemide
 * and albuterol doses, the lidocaine jelly volume, the expected lavage return. The module teaches
 * those drugs and decisions "per the NMMP protocol" until the owner supplies a value and locator.
 *
 * None is signed: `npm run numbers:signoff -- dolphin-bronchoscopy`.
 */
const CHECKED = { checkedOn: '2026-11-03', signedBy: null, signedOn: null } as const

const FULL_TEXT = 'Claude, against the full text in the owner’s Drive'
const DECK = 'Claude, against the deck text in the owner’s Drive (the export has no slide numbers)'
const MAPPING =
  'Claude, against the IAAAM 2026 poster and the Dolphin CT Branching Data sheet in the owner’s Drive'
const FROM_CASE = 'Claude, against geometry-review.json and centerline_labels.json of dolphin-001'

const cite = (
  sourceId: string,
  year: number,
  locator: string,
  grade: string | null = null,
): TeachingNumberCitation => ({ sourceId, year, grade, locator })

export const DOLPHIN_NUMBERS = defineTeachingNumbers(DOLPHIN_BRONCHOSCOPY_MODULE_ID, {
  // ── Why look ─────────────────────────────────────────────────────────────────────────────────
  'pneumonia-necropsy-share': {
    label: 'Pneumonia confirmed at death in a managed population',
    value: 'about half (21 of 42)',
    appliesTo:
      'U.S. Navy bottlenose dolphins that died between 1980 and 2010, confirmed by histopathology',
    class: 'expert-reference',
    sources: [cite('venn-watson-2012', 2012, 'Abstract; Table 1')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'tidal-exchange': {
    label: 'Air exchanged in one dolphin breath',
    value: '75–90% of the air in the lungs in one-third of a second',
    class: 'physiology',
    sources: [cite('venn-watson-2012', 2012, 'Introduction')],
    note: 'The same paragraph notes that dolphins have no turbinates or other upper-airway filters.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },

  // ── The passage ──────────────────────────────────────────────────────────────────────────────
  'bony-nasal-passage': {
    label: 'Bony nasal passage',
    value: '5–7 cm long and 2–3 cm across',
    class: 'physiology',
    sources: [cite('tsang-2002', 2002, 'p. 224')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'nasopharynx-width': {
    label: 'Nasopharynx, width',
    value: '4–5 cm across',
    class: 'physiology',
    sources: [cite('tsang-2002', 2002, 'p. 224')],
    note: 'Tsang gives the diameter, not the length.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'spout-length': {
    label: 'Laryngeal spout',
    value: 'about 5–7 cm long',
    class: 'physiology',
    sources: [cite('tsang-2002', 2002, 'pp. 224–225')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'laryngeal-cavity': {
    label: 'The cavity below the glottis',
    value: 'pear-shaped, 4–5 cm on its long axis',
    class: 'physiology',
    sources: [
      cite('tsang-2002', 2002, 'p. 225'),
      cite('dolphin-001-ct', 2026, 'centerline LX segment, 40–50 mm'),
    ],
    note: 'On this module’s CT the larynx segment measures 40–50 mm, within Tsang’s range.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'rtb-below-spout': {
    label: 'Right tracheal bronchus below the spout',
    value: 'about 10 cm below the lower end of the laryngeal spout',
    class: 'physiology',
    sources: [cite('tsang-2002', 2002, 'pp. 225–226, Figs 2–3')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'rtb-above-carina': {
    label: 'Right tracheal bronchus above the carina',
    value: 'about 5 cm (a mean of 5.1 cm on CT)',
    class: 'physiology',
    sources: [
      cite('tsang-2002', 2002, 'p. 226'),
      cite('ivancic-2014', 2014, 'Results; Table 2 (5.09 ± 0.65 cm)'),
      cite('dolphin-001-ct', 2026, 'TRA edge 6, RTB origin to carina node 7: 57 mm'),
    ],
    note: 'Tsang gives about 5 cm; Ivančić measured a mean of 5.1 cm in four dolphins on CT; this module’s CT measures 57 mm.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'rtb-diameter': {
    label: 'Right tracheal bronchus, widest diameter',
    value: '1.53 cm, about 42% of the 3.63 cm trachea',
    class: 'physiology',
    sources: [cite('ivancic-2014', 2014, 'Table 3')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'rtb-level': {
    label: 'Vertebral level of the right tracheal bronchus',
    value: 'T1–T2',
    class: 'physiology',
    sources: [cite('ivancic-2014', 2014, 'Results')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'carina-level': {
    label: 'Vertebral level of the carina',
    value: 'between T3 and the T4–T5 disc',
    class: 'physiology',
    sources: [cite('ivancic-2014', 2014, 'Results; Fig. 9')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'airway-generations-ct': {
    label: 'Airway generations visible on CT',
    value: '16–19 (mean 17)',
    class: 'physiology',
    sources: [cite('ivancic-2014', 2014, 'Results')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'thoracic-vertebrae-ribs': {
    label: 'Thoracic vertebrae and sternal ribs',
    value: '12 thoracic vertebrae; the first 4 ribs reach the sternum',
    class: 'physiology',
    sources: [cite('ivancic-2014', 2014, 'Results')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'porpoise-naris-limit': {
    label: 'Narrowest nasal opening in the harbor porpoise',
    value: '8.1 mm',
    appliesTo: 'Harbor porpoise, the smaller-species contrast case; not a dolphin value',
    class: 'physiology',
    sources: [cite('harper-2001', 2001, 'pp. 192, 194')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'porpoise-segmental-diameter': {
    label: 'Segmental bronchus diameter in the harbor porpoise',
    value: 'about 3 mm',
    appliesTo: 'Harbor porpoise; not measured in the dolphin',
    class: 'physiology',
    sources: [cite('harper-2001', 2001, 'p. 193')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'branches-per-main-bronchus': {
    label: 'Numbered branches off each main bronchus',
    value: '14 (the porpoise-based form records 9; this module’s CT shows 13 on the right)',
    appliesTo: 'Bottlenose dolphin, ten animals mapped from CT',
    class: 'expert-reference',
    sources: [
      cite(
        'nmmp-mapping-2026',
        2026,
        'Poster, Results ("9 vs. 14 bronchi"); data sheet LB1–14, RB1–14',
      ),
      cite('nmmp-form-2019', 2019, 'site list RB1–RB9, LB1–LB9'),
      cite('dolphin-001-ct', 2026, 'geometry-review.json RMBBranches (13), LMBBranches (14)'),
    ],
    note: 'Work in preparation, taught as counts with its basis.',
    checkedBy: MAPPING,
    ...CHECKED,
  },
  'mapping-sample': {
    label: 'Dolphins in the airway-mapping series',
    value: '10 (5 male, 5 female)',
    class: 'expert-reference',
    sources: [cite('nmmp-mapping-2026', 2026, 'Poster, Methods; data sheet column D')],
    checkedBy: MAPPING,
    ...CHECKED,
  },
  'mapping-paired-branches': {
    label: 'Branches that arose together from one point',
    value:
      'RB2 with RB3 in 4 of 10; RB4 with RB5 in 2; LB4/LB5, LB6/LB7, LB8/LB9, LB11/LB12 and RB5/RB6 in 1 each',
    class: 'expert-reference',
    sources: [cite('nmmp-mapping-2026', 2026, 'Dolphin CT Branching Data, Sheet1')],
    note: 'The poster calls concurrent emergence frequent; the data sheet counts are what the module teaches. The sheet notes the CTs were flipped horizontally before reading, so sides are to be confirmed.',
    checkedBy: MAPPING,
    ...CHECKED,
  },
  'mapping-lb10': {
    label: 'Direction of LB10',
    value: 'lateral in all 5 females; in the 5 males, lateral 2, dorsomedial 2, ventral 1',
    class: 'expert-reference',
    sources: [cite('nmmp-mapping-2026', 2026, 'Poster, Results; data sheet column N')],
    checkedBy: MAPPING,
    ...CHECKED,
  },
  'mapping-lb1': {
    label: 'Direction of LB1',
    value: 'lateral in all 5 females; dorsolateral in all 5 males',
    class: 'expert-reference',
    sources: [cite('nmmp-mapping-2026', 2026, 'Dolphin CT Branching Data, Sheet1')],
    checkedBy: MAPPING,
    ...CHECKED,
  },
  'mapping-rb1': {
    label: 'Direction of RB1',
    value: 'dorsolateral in all 10',
    class: 'expert-reference',
    sources: [cite('nmmp-mapping-2026', 2026, 'Dolphin CT Branching Data, Sheet1')],
    checkedBy: MAPPING,
    ...CHECKED,
  },

  // ── Instruments ──────────────────────────────────────────────────────────────────────────────
  'scope-reach-tsang': {
    label: 'Reach of a 55 cm bronchoscope through the blowhole',
    value:
      'a 55 cm Olympus BF P30 reached the origins of 3–4 subsegmental branches, 3–4 cm past the carina',
    appliesTo:
      'The bottlenose dolphins in Tsang’s series; in the false killer whale it reached only the carina',
    class: 'device',
    sources: [cite('tsang-2002', 2002, 'p. 226')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'scope-working-length': {
    label: 'Working length, bronchoscope against gastrointestinal endoscope',
    value: '600 mm bronchoscope; 1030 mm gastrointestinal scope',
    class: 'device',
    sources: [
      cite(
        'nmmp-workshop-2024',
        2024,
        'Module 1 slides (Gildea), “GI Endoscopes vs Bronchoscopes”',
      ),
    ],
    note: 'The slide names no models; the owner is to name them so the row can cite an IFU.',
    checkedBy: DECK,
    ...CHECKED,
  },
  'scope-harper': {
    label: 'The gastroscope used in the harbor porpoise',
    value: 'Olympus GIF-100: 104 cm working length, 9.5 mm outer diameter, 2.8 mm channel',
    class: 'device',
    sources: [cite('harper-2001', 2001, 'Materials and methods')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },

  // ── Before the day ───────────────────────────────────────────────────────────────────────────
  'fasting-tsang': {
    label: 'Fast before the procedure, as Tsang held it',
    value: '4–6 h without food',
    class: 'expert-reference',
    sources: [cite('tsang-2002', 2002, 'p. 224')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },

  // ── Sedation and topical anaesthesia ─────────────────────────────────────────────────────────
  'midazolam-im-first': {
    label: 'Midazolam, first dose',
    value: '0.06–0.08 mg/kg IM',
    class: 'expert-reference',
    sources: [cite('nmmp-workshop-2024', 2024, 'slide “Bronchoscopy Sedation protocol”')],
    checkedBy: DECK,
    ...CHECKED,
  },
  'midazolam-topup': {
    label: 'Midazolam, top-up',
    value: '0.01 mg/kg IV or IM',
    class: 'expert-reference',
    sources: [cite('nmmp-workshop-2024', 2024, 'slide “Bronchoscopy Sedation protocol”')],
    checkedBy: DECK,
    ...CHECKED,
  },
  'midazolam-im-tsang': {
    label: 'Midazolam IM, as Tsang gave it for bronchoscopy',
    value: '0.04–0.06 mg/kg IM',
    class: 'expert-reference',
    sources: [cite('tsang-2002', 2002, 'p. 224')],
    note: 'Sources differ: the NMMP workshop gives 0.06–0.08 mg/kg IM.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'midazolam-im-ivancic': {
    label: 'Midazolam IM, for transport to CT',
    value: '0.02–0.09 mg/kg IM',
    appliesTo: 'Sedation for CT in the live dolphin, not for bronchoscopy',
    class: 'expert-reference',
    sources: [cite('ivancic-2014', 2014, 'Methods')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'diazepam-po-tsang': {
    label: 'Diazepam by mouth, as Tsang gave it',
    value: '0.16–0.17 mg/kg PO',
    class: 'expert-reference',
    sources: [cite('tsang-2002', 2002, 'p. 224')],
    note: 'The NMMP workshop lists oral diazepam an hour before as optional, without a dose.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  flumazenil: {
    label: 'Flumazenil, to reverse midazolam',
    value: '0.003–0.012 mg/kg IV or IM',
    appliesTo:
      'Given after CT in the live dolphin; the NMMP workshop names flumazenil without a dose',
    class: 'expert-reference',
    sources: [
      cite('ivancic-2014', 2014, 'Methods'),
      cite('nmmp-workshop-2024', 2024, 'slide “Bronchoscopy Sedation protocol”'),
    ],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'lidocaine-max': {
    label: 'Lidocaine, total topical maximum',
    value: '4 mg/kg',
    appliesTo:
      'Every way it is given, added together: atomizer, injection for catheter placement, jelly and the bronchial syringes',
    class: 'expert-reference',
    sources: [cite('nmmp-workshop-2024', 2024, 'slide “Lidocaine dosage”')],
    note: 'The workshop works the example for a 181 kg dolphin: 724 mg, which is 72.4 mL of 1% or 36.2 mL of 2%.',
    checkedBy: DECK,
    ...CHECKED,
  },
  'lidocaine-split': {
    label: 'Lidocaine, how the topical dose is given',
    value:
      'atomizer 10 mL and 5 mL injected for catheter placement, both 1%; jelly; syringes into the bronchi',
    class: 'expert-reference',
    sources: [cite('nmmp-workshop-2024', 2024, 'slide “Calculating the total dose”')],
    note: 'The slide leaves the jelly and intrabronchial volumes blank: they are counted as given. Its 5 mL line reads “Injection for catheter placement”.',
    checkedBy: DECK,
    ...CHECKED,
  },
  'lidocaine-strength': {
    label: 'Lidocaine in each milliliter',
    value: '1% is 10 mg/mL; 2% is 20 mg/mL',
    class: 'teaching-convention',
    sources: [cite('nmmp-workshop-2024', 2024, 'slide “Lidocaine dosage”')],
    note: 'The definition of percent strength (grams per 100 mL), worked on the workshop slide.',
    checkedBy: DECK,
    ...CHECKED,
  },
  'lignocaine-tsang': {
    label: 'Lignocaine, as Tsang gave it',
    value:
      '5 mL of 4% into the blowhole; 2 mL of 4% sprayed twice on the glottis; 2 mL of 2% each into the upper trachea, the tracheal bronchus and each main bronchus',
    class: 'expert-reference',
    sources: [cite('tsang-2002', 2002, 'pp. 224–226')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },

  // ── Sampling ─────────────────────────────────────────────────────────────────────────────────
  'bal-volume-nmmp': {
    label: 'Lavage volume that can be given safely, NMMP workshop',
    value: '2 mL/kg at most',
    class: 'expert-reference',
    sources: [
      cite('nmmp-workshop-2024', 2024, 'slide on bronchoalveolar lavage (question and answer)'),
    ],
    note: 'Sources differ: Tsang instilled 2 × 50 mL of warm saline. The workshop checklist line “Max lidocaine: Dose 2 mL/kg” is taken to mean this lavage volume.',
    checkedBy: DECK,
    ...CHECKED,
  },
  'bal-volume-tsang': {
    label: 'Lavage volume, as Tsang gave it',
    value: '2 × 50 mL of warm saline, with gentle suction',
    class: 'expert-reference',
    sources: [cite('tsang-2002', 2002, 'p. 226')],
    note: 'Done in two dolphins. Sources differ: the NMMP workshop gives 2 mL/kg.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },

  // ── Time ─────────────────────────────────────────────────────────────────────────────────────
  'procedure-duration': {
    label: 'Bronchoscopy time',
    value: '10–20 min',
    class: 'expert-reference',
    sources: [cite('tsang-2002', 2002, 'p. 226')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'shallow-water-recovery': {
    label: 'Recovery in shallow water',
    value: 'about 30 min',
    class: 'expert-reference',
    sources: [cite('tsang-2002', 2002, 'p. 226')],
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'breath-window': {
    label: 'How long the glottis stays open in a breath',
    value: 'a fraction of a second',
    class: 'teaching-convention',
    sources: [cite('tsang-2002', 2002, 'p. 225; Fig. 1 (descriptive; no measured value)')],
    note: 'Tsang describes the opening without measuring it. The simulator’s breathing cue holds it open longer so it can be seen, and says so.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },

  // ── This CT ──────────────────────────────────────────────────────────────────────────────────
  'case-animal': {
    label: 'The animal this module’s CT comes from',
    value: 'male bottlenose dolphin, 19 years, 213 kg',
    class: 'physiology',
    sources: [cite('dolphin-001-ct', 2026, 'case record')],
    checkedBy: FROM_CASE,
    ...CHECKED,
  },
})

export type DolphinNumberRowId = (typeof DOLPHIN_NUMBERS.rows)[number]['id']

export const DOLPHIN_NUMBER_IDS: ReadonlySet<string> = new Set(
  DOLPHIN_NUMBERS.rows.map((row) => row.id),
)

export function dolphinNumberErrors(): readonly string[] {
  return teachingNumberErrors(DOLPHIN_NUMBERS, DOLPHIN_SOURCE_IDS)
}

const registerErrors = dolphinNumberErrors()
if (registerErrors.length > 0) {
  throw new Error(`The dolphin numbers register is invalid:\n${registerErrors.join('\n')}`)
}
