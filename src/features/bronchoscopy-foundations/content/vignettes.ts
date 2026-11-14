import { num } from './numbers'
import type { BronchSectionId } from './sectionIds'
import type { AuthoredChoice } from './types'

/**
 * Vignettes with numbers (rewrite plan, practice and assessment). Forty short cases in the style
 * of an in-training examination: an age, a comorbidity, the vital signs, the laboratory values
 * that matter, and one decision. Eight topics, five cases each.
 *
 * A vignette tests only a number a section already teaches. The value in a rationale or an
 * explanation comes from the register through `num()`. The patient's own values (weight, counts,
 * volumes given) are written for the case and stay in its situation. A vignette marked `sums`
 * also works with amounts added up from its case, as the dose ledger does.
 *
 * Each vignette is paired to the section that teaches its idea, and takes that section's sources.
 */

export type VignetteTopic =
  | 'antithrombotics-and-platelets'
  | 'lidocaine-dose'
  | 'lavage-return'
  | 'methemoglobinemia'
  | 'pneumothorax-after-biopsy'
  | 'tube-and-scope'
  | 'massive-hemoptysis'
  | 'sedation-reversal'

export const VIGNETTE_TOPIC_TITLES: Readonly<Record<VignetteTopic, string>> = {
  'antithrombotics-and-platelets': 'Antithrombotics and platelets',
  'lidocaine-dose': 'Lidocaine by weight',
  'lavage-return': 'Lavage return and counts',
  methemoglobinemia: 'Methemoglobinemia',
  'pneumothorax-after-biopsy': 'Pneumothorax after biopsy',
  'tube-and-scope': 'The tube, the scope and the ventilator',
  'massive-hemoptysis': 'Massive hemoptysis',
  'sedation-reversal': 'Sedation and its reversal',
}

export interface Vignette {
  readonly id: string
  readonly topic: VignetteTopic
  readonly sectionId: BronchSectionId
  /** Names the situation, never the answer. No digits. */
  readonly presentationTitle: string
  readonly situation: string
  readonly stem: string
  readonly choices: readonly AuthoredChoice[]
  readonly explanation: string
  /** The case's own amounts are added up in its options and reasons. */
  readonly sums?: true
}

type Reasoned = readonly [label: string, rationale: string]

interface Draft {
  readonly id: string
  readonly sectionId: BronchSectionId
  readonly title: string
  readonly situation: string
  readonly stem?: string
  readonly key: Reasoned
  readonly others: readonly [Reasoned, Reasoned, Reasoned]
  readonly explanation: string
  readonly sums?: true
}

const CHOICE_IDS = ['a', 'b', 'c', 'd'] as const

/** The key takes a different place in each case, so its letter says nothing. */
function build(topic: VignetteTopic, drafts: readonly Draft[]): readonly Vignette[] {
  return drafts.map((draft, index) => {
    const keyAt = (index * 3 + topic.length) % CHOICE_IDS.length
    const others = [...draft.others]
    const ordered = CHOICE_IDS.map((_, position) =>
      position === keyAt ? draft.key : others.shift()!,
    )
    return {
      id: `vg-${draft.id}`,
      topic,
      sectionId: draft.sectionId,
      presentationTitle: draft.title,
      situation: draft.situation,
      stem: draft.stem ?? 'What do you do?',
      choices: ordered.map(([label, rationale], position) => ({
        id: CHOICE_IDS[position],
        label,
        rationale,
        plausibility: position === keyAt ? 'best' : 'incorrect-mechanism',
      })),
      explanation: draft.explanation,
      ...(draft.sums ? { sums: true as const } : {}),
    }
  })
}

