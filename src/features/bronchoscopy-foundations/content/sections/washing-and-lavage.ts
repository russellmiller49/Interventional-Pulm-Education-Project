import { num } from '../numbers'
import type { BronchSectionDefinition, MonitorReading, MonitorTrend } from '../types'

/**
 * Washings and BAL (rewrite, brief 11; absorbs `poor-return`). The fellow learns the three saline
 * procedures, to choose the lavage site from the CT, the wedge, the aliquots, the suction and the
 * return with their guideline numbers, what a poor return means, how the fluid is processed and
 * why lavage comes before biopsy. They put a BAL in order, then run one: three aliquots whose
 * return they work out, with a poor return to troubleshoot.
 *
 * Every number is a register row (ATS 2012 for the lavage, IDSA/ATS 2016 for the culture
 * threshold). The volumes in the case are the case's own. Sources: the course textbook's chapter
 * on sampling (S1), the ATS guideline on BAL (U6) and the IDSA/ATS guideline on HAP and VAP (U7).
 */
const TECHNIQUE = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 121 } },
  { sourceId: 'U6', location: { kind: 'section', label: 'BAL technique and return' } },
] as const
const NAMES = [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 120 } }] as const
const SUCTION = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 90, to: 93 } },
  { sourceId: 'U6', location: { kind: 'section', label: 'BAL technique and return' } },
] as const
const CULTURE = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 121 } },
  { sourceId: 'U7', location: { kind: 'section', label: 'Section II recommendation' } },
  { sourceId: 'U6', location: { kind: 'section', label: 'BAL technique and return' } },
] as const

/** The monitor at one moment of the case. Values are written for this case. */
function vitals(
  view: string,
  spo2: readonly [string, MonitorTrend, string],
  heartRate: readonly [string, MonitorTrend],
): readonly MonitorReading[] {
  return [
    { channel: 'airway-view', words: view, trend: 'new' },
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
  ]
}

