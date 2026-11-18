import type { Lesson } from './types'
import { question as q, matching, sequence } from './authoring'
import { EBUS_NUMBERS } from './teachingNumbers'

const N = EBUS_NUMBERS.value

/** The lesson's closing question: a complication that presents after the patient has gone home. */
const DISCHARGE_QUESTION = {
  ...q(
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
  hint: 'Persistent or worsening dyspnea, chest pain, fever or substantial hemoptysis need timely evaluation; infection, including mediastinitis, is uncommon but important.',
}
/** The prediction that opens the lesson: the first move when a pass bleeds. */
const BLEEDING_PREDICTION = q(
  'recovery-predict',
  'During a pass, substantial airway bleeding obscures the view. What do you do first?',
  [
    'Stop sampling and retract the needle completely into its sheath',
    'This comes first whatever follows: an exposed needle can injure the wall and the scope, and nothing else is done safely while it is out. Then keep a view and protect the airway. With bleeding this heavy, call for help at the same time. Which local measure you add depends on the bleeding and the patient.',
  ],
  [
    'Leave the needle in the node and suction to clear the view',
    'An exposed needle can tear the wall as the scope and the patient move, and with the assembly in the channel you have little suction. Retract it first.',
  ],
  [
    'Inflate the balloon over the puncture site and hold it there',
    'The needle is still out, so this is not the first move. The balloon is also made for acoustic contact and has not been shown to control bleeding.',
  ],
  true,
)
/** The desaturation decision: a fall that is getting worse, with nothing for the scope to clear. */
const DESATURATION_QUESTION = q(
  'desaturation-decide',
  'Under moderate sedation the saturation falls during a pass and keeps falling after you stop and retract the needle. The chest is barely moving and there is no blood in the airway. What now?',
  [
    'Withdraw the scope, open the airway and ventilate with oxygen',
    'The fall is getting worse, sedation has slowed the breathing and the scope is occupying the airway. With no blood to clear, withdraw it now and support the airway and the breathing. Nothing is gained by waiting with the scope in.',
  ],
  [
    'Keep watching the monitor and intervene when it reaches a set threshold',
    'A patient who is deteriorating is treated now. A number on the monitor is not the trigger.',
  ],
  [
    'Keep the scope at the site to preserve the view, as you would for bleeding',
    'That is the bleeding response. Nothing is bleeding here, and the scope is taking up airway the patient needs.',
  ],
)
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
  /*
   * Complications (owner rulings of 2026-11-14, `ebus-bleeding-sequence-source`, and of 2026-11-15,
   * `r2-558-approve`, `r2-558-beyond` and `r2-558-split`). The lesson is two units since 2026-11-17:
   * bleeding (this one, which keeps the lesson's id and its closing question) and desaturation.
   * Each has its own screen, its own ordering task and its own decision.
   *
   * No guideline gives a bleeding sequence for EBUS-TBNA: ICS/IAB 2023 gives rates and prevention
   * points only. The first move (needle completely into its sheath) and the priorities are the
   * owner's. The local measures are expert practice, most of it written about transbronchial lung
   * biopsy (Bernasconi 2017). The one published case of direct pressure (Sabath 2020) used the tip
   * of a flexible bronchoscope; pressure with the EBUS transducer is operator practice, and no
   * report of the ultrasound balloon as tamponade was found.
   */
  {
    id: 'complications-recovery',
    title: 'Recognize complications and plan recovery',
    topic: 'Complete',
    minutes: 7,
    objective: 'Make the first moves for bleeding and for falling oxygenation during EBUS-TBNA.',
    recall: 'A tissue target never takes priority over a deteriorating patient.',
    concept: 'Bleeding: stop, see, control, escalate',
    paragraphs: [
      `Monitor oxygenation, ventilation, hemodynamics, airway patency, and bleeding throughout the procedure. Serious complications are uncommon. In the AQuIRE registry of 1,317 patients at six hospitals, a complication occurred within 24 hours in ${N('complication-rate')} and a pneumothorax in ${N('pneumothorax-rate')}. These are rates for the whole procedure, not for the needle aspiration alone. More than a third of the patients had another procedure in the same session. Transbronchial lung biopsy was the only risk factor for a complication, and five of the seven pneumothoraces were in patients who had one.`,
      'Bleeding after a needle pass is usually a brief ooze at the puncture site that stops by itself. Blood that keeps welling, hides the view or reaches other airways is significant. However brisk it is, the first move is the same: stop sampling and retract the needle completely into its sheath, so that it cannot injure the wall or the scope. Then give oxygen, keep your view and protect the airway. With the needle assembly in the working channel you have little suction. When you need it, take the assembly out, but only after the needle is completely retracted, and handle it as the device instructions require.',
      'Holding the scope at the site keeps the source in sight and lets you suction. Stay while you can see the source and the airway is secure; when blood outruns your suction or the airway is not secure, the airway comes before the view. Suction as much as you need to see and to keep blood out of the airways, and no more: suction can pull a forming clot off the site.',
      'What you add next depends on the severity and site of the bleeding, the oxygenation and the patient’s condition. These are options, not a sequence. Direct pressure on an oozing puncture site that you can see and reach is one of them. Its published support is a single case, in which the tip of a flexible bronchoscope was held on the site. Pressing with the EBUS transducer is operator practice, not an evidence-based or guideline-supported maneuver, and it costs you the white-light view while you press. The saline balloon on the transducer is a thin balloon made for acoustic contact. It has not been shown to control bleeding: do not rely on it.',
      'Cold saline is widely used and little studied; it also clears the lens. A topical vasoconstrictor is sometimes added: the evidence is limited, and the agent and dose follow local protocol, not a universal recommendation. Turning the patient bleeding side down protects the other lung once you know which side is bleeding. Most of what is written about these measures comes from transbronchial lung biopsy, where the scope can be wedged into a segment. A puncture in the wall of the trachea or a main bronchus cannot be wedged. When the bleeding has stopped, inspect the site and both main bronchi for clot before you decide whether more passes are worth taking.',
      'If the bleeding is substantial or does not settle, call for help early, before the local measures have run out. The danger is blood flooding the airways, more than the volume lost. When the source is peripheral or on one side, protect the other lung: turn the patient bleeding side down and, if it continues, isolate the bleeding side with a bronchial blocker or by intubating the other main bronchus. Selective lung isolation may not control a central source in the trachea or at the carina. There, secure the airway and escalate early to therapeutic or rigid bronchoscopy, which can clear the airway and treat the bleeding point.',
    ],
    checklist: [
      'Stop sampling and retract the needle completely into its sheath.',
      'Keep a view and protect the airway; fit the local measure to the bleeding and the patient.',
      'Brisk or persistent: help early, protect the other lung, and escalate.',
    ],
    worked: {
      context:
        'After a pass at station 4R, blood keeps welling from the puncture site in the tracheal wall and begins to run into both main bronchi.',
      reasoning:
        'The needle is already back in its sheath. This is no longer a brief ooze, so call for help now. Take the retracted needle assembly out so that you have full suction, keep the view while you can clear the blood, and choose a local measure for a site you can see. The source is in the trachea, so blocking one side may not control it: be ready to secure the airway and move to therapeutic or rigid bronchoscopy.',
    },
    question: BLEEDING_PREDICTION,
    sequence: sequence(
      'Order the priorities when a puncture site bleeds. The steps overlap.',
      [
        'Stop sampling and retract the needle completely into its sheath',
        'Keep a view and protect the airway: oxygen, and suction as needed',
        'Add a local measure that fits the bleeding and the patient',
        'If it is brisk or persists: protect the other lung; escalate to isolation or to therapeutic or rigid bronchoscopy',
      ],
      'The needle comes first every time, and the airway and the view come before any local measure. The steps overlap, and which local measure you use is a choice, not a list to work through. Help is called as soon as the bleeding looks substantial, not after the measures have failed.',
    ),
    // The check after the bleeding task, restored at the owner's request (r2-558-beyond, point 4).
    observation: q(
      'recovery-observe',
      'The bleeding appears to have stopped after local measures, the view is clear and the saturation is stable. What do you do before any more sampling?',
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
    // Not asked: the lesson's closing question is drawn from the unit whose screen teaches it.
    transfer: { ...BLEEDING_PREDICTION, id: 'recovery-predict-slot-3' },
    takeaways: [
      'Bleeding: retract the needle completely first; what follows depends on the bleeding and the patient.',
      'Desaturation: support the airway and find the cause; when the fall is significant or worsening, withdraw the scope promptly if ventilation needs it.',
      'Give return precautions the patient can act on.',
    ],
    sources: ['ics2023', 'aquire2013', 'asano2013', 'bernasconi2017', 'sabath2020', 'davidson2020'],
  },
  /*
   * Desaturation, on its own screen with its own decision (r2-558-split). The response is expert
   * practice: ICS/IAB 2023 (oxygen during EBUS) supports routine oxygen and oximetry and says
   * desaturation is common and multifactorial, no more. By r2-558-approve the scope is withdrawn
   * promptly when the fall is significant or worsening; nothing implies a wait.
   *
   * A unit must carry three checks with ids of their own. This one asks two: the desaturation
   * decision, and the lesson's closing question, which belongs here because this screen's last
   * paragraph is the after-procedure teaching it draws on. The slot between them holds the
   * desaturation question under another id, and no step asks it.
   */
  {
    id: 'desaturation-response',
    title: 'When the saturation falls',
    topic: 'Complete',
    minutes: 4,
    objective:
      'Restore oxygenation and ventilation when the saturation falls, and withdraw the scope when that is what it takes.',
    recall: 'In bleeding the scope may stay to keep the view.',
    concept: 'Desaturation: stop, ventilate, find the cause, withdraw when needed',
    paragraphs: [
      'A falling saturation is a different problem, and the scope has a different place in it. Recognize it from the patient as well as the monitor: a chest that moves less, noisy or absent airflow, a change in color. On supplemental oxygen the saturation falls late, so a reading that still looks acceptable does not show that ventilation is adequate.',
      'Stop sampling, retract the needle and undo what set it off: take the scope off the wall and stop suctioning through it. Give oxygen and support the airway while you find the cause; a patient who is clearly deteriorating is treated now, not when the monitor reaches a set number. Is the airway open, and the tube or mask seated? Is the chest moving? Is the scope itself obstructing the airway? Has sedation slowed the breathing? Is there blood, secretion or bronchospasm? Is the oxygen connected and flowing?',
      'When the fall is significant or getting worse, withdraw the scope promptly if that is what it takes to ventilate the patient; do not sit through a long failed attempt at recovery with the scope in place. Once it is out, airway management and assisted ventilation come first. The one reason to keep it in is blood that only the scope can clear. Call for help early, not after these measures have failed. This response is expert practice: ICS/IAB 2023 says only that desaturation during EBUS is common and has several causes.',
      'Complications can also present after the procedure. Persistent or worsening dyspnea, chest pain, fever or substantial hemoptysis need timely evaluation; infection, including mediastinitis, is uncommon but important. Before discharge, tell the patient what was found, what is pending and who will call with it. Fever, worsening chest pain, shortness of breath, or coughing up more than streaks of blood are reasons to be seen the same day.',
    ],
    checklist: [
      'Stop, retract the needle, and undo what set it off.',
      'Oxygen and airway support while you find the cause.',
      'Significant or worsening: withdraw the scope promptly when ventilation needs it.',
    ],
    worked: {
      context: 'Oxygenation worsens during sampling and is still falling after you stop.',
      reasoning:
        'Stop sampling, retract the needle and take the scope off the wall. Treat while you look for the cause: give oxygen, open the airway, and check that the tube or mask is seated, that the chest is moving, and that neither the scope nor blood or secretion is blocking the airway. Ask whether sedation has slowed the breathing. The saturation is still falling, and there is no blood that you need the scope to clear, so take the scope out now and ventilate. That differs from bleeding, where the scope often stays to keep the view.',
    },
    question: DESATURATION_QUESTION,
    sequence: sequence(
      'Order the response to a saturation that is falling. The steps overlap.',
      [
        'Stop sampling, retract the needle and undo what set it off',
        'Give oxygen and support the airway while you find the cause',
        'Significant or worsening: withdraw the scope when ventilation needs it',
        'Escalate airway support until ventilation is restored',
      ],
      'This is an order of priority, and help is called early. You support the airway while you look for the cause, and the scope comes out as soon as that is what ventilation needs: not at a set number, and not after a long failed recovery.',
    ),
    observation: { ...DESATURATION_QUESTION, id: 'desaturation-decide-slot-2' },
    transfer: DISCHARGE_QUESTION,
    takeaways: [
      'Bleeding: retract the needle completely first; what follows depends on the bleeding and the patient.',
      'Desaturation: support the airway and find the cause; when the fall is significant or worsening, withdraw the scope promptly if ventilation needs it.',
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
