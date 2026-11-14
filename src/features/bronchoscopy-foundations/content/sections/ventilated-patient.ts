import type { SourceRef } from '../../data/sources'
import { num } from '../numbers'
import type { BronchSectionDefinition, MonitorReading, MonitorTrend } from '../types'

/**
 * The ventilated patient (rewrite, brief 15). It absorbs `scope-in-a-tube` and `icu-physiology`.
 * The fellow learns the margin between the tube and the scope, the swivel adapter, the settings
 * before the scope goes in, and how to read the ventilator while it is in: peak against plateau,
 * the delivered volume and auto-PEEP. They pick tube and scope pairs, then follow one patient
 * through a bronchoscopy on the ventilator.
 *
 * The brief's fix: the pressure limit is raised with the respiratory therapist before the scope
 * goes in (U2, grade 3A). The first course graded that as unsafe.
 *
 * Cut by the brief: the tube-navigation task, the procedure-taxonomy sort, and fluoroscopy, which
 * section 12 teaches.
 *
 * Sources: the course textbook (S1), the Indian critical care bronchoscopy guideline (U2), the
 * ventilation-mode taxonomy (U8) and the lecture's case (T15) for case C17.
 */
const TUBE: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 95, to: 96 } },
]
const VENTILATOR: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
  {
    sourceId: 'U2',
    location: { kind: 'section', label: 'Bronchoscopy in the ventilated patient' },
  },
]
const MODES: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } },
  { sourceId: 'U8', location: { kind: 'section', label: 'ventilation modes' } },
]
const TRAPPED_GAS: readonly SourceRef[] = [
  {
    sourceId: 'U22',
    location: { kind: 'section', label: 'Chapter 31, intrinsic and external PEEP' },
  },
]
const ALARMS: SourceRef = {
  sourceId: 'U22',
  location: { kind: 'section', label: 'Chapter 53, low exhaled tidal volume alarms' },
}
const LECTURE_CASE: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } },
  { sourceId: 'T15', location: { kind: 'time-span', start: '00:18:49', end: '00:22:00' } },
]

const TREND_WORDS: Record<MonitorTrend, string> = {
  steady: 'Unchanged',
  rising: 'Rising',
  falling: 'Falling',
  lost: 'Lost',
  new: 'New',
}

/** The ventilator and the monitor at one moment of the case. Values are written for this case. */
function ventilator(
  peak: readonly [string, MonitorTrend],
  volume: readonly [string, MonitorTrend],
  spo2: readonly [string, MonitorTrend],
  bloodPressure: readonly [string, MonitorTrend],
): readonly MonitorReading[] {
  const reading = (
    channel: MonitorReading['channel'],
    [value, trend]: readonly [string, MonitorTrend],
    unit: string,
  ): MonitorReading => ({
    channel,
    words: TREND_WORDS[trend],
    trend,
    value,
    unit,
    provenance: 'authored',
  })
  return [
    reading('peak-pressure', peak, 'cmH₂O'),
    reading('exhaled-volume', volume, 'mL'),
    reading('oximetry', spo2, '%'),
    reading('blood-pressure', bloodPressure, 'mmHg'),
  ]
}

