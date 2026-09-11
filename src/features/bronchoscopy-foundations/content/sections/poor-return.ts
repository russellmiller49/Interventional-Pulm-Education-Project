import type { SourceRef } from '../../data/sources'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M12, second half — Poor return. When a lavage returns little fluid, the learner reads the finding
 * as a differential (a leak around the seal, collapse under suction, the suction path, position
 * or disease) and lets the airway and the patient outrank the planned volume. Knowledge spec §13.8,
 * §13.9, drill D20 and case C15 (T13 00:11:58–00:15:33; T06 00:01:45; T13 00:09:31–00:10:19 and
 * T15 00:32:53–00:39:19; T13 00:10:19–00:14:42; S1 PDF 90–93, 118–120, 154–158; U6). Register R21,
 * R22 and R24: no universal volume or return threshold, necessary clearance before a protected
 * sample, and no scripted adjunct to reach a return target.
 */

/** §13.8 — the poor-return differential. */
const T13_POOR_RETURN: SourceRef = {
  sourceId: 'T13',
  location: { kind: 'time-span', start: '00:11:58', end: '00:15:33' },
}
const T06_POOR_RETURN: SourceRef = {
  sourceId: 'T06',
  location: { kind: 'time-span', start: '00:01:45' },
}
/** §13.7 — the three-part lavage-quality model. */
const T13_LAVAGE_QUALITY: SourceRef = {
  sourceId: 'T13',
  location: { kind: 'time-span', start: '00:08:45', end: '00:15:33' },
}
/** §13.7 — the lecturer's volumes, retained as a technique description only (R22). */
const T13_LECTURE_VOLUMES: SourceRef = {
  sourceId: 'T13',
  location: { kind: 'time-span', start: '00:10:19', end: '00:13:47' },
}
/** §13.9 — patient protection before a protected specimen (R21). */
const T13_CLEARANCE: SourceRef = {
  sourceId: 'T13',
  location: { kind: 'time-span', start: '00:09:31', end: '00:10:19' },
}
const T15_CLEARANCE: SourceRef = {
  sourceId: 'T15',
  location: { kind: 'time-span', start: '00:32:53', end: '00:39:19' },
}
/** C15 — poor return is not a command to add more saline. */
const T13_C15: SourceRef = {
  sourceId: 'T13',
  location: { kind: 'time-span', start: '00:10:19', end: '00:14:42' },
}
/** §13.1 — suction is a controlled maneuver. */
const S1_SUCTION: SourceRef = { sourceId: 'S1', location: { kind: 'pdf-pages', from: 90, to: 93 } }
const S1_GAS_EXCHANGE: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 154, to: 158 },
}
/** §2.1, §16.2 — oximetry reports oxygenation, not ventilation; what is assessed when it falls. */
const S1_OXYGENATION: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 77, to: 79 },
}
/** §13.2 — washing and lavage differ; the name reflects what was done; source-described ranges. */
const S1_SAMPLE_NAMES: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 118, to: 120 },
}
/** §13.4 — lavage technique: a gentle wedge, over-wedging, excessive suction. */
const S1_LAVAGE_TECHNIQUE: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 119, to: 120 },
}
const U6_LAVAGE: SourceRef = {
  sourceId: 'U6',
  location: { kind: 'section', label: 'BAL technique and return qualifications' },
}

