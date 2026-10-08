import { num } from '../numbers'
import type {
  AuthoredChoice,
  BronchSectionDefinition,
  MonitorReading,
  MonitorTrend,
} from '../types'

/**
 * The procedure and the plan (rewrite, brief 1). The fellow decides whether a requested
 * bronchoscopy goes ahead today, is held or is modified, and sets the platelet and antithrombotic
 * plan for the sampling. One screen walks a whole case, which is the course's map. Three referrals
 * then arrive: a wrong plan plays out before the learner decides again.
 *
 * Sources: the course textbook (S1) and training manual (S2) for indications, risk, consent and the
 * time-out; the 2019 joint guideline (U2) for platelets and antithrombotic drugs, through the
 * numbers register (rows 7 to 9).
 */
const INDICATIONS = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 120 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 56 } },
] as const
const RISK = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 134, to: 144 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 120 } },
] as const
const ANTITHROMBOTIC = [
  {
    sourceId: 'U2',
    location: {
      kind: 'section',
      label: 'executive recommendations on laboratory testing and antithrombotic drugs',
    },
  },
] as const
const CONSENT = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 116, to: 117 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 50, to: 59 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 156 } },
] as const

/** The vital signs at one moment of a referral. Values are written for the case. */
function vitals(
  spo2: readonly [string, MonitorTrend, string],
  heartRate: readonly [string, MonitorTrend],
  bloodPressure: readonly [string, MonitorTrend, string],
  view?: string,
): readonly MonitorReading[] {
  return [
    ...(view ? [{ channel: 'airway-view' as const, words: view, trend: 'new' as const }] : []),
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
      words: heartRate[1] === 'steady' ? 'Unchanged' : 'Rising',
      trend: heartRate[1],
      value: heartRate[0],
      unit: '/min',
      provenance: 'authored',
    },
    {
      channel: 'blood-pressure',
      words: bloodPressure[2],
      trend: bloodPressure[1],
      value: bloodPressure[0],
      unit: 'mmHg',
      provenance: 'authored',
    },
  ]
}

const MEDICINE_CHOICES = (
  labels: readonly [string, string, string, string],
  rationales: readonly [string, string, string, string],
): AuthoredChoice[] =>
  (['a', 'b', 'c', 'd'] as const).map((id, index) => ({
    id,
    label: labels[index],
    rationale: rationales[index],
    plausibility: index === 0 ? 'best' : 'incorrect-mechanism',
  }))

