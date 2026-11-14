import type { SourceRef } from '../../data/sources'
import { num } from '../numbers'
import type { BronchSectionDefinition, MonitorReading, MonitorTrend } from '../types'

/**
 * When the patient deteriorates (rewrite, brief 13). One opening bundle (stop, say it out loud,
 * look at the patient), then a first-move card for each of eight events. One patient then goes
 * through four frames: bronchospasm, a pneumothorax after the biopsy, tension, and the plan once
 * the chest is decompressed. The vital signs change with time and a wrong move plays out.
 *
 * Faculty decision, 2026-10-10: the cards name the rescue drugs and print no dose. Lipid emulsion
 * is named and its dose is left to the checklist, so review-register R14 stands as it was.
 *
 * Sources: the course textbook (S1) and the training manual (S2) for the events, the sedation
 * guideline (U1) for reversal, the local anesthetic toxicity checklist (U4) and the
 * methemoglobinemia recommendations (U17).
 */
const RESPONSE: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 115, to: 117 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 26, to: 31 } },
]
const RECOGNITION: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 26, to: 31 } },
]
const REVERSAL: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 74, to: 83 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 39, to: 40 } },
  { sourceId: 'U1', location: { kind: 'section', label: 'reversal recommendations' } },
]
const SPASM: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 79 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 27 } },
]
const PNEUMOTHORAX: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 141, to: 143 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 29 } },
  {
    sourceId: 'U23',
    location: { kind: 'section', label: 'Volume I, pneumothorax; volume II, the primary survey' },
  },
  { sourceId: 'U22', location: { kind: 'section', label: 'Chapter 53, pneumothorax' } },
]
const TOXICITY: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 73, to: 74 } },
  { sourceId: 'U4', location: { kind: 'section', label: 'LAST checklist' } },
]
const METHEMOGLOBIN: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 73, to: 74 } },
  { sourceId: 'U17', location: { kind: 'section', label: 'Diagnosis and treatment' } },
]

const TREND_WORDS: Record<MonitorTrend, string> = {
  steady: 'Unchanged',
  rising: 'Rising',
  falling: 'Falling',
  lost: 'Lost',
  new: 'New',
}

/** The monitor at one moment of the case. Values are written for this case. */
function vitals(
  breathing: string,
  spo2: readonly [string, MonitorTrend, string],
  heartRate: readonly [string, MonitorTrend],
  bloodPressure?: readonly [string, MonitorTrend, string],
): readonly MonitorReading[] {
  return [
    { channel: 'respiratory-effort', words: breathing, trend: 'new' },
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
      words: TREND_WORDS[heartRate[1]],
      trend: heartRate[1],
      value: heartRate[0],
      unit: '/min',
      provenance: 'authored',
    },
    ...(bloodPressure
      ? [
          {
            channel: 'blood-pressure' as const,
            words: bloodPressure[2],
            trend: bloodPressure[1],
            value: bloodPressure[0],
            unit: 'mmHg',
            provenance: 'authored' as const,
          },
        ]
      : []),
  ]
}

