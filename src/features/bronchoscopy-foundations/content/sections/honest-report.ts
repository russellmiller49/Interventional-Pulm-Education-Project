import type { AirwayLabel } from '../../components/scope/types'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M17 — Recovery, documentation and diagnostic closure. The report is written from the record of
 * what the procedure observed: a region it did not see is not assessed, not safely accessible or
 * not examined, with the reason, and never a template's normal (A07, A08, A30). The same report
 * carries the handoff, the recovery plan and a named owner for pending results. Knowledge spec §18
 * (S1 PDF 79–80, 130–131, 141; S2 PDF 67–69, 95–117, 161–165; T09, T14, T15). Seed Q11; drills D14
 * and D18. Register R06 (document limitations), R17 (no reimbursement rules), R21 (record the
 * sequence). C10, the capstone case for this mechanism, is not used here.
 */

/** The procedure in the Act, entered through the mouth: every airway inspected except RB1. */
const INSPECTED_AIRWAYS: readonly AirwayLabel[] = [
  'TR',
  'RMSB',
  'RUL',
  'RB2',
  'RB3',
  'BI',
  'RML',
  'RB4',
  'RB5',
  'RLL',
  'RB6',
  'RB7',
  'RB8',
  'RB9',
  'RB10',
  'LMSB',
  'LUL',
  'LUL-UD',
  'LB1+2',
  'LB3',
  'LB4+5',
  'LB4',
  'LB5',
  'LLL',
  'LB6',
  'LB7+8',
  'LB9',
  'LB10',
]

