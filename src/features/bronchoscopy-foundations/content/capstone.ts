import type { SourceRef } from '../data/sources'
import { num } from './numbers'
import type { AuthoredCapstoneCase } from './types'

/**
 * The eight integrated cases (knowledge specification §22: C01, C04, C05, C06, C07, C09, C10, C16),
 * rewritten for the rewrite plan. Each puts the fellow in one situation that draws on more than
 * one section and asks for one move. Nothing is scored or saved.
 *
 * They follow the rules the sections follow: second person, a patient with numbers in the
 * situation, a key that is a clinical act, and wrong choices that are real errors. A choice is
 * `unsafe` only when it is the harmful reflex its paired section names. A number in a reason or an
 * explanation comes from the register through `num()`; `capstoneRuleErrors` holds all of this.
 *
 * A case's section and its "safety-critical decision" label are shown after the answer, never
 * before. The keyed choice sits at a different place from case to case, and the page reorders the
 * choices again.
 */
const S1 = (from: number, to?: number): SourceRef => ({
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from, ...(to ? { to } : {}) },
})
const S2 = (from: number, to?: number): SourceRef => ({
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from, ...(to ? { to } : {}) },
})

export const CAPSTONE_CASES: readonly AuthoredCapstoneCase[] = [
  {
    id: 'C01',
    presentationTitle: 'A lavage for a focal opacity',
    situation:
      'A 52-year-old woman has a left lower lobe opacity on CT. You are about to lavage. The trap is labelled “right middle lobe”, the usual site, and your scope is sitting in the middle lobe bronchus. SpO₂ is 95% on 2 L/min.',
    critical: true,
    pairedSectionId: 'washing-and-lavage',
    item: {
      id: 'C01',
      itemType: 'management-decision',
      stem: 'What do you do?',
      choices: [
        {
          id: 'a',
          label: 'Lavage the middle lobe, where the return is best',
          rationale:
            'The middle lobe returns well, which suits diffuse disease. For a focal opacity it samples lung that is not involved.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'b',
          label: 'Lavage the left lower lobe and leave the label as it is',
          rationale:
            'The sample would come from the right lobe under another lobe’s name. The laboratory reports it against the lobe on the label.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'c',
          label: 'Move to the left lower lobe, wedge there, and have the trap relabelled',
          rationale:
            'A lavage samples the segment you wedge in. The disease is in the left lower lobe, so the saline goes there and the label says so.',
          plausibility: 'best',
        },
        {
          id: 'd',
          label: 'Start in the middle lobe, then use what saline is left on the left',
          rationale:
            'Saline in an uninvolved lobe costs her oxygen and leaves too little for the lobe that matters.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      explanation: `Choose the site from the CT, not by habit. Wedge in the involved segment, give ${num('bal-total-volume')} in ${num('bal-aliquots')} aliquots, and label the trap with the lobe you sampled.`,
      objectiveIds: ['M02-O4', 'M12-O2', 'M14-O2'],
      claimClass: 'synthesis',
      sourceRefs: [S2(55, 59), S1(119, 121), S2(155, 163), S1(118, 131)],
    },
  },
  {
    id: 'C04',
    presentationTitle: 'A quick look at a patient with stridor',
    situation:
      'A 45-year-old woman has stridor at rest that has worsened over 2 weeks. CT shows the trachea narrowed to 5 mm below the cords. SpO₂ is 93% on air, respiratory rate 26. You are asked for a quick look in the suite under moderate sedation.',
    critical: true,
    pairedSectionId: 'clinical-question',
    item: {
      id: 'C04',
      itemType: 'management-decision',
      stem: 'What do you do?',
      choices: [
        {
          id: 'a',
          label: 'Go ahead as requested, with the thin scope and light sedation',
          rationale:
            'Even a thin scope fills most of a lumen this narrow, and sedation takes away the effort that is keeping it open.',
          plausibility: 'unsafe',
        },
        {
          id: 'b',
          label: 'Move her to theatre, with anesthesia and a rigid bronchoscope ready',
          rationale:
            'A scope and sedation can close a critically narrowed trachea. Plan the airway first, in a room that can secure it.',
          plausibility: 'best',
        },
        {
          id: 'c',
          label: 'Book her onto the routine list for next week',
          rationale:
            'Stridor at rest is an airway that can close today. She cannot be left for a routine list.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label: 'Look in the suite with her awake, on topical lidocaine alone',
          rationale:
            'Leaving out the sedation helps. The scope can still obstruct her, and the suite cannot rescue the airway if it does.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      explanation:
        'Stridor at rest means little lumen is left. Decide where, and with whom, before you decide how to look: theatre, anesthesia, and rigid bronchoscopy to hand. The inspection is the smallest part of the plan.',
      objectiveIds: ['M01-O4', 'M02-O2', 'M01-O2'],
      claimClass: 'synthesis',
      sourceRefs: [S1(111), S1(115), S1(154, 158), S1(71, 83)],
      reviewItemIds: ['R41'],
    },
  },
  {
    id: 'C05',
    presentationTitle: 'Midway through a lavage under sedation',
    situation:
      'You are doing a lavage on a 59-year-old man under midazolam and fentanyl. Two of four aliquots are in. He no longer answers his name and breathes 7 times a minute. SpO₂ has fallen from 96% to 88% on 2 L/min.',
    critical: true,
    pairedSectionId: 'deterioration',
    item: {
      id: 'C05',
      itemType: 'management-decision',
      stem: 'What do you do?',
      choices: [
        {
          id: 'a',
          label: 'Take the scope out, open his airway and ventilate by bag and mask',
          rationale:
            'He is oversedated and barely breathing. The lavage ends here: remove the scope, breathe for him, then reverse the drugs.',
          plausibility: 'best',
        },
        {
          id: 'b',
          label: 'Finish the last two aliquots quickly, then reassess him',
          rationale:
            'More saline and more time take oxygen from a man who has almost stopped breathing.',
          plausibility: 'unsafe',
        },
        {
          id: 'c',
          label: 'Give no more saline, and keep suctioning to recover the fluid',
          rationale:
            'Suction takes gas from his lungs along with the fluid. What is left behind matters far less than his breathing.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label: 'Turn the oxygen up and watch the saturation',
          rationale:
            'Oxygen without breaths lifts the number for a while and leaves the carbon dioxide climbing.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      explanation: `Act at ${num('oxygen-trigger')}. Stop, say it, and look at him: he is not breathing enough. Scope out, airway open, bag and mask, then naloxone and flumazenil.`,
      objectiveIds: ['M15-O1', 'M04-O3', 'M12-O6', 'M15-O4'],
      claimClass: 'synthesis',
      sourceRefs: [
        S1(77, 79),
        S1(154, 158),
        { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
      ],
      reviewItemIds: ['R22'],
    },
  },
  {
    id: 'C06',
    presentationTitle: 'A red view after a transbronchial biopsy',
    situation:
      'After the third transbronchial biopsy in the right lower lobe of a 66-year-old man, the view turns red. Your tip is still wedged in the segment. SpO₂ is 95% on 2 L/min, heart rate 96. The nurse says, “Come back so we can see.”',
    critical: true,
    pairedSectionId: 'bleeding-priorities',
    item: {
      id: 'C06',
      itemType: 'management-decision',
      stem: 'What do you do?',
      choices: [
        {
          id: 'a',
          label: 'Keep the wedge and suction hard until the view clears',
          rationale:
            'Hard suction strips the clot and restarts the bleeding. A red view behind a wedge is expected.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'b',
          label: 'Pull the scope back to the carina to see how much there is',
          rationale: 'Pulling back lets the blood run into airways that were clear.',
          plausibility: 'unsafe',
        },
        {
          id: 'c',
          label: 'Keep the wedge and act only if the saturation falls',
          rationale:
            'The saturation falls late. Position and help are arranged while he is still stable.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label: 'Keep the wedge, suction gently, and turn him right side down',
          rationale:
            'The wedge keeps the blood in one segment while a clot forms. Right side down protects the left lung if any escapes.',
          plausibility: 'best',
        },
      ],
      explanation: `Stay in, suction what escapes, then cold saline, bleeding side down, oxygen, and help early. Grade it afterwards: grade 2 is ${num('nashville-grade-2')}.`,
      objectiveIds: ['M15-O2', 'M15-O5'],
      claimClass: 'synthesis',
      sourceRefs: [S1(138, 143), S2(27, 30)],
      reviewItemIds: ['R34'],
    },
  },
  {
    id: 'C07',
    presentationTitle: 'One pot for two studies',
    situation:
      'A 61-year-old woman has an endobronchial mass and night sweats. The request asks for histology and mycobacterial culture. One formalin pot is ready. Platelets are 180,000/µL. You have taken 2 biopsies, both into the formalin, and nothing is bleeding.',
    critical: false,
    pairedSectionId: 'biopsy-and-specimens',
    item: {
      id: 'C07',
      itemType: 'management-decision',
      stem: 'What do you do next?',
      choices: [
        {
          id: 'a',
          label: 'Send the two pieces for histology and for culture',
          rationale:
            'Fixed tissue cannot be cultured. The laboratory can report histology from that pot and nothing else.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'b',
          label: 'Get a sterile saline pot, then take more biopsies for both studies',
          rationale:
            'Formalin ends any culture, so tissue for culture goes into saline. Two bites are too few for histology in any case.',
          plausibility: 'best',
        },
        {
          id: 'c',
          label: 'Take three more into the formalin, and send washings for culture',
          rationale:
            'Washings can be cultured, and that helps. The request was for tissue, and a saline pot takes a minute to fetch.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'd',
          label: 'Leave it at two biopsies to keep the bleeding risk down',
          rationale:
            'Her count is normal and nothing is bleeding. Two bites often miss the diagnosis.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      explanation: `Set out every container before the first bite. A visible tumor needs ${num('endobronchial-biopsy-minimum')} biopsies. Culture needs tissue in sterile saline, never formalin.`,
      objectiveIds: ['M14-O3', 'M14-O1', 'M17-O2'],
      claimClass: 'source',
      sourceRefs: [S1(118), S1(120, 121), S1(130, 131), S1(149, 150), S2(155, 163)],
    },
  },
  {
    id: 'C09',
    presentationTitle: 'A bronchoscopy through an endotracheal tube',
    situation:
      'You are clearing secretions through the endotracheal tube of a man on volume control. The pressure limit was raised before you started, and no breath is cut short. Peak pressure keeps rising and the exhaled volume has fallen from 450 to 300 mL. SpO₂ is 97% on full oxygen.',
    critical: false,
    pairedSectionId: 'ventilated-patient',
    item: {
      id: 'C09',
      itemType: 'management-decision',
      stem: 'What is the next move?',
      choices: [
        {
          id: 'a',
          label: 'Stay in, and reassess if the saturation starts to fall',
          rationale:
            'On full oxygen the saturation falls late. The exhaled volume has already told you ventilation is failing.',
          plausibility: 'unsafe',
        },
        {
          id: 'b',
          label: 'Have the therapist raise the pressure limit again, then go on',
          rationale:
            'Raising the limit helps when the alarm ends breaths early. Here no breath is cut short, so the volume is being lost another way.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'c',
          label: 'Suction through the scope in one long pass to clear the tube',
          rationale:
            'Suction takes gas as well as secretions. With the volume already down, a long pass empties the lung further.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label: 'Take the scope out, let the patient breathe out, and watch the volume',
          rationale:
            'The scope is the first cause to remove. If the volume comes back, plan shorter passes. If not, check the tube and both sides of the chest.',
          plausibility: 'best',
        },
      ],
      explanation:
        'Set the ventilator first: raise the pressure limit so no breath ends early. If the delivered volume still falls, the limit is not the problem. Take the scope out and let him breathe out. A volume that does not return means the tube, a plugged lobe or a pneumothorax.',
      objectiveIds: ['M16-O1', 'M16-O2', 'M04-O3', 'M03-O5'],
      claimClass: 'synthesis',
      sourceRefs: [
        S1(155, 158),
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:16:23', end: '00:22:00' } },
        S1(77, 79),
      ],
      reviewItemIds: ['R31'],
    },
  },
  {
    id: 'C10',
    presentationTitle: 'A template report awaiting signature',
    situation:
      'You inspected a 68-year-old man through an endotracheal tube. A tumor narrowed the right lower lobe bronchus beyond RB6 and the scope would not pass. You took 5 biopsies; bleeding stopped after 2 minutes of suction and cold saline. The template reads “all segments normal”.',
    critical: true,
    pairedSectionId: 'describe-findings',
    item: {
      id: 'C10',
      itemType: 'management-decision',
      stem: 'What do you write?',
      choices: [
        {
          id: 'a',
          label: 'The tumor and the biopsies, with the survey lines deleted',
          rationale:
            'That drops the false lines and loses what the next reader needs: which airways were not examined, and the bleed.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'b',
          label: 'RB7 to RB10 as abnormal, as the tumor blocks the way to them',
          rationale:
            'Unseen is not abnormal. Write what you saw: the narrowing, and that you could not pass it.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'c',
          label: 'The template as it stands, with the tumor and biopsies added',
          rationale:
            'That signs for segments beyond a tumor you never passed, and for a larynx the tube hid from you.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label: 'RB7 to RB10 not reachable, larynx not seen, and the bleed graded',
          rationale:
            'A report says what was seen, what could not be, and what happened. The template claims a survey you did not do.',
          plausibility: 'best',
        },
      ],
      explanation: `Each airway is seen, not seen or not reachable, and the report says which. A bleed is graded by what stopped it. Grade 2 is ${num('nashville-grade-2')}.`,
      objectiveIds: ['M17-O2', 'M10-O2', 'M10-O4'],
      claimClass: 'synthesis',
      sourceRefs: [S2(161, 163), S1(61, 70), S2(103, 107)],
    },
  },
  {
    id: 'C16',
    presentationTitle: 'A culture from a quick sample',
    situation:
      'A ventilated 70-year-old man has a new infiltrate. A colleague suctioned the central airways, instilled 40 mL without wedging, recovered 15 mL and sent it as a lavage. You are shown the culture: Klebsiella at 10³ CFU/mL.',
    critical: false,
    pairedSectionId: 'washing-and-lavage',
    item: {
      id: 'C16',
      itemType: 'mechanism-interpretation',
      stem: 'How do you use the result?',
      choices: [
        {
          id: 'a',
          label: 'Treat it as a washing, and repeat a wedged lavage if it matters',
          rationale:
            'With no wedge and this little saline, the sample is airway washings. The lavage threshold does not apply to it.',
          plausibility: 'best',
        },
        {
          id: 'b',
          label: 'Read it against the lavage threshold, as below it',
          rationale:
            'The threshold belongs to a wedged lavage. This count comes from a different kind of sample.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'c',
          label: 'Start antibiotics for Klebsiella, as any growth counts',
          rationale:
            'Ventilated airways are colonized. Growth alone does not separate colonization from pneumonia.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label: 'Call it a tracheal aspirate afterwards and use that cutoff',
          rationale:
            'A new name after the fact does not make it that sample either. Describe how it was taken.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      explanation: `A lavage is wedged and uses ${num('bal-total-volume')}. The threshold of ${num('vap-bal-threshold')} applies to that sample only. Name a specimen by how it was taken.`,
      objectiveIds: ['M12-O5', 'M12-O6', 'M02-O1'],
      claimClass: 'synthesis',
      sourceRefs: [
        S1(119, 121),
        S2(55, 59),
        {
          sourceId: 'U7',
          location: {
            kind: 'section',
            label: 'contextual interpretation of quantitative cultures',
          },
        },
      ],
      reviewItemIds: ['R21', 'R22', 'R25'],
    },
  },
]