export const section: BronchSectionDefinition = {
  id: 'ventilated-patient',
  authoringContract: 2,
  title: 'The ventilated patient',
  shortTitle: 'Ventilated patient',
  minutes: 12,
  activityMinutes: 4,
  moduleIds: ['M16'],
  objectives: [
    {
      objectiveId: 'M16-O1',
      subtask: 'Picks the scope for a tube from the margin between them, for six pairs.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M16-O2',
      subtask: 'Sets the ventilator with the respiratory therapist before the scope goes in.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M16-O5',
      subtask:
        'Says which reading moves in a volume-targeted and in a pressure-targeted mode when the scope is in.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M16-O6',
      subtask:
        'Takes the scope out when the delivered volume falls, and keeps pneumothorax among the causes.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D15', 'D23'],
  prerequisites: ['sedation-and-monitoring', 'pre-use-check', 'deterioration'],

  clinicalQuestion:
    'The patient is on a ventilator and the scope goes down the same tube as every breath. What do you set first?',
  objective:
    'Choose a scope the tube can take, set the ventilator before you go in, and read it while you work.',
  harmfulReflex:
    'Staying in to finish the suction while the delivered volume falls. Come out and let the patient breathe.',
  harmfulReflexPatterns: [/\bstay in\b/i, /\bkeep (clearing|suctioning)\b/i],
  anchor: {
    analogy:
      'Breathing through the tube with a scope in it is drinking through a straw with a pencil pushed down it. Every sip takes more effort and brings less.',
    precise:
      'The scope takes part of the tube, so set the ventilator before you go in and watch the delivered volume while you work.',
    checklistLabel: 'Before the scope goes down the tube',
    checklist: [
      'A scope the tube can take',
      'Oxygen up, limits set with the therapist',
      'Watch the delivered volume',
      'Volume falling: scope out',
    ],
  },
  outcomes: [
    {
      id: 'pair-and-set',
      text: 'Pair a scope with a tube and set the ventilator before the procedure.',
    },
    {
      id: 'read-the-ventilator',
      text: 'Read the ventilator during the procedure and act when ventilation falls.',
    },
  ],

  spineStops: [],
  grammarRowIds: ['pressure-up-volume-down'],
  precommitDenyPatterns: [/\bmargin\b/i],
  localPolicyIds: ['icu_bronchoscopy_policy', 'scope_ifu'],
  reviewItemIds: ['R29', 'R30', 'R31'],

  blocks: [
    {
      id: 'the-margin',
      kind: 'pattern',
      role: 'framing',
      heading: 'The scope and the tube',
      body: `The scope fills part of the tube, and gas moves through what is left. Resistance climbs steeply as that space narrows. The tube’s inner diameter should be ${num('tube-scope-margin')} larger than the scope’s outer diameter.`,
      pointsLabel: 'The scopes you will be handed',
      points: [
        `Therapeutic: ${num('scope-therapeutic-od')} outside.`,
        `Diagnostic: ${num('scope-diagnostic-od')} outside.`,
        `Thin: ${num('scope-thin-od')} outside.`,
        `To suction through the tube, the working channel should be ${num('working-channel-minimum')}.`,
      ],
      claimClass: 'synthesis',
      sourceRefs: [...TUBE, VENTILATOR[1]],
      localPolicyIds: ['scope_ifu'],
      reviewItemIds: ['R31'],
    },
    {
      id: 'swivel-adapter',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'The swivel adapter',
      body: 'The adapter sits between the tube and the circuit. The scope goes through its sealed port, so the breaths and the PEEP continue while you work.\n\nLubricate the scope and fit a bite block. Never open the circuit to pass the scope.',
      claimClass: 'synthesis',
      sourceRefs: VENTILATOR,
      localPolicyIds: ['icu_bronchoscopy_policy'],
    },
    {
      id: 'settings-before',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Set the ventilator before you go in',
      body: 'Make these changes with the respiratory therapist. Note the baseline first.',
      pointsLabel: 'Five settings',
      points: [
        `Oxygen: FiO₂ ${num('vent-fio2')}, starting ${num('vent-fio2-lead-time')} before.`,
        'Mode: a volume-targeted mode pushes each breath past the scope.',
        `Tidal volume: may be raised by ${num('vent-tidal-volume-increase')} if delivery falls.`,
        'Pressure limit: raise it, so the alarm does not cut each breath short.',
        'PEEP: the scope traps gas and adds its own. Decide whether to lower it.',
      ],
      claimClass: 'update',
      sourceRefs: VENTILATOR,
      localPolicyIds: ['icu_bronchoscopy_policy'],
      reviewItemIds: ['R31'],
    },
    {
      id: 'peak-and-plateau',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Read the ventilator with the scope in',
      body: 'Peak pressure drives gas down the tube. Plateau pressure, measured with an inspiratory pause, is the lung alone.',
      pointsLabel: 'What each pattern means',
      points: [
        'Peak up, plateau unchanged: the scope’s resistance. Expected.',
        'Peak and plateau both up: more than the scope. Think trapped gas, pneumothorax, a plugged lobe, or a tube in one bronchus.',
        'Pressure control: the pressure holds and the delivered volume falls. The high-pressure alarm does not warn you. Low-volume and low minute-ventilation alarms can, if set near baseline.',
        'Auto-PEEP: the breath out does not finish before the next breath. Gas stacks up, the plateau rises and the blood pressure falls. A longer breath out, or a moment off the circuit, releases it.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [...MODES, ...TRAPPED_GAS, ALARMS],
      reviewItemIds: ['R29'],
    },
    {
      id: 'raising-tidal-volume',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Raising the tidal volume',
      body: `The scope can cost delivered volume. When the exhaled volume is below baseline and the plateau has not moved, raising the set volume by ${num('vent-tidal-volume-increase')} may win it back. Aim for the baseline breath, not a bigger one.`,
      pointsLabel: 'Do not raise it further when',
      points: [
        'The plateau climbs. The extra gas is reaching the lung, so turn the volume back. This matters most on lung-protective settings.',
        'The breath out does not finish. A bigger breath stacks more gas. A smaller breath protects against hyperinflation, at the cost of a rising carbon dioxide, so take the scope out.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [VENTILATOR[1], ...TRAPPED_GAS],
      localPolicyIds: ['icu_bronchoscopy_policy'],
    },
    {
      id: 'ventilation-falls',
      kind: 'pattern',
      role: 'first-moves',
      heading: 'First moves: the delivered volume falls',
      body: 'Say it out loud with the number: “Volume is down to half.”',
      steps: [
        'Take the scope out of the tube.',
        'Give the patient time to breathe out fully.',
        'Check that the volume and the blood pressure come back.',
        'Not back: check the tube, listen to both sides, and look for a pneumothorax.',
      ],
      callForHelp: 'when the volume or the blood pressure has not recovered with the scope out.',
      claimClass: 'synthesis',
      sourceRefs: VENTILATOR,
      reviewItemIds: ['R30'],
    },
    {
      id: 'suction-and-recruitment',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Suction empties the lung',
      body: 'Suction takes gas as well as secretions, and the lung collapses a little with each pass. Keep passes short, with a few breaths between.\n\nAfterwards, listen to both sides, then recruit with the therapist. Then return the oxygen, tidal volume and pressure limit to baseline.',
      claimClass: 'synthesis',
      sourceRefs: VENTILATOR,
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Four errors to expect',
      body: 'Each one trusts the fit or the oximeter over the ventilator.',
      pointsLabel: 'The error, then the fix',
      points: [
        'The scope passes, so it fits. Passing is not ventilating. Check the margin.',
        'Watching the saturation. It falls late. Watch the delivered volume.',
        'One long pass to finish. Short passes, with breaths between.',
        'Leaving the oxygen and the limits raised. Recruit, then return to baseline.',
      ],
      claimClass: 'synthesis',
      sourceRefs: VENTILATOR,
      reviewItemIds: ['R31'],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption: 'Before any change is made',
    readings: ventilator(
      ['24', 'steady'],
      ['450', 'steady'],
      ['94', 'steady'],
      ['118/66', 'steady'],
    ),
  },

  act: {
    kind: 'scenario',
    outcomeId: 'read-the-ventilator',
    scenario: {
      id: 'plug-on-the-ventilator',
      title: 'One bronchoscopy on the ventilator',
      frames: [
        {
          id: 'before',
          time: '10 minutes before the scope',
          situation:
            'A 64-year-old man with pneumonia is ventilated through an 8.0 mm tube: volume control, 450 mL, FiO₂ 0.5, PEEP 8. His left lower lobe has collapsed behind a mucus plug. You have the diagnostic scope and the therapist is at the bedside.',
          readings: ventilator(
            ['24', 'steady'],
            ['450', 'steady'],
            ['94', 'steady'],
            ['118/66', 'steady'],
          ),
          prompt: 'What do you set up?',
          choices: [
            {
              id: 'a',
              label: 'Oxygen to full, swivel adapter on, pressure limit raised with the therapist',
              rationale:
                'He starts with an oxygen reserve, keeps his PEEP through the adapter, and the alarm will not cut his breaths short.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Take the circuit off the tube and pass the scope down the open end',
              rationale:
                'An open circuit gives no breaths and no PEEP. The lung collapses while you work.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'With the circuit off he gets no breaths. The alarm sounds for apnea.',
                readings: ventilator(
                  ['0', 'lost'],
                  ['0', 'lost'],
                  ['85', 'falling'],
                  ['110/60', 'falling'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Go in through the adapter with every setting as it is',
              rationale:
                'At the old limit the ventilator ends each breath early once the scope raises the pressure.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'The high-pressure alarm sounds with every breath, and each one is cut short.',
                readings: ventilator(
                  ['40', 'rising'],
                  ['210', 'falling'],
                  ['89', 'falling'],
                  ['116/64', 'steady'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Pause, and have the alarms silenced so they do not interrupt you',
              rationale:
                'A silent alarm still ends the breath early. You have lost the warning and kept the problem.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The room is quiet. Each breath is still cut short and nobody sees it.',
                readings: ventilator(
                  ['40', 'rising'],
                  ['200', 'falling'],
                  ['87', 'falling'],
                  ['114/62', 'steady'],
                ),
              },
            },
          ],
        },
        {
          id: 'scope-in',
          time: '1 minute after the scope goes in',
          situation:
            'The scope is in the trachea. Peak pressure has risen from 24 to 41 cmH₂O. The therapist does an inspiratory pause: plateau pressure is 19, as it was before. The breath out finishes before the next breath starts.',
          readings: ventilator(
            ['41', 'rising'],
            ['440', 'steady'],
            ['99', 'steady'],
            ['120/68', 'steady'],
          ),
          prompt: 'The peak pressure has nearly doubled. What do you do?',
          choices: [
            {
              id: 'a',
              label: 'Go on to the left lower lobe and watch the delivered volume',
              rationale:
                'Peak up with the plateau unchanged is the scope’s resistance. The volume is holding, so this is expected.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Withdraw and treat him for bronchospasm',
              rationale:
                'Bronchospasm would slow the breath out. His finishes, and the pressure rose the moment the scope went in.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'The scope is out and the peak is back at baseline. The plug is still there.',
                readings: ventilator(
                  ['24', 'falling'],
                  ['450', 'steady'],
                  ['99', 'steady'],
                  ['120/68', 'steady'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Have the tidal volume turned down until the peak is normal',
              rationale:
                'The pressure is spent in the tube, not in his lungs. A smaller breath only ventilates him less.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'The peak is lower. So is every breath he gets.',
                readings: ventilator(
                  ['30', 'falling'],
                  ['280', 'falling'],
                  ['95', 'falling'],
                  ['120/68', 'steady'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Pause with the scope in place and send for a chest radiograph',
              rationale:
                'A pneumothorax raises the plateau too. His has not moved, and waiting with the scope in costs ventilation.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'Ten minutes pass with the scope in the tube. The film is normal.',
                readings: ventilator(
                  ['42', 'steady'],
                  ['410', 'falling'],
                  ['96', 'falling'],
                  ['118/66', 'steady'],
                ),
              },
            },
          ],
        },
        {
          id: 'volume-falls',
          time: '4 minutes in',
          situation:
            'You have been suctioning thick mucus from the left lower lobe in one long pass. The breath out no longer finishes before the next breath starts, and the therapist measures an auto-PEEP of 9 cmH₂O.',
          readings: ventilator(
            ['46', 'rising'],
            ['260', 'falling'],
            ['89', 'falling'],
            ['92/50', 'falling'],
          ),
          prompt: 'Half the plug is still there. What do you do?',
          choices: [
            {
              id: 'a',
              label: 'Take the scope out and give him time to breathe out',
              rationale:
                'The volume and the blood pressure are falling and gas is trapped. Out of the tube, he can empty his lungs and take full breaths.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Stay in and suction faster to finish the plug',
              rationale:
                'More suction takes more gas from lungs that are already short of it. The plug can wait two minutes.',
              plausibility: 'unsafe',
              consequence: {
                situation: 'The plug is nearly out. He is gray and the pressure alarm is constant.',
                readings: ventilator(
                  ['48', 'rising'],
                  ['180', 'falling'],
                  ['81', 'falling'],
                  ['74/40', 'falling'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Have the tidal volume raised to bring his breaths back',
              rationale:
                'His breath out has not finished. A bigger breath, like a faster rate, stacks more gas on what is trapped, and the blood pressure falls further.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'At the larger volume the auto-PEEP climbs to 14 cmH₂O.',
                readings: ventilator(
                  ['50', 'rising'],
                  ['230', 'falling'],
                  ['86', 'falling'],
                  ['78/44', 'falling'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Pause the suction and hold the scope where it is',
              rationale:
                'Stopping suction helps. The scope still narrows the tube, so the gas stays trapped.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'With the scope still in the tube, the breath out still does not finish.',
                readings: ventilator(
                  ['45', 'steady'],
                  ['290', 'steady'],
                  ['88', 'falling'],
                  ['88/48', 'falling'],
                ),
              },
            },
          ],
        },
        {
          id: 'afterwards',
          time: '12 minutes in, scope out',
          situation:
            'He recovered with the scope out, and two short passes cleared the plug. The scope is now out for good. Plateau pressure is 24 cmH₂O, up from 19, and he is still on full oxygen with the raised limit. Breath sounds are equal on both sides.',
          readings: ventilator(
            ['30', 'steady'],
            ['450', 'steady'],
            ['92', 'steady'],
            ['116/64', 'steady'],
          ),
          prompt: 'The airway is clear. What is left to do?',
          choices: [
            {
              id: 'a',
              label: 'Recruit the lung, then return each setting to baseline',
              rationale:
                'Both sides move air, so the higher plateau is lung that suction collapsed, not a pneumothorax. Reopen it, then bring the settings back.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Return every setting to baseline now and leave',
              rationale:
                'The settings are only half of it. The lung that suction collapsed stays collapsed until someone reopens it.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'Back on his old oxygen, the saturation drifts down.',
                readings: ventilator(
                  ['30', 'steady'],
                  ['450', 'steady'],
                  ['87', 'falling'],
                  ['116/64', 'steady'],
                ),
              },
            },
            {
              id: 'c',
              label: 'Leave the oxygen at full and the limit raised overnight',
              rationale:
                'Full oxygen hides the collapse and causes more of it. A raised limit no longer has a reason.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation: 'By morning the film shows new collapse at both bases.',
                readings: ventilator(
                  ['32', 'rising'],
                  ['450', 'steady'],
                  ['93', 'steady'],
                  ['114/62', 'steady'],
                ),
              },
            },
            {
              id: 'd',
              label: 'Pause, then go back in to look for more mucus',
              rationale:
                'You saw the lobe clear. Another pass takes more gas from a lung that needs reopening.',
              plausibility: 'incorrect-mechanism',
              consequence: {
                situation:
                  'The airways are clear. After the extra pass the plateau is higher still.',
                readings: ventilator(
                  ['33', 'rising'],
                  ['450', 'steady'],
                  ['89', 'falling'],
                  ['112/60', 'steady'],
                ),
              },
            },
          ],
        },
      ],
      sourceRefs: [...VENTILATOR, MODES[1]],
    },
  },

  moreActs: {
    pairs: {
      kind: 'sort',
      outcomeId: 'pair-and-set',
      sort: {
        id: 'tube-and-scope-pairs',
        caseValues: true,
        prompt: 'Six pairs of tube and scope. Decide whether each pair leaves the margin.',
        origins: [
          {
            id: 'margin-met',
            label: 'Margin met',
            definition: `The tube is ${num('tube-scope-margin')} wider than the scope.`,
          },
          {
            id: 'too-tight',
            label: 'Too tight',
            definition: 'Take a slimmer scope, or plan for a larger tube.',
          },
        ],
        rows: [
          {
            id: 'therapeutic-in-small',
            statement: `The therapeutic scope (${num('scope-therapeutic-od')}) in a 7.5 mm tube.`,
            origin: 'too-tight',
            rationale: 'The margin is 1.7 mm. Take the diagnostic scope, which leaves 2.6 mm.',
          },
          {
            id: 'diagnostic-in-medium',
            statement: `The diagnostic scope (${num('scope-diagnostic-od')}) in a 7.0 mm tube.`,
            origin: 'margin-met',
            rationale: 'The margin is 2.1 mm.',
          },
          {
            id: 'therapeutic-in-large',
            statement: `The therapeutic scope (${num('scope-therapeutic-od')}) in an 8.0 mm tube.`,
            origin: 'margin-met',
            rationale: 'The margin is 2.2 mm, and you have the large channel for thick secretions.',
          },
          {
            id: 'diagnostic-in-small',
            statement: `The diagnostic scope (${num('scope-diagnostic-od')}) in a 6.5 mm tube.`,
            origin: 'too-tight',
            rationale: 'The margin is 1.6 mm. The thin scope leaves 2.3 mm.',
          },
          {
            id: 'thin-in-smallest',
            statement: `The thin scope (${num('scope-thin-od')}) in a 6.0 mm tube.`,
            origin: 'too-tight',
            rationale:
              'The margin is 1.8 mm, and no slimmer scope has a channel you can suction through.',
          },
          {
            id: 'thin-in-small',
            statement: `The thin scope (${num('scope-thin-od')}) in a 6.5 mm tube.`,
            origin: 'margin-met',
            rationale: 'The margin is 2.3 mm.',
          },
        ],
        sourceRefs: [...TUBE, VENTILATOR[1]],
      },
    },
  },

  prediction: {
    id: 'Q26',
    seedId: 'Q26',
    itemType: 'management-decision',
    situation:
      'A man on a ventilator needs secretions cleared through his 7.5 mm tube. On the bench the 5.8 mm therapeutic scope slides through a spare tube of the same size.',
    stem: 'What do you do?',
    choices: [
      {
        id: 'a',
        label: 'Change to the diagnostic scope before you start',
        rationale:
          'A scope that passes can still leave too little room to breathe around. The slimmer scope leaves more than the larger one does.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Go ahead with it, as a scope that passes leaves room',
        rationale:
          'Passing shows the scope is narrower than the tube. It says nothing about the gas that has to get past it.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Go ahead, and stay in for one long pass to be quick',
        rationale:
          'A long pass through a crowded tube is the longest time he goes with small breaths and suction.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'Go ahead, with the ventilator on standby while the scope is in',
        rationale: 'On standby he gets no breaths at all. The adapter exists so he keeps them.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation: `The margin decides it, not whether the scope passes. The tube should be ${num('tube-scope-margin')} wider than the scope. In this tube the therapeutic scope leaves less than that, and the diagnostic scope leaves more.`,
    objectiveIds: ['M16-O1'],
    outcomeIds: ['pair-and-set'],
    claimClass: 'update',
    sourceRefs: [...TUBE, VENTILATOR[1]],
    reviewItemIds: ['R31'],
  },

  transfer: {
    id: 'ventilated-patient-transfer',
    itemType: 'management-decision',
    situation:
      'A woman with a tracheostomy is on pressure control. You pass the thin scope through the adapter. Her peak pressure stays at 22 cmH₂O and the high-pressure alarm is silent. So is the low-volume alarm, set well below her baseline. Her delivered volume has gone from 420 to 250 mL.',
    stem: 'The pressure has not moved. What is your next step?',
    choices: [
      {
        id: 'a',
        label: 'Take the scope out and plan shorter passes with a higher set pressure',
        rationale:
          'In pressure control the pressure is fixed and the volume is what gives. The high-pressure alarm will not tell you, and a low-volume alarm will only if set near her baseline.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Go on with the inspection while the pressure and the alarms are quiet',
        rationale:
          'The pressure is quiet because the ventilator holds it there. The breaths have shrunk by nearly half.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Stay in until the saturation starts to fall',
        rationale:
          'On raised oxygen the saturation falls late. By then she has been under-ventilated for minutes.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'Pause and have the oxygen turned up further',
        rationale: 'Oxygen does not move gas. Her problem is the size of each breath.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A pressure-control breath is held at the set pressure for the set time, so the scope shows up as lost volume, not as a high-pressure alarm. A low-volume or low minute-ventilation alarm sounds only when its limit is crossed, so have it set near baseline. Watch the delivered volume on every pass, and come out when it falls.',
    objectiveIds: ['M16-O5'],
    outcomeIds: ['read-the-ventilator'],
    claimClass: 'update',
    sourceRefs: [...MODES, ALARMS],
    reviewItemIds: ['R29'],
    retrievesFrom: 'deterioration',
    transferVariant:
      'A different airway and a different mode from the case: the pressure stays put and the volume falls.',
  },

  practice: [
    {
      id: 'C17',
      manifestCaseId: 'C17',
      presentationTitle: 'The scope fits, and the patient gets worse',
      situation:
        'A man is ventilated on pressure control through a 7.5 mm tube. A 6.2 mm scope has been in for a long clearance, with a lot of coughing. His delivered volume, blood pressure and SpO₂ are all falling.',
      item: {
        id: 'C17',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Scope out, restore his breaths, then examine both sides of the chest',
            rationale:
              'Ventilation comes first. If he does not recover with the scope out, the cause is in the chest, and a pneumothorax is one of them.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Stay in and clear the last of the secretions',
            rationale:
              'The pairing is tight and he is already failing. More time in the tube takes more of his ventilation.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Have the respiratory rate raised to bring the carbon dioxide down',
            rationale:
              'A faster rate through a crowded tube traps gas. It does not explain or treat a falling blood pressure.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Pause with the scope in while you work out the cause',
            rationale:
              'The scope is one of the causes. He recovers faster, and you learn more, with it out.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'In the case this is drawn from, the cause was a tension pneumothorax on the other side. A tight pairing, coughing and trapped gas set it up. When all three numbers fall, come out and examine the chest.',
        objectiveIds: ['M16-O6'],
        outcomeIds: ['read-the-ventilator'],
        claimClass: 'source',
        sourceRefs: LECTURE_CASE,
        reviewItemIds: ['R30'],
      },
    },
    {
      id: 'mc-alarm-limits',
      presentationTitle: 'An alarm on every breath',
      situation:
        'A woman on volume control has a 4.9 mm scope in an 8.0 mm tube. The high-pressure alarm sounds with every breath, and each breath is cut short. Her delivered volume is 240 of a set 420 mL. Plateau pressure is unchanged.',
      item: {
        id: 'mc-alarm-limits',
        itemType: 'management-decision',
        stem: 'What do you ask the therapist for?',
        choices: [
          {
            id: 'a',
            label: 'A higher pressure limit, then a check that the volume returns',
            rationale:
              'The pairing is sound and the plateau has not moved. The limit is ending each breath early, so raising it gives her the volume back.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The alarm silenced, so you can keep clearing in peace',
            rationale:
              'Silencing changes what you hear, not what she gets. Each breath is still cut short.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'A smaller tidal volume, so the pressure stays under the limit',
            rationale:
              'That settles the alarm by giving her less. She is already getting too little.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'A pause, and more sedation to stop her fighting the ventilator',
            rationale:
              'She is not fighting it. The pressure comes from the scope in the tube, and sedation does not widen the tube.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The pressure limit protects the lung, and the plateau tells you the lung is not seeing this pressure. Set the limit with the therapist before you go in. If the volume stays low after that, come out.',
        objectiveIds: ['M16-O2'],
        outcomeIds: ['pair-and-set'],
        claimClass: 'update',
        sourceRefs: VENTILATOR,
        reviewItemIds: ['R31'],
      },
    },
    {
      id: 'mc-both-pressures-rise',
      presentationTitle: 'Both pressures rise',
      situation:
        'A man on volume control is having a lavage through an 8.0 mm tube. With the scope withdrawn to the adapter, peak pressure is 44 cmH₂O and plateau is 36, up from 20. His blood pressure is 84/46.',
      item: {
        id: 'mc-both-pressures-rise',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Scope out, listen to both sides, and get an ultrasound of the chest',
            rationale:
              'A plateau that rises means the lung or the chest has changed. With a low blood pressure, a pneumothorax comes first.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Go on: a high peak pressure is expected with the scope in',
            rationale:
              'The peak alone would be expected. Here the plateau has nearly doubled, and the scope cannot do that.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Have the pressure limit raised and keep suctioning the lavage fluid',
            rationale:
              'A higher limit pushes more gas into a chest that is already tight. This is not the tube’s resistance.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Pause and give a fluid bolus for the blood pressure',
            rationale:
              'Fluid treats the number. The pressure is low because something in the chest is squeezing the heart.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Peak with an unchanged plateau is the tube and the scope. Peak and plateau together are the lung: a pneumothorax, a plugged lobe or a tube that has slipped into one bronchus.',
        objectiveIds: ['M16-O6'],
        outcomeIds: ['read-the-ventilator'],
        claimClass: 'synthesis',
        sourceRefs: MODES,
      },
    },
  ],
}