export const section: BronchSectionDefinition = {
  id: 'honest-report',
  title: 'The report and the handoff',
  shortTitle: 'Report and handoff',
  minutes: 9,
  moduleIds: ['M17'],
  objectives: [
    {
      objectiveId: 'M17-O1',
      subtask:
        'Chooses, in the report for a procedure under moderate sedation, the limitations, specimens, recovery plan and results owner the end-of-procedure handoff carries; the spoken handoff itself is observed in supervised practice.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M17-O2',
      subtask:
        'Commits which record, if any, may fill the vocal-fold line after a bronchoscopy through an endotracheal tube, then completes the larynx, right-sided airways, extent and sampling lines from the record of a procedure entered through the mouth.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M17-O3',
      subtask:
        'Chooses a recovery line that follows the institution’s recovery criteria and approved pathway, and refuses discharge by elapsed time or by one oximetry reading.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M17-O4',
      subtask:
        'Chooses a pending-results line that names who reviews the lavage results and how the patient hears them, and refuses “results to follow”.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M17-O5',
      subtask:
        'Decides, in a practice case, how a note records a completed therapeutic aspiration and a survey stopped when oximetry fell, and commits in the transfer how the report records an event that resolved.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D14', 'D18'],
  prerequisites: [
    'clinical-question',
    'larynx-and-entry',
    'systematic-survey',
    'washing-and-lavage',
    'specimen-pathway',
    'deterioration',
    'scope-in-a-tube',
  ],

  clinicalQuestion:
    'At the end of a bronchoscopy, with the report template open, what may each line say, and what must the handoff carry?',
  recognizeTitle: 'A report template after a bronchoscopy',
  objective:
    'Decide, line by line, what a bronchoscopy report may state about the examination, the samples and the patient, and what the handoff must carry.',
  why: 'The report outlives the procedure. The next clinician plans from it: how to read a result, whether another bronchoscopy is needed, and who tells the patient.',
  newConcept:
    'Each line of the report states what this procedure actually observed, did or verified; a region it did not see is written as not assessed, not safely accessible or not examined, with the reason, and never filled in as normal.',
  incrementSentence:
    'This section adds one idea to the inspection record: the report carries the record’s limits into every line, so a template’s default, an earlier report or a now-stable patient never stands in for an observation.',
  harmfulReflex:
    'Signing the template’s pre-filled normal lines for what this procedure did not see, or pushing the scope into an airway it cannot safely enter so that a line can stay normal, to make the report read complete.',
  anchor: {
    analogy:
      'A pilot’s logbook records the flight that was flown, not the flight plan: a diversion is written as it happened, and a leg never flown is written as not flown.',
    precise:
      'Each line of the report is an observation, a verified fact or a stated limitation with its reason. Normal means seen and unremarkable; not assessed, not safely accessible and not examined each say why a region was not seen. A template default, an earlier report or a patient who is now stable is none of these.',
    checklistLabel: 'Before signing each line',
    checklist: [
      'Did this procedure see it, do it or verify it?',
      'If not: not assessed, not safely accessible or not examined, and why?',
      'Are the site, the specimens and the events the actual ones, not the booked ones?',
      'Does a named person own each pending result?',
    ],
  },

  spineStops: ['larynx', 'trachea', 'carina', 'main-bronchi', 'lobar', 'segmental'],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'no-control-change-the-plan',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No control writes the report; the record does. Pushing the scope into an airway it cannot safely enter, so that a line can read normal, is the move to refuse.',
  },
  precommitDenyPatterns: [
    /\bnot assessed\b/i,
    /\bactually observed\b/i,
    /\boutside (the|this) bronchoscope['’]s view\b/i,
    /\bstands? in for an observation\b/i,
  ],
  modelBoundary:
    'The report on this card is built for teaching from one constructed procedure. It is not an institutional template, and the course stores no patient information. Recovery criteria, oral intake after topical anesthetic, activity, escort, medication resumption and the results pathway belong to your institution’s approved policies, none of which is configured here; reimbursement rules are outside this course.',
  localPolicyIds: [
    'recovery_and_followup',
    'sedation_policy',
    'topical_anesthetic_policy',
    'antithrombotic_policy',
    'specimen_directory',
  ],
  reviewItemIds: ['R06', 'R17', 'R21'],

  blocks: [
    {
      id: 'what-a-report-is-for',
      kind: 'question',
      role: 'framing',
      heading: 'What a report is for',
      body: 'When the scope is out, the report and the handoff carry the procedure to the next clinician: what was examined, what was found, what was taken, what happened to the patient and who acts on the results. The report is usually written from a template, with some lines already filled in.\n\nThis section is about what each line may say, and what the handoff must carry.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
      ],
    },
    {
      id: 'what-the-report-rests-on',
      kind: 'signals',
      role: 'signals',
      heading: 'What the report is written from',
      body: 'A report is written after the procedure, from several records. Before writing a line, name which of them it rests on.',
      pointsLabel: 'Records available when the report is written',
      points: [
        'The inspection record: each expected airway and the status the survey gave it',
        'How the scope entered the airway, and any airway device in place',
        'The sedation or anesthesia record, with the cumulative topical anesthetic',
        'The monitor record of physiological events, and the team’s response',
        'The specimens as labeled and sent, with the studies requested',
        'The report template, with lines pre-filled from the booking or a default',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
      ],
    },
    {
      id: 'uncomplicated-report',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'An uncomplicated report',
      body: 'An uncomplicated inspection with lavage, entered through the mouth under moderate sedation, has this report.',
      pointsLabel: 'The report’s lines',
      points: [
        'Larynx: vocal folds normal-appearing, moving symmetrically with breathing',
        'Trachea and main carina: normal-appearing',
        'Right-sided and left-sided airways: normal-appearing to the segmental airways',
        'Sampling: lavage of the lateral segment of the right middle lobe (RB4), sent for the requested studies',
        'Complications: none',
        'Pending results: reviewed by the requesting physician and discussed with the patient at a booked clinic visit',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
      ],
    },
    {
      id: 'four-states',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Four states, not one',
      body: 'A region the procedure did not see well enough to describe is neither normal nor abnormal. The report puts each region in one of four states and, for the last three, says why.\n\nThe inspection record feeds these states: an airway it lists as not observed because the survey never reached it is written in the report as not examined. Anything short of inspection, such as an orifice seen or a segment entered with a smeared lens, is written as what happened, with the reason, and is never rounded up to normal.',
      pointsLabel: 'The four states in the report',
      points: [
        'Normal: seen well enough to describe, and nothing abnormal seen; written as normal-appearing',
        'Not assessed: within the procedure but outside what this examination could see, such as the larynx and the trachea inside the tube when the scope entered through an endotracheal tube',
        'Not safely accessible: seen, but not entered without force, with the reason',
        'Not examined: never reached, because the survey stopped or did not extend that far, with the reason',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
      ],
      reviewItemIds: ['R06'],
    },
    {
      id: 'template-line-by-line',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The template, line by line',
      body: 'In this course’s report template, a line is filled in only from what was observed or verified; a pre-filled line is a default to check, not an entry. Its lines follow the procedure from the clinical question to the follow-up.',
      pointsLabel: 'The template’s lines, grouped',
      points: [
        'Before: indication and clinical question; planned procedure and targets; consent and time-out; preparation, medication and bleeding plan, and airway plan; personnel, supervisor, location and scope',
        'Entry: how the scope entered and any airway device; the sedation or anesthesia record and the cumulative topical anesthetic',
        'Extent and conditions: the larynx, with observed findings or the reason it was not assessed; the trachea and main carina; the right-sided airways; the left-sided airways',
        'Findings: exact location, appearance, extent, obstruction, bleeding and motion',
        'What was done: the actual site and method of each sample or intervention; the specimens and the studies requested; any complication or unanticipated event, and the response',
        'After: limitations, inaccessible airways and the reason for a curtailed examination; outcome and recovery plan; medication resumption and further observation or imaging; pending results, their owner and the communication plan',
      ],
      claimClass: 'design',
      sourceRefs: [{ sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } }],
    },
    {
      id: 'ending-and-handoff',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Ending the procedure and the handoff',
      body: 'Before the procedure ends, the operator confirms that the clinical question has been addressed as far as safely possible, inspects the relevant sites for residual bleeding or other complications, verifies that accessories have been removed and withdraws the scope under control. Every specimen is checked as labeled and sent as intended.\n\nThe handoff then carries what was performed, the limitations, medications and relevant totals, physiological events, the observations required and the studies pending. A curtailed procedure is handed off as what was accomplished and why the rest was not attempted, even when the patient is now stable.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 130, to: 131 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 141 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
      ],
    },
    {
      id: 'recovery-and-results',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Recovery, instructions and results',
      body: 'In recovery the team observes airway patency, breathing, oxygenation, circulation, responsiveness, symptoms and any bleeding, with attention to the patient’s own oxygen needs before the procedure and the risk of recurrent sedation. The patient meets the institution’s recovery criteria; elapsed time alone does not establish recovery. Oral intake after topical anesthetic, medication resumption, escort, driving and activity, and contact instructions follow the approved pathway.\n\nThe patient is told, in words they can use, the expected symptoms and the warning signs that need urgent evaluation: substantial hemoptysis, worsening breathlessness, chest pain or other concerning deterioration. The report and the handoff say how and when results will be communicated and who is responsible, because a specimen sent without a follow-up owner leaves the diagnostic process incomplete. When the results arrive, reviewing them with the procedural findings and any complication shows whether the sampling strategy worked.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 165 } },
      ],
      localPolicyIds: [
        'recovery_and_followup',
        'sedation_policy',
        'topical_anesthetic_policy',
        'antithrombotic_policy',
      ],
    },
    {
      id: 'describe-what-was-done',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Describe what was done',
      body: 'A note should let another clinician understand the procedure without guessing from a label. It states the indication, the actual technique and site, the findings, the response, where each specimen went, any complication and what remains uncertain.\n\nA therapeutic aspiration is described by what it did and what it left: the secretions removed, the lumen reopened, any residual obstruction or limitation, and how the patient tolerated it. It is not recorded as a lavage. Where the order of steps bears on a result, such as secretions cleared before a lavage, the note records the sequence so the result can be read in context. The report records actual clinical care and time; reimbursement rules are outside this course and need their own current source.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T09', location: { kind: 'time-span', start: '00:44:44', end: '00:46:18' } },
        { sourceId: 'T14', location: { kind: 'time-span', start: '00:01:24', end: '00:04:55' } },
        { sourceId: 'T14', location: { kind: 'time-span', start: '00:04:55', end: '00:05:49' } },
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:32:53', end: '00:39:19' } },
      ],
      reviewItemIds: ['R17', 'R21'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these lets the report say more, or less, than the procedure did.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Signing a pre-filled normal larynx after entry through an endotracheal tube: write not assessed, with the reason.',
        'Accepting “normal to the subsegmental level” after a survey to the segmental airways: write the extent reached.',
        'Writing an airway the scope could not enter as normal, or calling it narrowed when no narrowing was seen: write not safely accessible, with the reason, and describe any narrowing or lesion that was seen.',
        'Naming the booked target instead of the airway sampled: name the segment actually lavaged and the samples actually taken.',
        'Rewriting a curtailed examination as complete once the patient is stable: record what was done and why the rest was not.',
        'Ending the report with “results to follow”: name who reviews the results and how the patient hears them.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
      ],
    },
  ],

  workspace: {
    kind: 'map',
    lit: INSPECTED_AIRWAYS,
    caption:
      'The airway map for the procedure in this section’s report: an airway is lit where its inspection record lists it as inspected',
  },

  steps: {
    recognize: {
      instruction:
        'In the Simulator panel, read the airway map for the procedure in this section’s report, lit where its inspection record lists an airway as inspected; in the Teaching panel, read What the report is written from.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.map,
        alsoPane: 'teaching',
        alsoLandmark: 'What the report is written from',
      },
    },
    act: {
      title: 'The report, from the record',
      instruction: `For each of ${STEPS_LANDMARKS.report}, choose the entry this procedure’s record supports; an entry it does not support is refused, with the reason. In the Simulator panel, ${SIMULATOR_LANDMARKS.map} is lit where the inspection record lists an airway as inspected.`,
      lookIn: {
        pane: 'steps',
        landmark: STEPS_LANDMARKS.report,
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.map,
      },
    },
    explain: {
      title: 'What each line may claim',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and “Four states, not one” in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'report',
    report: {
      id: 'report-from-the-record',
      prompt:
        'The elective inspection with lavage under moderate sedation, entered through the mouth: complete its report from the record. For each line, choose the entry the record supports.',
      evidenceTitle: 'What this procedure’s record shows',
      fields: [
        {
          id: 'larynx',
          label: 'Larynx',
          evidence:
            'As the scope reached the larynx the patient began to cough continuously, and the coughing went on as the scope crossed. The vocal folds were seen, looked symmetric and showed no lesion, but their movement with quiet breathing could not be watched.',
          options: [
            {
              id: 'seen-movement-not-assessed',
              label:
                'Vocal folds normal-appearing; movement with breathing not assessed, because of continuous coughing',
              supported: true,
              rationale:
                'It reports what was seen of the folds and names the part of the examination the coughing prevented, with its reason, instead of reading movement from a larynx that was coughing.',
            },
            {
              id: 'moving-symmetrically',
              label: 'Vocal folds normal-appearing, moving symmetrically with breathing',
              supported: false,
              rationale:
                'Movement with breathing was never watched: the coughing lasted through the crossing. This is the uncomplicated report’s line, and here it writes an observation no one made.',
            },
            {
              id: 'larynx-not-assessed',
              label:
                'Larynx not assessed, since the scope crossed it while the patient was coughing',
              supported: false,
              rationale:
                'The folds were seen, and how they looked belongs in the report. Only their movement with breathing went unobserved, so only that part is not assessed.',
            },
          ],
        },
        {
          id: 'right-sided-airways',
          label: 'Right-sided airways',
          evidence:
            'Each right-sided segmental airway was entered and seen clearly except the apical segment of the right upper lobe (RB1). Its orifice was seen from the right upper lobe bronchus; the scope would not advance into it without force, so it was not entered. Nothing abnormal was seen on the right.',
          options: [
            {
              id: 'rb1-not-accessible',
              label:
                'Normal-appearing; RB1 seen at its orifice, would not advance without force: not safely accessible',
              supported: true,
              rationale:
                'It describes what was seen, keeps RB1 apart from the inspected segments, and gives the reason it was not entered.',
            },
            {
              id: 'normal-throughout',
              label:
                'Normal-appearing throughout, including RB1, whose orifice looked normal from its parent bronchus',
              supported: false,
              rationale:
                'A normal-looking orifice is not an inspected segment: RB1 was never entered, and its wall and lumen beyond the orifice were not seen. Writing it into a normal survey claims an inspection that did not happen.',
            },
            {
              id: 'rb1-narrowed',
              label:
                'Normal-appearing, except RB1, narrowed, since the scope could not be advanced into it',
              supported: false,
              rationale:
                'Here the scope would not enter without force, yet nothing abnormal was seen at the orifice: that is a limit on access, not a finding, and “narrowed” invents one.',
            },
          ],
        },
        {
          id: 'extent',
          label: 'Extent of the examination',
          evidence:
            'On both sides the survey reached every segmental orifice and, where the caliber allowed, advanced briefly to the next division. Nothing beyond that was examined. The template’s default for this line reads “normal airways to the subsegmental level”.',
          options: [
            {
              id: 'to-the-segmental-airways',
              label:
                'Segmental airways, and the next division in places; beyond that, not examined',
              supported: true,
              rationale:
                'It tells the reader how far each “normal” reaches, and names what lies beyond as not examined (the inspection record’s not observed) instead of leaving it to be assumed.',
            },
            {
              id: 'template-default',
              label:
                'Normal airways to the subsegmental level on both sides, as the template’s default reads',
              supported: false,
              rationale:
                'The survey reached the segmental orifices and, in places, the next division. The default claims normal airways the scope never reached.',
            },
            {
              id: 'left-blank',
              label:
                'Left blank, since the airway-by-airway lines above already show how far the survey went',
              supported: false,
              rationale:
                'Without an extent, a reader cannot tell how far each “normal” goes and may assume the template’s default. This line is where that limit is stated.',
            },
          ],
        },
        {
          id: 'sampling',
          label: 'Sampling and specimens',
          evidence:
            'The template pre-fills this line from the booking: lavage and brushings of the right middle lobe. The booked lobe was an error: before the procedure the requesting pulmonologist confirmed the lingula, where the CT abnormality lies, as the target, and the time-out checked the side against the consent and recorded the change. With the scope wedged in the superior lingular segment (LB4), a lavage was taken; its instilled and returned volumes were written on the procedure sheet, and it was labeled with that segment and sent with the studies on the request. No brushing was taken.',
          options: [
            {
              id: 'actual-site',
              label:
                'Superior lingular segment (LB4) lavage, instilled and returned volumes stated, sent as requested; no brushing',
              supported: true,
              rationale:
                'It names the segment actually lavaged and the method, carries the instilled and returned volumes from the procedure sheet into the report, and says what was sent and what was not done.',
            },
            {
              id: 'as-booked',
              label:
                'Lavage and brushings of the right middle lobe, sent for the studies the booking lists',
              supported: false,
              rationale:
                'The booking is the plan. The report names the airway actually sampled and the samples actually taken: a lavage of the superior lingular segment, and no brushing.',
            },
            {
              id: 'lung-only',
              label:
                'Lavage of the left lung, sent as requested, with the segment left to the specimen label',
              supported: false,
              rationale:
                'The report names the sampled airway itself. Whoever interprets the result or plans a repeat reads the segment from the report, not from a container label.',
            },
          ],
        },
        {
          id: 'pending-results',
          label: 'Pending results and who acts on them',
          evidence:
            'The lavage results are pending. The requesting pulmonologist has agreed to review them and to discuss them with the patient at a clinic visit already booked.',
          options: [
            {
              id: 'named-owner',
              label:
                'Pending; reviewed by the requesting pulmonologist and discussed at the booked visit',
              supported: true,
              rationale:
                'It names who owns the results and how and when the patient hears them, which closes the diagnostic loop the procedure opened.',
            },
            {
              id: 'to-follow',
              label: 'Results to follow, available in the electronic record once they are reported',
              supported: false,
              rationale:
                'It says a result will exist and names no one to act on it. A specimen without a follow-up owner leaves the diagnostic process incomplete.',
            },
            {
              id: 'abnormal-only',
              label:
                'Copied to the family physician, who will act on any abnormal result when it is reported',
              supported: false,
              rationale:
                'No one agreed to this. A clinician who has not accepted the results is not their owner, and acting only on abnormal results leaves a nondiagnostic one unexamined.',
            },
          ],
        },
        {
          id: 'recovery',
          label: 'Recovery and discharge plan',
          evidence:
            'The patient is in the recovery area after moderate sedation, with oximetry back to its value before the procedure on the same oxygen. The recovery nurse asks what the report’s discharge plan should say.',
          options: [
            {
              id: 'institution-criteria',
              label:
                'Recovery to the institution’s criteria and baseline oxygen needs; instructions per its pathway',
              supported: true,
              rationale:
                'It states the standard recovery is judged against and leaves oral intake, medication, escort, activity and contact instructions to the pathway the institution has approved; the warning signs that need urgent evaluation are still explained to the patient.',
            },
            {
              id: 'fixed-period',
              label:
                'Discharge after a fixed period of observation, provided no new symptoms appear during that time',
              supported: false,
              rationale:
                'Elapsed time alone does not establish recovery. Airway, breathing, oxygenation, circulation, responsiveness and symptoms are observed against the institution’s criteria.',
            },
            {
              id: 'oximetry-only',
              label:
                'Discharge once oximetry is back at its value before the procedure, on the same oxygen',
              supported: false,
              rationale:
                'One reading does not show recovery: oximetry can look settled while breathing or responsiveness has not returned, and recurrent sedation remains a risk.',
            },
          ],
        },
      ],
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 120 } },
      ],
    },
  },

  prediction: {
    id: 'Q11',
    seedId: 'Q11',
    itemType: 'management-decision',
    situation:
      'An elective airway inspection with lavage is performed under general anesthesia. The anesthesia team intubated without difficulty, and the bronchoscope entered through the endotracheal tube to survey the airways beyond its tip. The vocal folds were not in view at any point during the bronchoscopy. The report of the patient’s bronchoscopy last year describes normal vocal folds, and this report’s template opens with its larynx line pre-filled as “Normal vocal folds”.',
    stem: 'How should this report describe the vocal folds?',
    choices: [
      {
        id: 'a',
        label: 'Normal, since the anesthesia team intubated without difficulty',
        rationale:
          'An uneventful intubation shows that the tube went through the glottis; it says nothing about how the folds looked or moved, and what the anesthesia team saw belongs to their record. Writing normal on that basis tells every later reader that this bronchoscopy examined the folds, which it never did.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'By reference to last year’s bronchoscopy report, which describes them',
        rationale:
          'Pointing to last year’s report lets a reader take the folds as examined, and it hides any change since that day. This line says what this procedure saw of the larynx, here nothing, and why.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Not assessed by this examination, which went through the tube',
        rationale:
          'The bronchoscope entered through the tube, so the folds were outside its view. Not assessed records that limitation with its reason, and a reader who needs the larynx knows it has yet to be examined.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Normal vocal folds, as the template’s larynx line already reads',
        rationale:
          'The template’s line is a default written before anyone looked. Signing it records a laryngeal examination this bronchoscopy never made, and a clinician who later needs the larynx would take it as examined and normal.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'A report records what this examination observed. When the scope enters through an endotracheal tube, the larynx lies outside the bronchoscope’s view, so the vocal-fold line reads not assessed, with the entry as the reason. The template’s pre-filled line, an uneventful intubation and last year’s report cannot stand in for an observation this procedure did not make.',
    objectiveIds: ['M17-O2'],
    claimClass: 'source',
    sourceRefs: [{ sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } }],
  },

  transfer: {
    id: 'N10',
    itemType: 'management-decision',
    situation:
      'An elective airway inspection is performed through the mouth under moderate sedation. As topical anesthetic is applied to the larynx, the patient coughs repeatedly and oximetry falls from the patient’s own starting value. The operator pauses above the larynx while the team supports the patient’s breathing; the coughing settles, oximetry returns to its starting value, and the patient stays responsive. After reassessing, the supervising bronchoscopist completes the survey without further events. The report template’s line for complications and unanticipated events is pre-filled with “None”.',
    stem: 'What should the line for complications and unanticipated events say?',
    choices: [
      {
        id: 'a',
        label: 'None, since oximetry came back to its starting value and the survey was completed',
        rationale:
          'A resolved event is still an event. Writing none erases what the recovery team and the next sedation plan need to know: that oximetry fell at the larynx and needed a pause and support.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Coughing and a fall in oximetry at the larynx, the pause, and the recovery',
        rationale:
          'It records what happened, what was done and how it ended, which is what the handoff and any later procedure plan are built on. It states the event without claiming a cause no one established.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label:
          'Laryngospasm, written as the cause of the fall in oximetry during topical anesthesia',
        rationale:
          'The fall began during topical anesthesia at the larynx, but its cause was not established. The report records what was observed and done; a diagnosis such as laryngospasm is written only if it was made, and then as an interpretation.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Left to the nursing sedation record, where physiological events belong',
        rationale:
          'The report’s line for complications and unanticipated events, and the handoff, carry physiological events. Leaving the event to another record makes the procedure report read as uneventful to anyone who reads it alone.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'An event that resolved is still an event. The report records what happened, what was done and how it ended, because the recovery team and anyone planning the next procedure read it. A cause is written only as an interpretation, and the template’s “None” is a default, not an observation.',
    objectiveIds: ['M17-O2', 'M17-O5'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
    ],
    transferVariant:
      'A different line and a different kind of fact: under moderate sedation through the mouth, an event at the larynx that happened and resolved, where the template’s default of none, not a structure the scope could not see, is what the report must not keep.',
  },

  practice: [
    {
      id: 'mc-curtailed-note',
      presentationTitle: 'A draft note after a bronchoscopy in a ventilated patient',
      situation:
        'In the intensive care unit, a ventilated patient has a bronchoscopy through the existing endotracheal tube for suspected mucus plugging; the chest radiograph before the procedure showed a collapsed left lower lobe. The trachea below the tube and the right-sided airways are inspected first. Thick secretions blocking the left lower lobe bronchus are aspirated, and its lumen opens. As the survey continues toward the left upper lobe, oximetry falls from its earlier value and does not recover with the scope in the airway, so the supervising bronchoscopist stops and the scope is withdrawn; oximetry then returns to its earlier value. The survey ended before the left upper lobe and its upper and lingular divisions; the aspirated secretions in the suction trap are the only material collected. Later, with the patient stable, the fellow opens the draft note, pre-filled from the booking: “Complete airway examination, normal to the subsegmental level. Bronchoalveolar lavage performed.”',
      item: {
        id: 'mc-curtailed-note',
        itemType: 'management-decision',
        stem: 'How should the note be completed?',
        choices: [
          {
            id: 'a',
            label:
              'Complete and normal as drafted, since the plug is cleared and the patient is stable',
            rationale:
              'The patient’s stability now does not change what was examined. The left upper lobe and its divisions were never reached; signing a complete, normal survey writes up airways the scope never reached.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label:
              'The aspiration and its effect, the stop and its reason, airways not examined, no lavage',
            rationale:
              'It records what was accomplished and why the rest was not attempted: the plug removed and the lumen reopened, the fall in oximetry that ended the procedure, the airways left for another look, and that no lavage was taken.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label:
              'Stopped early, with the aspirated secretions recorded as a lavage from that lobe',
            rationale:
              'A therapeutic aspiration is not a lavage. A reader looking for a lavage result, or interpreting one, would be misled about what was collected and from where.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label:
              'Stopped early, with the unreached airways normal, as the radiograph showed only the collapse',
            rationale:
              'A radiograph before the procedure cannot stand in for mucosa no one saw. Writing the unreached airways as normal tells the next team no second look is needed; they are not examined, and the note says so with the reason.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'A curtailed procedure is documented as what was accomplished and why the rest was not attempted; a patient who is stable now does not make an incomplete examination complete. The note describes the therapeutic aspiration by what it did, records the fall in oximetry that ended the procedure, states that no lavage was collected and lists the airways not examined, so the next team knows what still needs a look. Because the scope entered through the existing tube, the note also records the larynx and the tube-covered trachea as not assessed, and the reassessment once the scope was withdrawn.',
        objectiveIds: ['M17-O5', 'M17-O2'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 79, to: 80 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
          { sourceId: 'T14', location: { kind: 'time-span', start: '00:04:55', end: '00:05:49' } },
          { sourceId: 'T09', location: { kind: 'time-span', start: '00:44:44', end: '00:46:18' } },
        ],
      },
    },
  ],
}
