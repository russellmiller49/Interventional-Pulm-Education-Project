import { num } from '../numbers'
import type {
  AuthoredChoice,
  BronchSectionDefinition,
  MonitorReading,
  MonitorTrend,
} from '../types'

/**
 * Topical anesthesia, sedation and monitoring (rewrite, brief 3). The fellow numbs the airway in
 * three places, counts lidocaine in milligrams for each kilogram across every route, titrates
 * sedation to a patient who still answers, and watches breathing as well as oxygen. A ledger with
 * one unrecorded dose is the single bookkeeping exercise; one patient then drifts through three
 * frames. The monitoring teaching of the retired `shared-airway` section lives here.
 *
 * Sources: the course textbook (S1) and training manual (S2); the 2018 moderate-sedation guideline
 * (U1); the 2019 joint guideline (U2) and BTS 2013 (U14) through the numbers register (rows 1 to 6,
 * 10 and 19); the product labels for the reversal agents (U20, U21).
 */
const TOPICAL = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
  { sourceId: 'U2', location: { kind: 'section', label: 'topical anesthesia recommendations' } },
] as const
const TOXICITY = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 73, to: 74 } },
  { sourceId: 'U4', location: { kind: 'section', label: 'LAST checklist' } },
] as const
const SEDATION = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 74, to: 83 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 37, to: 40 } },
] as const
const MONITORING = [
  { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 75, to: 79 } },
] as const
const REVERSAL = [
  { sourceId: 'U1', location: { kind: 'section', label: 'reversal recommendations' } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 39, to: 40 } },
] as const

/** The monitor at one moment of the case. Values are written for this case. */
function vitals(
  response: string,
  breathing: readonly [string, MonitorTrend, string],
  spo2: readonly [string, MonitorTrend, string],
  heartRate: readonly [string, MonitorTrend],
): readonly MonitorReading[] {
  return [
    { channel: 'responsiveness', words: response, trend: 'new' },
    {
      channel: 'respiratory-effort',
      words: breathing[2],
      trend: breathing[1],
      value: breathing[0],
      unit: '/min',
      provenance: 'authored',
    },
    {
      channel: 'oximetry',
      words: spo2[2],
      trend: spo2[1],
      value: spo2[0],
      unit: '%',
      provenance: 'authored',
    },
    {
      channel: 'heart-rate',
      words: heartRate[1] === 'steady' ? 'Unchanged' : 'Changing',
      trend: heartRate[1],
      value: heartRate[0],
      unit: '/min',
      provenance: 'authored',
    },
  ]
}

const choices = (
  labels: readonly [string, string, string, string],
  rationales: readonly [string, string, string, string],
  unsafe?: 'b' | 'c' | 'd',
): AuthoredChoice[] =>
  (['a', 'b', 'c', 'd'] as const).map((id, index) => ({
    id,
    label: labels[index],
    rationale: rationales[index],
    plausibility: index === 0 ? 'best' : id === unsafe ? 'unsafe' : 'incorrect-mechanism',
  }))

