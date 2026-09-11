import type { AuthoredCapstoneCase } from './types'

/**
 * The capstone: the eight core integrated cases of the knowledge specification (§22: C01, C04,
 * C05, C06, C07, C09, C10, C16), each adapted into one decision. They are decided once, in one
 * sitting, and debriefed at the end; a critical case whose decision does not hold is a safety error
 * that the standard cannot absorb (§21.3). An option that is a case's named critical error, or the
 * same act as one, is `unsafe`, so the stage stops on it mid-sitting.
 *
 * Each situation carries the signals in the room and nothing of the case's four-box answer; each
 * title names the situation, never the decision. No colony count, organism, susceptibility value,
 * antibiotic, drug dose, lavage volume target, alarm setting or device dimension is authored here.
 * C16's two volumes are the lecture's own collection facts (§15.4), and its answer is that the
 * laboratory data are missing (R25, R26). C06 changes the team member and C07 the phase of the
 * procedure, so neither repeats its paired section's prediction. The keyed choice sits at a
 * different authored position from case to case; the host still rotates display order.
 */
export const CAPSTONE_CASES: readonly AuthoredCapstoneCase[] = [
  {
    id: 'C01',
    presentationTitle: 'A directed lavage for a focal opacity',
    situation:
      'In a teaching case, a 52-year-old woman has a focal opacity in the left lower lobe on CT, and the supervising physician has chosen a directed bronchoalveolar lavage. At the time-out, the label on the collection trap reads right middle lobe. She is stable and has not received sedation.',
    critical: true,
    pairedSectionId: 'specimen-pathway',
    item: {
      id: 'C01',
      itemType: 'management-decision',
      stem: 'What is the next move?',
      choices: [
        {
          id: 'a',
          label:
            'Start in the left lower lobe, as the CT shows, and amend the label after sampling',
          rationale:
            'The CT probably reflects the plan, but starting leaves the discrepancy unresolved: no one has checked why the label disagrees with the imaging, or what else it might reflect. Discrepancies are resolved at the time-out, before sampling, not repaired on the label afterwards.',
          plausibility: 'unsafe',
        },
        {
          id: 'b',
          label:
            'Lavage the right middle lobe as labeled, since return from that lobe is usually better',
          rationale:
            'The right middle lobe or the lingula may give useful return when disease is diffuse. For a focal opacity the sample has to come from the region of the abnormality, and lavaging the labeled lobe once the mismatch is known is a procedure on the unintended side; a label does not move the disease.',
          plausibility: 'unsafe',
        },
        {
          id: 'c',
          label: 'Hold the start until the team settles the side against the CT and the plan',
          rationale:
            'The CT and the label name different lungs. The site is chosen from the imaging and the plan, not from the label, but the time-out also confirms the patient, the procedure and the images, so the team settles the mismatch together rather than leaving it to whoever noticed it. Settling it now, before sedation or the scope, costs minutes; a lavage from the unintended side cannot be taken back.',
          plausibility: 'best',
        },
        {
          id: 'd',
          label:
            'Hold the start, ask the supervisor which side is meant, and reprint the label to match',
          rationale:
            'Holding the start is right, and the supervisor can say what was intended, but the time-out is a spoken team check against the imaging: the side and segment are confirmed against the CT aloud, the assistant handling the specimen and the clinician monitoring her acknowledge them, and the label changes only once they agree.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      explanation:
        'A lavage answers the clinical question only if it comes from the intended region and carries the site actually sampled. When the CT and the label disagree, the procedure waits while the team settles the side against the imaging and the plan, aloud and together, and the label is changed to match what they agree on. A well-returned lavage from the unintended lobe is a technical success that answers nothing.',
      objectiveIds: ['M02-O4', 'M12-O2', 'M14-O2'],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 59 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 121 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 163 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 131 } },
      ],
    },
  },
  {
    id: 'C04',
    presentationTitle: 'A requested look at a patient with stridor',
    situation:
      'In a teaching case, a 45-year-old woman has progressive stridor, and her imaging shows marked narrowing of the proximal trachea. A fellow early in bronchoscopy training is asked to take a quick look with the flexible bronchoscope in the standard procedure room.',
    critical: true,
    pairedSectionId: 'clinical-question',
    item: {
      id: 'C04',
      itemType: 'management-decision',
      stem: 'How should the fellow respond to the request?',
      choices: [
        {
          id: 'a',
          label:
            'With the supervisor present, take a brief look using the smallest scope available',
          rationale:
            'A supervisor at the bedside does not make a standard room ready for a critical airway. In a critically narrowed trachea even a small scope can take up much of the lumen that remains, topical anesthetic can blunt protective responses and sedation can reduce effort and airway patency, and the rescue this airway could need has not been planned.',
          plausibility: 'unsafe',
        },
        {
          id: 'b',
          label:
            'Decline the quick look, and ask for senior interventional and anesthesia input first',
          rationale:
            'Progressive stridor with marked tracheal narrowing makes this a critical airway, not a routine inspection. Senior interventional and anesthesia clinicians decide the location, the team, the rescue options and whether the examination should happen at all, before anyone instruments the airway.',
          plausibility: 'best',
        },
        {
          id: 'c',
          label: 'Decline, and put the look on the next routine list in the same room',
          rationale:
            'Declining the quick look is right, but a routine slot in the same room leaves a patient with progressive stridor without a plan, and that room may still lack the rescue this airway could need. Senior interventional and anesthesia clinicians decide the timing, the setting and the team.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label:
            'Go ahead as asked, since an inspection on its own carries less risk than a biopsy would',
          rationale:
            'In an ordinary airway, inspection does carry less bleeding and pneumothorax risk than biopsy. Here the hazard is the airway itself: calling the procedure diagnostic says nothing about how much lumen remains, and going ahead as asked treats a critical airway as a routine novice inspection, in a room that may not hold the rescue this patient could need.',
          plausibility: 'unsafe',
        },
      ],
      explanation:
        'Progressive stridor with marked proximal tracheal narrowing turns a quick look into a critical-airway procedure. A diagnostic scope can take up much of the lumen that remains, topical anesthetic can blunt protective responses and sedation can reduce ventilation and airway patency, and the standard room may not hold the rescue options. The fellow declines the request as framed and escalates, so that senior interventional and anesthesia clinicians decide whether, where and how the airway is examined, and the change of plan is documented.',
      objectiveIds: ['M01-O4', 'M02-O2', 'M01-O2'],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 115 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 83 } },
      ],
      reviewItemIds: ['R41'],
    },
  },
  {
    id: 'C05',
    presentationTitle: 'Midway through a lavage under sedation',
    situation:
      'In a teaching case, a 59-year-old man is having a bronchoalveolar lavage during a bronchoscopy under sedation. Partway through, he becomes less responsive and his respiratory effort falls. His oxygen saturation, steady until now, begins to fall. Part of the planned lavage volume has not yet been instilled.',
    critical: true,
    pairedSectionId: 'deterioration',
    item: {
      id: 'C05',
      itemType: 'management-decision',
      stem: 'What should happen now?',
      choices: [
        {
          id: 'a',
          label:
            'Announce the change, then instill the remaining aliquots to reach the planned volume',
          rationale:
            'The planned volume is a collection intention, not a patient-care objective. Adding fluid to the lungs of a patient who is not breathing enough can worsen gas exchange for a specimen that can instead be limited and documented.',
          plausibility: 'unsafe',
        },
        {
          id: 'b',
          label:
            'Announce the change, raise the oxygen, and continue the lavage as the saturation recovers',
          rationale:
            'Lavage can lower the saturation for a time, but that does not explain reduced responsiveness and effort; those point to hypoventilation. Extra oxygen supports oxygenation without treating hypoventilation and can hold the saturation up while ventilation keeps falling, so continuing the lavage on a recovering saturation leaves the deterioration unassessed.',
          plausibility: 'unsafe',
        },
        {
          id: 'c',
          label:
            'Announce the change, stop instilling, and keep suction running to recover the fluid first',
          rationale:
            'Stopping instillation is right, but continuous suction removes gas as well as fluid and can reduce lung volume and worsen gas exchange. Reduced responsiveness and effort call for the airway and breathing to be assessed and supported first, with instillation and unnecessary suction both paused.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label: 'Announce the change, pause the lavage, and have the team support his breathing',
          rationale:
            'Reduced responsiveness and effort, with a saturation that has started to drop, point to hypoventilation; recent sedation, the airway and the lavage are all candidates. Pausing instillation and unneeded suction, saying so aloud and bringing in the supervisor and the monitoring clinician lets the qualified team support airway patency, oxygenation and ventilation.',
          plausibility: 'best',
        },
      ],
      explanation:
        'Reduced responsiveness and effort point to falling ventilation; the saturation can be a late sign of it, especially on supplemental oxygen. The response is to pause instillation and unnecessary suction, announce the deterioration, and let the qualified team support the airway, oxygenation and ventilation, repositioning or removing the scope when that is helpful and safe. Neither reaching the planned volume nor further sedation is the answer; the lavage resumes, if at all, only after the patient is reassessed and a new decision is made, and the actual volumes and the event are documented.',
      objectiveIds: ['M15-O1', 'M04-O3', 'M12-O6', 'M15-O4'],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
        { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
      ],
      reviewItemIds: ['R22'],
    },
  },
  {
    id: 'C06',
    presentationTitle: 'A red view after a transbronchial biopsy',
    situation:
      'In a simulation, a fellow is assisting a co-fellow who is operating under supervision. A transbronchial biopsy has just been taken from a segment of the right lower lobe with the scope tip wedged in its opening. Fresh blood wells up in that segment ahead of the lens until the whole image is red; breathing and oximetry are unchanged from the start. The co-fellow says the lens must be against the wall and starts to pull back for a wider view.',
    critical: true,
    pairedSectionId: 'bleeding-priorities',
    item: {
      id: 'C06',
      itemType: 'management-decision',
      stem: 'What should the fellow say?',
      choices: [
        {
          id: 'a',
          label: 'Ask the co-fellow to keep the wedge, stop sampling and call for help',
          rationale:
            'Blood filling the segment the tip is wedged in, just after a biopsy, with breathing and oximetry unchanged, is most likely a bleed the wedge is containing, not a lens on the wall. Keeping the wedge, stopping sampling and calling for help may limit spill into the airways that are still clear while the supervisor directs isolation, suction and positioning.',
          plausibility: 'best',
        },
        {
          id: 'b',
          label: 'Agree, and have suction ready for when the tip reaches the lobar bronchus',
          rationale:
            'Pulling back is how a red field from wall contact is recovered. Here the red is blood from the segment the tip is sealing, and withdrawing may release it into airways that are still clear, trading a contained bleed for a spreading one.',
          plausibility: 'unsafe',
        },
        {
          id: 'c',
          label:
            'Suggest continuous suction through the wedged scope, so the view clears before anyone moves',
          rationale:
            'Clearing the picture is not the aim while the wedge holds a fresh bleed: continuous suction through it can disrupt the clot that is forming and work against the tamponade. How and when to suction belongs to the supervisor’s plan.',
          plausibility: 'unsafe',
        },
        {
          id: 'd',
          label: 'Say nothing for now, and speak up if oximetry starts to fall',
          rationale:
            'Unchanged oximetry is why the wedge is worth keeping, not a reason to wait. Staying silent lets the tip leave the wedge; the operator needs to hear that the red is blood before it moves, and help is called as soon as a bleed is recognized.',
          plausibility: 'unsafe',
        },
      ],
      explanation:
        'The red here is blood from the segment just biopsied, and with breathing and oximetry unchanged the wedged tip is likely helping to hold it there, so the scope is containing the bleed, not merely looking. Pulling back to recover the view, the usual response to a red field from wall contact, can release blood into clear airways, and continuous suction or stripping clot can disrupt the clot that is forming, so the assistant says so before the tip moves. With further sampling stopped and help called, oxygenation, ventilation and protection of the unaffected airways come first, and the supervisor directs isolation, suction, positioning and escalation. If blood flooded the central airways and ventilation fell, restoring the airway could take priority instead.',
      objectiveIds: ['M15-O2', 'M15-O5'],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 138, to: 143 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 27, to: 30 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 56 } },
        { sourceId: 'T09', location: { kind: 'time-span', start: '00:25:10', end: '00:33:41' } },
      ],
      reviewItemIds: ['R34'],
    },
  },
  {
    id: 'C07',
    presentationTitle: 'Labeling the pots after an endobronchial biopsy',
    situation:
      'In a teaching case, a 61-year-old woman has had a planned, supervised endobronchial biopsy of an airway lesion. Beforehand, the team agreed to send tissue for histology and for microbiology. As the pots are labeled at the end, the assistant notices that every piece went into formalin; no culture container was in the room. The scope is out and she is recovering.',
    critical: false,
    pairedSectionId: 'specimen-pathway',
    item: {
      id: 'C07',
      itemType: 'management-decision',
      stem: 'What is the next move?',
      choices: [
        {
          id: 'a',
          label:
            'Send the pots for histology alone, and leave the culture off the record since none was sent',
          rationale:
            'Leaving the culture off the record hides a handling error and lets the microbiology question go unanswered without anyone deciding that it can. The error is disclosed and documented, and the need for a further sample is decided with the team.',
          plausibility: 'unsafe',
        },
        {
          id: 'b',
          label:
            'Tell the supervisor, record the error, and plan whether culture needs another sample',
          rationale:
            'Fixation cannot be undone, so the planned culture can no longer come from this tissue. Telling the supervisor, recording that all the material went into formalin, and deciding with the team whether the microbiology question needs another sample keeps the error visible and the question owned.',
          plausibility: 'best',
        },
        {
          id: 'c',
          label:
            'Tell the supervisor, and ask the laboratory to culture the fixed pieces so no repeat is needed',
          rationale:
            'Telling the supervisor is right, but a request cannot undo fixation. Tissue in formalin is unsuitable for culture however it is handled afterwards, so the request records a study that could never be done; whether the question needs another sample is decided with the team.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label:
            'Send the pots for both studies, since pieces this large should serve histology and culture',
          rationale:
            'Size does not change what formalin does. A large, well-formed piece in fixative is still unsuitable for culture, and sending it as though it could serve implies a study that was never possible; how impressive a specimen looks is not proof that it can answer every question.',
          plausibility: 'unsafe',
        },
      ],
      explanation:
        'Formalin fixes tissue for routine histology; culture, and studies that need viable cells, need material that has not been fixed. Once all the material is in formalin no later request can recover a culture, so the error is irreversible even though the biopsy itself went well. What remains is to disclose and document it and to decide with the team whether the microbiology question needs another sample; the prevention belonged before the first sample.',
      objectiveIds: ['M14-O3', 'M14-O1', 'M17-O2'],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 120, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 130, to: 131 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 163 } },
      ],
    },
  },
  {
    id: 'C09',
    presentationTitle: 'A bronchoscopy through an endotracheal tube',
    situation:
      'In a model ICU case, a bronchoscopy is under way through the endotracheal tube of an adult ventilated on a volume-targeted mode. The scope went through the tube without resistance. Since then the peak airway pressure has risen and the exhaled tidal volume has fallen. The oxygen saturation is unchanged.',
    critical: false,
    pairedSectionId: 'scope-in-a-tube',
    item: {
      id: 'C09',
      itemType: 'management-decision',
      stem: 'What is the next move?',
      choices: [
        {
          id: 'a',
          label: 'Carry on, and reassess if the saturation starts to fall',
          rationale:
            'Oxygen saturation reports oxygenation and can lag behind falling ventilation, more so on supplemental oxygen. The exhaled volume has already fallen; waiting for the saturation to confirm it wastes the warning.',
          plausibility: 'unsafe',
        },
        {
          id: 'b',
          label:
            'Pause while the respiratory therapist raises the high-pressure alarm limit, then continue',
          rationale:
            'The alarm is reporting the problem. Depending on the ventilator and mode, a higher limit may let more volume through only by accepting higher airway pressure, and either way the cause goes untreated; the therapist’s part is to work the reading through with the team, not to adjust the alarm so the procedure can finish.',
          plausibility: 'unsafe',
        },
        {
          id: 'c',
          label: 'Suction continuously through the scope to clear the tube, then carry on',
          rationale:
            'Suction draws gas as well as secretions and can reduce lung volume. With the scope already impeding ventilation, prolonged suction adds to the problem, and it does not answer a rising pressure with a falling exhaled volume, which needs a pause and a check with the respiratory therapist.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label:
            'Pause, and check the scope, tube, circuit and patient with the respiratory therapist',
          rationale:
            'Rising pressure with a falling exhaled volume means ventilation is being impeded: less gas delivered, gas trapped behind a limited expiration, or a new cause. Pausing, reducing the scope’s obstruction as appropriate, and checking the tube, circuit, secretions and the patient with the supervisor and respiratory therapist finds the cause before ventilation fails.',
          plausibility: 'best',
        },
      ],
      explanation:
        'Physical fit is not physiological adequacy: the scope inside the tube can greatly increase resistance and limit expiration, and a rising peak pressure with a falling exhaled volume means ventilation is being impeded, whether less gas goes in, less comes out, or a new problem such as secretions, tube displacement or a pneumothorax has appeared. Oxygen saturation reports oxygenation and can lag behind ventilation. The move is to pause, reduce the procedural impediment as appropriate, and address tube, circuit and patient causes with the supervisor and respiratory therapist, rather than raising alarm limits or continuing on the saturation. A geometric area calculation can show why fit is not enough; it cannot predict flow or delivered volume.',
      objectiveIds: ['M16-O1', 'M16-O2', 'M04-O3', 'M03-O5'],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 155, to: 158 } },
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:16:23', end: '00:22:00' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
      ],
      reviewItemIds: ['R31'],
    },
  },
  {
    id: 'C10',
    presentationTitle: 'A template report awaiting signature',
    situation:
      'A simulated procedure report, generated from a template, states that the vocal folds and all segmental bronchi are normal. The bronchoscopy was performed through an endotracheal tube, and the scope could not be advanced through a tight lesion at one lobar origin without force, so nothing beyond it was examined. The report is waiting for the bronchoscopist’s signature.',
    critical: true,
    pairedSectionId: 'honest-report',
    item: {
      id: 'C10',
      itemType: 'management-decision',
      stem: 'What should the bronchoscopist do with this report?',
      choices: [
        {
          id: 'a',
          label: 'Sign it as generated, since the airways that could be seen looked normal',
          rationale:
            'Signing claims a complete normal survey that was never performed. Normal describes an airway that was seen and examined; the vocal folds and the airways beyond the lesion were neither.',
          plausibility: 'unsafe',
        },
        {
          id: 'b',
          label:
            'Record the vocal folds and the airways beyond the lesion as abnormal, since they were unseen',
          rationale:
            'Unseen is not abnormal. Calling these areas abnormal invents a finding in the other direction; the honest entry is the limitation and why it occurred.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'c',
          label:
            'Mark each unseen area not assessed, not safely accessible or not examined, with the reason',
          rationale:
            'The endotracheal tube lay across the vocal folds, so they were not assessed; the lobar origin with the tight lesion was seen but could not be entered without force, so it was not safely accessible, and the airways beyond it were not examined for that reason. Recording each limitation with its reason, alongside the lesion and the airways actually examined, tells the next clinician what is and is not known.',
          plausibility: 'best',
        },
        {
          id: 'd',
          label: 'Delete the survey lines and describe only the lesion and the samples taken',
          rationale:
            'Removing the unsupported normals is right, but leaving out the extent loses what was examined and found normal, and why the rest was not. The next clinician cannot tell an omission from an airway that was never reached.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      explanation:
        'A report may call an airway normal only if it was seen and examined. Through an endotracheal tube the vocal folds were not assessed; the narrowed lobar origin was not safely accessible, and the airways beyond it were not examined; each is a limitation with a reason, neither normal nor abnormal. The signed report describes the lesion and the airways actually examined, records each limitation and why, and names the pending question and who will follow up the results.',
      objectiveIds: ['M17-O2', 'M10-O2', 'M10-O4'],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 161, to: 163 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
      ],
    },
  },
  {
    id: 'C16',
    presentationTitle: 'A culture question from a recorded ICU lecture',
    situation:
      'A teaching exercise built from a recorded ICU lecture describes one sample. Central secretions were suctioned first; then 40 mL was instilled at the selected site, 15 mL was recovered, and the sample was sent as a lavage. The lecture goes on to discuss culture results and a susceptibility table on a slide that is not available. The exercise asks which antibiotic the results support.',
    critical: false,
    pairedSectionId: 'specimen-pathway',
    item: {
      id: 'C16',
      itemType: 'mechanism-interpretation',
      stem: 'What answer does the record support?',
      choices: [
        {
          id: 'a',
          label:
            'None: the culture data are missing, and the sample may not represent a true lavage',
          rationale:
            'The record holds collection facts and nothing else: no organism, no quantitative culture result and no susceptibility table. With no data, no antibiotic answer can be verified, and the collection details already limit how any later result could be read.',
          plausibility: 'best',
        },
        {
          id: 'b',
          label:
            'The antibiotic the lecturer most likely meant, inferred from organisms common in the ICU',
          rationale:
            'Inferring the intended answer turns a missing table into an invented one, and a confident key built on a guess teaches false certainty. An antibiotic decision also depends on clinical suspicion, prior antibiotics, severity and other sources of infection, none of which are given.',
          plausibility: 'unsafe',
        },
        {
          id: 'c',
          label:
            'None as a lavage; record it as an aspirate so a later culture is read against that cutoff',
          rationale:
            'A sample does not acquire a validated aspirate cutoff because it fell short of a lavage criterion. Reclassifying it changes the rule applied to the result, not the quality of the sample; the collection is recorded as it happened and interpreted with the laboratory and the clinical team.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label:
            'None yet: ask the laboratory for the missing culture report and susceptibility table',
          rationale:
            'Asking for the missing report is right, but it leaves out what the record already shows. Central suction beforehand does not by itself spoil a lavage, yet with the small volume instilled the sample may not represent the distal airspaces, and that limit travels with any result the laboratory sends.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      explanation:
        'The record holds only collection facts: central suction first, then 40 mL instilled and 15 mL recovered, sent as a lavage. The culture results and the susceptibility table are on a slide that was not provided, so no antibiotic answer can be verified, and none should be generated. What the case still teaches is that collection is part of the result: document how the sample was actually taken, obtain the full laboratory report and clinical context, and read any result with its limits rather than reclassifying the sample to fit a different cutoff.',
      objectiveIds: ['M14-O5', 'M02-O1', 'M18-O5'],
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:32:53', end: '00:39:19' } },
        {
          sourceId: 'U7',
          location: {
            kind: 'section',
            label: 'contextual interpretation of quantitative cultures',
          },
        },
      ],
      reviewItemIds: ['R21', 'R22', 'R25', 'R26'],
    },
  },
]