const ANTITHROMBOTICS = build('antithrombotics-and-platelets', [
  {
    id: 'platelets-between',
    sectionId: 'clinical-question',
    title: 'A low count and two requests',
    situation:
      'A 63-year-old man with acute leukemia has fever and new infiltrates. SpO₂ is 94% on 2 L/min, heart rate 102, blood pressure 118/70. Platelets are 28,000/µL and INR is 1.1. The team asks for a lavage and a transbronchial biopsy.',
    key: [
      'Do the lavage and leave the biopsy out',
      'His count is above the lavage threshold and below the biopsy threshold. The lavage answers the infection question.',
    ],
    others: [
      [
        'Do both, with platelets running during the biopsy',
        'A transfusion in progress does not make the count safe at the moment you bite.',
      ],
      [
        'Cancel both until the count has recovered',
        'The lavage is safe at this count, and he needs the answer now.',
      ],
      [
        'Do the biopsy alone, as the test with the higher yield',
        'The biopsy is the one test his count rules out.',
      ],
    ],
    explanation: `A lavage needs ${num('platelets-bal')}. A biopsy needs ${num('platelets-biopsy')}. His count sits between the two, so the plan is the lavage alone.`,
  },
  {
    id: 'apixaban-this-morning',
    sectionId: 'clinical-question',
    title: 'A dose taken this morning',
    situation:
      'A 71-year-old woman has a right upper lobe mass with tumor visible in the bronchus on CT. She takes apixaban for atrial fibrillation and took it this morning. Kidney function is normal. SpO₂ is 96% on air. She is booked for biopsy today.',
    key: [
      'Rebook the biopsy and hold apixaban first',
      'This is an elective biopsy with a drug on board that no test will clear. Two days off it costs her little.',
    ],
    others: [
      [
        'Biopsy today if the INR is normal',
        'The INR does not measure apixaban. A normal value says nothing about her bleeding risk.',
      ],
      [
        'Biopsy today after a dose of vitamin K',
        'Vitamin K reverses warfarin. It has no effect on apixaban.',
      ],
      [
        'Hold apixaban for a week and bridge with heparin',
        'A week is longer than she needs, and bridging adds bleeding risk for no gain.',
      ],
    ],
    explanation: `Stop a direct oral anticoagulant ${num('noac-hold')} before a biopsy. No routine test confirms it has cleared, so the hold is the safeguard.`,
  },
  {
    id: 'stent-three-weeks',
    sectionId: 'clinical-question',
    title: 'A new stent and a nodule',
    situation:
      'A 58-year-old man had a drug-eluting coronary stent placed 3 weeks ago and takes aspirin and clopidogrel. A 2 cm peripheral nodule is unchanged over 4 months. Vital signs are normal. He is referred for transbronchial biopsy.',
    key: [
      'Postpone the biopsy while the stent still needs clopidogrel',
      'The nodule is stable and the stent is new. Stopping clopidogrel now risks stent thrombosis for a biopsy that can be timed later.',
    ],
    others: [
      [
        'Stop clopidogrel for five days, then biopsy',
        'That is the right hold for a biopsy, at a time his stent cannot take it.',
      ],
      [
        'Biopsy now on both drugs, with cold saline ready',
        'A transbronchial biopsy on clopidogrel bleeds more, and cold saline does not change that.',
      ],
      [
        'Stop both drugs today and biopsy next week',
        'Stopping both leaves a new stent with no cover at all.',
      ],
    ],
    explanation: `Clopidogrel is stopped ${num('p2y12-hold')} before a biopsy. Three weeks after a stent that hold is not safe, so the biopsy moves, not the drug.`,
  },
  {
    id: 'warfarin-two-days',
    sectionId: 'clinical-question',
    title: 'Two days off warfarin',
    situation:
      'A 66-year-old woman takes warfarin after a deep vein thrombosis and stopped it 2 days ago. Her INR this morning is 2.6. Platelets are 240,000/µL. An endobronchial tumor is to be biopsied today. Vital signs are normal.',
    key: [
      'Postpone the biopsy and recheck the INR before a new date',
      'Her INR is still well above the limit for a biopsy. Two days is too short for warfarin to wear off.',
    ],
    others: [
      [
        'Biopsy today, as two days off warfarin is enough',
        'The INR shows it is not enough. Go by the value, not the days.',
      ],
      [
        'Biopsy today with one pass to limit the bleeding',
        'One bite bleeds as freely as five when the blood does not clot.',
      ],
      [
        'Biopsy today and give plasma if it bleeds',
        'Treating the bleed afterwards accepts a risk that waiting removes.',
      ],
    ],
    explanation: `Stop warfarin ${num('warfarin-hold')} before a biopsy, and confirm an INR ${num('inr-before-biopsy')} on the day.`,
  },
  {
    id: 'cirrhosis-count',
    sectionId: 'clinical-question',
    title: 'Cirrhosis and a visible tumor',
    situation:
      'A 55-year-old man with cirrhosis has a tumor in the left main bronchus. Platelets are 44,000/µL and INR is 1.3. SpO₂ is 95% on air, heart rate 84, blood pressure 124/72. The biopsy is planned for this afternoon.',
    key: [
      'Raise the platelet count first, then biopsy',
      'His INR is acceptable and his platelets are not. Treat the one value that is short.',
    ],
    others: [
      [
        'Biopsy now, as the INR is under the limit',
        'The INR is one of two conditions. The platelet count is the one he fails.',
      ],
      [
        'Do a lavage and treat that as the tissue diagnosis',
        'A lavage is safe at this count, but it does not replace a biopsy of a tumor you can see.',
      ],
      [
        'Take a single small biopsy to keep the risk low',
        'The number of bites does not change what a low count does to the first one.',
      ],
    ],
    explanation: `A biopsy needs platelets of ${num('platelets-biopsy')} and an INR ${num('inr-before-biopsy')}. Check both, and treat whichever falls short.`,
  },
])

const LIDOCAINE = build('lidocaine-dose', [
  {
    id: 'how-much-is-left',
    sectionId: 'sedation-and-monitoring',
    title: 'How much is left',
    sums: true,
    situation:
      'A woman weighs 52 kg. So far she has had 100 mg of lidocaine as nasal gel, 30 mg as throat spray and 8 mL of 1% solution through the scope. She is coughing at the carina.',
    stem: 'How much more 1% solution can she have?',
    key: [
      'About 20 mL',
      'She has had 210 mg. Her limit is 416 mg, which leaves about 206 mg, or 20 mL of 1%.',
    ],
    others: [
      ['About 40 mL', 'That is her whole limit, with nothing taken off for what she has had.'],
      ['About 10 mL', 'That counts the 1% solution as 20 mg in each mL. It holds 10 mg.'],
      ['None', 'She has had 210 mg, about half of her limit.'],
    ],
    explanation: `The suggested upper limit is ${num('lidocaine-ceiling')}. Add every route, in milligrams, then take the total from the limit for her weight.`,
  },
  {
    id: 'one-more-syringe',
    sectionId: 'sedation-and-monitoring',
    title: 'One more syringe',
    sums: true,
    situation:
      'A man weighs 80 kg. He has had 120 mg of lidocaine as gel, 50 mg as spray, 20 mL of 1% and 10 mL of 2% through the scope. He coughs in the left lower lobe, and the operator asks for another 10 mL of 2%.',
    stem: 'What do you say?',
    key: [
      'No: 7 mL of 1% is all that is left',
      'He has had 570 mg of a 640 mg limit. Another 200 mg passes it. About 70 mg remains.',
    ],
    others: [
      ['Yes: he is under the limit', 'He is under it now. This syringe takes him over.'],
      ['Yes, but give it as 20 mL of 1%', 'That is the same 200 mg in a larger volume.'],
      ['No: he passed the limit already', 'He has had 570 mg. His limit is 640 mg.'],
    ],
    explanation: `At ${num('lidocaine-ceiling')} his limit is 640 mg. Keep the running total where the whole room can see it, and answer in milligrams.`,
  },
  {
    id: 'spray-nobody-wrote-down',
    sectionId: 'sedation-and-monitoring',
    title: 'A spray nobody wrote down',
    situation:
      'A 60 kg man has had 240 mg of lidocaine on the chart. The nurse also sprayed his throat before you arrived and did not record how many sprays. He needs more through the scope.',
    key: [
      'Find out what was sprayed and add it to the total',
      'An unknown amount is not nothing. The total is what protects him, so it has to be complete.',
    ],
    others: [
      [
        'Carry on: an unrecorded spray counts as zero',
        'It was given, so it is in him. Leaving it out is how a limit is passed unseen.',
      ],
      [
        'Carry on, and stop when he reports numb lips',
        'Symptoms come after the limit is passed. They are a late check, not the plan.',
      ],
      [
        'Give no more lidocaine for the rest of the procedure',
        'That is safe but more than is needed. He is well under his limit on what is charted.',
      ],
    ],
    explanation: `Every route counts toward ${num('lidocaine-ceiling')}: gel, spray and solution. One person keeps the total, and nothing is given that is not counted.`,
  },
  {
    id: 'nebulizer-first',
    sectionId: 'sedation-and-monitoring',
    title: 'A nebulizer before the scope',
    situation:
      'An 82-year-old woman weighs 45 kg. The operator plans 5 mL of 4% lidocaine by nebulizer before the usual gel, spray and solution. SpO₂ is 95% on air, heart rate 76, blood pressure 138/74.',
    key: [
      'Leave the nebulizer out and use spray-as-you-go',
      'The nebulizer adds a large dose with little benefit, and she is small. Lidocaine placed where the scope is works with less.',
    ],
    others: [
      [
        'Give the nebulizer and halve the later doses',
        'The nebulized dose alone is over half her limit, and much of it never reaches the airway.',
      ],
      [
        'Give the nebulizer at double strength to save time',
        'That doubles a dose that is already too large for her weight.',
      ],
      [
        'Give no topical anesthesia and rely on sedation',
        'Sedation does not stop the cough. She would need more of it, at an age when less is safer.',
      ],
    ],
    explanation: `Nebulized lidocaine is ${num('nebulized-lidocaine')}. Use ${num('lidocaine-spray-concentration')} solution through the scope and stay under ${num('lidocaine-ceiling')}.`,
  },
  {
    id: 'which-strength',
    sectionId: 'sedation-and-monitoring',
    title: 'Two bottles on the trolley',
    sums: true,
    situation:
      'A 70 kg man is having a long inspection with lavage. He has had 100 mg of lidocaine as gel. You expect to use about 25 mL of solution through the scope. Bottles of 1% and 2% are on the trolley.',
    stem: 'Which do you draw up?',
    key: [
      'The 1% solution',
      'At 1% the solution adds 250 mg, for 350 mg in all. That is 5 mg/kg, with room to spare.',
    ],
    others: [
      [
        'The 2% solution',
        'At 2% the solution adds 500 mg, for 600 mg in all. That is over his 560 mg limit.',
      ],
      [
        'The 2% solution, in half the volume',
        'Half the volume does not cover the airway. You would end up giving the rest.',
      ],
      [
        'Either: the limit is set by volume',
        'The limit is in milligrams for his weight. The strength decides how fast you reach it.',
      ],
    ],
    explanation: `Use ${num('lidocaine-spray-concentration')} for spray-as-you-go. It covers the airway at half the dose of the stronger solution, and keeps a long procedure under ${num('lidocaine-ceiling')}.`,
  },
])

