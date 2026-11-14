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
      [
        'The gain setting',
        'Gain brightens what is already displayed; it cannot show tissue beyond the bottom of the sector.',
      ],
      [
        'The balloon inflation',
        'More balloon improves coupling, which is already adequate here; it does not extend the field.',
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
        'To work through every correction in a fixed order',
        'The observed failure tells you which correction applies; running all of them costs time and patient tolerance.',
      ],
      [
        'To decide when adding suction will solve the problem',
        'Suction addresses a scant aspirate; it does not fix lost contact, framing or a lost tip, and it worsens a bloody sample.',
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
      `Monitor oxygenation, ventilation, hemodynamics, airway patency, and bleeding throughout the procedure. Serious complications are uncommon. In the AQuIRE registry of 1,317 patients at six hospitals, a complication occurred within 24 hours in ${N('complication-rate')} and a pneumothorax in ${N('pneumothorax-rate')}. These are rates for the whole procedure, not for the needle aspiration alone. More than a third of the patients had another procedure in the same session. Transbronchial lung biopsy was the only risk factor for a complication, and five of the seven pneumothoraces were in patients who had one.`,
      /*
       * Bleeding and desaturation (owner ruling of 2026-11-14, `ebus-bleeding-sequence-source`).
       * No guideline gives a bleeding sequence for EBUS-TBNA: ICS/IAB 2023 gives rates and
       * prevention points only. The first move (needle fully into its sheath) and the priorities
       * are the owner's; the local measures are expert practice, most of it written about
       * transbronchial lung biopsy (Bernasconi 2017), with one case report of scope-tip pressure on
       * a TBNA site (Sabath 2020) and nothing published on the ultrasound balloon as tamponade.
       */
      'Bleeding after a needle pass is usually a brief ooze at the puncture site that stops by itself. Whatever its size, the first move is the same: stop sampling and retract the needle completely into its sheath, so that it cannot injure the wall or the scope. Then keep your view and protect the airway. Holding the scope at the site keeps the source in sight and lets you suction and press on it; whether to stay there depends on where the bleeding is, how brisk it is and how well the airway is controlled. Suction as much as you need to see and to keep blood out of the airways, and no more: suction pulls a forming clot off the site.',
      'What you add next is chosen for the site and the severity; these are measures to pick from, not steps to work through in order. A visible ooze from a puncture site can be pressed on with the tip of the scope, which is expert practice with one published case behind it. The saline balloon on the transducer is made for acoustic contact, not for hemostasis: do not rely on it to control bleeding. Cold saline is widely used and little studied; it also clears the lens. Turning the patient bleeding side down protects the other lung once you know which side is bleeding. Most of what is written about these measures comes from transbronchial lung biopsy, where the scope can be wedged into a segment. A puncture in the wall of the trachea or a main bronchus cannot be wedged.',
      'If the bleeding is substantial or does not settle, call for help early, before the local measures have run out. The danger is blood flooding the airways, more than the volume lost. Protect the lung that is not bleeding: position the patient bleeding side down and, if it continues, isolate the bleeding lung with a bronchial blocker or by intubating the other main bronchus, or move to rigid or therapeutic bronchoscopy to clear the airway and treat a central bleeding point.',
      'A falling saturation is a different problem, and the scope has a different place in it. Stop sampling, retract the needle and stop whatever provoked it: come off the wall, release the suction. Then find the cause. Is the airway open, and the tube or mask seated? Is the chest moving? Is the scope itself obstructing the airway? Has sedation slowed the breathing? Is there blood or secretion to clear? Give oxygen and support the airway as the patient needs; a patient who is clearly deteriorating is treated now, not when the monitor reaches a set number. If oxygenation or ventilation does not recover promptly, withdraw the scope, unless you need it to clear blood from the airway, and put airway management and assisted ventilation first.',
      'Complications can also present later. Persistent or worsening dyspnea, chest pain, fever, substantial hemoptysis, or other concerning symptoms after EBUS require timely clinical evaluation. Infection, including mediastinitis, is uncommon but important.',
      'Before discharge, tell the patient what was found, what is pending and who will call with it. Give return precautions they can act on: fever, worsening chest pain, shortness of breath, or coughing up more than streaks of blood are reasons to be seen the same day.',
    ],
    checklist: [
      'Bleeding: stop sampling and retract the needle fully into its sheath.',
      'Bleeding: keep a view, fit the local measure to the site, call for help early.',
      'Desaturation: stop, find the cause, support the airway; withdraw the scope if it does not recover.',
    ],
    worked: {
      context:
        'Oxygenation worsens during sampling and does not promptly return to the preceding condition.',
      reasoning:
        'Stop sampling, retract the needle and take the scope off the wall. Treat while you look for the cause: give oxygen, open the airway, and check that the tube or mask is seated, that the chest is moving, and that neither the scope nor blood or secretion is blocking the airway. Ask whether sedation has slowed the breathing. If the saturation does not recover promptly, take the scope out so that it no longer occupies the airway, and ventilate. That is the reverse of bleeding, where the scope may stay to keep the view.',
    },
    question: q(
      'recovery-predict',
      'During a pass, substantial airway bleeding obscures the view. What do you do first?',
      [
        'Stop sampling and retract the needle fully into its sheath',
        'This comes first whatever follows: an exposed needle can injure the wall and the scope, and nothing else is done safely while it is out. Then keep a view and protect the airway. Which local measure you add depends on the site and the severity.',
      ],
      [
        'Finish the planned passes before addressing the bleeding',
        'This delays management of an evolving airway threat.',
      ],
      [
        'Inflate the balloon over the puncture site and hold it there',
        'The needle is still out, so this is not the first move. The balloon is also made for acoustic contact, not for hemostasis, and should not be relied on to control bleeding.',
      ],
      true,
    ),
    sequence: sequence(
      'Order the priorities when bleeding obscures the view.',
      [
        'Stop sampling and retract the needle fully into its sheath',
        'Keep a view and protect the airway: oxygen, and suction as needed',
        'Add a local measure that fits the site and the severity',
        'If it persists: get help, protect the other lung, isolate the bleeding lung',
      ],
      'Only the first step is fixed. The local measure is chosen, not worked through as a list, and substantial bleeding goes straight to the last line: call for help early.',
    ),
    observation: q(
      'recovery-observe',
      'The bleeding has stopped after local measures, the view is clear and the saturation is stable. What do you do before any more sampling?',
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
        'Reassurance, since transient fever is common after bronchoscopy',
        'Transient fever alone can follow bronchoscopy, but fever with worsening chest pain needs assessment for mediastinitis.',
      ],
      [
        'An empirical oral antibiotic, with review at the results visit',
        'Treating without examination and imaging can miss mediastinitis, an abscess or a pneumothorax.',
      ],
      true,
    ),
    takeaways: [
      'Bleeding: retract the needle fully first; what follows depends on the site and the severity.',
      'Desaturation: find the cause and support the airway; the scope comes out if it does not recover.',
      'Give return precautions the patient can act on.',
    ],
    sources: ['ics2023', 'aquire2013', 'asano2013', 'bernasconi2017', 'sabath2020', 'davidson2020'],
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
        'A true negative, if the needle was seen within the node',
        'Seeing the needle in the node supports targeting, but the specimen itself must contain representative material.',
      ],
      [
        'Negative for malignancy, with lower confidence',
        'Without lymphoid or lesional material the specimen cannot be called negative at any confidence; it is nondiagnostic.',
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
        'It gives the short axis of every node that was sampled',
        'Sizes are worth recording, but they do not tell the reader what was not assessed or who acts on the result.',
      ],
      [
        'It summarizes the mediastinum as positive or negative',
        'A one-word summary hides unsampled and nonrepresentative stations, which the next decision depends on.',
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