export const section: BronchSectionDefinition = {
  id: 'poor-return',
  title: 'When the lavage does not come back',
  shortTitle: 'Poor return',
  minutes: 8,
  moduleIds: ['M12'],
  objectives: [
    {
      objectiveId: 'M12-O5',
      subtask:
        'Commits, in the prediction, to the response when the lumen closes under suction, and in practice to what follows when low return persists after the seal, the lumen and the suction path are checked; rehearses, frame by frame in a scripted lavage, the response to a leak around the tip, collapse under suction, no return through a patent airway and a change in tolerance.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M12-O6',
      subtask:
        'Commits, in the transfer, to clearing secretions that impair breathing before a planned microbiologic lavage and recording the sequence; stops instilling short of the planned volume when tolerance worsens; records an interrupted lavage as it happened, in practice.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D11', 'D20'],
  prerequisites: ['shared-airway', 'five-controls', 'washing-and-lavage'],

  clinicalQuestion: 'During a lavage that is returning little fluid, what should happen next?',
  recognizeTitle: 'Low return during a supervised lavage',
  objective:
    'Tell apart the reasons lavage fluid does not return — at or around the tip, beyond it, in the suction path or in the lung itself — and choose the response each one calls for.',
  why: 'Low return changes what the specimen can show, and it happens in an airway the patient is breathing through. What is done next at the scope decides both the sample and how the patient tolerates the rest of the procedure.',
  newConcept:
    'What the airway and the patient show sets the next move at the scope; a collection goal, such as the planned volume or return, does not.',
  incrementSentence:
    'This section adds one idea to the lavage technique of the last section: when return falls, what is seen around the tip, beyond it, in the suction path and in the patient decides the next move, not the planned volume or return.',
  harmfulReflex:
    'Making up low return with more saline or stronger suction without finding the cause, or pressing on toward the planned volume after the patient’s tolerance has worsened.',
  anchor: {
    analogy:
      'A slow drain is diagnosed, not flooded: before pouring in more or pumping harder, you look for the gap around the seal, the pipe that has closed and the blocked trap.',
    precise:
      'Poor return has a differential: a leak around an unstable seal, collapse of the distal airway under suction, a fault in the suction path, and over-wedging, where repeated impaction can injure the mucosa, add blood and reduce return. Each is read from what the view and the suction path show; disease or a dependent segment is concluded only when return stays low after those are checked. The patient’s tolerance is checked first and outranks the planned volume.',
    checklistLabel: 'When return is low',
    checklist: [
      'The patient first, against their own earlier state',
      'Around the tip: saline escaping past the seal',
      'At and beyond the tip: its depth, and a lumen closing under suction',
      'The suction path, before any more saline',
    ],
  },

  spineStops: ['segmental'],
  grammarRowIds: ['poor-return-leak', 'poor-return-collapse', 'no-return-patent-view'],
  controlStrip: {
    verdict: 'this-control',
    states: {
      insertion: 'not-this-one',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'Suction is the control here, and the move is to release it: that removes what is closing the airway, and more suction is the harmful reflex. Insertion and withdrawal, and distal deflection, do not reopen a lumen that closes under suction; they matter again when the tip position is reassessed. Saline volume is not one of the five controls.',
  },
  precommitDenyPatterns: [
    /\brelease (the )?suction\b/i,
    /\breduc\w* (the )?suction\b/i,
    /\bsuction[- ]related collapse\b/i,
    /\bcollection goals?\b/i,
    /\bexcessive suction\b/i,
    /\bvulnerable distal airway\b/i,
  ],
  modelBoundary:
    'The monitor and the scenario frames are scripted in words for teaching. Nothing on this page models fluid or suction: it teaches the reasoning, and it cannot measure a seal, a suction pressure or a volume recovered. No value here is a volume, return or tolerance threshold for your patient.',
  physicalSkillNote:
    'Settling a gentle seal and controlling suction during recovery are hand skills. This section teaches how to read low return and choose the response; the seal and the suction must be observed by faculty in a model task or a supervised procedure.',
  localPolicyIds: ['bal_protocol'],
  reviewItemIds: ['R21', 'R22', 'R24'],

  blocks: [
    {
      id: 'little-comes-back',
      kind: 'question',
      role: 'framing',
      heading: 'When little comes back',
      body: 'A lavage instills sterile saline through a scope wedged in a chosen segment and recovers it for the laboratory. Sometimes much less returns than was instilled.\n\nThis section is about that moment: what the team can see, and what should decide the next move.',
      claimClass: 'synthesis',
      sourceRefs: [S1_SAMPLE_NAMES, T13_LAVAGE_QUALITY],
    },
    {
      id: 'where-to-look',
      kind: 'signals',
      role: 'signals',
      heading: 'Where to look when return falls',
      body: 'Each of these can be seen at the scope or at the bedside. Compare each with this patient’s own earlier state in the procedure.',
      pointsLabel: 'What the team can check',
      points: [
        'The view at the opening of the segment as saline goes in',
        'What the lumen beyond the tip does during instillation and during recovery',
        'How much fluid arrives in the trap with each aliquot',
        'How deep the tip sits, and in which segment',
        'The patient: responsiveness and comfort, cough, effort, airflow, oximetry and capnography where it is used',
        'The running record of saline instilled and fluid recovered',
      ],
      claimClass: 'synthesis',
      sourceRefs: [T13_POOR_RETURN, T06_POOR_RETURN, T13_C15, S1_OXYGENATION, S1_LAVAGE_TECHNIQUE],
    },
    {
      id: 'going-to-plan',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A lavage going to plan',
      body: 'In a lavage going to plan, the scope holds a gentle seal in the chosen segment without being forced. Saline instilled through the working channel stays beyond the tip, the lumen in view stays open while it is recovered, and fluid is seen arriving in the trap with each aliquot. Lavage can change gas exchange for a time, so between aliquots the patient is compared with their own starting state before the next one goes in.',
      claimClass: 'synthesis',
      sourceRefs: [S1_LAVAGE_TECHNIQUE, T13_LAVAGE_QUALITY],
    },
    {
      id: 'two-more-causes',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Two more causes of low return',
      body: 'Three causes of low return are rows of the diagnostic table, shown under Reading the view in this panel: saline escaping around the tip, a lumen that closes under suction, and no return through a patent airway, which leads back to the suction path checked before use: channel, valve, trap, tubing and vacuum source. Two more complete the differential. Neither is answered by more saline or more suction.',
      pointsLabel: 'The observation, then the supervised response',
      points: [
        'Blood appears after repeated impaction: possible mucosal injury or another source of bleeding. Stop further traumatic manipulation, and reassess the sample and the patient.',
        'Return stays low despite careful technique: disease, a dependent segment or another sampling limitation. Reassess the value and safety of further lavage, and record a limited attempt.',
      ],
      claimClass: 'transcript-source',
      sourceRefs: [T13_POOR_RETURN, T06_POOR_RETURN, S1_LAVAGE_TECHNIQUE],
    },
    {
      id: 'patient-first',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'The patient outranks the planned volume',
      body: 'Suction and lavage act in the airway the patient is breathing through. Suction removes gas as well as fluid and can reduce lung volume, and both can worsen gas exchange. A change in the patient’s tolerance — coughing, restlessness, harder breathing, a falling oximetry trend — is assessed before anything more is instilled, whatever the planned volume.\n\nA lavage that is stopped early or returns little is described with the volumes actually instilled and recovered and its limitations, rather than hidden.',
      claimClass: 'synthesis',
      sourceRefs: [S1_SUCTION, S1_GAS_EXCHANGE, T13_C15, T13_CLEARANCE, T15_CLEARANCE],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors makes up a shortfall instead of explaining it.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Turning the suction up because little is returning: find the cause first; stronger suction can deepen a collapse and draw mucosa onto the tip.',
        'Instilling more saline to make up for low return before its cause is found: the planned volume is a collection goal, and tolerance and the cause of poor return come first.',
        'Forcing the scope deeper to stop a leak: realign, and advance only gently until the segment seals; over-wedging can injure the mucosa, add blood and reduce return.',
        'Adding fluid when nothing returns through an open airway: the suction path is checked first, as its row under Reading the view lists.',
        'Recording the planned volumes as if the lavage went to plan: record the volumes actually instilled and recovered, the interruption and the limitation.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_LAVAGE_TECHNIQUE, S1_SUCTION, T13_POOR_RETURN, T13_C15],
    },
    {
      id: 'protocol',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'What your lavage protocol decides',
      body: 'Even a good seal does not bring back all of the saline. The aim is a representative collection from the isolated segment, not complete recovery.\n\nThe total volume, the size of each aliquot, how saline is recovered and what return the laboratory needs come from the institution’s approved lavage protocol for the indication. Textbook ranges and a lecturer’s preferences describe technique, and a guideline’s recovery figure describes an optimal collection for the indication it was written for; none is a universal adequacy rule, and this course calculates none of them for a patient.\n\nThe lecture mentions positional changes and external chest compression as occasional measures. They are not taught here as automatic novice responses to low return, particularly in unstable or mechanically ventilated patients, and any locally taught adjunct needs separate faculty approval.',
      claimClass: 'local-policy',
      sourceRefs: [
        T13_LAVAGE_QUALITY,
        T13_LECTURE_VOLUMES,
        T13_POOR_RETURN,
        S1_SAMPLE_NAMES,
        U6_LAVAGE,
      ],
      localPolicyIds: ['bal_protocol'],
      reviewItemIds: ['R22', 'R24'],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption:
      'The patient during a supervised lavage of the right middle lobe under moderate sedation, with return into the trap falling with each aliquot — scripted for teaching',
    readings: [
      {
        channel: 'airway-view',
        words:
          'Wedged in the lateral segment of the right middle lobe; the lumen beyond the tip closes each time suction is applied',
        trend: 'new',
      },
      { channel: 'responsiveness', words: 'Settled and comfortable', trend: 'steady' },
      {
        channel: 'respiratory-effort',
        words: 'Unchanged from before the lavage',
        trend: 'steady',
      },
      { channel: 'airflow', words: 'Felt at the mouth and nose, as before', trend: 'steady' },
      { channel: 'oximetry', words: 'At the patient’s own starting value', trend: 'steady' },
    ],
  },

  steps: {
    recognize: {
      instruction:
        'Read the monitor in the Simulator panel: what the airway view shows at the wedged segment, and what each of the patient’s signals is doing.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.monitor },
    },
    act: {
      title: 'One lavage, frame by frame',
      instruction:
        'For each frame, read the monitor in the Simulator panel, then choose the next move in the decision on this card. Only the move that fits the frame moves the lavage on; a move that would harm the patient is refused and named as unsafe.',
      lookIn: {
        pane: 'steps',
        landmark: STEPS_LANDMARKS.decision,
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.monitor,
      },
    },
    explain: {
      title: 'Reading low return',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and ${TEACHING_LANDMARKS.grammar} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scenario',
    scenario: {
      id: 'lingular-lavage',
      title: 'A lingular lavage that returns little',
      boundary:
        'Each frame is scripted in words to teach one decision; the readings are not a physiological or fluid model.',
      frames: [
        {
          id: 'leak',
          situation:
            'A supervised lavage under moderate sedation, with the scope wedged in the superior lingular bronchus (LB4). As the first aliquot is instilled, saline wells back around the scope into the airway above the segment, and little reaches the trap on recovery.',
          readings: [
            {
              channel: 'airway-view',
              words: 'Saline pooling around the scope at the opening of the segment',
              trend: 'new',
            },
            {
              channel: 'respiratory-effort',
              words: 'Unchanged from before the lavage',
              trend: 'steady',
            },
            { channel: 'oximetry', words: 'At the patient’s own starting value', trend: 'steady' },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label: 'Reassess the alignment and settle a gentle seal before the next aliquot',
              rationale:
                'Saline escaping around the tip means the segment is not isolated. Realigning and settling a gentle seal addresses that cause without forcing the tip, so the next aliquot samples the intended distal unit.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Advance the scope firmly until the saline stops escaping around it',
              rationale:
                'Forcing the tip deeper over-wedges the segment. Impaction can injure the mucosa, add blood and reduce return; an effective seal is gentle, not maximal impaction.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Check the trap and tubing, since little is reaching the trap on recovery',
              rationale:
                'Little reaches the trap because the saline is escaping around the scope into the airway above the segment, as the view shows. The fluid is being lost at the seal, not in the suction path.',
              plausibility: 'incorrect-mechanism',
            },
            {
              id: 'd',
              label:
                'Continue with the next aliquot, since some saline is still reaching the segment',
              rationale:
                'Saline escaping around the tip means the segment is not isolated: the next aliquot also wells back into the airway above it, which the patient is breathing through, and lavage fluid there can change gas exchange. What returns may not represent the intended distal unit, so the seal is settled before any more saline goes in.',
              plausibility: 'unsafe',
            },
          ],
        },
        {
          id: 'collapse',
          situation:
            'The seal has been settled, and no saline escapes around the scope. On recovery, the lumen beyond the tip closes each time suction is applied, and only a little fluid reaches the trap. The patient is unchanged.',
          readings: [
            {
              channel: 'airway-view',
              words:
                'The lumen beyond the tip closes when suction is applied; no leak around the scope',
              trend: 'new',
            },
            {
              channel: 'respiratory-effort',
              words: 'Unchanged from before the lavage',
              trend: 'steady',
            },
            { channel: 'oximetry', words: 'At the patient’s own starting value', trend: 'steady' },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label: 'Release the suction and reassess the depth of the tip before recovering',
              rationale:
                'The lumen closes with suction while the seal holds, so suction is the likeliest cause, whether it is excessive or the distal airway is vulnerable. Releasing it removes that cause; the depth of the tip and the method are then reassessed before the next recovery.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Hold the suction on for longer so the closed airway can empty into the trap',
              rationale:
                'Sustained suction keeps the airway closed and can draw mucosa onto the tip. It also removes gas along with fluid, and can reduce lung volume and worsen gas exchange.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Instill the next aliquot and recover it with the suction unchanged',
              rationale:
                'The lumen closes whenever suction is applied, so with the suction unchanged the next recovery is likely to meet the same collapse. The added saline goes into a segment that is not returning it, and lavage can change gas exchange for a time.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label: 'Withdraw to the lobar bronchus and recover the returning saline from there',
              rationale:
                'Withdrawing gives up the seal. Fluid recovered from a proximal airway is no longer a sample of the isolated segment, and the collapse has not been explained.',
              plausibility: 'incorrect-mechanism',
            },
          ],
        },
        {
          id: 'no-return',
          situation:
            'With the suction released and the depth reassessed, the next recovery is made with controlled suction: the lumen beyond the tip stays open and the seal holds, but no fluid at all arrives in the trap. The patient is unchanged.',
          readings: [
            {
              channel: 'airway-view',
              words: 'An open lumen beyond the tip; the seal is holding',
              trend: 'steady',
            },
            { channel: 'oximetry', words: 'At the patient’s own starting value', trend: 'steady' },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label: 'Check the channel, valve, trap, tubing and vacuum source first',
              rationale:
                'Nothing returns through an open lumen with a holding seal, so the airway is not what has changed. The fault is most likely in the suction path, which is checked before any more saline goes in.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Instill the next aliquot, since the airway is open and the seal is holding',
              rationale:
                'No return through an open, sealed airway suggests a fault in the suction path. More saline before the path is checked adds fluid that cannot yet be recovered.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Advance the scope deeper to find an airway that returns fluid more readily',
              rationale:
                'Going deeper in a segment that is already sealed is over-wedging: impaction can injure the mucosa, add blood and reduce return, and it leaves a fault in the suction path unfound.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label: 'Record the segment as limited by disease and end the lavage there',
              rationale:
                'Low return from disease or a dependent segment is a conclusion reached after the seal, the lumen and the suction path have been checked. Here the path has not been checked, so a fault in the suction path would be recorded as a limit of the lung.',
              plausibility: 'incorrect-mechanism',
            },
          ],
        },
        {
          id: 'tolerance',
          situation:
            'The tubing had come loose at the trap; once it is reconnected, return improves. Short of the protocol’s planned volume, the patient begins to cough repeatedly and becomes restless. Breathing is faster and more effortful, and oximetry is falling from its starting value.',
          readings: [
            { channel: 'responsiveness', words: 'Restless, coughing repeatedly', trend: 'new' },
            {
              channel: 'respiratory-effort',
              words: 'Faster and more effortful than before the lavage',
              trend: 'rising',
            },
            {
              channel: 'oximetry',
              words: 'Falling from the patient’s own starting value',
              trend: 'falling',
            },
            {
              channel: 'airway-view',
              words: 'The seal holds; the lumen beyond the tip is open',
              trend: 'steady',
            },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label: 'Stop instilling, tell the team and assess breathing and sedation',
              rationale:
                'Coughing, restlessness, harder breathing and falling oximetry are a change in this patient’s tolerance. The airway, effort, oxygen delivery and sedation state are assessed before anything more is instilled; whether the lavage continues is decided afterwards, with the supervisor.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label: 'Instill the remaining aliquots quickly so that the planned volume is reached',
              rationale:
                'The planned volume is a collection goal, not a threshold the patient must meet. More saline, given quickly to a patient whose breathing is already worsening, adds to the change in gas exchange that lavage can cause.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label: 'Continue, because lavage is expected to lower oxygenation for a time',
              rationale:
                'Lavage can affect gas exchange, but falling oximetry with coughing, restlessness and harder breathing is a change in this patient’s tolerance. An expected effect is still assessed before anything more is instilled, and continuing adds to the change already under way.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label:
                'Give a further sedative dose to settle the coughing, then continue toward the planned volume',
              rationale:
                'Coughing and restlessness with harder breathing and falling oximetry are a change to assess, not to sedate: hypoxemia is one possible cause, and more sedative adds its own effect on breathing to a problem nobody has explained. The team is told and the patient assessed before anything more is instilled.',
              plausibility: 'unsafe',
            },
          ],
        },
      ],
      sourceRefs: [
        T13_POOR_RETURN,
        T13_C15,
        T15_CLEARANCE,
        S1_SUCTION,
        S1_LAVAGE_TECHNIQUE,
        S1_GAS_EXCHANGE,
        S1_OXYGENATION,
      ],
    },
  },

  prediction: {
    id: 'Q07',
    seedId: 'Q07',
    itemType: 'management-decision',
    situation:
      'During a supervised lavage under moderate sedation, the scope is wedged in the lateral segmental bronchus of the right middle lobe (RB4). Return into the trap has fallen with each aliquot. Each time suction is applied to recover the saline, the lumen beyond the tip closes down. No saline is seen escaping around the scope. The patient is settled, and effort, airflow and oximetry are unchanged from before the lavage.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label: 'Increase the suction so the saline is drawn back into the trap more forcefully',
        rationale:
          'Stronger suction pulls harder on an airway that is already closing under suction. It can deepen the collapse and draw mucosa onto the tip, and it does nothing to explain why return is low.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Instill further aliquots until the return reaches what the protocol aims for',
        rationale:
          'This puts a number ahead of technique and tolerance. More saline does not reopen an airway that closes under suction; what is not recovered stays in the lung, and lavage can change gas exchange for a time. The return the protocol aims for is a collection goal, not a threshold the patient must reach.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Release the suction, then reassess the tip position and recovery technique',
        rationale:
          'The lumen closes each time suction is applied and nothing escapes around the tip, so suction is the likeliest cause, whether it is excessive or the distal airway is vulnerable. Releasing it removes that cause; the depth and method are then checked under supervision before recovering again.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Check the trap, tubing and vacuum source before the next recovery',
        rationale:
          'A lumen that closes each time suction is applied shows that suction is reaching the tip, so the suction path is carrying suction rather than failing to carry it. Checking it first delays releasing the suction, which removes the likeliest cause, and the next recovery is likely to meet the same collapse.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A lumen that closes each time suction is applied, with no leak around the tip, suggests suction-related collapse: excessive suction, or suction acting on a vulnerable distal airway, closes the passage the saline must return through. Releasing or reducing the suction removes that cause, and the tip position and method are then reassessed with the supervisor. Stronger suction can deepen the collapse, more saline does not reopen the airway, and a lumen that closes under suction shows the suction path is carrying suction to the tip.',
    objectiveIds: ['M12-O3', 'M12-O5'],
    claimClass: 'source',
    sourceRefs: [S1_SUCTION, S1_LAVAGE_TECHNIQUE, S1_GAS_EXCHANGE, T13_POOR_RETURN],
  },

  transfer: {
    id: 'Q22',
    seedId: 'Q22',
    itemType: 'management-decision',
    situation:
      'A patient under moderate sedation is having a bronchoscopy for a suspected pneumonia, with a lavage of the right lower lobe planned for microbiology. On reaching the lower trachea, thick secretions are pooled there and in the right main bronchus and hide the way ahead. The patient is coughing and breathing harder than before, and oximetry has begun to fall from its starting value.',
    stem: 'What should happen first?',
    choices: [
      {
        id: 'a',
        label:
          'Leave the secretions until the lavage is collected, to keep the specimen uncontaminated',
        rationale:
          'Avoiding unnecessary proximal suction before a contamination-sensitive sample is right only when it is safe. Secretions that hide the way ahead and impair breathing come first; a cleaner specimen does not outrank ventilation.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Clear the secretions now, then record the sequence and the specimen’s limitations',
        rationale:
          'Necessary airway clearance takes priority. Recording that central suction came before the lavage lets whoever reads the result weigh possible contamination, and the team then reassesses whether and how to sample.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Cancel the lavage after clearing, since the specimen would now be contaminated',
        rationale:
          'Prior suction is a relevant collection detail, not proof that every later lavage is useless. The team reassesses whether a diagnostic sample is still worth obtaining, and records the sequence.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label:
          'Clear the secretions, then send the lavage as a clean specimen without noting the suction',
        rationale:
          'Clearing first is right, but prior central suction is a relevant collection detail. Calling the lavage clean does not make it free of contamination; whoever reads the culture needs the sequence and the limitation to weigh the result.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Avoiding unnecessary proximal suction protects the specimen; clearing secretions that obstruct the airway and impair breathing protects the patient, and the patient comes first. Once the airway is safe, the team reassesses whether and how to sample, and the record states that central suction preceded the lavage so the result is read with that limitation.',
    objectiveIds: ['M12-O6'],
    claimClass: 'review-flag',
    sourceRefs: [T13_CLEARANCE, T15_CLEARANCE, S1_SAMPLE_NAMES],
    reviewItemIds: ['R21'],
    transferVariant:
      'Before the lavage instead of during it, in another lobe, with the patient’s breathing now affected: here the collection goal (a specimen free of proximal contamination) argues against suction, where in the prediction the goal (more return) argued for more of it; in both, what the airway and the patient show sets the suction.',
    retrievesFrom: 'shared-airway',
  },

  practice: [
    {
      id: 'C15',
      manifestCaseId: 'C15',
      presentationTitle: 'A lavage exercise stopped short of its example volume',
      situation:
        'In a supervised lavage simulation, return was low and the distal airway collapsed during suction. The learner was approaching the exercise’s example collection volume when the scripted patient’s tolerance worsened, and the lavage was stopped. The patient has since settled. The trap holds a small volume, and the exercise’s progress indicator still shows the collection as incomplete.',
      item: {
        id: 'C15',
        itemType: 'management-decision',
        stem: 'What should happen with the record and the specimen?',
        choices: [
          {
            id: 'a',
            label:
              'Record the actual volumes and the interruption, and ask the supervisor whether it is enough',
            rationale:
              'The record gives the volumes actually instilled and returned and why the lavage stopped. Whether the specimen answers the clinical question is decided with the supervisor, not settled by the indicator.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Resume instilling in the same segment until the progress indicator shows the collection complete',
            rationale:
              'The lavage was stopped because tolerance worsened, and the indicator tracks a collection goal, not a patient-care objective. Resuming to complete it lets the indicator decide how much more saline a patient who has just deteriorated receives; whether to collect more is decided with the supervisor once the patient has been assessed.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Record the example volume as instilled, since that was the volume the exercise planned',
            rationale:
              'A record that shows the planned volume hides what actually happened. Whoever interprets the result needs the real volumes and the interruption to judge the specimen.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label:
              'Discard the specimen, since a lavage short of its example volume cannot be interpreted',
            rationale:
              'An interrupted, low-volume lavage is described, not discarded. Its limitations are communicated, and the supervisor decides whether the information available meets the clinical need.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The exercise’s example volume was an optimal collection goal, not a mandatory threshold. The record states the actual instilled and returned volumes and the interruption, and the supervisor decides whether what was collected meets the clinical need.',
        objectiveIds: ['M12-O6', 'M12-O4'],
        claimClass: 'synthesis',
        sourceRefs: [T13_C15, U6_LAVAGE],
      },
    },
    {
      id: 'mc-low-return-after-checks',
      presentationTitle: 'Low return that persists after adjustment',
      situation:
        'During a supervised lavage in a patient with known obstructive lung disease, return has stayed low through several aliquots. The seal is gentle and holding, no saline escapes around the tip, the lumen beyond the tip stays open during recovery, and the suction path has been checked and is working. The patient’s effort and oximetry are unchanged from the start.',
      item: {
        id: 'mc-low-return-after-checks',
        itemType: 'management-decision',
        stem: 'What should happen next?',
        choices: [
          {
            id: 'a',
            label:
              'Weigh the value and safety of further lavage, and record the attempt as limited',
            rationale:
              'With the seal, the lumen and the suction path checked, persistent low return suggests a sampling limitation. Whether more lavage is worth its risk is decided with the supervisor, and the record states a limited attempt.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Record the lavage as adequate, since the seal, the lumen and the suction path are working',
            rationale:
              'Checked technique rules out a fixable cause; it does not establish that the specimen is adequate. The record states the volumes actually instilled and recovered and that the attempt was limited, so whoever interprets the result can weigh it.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label:
              'Keep instilling aliquots until the return reaches the amount the protocol aims for',
            rationale:
              'Return is low with a working seal, an open lumen and a working suction path, so more saline does not change the cause. What is not returned stays in the lung, where lavage can change gas exchange for a time; the protocol’s return is a goal for the collection, not a threshold the patient must meet.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Turn the patient so the segment drains better, then keep instilling aliquots',
            rationale:
              'The lecture mentions positional change as an occasional measure, but it is not an automatic novice response to low return, and any locally taught adjunct needs faculty approval. It also skips the decision that matters here: whether more lavage is worth its risk.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'With the seal, the lumen and the suction path checked, persistent low return suggests a sampling limitation such as the disease or a dependent segment. The response is to weigh the value and safety of further lavage with the supervisor and record a limited attempt: more saline does not change the cause, and working technique does not establish that the specimen is adequate.',
        objectiveIds: ['M12-O5'],
        claimClass: 'transcript-source',
        sourceRefs: [T13_POOR_RETURN, T06_POOR_RETURN, S1_LAVAGE_TECHNIQUE],
        reviewItemIds: ['R24'],
      },
    },
  ],
}