const LAVAGE = build('lavage-return', [
  {
    id: 'a-third-back',
    sectionId: 'washing-and-lavage',
    title: 'Three aliquots in',
    situation:
      'A 47-year-old woman with suspected hypersensitivity pneumonitis is having a lavage of the middle lobe. Three 50 mL aliquots went in. The returns were 12, 18 and 22 mL. SpO₂ is 93% on 3 L/min and she is coughing more.',
    key: [
      'Finish here and send the pooled sample',
      'She has returned over a third of what went in. That is a good sample, and she is tiring.',
    ],
    others: [
      [
        'Instil two more aliquots to raise the yield',
        'The sample is already adequate. More saline costs her oxygen for nothing.',
      ],
      [
        'Discard the first return and send the rest',
        'The first return is part of the pooled sample here. Discarding it leaves less to count.',
      ],
      [
        'Repeat the lavage in the lingula for comparison',
        'One good sample from the chosen lobe answers the question.',
      ],
    ],
    explanation: `An optimal return is ${num('bal-return-optimal')} of what went in. The usual total is ${num('bal-total-volume')} in ${num('bal-aliquots')} aliquots.`,
  },
  {
    id: 'almost-nothing-back',
    sectionId: 'washing-and-lavage',
    title: 'Almost nothing comes back',
    situation:
      'A 69-year-old man with severe emphysema is having a lavage of the right upper lobe. The first 50 mL aliquot returned 2 mL and the second returned 2 mL. SpO₂ has fallen from 94% to 90% on 4 L/min.',
    key: [
      'End the lavage now',
      'Each aliquot has returned under the minimum. The saline is staying in his lung, and his oxygen is falling.',
    ],
    others: [
      [
        'Instil a third aliquot and suction harder',
        'More saline adds to what is trapped, and harder suction collapses the airway on the scope.',
      ],
      [
        'Wedge deeper and instil a larger aliquot',
        'A deeper wedge in emphysema does not open collapsed airways. A larger volume stays behind too.',
      ],
      [
        'Wait five minutes for the fluid to drain back',
        'Fluid does not drain back up a floppy airway. Waiting keeps the scope in for nothing.',
      ],
    ],
    explanation: `Abort the lavage when the return is ${num('bal-abort-rule')}. In emphysema the airways collapse under suction and the fluid stays behind.`,
  },
  {
    id: 'many-epithelial-cells',
    sectionId: 'washing-and-lavage',
    title: 'A differential with a flag',
    situation:
      'A 54-year-old woman had a lavage for interstitial lung disease. The laboratory reports 12 mL pooled, with lymphocytes 31% and bronchial epithelial cells 14%.',
    stem: 'How do you read the differential?',
    key: [
      'As unreliable, and say so in the report',
      'This many epithelial cells means the sample came from the bronchi, not the alveoli. The lymphocyte count cannot be trusted.',
    ],
    others: [
      [
        'As a lymphocytic lavage that supports the diagnosis',
        'It would be, from an alveolar sample. The epithelial cells say this is not one.',
      ],
      [
        'As normal, with the epithelial cells left out',
        'Leaving them out does not make the rest alveolar.',
      ],
      [
        'As inadequate for want of volume',
        'The volume is enough to count. The problem is where the cells came from.',
      ],
    ],
    explanation: `Epithelial cells ${num('bal-epithelial-flag')} flag a sample from the bronchi. Cell analysis needs ${num('bal-cell-analysis-volume')} pooled, and at least ${num('bal-cell-analysis-minimum')}.`,
  },
  {
    id: 'suction-at-the-wall',
    sectionId: 'washing-and-lavage',
    title: 'The airway closes on the scope',
    situation:
      'During a lavage in a 61-year-old man, the airway walls close around the tip each time you aspirate, and little comes back. The wall suction reads 300 mmHg. SpO₂ is 95% on 2 L/min.',
    key: [
      'Turn the suction down and aspirate gently',
      'At this pressure the airway collapses before the fluid can reach the channel. Lower suction lets it stay open.',
    ],
    others: [
      [
        'Keep the suction and wedge more firmly',
        'A firmer wedge with the same suction collapses the same airway.',
      ],
      [
        'Instil more saline to push the airway open',
        'More saline adds volume that the same suction still cannot recover.',
      ],
      [
        'Move to another lobe and start again',
        'The cause is the suction setting, and it goes with you to the next lobe.',
      ],
    ],
    explanation: `Keep suction ${num('bal-suction-ceiling')} during a lavage. Gentle, intermittent suction, or a hand-held syringe, keeps the airway open.`,
  },
  {
    id: 'count-below-the-line',
    sectionId: 'washing-and-lavage',
    title: 'A culture with a count',
    situation:
      'A 72-year-old man has been ventilated for 9 days with a new infiltrate and fever. His antibiotics have not changed in 4 days. The lavage culture grows Pseudomonas at 10³ CFU/mL.',
    stem: 'How do you read the culture?',
    key: [
      'As below the threshold for pneumonia',
      'The count is tenfold under the threshold. Look for another source of the fever before treating this as pneumonia.',
    ],
    others: [
      [
        'As pneumonia: any growth of Pseudomonas counts',
        'Ventilated airways are colonized. The count is what separates colonization from infection.',
      ],
      [
        'As contamination, to be ignored',
        'It is a real organism in his airway. It is not yet evidence of pneumonia.',
      ],
      [
        'As uninterpretable without a repeat lavage',
        'The sample is valid and the count is clear. A repeat would not change how to read it.',
      ],
    ],
    explanation: `The threshold for suspected pneumonia on a quantitative lavage culture is ${num('vap-bal-threshold')}. A recent change of antibiotics lowers counts; his have been stable.`,
  },
])