export const section: BronchSectionDefinition = {
  id: 'clinical-question',
  authoringContract: 2,
  title: 'The procedure and the plan',
  shortTitle: 'Procedure and plan',
  minutes: 9,
  activityMinutes: 3,
  moduleIds: ['M02'],
  objectives: [
    {
      objectiveId: 'M02-O1',
      subtask: 'Decides whether a requested bronchoscopy goes ahead, is held or is modified.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M02-O2',
      subtask: 'Sets the platelet threshold and the antithrombotic plan for the sampling planned.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M02-O3',
      subtask:
        'Reads what consent covers and how to check it by asking the patient to say it back.',
      evidence: 'not-app-assessable',
    },
    {
      objectiveId: 'M02-O4',
      subtask: 'Stops at the time-out when the consent and the request name different sides.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M02-O5',
      subtask: 'Names the reason a bronchoscopy is indicated, beyond the request for it.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: [],
  prerequisites: ['shared-airway'],

  clinicalQuestion: 'Should this patient have a bronchoscopy today, and what has to be true first?',
  objective:
    'Decide whether a requested bronchoscopy goes ahead, is held or is modified, and set the bleeding plan for it.',
  harmfulReflex:
    'Going ahead as booked. A request and a free slot are not an indication, and they do not check the plan.',
  harmfulReflexPatterns: [/\bgo ahead as (booked|requested)\b/i],
  anchor: {
    analogy:
      'A bronchoscopy request is a drug order. You do not give a drug because it was ordered. You check why, who it is for, and what else they take.',
    precise:
      'Go ahead when the result would change management, the patient can tolerate it, and the bleeding risk fits the sampling planned.',
    checklistLabel: 'Before every bronchoscopy',
    checklist: [
      'A question the scope can answer',
      'A patient who can tolerate it',
      'Bleeding risk matched to the sampling',
      'Consent, then the time-out',
    ],
  },
  outcomes: [
    {
      id: 'go-hold-modify',
      text: 'Decide whether a requested bronchoscopy goes ahead today, is held or is modified.',
    },
    {
      id: 'bleeding-plan',
      text: 'Set the platelet threshold and the antithrombotic plan for the sampling planned.',
    },
  ],

  spineStops: [],
  grammarRowIds: [],
  precommitDenyPatterns: [/\bsuggests a problem\b/i, /\bthe reason to go\b/i],
  localPolicyIds: ['antithrombotic_policy'],
  reviewItemIds: [],

  blocks: [
    {
      id: 'whole-case',
      kind: 'pattern',
      role: 'framing',
      heading: 'One bronchoscopy, start to finish',
      body: 'A man has a mass in his right upper lobe. Follow him through the steps every bronchoscopy takes.',
      pointsLabel: 'From plan to recovery',
      points: [
        'Plan. The CT shows a lesion in the airway, so a biopsy will answer the question.',
        'Prepare. His clopidogrel is held, he has fasted, and the scope is checked.',
        'Anesthetize. Lidocaine to the nose, throat and cords, with titrated sedation.',
        'Enter and survey. Through the cords, then every airway, the normal side first.',
        'Sample. Biopsies of the lesion, then brushings and washings.',
        'Recover. Monitored until awake, then sent home with written instructions.',
      ],
      claimClass: 'synthesis',
      sourceRefs: INDICATIONS,
    },
    {
      id: 'indications',
      kind: 'pattern',
      role: 'signals',
      heading: 'When the scope answers the question',
      body: 'Bronchoscopy is indicated when looking or sampling would change what you do next. A request is not an indication. Nor is a shadow, a cough or a free slot.',
      pointsLabel: 'Reasons to look',
      points: [
        'A suspected lesion in the airway, or a lobe that has collapsed without explanation',
        'Hemoptysis with no source found',
        'Infection or infiltrates that need directed sampling, when simpler tests have not answered',
        'Suspected foreign-body aspiration. An opacity that persists after choking is a reason to look.',
        'Treatment: clearing secretions and mucus plugs, or removing a foreign body',
      ],
      claimClass: 'source',
      sourceRefs: INDICATIONS,
    },
    {
      id: 'risk',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'What makes it unsafe today',
      body: 'Few patients can never have a bronchoscopy. Most problems are fixed first, or the plan changes around them.\n\nRisk follows the sampling. Inspection and lavage bleed little. Biopsy adds bleeding, and transbronchial biopsy adds pneumothorax.',
      pointsLabel: 'Fix first, or change the plan',
      points: [
        'Oxygenation you cannot support through the procedure',
        'Active bronchospasm, or an unstable circulation',
        'A critically narrowed central airway. Plan the airway before the scope.',
        'Sleep apnea or a previous difficult airway. Plan the sedation.',
        'No consent, or no staff, equipment or rescue plan in the room',
      ],
      claimClass: 'source',
      sourceRefs: RISK,
    },
    {
      id: 'bleeding-plan',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'Platelets and blood thinners',
      body: 'Match the bleeding plan to the sampling. The drug holds below apply before endobronchial or transbronchial biopsy.',
      pointsLabel: 'Before you sample',
      points: [
        `Platelets: at least ${num('platelets-bal')} for lavage, and at least ${num('platelets-biopsy')} for biopsy.`,
        `Clopidogrel, prasugrel or ticagrelor: stop ${num('p2y12-hold')} before.`,
        'Low-dose aspirin: continue.',
        `Warfarin: stop ${num('warfarin-hold')} before, with an INR ${num('inr-before-biopsy')} on the day.`,
        `A direct oral anticoagulant: stop ${num('noac-hold')} before. The INR does not measure it.`,
        'A recent coronary stent, or a high risk of clotting: agree the plan with the prescriber before you stop anything.',
      ],
      claimClass: 'update',
      sourceRefs: ANTITHROMBOTIC,
      localPolicyIds: ['antithrombotic_policy'],
    },
    {
      id: 'consent-and-time-out',
      kind: 'pattern',
      role: 'signals',
      heading: 'Consent, then the time-out',
      body: 'Take consent before any sedative. Say what you will do and why, the risks, the alternatives, and that the result may not give an answer. Then ask the patient to say it back.\n\nRun the time-out aloud, with everyone listening.',
      pointsLabel: 'The time-out',
      points: [
        'Patient, procedure, site and side',
        'Consent, allergies and blood thinners',
        'Imaging on screen, equipment and specimen pots ready',
        'A mismatch stops everything until it is resolved',
      ],
      claimClass: 'source',
      sourceRefs: CONSENT,
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Five errors to expect',
      body: 'Each one skips a check that takes a minute.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Treating the request as the indication. Ask what the result would change.',
        'Stopping every blood thinner. Aspirin continues, and a recent stent needs the prescriber.',
        'Trusting a normal INR in a patient on a direct oral anticoagulant. Count the days since the last dose.',
        'Filling a blank with a guess. Find out the oxygen requirement and the platelet count.',
        'Changing the consent form at the time-out. Stop, and resolve it with the patient.',
      ],
      claimClass: 'source',
      sourceRefs: [...RISK, ...CONSENT],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption: 'The first referral, on the ward',
    readings: vitals(
      ['95', 'steady', 'On room air'],
      ['82', 'steady'],
      ['128/74', 'steady', 'Adequate'],
    ),
  },

  act: {
    kind: 'scenario',
    outcomeId: 'go-hold-modify',
    scenario: {
      id: 'three-referrals',
      title: 'Three referrals',
      frames: [
        {
          id: 'opacity-after-choking',
          time: 'The first referral',
          situation:
            'A 74-year-old man choked on a meal 3 weeks ago. His right lower lobe opacity has not cleared with antibiotics. He takes aspirin 81 mg. Platelets are 210,000/µL. The team asks for a lavage.',
          readings: vitals(
            ['95', 'steady', 'On room air'],
            ['82', 'steady'],
            ['128/74', 'steady', 'Adequate'],
          ),
          prompt: 'What is your plan?',
          choices: [
            {
              id: 'a',
              label: 'Go ahead: inspect the airways for a foreign body, with forceps ready',
              rationale:
                'An opacity that persists after choking is an airway problem until you have looked. Aspirin continues.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Hold: stop his aspirin, then book him for next week',
              rationale:
                'Low-dose aspirin continues for any bronchoscopy. The delay buys nothing and the lobe stays blocked.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'A week later he returns with a fever. More of the lobe has collapsed.',
                readings: vitals(
                  ['91', 'falling', 'Falling on room air'],
                  ['106', 'rising'],
                  ['118/70', 'steady', 'Adequate'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Pause, and repeat the chest CT in six weeks',
              rationale:
                'Another scan shows the same shadow. Only looking finds what is in the bronchus.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'Six weeks on, the CT shows the same opacity with new collapse. He has lost weight.',
                readings: vitals(
                  ['92', 'falling', 'Lower than before'],
                  ['98', 'rising'],
                  ['122/72', 'steady', 'Adequate'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Send sputum cultures and extend the antibiotics instead',
              rationale:
                'Antibiotics have already failed. Infection behind a blocked bronchus clears when the bronchus is opened.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'Sputum grows mouth flora. Ten days later the opacity is unchanged.',
                readings: vitals(
                  ['93', 'steady', 'On room air'],
                  ['94', 'rising'],
                  ['124/76', 'steady', 'Adequate'],
                ),
              },
            },
          ],
        },
        {
          id: 'biopsy-after-a-stent',
          time: 'The second referral',
          situation:
            'A 67-year-old woman has a mass in the left main bronchus on CT. Endobronchial biopsy is booked for tomorrow. She had a coronary stent 6 weeks ago and takes aspirin and clopidogrel. Platelets are 240,000/µL.',
          readings: vitals(
            ['96', 'steady', 'On room air'],
            ['76', 'steady'],
            ['136/80', 'steady', 'Adequate'],
          ),
          prompt: 'What is your plan?',
          choices: [
            {
              id: 'a',
              label: 'Hold the biopsy and agree a clopidogrel plan with her cardiologist',
              rationale:
                'Clopidogrel stops before a biopsy, but a new stent can clot without it. The prescriber decides when stopping is safe.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Go ahead as booked and biopsy on both drugs',
              rationale: 'A biopsy on clopidogrel bleeds, and this lesion sits in a main bronchus.',
              plausibility: 'unsafe',
              consequence: {
                situation:
                  'The first biopsy bleeds briskly and blood fills the left main bronchus.',
                readings: vitals(
                  ['89', 'falling', 'Falling'],
                  ['112', 'rising'],
                  ['148/88', 'rising', 'Rising'],
                  'Blood in the left main bronchus',
                ),
              },
            },
            {
              id: 'c',
              label: 'Stop both drugs today and biopsy next week',
              rationale:
                'Aspirin continues. Stopping both drugs this soon after a stent invites stent thrombosis.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'Four days later she has crushing chest pain. Her ECG shows ST elevation.',
                readings: vitals(
                  ['94', 'steady', 'On oxygen'],
                  ['118', 'rising'],
                  ['92/58', 'falling', 'Low'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Inspect only tomorrow, and decide about biopsy once you see it',
              rationale:
                'Inspection gives no tissue. A biopsy decided at the scope is the same biopsy on the same drugs.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'The lesion looks like tumor. You have no tissue, and she needs a second procedure.',
                readings: vitals(
                  ['95', 'steady', 'On nasal oxygen'],
                  ['84', 'steady'],
                  ['134/78', 'steady', 'Adequate'],
                  'A mass in the left main bronchus',
                ),
              },
            },
          ],
        },
        {
          id: 'infiltrates-and-low-platelets',
          time: 'The third referral',
          situation:
            'A 45-year-old man with leukemia has a fever and new diffuse infiltrates. The team asks for lavage and transbronchial biopsy. Platelets are 32,000/µL. He is on 4 L/min oxygen.',
          readings: vitals(
            ['93', 'steady', 'On 4 L/min oxygen'],
            ['108', 'steady'],
            ['112/66', 'steady', 'Adequate'],
          ),
          prompt: 'What is your plan?',
          choices: [
            {
              id: 'a',
              label: 'Modify: lavage today, and no biopsy at this platelet count',
              rationale:
                'His platelets are enough for lavage and too low for biopsy. Lavage answers the infection question today.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Go ahead as requested, with lavage and transbronchial biopsy',
              rationale:
                'His platelets are below the level for biopsy. Bleeding in the lung periphery is hard to control.',
              plausibility: 'unsafe',
              consequence: {
                situation:
                  'The second biopsy bleeds. Blood wells from the lower lobe and he coughs.',
                readings: vitals(
                  ['84', 'falling', 'Falling on oxygen'],
                  ['128', 'rising'],
                  ['104/60', 'falling', 'Falling'],
                  'Blood from the right lower lobe',
                ),
              },
            },
            {
              id: 'c',
              label: 'Hold everything until his platelets recover',
              rationale:
                'Lavage is safe at this count, and he needs an organism now. Waiting delays his treatment.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'Two days later he needs high-flow oxygen. No organism has been identified.',
                readings: vitals(
                  ['88', 'falling', 'Falling on high-flow oxygen'],
                  ['122', 'rising'],
                  ['106/62', 'steady', 'Adequate'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Modify: biopsy only, and skip the lavage to save time',
              rationale: 'That keeps the step his platelets rule out and drops the one they allow.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The biopsy site oozes steadily, and you have sent nothing for culture.',
                readings: vitals(
                  ['89', 'falling', 'Falling on oxygen'],
                  ['118', 'rising'],
                  ['108/64', 'steady', 'Adequate'],
                  'Blood at the biopsy site',
                ),
              },
            },
          ],
        },
      ],
      sourceRefs: [...INDICATIONS, ...ANTITHROMBOTIC],
    },
  },

  prediction: {
    id: 'Q20',
    seedId: 'Q20',
    itemType: 'management-decision',
    situation:
      'A 58-year-old woman has pneumonia in her right lower lobe for the second time in 4 months. She is stable on room air. The team asks for a lavage “for cultures”.',
    stem: 'What is the best reason to do this bronchoscopy?',
    choices: [
      {
        id: 'a',
        label: 'To inspect that lobe’s bronchus for a cause of the recurrence',
        rationale:
          'The same lobe twice suggests a narrowed or plugged bronchus: tumor, foreign body or stricture. Only looking excludes it.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'To get cultures that her sputum may have missed',
        rationale:
          'Cultures may help her antibiotics. They do not explain why the same lobe keeps failing.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Because the opacity has persisted on her imaging',
        rationale: 'A persistent shadow is a finding, not a question. Ask what could cause it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Pause: wait for a third episode to confirm the pattern',
        rationale:
          'Two episodes in one lobe is already the pattern. Waiting delays a diagnosis that may be cancer.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Start from the question, not the request. Pneumonia that returns to one lobe suggests a problem in that lobe’s bronchus. The lavage is worth doing, but the inspection is the reason to go.',
    objectiveIds: ['M02-O5', 'M02-O1'],
    outcomeIds: ['go-hold-modify'],
    claimClass: 'source',
    sourceRefs: INDICATIONS,
  },

  transfer: {
    id: 'clinical-question-transfer',
    itemType: 'management-decision',
    situation:
      'A 70-year-old man is booked for elective transbronchial biopsies in 2 weeks. He takes apixaban for atrial fibrillation and aspirin 81 mg. Platelets are 180,000/µL.',
    stem: 'What do you tell him about his medicines?',
    choices: MEDICINE_CHOICES(
      [
        'Stop apixaban before the biopsy, and keep taking aspirin',
        'Stop both apixaban and aspirin a week before',
        'Keep both, and biopsy if the INR is normal that morning',
        'Replace apixaban with heparin injections until the day',
      ],
      [
        'A direct oral anticoagulant is held for a short time before biopsy. Low-dose aspirin continues.',
        'Aspirin does not need to stop, and a week without apixaban is longer than he needs.',
        'The INR does not measure apixaban. A normal value says nothing about his bleeding risk.',
        'Bridging is not routine. It adds bleeding risk for a drug that clears in days.',
      ],
    ),
    explanation: `Stop a direct oral anticoagulant ${num('noac-hold')} before biopsy, and continue low-dose aspirin. His platelets are well above ${num('platelets-biopsy')}.`,
    objectiveIds: ['M02-O2'],
    outcomeIds: ['bleeding-plan'],
    claimClass: 'update',
    sourceRefs: ANTITHROMBOTIC,
    transferVariant:
      'A different patient and drug, and an elective biopsy with time to plan the hold.',
  },

  practice: [
    {
      id: 'mc-time-out-side-discrepancy',
      presentationTitle: 'The consent names the other side',
      situation:
        'At the time-out, the request and the CT say left upper lobe. The signed consent says right. The patient is awake and has had no sedative.',
      item: {
        id: 'mc-time-out-side-discrepancy',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Stop, and resolve it with the patient and the images before any sedative',
            rationale:
              'A mismatch stops the time-out. The patient is awake and can still tell you what they agreed to.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Go ahead as booked on the left, since two records agree',
            rationale:
              'Counting records does not settle it. The consent is the one the patient signed.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Change the form to say left, and carry on',
            rationale:
              'Changing the form records your view, not the patient’s consent. Ask the patient.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Finish the checklist first, then settle the side afterwards',
            rationale:
              'The rest of the checklist depends on the side. Settle it before anything else moves.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The time-out exists to catch this. Stop while the patient can still speak for themselves, check the images together, and fix the record before sedation.',
        objectiveIds: ['M02-O4'],
        outcomeIds: ['go-hold-modify'],
        claimClass: 'source',
        sourceRefs: CONSENT,
      },
    },
    {
      id: 'mc-warfarin-on-the-day',
      presentationTitle: 'Warfarin stopped, INR still raised',
      situation:
        'A 66-year-old woman is booked for endobronchial biopsy this morning. She stopped warfarin 5 days ago, as instructed. Her INR today is 1.8. Platelets are 230,000/µL.',
      item: {
        id: 'mc-warfarin-on-the-day',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Do not biopsy today. Recheck the INR and rebook',
            rationale:
              'Two conditions must hold: the days off warfarin, and the INR on the day. Hers is still too high.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Go ahead as booked, since she held warfarin for long enough',
            rationale: 'The hold is a means. The INR shows whether it has worked, and it has not.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Biopsy, but take fewer samples to limit the bleeding',
            rationale:
              'One biopsy can bleed as much as five. Fewer samples also lowers the chance of a diagnosis.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Biopsy with cold saline drawn up and ready',
            rationale:
              'Being ready to treat bleeding does not make it acceptable to cause it in an elective case.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation: `Warfarin stops ${num('warfarin-hold')} before a biopsy, and the INR must be ${num('inr-before-biopsy')} on the day. Time off the drug is not enough by itself.`,
        objectiveIds: ['M02-O2'],
        outcomeIds: ['bleeding-plan'],
        claimClass: 'update',
        sourceRefs: ANTITHROMBOTIC,
      },
    },
    {
      id: 'mc-ticagrelor-elective',
      presentationTitle: 'Ticagrelor and aspirin before a biopsy',
      situation:
        'A 61-year-old man is booked for transbronchial biopsy in 10 days. He takes ticagrelor and aspirin 81 mg after a heart attack 3 years ago. His cardiologist agrees that ticagrelor can be interrupted.',
      item: {
        id: 'mc-ticagrelor-elective',
        itemType: 'management-decision',
        stem: 'What do you tell him?',
        choices: MEDICINE_CHOICES(
          [
            'Stop ticagrelor ahead of the biopsy, and keep taking aspirin',
            'Stop aspirin ahead of the biopsy, and keep taking ticagrelor',
            'Take both as usual, and skip them only on the morning',
            'Take both as usual. A normal platelet count is enough',
          ],
          [
            'Ticagrelor is held before a biopsy, like clopidogrel and prasugrel. Low-dose aspirin continues.',
            'This is the plan reversed. Ticagrelor is the drug that makes a biopsy bleed.',
            'One missed dose does not restore platelet function. The drug needs days to wear off.',
            'The count shows how many platelets he has, not how well they work on ticagrelor.',
          ],
        ),
        explanation: `Stop clopidogrel, prasugrel or ticagrelor ${num('p2y12-hold')} before a biopsy, once the prescriber agrees. Low-dose aspirin continues.`,
        objectiveIds: ['M02-O2'],
        outcomeIds: ['bleeding-plan'],
        claimClass: 'update',
        sourceRefs: ANTITHROMBOTIC,
      },
    },
  ],
}
