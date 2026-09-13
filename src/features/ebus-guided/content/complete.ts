import type { Lesson } from './types'
import { question as q, matching, sequence } from './authoring'
export const completeLessons: Lesson[] = [
  {
    id: 'difficult-acquisition',
    title: 'Troubleshoot a difficult acquisition',
    topic: 'Complete',
    minutes: 7,
    objective: 'Choose the acquisition problem to correct before escalating needle attempts.',
    recall: 'Contact, depth, gain, vascular assessment, and tip visibility are separate checks.',
    concept: 'Identify the failure before changing the technique',
    paragraphs: [
      'When the image deteriorates, return to a sequence of questions: Is the airway position understood? Is the transducer coupled? Is the target framed and the image usable? Is the path acceptable? Is the needle tip visible? Change the factor that explains the observed failure.',
      'An unstable window, vascular interposition, or repeated nonrepresentative specimens may require a new approach or a different target. Repeatedly performing the same poorly visualized pass does not create diagnostic assurance.',
      'Patient tolerance is part of the decision. Pause acquisition for worsening oxygenation, ventilation, hemodynamics, or other safety concerns and coordinate with the responsible team.',
    ],
    checklist: [
      'Describe what failed.',
      'Correct the relevant acquisition condition.',
      'Reassess safety and whether the question remains answerable.',
    ],
    worked: {
      context:
        'Tissue echoes disappear when the scope slips away from the wall. Increasing gain produces a brighter but uninformative sector.',
      reasoning:
        'The pattern fits loss of coupling. Re-establish a stable window before further optimization or sampling.',
    },
    question: q(
      'difficulty-predict',
      'The scope view is stable and tissue echoes are present, but the target’s far border is outside the sector. What should be adjusted first?',
      ['The depth field', 'The acquisition problem is framing, rather than absent contact.'],
      ['The specimen container', 'Handling does not change the displayed field.'],
      [
        'The needle force',
        'Force does not restore missing image context and should not substitute for it.',
      ],
    ),
    matching: matching(
      'Match each observed problem to the check it calls for.',
      [
        ['Tissue echoes disappear with loss of wall contact', 'Re-establish coupling'],
        ['Far border is outside the sector', 'Adjust image depth'],
        ['Needle shaft visible but tip lost', 'Stop movement and recover tip visualization'],
        ['Repeated blood-only samples', 'Reassess targeting, path, and acquisition with the team'],
      ],
      'Troubleshooting starts with the observed failure. Repetition is useful only after the cause is addressed.',
    ),
    observation: q(
      'difficulty-observe',
      'What is the purpose of separating these failure patterns?',
      [
        'To select a problem-specific correction',
        'The same control or maneuver cannot solve every acquisition failure.',
      ],
      [
        'To allow sampling before the image is restored',
        'Safe imaging conditions still need to be established.',
      ],
      [
        'To guarantee the next pass will be diagnostic',
        'Even a corrected approach has diagnostic limits.',
      ],
    ),
    transfer: q(
      'difficulty-transfer',
      'A target remains behind an interposed vessel after several attempts to improve the window. What is the next step?',
      [
        'Reassess whether another target or route can answer the clinical question',
        'An inaccessible target needs an explicit plan and documentation.',
      ],
      [
        'Puncture through the vessel as a routine workaround',
        'Routine transvascular puncture is not a safe default in this course.',
      ],
      [
        'Record the station as negative because it could not be sampled',
        'Failure to obtain tissue is not a negative tissue result.',
      ],
      true,
    ),
    diagram: 'ultrasound',
    takeaways: [
      'Match the correction to the failure.',
      'Document an inaccessible target and the next plan.',
    ],
    sources: ['ics2023', 'ers2026'],
    boundary:
      'Troubleshooting examples omit patient physiology and do not simulate rescue treatment or advanced sampling techniques.',
  },
  {
    id: 'complications-recovery',
    title: 'Recognize complications and plan recovery',
    topic: 'Complete',
    minutes: 7,
    objective:
      'Identify deterioration that requires stopping acquisition and prompt team assessment.',
    recall: 'A tissue target never takes priority over a deteriorating patient.',
    concept: 'Continue observing after the needle pass',
    paragraphs: [
      'Monitor oxygenation, ventilation, hemodynamics, airway patency, and bleeding throughout the procedure. Worsening hypoxemia, significant bleeding, instability, or suspected injury should prompt cessation of sampling and coordinated assessment and support.',
      'Complications can also present later. Persistent or worsening dyspnea, chest pain, fever, substantial hemoptysis, or other concerning symptoms after EBUS require timely clinical evaluation. Infection, including mediastinal infection, is uncommon but important.',
      'Recovery and discharge depend on the patient, sedation or anesthesia, the procedure, and the local protocol. Communicate findings, complications, pending results, and specific return precautions, including whom to contact and when to seek urgent care.',
    ],
    checklist: [
      'Stop acquisition for deterioration.',
      'Call the team and assess airway, breathing, and circulation.',
      'Provide a recovery and escalation plan.',
    ],
    worked: {
      context:
        'Oxygenation worsens during sampling and does not promptly return to the preceding condition.',
      reasoning:
        'Pause sampling, notify the team, and assess ventilation, oxygenation, and airway status. Continuing to obtain more tissue can delay needed support.',
    },
    question: q(
      'recovery-predict',
      'During a pass, substantial airway bleeding obscures the view. Which priority is appropriate?',
      [
        'Stop sampling and initiate the team’s airway and bleeding response',
        'Patient stabilization and assessment precede further tissue acquisition.',
      ],
      [
        'Finish the planned passes before addressing the bleeding',
        'This delays management of an evolving airway threat.',
      ],
      [
        'Increase image gain to improve the bronchoscopic view',
        'Ultrasound gain does not clear blood from the airway.',
      ],
      true,
    ),
    sequence: sequence(
      'Order the broad response priorities to procedural deterioration.',
      [
        'Stop the ongoing acquisition and alert the team',
        'Assess and support airway, breathing, and circulation using the local response protocol',
        'Reassess stability and the need to terminate or change the procedure',
        'Document the event and communicate a monitored recovery and follow-up plan',
      ],
      'Assessment and support occur together as needed. This sequence states priorities, not a drug or rescue-device algorithm.',
    ),
    observation: q(
      'recovery-observe',
      'Which outcome can the response checklist itself establish?',
      [
        'The response priorities are identified',
        'Choosing a plan in the course does not produce a physiological recovery.',
      ],
      ['That hypoxemia has resolved', 'Resolution requires real clinical observations.'],
      [
        'That delayed complications are excluded',
        'Recovery assessment cannot exclude every later complication.',
      ],
    ),
    transfer: q(
      'recovery-transfer',
      'A patient reports fever and worsening chest discomfort after discharge following EBUS. What should the discharge plan support?',
      [
        'Prompt clinical assessment for a possible complication',
        'The timing and symptoms warrant evaluation rather than automatic reassurance.',
      ],
      [
        'Reassurance that symptoms are always expected after EBUS',
        'That assumption can delay recognition of infection or another complication.',
      ],
      [
        'Waiting for the pathology report before assessing symptoms',
        'Pending pathology does not defer evaluation of deterioration.',
      ],
      true,
    ),
    diagram: 'workflow',
    takeaways: [
      'Stop acquisition when patient safety requires it.',
      'Recovery includes escalation instructions and result follow-up.',
    ],
    sources: ['ics2023'],
    boundary:
      'This lesson is not an emergency treatment algorithm. Medication, hemostasis, airway rescue, monitoring, and discharge decisions follow current local protocols and responsible clinicians.',
  },
  {
    id: 'results-reporting',
    title: 'Interpret the result and close the loop',
    topic: 'Complete',
    minutes: 8,
    objective:
      'Distinguish negative representative sampling from an uninformative or incomplete examination.',
    recall:
      'The report must preserve station identity, acquisition quality, and the question the examination was intended to answer.',
    concept: 'A result has a sampling context',
    paragraphs: [
      '“No malignant cells identified” must be interpreted with specimen representativeness, examined and sampled stations, pretest probability, and the remaining clinical question. Blood-only or otherwise nonrepresentative material is not equivalent to a representative negative node. An unexamined station has no tissue result.',
      'After a negative systematic endosonographic staging examination, the 2026 ERS/ESGE/ESTS guideline no longer recommends routine add-on mediastinoscopy. This statement does not turn inadequate or incomplete sampling into a reliable negative examination. Discuss discordant findings, unassessed targets, and further diagnostic needs with the multidisciplinary team.',
      'Report the indication, relevant imaging, airway and ultrasound findings, stations examined and sampled, specimen handling and adequacy information, complications, and the follow-up plan. Identify who will reconcile final pathology and pending studies with the patient and referring team.',
    ],
    checklist: [
      'State what was examined and what was sampled.',
      'Separate pathology wording from examination limitations.',
      'Assign responsibility for results and the next decision.',
    ],
    worked: {
      context:
        'A PET-avid 4L target was not sampled because no acceptable window was obtained; station 7 contained representative lymphoid material without malignancy.',
      reasoning:
        'Report the negative station 7 result and the unsampled 4L target separately. Calling the entire mediastinum negative would overstate the examination.',
    },
    question: q(
      'result-predict',
      'A station aspirate contains blood without representative lymphoid or diagnostic lesional material. Which interpretation is most defensible?',
      [
        'Potentially nonrepresentative sampling',
        'Absence of malignant cells in uninformative material does not exclude disease in the target.',
      ],
      [
        'The station is definitively free of malignancy',
        'That conclusion exceeds the specimen evidence.',
      ],
      [
        'The entire staging examination is automatically positive',
        'A nonrepresentative sample is not proof of malignancy either.',
      ],
    ),
    matching: matching(
      'Match each result statement to its appropriate limitation.',
      [
        [
          'Representative sampled node without malignancy',
          'Interpret with the examination quality and clinical probability',
        ],
        [
          'Blood-only aspirate without representative target tissue',
          'Potentially nonrepresentative sampling',
        ],
        [
          'Clinically important station could not be accessed',
          'Unresolved target requiring an explicit further plan',
        ],
      ],
      'Different forms of “negative” or missing information should not be collapsed into one conclusion.',
    ),
    observation: q(
      'result-observe',
      'What makes a report clinically useful beyond listing station names?',
      [
        'It defines limitations and follow-up responsibility',
        'The report must enable the next clinical decision and result communication.',
      ],
      [
        'It calls all completed procedures diagnostically successful',
        'Procedural completion and diagnostic success are different.',
      ],
      [
        'It removes inaccessible targets from the record',
        'Those limitations are essential to interpretation.',
      ],
    ),
    transfer: q(
      'result-transfer',
      'A complete, representative systematic endosonographic staging examination is negative. What does the 2026 ERS/ESGE/ESTS recommendation say about routine add-on mediastinoscopy?',
      [
        'It is no longer routinely recommended in that setting',
        'This recommendation applies to the stated systematic negative examination; other unresolved diagnostic issues still need individual review.',
      ],
      [
        'It is mandatory after every negative endosonographic examination',
        'That does not reflect the 2026 recommendation.',
      ],
      [
        'It is prohibited even when another unresolved diagnostic indication exists',
        'A recommendation against routine add-on staging is not a ban on all subsequent surgical evaluation.',
      ],
    ),
    diagram: 'workflow',
    takeaways: [
      'Negative, nonrepresentative, and unassessed are different.',
      'A complete report assigns the next action and its owner.',
    ],
    sources: ['ers2026', 'ics2023'],
    boundary:
      'The case statements are authored examples. An individual next step requires the full clinical and pathological context.',
  },
]