export const section: BronchSectionDefinition = {
  id: 'deterioration',
  authoringContract: 2,
  title: 'When the patient deteriorates',
  shortTitle: 'Deterioration',
  minutes: 10,
  activityMinutes: 3,
  moduleIds: ['M15'],
  objectives: [
    {
      objectiveId: 'M15-O1',
      subtask: 'Stops, says the change out loud and looks at the patient before naming a cause.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M15-O3',
      subtask:
        'Tells bronchospasm, laryngospasm, oversedation, pneumothorax and drug toxicity apart, and makes the first moves for each.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M15-O4',
      subtask: 'Decides what happens to the procedure once the patient has recovered.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D13'],
  prerequisites: ['sedation-and-monitoring', 'larynx-and-entry'],

  clinicalQuestion: 'The saturation is falling and the view is clear. What do you do first?',
  objective:
    'Open every event the same way, then make the first moves for the cause you have found.',
  harmfulReflex:
    'Carrying on to finish while the patient is getting worse. The procedure can wait; the patient cannot.',
  harmfulReflexPatterns: [
    /\b(carry on|resume|finish)\b/i,
    /\btake the last\b/i,
    /\bmore lidocaine\b/i,
  ],
  anchor: {
    analogy:
      'A smoke alarm does not say which room is burning. You still put the pan down, shout, and go and look. A falling saturation is that alarm.',
    precise:
      'Stop what you are doing, say the change out loud and look at the patient, then make the first moves for the cause.',
    checklistLabel: 'When the patient changes',
    checklist: [
      'Stop',
      'Say it out loud',
      'Look at the patient',
      'First moves for the cause, help early',
    ],
  },
  outcomes: [
    {
      id: 'first-moves',
      text: 'Make the first moves for a patient who deteriorates during bronchoscopy.',
    },
    {
      id: 'name-the-event',
      text: 'Tell which event is happening from the patient and the monitor.',
    },
  ],

  spineStops: [],
  grammarRowIds: ['effort-down-oxygenation-held'],
  precommitDenyPatterns: [/\bhypoxi\w*/i],
  localPolicyIds: ['sedation_policy', 'topical_anesthetic_policy', 'recovery_and_followup'],
  reviewItemIds: ['R11', 'R12', 'R14', 'R34'],

  blocks: [
    {
      id: 'opening-bundle',
      kind: 'pattern',
      role: 'framing',
      heading: 'Three moves before you know the cause',
      body: `Every event opens the same way. Act at ${num('oxygen-trigger')}, and sooner if the patient looks worse.`,
      pointsLabel: 'The opening',
      points: [
        'Stop. Thumb off the suction. No advancing, no instilling, no sampling.',
        'Say it out loud: “Saturation is falling.” Now the whole room is working on it.',
        'Look at the patient before the screen: color, chest movement, airflow, response to voice.',
      ],
      claimClass: 'synthesis',
      sourceRefs: RESPONSE,
      reviewItemIds: ['R12', 'R34'],
    },
    {
      id: 'desaturation',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: the saturation falls',
      body: 'Suction, the scope and sedation all lower it.',
      steps: [
        'Stop suctioning. Withdraw to the trachea.',
        'Turn the oxygen up and lift the jaw.',
        'Check for breathing: chest, airflow, capnography.',
        'Still low: take the scope out and ventilate by bag and mask.',
      ],
      callForHelp: 'when the saturation has not recovered with the scope out.',
      claimClass: 'synthesis',
      sourceRefs: RECOGNITION,
    },
    {
      id: 'oversedation',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: too sedated, or not breathing',
      body: 'The patient will not rouse, or breathes slowly.',
      steps: [
        'Give no more sedative and take the scope out.',
        'Rouse the patient, open the airway and give oxygen.',
        'No breath: ventilate by bag and mask.',
        'Reverse: naloxone for the opioid, flumazenil for the benzodiazepine.',
      ],
      callForHelp: 'now if there is no breath. Sedation can return as the reversal fades.',
      claimClass: 'synthesis',
      sourceRefs: REVERSAL,
      localPolicyIds: ['sedation_policy'],
      reviewItemIds: ['R11'],
    },
    {
      id: 'laryngospasm',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: laryngospasm',
      body: 'The cords close. You see effort or hear stridor, with no airflow and a flat capnography trace.',
      steps: [
        'Withdraw the scope above the cords.',
        'Give high-flow oxygen with a jaw thrust.',
        'Hold continuous positive pressure by mask.',
        'Not breaking: propofol, then a muscle relaxant and a tube.',
      ],
      callForHelp: 'at once, for someone who can intubate.',
      claimClass: 'synthesis',
      sourceRefs: SPASM,
    },
    {
      id: 'bronchospasm',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: bronchospasm',
      body: 'You hear a wheeze. The breath out is slow and the capnography trace slopes upward.',
      steps: [
        'Stop instilling and suctioning. Withdraw to the trachea.',
        'Turn the oxygen up.',
        'Give albuterol, nebulized or by inhaler.',
        'Not easing: take the scope out.',
      ],
      callForHelp: 'when the wheeze or the saturation has not improved after albuterol.',
      claimClass: 'synthesis',
      sourceRefs: SPASM,
    },
    {
      id: 'hypotension',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: the blood pressure falls',
      body: 'Sedation is the usual cause. Check for the others.',
      steps: [
        'Recheck the pressure and give no more sedative.',
        'Look for the cause: sedation, bleeding, a tension pneumothorax, an arrhythmia.',
        'Lay the patient flat and run intravenous fluid.',
        'Still low: give a vasopressor.',
      ],
      callForHelp: 'when fluid has not restored the pressure, or the rhythm has changed.',
      claimClass: 'synthesis',
      sourceRefs: RECOGNITION,
    },
    {
      id: 'pneumothorax',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: pneumothorax',
      body: 'After a transbronchial biopsy: sharp chest pain, breathlessness and a falling saturation.',
      steps: [
        'Stop sampling and take the scope out.',
        'Give high-flow oxygen.',
        'Stable: confirm with ultrasound or radiograph.',
        'Low pressure, fast pulse: tension. Decompress before imaging.',
        'Needle or finger, fifth intercostal space in the mid-axillary line, or second in the midclavicular.',
      ],
      callForHelp: 'at once for tension and the drain.',
      claimClass: 'synthesis',
      sourceRefs: PNEUMOTHORAX,
    },
    {
      id: 'anesthetic-toxicity',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: local anesthetic toxicity',
      body: 'It starts with numb lips, a metallic taste, ringing ears or agitation. Seizure, arrhythmia and collapse follow.',
      steps: [
        'Give no more lidocaine.',
        'Send for the toxicity kit and its checklist.',
        'Give oxygen and support the airway.',
        'Treat a seizure with a benzodiazepine.',
        'Give lipid emulsion as the checklist directs.',
      ],
      callForHelp: 'at the first sign, before a seizure.',
      claimClass: 'synthesis',
      sourceRefs: TOXICITY,
      localPolicyIds: ['topical_anesthetic_policy'],
      reviewItemIds: ['R14'],
    },
    {
      id: 'methemoglobinemia',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: methemoglobinemia',
      body: `It follows benzocaine or another topical agent. The lips turn gray-blue and the saturation sits at ${num('methb-oximeter-plateau')} whatever oxygen you give.`,
      steps: [
        'Give no more of the topical agent.',
        'Give high-flow oxygen.',
        'Send blood for co-oximetry. It looks chocolate brown.',
        `Methemoglobin ${num('methb-treat-symptomatic')} with symptoms, or ${num('methb-treat-asymptomatic')} without: give methylene blue.`,
      ],
      callForHelp: 'when oxygen does not lift the saturation.',
      claimClass: 'synthesis',
      sourceRefs: METHEMOGLOBIN,
      localPolicyIds: ['topical_anesthetic_policy'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Four errors to expect',
      body: 'Each one treats the procedure or the monitor before the patient.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Finishing first. The last segments can wait. Stop now.',
        'More sedative for an agitated patient. Check the oxygen and the breathing first.',
        'Blaming the probe. Look at the patient, then resite it.',
        'Going on once the numbers recover. Recheck the patient and decide again, out loud.',
      ],
      claimClass: 'synthesis',
      sourceRefs: RESPONSE,
    },
  ],

  workspace: {
    kind: 'monitor',
    caption: 'Before the scope goes in',
    readings: vitals(
      'Regular and quiet',
      ['96', 'steady', 'On 2 L/min nasal oxygen'],
      ['84', 'steady'],
      ['138/80', 'steady', 'Adequate'],
    ),
  },

  act: {
    kind: 'scenario',
    outcomeId: 'first-moves',
    scenario: {
      id: 'biopsy-patient-deteriorates',
      title: 'One patient, from wheeze to chest drain',
      frames: [
        {
          id: 'wheeze',
          time: '6 minutes in',
          situation:
            'A 62-year-old man with COPD is having transbronchial biopsies of the right lower lobe under moderate sedation. As the scope reaches the lower lobe he coughs and you hear a wheeze. Each breath out is slow. The view is clear.',
          readings: vitals(
            'Wheeze. Slow breath out',
            ['91', 'falling', 'Falling on 2 L/min'],
            ['104', 'rising'],
            ['148/84', 'steady', 'Adequate'],
          ),
          prompt: 'What do you do first?',
          choices: [
            {
              id: 'a',
              label: 'Withdraw to the trachea, turn the oxygen up and give albuterol',
              rationale:
                'This is bronchospasm. Take the stimulus away, support the oxygen and open the airways with a bronchodilator.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Carry on and take the biopsies quickly before it worsens',
              rationale:
                'The scope and the forceps are the stimulus. Going on tightens the airways further.',
              plausibility: 'unsafe',
              consequence: {
                situation: 'The wheeze is louder and he is working hard to breathe out.',
                readings: vitals(
                  'Loud wheeze. Labored',
                  ['86', 'falling', 'Falling'],
                  ['120', 'rising'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Ask for more midazolam to settle the cough',
              rationale:
                'A sedative does not open a narrowed airway. It takes away the drive he is using to breathe through it.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'He is quieter. The wheeze is unchanged and his breaths are shallower.',
                readings: vitals(
                  'Wheeze. Shallow breaths',
                  ['87', 'falling', 'Falling'],
                  ['110', 'rising'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Pause with the scope held still in the lower lobe',
              rationale:
                'A still scope in the lower lobe still stimulates the airway and still fills part of it.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'He coughs around the scope and the wheeze does not ease.',
                readings: vitals(
                  'Wheeze. Coughing',
                  ['89', 'falling', 'Falling'],
                  ['112', 'rising'],
                ),
              },
            },
          ],
        },
        {
          id: 'chest-pain',
          time: '15 minutes in',
          situation:
            'The wheeze cleared with albuterol. You rechecked him, agreed out loud to go on, and have taken three biopsies. Now he says his right chest hurts sharply when he breathes in, and he is more breathless. No blood is in the view.',
          readings: vitals(
            'Fast and shallow',
            ['92', 'falling', 'Falling on 4 L/min'],
            ['112', 'rising'],
            ['132/78', 'steady', 'Adequate'],
          ),
          prompt: 'What now?',
          choices: [
            {
              id: 'a',
              label: 'Scope out, high-flow oxygen, and ultrasound to the right chest',
              rationale:
                'Sharp pain and breathlessness after a transbronchial biopsy is a pneumothorax until imaging says otherwise.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Take the last two biopsies, then deal with the pain',
              rationale: 'Each further biopsy can tear the pleura again and enlarge the leak.',
              plausibility: 'unsafe',
              consequence: {
                situation: 'After the next biopsy he is gasping and cannot finish a sentence.',
                readings: vitals('Gasping', ['86', 'falling', 'Falling'], ['126', 'rising']),
              },
            },
            {
              id: 'c',
              label: 'Give more fentanyl for the pain',
              rationale:
                'An opioid quiets the pain and hides the sign. It also slows the breathing he depends on.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The pain eases. His breathing slows and the saturation keeps falling.',
                readings: vitals(
                  'Slower. Still shallow',
                  ['88', 'falling', 'Falling'],
                  ['108', 'steady'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Pause and wedge the scope in the segment for bleeding',
              rationale:
                'A wedge is for blood, and none is in view. This pain comes from the pleura.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'Nothing bleeds. He grows more breathless with the scope still in.',
                readings: vitals(
                  'Faster. More labored',
                  ['89', 'falling', 'Falling'],
                  ['118', 'rising'],
                ),
              },
            },
          ],
        },
        {
          id: 'tension',
          time: '18 minutes in',
          situation:
            'The scope is out and he is on high-flow oxygen. The ultrasound machine is on its way. He is gray and sweating. The right chest is not moving and you hear no breath sounds over it.',
          readings: vitals(
            'Gasping. Right chest still',
            ['84', 'falling', 'Falling on high-flow oxygen'],
            ['136', 'rising'],
            ['78/46', 'falling', 'Falling'],
          ),
          prompt: 'What do you do?',
          choices: [
            {
              id: 'a',
              label: 'Decompress the right chest now',
              rationale:
                'A low pressure, a fast heart rate and a silent side mean tension. Letting the air out is the treatment.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Hold on for a chest radiograph to confirm it',
              rationale:
                'Tension is diagnosed at the bedside. He can arrest in the time a film takes.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'The radiographer is setting up. His pulse is weak and he no longer answers.',
                readings: vitals(
                  'Agonal',
                  ['76', 'falling', 'Falling'],
                  ['144', 'rising'],
                  ['62/38', 'falling', 'Falling'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Give a fluid bolus and recheck the pressure',
              rationale:
                'Fluid does not let trapped air out. The pressure is low because the heart cannot fill.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The fluid runs in. The pressure does not move.',
                readings: vitals(
                  'Gasping',
                  ['80', 'falling', 'Falling'],
                  ['140', 'rising'],
                  ['70/42', 'falling', 'Falling'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Intubate and ventilate him before anything else',
              rationale:
                'Positive pressure pushes more air into the pleural space and tightens the tension.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'With each breath you give, the bag gets harder to squeeze.',
                readings: vitals(
                  'Ventilated. Hard to inflate',
                  ['74', 'falling', 'Falling'],
                  ['148', 'rising'],
                  ['58/34', 'falling', 'Falling'],
                ),
              },
            },
          ],
        },
        {
          id: 'after-decompression',
          time: '21 minutes in',
          situation:
            'Air hissed out as the chest was decompressed. He is pink and talking again. Three of the planned biopsies are done and the left lung has not been inspected.',
          readings: vitals(
            'Easier',
            ['94', 'rising', 'Recovering on high-flow oxygen'],
            ['108', 'falling'],
            ['116/70', 'rising', 'Recovering'],
          ),
          prompt: 'What is the plan now?',
          choices: [
            {
              id: 'a',
              label: 'End the procedure and have a chest drain placed',
              rationale:
                'Decompression buys time. The lung is still leaking, so he needs a drain and monitoring, and the procedure is over.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Resume and inspect the left lung while he is stable',
              rationale:
                'He is recovering, not stable. More sedation and more time put him back where he was.',
              plausibility: 'unsafe',
              consequence: {
                situation: 'Sedated again, he breathes less and the air builds up once more.',
                readings: vitals(
                  'Shallow',
                  ['87', 'falling', 'Falling'],
                  ['124', 'rising'],
                  ['92/54', 'falling', 'Falling'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Take the needle out, since the pressure has come back',
              rationale: 'The leak has not sealed. With no drain, the air collects again.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'Within minutes he is breathless again and the pressure is falling.',
                readings: vitals(
                  'Fast. Labored',
                  ['88', 'falling', 'Falling'],
                  ['126', 'rising'],
                  ['88/50', 'falling', 'Falling'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Pause, then send him to recovery for a film later',
              rationale:
                'Recovery cannot look after a decompressed chest. The drain goes in before he leaves the room.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'In recovery the needle comes out and no one there can replace it.',
                readings: vitals(
                  'Fast. Labored',
                  ['86', 'falling', 'Falling'],
                  ['128', 'rising'],
                  ['84/50', 'falling', 'Falling'],
                ),
              },
            },
          ],
        },
      ],
      sourceRefs: [...SPASM, ...PNEUMOTHORAX],
    },
  },

  prediction: {
    id: 'N11',
    itemType: 'management-decision',
    situation:
      'A 67-year-old man is 12 minutes into an inspection under midazolam and fentanyl. He becomes restless and pulls at the drapes. His SpO₂ is 89%, down from 96%. The nurse offers more midazolam.',
    stem: 'What do you ask for?',
    choices: [
      {
        id: 'a',
        label: 'Oxygen turned up, his jaw lifted, and no more sedative',
        rationale:
          'A restless patient with a falling saturation is hypoxic until you have shown otherwise. Treat the oxygen, not the movement.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'The midazolam, so he settles and you get a steady view',
        rationale:
          'He is restless because he is short of oxygen. More sedative slows the breathing that is already failing.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'A minute to finish the last two segments before anything changes',
        rationale:
          'The scope is part of the problem. Every further minute in the airway takes oxygen from him.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'The probe moved to another finger before anyone acts on it',
        rationale:
          'He has changed, and so has the number. A patient who looks worse is not a probe fault.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Hypoxia makes patients restless before it makes them still. Sedating the restlessness removes the last sign you had and deepens the cause. Stop, say it, look at him, and give oxygen.',
    objectiveIds: ['M15-O1'],
    outcomeIds: ['name-the-event'],
    claimClass: 'source',
    sourceRefs: RECOGNITION,
  },

  transfer: {
    id: 'deterioration-transfer',
    itemType: 'management-decision',
    situation:
      'A 52-year-old woman who weighs 48 kg coughs through a long inspection. Lidocaine has been sprayed many times. She says her lips are numb and her ears are ringing. Her arm starts to twitch.',
    stem: 'What do you do?',
    choices: [
      {
        id: 'a',
        label: 'Give no more lidocaine and send for the lipid emulsion kit',
        rationale:
          'Numb lips, ringing ears and twitching after repeated lidocaine are toxicity. Get the treatment to the bedside before she seizes.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Spray more lidocaine to settle the cough, then finish quickly',
        rationale: 'The drug is the cause. Each further spray adds to a dose already too high.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Tell her that numb lips are expected after a throat spray',
        rationale:
          'Numb lips alone could be the spray. Ringing ears and twitching are not a local effect.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Pause the inspection and recheck her in five minutes',
        rationale:
          'Twitching turns to seizure and arrhythmia within minutes. Waiting spends the time you have to prepare.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A small patient reaches a toxic dose sooner, and every spray counts toward the total. Call for help and the kit, give oxygen, and treat a seizure with a benzodiazepine.',
    objectiveIds: ['M15-O3'],
    outcomeIds: ['first-moves'],
    claimClass: 'source',
    sourceRefs: TOXICITY,
    reviewItemIds: ['R14'],
    retrievesFrom: 'sedation-and-monitoring',
    transferVariant:
      'A different patient and a different event from the case: a drug effect, not the airway or the pleura.',
  },

  practice: [
    {
      id: 'C08',
      manifestCaseId: 'C08',
      presentationTitle: 'Chest pain in recovery',
      situation:
        'A 48-year-old man is in recovery 40 minutes after a transbronchial biopsy. He has new sharp right chest pain and is more breathless. He is talking. SpO₂ is 93% on 2 L/min, heart rate 98, blood pressure 126/78.',
      item: {
        id: 'C08',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Examine him and get an ultrasound or chest radiograph now',
            rationale:
              'This is a pneumothorax until imaging says otherwise. His pressure is holding, so there is time to confirm it.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Decompress the right chest with a needle straight away',
            rationale:
              'A needle is for tension. His pressure and heart rate are holding, so confirm it first.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Give him analgesia and send him home with advice',
            rationale:
              'The reassuring check at the end of the procedure is out of date. New symptoms need a fresh look.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Pause his discharge and look at him again in an hour',
            rationale:
              'A pneumothorax can grow in an hour. Watching without imaging finds it late.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A pneumothorax can appear after the procedure has ended. With a steady pressure, confirm it and size it. A falling pressure and a rising heart rate change that: decompress first.',
        objectiveIds: ['M15-O3'],
        outcomeIds: ['first-moves'],
        claimClass: 'source',
        sourceRefs: PNEUMOTHORAX,
      },
    },
    {
      id: 'mc-airflow-stops-at-the-cords',
      presentationTitle: 'Effort with no airflow',
      situation:
        'You are spraying lidocaine onto the cords of a lightly sedated woman. The cords snap shut. Her chest heaves but nothing moves at her mouth, and the capnography trace is flat. SpO₂ is 91% and falling.',
      item: {
        id: 'mc-airflow-stops-at-the-cords',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Withdraw above the cords and hold positive pressure by mask',
            rationale:
              'Effort with no airflow and closed cords is laryngospasm. Take the stimulus away and hold pressure until it breaks.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Push the scope through the closed cords to open them',
            rationale:
              'Force on closed cords injures them and feeds the spasm. The scope is what set it off.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Ask for albuterol to treat the airway narrowing',
            rationale:
              'Albuterol is for a wheeze from the bronchi. Here no air is passing the larynx to carry it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Pause with the tip at the cords until they relax',
            rationale:
              'A scope resting at the cords keeps them closed. She has no air while you wait.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Bronchospasm moves some air and you hear it. Laryngospasm moves none: effort, silence and a flat trace. Come off the cords, give oxygen and hold pressure by mask.',
        objectiveIds: ['M15-O3'],
        outcomeIds: ['name-the-event'],
        claimClass: 'source',
        sourceRefs: SPASM,
      },
    },
    {
      id: 'mc-gray-lips-on-oxygen',
      presentationTitle: 'Gray lips on oxygen',
      situation:
        'A man had benzocaine spray to the throat 20 minutes ago. His lips are gray-blue. SpO₂ reads 86% and has not moved on 15 L/min by mask. He is alert, breathing easily at 16 a minute, with a normal capnography trace.',
      item: {
        id: 'mc-gray-lips-on-oxygen',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Send co-oximetry and get methylene blue ready',
            rationale:
              'A saturation that ignores oxygen in a comfortable patient after benzocaine is methemoglobin. Co-oximetry measures it.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Give naloxone and flumazenil for oversedation',
            rationale:
              'He is alert and breathing well, with a normal trace. Reversal treats a problem he does not have.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Resite the probe and trust the next reading',
            rationale:
              'His lips are gray. The patient and the number agree, so the probe is not at fault.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Pause and give the oxygen more time to work',
            rationale:
              'Oxygen cannot load hemoglobin that has been oxidized. Time on the mask changes nothing.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation: `Methemoglobin cannot carry oxygen, and the oximeter reads ${num('methb-oximeter-plateau')} whatever you give. Stop the agent, measure the level and treat with methylene blue.`,
        objectiveIds: ['M15-O3'],
        outcomeIds: ['name-the-event'],
        claimClass: 'update',
        sourceRefs: METHEMOGLOBIN,
      },
    },
  ],
}
