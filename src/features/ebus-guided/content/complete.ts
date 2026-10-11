import type { Lesson } from './types'
import { question as q, matching, sequence } from './authoring'
import { EBUS_NUMBERS } from './teachingNumbers'

const N = EBUS_NUMBERS.value
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
      'Patient tolerance is part of the decision. If oxygenation, ventilation or blood pressure worsens, stop sampling and correct that first.',
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
        ['Repeated blood-only samples', 'Sample a different part of the node, without suction'],
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
        'Sample another node that answers the question, or use the esophageal route',
        'A node hidden behind a vessel from the airway may be clear from the esophagus with the same scope, and another station may settle the stage. If neither does, record the target as not assessed.',
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
    diagram: 'troubleshooting',
    takeaways: [
      'Match the correction to the failure.',
      'Document an inaccessible target and the next plan.',
    ],
    sources: ['ics2023', 'ers2026'],
  },
  {
    id: 'complications-recovery',
    title: 'Recognize complications and plan recovery',
    topic: 'Complete',
    minutes: 7,
    objective: 'Make the first moves for bleeding and for falling oxygenation during EBUS-TBNA.',
    recall: 'A tissue target never takes priority over a deteriorating patient.',
    concept: 'Continue observing after the needle pass',
    paragraphs: [
      `Monitor oxygenation, ventilation, hemodynamics, airway patency, and bleeding throughout the procedure. Serious complications are uncommon: in the AQuIRE registry of 1,317 patients they occurred in ${N('complication-rate')}, and pneumothorax in ${N('pneumothorax-rate')}.`,
      'When bleeding obscures the view, retract the needle into its sheath and keep the scope in the airway: it is your view, your suction and your tamponade. Suction, and give 100% oxygen. Press the tip of the scope, or the inflated balloon, against the puncture site and hold it there. If bleeding continues, instill cold saline and turn the patient bleeding side down. If it still continues, secure the airway and isolate the bleeding lung with a bronchial blocker or by intubating the other main bronchus. Call for help as soon as the first moves have not worked.',
      'Complications can also present later. Persistent or worsening dyspnea, chest pain, fever, substantial hemoptysis, or other concerning symptoms after EBUS require timely clinical evaluation. Infection, including mediastinitis, is uncommon but important.',
      'Before discharge, tell the patient what was found, what is pending and who will call with it. Give return precautions they can act on: fever, worsening chest pain, shortness of breath, or coughing up more than streaks of blood are reasons to be seen the same day.',
    ],
    checklist: [
      'Needle in, scope stays, suction and oxygen.',
      'Pressure on the puncture site, then cold saline.',
      'Bleeding side down; isolate the lung if it continues.',
    ],
    worked: {
      context:
        'Oxygenation worsens during sampling and does not promptly return to the preceding condition.',
      reasoning:
        'Stop sampling and retract the needle. Check the airway first: is the tube or mask seated, is there blood or secretion to suction, is the chest moving? Give 100% oxygen. If the saturation does not recover, take the scope out so it no longer occupies the airway, and ventilate.',
    },
    question: q(
      'recovery-predict',
      'During a pass, substantial airway bleeding obscures the view. What do you do first?',
      [
        'Retract the needle, keep the scope in, suction and press on the site',
        'The scope is your view, your suction and your tamponade. Retract the needle so it cannot injure the wall, suction to see, and hold pressure on the puncture site with the scope tip or the balloon. Cold saline and turning the patient bleeding side down come next.',
      ],
      [
        'Finish the planned passes before addressing the bleeding',
        'This delays management of an evolving airway threat.',
      ],
      [
        'Withdraw the scope to the trachea to clear the lens and reassess',
        'Pulling back gives up the suction and the pressure on the puncture site, and lets blood run into the other lung.',
      ],
      true,
    ),
    sequence: sequence(
      'Order the response to bleeding that obscures the view.',
      [
        'Retract the needle into its sheath and keep the scope in the airway',
        'Suction to keep a view and give 100% oxygen',
        'Hold pressure on the puncture site, then instill cold saline',
        'Turn the patient bleeding side down and isolate the lung if it continues',
      ],
      'Each step keeps your view and protects the other lung. Call for help as soon as the first moves have not worked.',
    ),
    observation: q(
      'recovery-observe',
      'After pressure and cold saline the view clears and the saturation is stable. What do you do before any more sampling?',
      [
        'Inspect the puncture site and both main bronchi',
        'Confirm the bleeding has stopped and that no clot is obstructing an airway. Then decide whether the remaining passes are worth taking.',
      ],
      [
        'Resume at the same site to finish the planned passes',
        'The site has just bled. Look before you puncture it again.',
      ],
      [
        'Withdraw and end the procedure without looking',
        'A clot left in a main bronchus can obstruct it after you leave.',
      ],
    ),
    transfer: q(
      'recovery-transfer',
      'A patient reports fever and worsening chest discomfort after discharge following EBUS. What should the discharge plan support?',
      [
        'Same-day assessment for mediastinitis or pneumothorax',
        'Fever with chest discomfort after EBUS-TBNA raises concern for mediastinal infection, and new breathlessness for pneumothorax. Both need examination and imaging the same day.',
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
    takeaways: [
      'Bleeding: needle in, scope stays in, pressure on the site.',
      'Give return precautions the patient can act on.',
    ],
    sources: ['ics2023', 'aquire2013'],
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
      'After a negative systematic endosonographic staging examination, the 2026 ERS/ESGE/ESTS guideline recommends against routine add-on confirmatory mediastinoscopy; it may still be considered when the risk of a false-negative result is high. This statement does not turn inadequate or incomplete sampling into a reliable negative examination. Discuss discordant findings, unassessed targets, and further diagnostic needs with the multidisciplinary team.',
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
    takeaways: [
      'Negative, nonrepresentative, and unassessed are different.',
      'A complete report assigns the next action and its owner.',
    ],
    sources: ['ers2026', 'ics2023', 'aabip2025'],
  },
]