export const section: BronchSectionDefinition = {
  id: 'washing-and-lavage',
  authoringContract: 2,
  title: 'Washings and BAL',
  shortTitle: 'Washings and BAL',
  minutes: 12,
  activityMinutes: 4.5,
  moduleIds: ['M12'],
  objectives: [
    {
      objectiveId: 'M12-O1',
      subtask: 'Names a saline sample by how it was taken, whatever the label says.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M12-O2',
      subtask: 'Chooses the lavage segment from the CT.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M12-O3',
      subtask: 'Puts the steps of a BAL in order, from the site to the record.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M12-O4',
      subtask: 'Works out the return of a lavage from the volumes in and out, and records it.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M12-O5',
      subtask: 'Finds the cause of a poor return: leak, collapse, the circuit or the lung.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M12-O6',
      subtask: 'Clears secretions that threaten the airway before a planned lavage.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D11', 'D20'],
  prerequisites: [
    'clinical-question',
    'sedation-and-monitoring',
    'five-controls',
    'right-side',
    'left-side',
    'systematic-survey',
    'describe-findings',
  ],

  clinicalQuestion:
    'You are asked for a BAL. Where do you lavage, how much, and how do you know the sample is good?',
  objective: 'Choose the site, run the lavage in order, and judge it by what comes back.',
  harmfulReflex:
    'Instilling the next aliquot, or turning the suction up, when the last aliquot did not come back.',
  harmfulReflexPatterns: [/\binstil/i, /\bsuction up\b/i, /\bmore saline\b/i],
  anchor: {
    analogy:
      'Rinsing a jar to see what was in it: you seal it, pour in a measured amount and pour it back out. If the lid leaks, or nothing comes out, you have learned nothing.',
    precise:
      'The worth of a lavage is set by the site you chose, the wedge you made and the volumes you counted in and out.',
    checklistLabel: 'Running a BAL',
    checklist: [
      'Site from the CT',
      'A gentle wedge',
      'Measured aliquots in, gentle suction out',
      'Count what comes back',
    ],
  },
  outcomes: [
    {
      id: 'run-a-bal',
      text: 'Choose the site from the CT and run a BAL in order.',
    },
    {
      id: 'judge-the-return',
      text: 'Work out the return, find the cause of a poor one, and know when to stop.',
    },
  ],

  spineStops: ['trachea', 'segmental'],
  grammarRowIds: ['poor-return-leak', 'poor-return-collapse', 'no-return-patent-view'],
  precommitDenyPatterns: [/\bno wedge\b/i, /\bsamples the airway\b/i],
  localPolicyIds: ['bal_protocol'],
  reviewItemIds: ['R21', 'R22', 'R24', 'R25', 'R42'],

  blocks: [
    {
      id: 'three-procedures',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Three procedures that use saline',
      body: 'The name follows the method, not the label on the trap.',
      pointsLabel: 'What each one is',
      points: [
        'Washing: saline into a large airway and back, with no wedge. It samples the airway.',
        'BAL: measured saline through a scope wedged in one segment. It samples the alveoli.',
        'Therapeutic aspiration: clearing secretions or a plug. The aim is an open airway.',
      ],
      claimClass: 'source',
      sourceRefs: NAMES,
    },
    {
      id: 'site-from-ct',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Choose the site from the CT',
      body: 'Lavage the segment where the CT shows the disease. In diffuse disease, take the most affected segment you can wedge.\n\nDo not go to the middle lobe or the lingula by habit. They return well, and that is no use if the disease is elsewhere.',
      claimClass: 'source',
      sourceRefs: TECHNIQUE,
    },
    {
      id: 'wedge-and-aliquots',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'The wedge, the saline and the suction',
      body: `Seat the tip gently in the segment until it seals. A wedge is a seal, not an impaction.\n\nInstil ${num('bal-total-volume')} of sterile saline in ${num('bal-aliquots')} aliquots. Suction each one back at ${num('bal-suction-ceiling')}, and lower if the airway collapses.`,
      media: { kind: 'endoscopic-still', structureId: 'rb4', outline: true },
      claimClass: 'source',
      sourceRefs: TECHNIQUE,
      localPolicyIds: ['bal_protocol'],
      reviewItemIds: ['R22'],
    },
    {
      id: 'the-return',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Count what comes back',
      body: `Return is the volume recovered as a share of the volume instilled. ${num('bal-return-optimal')} is optimal. ${num('bal-return-minimum')} is the least that is useful.\n\nCount every aliquot, in and out, and say the numbers aloud for the record.`,
      claimClass: 'source',
      sourceRefs: TECHNIQUE,
      reviewItemIds: ['R22'],
    },
    {
      id: 'poor-return-causes',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'When little comes back',
      body: 'More saline and more suction are the two reflexes. Neither finds the cause. Look first.',
      pointsLabel: 'The cause, then the fix',
      points: [
        'Leak: saline wells back around the scope. Reseat a gentle wedge. Do not push harder.',
        'Collapse: the lumen closes when you suction. Ease the suction.',
        'Circuit: an open lumen and an empty trap. Check the valve, the trap, the tubing and the vacuum.',
        'The lung: emphysema or a dependent segment returns little. Record a limited sample.',
      ],
      claimClass: 'source',
      sourceRefs: SUCTION,
      reviewItemIds: ['R24'],
    },
    {
      id: 'when-to-stop',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'When to stop',
      body: `Stop the lavage if ${num('bal-abort-rule')} comes back. The saline is staying in the lung.\n\nStop too if the patient coughs hard, desaturates or becomes distressed. The planned volume is not a target. Record what went in, what came back and why you stopped.`,
      claimClass: 'source',
      sourceRefs: TECHNIQUE,
      reviewItemIds: ['R22', 'R24'],
    },
    {
      id: 'processing',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Where the fluid goes',
      body: `Pool the aliquots and send them promptly: cell count and differential, microbiology and cytology, as the question needs.`,
      pointsLabel: 'Three numbers for the laboratory',
      points: [
        `Cell analysis wants ${num('bal-cell-analysis-volume')} pooled, and ${num('bal-cell-analysis-minimum')} at the very least.`,
        `Epithelial cells ${num('bal-epithelial-flag')} mean the sample is from the airway, not the alveoli.`,
        `In suspected ventilator-associated pneumonia, the diagnostic threshold for a quantitative BAL culture is ${num('vap-bal-threshold')}.`,
      ],
      claimClass: 'source',
      sourceRefs: CULTURE,
      reviewItemIds: ['R25'],
    },
    {
      id: 'before-biopsy',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Lavage before biopsy',
      body: 'Lavage before you biopsy or brush the same lobe. Blood from a biopsy changes the cell count.\n\nOn the way in, keep suction off where you can. If secretions block the airway, clear them: the patient comes before the specimen.',
      claimClass: 'source',
      sourceRefs: TECHNIQUE,
      reviewItemIds: ['R21'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Five errors to expect',
      body: 'Each one puts the plan ahead of what the airway and the trap are showing.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Calling any saline through the channel a BAL. No wedge means a washing.',
        'Going to the middle lobe by habit. Choose the segment from the CT.',
        'Pushing the tip in for a tighter wedge. Reseat it gently.',
        'Turning the suction up for a poor return. Ease it, and watch the lumen open.',
        'Recording the planned volumes. Record what went in and what came back.',
      ],
      claimClass: 'source',
      sourceRefs: SUCTION,
      reviewItemIds: ['R22', 'R42'],
    },
  ],

  workspace: {
    kind: 'map',
    lit: ['RML', 'RB4'],
    caption: 'The airway map, with the segment lavaged in this section’s case lit.',
  },

  act: {
    kind: 'sequence',
    outcomeId: 'run-a-bal',
    sequence: {
      id: 'planned-lavage',
      prompt: 'Seven steps of a BAL. Put them in order.',
      steps: [
        {
          id: 'choose-site',
          label: 'Choose the segment from the CT',
          detail: 'Where the disease is, not where the return is easiest.',
        },
        {
          id: 'wedge',
          label: 'Wedge the tip gently in that segment',
          detail: 'A seal comes before any saline, or the fluid runs back around the scope.',
        },
        {
          id: 'instill',
          label: 'Instil one measured aliquot of sterile saline',
          detail: 'One aliquot at a time, so each can be judged.',
        },
        {
          id: 'recover',
          label: 'Suction it back gently into the trap',
          detail: `Keep the suction ${num('bal-suction-ceiling')}, and lower if the lumen closes.`,
        },
        {
          id: 'check-return',
          label: 'Check what came back, the airway and the patient',
          detail: 'This check decides whether another aliquot goes in.',
        },
        {
          id: 'next-or-stop',
          label: 'Give the next aliquot, or stop',
          detail: 'The decision follows the check. It does not follow the plan.',
        },
        {
          id: 'record',
          label: 'Record the site and every volume in and out',
          detail: 'The laboratory and the next reader need the return, not the intention.',
        },
      ],
      rationale:
        'The site is chosen before the wedge, and the wedge is made before the saline. Each aliquot is recovered and checked before the next one is given.',
      criticalStepIds: ['check-return', 'next-or-stop'],
      sourceRefs: TECHNIQUE,
    },
  },

  moreActs: {
    bal: {
      kind: 'scenario',
      outcomeId: 'judge-the-return',
      scenario: {
        id: 'three-aliquots',
        title: 'Three aliquots and what came back',
        boundary: 'A teaching case. The volumes and vital signs are written for it.',
        frames: [
          {
            id: 'first-aliquot',
            time: 'First aliquot',
            situation:
              'A 62-year-old man has ground-glass change on CT, worst in the right middle lobe. Under moderate sedation you wedge in RB4. The plan is three aliquots of 50 mL. The first 50 mL goes in, and 14 mL comes back. The lumen stays open.',
            readings: vitals(
              'Wedged in RB4, lumen open',
              ['96', 'steady', 'On 2 L/min nasal oxygen'],
              ['88', 'steady'],
            ),
            prompt: 'How much returned, and what do you do?',
            choices: [
              {
                id: 'a',
                label: 'Over a quarter came back. Give the second aliquot',
                rationale: `The return is close to the optimal figure, ${num('bal-return-optimal')}, and well over the least useful, ${num('bal-return-minimum')}. Carry on.`,
                plausibility: 'best',
              },
              {
                id: 'b',
                label: 'Under a tenth came back. End the lavage here',
                rationale:
                  'Work it out again: the volume back over the volume in is more than a quarter.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'You withdraw with one aliquot done. The laboratory receives a small sample from a lavage that was going well.',
                  readings: vitals(
                    'Scope withdrawn',
                    ['96', 'steady', 'Unchanged'],
                    ['88', 'steady'],
                  ),
                },
              },
              {
                id: 'c',
                label: 'Turn the suction up to get the rest of it back',
                rationale:
                  'You never get it all back. Harder suction closes the airway, and the return falls.',
                plausibility: 'unsafe',
                consequence: {
                  situation:
                    'The walls beyond the tip are drawn together and nothing more comes. The mucosa is now red where it was sucked in.',
                  readings: vitals(
                    'Lumen closed by suction',
                    ['95', 'steady', 'Unchanged'],
                    ['92', 'rising'],
                  ),
                },
              },
              {
                id: 'd',
                label: 'Push the tip further in for a tighter seal',
                rationale:
                  'The seal is holding. Pushing in impacts the tip, injures the mucosa and adds blood to the sample.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'The tip is now jammed in a smaller airway. A streak of blood appears in the trap.',
                  readings: vitals(
                    'Tip impacted, blood-streaked return',
                    ['95', 'steady', 'Unchanged'],
                    ['94', 'rising'],
                  ),
                },
              },
            ],
          },
          {
            id: 'second-aliquot',
            time: 'Second aliquot',
            situation:
              'The second 50 mL goes in. As you suction, the walls beyond the tip come together, and 6 mL reaches the trap. The seal looks good, and no saline wells back.',
            readings: vitals(
              'Lumen closes with each pull of suction',
              ['95', 'steady', 'On 2 L/min nasal oxygen'],
              ['90', 'steady'],
            ),
            prompt: 'What is the cause, and what do you do?',
            choices: [
              {
                id: 'a',
                label: 'The wedge is leaking. Push the scope further in',
                rationale:
                  'A leak shows as saline welling back around the scope. Here the seal holds and the lumen closes.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'The tip impacts. The lumen still closes on suction, and the return is now blood-tinged.',
                  readings: vitals('Tip impacted', ['95', 'steady', 'Unchanged'], ['96', 'rising']),
                },
              },
              {
                id: 'b',
                label: 'The airway is collapsing. Ease the suction and try again',
                rationale:
                  'Walls that come together under suction are being sucked shut. Less suction lets the lumen stay open and the fluid drain.',
                plausibility: 'best',
              },
              {
                id: 'c',
                label: 'Instil the third aliquot now to wash the rest out',
                rationale:
                  'The fluid already in is not coming back. More saline adds to what stays in the lung.',
                plausibility: 'unsafe',
                consequence: {
                  situation:
                    'A third 50 mL goes in on top of the second. The lumen still closes on suction, and he begins to cough.',
                  readings: vitals(
                    'Lumen closing, fluid at the tip',
                    ['91', 'falling', 'Falling'],
                    ['104', 'rising'],
                  ),
                },
              },
              {
                id: 'd',
                label: 'The return is under the least useful figure. End the lavage',
                rationale: `It is over the least useful figure, ${num('bal-return-minimum')}, and the cause is one you can fix.`,
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'You withdraw. Most of the second aliquot is still in the segment, and the sample is smaller than it needed to be.',
                  readings: vitals(
                    'Scope withdrawn',
                    ['95', 'steady', 'Unchanged'],
                    ['90', 'steady'],
                  ),
                },
              },
            ],
          },
          {
            id: 'third-aliquot',
            time: 'Third aliquot',
            situation:
              'With gentler suction the lumen stays open and another 16 mL returns. You give the third 50 mL. Only 1 mL comes back. The lumen is open, the seal holds, and the trap and tubing are working. He is coughing hard.',
            readings: vitals(
              'Lumen open, nothing draining',
              ['90', 'falling', 'Falling, on 2 L/min'],
              ['108', 'rising'],
            ),
            prompt: 'What do you do?',
            choices: [
              {
                id: 'a',
                label: 'Pause a minute, then instil a fourth aliquot to make up the return',
                rationale: `${num('bal-abort-rule')} came back from this one, and he is desaturating. Another aliquot adds fluid to a lung that is keeping it.`,
                plausibility: 'unsafe',
                consequence: {
                  situation:
                    'The fourth aliquot stays in as well. He coughs continuously and his saturation keeps falling.',
                  readings: vitals(
                    'Fluid welling at the tip',
                    ['86', 'falling', 'Falling'],
                    ['118', 'rising'],
                  ),
                },
              },
              {
                id: 'b',
                label: 'Give more sedation so that he settles, then carry on',
                rationale:
                  'The cough and the falling saturation are the reason to end the lavage. Sedation hides them and slows his breathing.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'He stops coughing. His breathing is shallower and his saturation is lower.',
                  readings: vitals('Lumen open', ['87', 'falling', 'Falling'], ['102', 'steady']),
                },
              },
              {
                id: 'c',
                label: 'End the lavage, come off the wedge and give oxygen',
                rationale: `${num('bal-abort-rule')} returned from this aliquot, and the patient is telling you the same thing. You have a sample already.`,
                plausibility: 'best',
              },
              {
                id: 'd',
                label: 'Hold the wedge and keep suctioning until the saline comes',
                rationale:
                  'Nothing is draining through an open lumen. Longer suction takes air from the segment, not saline.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'No fluid comes. The segment beyond the tip collapses, and his saturation falls further.',
                  readings: vitals(
                    'Segment collapsed',
                    ['88', 'falling', 'Falling'],
                    ['112', 'rising'],
                  ),
                },
              },
            ],
          },
          {
            id: 'the-record',
            time: 'After the scope is out',
            situation:
              'On oxygen he recovers. Three aliquots of 50 mL went in. The trap holds 14 mL, then 6 mL and 16 mL, then 1 mL.',
            readings: vitals(
              'Scope withdrawn',
              ['95', 'rising', 'Recovering on 4 L/min'],
              ['94', 'steady'],
            ),
            prompt: 'What goes on the record?',
            choices: [
              {
                id: 'a',
                label: 'Three aliquots given, with a good return',
                rationale:
                  'It gives no volumes and hides that the lavage was ended. The reader cannot judge the sample.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'The laboratory reports a low cell yield. Nobody reading the note can tell why.',
                  readings: vitals(
                    'Scope withdrawn',
                    ['96', 'steady', 'Recovered'],
                    ['90', 'steady'],
                  ),
                },
              },
              {
                id: 'b',
                label: 'About half the saline returned; lavage completed as planned',
                rationale:
                  'Add the trap volumes and divide by all the saline given. It is about a quarter, and the lavage was ended early.',
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'The cell count is read as if from a full lavage. The fluid still in his lung is not mentioned at handover.',
                  readings: vitals(
                    'Scope withdrawn',
                    ['96', 'steady', 'Recovered'],
                    ['90', 'steady'],
                  ),
                },
              },
              {
                id: 'c',
                label: 'RB4; volumes in and out; a quarter returned; ended for cough',
                rationale: `A quarter is under the optimal ${num('bal-return-optimal')} and well over the least useful. The pooled volume is enough for cell analysis.`,
                plausibility: 'best',
              },
              {
                id: 'd',
                label: 'Sample inadequate; discarded',
                rationale: `The pooled return is more than cell analysis needs, ${num('bal-cell-analysis-volume')}. Send it, with the volumes.`,
                plausibility: 'incorrect-mechanism',
                consequence: {
                  situation:
                    'A usable sample is thrown away, and the question that prompted the lavage is not answered.',
                  readings: vitals(
                    'Scope withdrawn',
                    ['96', 'steady', 'Recovered'],
                    ['90', 'steady'],
                  ),
                },
              },
            ],
          },
        ],
        sourceRefs: [...TECHNIQUE, ...SUCTION],
      },
    },
  },

  prediction: {
    id: 'Q06',
    seedId: 'Q06',
    itemType: 'management-decision',
    situation:
      'A colleague squirts saline into the trachea of an intubated patient and suctions it back into a trap. The trap is labeled “BAL” and the form asks for a cell differential and culture.',
    stem: 'What do you do before it leaves the room?',
    choices: [
      {
        id: 'a',
        label: 'Send it as it is labeled',
        rationale:
          'The laboratory will report a cell differential as if the fluid came from alveoli. It came from the trachea.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Change the label to bronchial washing',
        rationale:
          'It was taken from a large airway without a wedge. The label has to say what the sample is.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Keep the label and add the site, trachea',
        rationale:
          'A BAL from the trachea does not exist. Adding the site leaves a false name on the trap.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Discard it and suction the trachea dry',
        rationale:
          'A washing is a useful sample for culture and cytology. It only needs its right name.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Saline put into a large airway with no wedge samples the airway, not the alveoli. That is a bronchial washing. A BAL is wedged in a segment. The name follows the method.',
    objectiveIds: ['M12-O1'],
    outcomeIds: ['run-a-bal'],
    claimClass: 'source',
    sourceRefs: NAMES,
  },

  transfer: {
    id: 'Q22',
    seedId: 'Q22',
    itemType: 'management-decision',
    situation:
      'A BAL of the right lower lobe is planned for a woman with pneumonia. As you pass the carina, thick secretions fill the right main bronchus. Her breathing is more labored and her SpO₂ has fallen from 95% to 90%.',
    stem: 'What do you do?',
    choices: [
      {
        id: 'a',
        label: 'Leave the secretions, to keep the lavage uncontaminated',
        rationale:
          'The secretions are obstructing a main bronchus now. A clean specimen is worth less than her airway.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Suction the secretions clear, then lavage and record the order',
        rationale:
          'The airway comes first. A lavage after suction is still a lavage, and the record says what was done before it.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Abandon the lavage as spoiled once you have suctioned',
        rationale:
          'Suction beforehand does not make every lavage useless. Record it and let the reader weigh the result.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Pause, then wedge past the secretions and lavage first',
        rationale:
          'She is desaturating from a blocked bronchus. Saline beyond it makes that worse.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Keeping suction off on the way in protects the specimen. Clearing secretions that block the airway protects the patient, and she comes first. Clear them, then lavage, and record the order.',
    objectiveIds: ['M12-O6'],
    outcomeIds: ['run-a-bal'],
    claimClass: 'source',
    sourceRefs: SUCTION,
    reviewItemIds: ['R21'],
    transferVariant:
      'Secretions in the way of a planned lavage, where the prediction was a sample already taken and wrongly named.',
  },

  practice: [
    {
      id: 'mc-lavage-site-selection',
      presentationTitle: 'Where the CT says to go',
      situation:
        'A febrile man on chemotherapy has a new consolidation on CT. It lies in the right upper lobe, against the back of the chest wall. The rest of both lungs is clear.',
      item: {
        id: 'mc-lavage-site-selection',
        itemType: 'management-decision',
        stem: 'Where do you lavage?',
        choices: [
          {
            id: 'a',
            label: 'RB2',
            rationale:
              'RB2 is the posterior segment of the right upper lobe. It is the upper lobe segment that lies against the back of the chest.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'RB1',
            rationale:
              'RB1 is the apical segment. It runs up to the apex, not back to the chest wall.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'RB3',
            rationale:
              'RB3 is the anterior segment. It lies at the front of the upper lobe, away from this lesion.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'RB6',
            rationale:
              'RB6 also lies at the back, but it is the superior segment of the lower lobe, below the fissure.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        choiceAirways: { a: 'RB2', b: 'RB1', c: 'RB3', d: 'RB6' },
        explanation:
          'Lavage the segment where the CT shows the disease, and name it from where it lies. An easier wedge or a better return elsewhere samples healthy lung.',
        objectiveIds: ['M12-O2'],
        outcomeIds: ['run-a-bal'],
        claimClass: 'source',
        sourceRefs: TECHNIQUE,
      },
    },
    {
      id: 'mc-low-return-after-checks',
      presentationTitle: 'A low return with nothing to fix',
      situation:
        'A man with severe emphysema is having a BAL. The wedge seals, the lumen stays open and the circuit works. A fifth of each aliquot comes back. He is comfortable and his saturation is steady.',
      item: {
        id: 'mc-low-return-after-checks',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Finish the planned aliquots and record the return as low',
            rationale: `A fifth is over the least useful figure, ${num('bal-return-minimum')}. Emphysema returns little, and he is tolerating it.`,
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'End the lavage, as the return is too low to use',
            rationale: `The abort rule is ${num('bal-abort-rule')}. A fifth is well over that.`,
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Instil extra aliquots until the return reaches the optimal figure',
            rationale:
              'His lung will keep most of each one. Extra saline adds retained fluid, not return.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Turn the suction up to recover more of each aliquot',
            rationale:
              'In emphysema the airways collapse easily. More suction closes them and the return falls.',
            plausibility: 'unsafe',
          },
        ],
        explanation: `With the wedge, the lumen and the circuit all checked, a low return is the lung’s. Between ${num('bal-return-minimum')} and the optimal figure the sample is usable. Record the volumes.`,
        objectiveIds: ['M12-O5', 'M12-O4'],
        outcomeIds: ['judge-the-return'],
        claimClass: 'source',
        sourceRefs: TECHNIQUE,
        reviewItemIds: ['R24'],
      },
    },
    {
      id: 'mc-lavage-before-biopsy',
      presentationTitle: 'Two samples from one lobe',
      situation:
        'A woman with diffuse lung disease needs a BAL and transbronchial biopsies. Both are planned in the right lower lobe.',
      item: {
        id: 'mc-lavage-before-biopsy',
        itemType: 'management-decision',
        stem: 'In which order do you take them?',
        choices: [
          {
            id: 'a',
            label: 'Biopsies first, while she is most settled',
            rationale:
              'Blood from the biopsies then mixes with the lavage and alters its cell count.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label: 'The lavage first, then the biopsies',
            rationale: 'The lavage is taken from a lobe that has not bled yet.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label: 'Either order, with a saline flush between them',
            rationale:
              'A flush after a biopsy does not clear blood from the alveoli the lavage samples.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Biopsies first, then lavage the other lung',
            rationale:
              'The lavage should come from the lobe the CT shows. Moving it to suit the order samples a lobe the CT did not show.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Lavage before you biopsy or brush the same lobe. Blood changes the cell count and the differential.',
        objectiveIds: ['M12-O3'],
        outcomeIds: ['run-a-bal'],
        claimClass: 'source',
        sourceRefs: TECHNIQUE,
      },
    },
  ],
}
