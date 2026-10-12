import {
  defineTeachingNumbers,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical number the Cardiohelp ECMO module teaches that was withheld before the
 * teaching-first redo, with its source.
 *
 * Device rows were read in the CARDIOHELP-i Instructions for Use (United States, revision 2.3) and
 * cite records in `evidence.ts`. The textbook rows cite `ECMO_NUMBER_ONLY_SOURCES` until those
 * books are added to the evidence registry.
 *
 * None is signed: `npm run numbers:signoff -- cardiohelp-ecmo`.
 */
const CHECK = {
  checkedOn: '2026-10-08',
  checkedBy: 'Claude, against the source text',
  signedBy: null,
  signedOn: null,
} as const

/** Sources cited by a number and not yet in `content/evidence.ts`. */
export const ECMO_NUMBER_ONLY_SOURCES = [
  {
    id: 'TEXT-HEI-ELS-2023',
    title:
      'Hei F, Guan Y, Yu K, eds. Extracorporeal Life Support. Springer Nature Singapore; 2023.',
  },
  {
    id: 'TEXT-SCHMIDT-ECMO-ADULTS-2022',
    title:
      'Schmidt GA, ed. Extracorporeal Membrane Oxygenation for Adults. 2nd ed. Springer Nature Switzerland; 2022.',
  },
  {
    id: 'TEXT-TAHA-ECMO-PRACTICAL-2024',
    title:
      'Taha AR, Caridi-Scheible M, Leiendecker ER, Miller CF, eds. ECMO: A Practical Guide to Management. Springer Nature Switzerland; 2024.',
  },
] as const

const cite = (
  sourceId: string,
  year: number,
  locator: string,
  grade: string | null = null,
): TeachingNumberCitation => ({ sourceId, year, grade, locator })

const IFU = 'ifu-us-2025-scope'
const IFU_LIMITS = '§14.10.2 Warning Limits, Alarm Limits and Interventions, pp. 204–205'
const HEI = 'TEXT-HEI-ELS-2023'
const SCHMIDT = 'TEXT-SCHMIDT-ECMO-ADULTS-2022'
const TAHA = 'TEXT-TAHA-ECMO-PRACTICAL-2024'

export const ECMO_NUMBERS = defineTeachingNumbers('cardiohelp-ecmo', {
  'pven-factory-limits': {
    label: 'Venous pressure (pVen), factory limits',
    value: 'warning at −100 mmHg, alarm at −150 mmHg',
    class: 'device',
    sources: [cite(IFU, 2025, IFU_LIMITS)],
    note: 'Factory settings; a program sets its own. The same manual advises avoiding negative pressures beyond −75 mmHg where possible.',
    ...CHECK,
  },
  'negative-pressure-caution': {
    label: 'Negative pressure the manual advises avoiding',
    value: 'beyond −75 mmHg',
    class: 'device',
    sources: [cite(IFU, 2025, '§2.2.4 General Precautionary Measures During Use, p. 18')],
    note: 'To prevent cavitation and hemolysis. A rapid swing from low to high negative pressure in the venous line is also to be avoided.',
    ...CHECK,
  },
  'pint-part-factory-limits': {
    label: 'Internal and arterial pressure (pInt, pArt), factory limits',
    value: 'warning at 400 mmHg, alarm at 500 mmHg',
    class: 'device',
    sources: [cite(IFU, 2025, IFU_LIMITS)],
    ...CHECK,
  },
  'pressure-drop-factory-limit': {
    label: 'Pressure drop across the oxygenator (Δp), factory upper limit',
    value: '60 mmHg',
    class: 'device',
    sources: [cite(IFU, 2025, IFU_LIMITS)],
    note: 'The lower limit is deactivated at the factory. The trend at a fixed flow matters more than one value.',
    ...CHECK,
  },
  'pressure-drop-typical': {
    label: 'Pressure drop across the oxygenator, usual operating range',
    value: '10 to 35 mmHg',
    class: 'expert-reference',
    sources: [cite(SCHMIDT, 2022, 'Table 2.1 Circuit pressures, p. 73')],
    ...CHECK,
  },
  'pump-inlet-pressure-typical': {
    label: 'Pressure before the pump, usual operating range',
    value: '−50 to −200 mmHg',
    class: 'expert-reference',
    sources: [cite(SCHMIDT, 2022, 'Table 2.1 Circuit pressures, p. 73')],
    note: 'The textbook range runs past the Cardiohelp factory alarm (−150 mmHg) and the manual’s −75 mmHg caution. The sources differ; the console limits are the ones the machine acts on.',
    ...CHECK,
  },
  'pre-oxygenator-pressure-typical': {
    label: 'Pressure at the oxygenator inlet, usual operating range',
    value: '225 to 275 mmHg',
    class: 'expert-reference',
    sources: [cite(SCHMIDT, 2022, 'Table 2.1 Circuit pressures, p. 73')],
    ...CHECK,
  },
  'post-oxygenator-pressure-typical': {
    label: 'Pressure at the oxygenator outlet, usual operating range',
    value: '190 to 260 mmHg',
    class: 'expert-reference',
    sources: [cite(SCHMIDT, 2022, 'Table 2.1 Circuit pressures, p. 73')],
    ...CHECK,
  },
  'clamp-release-pressure': {
    label: 'Pump pressure above the pressure beyond a clamp before the clamp is opened',
    value: '10–20 mmHg',
    class: 'device',
    sources: [cite(IFU, 2025, '§2.2.4 Starting the Perfusion, p. 19')],
    note: 'The arterial clamp is not released with the pump running while the venous side is still clamped, and no clamp is opened at high speed.',
    ...CHECK,
  },
  'svo2-factory-limit': {
    label: 'Venous saturation (SvO₂), factory lower limit',
    value: '60%',
    class: 'device',
    sources: [cite(IFU, 2025, IFU_LIMITS)],
    ...CHECK,
  },
  'hb-factory-limits': {
    label: 'Hemoglobin, factory limits',
    value: '7.0 and 15.0 g/dL',
    class: 'device',
    sources: [cite(IFU, 2025, IFU_LIMITS)],
    note: 'Hematocrit factory limits are 21% and 40%.',
    ...CHECK,
  },
  'speed-factory-limit': {
    label: 'Pump speed, factory upper limit',
    value: '4,500 rpm',
    class: 'device',
    sources: [cite(IFU, 2025, '§14.10.1 Speed/Flow and §14.10.2, pp. 204–205')],
    note: 'The pump runs from 0 to 5,000 rpm.',
    ...CHECK,
  },
  'flow-factory-limit': {
    label: 'Blood flow, factory upper limit',
    value: '8.0 L/min',
    class: 'device',
    sources: [cite(IFU, 2025, IFU_LIMITS)],
    note: 'The disposable’s own maximum flow applies.',
    ...CHECK,
  },
  'full-support-flow': {
    label: 'Blood flow for full support in an adult',
    value: '60–80 mL/kg/min',
    class: 'expert-reference',
    sources: [cite(HEI, 2023, 'Ch. 1 Physiology of Extracorporeal Life Support, p. 15')],
    ...CHECK,
  },
  'sweep-start': {
    label: 'Starting sweep gas flow',
    value: '1:1 with blood flow',
    class: 'expert-reference',
    sources: [
      cite('ecmo-book-ch18', 2023, 'Ch. 18 Sweep Gas Flow Titration, initiation'),
      cite(HEI, 2023, 'Management of adult ECLS, Sweep Gas Flow'),
    ],
    note: 'The ECMO Book starts at 1:1; Hei and colleagues give 0.5:1 to 1:1.',
    ...CHECK,
  },
  'sweep-recheck': {
    label: 'First arterial blood gas after starting',
    value: '20–30 minutes',
    class: 'expert-reference',
    sources: [cite('ecmo-book-ch18', 2023, 'Ch. 18 Sweep Gas Flow Titration, initiation')],
    ...CHECK,
  },
  'paco2-correction-time': {
    label: 'Time over which hypercapnia is corrected after ECMO starts',
    value: '4–8 hours',
    class: 'expert-reference',
    sources: [cite(TAHA, 2024, 'Ch. 5 Physiology I: Venovenous ECMO, Fig. 5.5, p. 66')],
    note: 'A rapid fall in PaCO₂ changes cerebral blood flow and is associated with neurological complications.',
    ...CHECK,
  },
  'heparin-bolus': {
    label: 'Heparin bolus at cannulation',
    value: '50–100 units/kg',
    class: 'expert-reference',
    sources: [cite(HEI, 2023, 'Anticoagulation chapter, p. 72')],
    note: 'Given just before the cannulas go in. The lower end for severe coagulopathy, active bleeding or transthoracic cannulation.',
    ...CHECK,
  },
  'act-target': {
    label: 'Activated clotting time on heparin',
    value: '180–220 seconds',
    class: 'consensus',
    sources: [
      cite(SCHMIDT, 2022, 'p. 280, quoting the 2014 ELSO anticoagulation guideline'),
      cite(HEI, 2023, 'Ch. 9 Adverse Events and Complications, p. 121'),
    ],
    checkedOn: '2026-10-08',
    checkedBy:
      'Claude, against the two textbooks. The ELSO guideline they quote was not read directly',
    signedBy: null,
    signedOn: null,
  },
  'anti-xa-target': {
    label: 'Anti-factor Xa activity on heparin',
    value: '0.3–0.7 IU/mL',
    class: 'consensus',
    sources: [
      cite(SCHMIDT, 2022, 'p. 280, quoting the 2014 ELSO anticoagulation guideline'),
      cite(HEI, 2023, 'Ch. 9 Adverse Events and Complications, p. 121'),
    ],
    checkedOn: '2026-10-08',
    checkedBy:
      'Claude, against the two textbooks. The ELSO guideline they quote was not read directly',
    signedBy: null,
    signedOn: null,
  },
  'aptt-target': {
    label: 'aPTT on heparin',
    value: '1.5 to 2.5 times baseline',
    class: 'expert-reference',
    sources: [
      cite(HEI, 2023, 'Ch. 9 Adverse Events and Complications, p. 121'),
      cite(SCHMIDT, 2022, 'p. 280'),
    ],
    note: 'Schmidt reports that some centers use 50 to 80 seconds.',
    ...CHECK,
  },
  'va-flow-goal': {
    label: 'General goal for VA ECMO flow',
    value: '60 mL/kg/min',
    class: 'expert-reference',
    sources: [cite(TAHA, 2024, 'Ch. 6 Physiology II: Venoarterial ECMO, pp. 83–84')],
    note: 'Hei and colleagues give 60–80 mL/kg/min for full support. On peripheral VA the flow is titrated to the lowest that perfuses, because more flow is more afterload for the left ventricle.',
    ...CHECK,
  },
  'lv-vent-pulsatility': {
    label: 'Arterial pulsatility below which the left ventricle is vented',
    value: 'less than 10 mmHg between systolic and diastolic',
    class: 'expert-reference',
    sources: [
      cite(TAHA, 2024, 'Ch. 6 Physiology II: Venoarterial ECMO, Left Ventricular Venting, p. 85'),
    ],
    ...CHECK,
  },
  'air-entrainment-rate': {
    label: 'Air entering the circuit',
    value: 'about 4% of patients',
    class: 'expert-reference',
    sources: [cite(TAHA, 2024, 'Ch. 8 Complications and Emergencies, p. 130')],
    ...CHECK,
  },
})

export type EcmoNumberId = (typeof ECMO_NUMBERS.rows)[number]['id']

/**
 * First moves for air in the circuit, in the order the source's algorithm gives them.
 * Taha et al. 2024, Ch. 8, pp. 130–131.
 */
export const ECMO_AIR_FIRST_MOVES = Object.freeze({
  massiveVa: [
    'Clamp the circuit and stop the pump.',
    'Call for help and the backup circuit.',
    'Aspirate air seen in the arterial limb.',
    'Raise ventilator and inotropic support.',
    'Exchange the circuit if the air cannot be cleared quickly.',
  ],
  massiveVv: [
    'Find where the air is; if it is in the return limb, clamp at once.',
    'Find and fix the source.',
    'Call for help and the backup circuit.',
    'Aspirate air seen in the arterial limb.',
    'Exchange the circuit if the air cannot be cleared quickly.',
  ],
  source: cite(TAHA, 2024, 'Ch. 8 Complications and Emergencies, pp. 130–131'),
} as const)

/**
 * Differential hypoxemia on peripheral VA ECMO: how it is found and what is done, in order.
 * Taha et al. 2024, Ch. 6 Physiology II: Venoarterial ECMO, p. 86.
 */
export const ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES = Object.freeze({
  recognize:
    'Measure oxygenation in the right arm (right radial PaO₂ or SpO₂) or with a forehead probe.',
  moves: [
    'Improve native lung oxygenation with the ventilator.',
    'Raising VA flow moves the mixing point but loads the recovering left ventricle; use it as a temporary step.',
    'If the heart has recovered and the lungs have not, convert to VV.',
    'If both heart and lungs still need support, add a venous return limb (V-AV).',
  ],
  source: cite(TAHA, 2024, 'Ch. 6 Physiology II: Venoarterial ECMO, p. 86'),
} as const)

/**
 * Resuming after an arterial bubble stop on the CARDIOHELP-i, in order.
 * Instructions for Use, revision 2.3: §6.4.2 Resetting the Bubble Stop, pp. 146–147, and
 * §2.2.4 Starting the Perfusion, p. 19. The manual prints the reset and the clamp rules in two
 * places; the order below puts them together and adds nothing to either.
 */
export const ECMO_AIR_RESUME = Object.freeze({
  /** The action label everywhere the one simulated resumption step is offered. */
  label: 'Reset the bubble stop; open the return clamp last',
  conditions: [
    'The source of the air is fixed and the circuit is free of bubbles.',
    'Open the drainage clamp.',
    'On the Interventions screen touch Bubbles, then Reset, then Confirm. The pump restarts.',
    `Open the return clamp last, at low speed, once pump pressure is ${ECMO_NUMBERS.value('clamp-release-pressure')} above the pressure beyond the clamp. Then bring flow back up.`,
  ],
  sources: [
    cite('ifu-console-workflow', 2025, '§6.4.2 Resetting the Bubble Stop, pp. 146–147'),
    cite(IFU, 2025, '§2.2.4 Starting the Perfusion, p. 19'),
  ],
} as const)

/** The resume conditions as one sentence, for a rationale or a debrief line. */
export const ECMO_AIR_RESUME_SENTENCE = `Resume only when the source is fixed and the circuit is free of bubbles: open the drainage clamp, reset the bubble stop on the Interventions screen (Bubbles, Reset, Confirm), which restarts the pump, and open the return clamp last, at low speed, once pump pressure is ${ECMO_NUMBERS.value('clamp-release-pressure')} above the pressure beyond the clamp.`

/**
 * Driving the disposable by hand when the console has failed.
 * Instructions for Use, revision 2.3, §6.4.4, pp. 148–151.
 */
export const ECMO_EMERGENCY_DRIVE_STEPS = Object.freeze({
  steps: [
    'Close the arterial and the venous clamps.',
    'Open the safety bar, detach the sensor cable and the venous probe, and lift the disposable off the console.',
    'Lock the disposable onto the emergency drive and unfold the hand crank.',
    'Open the venous clamp and crank clockwise, watching the LED speed indicator.',
    'Once the speed is sufficient, open the arterial clamp.',
  ],
  source: cite('ifu-console-workflow', 2025, '§6.4.4, pp. 148–151'),
} as const)

/** The emergency drive as one sentence. */
export const ECMO_EMERGENCY_DRIVE_SENTENCE =
  'If the console itself has failed, move the disposable to the emergency drive: both clamps closed, disposable across, venous clamp open, crank clockwise, and the arterial clamp open once the speed is up.'

/**
 * Left-ventricular distension on peripheral VA ECMO: what is done, in order.
 * Taha et al. 2024, Ch. 6, Left Ventricular Venting, pp. 84–85.
 */
export const ECMO_LV_DISTENSION_MOVES = Object.freeze({
  recognize:
    'Narrow or absent arterial pulsatility, an aortic valve that does not open on echo, a distended ventricle, and worsening pulmonary edema, with flow and mean pressure that look acceptable.',
  moves: [
    'Titrate VA flow down to the lowest that still perfuses.',
    'Add or raise an inotrope so the ventricle ejects.',
    'Take volume off with diuretics or renal replacement.',
    `Vent the ventricle if pulsatility stays ${ECMO_NUMBERS.value('lv-vent-pulsatility')}: an intra-aortic balloon pump or an Impella, an atrial septostomy, or a surgical vent.`,
  ],
  source: cite(TAHA, 2024, 'Ch. 6 Physiology II: Venoarterial ECMO, pp. 84–85'),
} as const)

/** The oxygenator that is failing: what is checked and done, in order. */
export const ECMO_OXYGENATOR_FAILURE_SENTENCE = `Confirm the pressure drop is rising at an unchanged flow (usual range ${ECMO_NUMBERS.value('pressure-drop-typical')}; factory upper limit ${ECMO_NUMBERS.value('pressure-drop-factory-limit')}), send a post-oxygenator gas, look at the membrane for clot, and call the perfusionist with the primed backup. A failing oxygenator is exchanged; more pump speed is not a treatment.`