const METHEMOGLOBIN = build('methemoglobinemia', [
  {
    id: 'two-saturations',
    sectionId: 'deterioration',
    title: 'Two saturations that disagree',
    situation:
      'A 34-year-old woman had benzocaine spray. The oximeter reads 86% and does not change on a non-rebreather mask. An arterial sample shows a PaO₂ of 280 mmHg and a calculated saturation of 99%. She is alert, with a heart rate of 96.',
    key: [
      'Send the sample for co-oximetry',
      'A high PaO₂ with a low oximeter reading is the gap that methemoglobin makes. Co-oximetry measures it.',
    ],
    others: [
      [
        'Trust the blood gas and resite the probe',
        'The calculated value assumes normal hemoglobin. The oximeter is the one showing the problem.',
      ],
      [
        'Intubate her for hypoxemia that does not respond',
        'Her lungs are loading oxygen well. The hemoglobin cannot carry it, and a tube does not fix that.',
      ],
      ['Get a CT for pulmonary embolism', 'An embolism lowers the PaO₂. Hers is very high.'],
    ],
    explanation: `In methemoglobinemia the oximeter settles at ${num('methb-oximeter-plateau')} whatever the oxygen. The blood gas looks normal, and only co-oximetry gives the level.`,
  },
  {
    id: 'level-and-symptoms',
    sectionId: 'deterioration',
    title: 'A level, and symptoms',
    situation:
      'A 58-year-old man is breathless with a headache 20 minutes after benzocaine spray. SpO₂ reads 84% on high-flow oxygen, heart rate 124, blood pressure 104/60. Co-oximetry shows a methemoglobin level of 34%.',
    key: [
      'Give methylene blue',
      'He has symptoms and a level well above the point to treat. Methylene blue converts methemoglobin back.',
    ],
    others: [
      [
        'Keep him on oxygen until the level falls',
        'Oxygen is right and not enough. At this level with symptoms he needs the antidote.',
      ],
      [
        'Give naloxone and flumazenil',
        'His breathing is not depressed. Reversal treats a problem he does not have.',
      ],
      [
        'Transfuse red cells to carry more oxygen',
        'His own hemoglobin is there. It needs converting back, not adding to.',
      ],
    ],
    explanation: `Treat a patient with symptoms at a level of ${num('methb-treat-symptomatic')}, and one without symptoms at ${num('methb-treat-asymptomatic')}. The treatment is methylene blue.`,
  },
  {
    id: 'level-without-symptoms',
    sectionId: 'deterioration',
    title: 'A level, and no symptoms',
    situation:
      'A 41-year-old woman looks dusky after benzocaine spray. She feels well. SpO₂ reads 89% on 2 L/min, heart rate 82, blood pressure 122/74. Co-oximetry shows a methemoglobin level of 12%.',
    key: [
      'Give oxygen, stop the benzocaine and watch her',
      'She has no symptoms and her level is under the point to treat. It falls without an antidote once the drug is no longer given.',
    ],
    others: [
      [
        'Give methylene blue',
        'At this level without symptoms the antidote adds risk and no benefit.',
      ],
      [
        'Send her home this evening, as she feels well',
        'The level can still rise after the last spray. She is watched until it is falling.',
      ],
      [
        'Repeat the spray with half the amount',
        'The same drug that caused it will raise the level again.',
      ],
    ],
    explanation: `Without symptoms, treat at ${num('methb-treat-asymptomatic')}. Below that, oxygen and observation are enough, with a repeat level to show it is falling.`,
  },
  {
    id: 'sedated-and-blue',
    sectionId: 'deterioration',
    title: 'Blue, and barely breathing',
    situation:
      'A 67-year-old man had benzocaine spray, then midazolam and fentanyl. He is hard to rouse. He breathes 6 times a minute, the capnography trace is small and slow, and SpO₂ is 85% on 4 L/min.',
    key: [
      'Open the airway and ventilate him by bag and mask',
      'He is hypoventilating. That explains the saturation, and it kills faster than methemoglobin. Breathe for him first.',
    ],
    others: [
      [
        'Send co-oximetry and wait for the result',
        'It may be worth sending. It cannot come before breaths for a man who is barely taking any.',
      ],
      [
        'Give methylene blue for the benzocaine',
        'Nothing shows methemoglobin yet, and the antidote does not make him breathe.',
      ],
      [
        'Turn the nasal oxygen up to its maximum',
        'More oxygen at the nose does little when almost no air is moving.',
      ],
    ],
    explanation: `A saturation near ${num('methb-oximeter-plateau')} after benzocaine is methemoglobin only when the patient is breathing well. Slow breaths and a small trace mean sedation.`,
  },
  {
    id: 'it-happened-before',
    sectionId: 'deterioration',
    title: 'It happened last time',
    situation:
      'A 49-year-old woman is booked for bronchoscopy. Her notes record methemoglobinemia after throat spray at an endoscopy last year. The suite stocks benzocaine spray and lidocaine.',
    key: [
      'Use lidocaine for every topical step',
      'Benzocaine is the usual cause, and she has reacted before. Lidocaine does the same job without it.',
    ],
    others: [
      [
        'Use benzocaine in a single short spray',
        'A reaction does not need a large dose in someone who has had one.',
      ],
      [
        'Use benzocaine with methylene blue drawn up',
        'Having the antidote ready does not justify causing the problem.',
      ],
      [
        'Use no topical anesthesia and deepen the sedation',
        'Deeper sedation brings its own risk, and lidocaine is available.',
      ],
    ],
    explanation: `Methemoglobinemia follows benzocaine far more often than lidocaine. Ask about earlier reactions before any spray, and expect the oximeter to settle at ${num('methb-oximeter-plateau')} if it happens.`,
  },
])