export const section: BronchSectionDefinition = {
  id: 'sedation-and-monitoring',
  authoringContract: 2,
  title: 'Topical anesthesia, sedation and monitoring',
  shortTitle: 'Sedation and monitoring',
  minutes: 11,
  activityMinutes: 4,
  moduleIds: ['M04', 'M01'],
  objectives: [
    {
      objectiveId: 'M04-O1',
      subtask: 'Tells a cough that needs lidocaine from a patient who needs sedation.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M04-O2',
      subtask:
        'Converts each lidocaine dose to milligrams and the total to milligrams for each kilogram.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M04-O3',
      subtask: 'Reads response, breathing, capnography and oximetry together through one case.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M04-O4',
      subtask: 'Stops lidocaine when confusion and a new arrhythmia follow repeated doses.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M04-O5',
      subtask: 'States the lidocaine total when one dose was never recorded.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M01-O2',
      subtask: 'Says how sedation, suction and lavage each reduce breathing or gas exchange.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M01-O3',
      subtask: 'Tells oxygenation from ventilation when the saturation holds on oxygen.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M01-O4',
      subtask: 'Stops the examination when the patient’s breathing changes.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D19'],
  prerequisites: ['clinical-question'],

  clinicalQuestion:
    'How do you keep this patient comfortable without losing track of the drugs or the breathing?',
  objective:
    'Numb the airway, count the lidocaine, titrate sedation, and watch breathing as well as oxygen.',
  harmfulReflex:
    'Trusting a number that has not moved: an unrecorded dose counted as zero, or an unchanged saturation read as safe breathing.',
  harmfulReflexPatterns: [/\bcounts as zero\b/i, /\bsaturation is unchanged\b/i],
  anchor: {
    analogy:
      'Three people pour from one bottle and nobody keeps the tab. Each has given a little. Nobody knows the total until someone writes every pour down.',
    precise:
      'Count every milligram of lidocaine, titrate sedation to a patient who still answers you, and watch breathing as well as oxygen.',
    checklistLabel: 'Through every sedated bronchoscopy',
    checklist: [
      'Lidocaine counted across every route',
      'Sedation in small doses, then wait',
      'One person watching the patient',
      'Breathing first, saturation last',
    ],
  },
  outcomes: [
    {
      id: 'count-lidocaine',
      text: 'Count lidocaine across every route, and recognize when the patient has had too much.',
    },
    {
      id: 'read-sedation',
      text: 'Read sedation depth and breathing from the patient, and act when they drift.',
    },
  ],

  spineStops: [],
  grammarRowIds: [],
  precommitDenyPatterns: [/\bshows oxygen\b/i, /\bairway has closed\b/i],
  localPolicyIds: ['topical_anesthetic_policy', 'sedation_policy', 'fasting_and_aspiration_policy'],
  reviewItemIds: ['R11', 'R12', 'R13', 'R14'],

  blocks: [
    {
      id: 'topical',
      kind: 'pattern',
      role: 'framing',
      heading: 'Numb the airway in three places',
      body: 'Topical anesthesia stops the cough. Sedation does not. Put lidocaine where the scope will touch, then wait for it to work.',
      pointsLabel: 'Where, and with what',
      points: [
        'Nose: lidocaine gel, for a nasal approach.',
        'Throat: lidocaine spray.',
        `Cords and trachea: spray as you go through the scope, with ${num('lidocaine-spray-concentration')} lidocaine.`,
        `Nebulized lidocaine is ${num('nebulized-lidocaine')}.`,
      ],
      claimClass: 'update',
      sourceRefs: TOPICAL,
      localPolicyIds: ['topical_anesthetic_policy'],
    },
    {
      id: 'lidocaine-count',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'Count every milligram',
      body: `Lidocaine adds up across every route and every person who gives it. Convert each dose to milligrams. A one percent solution holds ten milligrams in each milliliter, and two percent holds twenty.\n\nThen divide by the weight. Keep the total under ${num('lidocaine-ceiling')}, and use the least that controls the cough.`,
      pointsLabel: 'Keeping the count',
      points: [
        'Call out every dose: the strength and the volume.',
        'One person keeps the running total.',
        'A dose nobody wrote down is unknown, not zero. Ask who gave it.',
      ],
      claimClass: 'update',
      sourceRefs: TOPICAL,
      localPolicyIds: ['topical_anesthetic_policy'],
      reviewItemIds: ['R13'],
    },
    {
      id: 'toxicity',
      kind: 'pattern',
      role: 'signals',
      heading: 'Too much local anesthetic',
      body: 'The early signs of lidocaine toxicity are neurological, and sedation can hide them. If you see one, stop the lidocaine and call for help.',
      pointsLabel: 'Signs',
      points: [
        'Tinnitus, or a metallic taste',
        'Restlessness or confusion',
        'Seizure',
        'A new arrhythmia, or a falling blood pressure',
        'Benzocaine spray is different: it can cause methemoglobinemia, a low saturation that oxygen does not fix.',
      ],
      claimClass: 'source',
      sourceRefs: TOXICITY,
      reviewItemIds: ['R14'],
    },
    {
      id: 'sedation-drugs',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Sedation: a small dose, then wait',
      body: 'Sedation eases anxiety. It does not numb the airway. Titrate to a patient who is calm and still answers you.',
      pointsLabel: 'The drugs',
      points: [
        'Midazolam calms and gives amnesia. It does not treat pain or cough.',
        'An opioid such as fentanyl treats pain and suppresses cough. It slows breathing.',
        'Together they depress breathing more than either alone. Wait for each dose to act.',
        `Draw up no more than ${num('midazolam-draw-up-under-70')} of midazolam at the start, or ${num('midazolam-draw-up-over-70')} for a patient over seventy.`,
        'Propofol: only with staff trained to rescue deep sedation.',
      ],
      claimClass: 'source',
      sourceRefs: SEDATION,
      localPolicyIds: ['sedation_policy'],
    },
    {
      id: 'monitoring',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Watch the patient, then the monitor',
      body: 'One person does nothing but watch the patient. That person is not you.\n\nOximetry shows oxygen, not breathing. On supplemental oxygen the saturation can hold while breathing fails.',
      pointsLabel: 'In this order',
      points: [
        `Response to your voice, ${num('sedation-check-interval')}`,
        'Chest movement and airflow',
        'Capnography, when you have it',
        'Oximetry, continuously',
        'Blood pressure and heart rate',
        `Add oxygen for ${num('oxygen-trigger')}.`,
      ],
      claimClass: 'update',
      sourceRefs: MONITORING,
      localPolicyIds: ['sedation_policy'],
      reviewItemIds: ['R11', 'R12'],
    },
    {
      id: 'before-and-after',
      kind: 'pattern',
      role: 'signals',
      heading: 'Before, and after',
      body: 'Have both reversal agents in the room before the first dose. Each wears off before the sedative does.',
      pointsLabel: 'Fasting, reversal and going home',
      points: [
        `Fasting: no food for ${num('fasting-solids')}, and no clear fluids for ${num('fasting-clear-fluids')}.`,
        `Naloxone reverses the opioid: ${num('naloxone-dose')}.`,
        `Flumazenil reverses midazolam: ${num('flumazenil-first-dose')}, then ${num('flumazenil-repeat')}.`,
        `After a reversal agent, watch for ${num('reversal-discharge-wait')} before discharge.`,
        `After any sedation: no driving, machinery or legal documents for ${num('post-sedation-restriction')}.`,
      ],
      claimClass: 'update',
      sourceRefs: REVERSAL,
      localPolicyIds: ['sedation_policy', 'fasting_and_aspiration_policy'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Six errors to expect',
      body: 'Each one trusts something that has not been checked.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Treating cough with more sedation. Cough needs lidocaine and time.',
        'Counting an unrecorded dose as nothing. Find out what was given.',
        'Adding milliliters instead of milligrams.',
        'Trusting the saturation on oxygen. Watch the chest and the capnograph.',
        'Sedating a restless patient after repeated lidocaine. Think of toxicity first.',
        'Sending a patient home soon after a reversal agent. The sedative outlasts it.',
      ],
      claimClass: 'source',
      sourceRefs: [...SEDATION, ...TOXICITY],
      reviewItemIds: ['R13'],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption: 'Before the first sedative',
    readings: vitals(
      'Awake and talking',
      ['14', 'steady', 'Regular'],
      ['97', 'steady', 'On room air'],
      ['78', 'steady'],
    ),
  },

  act: {
    kind: 'ledger',
    outcomeId: 'count-lidocaine',
    ledger: {
      id: 'shared-topical-ledger',
      prompt:
        'A 50 kg woman is having a bronchoscopy through the nose. This is her lidocaine so far, one line for each dose. Enter the milligrams for each measured line.',
      boundary: 'Milligrams are the strength in mg/mL multiplied by the volume in mL.',
      rows: [
        {
          id: 'nasal-gel',
          kind: 'measured',
          label: 'Nasal gel, 2% lidocaine',
          detail: 'Given by the nurse before the scope went in.',
          concentrationMgPerMl: 20,
          volumeMl: 5,
        },
        {
          id: 'spray-as-you-go',
          kind: 'measured',
          label: 'Spray as you go, 1% lidocaine',
          detail: 'Ten aliquots through the channel, each called out by you.',
          concentrationMgPerMl: 10,
          volumeMl: 20,
        },
        {
          id: 'throat-spray',
          kind: 'unknown',
          label: 'Throat spray in the preparation area',
          detail: 'The nurse there remembers giving it.',
          reason: 'Nobody wrote down the strength or the number of sprays.',
        },
      ],
      totalPrompt:
        'She weighs 50 kg, and you want more lidocaine for the carina. What can you say about her dose so far?',
      totalChoices: choices(
        [
          'At least 6 mg/kg, with the throat spray still to add',
          'Exactly 6 mg/kg: the throat spray counts as zero',
          'Under 1 mg/kg, taking 2% as 2 mg/mL',
          'Nothing yet, until the throat spray is traced',
        ],
        [
          'The gel and the aliquots make 300 mg, which is 6 mg/kg. The spray adds to that. Find out what it was before you give more.',
          'A dose that was given and not written down is unknown, not zero. She has had more than 6 mg/kg.',
          'A 2% solution holds 20 mg/mL, not 2. Her dose is ten times what this assumes.',
          'The known 300 mg still matters. State it now, and add the spray when you have it.',
        ],
        'b',
      ),
      totalIsUnknown: true,
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
        {
          sourceId: 'U2',
          location: { kind: 'section', label: 'topical anesthesia recommendations' },
        },
      ],
      localPolicyIds: ['topical_anesthetic_policy'],
    },
  },

  moreActs: {
    drift: {
      kind: 'scenario',
      outcomeId: 'read-sedation',
      scenario: {
        id: 'sedation-drift',
        title: 'A sedated patient who drifts',
        frames: [
          {
            id: 'coughing-at-the-cords',
            time: 'Five minutes in',
            situation:
              'A 68-year-old man, 80 kg, has had midazolam 2 mg and fentanyl 50 mcg. He is calm and answers you. Each time the scope nears his cords he coughs hard. He has had 1% lidocaine 2 mL to the cords.',
            readings: vitals(
              'Answers when you speak',
              ['14', 'steady', 'Regular'],
              ['96', 'steady', 'On 2 L/min oxygen'],
              ['88', 'steady'],
            ),
            prompt: 'What do you do about the cough?',
            choices: [
              {
                id: 'a',
                label: 'Spray more lidocaine on the cords and give it time',
                rationale:
                  'He is calm and answering, so sedation is adequate. The cough is a numbing problem, and he is far below his lidocaine limit.',
                plausibility: 'best',
              },
              {
                id: 'b',
                label: 'Give another dose of midazolam',
                rationale:
                  'Midazolam does not treat cough. It deepens sedation in a patient who was already calm.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation: 'He still coughs. Two minutes later he no longer answers your voice.',
                  readings: vitals(
                    'Stirs only to a shoulder tap',
                    ['10', 'falling', 'Slower and shallow'],
                    ['95', 'steady', 'On 2 L/min oxygen'],
                    ['84', 'steady'],
                  ),
                },
              },
              {
                id: 'c',
                label: 'Push the scope through the cords between coughs',
                rationale: 'Unnumbed cords close on the scope. You trade a cough for laryngospasm.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation: 'The cords clamp shut around the tip. He strains and makes no sound.',
                  readings: vitals(
                    'Agitated',
                    ['0', 'lost', 'Effort without airflow'],
                    ['90', 'falling', 'Falling'],
                    ['112', 'rising'],
                  ),
                },
              },
              {
                id: 'd',
                label: 'Ask the nurse to give propofol',
                rationale:
                  'Propofol takes him to deep sedation. This team is set up for moderate sedation.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation: 'He stops coughing, and then he stops breathing.',
                  readings: vitals(
                    'No response',
                    ['0', 'lost', 'Apneic'],
                    ['89', 'falling', 'Falling'],
                    ['70', 'falling'],
                  ),
                },
              },
            ],
          },
          {
            id: 'quiet-and-shallow',
            time: 'Twelve minutes in',
            situation:
              'The cough has settled and you are in the right lower lobe. He was given a further midazolam 1 mg and fentanyl 25 mcg. He now stirs only when his shoulder is tapped. His breaths are shallow and the capnography trace is smaller.',
            readings: vitals(
              'Stirs only to a shoulder tap',
              ['8', 'falling', 'Slow and shallow'],
              ['95', 'steady', 'On 2 L/min oxygen'],
              ['80', 'steady'],
            ),
            prompt: 'What do you do now?',
            choices: [
              {
                id: 'a',
                label: 'Rouse him and open his airway',
                rationale:
                  'He is deeper than you planned and breathing less. Oxygen is holding the saturation up for now.',
                plausibility: 'best',
              },
              {
                id: 'b',
                label: 'Carry on: his saturation is unchanged',
                rationale:
                  'On oxygen the saturation falls late. His breathing has already changed.',
                plausibility: 'unsafe',
                consequence: {
                  situation: 'Two minutes later his chest is barely moving.',
                  readings: vitals(
                    'No response to voice or touch',
                    ['4', 'falling', 'Barely moving'],
                    ['86', 'falling', 'Falling fast'],
                    ['68', 'falling'],
                  ),
                },
              },
              {
                id: 'c',
                label: 'Turn the oxygen up and continue',
                rationale:
                  'More oxygen props up the number and hides the problem. It does nothing for his breathing.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation: 'The saturation reads 97%. The capnography trace goes flat.',
                  readings: vitals(
                    'No response to voice',
                    ['4', 'falling', 'Barely moving'],
                    ['97', 'steady', 'On 6 L/min oxygen'],
                    ['72', 'falling'],
                  ),
                },
              },
              {
                id: 'd',
                label: 'Pause, and finish the lavage before you reassess',
                rationale:
                  'Lavage worsens gas exchange, and he is already breathing too little. Reassess first.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation: 'Halfway through the lavage his saturation drops.',
                  readings: vitals(
                    'No response to voice',
                    ['6', 'falling', 'Shallow'],
                    ['84', 'falling', 'Falling'],
                    ['104', 'rising'],
                  ),
                },
              },
            ],
          },
          {
            id: 'not-rousing',
            time: 'Fourteen minutes in',
            situation:
              'You have stopped. With a jaw thrust his airway is open, but he does not rouse and takes 6 breaths a minute. His saturation has been 88% for over a minute.',
            readings: vitals(
              'No response to voice or touch',
              ['6', 'falling', 'Slow, with a jaw thrust'],
              ['88', 'falling', 'On 6 L/min oxygen'],
              ['66', 'falling'],
            ),
            prompt: 'What is the next step?',
            choices: [
              {
                id: 'a',
                label: 'Remove the scope, ventilate by bag and mask, and reverse both drugs',
                rationale:
                  'He is not breathing enough despite an open airway. Ventilate him, and give naloxone and flumazenil.',
                plausibility: 'best',
              },
              {
                id: 'b',
                label: 'Hold the jaw thrust and wait for the drugs to wear off',
                rationale:
                  'An open airway does not help a patient who is not breathing enough. He is hypoxic now.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'A minute later his saturation is lower and his heart rate is slowing.',
                  readings: vitals(
                    'No response',
                    ['4', 'falling', 'Barely moving'],
                    ['80', 'falling', 'Falling'],
                    ['52', 'falling'],
                  ),
                },
              },
              {
                id: 'c',
                label: 'Give flumazenil alone: midazolam was the last drug',
                rationale:
                  'The opioid is what slows breathing most. Reverse it too, and ventilate while you do.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation: 'He stirs but still breathes 6 times a minute.',
                  readings: vitals(
                    'Stirs to touch',
                    ['6', 'steady', 'Slow'],
                    ['85', 'falling', 'Falling'],
                    ['70', 'steady'],
                  ),
                },
              },
              {
                id: 'd',
                label: 'Change to a non-rebreather mask on high-flow oxygen',
                rationale:
                  'Oxygen without ventilation does not clear carbon dioxide, and he is barely breathing.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'The saturation rises for a minute, then falls again as he stops breathing.',
                  readings: vitals(
                    'No response',
                    ['0', 'lost', 'Apneic'],
                    ['82', 'falling', 'Falling'],
                    ['58', 'falling'],
                  ),
                },
              },
            ],
          },
        ],
        sourceRefs: [...SEDATION, ...MONITORING, ...REVERSAL],
      },
    },
  },

  prediction: {
    id: 'N01',
    itemType: 'management-decision',
    situation:
      'You are in the right lower lobe with a clear view. The patient had more sedation 3 minutes ago. His chest is moving, but the nurse feels no air at his mouth and the capnography trace is flat. SpO₂ is 96% on 3 L/min, unchanged.',
    stem: 'What do you do?',
    choices: choices(
      [
        'Lift his jaw and feel for airflow',
        'Carry on: his saturation is unchanged',
        'Carry on: his chest is moving',
        'Pause sampling, and finish the survey before you reassess',
      ],
      [
        'A moving chest with no airflow is an obstructed airway. Open it now, before the saturation falls.',
        'On oxygen the saturation falls minutes after breathing stops. It is the last sign to change.',
        'The chest moves against a closed airway too. Movement without airflow is obstruction.',
        'Every minute of the survey is a minute without ventilation. Reassess first.',
      ],
      'b',
    ),
    explanation:
      'Oximetry shows oxygen, not breathing. Chest movement with no airflow and a flat trace means the upper airway has closed. Open it, then decide about the sedation.',
    objectiveIds: ['M04-O3'],
    outcomeIds: ['read-sedation'],
    claimClass: 'update',
    sourceRefs: MONITORING,
  },

  transfer: {
    id: 'sedation-and-monitoring-transfer',
    itemType: 'management-decision',
    situation:
      'Recovery. A 72-year-old man had midazolam 4 mg and fentanyl 75 mcg, then flumazenil at the end of the procedure. Forty minutes later he is hard to rouse and takes 8 breaths a minute. SpO₂ is 95% on 3 L/min. His son is waiting to drive him home.',
    stem: 'What do you do about his discharge?',
    choices: choices(
      [
        'Rouse him, support his airway and keep him monitored',
        'Let him go home: his saturation is unchanged',
        'Let him sleep: drowsiness after sedation is expected',
        'Turn off his oxygen and discharge him if the saturation holds',
      ],
      [
        'Flumazenil has worn off and the midazolam has not. He is resedated and breathing too little.',
        'On oxygen the saturation hides slow breathing. He is hard to rouse, and that is the finding.',
        'Drowsy is expected. Hard to rouse with slow breathing is resedation, and it needs action.',
        'A saturation that holds for a few minutes says nothing about the next hour at home.',
      ],
      'b',
    ),
    explanation: `A reversal agent wears off before the sedative. Watch for ${num('reversal-discharge-wait')} after the last dose, and nobody drives for ${num('post-sedation-restriction')} after sedation.`,
    objectiveIds: ['M04-O3', 'M04-O1'],
    outcomeIds: ['read-sedation'],
    claimClass: 'update',
    sourceRefs: REVERSAL,
    transferVariant:
      'A different patient, after the procedure, with a reversal agent already given.',
  },

  practice: [
    {
      id: 'mc-lidocaine-by-weight',
      presentationTitle: 'Lidocaine for a small patient',
      situation:
        'A 45 kg woman has had 2% lidocaine gel 5 mL in the nose and 1% lidocaine 16 mL through the scope. Every dose was recorded. She is still coughing at the carina, and you ask for 1% lidocaine 10 mL more.',
      item: {
        id: 'mc-lidocaine-by-weight',
        itemType: 'management-decision',
        stem: 'Where does that take her?',
        choices: choices(
          [
            'To the limit: give the least that works, and no more after it',
            'Nowhere near it: she has room for several more doses',
            'Over it already: she should have had no more than the gel',
            'It cannot be known without a lidocaine level',
          ],
          [
            'Add the gel, the aliquots and this dose, then divide by her weight. The answer is the suggested limit.',
            'She is already about three quarters of the way there. One more full dose reaches the limit.',
            'The gel alone is about a quarter of her limit. She was well under it afterwards.',
            'The dose is known from the record. Nobody measures a level during a bronchoscopy.',
          ],
        ),
        explanation: `Convert to milligrams, add every route, then divide by the weight. The suggested upper limit is ${num('lidocaine-ceiling')}. A small patient reaches it quickly.`,
        objectiveIds: ['M04-O2'],
        outcomeIds: ['count-lidocaine'],
        claimClass: 'update',
        sourceRefs: TOPICAL,
      },
    },
    {
      id: 'mc-toxicity-recognition',
      presentationTitle: 'Restless after repeated lidocaine',
      situation:
        'A 58-year-old man, 60 kg, has had repeated lidocaine through the scope for a difficult cough. He becomes restless and confused and says his ears are ringing. The monitor shows new ectopic beats. SpO₂ is 97% and he is breathing normally.',
      item: {
        id: 'mc-toxicity-recognition',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: choices(
          [
            'No more lidocaine, and get help now: this is toxicity',
            'Pause, and settle him with midazolam',
            'Give flumazenil for the confusion',
            'Carry on: his breathing and saturation are normal',
          ],
          [
            'Tinnitus, confusion and a new arrhythmia after repeated doses is lidocaine toxicity until proved otherwise.',
            'Sedation hides the neurological signs and treats nothing. Restlessness here is a warning.',
            'Flumazenil reverses midazolam. It does not treat a local anesthetic, and it can provoke a seizure.',
            'Toxicity affects the brain and the heart first. Normal breathing does not exclude it.',
          ],
        ),
        explanation:
          'The early signs are tinnitus, a metallic taste, restlessness and confusion, then seizure and arrhythmia. Stop the drug and get help. The first moves are in the section on deterioration.',
        objectiveIds: ['M04-O4'],
        outcomeIds: ['count-lidocaine'],
        claimClass: 'source',
        sourceRefs: TOXICITY,
        reviewItemIds: ['R14'],
      },
    },
    {
      id: 'mc-sedation-depth',
      presentationTitle: 'How deep is this patient?',
      situation:
        'After a further dose of sedation, a 63-year-old woman does not answer her name. She pulls away when the nurse lifts her jaw. Her capnography trace is smaller and SpO₂ is 96% on 2 L/min.',
      item: {
        id: 'mc-sedation-depth',
        itemType: 'mechanism-interpretation',
        stem: 'What does the team do next?',
        choices: choices(
          [
            'Give no more sedation, open her airway and watch her breathing',
            'Continue as planned: the order was for moderate sedation',
            'Continue as planned: she still responds to the jaw lift',
            'Spray more lidocaine now that she has stopped coughing',
          ],
          [
            'No answer to voice and a withdrawal from pain is deep sedation. She needs her airway held, and no more drug.',
            'The order is the plan. Her response shows what happened, and she is deeper than planned.',
            'Pulling away from a jaw lift is a reflex. Moderate sedation means a purposeful answer to voice.',
            'Lidocaine treats cough. She has stopped coughing because she is too deeply sedated.',
          ],
        ),
        explanation:
          'Depth is the patient’s response, not the dose or the order. No answer to voice with a smaller trace means deeper than moderate, and the team acts on that.',
        objectiveIds: ['M04-O1', 'M04-O3'],
        outcomeIds: ['read-sedation'],
        claimClass: 'synthesis',
        sourceRefs: [...SEDATION, ...MONITORING],
      },
    },
  ],
}