const PNEUMOTHORAX = build('pneumothorax-after-biopsy', [
  {
    id: 'no-symptoms-no-film',
    sectionId: 'biopsy-and-specimens',
    title: 'Well after the biopsies',
    situation:
      'A 59-year-old man is 90 minutes after four transbronchial biopsies. He has no chest pain and is not breathless. SpO₂ is 96% on air, heart rate 78, blood pressure 126/76. The recovery nurse asks about a chest radiograph before he goes.',
    key: [
      'Send him home without a film, with advice',
      'He has no symptoms and normal observations. A routine film adds radiation and delay and rarely changes anything.',
    ],
    others: [
      [
        'Get a film on every patient after this biopsy',
        'A film is for symptoms or suspicion. Without either it is not needed.',
      ],
      [
        'Get a CT, the more sensitive test',
        'A CT finds small pneumothoraces that need nothing, at a much higher dose.',
      ],
      [
        'Keep him overnight for observation',
        'A pneumothorax that matters shows itself in the first hours, and he knows when to return.',
      ],
    ],
    explanation: `A chest radiograph after transbronchial biopsy is taken ${num('cxr-after-tblb')}. Tell him what to watch for: chest pain, breathlessness, a new cough.`,
  },
  {
    id: 'pain-an-hour-later',
    sectionId: 'deterioration',
    title: 'Pain an hour later',
    situation:
      'A 64-year-old woman is an hour after transbronchial biopsy of the left lower lobe. She has sharp left chest pain on breathing in. SpO₂ is 92% on 2 L/min, down from 97%. Heart rate is 96 and blood pressure 128/78.',
    key: [
      'Examine her and get a chest radiograph now',
      'New pleuritic pain and a falling saturation after this biopsy is a pneumothorax until shown otherwise. Her pressure allows time to confirm it.',
    ],
    others: [
      [
        'Decompress the left chest with a needle',
        'A needle is for tension. Her pressure and heart rate are holding.',
      ],
      [
        'Give an opioid and recheck her in an hour',
        'That quiets the sign and slows her breathing. A pneumothorax grows in an hour.',
      ],
      [
        'Send her home with advice, as the pain is expected',
        'Pain after biopsy is not expected. With a falling saturation she is not safe to leave.',
      ],
    ],
    explanation: `This is when a film is taken: ${num('cxr-after-tblb')}. A falling pressure with a rising heart rate would change the order to decompression first.`,
  },
  {
    id: 'the-phone-call',
    sectionId: 'deterioration',
    title: 'A call that evening',
    situation:
      'A 70-year-old man went home well after transbronchial biopsies this morning. At 8 pm his wife telephones: he is suddenly breathless, with pain in his right chest, and looks gray.',
    stem: 'What do you tell her?',
    key: [
      'Call an ambulance now and come to the emergency department',
      'A late pneumothorax can be large. He needs oxygen and a chest examination within minutes, not a car journey.',
    ],
    others: [
      [
        'Give him a painkiller and call back if it worsens',
        'He is breathless and gray now. There is no margin for a second call.',
      ],
      [
        'Bring him to the bronchoscopy clinic in the morning',
        'A pneumothorax that makes him gray cannot wait for the morning.',
      ],
      [
        'Have him lie on the right side and rest',
        'Position does nothing for air in the pleural space.',
      ],
    ],
    explanation: `A pneumothorax can appear hours after the biopsy. That is why the discharge advice names the symptoms, and why a film is taken ${num('cxr-after-tblb')}.`,
  },
  {
    id: 'both-lungs-today',
    sectionId: 'biopsy-and-specimens',
    title: 'Both lungs in one sitting',
    situation:
      'A 52-year-old woman has diffuse infiltrates in both lungs. The operator has taken four transbronchial biopsies from the right lower lobe and proposes four more from the left lower lobe. SpO₂ is 94% on 2 L/min.',
    key: [
      'Take all the biopsies from one lung today',
      'A pneumothorax on both sides at once can kill. One lung gives the tissue; the other stays untouched.',
    ],
    others: [
      [
        'Biopsy the left lung too, with fewer bites',
        'Fewer bites lowers the risk on that side. It does not remove the risk of two pneumothoraces.',
      ],
      [
        'Biopsy the left lung too, under fluoroscopy',
        'Fluoroscopy shows where the forceps are. It does not stop the pleura tearing.',
      ],
      [
        'Biopsy the left lung too, then get a film',
        'A film finds a pneumothorax on both sides. It does not make it survivable.',
      ],
    ],
    explanation: `Biopsy one lung in a sitting. Afterwards a film is taken ${num('cxr-after-tblb')}, and she goes home knowing which symptoms bring her back.`,
  },
  {
    id: 'pain-when-the-forceps-open',
    sectionId: 'biopsy-and-specimens',
    title: 'Pain as the forceps open',
    situation:
      'You are taking a transbronchial biopsy of the right lower lobe under fluoroscopy in a 61-year-old man. The forceps are far out. As they open he winces and says his chest hurts sharply.',
    key: [
      'Close the forceps and draw them back before you bite',
      'The lung has no pain fibers and the pleura does. Pain means the forceps are at the pleura.',
    ],
    others: [
      [
        'Take the biopsy quickly and come out',
        'A bite at the pleura is how a pneumothorax is made.',
      ],
      [
        'Ask for more fentanyl, then take the biopsy',
        'The pain is the warning. Removing it removes your only signal.',
      ],
      [
        'Push the forceps on until they stop, then bite',
        'They stop at the pleura. That is the place not to bite.',
      ],
    ],
    explanation: `Pain as the forceps open means pleura: withdraw a little and try again. Afterwards a film is taken ${num('cxr-after-tblb')}.`,
  },
])

const TUBE_AND_SCOPE = build('tube-and-scope', [
  {
    id: 'two-scopes-small-tube',
    sectionId: 'ventilated-patient',
    title: 'Two scopes and a small tube',
    situation:
      'A 48-year-old woman is ventilated through a 6.5 mm tube and has a plugged left lower lobe. The cart holds the therapeutic scope (5.8 mm) and the diagnostic scope (4.9 mm). The thin scope (4.2 mm) is in the next unit.',
    key: [
      'Send for the thin scope',
      'Only the thin scope leaves the margin in this tube. Its channel is still wide enough to suction through.',
    ],
    others: [
      [
        'Use the diagnostic scope: it passes easily',
        'Passing is not ventilating. It leaves too little room for her breaths.',
      ],
      [
        'Use the therapeutic scope for its larger channel',
        'It suctions best and leaves almost no tube to breathe through.',
      ],
      [
        'Change her to a larger tube first',
        'A tube change in a ventilated patient is a risk in itself, and a scope that fits is nearby.',
      ],
    ],
    explanation: `The tube should be ${num('tube-scope-margin')} wider than the scope, and the working channel ${num('working-channel-minimum')} to suction.`,
  },
  {
    id: 'oxygen-before-the-scope',
    sectionId: 'ventilated-patient',
    title: 'Ready to start',
    situation:
      'A 66-year-old man is ventilated on an FiO₂ of 0.4 with a PEEP of 8. SpO₂ is 93%, heart rate 88, blood pressure 122/68. The scope and the adapter are ready and the therapist is at the bedside.',
    key: [
      'Raise the FiO₂ to full and wait before you go in',
      'He starts with little reserve. Full oxygen for some minutes first gives him the store he will spend with the scope in.',
    ],
    others: [
      [
        'Go in now and raise the oxygen if he desaturates',
        'By then the reserve you needed is already spent.',
      ],
      [
        'Raise the PEEP instead of the oxygen',
        'The scope adds its own PEEP. More on top risks trapped gas, and does not build a reserve.',
      ],
      [
        'Take him off the ventilator and bag him by hand',
        'He loses his PEEP and his set breaths. The adapter exists so he keeps both.',
      ],
    ],
    explanation: `Set the FiO₂ to ${num('vent-fio2')}, starting ${num('vent-fio2-lead-time')} before the procedure. Return it to baseline afterwards.`,
  },
  {
    id: 'smaller-breaths',
    sectionId: 'ventilated-patient',
    title: 'Smaller breaths with the limit raised',
    situation:
      'A 59-year-old man on volume control has the diagnostic scope in an 8.0 mm tube. The pressure limit was raised and no breath is cut short. Delivered volume is 330 of a set 450 mL. Plateau pressure is unchanged and SpO₂ is 97%.',
    key: [
      'Have the tidal volume raised',
      'The scope is costing him volume and the lung has not changed. Raising the set volume makes up what is lost.',
    ],
    others: [
      [
        'Have the pressure limit raised again',
        'No breath is being ended early, so the limit is not what is costing him volume.',
      ],
      [
        'Go on: the saturation is normal',
        'On full oxygen the saturation falls late. The volume is the earlier warning.',
      ],
      [
        'Have the respiratory rate raised',
        'A faster rate shortens the time to breathe out through a crowded tube, and traps gas.',
      ],
    ],
    explanation: `Raise the tidal volume by ${num('vent-tidal-volume-increase')} during the procedure. If the delivered volume still falls, take the scope out.`,
  },
  {
    id: 'thick-plug-thin-channel',
    sectionId: 'ventilated-patient',
    title: 'A plug that will not move',
    situation:
      'A 73-year-old woman has a thick mucus plug in the right lower lobe. She is ventilated through an 8.0 mm tube. You are using a slim scope with a 1.2 mm channel, and nothing comes up it.',
    key: [
      'Change to a scope with a wider channel',
      'A channel this narrow cannot draw thick mucus. Her tube takes a larger scope with room to spare.',
    ],
    others: [
      [
        'Keep the scope and turn the wall suction to maximum',
        'More suction through a channel that small draws gas from her lungs, not mucus.',
      ],
      [
        'Keep the scope and instil saline until it loosens',
        'Saline you cannot suction back adds to what blocks the lobe.',
      ],
      [
        'Leave the plug and increase her PEEP',
        'Pressure does not move a plug. The lobe stays collapsed behind it.',
      ],
    ],
    explanation: `To suction in a ventilated patient the working channel should be ${num('working-channel-minimum')}. Choose the largest scope that still leaves ${num('tube-scope-margin')} in the tube.`,
  },
  {
    id: 'no-reserve',
    sectionId: 'ventilated-patient',
    title: 'An elective look',
    situation:
      'A 51-year-old man with severe ARDS is on an FiO₂ of 0.9 and a PEEP of 14. SpO₂ is 88% and blood pressure 96/54 on norepinephrine. The team asks for a bronchoscopy to look for a cause. He has no plugging on imaging.',
    key: [
      'Defer the bronchoscopy until he needs less support',
      'He has no reserve to spend, and nothing on imaging that a scope would fix today.',
    ],
    others: [
      [
        'Go ahead with the thin scope and a short look',
        'Even a thin scope costs him PEEP and volume he cannot spare.',
      ],
      [
        'Go ahead after raising the FiO₂ to full',
        'He is nearly there already. There is no further reserve to add.',
      ],
      [
        'Go ahead with the circuit open to save time',
        'Opening the circuit drops his PEEP at once, in the patient least able to lose it.',
      ],
    ],
    explanation: `The settings buy a margin: FiO₂ ${num('vent-fio2')} for ${num('vent-fio2-lead-time')} beforehand. A patient already near those limits has no margin, and an elective look waits.`,
  },
])

const HEMOPTYSIS = build('massive-hemoptysis', [
  {
    id: 'which-side-down',
    sectionId: 'bleeding-priorities',
    title: 'A cavity and a basin of blood',
    situation:
      'A 62-year-old man with a right upper lobe cavity has coughed up about 300 mL of blood in an hour. SpO₂ is 88% on 6 L/min, heart rate 118, blood pressure 132/80. He is sitting upright on the ward.',
    key: [
      'Turn him right side down and get help for the airway',
      'The source is on the right. Right side down keeps the blood there and the left lung working.',
    ],
    others: [
      [
        'Turn him left side down to drain the right lung',
        'That drains blood into the lung he is living on.',
      ],
      [
        'Keep him upright and give tranexamic acid',
        'Upright, the blood runs into both lungs. A drug does not protect the airway.',
      ],
      [
        'Send him for a CT angiogram to find the vessel',
        'He may need it, after his airway is safe. He cannot lie in a scanner like this.',
      ],
    ],
    explanation: `Bleeding side down, oxygen, and help early. Grade 1 on the Nashville scale is ${num('nashville-grade-1')}. This bleed is far past that, so plan for the airway now.`,
  },
  {
    id: 'drowning-side-unknown',
    sectionId: 'bleeding-priorities',
    title: 'No time to find the side',
    situation:
      'A 55-year-old woman is coughing up blood faster than she can clear it. SpO₂ is 82% on a non-rebreather mask, heart rate 132, blood pressure 108/64. Nobody knows which lung is bleeding.',
    key: [
      'Intubate with a large tube, then find the side',
      'She is drowning. A large tube secures the airway and lets a scope with a real suction channel through.',
    ],
    others: [
      [
        'Bronchoscope her awake to find the side first',
        'An awake scope in a patient who cannot clear blood shows nothing and protects nothing.',
      ],
      [
        'Intubate with a small tube to reduce trauma',
        'A small tube admits only a scope that cannot suction this much blood.',
      ],
      [
        'Send her to interventional radiology now',
        'Embolization treats the vessel. She will not survive the journey with this airway.',
      ],
    ],
    explanation: `Airway first, then the side, then the source. The tube must be ${num('tube-scope-margin')} wider than a scope that can suction.`,
  },
  {
    id: 'a-nebulizer-instead',
    sectionId: 'bleeding-priorities',
    title: 'A suggestion from a colleague',
    situation:
      'A 68-year-old man with bronchiectasis has coughed up 250 mL of blood and is still bleeding. SpO₂ is 89% on 8 L/min. A colleague suggests nebulized tranexamic acid and reassessment in an hour.',
    key: [
      'Protect the airway first, and add tranexamic acid',
      'The trial that supports it left out massive bleeding. It can be added, and it cannot replace control of the airway.',
    ],
    others: [
      [
        'Give the nebulizer and reassess in an hour',
        'An hour is long enough to drown. The evidence is for smaller bleeds.',
      ],
      [
        'Give it intravenously in place of the nebulizer',
        'The route is not the problem. No drug does the job of airway control.',
      ],
      [
        'Give no tranexamic acid, as it is unproven',
        'It has some evidence and little harm. Leaving it out is not the important decision here.',
      ],
    ],
    explanation:
      'Tranexamic acid reduced bleeding in one small trial of non-massive hemoptysis. In a massive bleed, position, the airway and help come first, and the drug is added to them.',
  },
  {
    id: 'which-bronchus',
    sectionId: 'bleeding-priorities',
    title: 'Blood from the left',
    situation:
      'A 60-year-old man is intubated for massive hemoptysis. Through the tube you see blood welling from the left main bronchus. The right side is clear for now. SpO₂ is 86% on full oxygen.',
    key: [
      'Advance the tube into the right main bronchus over the scope',
      'A tube in the right main ventilates the good lung and shuts the blood out of it.',
    ],
    others: [
      [
        'Advance the tube into the left main bronchus',
        'That ventilates the bleeding lung and leaves the good one to fill.',
      ],
      [
        'Leave the tube in the trachea and suction',
        'A tracheal tube ventilates both lungs and protects neither.',
      ],
      [
        'Pull the tube back to the cords for a wider view',
        'That gives up the airway you have, for a view you do not need.',
      ],
    ],
    explanation: `Selective intubation of the non-bleeding lung is the next step when position and suction fail. Grade 3 on the Nashville scale is ${num('nashville-grade-3')}.`,
  },
  {
    id: 'after-control',
    sectionId: 'bleeding-priorities',
    title: 'Controlled, for now',
    situation:
      'A 57-year-old woman with massive hemoptysis has a blocker in the right upper lobe bronchus. The bleeding is held, and she is ventilated with an SpO₂ of 95%. CT angiography shows an enlarged right bronchial artery.',
    stem: 'What is the next step?',
    key: [
      'Arrange embolization with the blocker in place',
      'The blocker holds the bleeding and does not treat it. Embolization closes the vessel that is feeding it.',
    ],
    others: [
      [
        'Deflate the blocker to see whether it has stopped',
        'The vessel is still open. Deflating it now restarts the bleed.',
      ],
      [
        'Leave the blocker inflated for three days',
        'Long inflation injures the bronchus, and the artery is untouched.',
      ],
      [
        'Extubate her now that the saturation is normal',
        'Her airway is safe only while the lobe is isolated.',
      ],
    ],
    explanation: `Escalation ends at the source: a blocker, selective intubation, rigid bronchoscopy, then embolization. Grade 4 is ${num('nashville-grade-4')}.`,
  },
])

const REVERSAL = build('sedation-reversal', [
  {
    id: 'awake-and-ready-to-go',
    sectionId: 'sedation-and-monitoring',
    title: 'Awake after flumazenil',
    situation:
      'A 74-year-old woman was oversedated with midazolam and woke after flumazenil. Thirty minutes later she is talking, with an SpO₂ of 96% on air. The unit is busy and her daughter is waiting to drive her home.',
    key: [
      'Keep her monitored before she leaves',
      'Flumazenil wears off before midazolam does. She can become sedated again after she looks well.',
    ],
    others: [
      [
        'Let her go, as she is awake and saturating well',
        'How she looks now reflects the flumazenil. The midazolam is still there.',
      ],
      [
        'Give a second dose of flumazenil, then let her go',
        'A second dose also wears off, at home, with nobody watching.',
      ],
      [
        'Let her go with a pulse oximeter',
        'A reading at home does not ventilate her if she stops breathing.',
      ],
    ],
    explanation: `After the last dose of a reversal agent, monitor for ${num('reversal-discharge-wait')} before discharge. Nobody drives or signs anything for ${num('post-sedation-restriction')}.`,
  },
  {
    id: 'daily-alprazolam',
    sectionId: 'sedation-and-monitoring',
    title: 'A daily benzodiazepine',
    situation:
      'A 63-year-old man takes alprazolam three times a day. After midazolam he is drowsy but rouses to voice. He breathes 12 times a minute, with an SpO₂ of 95% on 2 L/min.',
    key: [
      'Stimulate him and watch; hold the flumazenil',
      'He is breathing adequately. In a patient who takes a benzodiazepine every day, flumazenil can bring on withdrawal and seizures.',
    ],
    others: [
      [
        'Give flumazenil to wake him fully',
        'He does not need it to breathe, and for him it carries a risk of seizures.',
      ],
      [
        'Give naloxone in case an opioid is the cause',
        'He has had no opioid, and his breathing rate is normal.',
      ],
      [
        'Give more midazolam to finish the procedure',
        'He is already drowsier than intended. More takes away the response to voice.',
      ],
    ],
    explanation: `The first dose of flumazenil is ${num('flumazenil-first-dose')}, for breathing that fails after a benzodiazepine. In a dependent patient it can cause withdrawal, so support comes first.`,
  },
  {
    id: 'pinpoint-pupils',
    sectionId: 'sedation-and-monitoring',
    title: 'Slow breaths and small pupils',
    situation:
      'A 70-year-old woman had 150 mcg of fentanyl and 1 mg of midazolam. She does not rouse and breathes 5 times a minute. Her pupils are pinpoint. SpO₂ is 86% on 4 L/min.',
    key: [
      'Ventilate her, then give naloxone in small repeated doses',
      'Breaths come first. The opioid is the larger dose and the picture fits it, so naloxone is the reversal.',
    ],
    others: [
      [
        'Give flumazenil first for the midazolam',
        'The midazolam dose was small. Flumazenil does nothing for an opioid.',
      ],
      [
        'Give one large dose of naloxone to be sure',
        'A large dose wakes her in pain with a racing heart. Titrate it to her breathing.',
      ],
      [
        'Turn the oxygen up and wait for it to wear off',
        'Oxygen without breaths leaves the carbon dioxide rising.',
      ],
    ],
    explanation: `Naloxone is ${num('naloxone-dose')}. Check her response to voice and her blood pressure ${num('sedation-check-interval')} until she is stable.`,
  },
  {
    id: 'slow-again',
    sectionId: 'sedation-and-monitoring',
    title: 'Slow again in recovery',
    situation:
      'A 68-year-old man was given naloxone for slow breathing after fentanyl and woke. Forty minutes later in recovery he is hard to rouse again and breathes 7 times a minute. SpO₂ is 90% on 2 L/min.',
    key: [
      'Support his breathing and repeat the naloxone',
      'Naloxone has worn off before the fentanyl. He needs another dose and longer monitoring.',
    ],
    others: [
      [
        'Let him sleep: he was awake a moment ago',
        'This is the opioid returning. It gets deeper, not lighter.',
      ],
      [
        'Give flumazenil, as naloxone has stopped working',
        'Naloxone worked and wore off. The drug to reverse is still the opioid.',
      ],
      [
        'Move him to the ward for a longer rest',
        'He leaves monitored recovery at the moment he needs it most.',
      ],
    ],
    explanation: `Sedation can return as a reversal agent fades. That is why monitoring continues for ${num('reversal-discharge-wait')} after the last dose.`,
  },
  {
    id: 'he-feels-fine',
    sectionId: 'sedation-and-monitoring',
    title: 'He feels fine',
    situation:
      'A 46-year-old man had midazolam and fentanyl for a bronchoscopy 3 hours ago. No reversal was needed. He is alert, has eaten, and says he will drive himself home, 10 minutes away.',
    key: [
      'He goes with an escort and drives tomorrow',
      'Feeling alert is not the same as reacting normally. Judgment and reaction time stay impaired after the sedation seems gone.',
    ],
    others: [
      [
        'He may drive, as three hours have passed',
        'Three hours is well inside the period of impairment.',
      ],
      [
        'He may drive after a dose of flumazenil',
        'Flumazenil wears off first, and does nothing for the opioid.',
      ],
      [
        'He may drive if he passes a walking test',
        'Walking in a straight line does not test the judgment that driving needs.',
      ],
    ],
    explanation: `No driving, machinery or legal documents for ${num('post-sedation-restriction')} after sedation. Say it before the procedure, when he can still arrange a lift.`,
  },
])

/** Every vignette, by topic. */
export const VIGNETTES: readonly Vignette[] = [
  ...ANTITHROMBOTICS,
  ...LIDOCAINE,
  ...LAVAGE,
  ...METHEMOGLOBIN,
  ...PNEUMOTHORAX,
  ...TUBE_AND_SCOPE,
  ...HEMOPTYSIS,
  ...REVERSAL,
]
