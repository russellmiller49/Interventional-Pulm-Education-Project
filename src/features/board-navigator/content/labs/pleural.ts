import { num } from '../teachingNumbers'
import { PILOT_PROVENANCE, type LearningObjective } from '../types'

/**
 * Pleural disease: seven objectives from the first fluid result to the choice of definitive
 * management. The recurring misconception is reading one number as the whole decision — a single
 * Light's criterion, a pH, a pneumothorax size — when the decision also depends on the patient.
 */
const FLUID_MODULE = {
  label: 'Pleural fluid analysis module',
  href: '/pleural-procedures/pleural-fluid-analysis',
  kind: 'module',
} as const
const INFECTION_MODULE = {
  label: 'Pleural infection module',
  href: '/pleural-procedures/pleural-infection',
  kind: 'module',
} as const
const MPE_MODULE = {
  label: 'Malignant pleural effusion module',
  href: '/pleural-procedures/malignant-effusion',
  kind: 'module',
} as const
const THORACENTESIS_MODULE = {
  label: 'Thoracentesis planner',
  href: '/pleural-procedures/thoracentesis-planner',
  kind: 'module',
} as const
const PTX_MODULE = {
  label: 'Pneumothorax pathway module',
  href: '/pleural-procedures/pneumothorax-pathway',
  kind: 'module',
} as const
const US_MODULE = {
  label: 'Pleural ultrasound module',
  href: '/pleural-procedures/pleural-ultrasound',
  kind: 'module',
} as const

export const PLEURAL_OBJECTIVES: readonly LearningObjective[] = [
  {
    id: 'pl-01',
    topicId: 'pleural-disease',
    secondaryTopicIds: ['pleural-procedures'],
    title: "Apply Light's criteria and know when to overrule them",
    competency:
      "You can classify an effusion as an exudate or a transudate with Light's criteria and can recognise the diuresed heart-failure effusion that the criteria misclassify.",
    whatToKnow: [
      `An effusion is an exudate if it meets any one criterion: pleural-to-serum protein ratio ${num('lights-protein-ratio')}, pleural-to-serum LDH ratio ${num('lights-ldh-ratio')}, or pleural LDH ${num('lights-ldh-absolute')}.`,
      'The criteria are sensitive for exudates and misclassify a proportion of transudates, mostly heart-failure effusions after diuresis, as exudates.',
      `In that setting a serum-minus-pleural protein gradient ${num('protein-gradient')} or albumin gradient ${num('albumin-gradient')} reclassifies the fluid as a transudate.`,
      'A transudate is treated through its cause; an exudate goes on to cytology, culture and, where needed, pleural biopsy.',
    ],
    prerequisites: [],
    concepts: ['mechanism', 'evidence-interpretation', 'cognitive-error'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'pl-01.all-three',
        label: 'All three criteria must be met for an exudate.',
        repair:
          'Any one criterion is enough. The three were chosen to be sensitive; requiring all of them would miss most exudates.',
      },
      {
        id: 'pl-01.exudate-is-final',
        label: 'If the fluid meets a criterion it is an exudate, full stop.',
        repair: `Diuresis concentrates pleural protein and LDH and pushes a heart-failure transudate across the line. When the clinical picture is heart failure on diuretics, check the protein gradient (${num('protein-gradient')}) or albumin gradient (${num('albumin-gradient')}) before committing the patient to an exudate work-up.`,
      },
    ],
    resources: [
      FLUID_MODULE,
      {
        label: 'Board chapter: pleural effusions',
        href: '/board-prep/pleural-effusions',
        kind: 'chapter',
      },
    ],
    sourceIds: ['light-1972', 'bts-investigation-2010'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'pl-01.diagnose',
        kind: 'choice',
        stem: 'A 74-year-old with heart failure, three days into intravenous furosemide, has a right effusion. Pleural protein 3.4 g/dL, serum protein 6.6 g/dL. Pleural LDH 100 U/L, serum LDH 200 U/L; the laboratory upper limit of normal for serum LDH is 250 U/L. How do you classify the fluid?',
        hint: "Apply each criterion separately, then ask whether this patient's treatment could have changed the numbers.",
        teachingPoint:
          'One criterion makes an exudate on paper. In a diuresed heart-failure patient the protein gradient decides.',
        sourceIds: ['light-1972', 'bts-investigation-2010'],
        options: [
          {
            id: 'reclassified',
            label: `Meets Light's criteria by the protein ratio alone (0.52), but the protein gradient of 3.2 g/dL (${num('protein-gradient')}) reclassifies it as a heart-failure transudate`,
            rationale: `Yes. The protein ratio crosses ${num('lights-protein-ratio')}; the LDH ratio (0.5) and absolute LDH (below two-thirds of 250) do not. Any one criterion labels it an exudate, but after diuresis the gradient ${num('protein-gradient')} identifies the transudate.`,
          },
          {
            id: 'exudate-workup',
            label:
              'Exudate: the protein ratio is above 0.5, so arrange cytology, culture and pleural biopsy',
            rationale:
              'The ratio does cross the line, but diuresis pushes heart-failure transudates across it. The gradient check belongs before an exudate work-up in this patient.',
            misconceptionId: 'pl-01.exudate-is-final',
          },
          {
            id: 'transudate-one',
            label: 'Transudate: only one of the three criteria is met',
            rationale:
              'One criterion is enough for an exudate by the rule. The reason this fluid is a transudate is the gradient, not the count of criteria.',
            misconceptionId: 'pl-01.all-three',
          },
          {
            id: 'transudate-ldh',
            label: 'Transudate: the LDH criteria are not met, and LDH overrides protein',
            rationale:
              'No criterion overrides another; any one positive criterion defines an exudate. The reclassification here comes from the protein gradient.',
            misconceptionId: 'pl-01.all-three',
          },
        ],
        answerId: 'reclassified',
      },
      repair: {
        principle:
          "Light's criteria are a sensitive screen: any one positive criterion says exudate. Sensitivity costs specificity, and the known false positive is the diuresed heart-failure effusion, caught by the protein or albumin gradient.",
        explanation: [
          `The three criteria are pleural-to-serum protein ratio ${num('lights-protein-ratio')}, pleural-to-serum LDH ratio ${num('lights-ldh-ratio')}, and pleural LDH ${num('lights-ldh-absolute')}. They were derived to separate exudates from transudates with high sensitivity for the exudate, because missing an exudate (infection, malignancy) costs more than over-investigating a transudate.`,
          `Diuretic treatment removes water from the pleural space faster than protein and LDH, so a heart-failure transudate drifts toward exudate values. When the clinical picture is heart failure on diuretics and the fluid just crosses a criterion, compute the serum-minus-pleural protein gradient; a value ${num('protein-gradient')} (or an albumin gradient ${num('albumin-gradient')}) identifies a transudate and the work-up stops at treating the heart failure.`,
          'Use the gradient only to rescue that specific false positive. A fluid that clears a criterion by a wide margin, or a patient without heart failure, is an exudate and the differential is pursued.',
        ],
        distinction:
          "The criteria answer whether the fluid looks like an exudate. The gradient answers whether the patient's treatment made a transudate look like one. Apply the first to the fluid and the second to the patient.",
        manipulate: {
          id: 'pl-01.manipulate',
          kind: 'predict',
          stem: 'Keep the fluid results and change the patient.',
          baseline:
            'The same fluid: protein ratio 0.52, LDH ratio 0.5, gradient 3.2 g/dL, in a heart-failure patient on furosemide.',
          change: 'The patient has no heart failure, takes no diuretic, and has a 3 cm lung mass.',
          hint: 'Which part of the reasoning depended on heart failure and diuretics?',
          teachingPoint:
            'The gradient rescues one specific false positive. Without heart failure and diuresis there is nothing to rescue.',
          sourceIds: ['bts-investigation-2010'],
          options: [
            {
              id: 'exudate',
              label:
                'Exudate. The protein ratio crosses the line and there is no reason to apply the gradient; proceed to cytology and the malignancy work-up.',
              rationale:
                'Yes. The gradient corrects the diuresis effect in heart failure. Without that setting the criteria stand as written.',
            },
            {
              id: 'still-transudate',
              label: 'Transudate. The gradient is above 3.1 g/dL whoever the patient is.',
              rationale:
                'The gradient was validated to identify diuresed heart-failure transudates. It is not a general override of the criteria.',
              misconceptionId: 'pl-01.exudate-is-final',
            },
            {
              id: 'need-all',
              label: 'Indeterminate until the LDH criteria are also met.',
              rationale: 'One criterion is sufficient.',
              misconceptionId: 'pl-01.all-three',
            },
          ],
          answerId: 'exudate',
        },
      },
      verify: {
        id: 'pl-01.verify',
        kind: 'sort',
        stem: 'The laboratory upper limit of normal for serum LDH is 240 U/L. Sort each fluid.',
        hint: 'Check each criterion on its own, then look for the one patient whose treatment could change the numbers.',
        teachingPoint:
          'Any single criterion gives an exudate; the gradient reclassifies only the diuresed heart-failure effusion.',
        sourceIds: ['light-1972', 'bts-investigation-2010'],
        buckets: [
          { id: 'exudate', label: 'Exudate' },
          { id: 'transudate', label: 'Transudate' },
        ],
        items: [
          {
            id: 'a',
            label: 'Protein ratio 0.30, LDH ratio 0.40, pleural LDH 90 U/L; cirrhosis with ascites',
            bucketId: 'transudate',
            rationale: 'No criterion is met: a transudate.',
          },
          {
            id: 'b',
            label: 'Protein ratio 0.45, LDH ratio 0.70, pleural LDH 150 U/L; pneumonia',
            bucketId: 'exudate',
            rationale: `The LDH ratio exceeds ${num('lights-ldh-ratio')}. One criterion is enough.`,
            misconceptionId: 'pl-01.all-three',
          },
          {
            id: 'c',
            label:
              'Protein ratio 0.60, LDH ratio 0.55, pleural LDH 140 U/L; weight loss and a lung mass',
            bucketId: 'exudate',
            rationale: `The protein ratio exceeds ${num('lights-protein-ratio')}, and there is no heart failure to invoke the gradient.`,
          },
          {
            id: 'd',
            label:
              'Protein ratio 0.52, LDH ratio 0.45, pleural LDH 110 U/L; heart failure on diuretics, serum-minus-pleural protein 3.5 g/dL',
            bucketId: 'transudate',
            rationale: `Meets one criterion on paper, but the gradient ${num('protein-gradient')} in a diuresed heart-failure patient identifies a transudate.`,
            misconceptionId: 'pl-01.exudate-is-final',
          },
        ],
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'pl-02',
    topicId: 'pleural-disease',
    secondaryTopicIds: ['pleural-procedures'],
    title: 'Decide when a parapneumonic effusion needs a tube',
    competency:
      'You can decide which parapneumonic effusions need tube drainage and which can be watched, and you can collect the pH in a way the result can be trusted.',
    whatToKnow: [
      `Drain when the fluid is frank pus, when pleural pH is ${num('parapneumonic-ph-drain')}, when Gram stain or culture is positive, or when a loculated or large effusion accompanies sepsis that is not settling.`,
      'Measure pH on a blood-gas analyser from a non-purulent sample kept from air; frank pus needs no pH and is not put through the analyser.',
      'Antibiotics are given to every patient; delay in draining a complicated effusion worsens outcome.',
      `A small, free-flowing effusion with pH at or above 7.2 and no other indication can be observed on antibiotics with repeat imaging.`,
    ],
    prerequisites: ['pl-01'],
    concepts: ['strategy-selection', 'complication'],
    safetyCritical: true,
    misconceptions: [
      {
        id: 'pl-02.improving-so-wait',
        label: 'If the patient is improving on antibiotics, drainage can wait even with a low pH.',
        repair: `A pH ${num('parapneumonic-ph-drain')} marks a complicated effusion that will organise. Clinical improvement of the pneumonia does not undo that; the tube goes in now.`,
      },
      {
        id: 'pl-02.ph-on-pus',
        label: 'Send frank pus for pH to decide on drainage.',
        repair:
          'Pus is an indication to drain in itself. Running pus through a blood-gas analyser gives an unreliable value and damages the analyser.',
      },
    ],
    resources: [
      INFECTION_MODULE,
      {
        label: 'Board chapter: pleural infections',
        href: '/board-prep/pleural-infections',
        kind: 'chapter',
      },
    ],
    sourceIds: ['bts-pleural-2023'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'pl-02.diagnose',
        kind: 'choice',
        stem: 'A 58-year-old, two days into antibiotics for pneumonia, is less febrile. Ultrasound shows a moderate effusion with septations. Aspirate: turbid fluid, pH 7.05 on the gas analyser, Gram stain negative. What do you do today?',
        hint: 'Which finding here marks the effusion as complicated, and does the fever curve change what that finding means?',
        teachingPoint: `A pH ${num('parapneumonic-ph-drain')} with septations is a complicated effusion. Clinical improvement of the pneumonia does not defer the tube.`,
        sourceIds: ['bts-pleural-2023'],
        options: [
          {
            id: 'drain',
            label: 'Place a chest tube now and continue antibiotics',
            rationale: `Yes. pH ${num('parapneumonic-ph-drain')} and septations mark a complicated effusion that will organise if left; delay worsens outcome.`,
          },
          {
            id: 'wait',
            label:
              'Continue antibiotics and repeat the ultrasound in 48 hours since the fever is settling',
            rationale:
              'The improving fever reflects the pneumonia. The pleural space has already crossed into a complicated effusion and will organise during the wait.',
            misconceptionId: 'pl-02.improving-so-wait',
          },
          {
            id: 'tap-only',
            label: 'Complete a therapeutic thoracentesis and stop there',
            rationale:
              'A single aspiration does not control a septated, complicated effusion; it reaccumulates and organises.',
          },
          {
            id: 'tpa-no-tube',
            label:
              'Give intrapleural tPA and DNase through the aspiration needle instead of a tube',
            rationale:
              'Intrapleural therapy is an adjunct given through a chest tube when drainage is inadequate; it does not replace the tube.',
          },
        ],
        answerId: 'drain',
      },
      repair: {
        principle:
          'The pleural space and the lung are treated separately. Antibiotics treat the pneumonia; the fluid decides its own fate on pus, pH, microbiology and loculation.',
        explanation: [
          `Drainage indications are frank pus, pH ${num('parapneumonic-ph-drain')}, a positive Gram stain or culture, and a loculated or large effusion with sepsis that is not settling. Any one is enough. Supporting findings such as low glucose and high LDH point the same way but the pH is the measurement guidelines key on.`,
          'The pH is only as good as its collection: a non-purulent sample drawn into a heparinised syringe, kept from air, run on a blood-gas analyser. Litmus paper and delay give unusable results. Frank pus is drained on sight and is not put through the analyser.',
          `A small, free-flowing effusion with pH at or above 7.2, negative microbiology and a patient who is settling can be watched with repeat imaging; the tube goes in if any indication appears. The error to avoid is letting the fever curve of the pneumonia stand in for the state of the pleural space.`,
        ],
        distinction:
          'An improving pneumonia and a complicated effusion coexist. The first is judged at the bedside; the second is judged on the fluid.',
        manipulate: {
          id: 'pl-02.manipulate',
          kind: 'predict',
          stem: 'Keep the patient and change the aspirate.',
          baseline: 'The improving 58-year-old with septations and a pH of 7.05.',
          change: 'The aspirate is thick, frank pus.',
          hint: 'What does pus tell you on its own, and what does it do to the analyser?',
          teachingPoint: 'Pus is an indication to drain in itself; no pH is needed.',
          sourceIds: ['bts-pleural-2023'],
          options: [
            {
              id: 'drain-no-ph',
              label:
                'Drain now. Do not send the pus for pH; it is an indication in itself and will give an unreliable value.',
              rationale:
                'Yes. Frank pus is drained on sight. The pH measurement is for non-purulent fluid where the decision is uncertain.',
            },
            {
              id: 'ph-first',
              label: 'Send the pus for pH on the gas analyser to confirm the indication.',
              rationale:
                'Purulent fluid gives unreliable pH readings and fouls the analyser; the indication is already met.',
              misconceptionId: 'pl-02.ph-on-pus',
            },
            {
              id: 'wait-again',
              label: 'Antibiotics and repeat imaging; the patient is improving.',
              rationale: 'Pus in the pleural space is drained regardless of the fever curve.',
              misconceptionId: 'pl-02.improving-so-wait',
            },
          ],
          answerId: 'drain-no-ph',
        },
      },
      verify: {
        id: 'pl-02.verify',
        kind: 'predict',
        stem: 'Keep the patient and change the fluid.',
        baseline:
          'The 58-year-old with pneumonia, improving on antibiotics, now with a moderate effusion.',
        change:
          'Ultrasound shows a small, free-flowing effusion without septations. Aspirate: clear fluid, pH 7.35, Gram stain negative.',
        hint: 'Run through each drainage indication and see whether any is met.',
        teachingPoint:
          'With no indication met, the effusion is observed on antibiotics with repeat imaging, and drained if an indication appears.',
        sourceIds: ['bts-pleural-2023'],
        options: [
          {
            id: 'observe',
            label:
              'Antibiotics and repeat imaging; no tube today. Reassess if the effusion grows or the patient does not settle.',
            rationale: `Yes. pH 7.35, free-flowing, small, negative Gram stain: no drainage indication is met.`,
          },
          {
            id: 'drain-anyway',
            label: 'Chest tube now; every parapneumonic effusion is drained.',
            rationale:
              'Uncomplicated parapneumonic effusions resolve with antibiotics. The tube is for the indications, not the diagnosis.',
            misconceptionId: 'pl-02.improving-so-wait',
          },
          {
            id: 'tpa',
            label: 'Intrapleural tPA and DNase.',
            rationale:
              'Intrapleural therapy is for inadequate drainage of a complicated effusion through a tube. Nothing here is complicated.',
          },
        ],
        answerId: 'observe',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'pl-03',
    topicId: 'pleural-disease',
    title: 'Use intrapleural tPA and DNase as the trial used them',
    competency:
      'You can say when intrapleural fibrinolytic and DNase therapy is indicated, what regimen has evidence, and what the trial showed about using either agent alone.',
    whatToKnow: [
      `MIST2 (2011) tested ${num('mist2-regimen')} in pleural infection with a chest tube in place.`,
      'The combination reduced the size of the effusion on chest radiograph and the rate of surgical referral at three months compared with placebo.',
      'tPA alone did not improve the primary outcome. DNase alone did not either, and was associated with more surgical referrals than placebo.',
      'It is an adjunct for inadequate drainage or persisting sepsis with a tube in place; early surgical referral is the alternative, and the two are discussed together.',
    ],
    prerequisites: ['pl-02'],
    concepts: ['evidence-interpretation', 'strategy-selection'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'pl-03.tpa-alone-equivalent',
        label: 'tPA alone works as well; DNase is optional.',
        repair:
          'In MIST2 tPA alone did not improve the primary outcome. The evidence is for the combination.',
      },
      {
        id: 'pl-03.replaces-drain',
        label: 'Intrapleural therapy can be given instead of a chest tube.',
        repair:
          'The regimen was tested through a chest tube in patients who already had one. It improves drainage; it does not replace it.',
      },
    ],
    resources: [
      INFECTION_MODULE,
      {
        label: 'Board chapter: pleural infections',
        href: '/board-prep/pleural-infections',
        kind: 'chapter',
      },
    ],
    sourceIds: ['mist2-2011', 'bts-pleural-2023'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'pl-03.diagnose',
        kind: 'choice',
        stem: 'A chest tube has been in for 48 hours for a complicated parapneumonic effusion. Output has fallen to a trickle, ultrasound shows a residual loculated collection, and the patient remains septic. The surgical team cannot operate this week. What do you give?',
        hint: 'Which regimen was tested, and in which arm did the primary outcome improve?',
        teachingPoint: `The combination, ${num('mist2-regimen')}, is the regimen with evidence. Neither agent alone improved the primary outcome.`,
        sourceIds: ['mist2-2011'],
        options: [
          {
            id: 'combo',
            label: `Intrapleural ${num('mist2-regimen')}, through the tube`,
            rationale:
              'Yes. This is the MIST2 regimen, and the combination arm is the one that reduced effusion size and surgical referral.',
          },
          {
            id: 'tpa',
            label: 'Intrapleural tPA 10 mg twice daily for 3 days',
            rationale: 'tPA alone did not improve the primary outcome in MIST2.',
            misconceptionId: 'pl-03.tpa-alone-equivalent',
          },
          {
            id: 'dnase',
            label: 'Intrapleural DNase 5 mg twice daily for 3 days',
            rationale:
              'DNase alone did not improve the primary outcome and was associated with more surgical referrals than placebo.',
            misconceptionId: 'pl-03.tpa-alone-equivalent',
          },
          {
            id: 'remove',
            label: 'Remove the tube since it is no longer draining, and continue antibiotics',
            rationale:
              'Low output with a residual loculated collection means the tube is not reaching the fluid, not that the fluid is gone.',
            misconceptionId: 'pl-03.replaces-drain',
          },
        ],
        answerId: 'combo',
      },
      repair: {
        principle:
          'Use the regimen as it was tested: both agents, through a tube already in place, in a patient whose drainage is inadequate. The alternative is early surgery, and the two options are weighed together.',
        explanation: [
          `MIST2 randomised patients with pleural infection and a chest tube to placebo, tPA alone, DNase alone, or ${num('mist2-regimen')}. The combination reduced the area of the effusion on the chest radiograph at day 7 and cut surgical referral at three months. tPA alone did not change the primary outcome. DNase alone did not either, and the DNase-alone arm had more surgical referrals than placebo.`,
          'The mechanism explains the pairing: fibrinolysis breaks the septations and DNase reduces the viscosity of the pus so it can drain. One without the other leaves either the walls or the glue.',
          'The therapy is given through the tube, so the tube stays. Bleeding risk is the main caution, and anticoagulation is reviewed before the first dose. Early thoracic surgical review runs in parallel; a patient who does not respond is referred rather than re-dosed indefinitely.',
        ],
        distinction:
          'The question is not fibrinolytic or not; it is whether the regimen with evidence, the combination through a tube, fits this patient, or whether surgery does.',
      },
      verify: {
        id: 'pl-03.verify',
        kind: 'predict',
        baseline:
          'A poorly draining empyema with a chest tube in place, for which the combination regimen is planned.',
        change:
          'The patient is on therapeutic anticoagulation. A colleague proposes DNase alone, reasoning that it avoids the bleeding risk of tPA.',
        stem: 'What does the trial evidence say about that plan?',
        hint: 'Look at the DNase-alone arm specifically.',
        teachingPoint:
          'DNase alone did not reduce effusion size and was associated with more surgical referrals. Bleeding risk is managed by reviewing anticoagulation, not by dropping tPA.',
        sourceIds: ['mist2-2011'],
        options: [
          {
            id: 'no-benefit',
            label:
              'DNase alone did not improve drainage and was associated with more surgical referrals than placebo; the combination is the regimen with evidence, after reviewing the anticoagulation',
            rationale:
              'Yes. The DNase-alone arm did not improve the primary outcome and did worse on surgical referral. Anticoagulation is reviewed and held where possible before the combination is given.',
          },
          {
            id: 'reasonable',
            label: 'Reasonable: DNase carries the benefit and tPA only adds bleeding risk',
            rationale:
              'The trial found the opposite. The combination carried the benefit; DNase alone did not.',
            misconceptionId: 'pl-03.tpa-alone-equivalent',
          },
          {
            id: 'tpa-alone',
            label: 'Give tPA alone instead; it was the active component',
            rationale: 'tPA alone did not improve the primary outcome either.',
            misconceptionId: 'pl-03.tpa-alone-equivalent',
          },
        ],
        answerId: 'no-benefit',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'pl-05',
    topicId: 'pleural-disease',
    secondaryTopicIds: ['pleural-procedures'],
    title: 'Recognise non-expandable lung and what it rules out',
    competency:
      'You can recognise non-expandable lung during and after drainage, distinguish pneumothorax ex vacuo from a procedural pneumothorax, and say why it rules out pleurodesis.',
    whatToKnow: [
      'Non-expandable lung cannot reach the chest wall after drainage, because of a visceral pleural peel (trapped lung) or an active pleural process holding it (lung entrapment).',
      'Signs during drainage: anterior chest tightness or pain and a falling pleural pressure. Signs after: a basal pneumothorax without an air leak (pneumothorax ex vacuo) and a lung that does not meet the chest wall on imaging.',
      `On manometry a pleural elastance ${num('pleural-elastance-nel')} predicts that pleurodesis will not take.`,
      'Pleurodesis needs the two pleural surfaces to touch. Non-expandable lung therefore calls for an indwelling pleural catheter rather than talc.',
    ],
    prerequisites: ['pl-01'],
    concepts: ['mechanism', 'imaging-interpretation', 'complication'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'pl-05.ex-vacuo-is-puncture',
        label:
          'A pneumothorax on the film after thoracentesis means the needle punctured the lung, so a chest tube is needed.',
        repair:
          'When the lung cannot expand to fill the space the fluid left, air is drawn into the pleural space through the needle track or the tissues: pneumothorax ex vacuo. There is no leak to drain. A chest tube does not re-expand a lung that cannot expand.',
      },
      {
        id: 'pl-05.pleurodesis-anyway',
        label: 'Talc will still work if enough is given.',
        repair:
          'Pleurodesis is apposition plus inflammation. Without apposition there is nothing for the inflamed surfaces to fuse to.',
      },
    ],
    resources: [THORACENTESIS_MODULE, MPE_MODULE],
    sourceIds: ['lan-1997', 'ats-mpe-2018', 'bts-pleural-2023'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'pl-05.diagnose',
        kind: 'choice',
        stem: 'A large malignant effusion. After 1.4 L is drained the patient reports anterior chest tightness and the procedure stops. The patient is comfortable and stable. The film shows a small basal pneumothorax with residual fluid; the mediastinum is midline and there is no subcutaneous air. What has happened and what do you do?',
        hint: 'Ask what filled the space the fluid left, and whether there is an air leak to treat.',
        teachingPoint:
          'Chest tightness during drainage plus a basal pneumothorax without a leak is non-expandable lung. There is nothing to suck out.',
        sourceIds: ['ats-mpe-2018', 'bts-pleural-2023'],
        options: [
          {
            id: 'ex-vacuo',
            label:
              'Pneumothorax ex vacuo from non-expandable lung. No chest tube; record the finding, and plan an indwelling catheter if definitive control is needed.',
            rationale:
              'Yes. The lung could not fill the space the fluid left. There is no air leak, so a tube would not re-expand anything, and the finding decides the definitive plan.',
          },
          {
            id: 'tube',
            label: 'Iatrogenic pneumothorax from a lung puncture. Place a chest tube.',
            rationale:
              'A puncture gives an air leak; the lung would otherwise expand. Here the lung could not expand, which is why air appeared. A tube adds a procedure without re-expanding the lung.',
            misconceptionId: 'pl-05.ex-vacuo-is-puncture',
          },
          {
            id: 'talc',
            label: 'Drain the rest and instil talc now that the space is accessible.',
            rationale:
              'The pleural surfaces are not in contact. Talc cannot fuse surfaces that do not touch.',
            misconceptionId: 'pl-05.pleurodesis-anyway',
          },
          {
            id: 'oxygen',
            label: 'High-flow oxygen to resorb the air, then repeat the drainage.',
            rationale:
              'The air is a marker of a lung that will not expand, not a problem to resorb. Repeating the drainage reproduces the finding.',
          },
        ],
        answerId: 'ex-vacuo',
      },
      repair: {
        principle:
          'The pleural space can only be emptied as far as the lung will follow. When the lung stops following, pressure falls, the patient feels it, and air fills the gap. That same gap is why pleurodesis cannot work.',
        explanation: [
          'In a normal effusion the lung expands as fluid is removed and pleural pressure stays near zero. With a fibrous visceral peel (trapped lung) or an active pleural process holding the lung (lung entrapment), removal of fluid drops the pleural pressure steeply. The patient feels anterior chest tightness, and air is drawn into the space from the tissues or along the needle: pneumothorax ex vacuo, without an air leak.',
          `Pleural manometry quantifies it. Elastance is the pressure fall per litre removed; a value ${num('pleural-elastance-nel')} predicts that pleurodesis will not take, because the surfaces cannot be brought together.`,
          'The practical consequences: stop the drainage when the tightness appears rather than pushing on; do not treat the ex vacuo pneumothorax with a tube; and move the definitive plan from pleurodesis toward an indwelling pleural catheter.',
        ],
        distinction:
          'A procedural pneumothorax is air that leaked in and a lung that will re-expand once it stops. Pneumothorax ex vacuo is air that was drawn in because the lung cannot re-expand. The first needs a tube; the second needs a different plan.',
        manipulate: {
          id: 'pl-05.manipulate',
          kind: 'predict',
          stem: 'Keep the patient and change the manometry.',
          baseline: 'The same patient, with pleural manometry during the drainage.',
          change:
            'Pleural pressure barely falls; elastance works out at 9 cmH₂O/L and the film after full drainage shows the lung meeting the chest wall.',
          hint: 'Compare the elastance with the threshold and ask what it predicts.',
          teachingPoint: `Elastance below ${num('pleural-elastance-nel')} with full re-expansion means the lung is expandable and pleurodesis is back on the table.`,
          sourceIds: ['lan-1997'],
          options: [
            {
              id: 'expandable',
              label: 'Expandable lung. Pleurodesis is an option alongside an indwelling catheter.',
              rationale: 'Yes. Low elastance and apposition on imaging are what pleurodesis needs.',
            },
            {
              id: 'still-nel',
              label:
                'Still non-expandable; any pneumothorax ex vacuo earlier commits the patient to a catheter.',
              rationale:
                'The scenario changed: the lung now re-expands and the elastance is below the threshold. The earlier finding does not apply to this new case.',
              misconceptionId: 'pl-05.ex-vacuo-is-puncture',
            },
            {
              id: 'no-pleurodesis',
              label: 'Pleurodesis is never offered after a large drainage.',
              rationale: 'Volume drained is not the determinant; apposition and elastance are.',
              misconceptionId: 'pl-05.pleurodesis-anyway',
            },
          ],
          answerId: 'expandable',
        },
      },
      verify: {
        id: 'pl-05.verify',
        kind: 'sort',
        stem: 'Sort each finding by what it suggests about the lung.',
        hint: 'Expandable lung follows the fluid out. Non-expandable lung leaves a gap and a pressure drop.',
        teachingPoint:
          'Tightness during drainage, a residual space and high elastance mark non-expandable lung; full re-expansion, relief and low elastance mark an expandable one.',
        sourceIds: ['lan-1997', 'ats-mpe-2018'],
        buckets: [
          { id: 'nel', label: 'Suggests non-expandable lung' },
          { id: 'exp', label: 'Suggests expandable lung' },
        ],
        items: [
          {
            id: 'elastance-high',
            label: 'Pleural elastance 20 cmH₂O/L',
            bucketId: 'nel',
            rationale: `Above ${num('pleural-elastance-nel')}: pleurodesis unlikely to take.`,
          },
          {
            id: 'tightness',
            label: 'Anterior chest tightness as fluid is removed',
            bucketId: 'nel',
            rationale: 'The symptom of a steep fall in pleural pressure.',
          },
          {
            id: 'hydropneumo',
            label:
              'Post-drainage film with a basal pneumothorax and the lung short of the chest wall, no air leak',
            bucketId: 'nel',
            rationale: 'Pneumothorax ex vacuo: air filled the gap the lung could not.',
            misconceptionId: 'pl-05.ex-vacuo-is-puncture',
          },
          {
            id: 'full-expansion',
            label: 'Post-drainage film with the lung meeting the chest wall',
            bucketId: 'exp',
            rationale: 'Apposition achieved.',
          },
          {
            id: 'elastance-low',
            label: 'Pleural elastance 8 cmH₂O/L',
            bucketId: 'exp',
            rationale: 'Below the threshold; the lung followed the fluid.',
          },
          {
            id: 'relief',
            label: 'Breathlessness relieved by the drainage',
            bucketId: 'exp',
            rationale:
              'Symptom relief suggests the lung re-expanded and the effusion was the cause.',
          },
        ],
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'pl-04',
    topicId: 'pleural-disease',
    secondaryTopicIds: ['pleural-procedures'],
    title: 'Choose definitive management of a malignant effusion',
    competency:
      'You can choose between observation, repeated thoracentesis, an indwelling pleural catheter and chemical pleurodesis for a malignant pleural effusion from symptoms, lung expandability and patient priorities.',
    whatToKnow: [
      'An asymptomatic malignant effusion is observed; procedures are for symptoms.',
      'A first symptomatic effusion is drained therapeutically to learn two things: whether the breathlessness improves and whether the lung re-expands.',
      'With expandable lung, an indwelling pleural catheter and talc pleurodesis are both appropriate; the choice follows the patient’s priorities (time in hospital, a catheter at home, re-intervention risk).',
      'With non-expandable lung, after pleurodesis that did not take, or a loculated effusion, the indwelling catheter is the choice rather than talc.',
    ],
    prerequisites: ['pl-05'],
    concepts: ['strategy-selection', 'evidence-interpretation', 'team-decision'],
    safetyCritical: false,
    misconceptions: [
      {
        id: 'pl-04.nel-talc',
        label: 'Non-expandable lung is managed with talc pleurodesis.',
        repair:
          'Pleurodesis needs apposition. Non-expandable lung is the main indication for an indwelling catheter instead.',
      },
      {
        id: 'pl-04.drain-asymptomatic',
        label: 'Every malignant effusion needs definitive management.',
        repair:
          'Definitive procedures treat symptoms. An asymptomatic effusion is watched, and treated if symptoms appear.',
      },
      {
        id: 'pl-04.talc-first-always',
        label: 'Pleurodesis has to be tried before a catheter can be considered.',
        repair:
          'With expandable lung either option is first-line. TIME2 found equivalent relief of breathlessness, with shorter initial hospital stay and fewer further pleural procedures in the catheter group.',
      },
    ],
    resources: [
      MPE_MODULE,
      {
        label: 'Board chapter: indwelling pleural catheters',
        href: '/board-prep/indwelling-pleural-catheters',
        kind: 'chapter',
      },
    ],
    sourceIds: ['ats-mpe-2018', 'time2-2012', 'bts-pleural-2023'],
    estimatedMinutes: 6,
    lab: {
      diagnose: {
        id: 'pl-04.diagnose',
        kind: 'choice',
        stem: 'A 66-year-old with metastatic breast cancer and an expected survival of many months has a recurrent, breathless right malignant effusion. After therapeutic drainage the breathlessness improves and the lung re-expands fully. The patient wants to avoid a hospital stay. What do you offer?',
        hint: 'Two findings from the drainage tell you which options are open. The patient’s preference then chooses between them.',
        teachingPoint:
          'Expandable lung opens both the catheter and pleurodesis. The patient’s priorities make the choice, and here they point to the catheter.',
        sourceIds: ['ats-mpe-2018', 'time2-2012'],
        options: [
          {
            id: 'either-ipc',
            label:
              'Either an indwelling pleural catheter or talc pleurodesis is appropriate; given the wish to avoid admission, offer the catheter',
            rationale:
              'Yes. Symptom response and full re-expansion make both first-line. The catheter is placed as a day case and fits the stated priority.',
          },
          {
            id: 'talc-first',
            label:
              'Talc pleurodesis has to be tried first; a catheter is for when it does not take',
            rationale:
              'With expandable lung the two are alternatives, not a sequence. TIME2 showed equivalent relief with shorter stay for the catheter.',
            misconceptionId: 'pl-04.talc-first-always',
          },
          {
            id: 'repeat-taps',
            label: 'Repeated thoracentesis whenever symptoms return',
            rationale:
              'Repeated taps suit a very short expected survival or a slowly recurring effusion. With months to live and a recurrent effusion, a definitive option is offered.',
          },
          {
            id: 'observe',
            label: 'Observe; the effusion will be managed by systemic therapy',
            rationale:
              'The effusion is symptomatic and recurrent. Observation is for the asymptomatic effusion.',
            misconceptionId: 'pl-04.drain-asymptomatic',
          },
        ],
        answerId: 'either-ipc',
      },
      repair: {
        principle:
          'Three questions in order: is the patient breathless, does the lung expand, what does the patient want. The first decides whether to act, the second which options are open, the third which to choose.',
        explanation: [
          'The guideline starts with symptoms: an asymptomatic malignant effusion is observed. A first symptomatic effusion is drained therapeutically, and the drainage is itself a test: did breathing improve (so the effusion is the cause), and did the lung re-expand (so pleurodesis is possible).',
          'With expandable lung, an indwelling pleural catheter and chemical pleurodesis are both first-line. TIME2 randomised between them and found no difference in breathlessness relief; the catheter group had a shorter initial hospital stay and fewer further pleural procedures, with catheter-related complications as the trade-off. So the choice belongs to the patient: a catheter at home with regular drainage, or an admission for talc with a chance of needing another procedure.',
          'With non-expandable lung, a loculated effusion or a previous pleurodesis that did not take, talc has nothing to fuse and the catheter is the choice. A very short expected survival favours repeated thoracentesis over any device.',
        ],
        distinction:
          'Expandability decides what is possible; the patient decides what is preferred. A learner who skips the first question treats non-expandable lung with talc, and one who skips the third admits a patient who did not want to be admitted.',
        manipulate: {
          id: 'pl-04.manipulate',
          kind: 'predict',
          stem: 'Keep the cancer and change the symptoms.',
          baseline:
            'The 66-year-old with metastatic breast cancer and a recurrent, breathless effusion.',
          change:
            'The effusion is moderate and found on a staging scan; the patient has no breathlessness at all.',
          hint: 'What do the procedures treat?',
          teachingPoint:
            'Definitive procedures treat symptoms. Without symptoms the effusion is watched.',
          sourceIds: ['ats-mpe-2018'],
          options: [
            {
              id: 'observe',
              label: 'Observe. Review if breathlessness develops.',
              rationale: 'Yes. No symptoms, no procedure. The patient is told what to watch for.',
            },
            {
              id: 'ipc-now',
              label: 'Place a catheter now to prevent future symptoms.',
              rationale:
                'A device carries infection and maintenance burden for a symptom the patient does not have.',
              misconceptionId: 'pl-04.drain-asymptomatic',
            },
            {
              id: 'tap-now',
              label: 'Therapeutic thoracentesis to assess expandability.',
              rationale: 'The drainage is a test of symptom response; there is no symptom to test.',
              misconceptionId: 'pl-04.drain-asymptomatic',
            },
          ],
          answerId: 'observe',
        },
      },
      verify: {
        id: 'pl-04.verify',
        kind: 'predict',
        stem: 'Keep the patient and change the drainage result.',
        baseline:
          'The 66-year-old with a recurrent, breathless malignant effusion, drained therapeutically.',
        change:
          'Breathlessness improves only partly. The film shows the lung well short of the chest wall with a basal pneumothorax and no air leak.',
        hint: 'What does the film tell you about the pleural surfaces, and which option needs them to touch?',
        teachingPoint:
          'Non-expandable lung rules out pleurodesis and calls for the indwelling catheter.',
        sourceIds: ['ats-mpe-2018'],
        options: [
          {
            id: 'ipc',
            label:
              'Indwelling pleural catheter; pleurodesis is not offered because the surfaces do not appose',
            rationale:
              'Yes. Pneumothorax ex vacuo and a lung short of the chest wall mean non-expandable lung. The catheter relieves symptoms without needing apposition.',
          },
          {
            id: 'talc',
            label: 'Talc pleurodesis through a chest tube once the pneumothorax is treated',
            rationale: 'There is no air leak to treat and no apposition for talc to act on.',
            misconceptionId: 'pl-04.nel-talc',
          },
          {
            id: 'tube',
            label: 'Chest tube for the pneumothorax, then decide',
            rationale:
              'Pneumothorax ex vacuo has no leak; a tube does not re-expand a lung that cannot expand.',
            misconceptionId: 'pl-04.nel-talc',
          },
        ],
        answerId: 'ipc',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'pl-06',
    topicId: 'pleural-disease',
    secondaryTopicIds: ['pleural-procedures'],
    title: 'Let symptoms, not size, drive the pneumothorax pathway',
    competency:
      'You can choose between conservative management, aspiration or an ambulatory device, and a chest drain for a spontaneous pneumothorax from symptoms, physiology and whether the lung is diseased.',
    whatToKnow: [
      'A primary spontaneous pneumothorax with minimal symptoms is managed conservatively whatever its size, with safety-netting and follow-up imaging.',
      'A symptomatic primary pneumothorax is treated, and the method (needle aspiration, an ambulatory device, or a chest drain) is chosen with the patient.',
      'A symptomatic secondary pneumothorax, in a patient with underlying lung disease, is treated with a chest drain and admission.',
      'High-risk features (haemodynamic compromise, significant hypoxia, bilateral pneumothorax, tension) call for a drain regardless; tension is decompressed immediately.',
    ],
    prerequisites: [],
    concepts: ['strategy-selection', 'evidence-interpretation'],
    safetyCritical: true,
    misconceptions: [
      {
        id: 'pl-06.size-decides',
        label: 'A large pneumothorax always needs a drain.',
        repair:
          'In primary spontaneous pneumothorax with minimal symptoms, conservative management was non-inferior for resolution at eight weeks in the trial that tested it, with fewer serious adverse events. Size is measured; symptoms decide.',
      },
      {
        id: 'pl-06.ssp-conservative',
        label: 'A secondary pneumothorax with symptoms can be observed like a primary one.',
        repair:
          'Diseased lung has less reserve and the pneumothorax is less likely to resolve on its own. A symptomatic secondary pneumothorax is drained and the patient admitted.',
      },
    ],
    resources: [
      PTX_MODULE,
      {
        label: 'Board chapter: pneumothorax and persistent air leak',
        href: '/board-prep/pneumothorax-and-pal',
        kind: 'chapter',
      },
    ],
    sourceIds: ['bts-pleural-2023', 'brown-psp-2020'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'pl-06.diagnose',
        kind: 'choice',
        stem: 'A 24-year-old, tall and otherwise well, presents with a large right primary spontaneous pneumothorax on the chest radiograph. Minimal symptoms, saturation 98% on air, heart rate 80, comfortable at rest and walking. What do you offer?',
        hint: 'Which two features of this patient decide the pathway, and is size one of them?',
        teachingPoint:
          'Minimal symptoms in a primary pneumothorax means conservative management whatever the size.',
        sourceIds: ['bts-pleural-2023', 'brown-psp-2020'],
        options: [
          {
            id: 'conservative',
            label: 'Conservative management with safety-netting and follow-up imaging',
            rationale:
              'Yes. Primary pneumothorax with minimal symptoms is observed regardless of size; the trial evidence showed non-inferior resolution with fewer serious adverse events.',
          },
          {
            id: 'drain-size',
            label: 'Chest drain because the pneumothorax is large',
            rationale:
              'Size is measured and recorded, but the guideline keys the decision on symptoms in primary pneumothorax.',
            misconceptionId: 'pl-06.size-decides',
          },
          {
            id: 'aspirate-must',
            label: 'Needle aspiration is mandatory for any pneumothorax of this size',
            rationale:
              'Aspiration is one of the options for a symptomatic primary pneumothorax. With minimal symptoms, no intervention is the pathway.',
            misconceptionId: 'pl-06.size-decides',
          },
          {
            id: 'admit-o2',
            label: 'Admit for high-flow oxygen until the pneumothorax resolves',
            rationale:
              'Conservative management is ambulatory with follow-up; admission for oxygen is not the pathway for a well patient.',
          },
        ],
        answerId: 'conservative',
      },
      repair: {
        principle:
          'The pathway asks whether the patient is compromised, whether the lung is diseased, and how symptomatic the patient is. Size is recorded but is not a branch point in the primary pneumothorax.',
        explanation: [
          'First, exclude the emergency: tension, haemodynamic compromise, significant hypoxia or bilateral pneumothorax need a drain now. Second, ask whether the lung is diseased: a secondary pneumothorax with symptoms is drained and admitted because reserve is low and spontaneous resolution less likely.',
          'In a primary pneumothorax the decision is symptoms. With minimal symptoms, conservative management is the pathway whatever the size; the randomised trial of conservative versus interventional treatment found non-inferior radiographic resolution at eight weeks in its primary analysis and fewer serious adverse events, mostly those caused by the drains themselves.',
          'With significant symptoms, the patient is treated, and the method is chosen with them: needle aspiration, an ambulatory device that allows discharge, or a chest drain. Each has a different trade-off between a second procedure and time in hospital.',
        ],
        distinction:
          'Size tells you how much air there is. Symptoms and lung disease tell you whether the patient can tolerate it. The pathway is built on the second pair.',
        manipulate: {
          id: 'pl-06.manipulate',
          kind: 'predict',
          stem: 'Keep the patient and change the symptoms.',
          baseline:
            'The 24-year-old with a large primary pneumothorax and minimal symptoms, managed conservatively.',
          change:
            'The patient is significantly breathless at rest, saturation 97%, heart rate 95, no haemodynamic compromise.',
          hint: 'Which branch did the patient just cross, and who chooses the method?',
          teachingPoint:
            'Significant symptoms in a primary pneumothorax mean intervention, with the method chosen with the patient.',
          sourceIds: ['bts-pleural-2023'],
          options: [
            {
              id: 'intervene-choice',
              label:
                'Treat: needle aspiration, an ambulatory device or a chest drain, chosen with the patient',
              rationale:
                'Yes. Symptoms move the patient from observation to treatment; the three methods are offered according to priorities.',
            },
            {
              id: 'still-observe',
              label: 'Still conservative; the pneumothorax has not grown',
              rationale: 'The branch point is symptoms, which have changed.',
              misconceptionId: 'pl-06.size-decides',
            },
            {
              id: 'drain-only',
              label: 'A chest drain is the only acceptable option once symptomatic',
              rationale:
                'Aspiration and ambulatory devices are guideline options for symptomatic primary pneumothorax without high-risk features.',
            },
          ],
          answerId: 'intervene-choice',
        },
      },
      verify: {
        id: 'pl-06.verify',
        kind: 'predict',
        stem: 'Keep the pneumothorax and change the patient.',
        baseline: 'A large right pneumothorax on the radiograph.',
        change: 'The patient is 68 with COPD, breathless, saturation 90% on air.',
        hint: 'Is this lung diseased, and is the patient symptomatic?',
        teachingPoint: 'A symptomatic secondary pneumothorax is drained and admitted.',
        sourceIds: ['bts-pleural-2023'],
        options: [
          {
            id: 'drain-admit',
            label: 'Small-bore chest drain and admission',
            rationale:
              'Yes. Underlying lung disease plus symptoms and hypoxia: a secondary pneumothorax that is drained.',
          },
          {
            id: 'conservative',
            label: 'Conservative management, as for the 24-year-old',
            rationale:
              'Diseased lung has little reserve and the air is less likely to resolve on its own. Conservative management is for the primary pneumothorax with minimal symptoms.',
            misconceptionId: 'pl-06.ssp-conservative',
          },
          {
            id: 'aspiration-home',
            label: 'Needle aspiration and discharge',
            rationale:
              'Aspiration and discharge belong to the symptomatic primary pneumothorax. A secondary pneumothorax with symptoms is admitted with a drain.',
            misconceptionId: 'pl-06.ssp-conservative',
          },
        ],
        answerId: 'drain-admit',
      },
    },
    provenance: PILOT_PROVENANCE,
  },
  {
    id: 'pl-07',
    topicId: 'pleural-procedures',
    secondaryTopicIds: ['pleural-disease'],
    title: 'Choose the site with the probe in the position you will use',
    competency:
      'You can plan an ultrasound-guided pleural procedure so that the scan, the mark and the needle share one patient position, and you can name what the scan has to show before you proceed.',
    whatToKnow: [
      'Ultrasound guidance is used for every pleural procedure for fluid, performed by the operator at the time of the procedure.',
      'Marking a site elsewhere and draining later in a different position is not acceptable: fluid moves with the patient, and the mark no longer shows where it is.',
      'Before the needle: identify the diaphragm and the organ under it, the lung and its movement, the depth of fluid at the site and the chest-wall thickness.',
      'Enter just above a rib, within the safe area of the chest wall, and avoid sites far posterior and medial where the intercostal artery is less protected by the rib.',
    ],
    prerequisites: [],
    concepts: ['imaging-interpretation', 'complication'],
    safetyCritical: true,
    misconceptions: [
      {
        id: 'pl-07.remote-mark',
        label:
          'A mark placed in the ultrasound department is good for a procedure later on the ward.',
        repair:
          'Between the two rooms the patient has moved, and so has the fluid. The scan that guides the needle is done by the operator, in the procedure position, immediately before the procedure.',
      },
      {
        id: 'pl-07.below-rib',
        label: 'Enter at the lower edge of the rib, where there is more space.',
        repair:
          'The intercostal vessels run under the lower edge of the rib above. The needle goes just above the rib below, into the upper part of the interspace.',
      },
    ],
    resources: [
      US_MODULE,
      THORACENTESIS_MODULE,
      {
        label: 'Pleural ultrasound simulator',
        href: '/pleural-procedures/pleural-ultrasound-simulator',
        kind: 'simulator',
      },
    ],
    sourceIds: ['bts-pleural-2023'],
    estimatedMinutes: 5,
    lab: {
      diagnose: {
        id: 'pl-07.diagnose',
        kind: 'choice',
        stem: 'A patient was scanned in the radiology department two hours ago, sitting upright, and the site for thoracentesis was marked. The patient is now semi-recumbent on the ward and a drain is planned. What do you do?',
        hint: 'What has happened to the fluid between the two rooms?',
        teachingPoint:
          'The scan that guides the needle is done by the operator, in the procedure position, immediately before the procedure.',
        sourceIds: ['bts-pleural-2023'],
        options: [
          {
            id: 'rescan',
            label:
              'Rescan at the bedside in the position the procedure will be done in, and choose the site from that scan',
            rationale:
              'Yes. The fluid has moved with the patient. Real-time or immediately preceding ultrasound by the operator is the standard.',
          },
          {
            id: 'use-mark',
            label: 'Use the mark; a radiologist placed it',
            rationale:
              'The mark was accurate for a different position two hours ago. The operator rescans in the position used.',
            misconceptionId: 'pl-07.remote-mark',
          },
          {
            id: 'sit-up',
            label: 'Sit the patient up to match the earlier scan and use the mark',
            rationale:
              'Even in the same posture the fluid may have shifted and the mark cannot be verified. The operator scans immediately before the procedure.',
            misconceptionId: 'pl-07.remote-mark',
          },
          {
            id: 'blind',
            label: 'Proceed without ultrasound; the effusion is large',
            rationale:
              'Ultrasound guidance is used for every pleural procedure for fluid regardless of size.',
          },
        ],
        answerId: 'rescan',
      },
      repair: {
        principle:
          'One position, one scan, one needle. The scan is only a guide while the patient has not moved since it was done.',
        explanation: [
          'Pleural fluid is free to move. A mark made in another room, or even in another posture, shows where the fluid was. The guideline therefore has the operator scan at the time of the procedure, in the position the needle will be placed, and mark and prepare without moving the patient.',
          'The scan has to show four things at the chosen site: the diaphragm and the liver or spleen beneath it, so the needle cannot reach them; the lung and whether it moves into the site during breathing; the depth of fluid, enough to accept the needle with margin; and the chest-wall thickness, which sets the depth you expect to feel the give.',
          'The entry point is just above the rib below the chosen interspace. The intercostal vessels run under the lower edge of the rib above, and are less protected the further posterior and medial the site is, so the lateral chest wall is preferred.',
        ],
        distinction:
          'The ultrasound is not a map to be read later; it is a live view of where the fluid is now. A mark is only valid while nothing has moved.',
        manipulate: {
          id: 'pl-07.manipulate',
          kind: 'predict',
          stem: 'Keep the procedure and change the scan.',
          baseline:
            'Bedside scan in the procedure position: a candidate site in the posterolateral chest wall.',
          change:
            'At that site the fluid is 1 cm deep and the lung moves into view with each breath.',
          hint: 'What has to be true at a site before the needle goes in?',
          teachingPoint:
            'Thin fluid with lung sliding into the site is not a safe target. Choose another site or interspace.',
          sourceIds: ['bts-pleural-2023'],
          options: [
            {
              id: 'move-site',
              label:
                'Choose a different site or interspace with deeper fluid and no lung entering the window',
              rationale:
                'Yes. Depth of fluid and a clear window through the breath cycle are preconditions.',
            },
            {
              id: 'proceed-careful',
              label: 'Proceed with a short needle and ask the patient to hold their breath',
              rationale:
                'One centimetre of fluid with lung intruding leaves no margin; breath-holding is not a safeguard.',
              misconceptionId: 'pl-07.remote-mark',
            },
            {
              id: 'go-lower',
              label:
                'Move one interspace lower where the fluid looks deeper, without re-identifying the diaphragm',
              rationale:
                'Deeper fluid lower down may be abdomen. Every new site is checked for the diaphragm and the organ beneath it.',
            },
          ],
          answerId: 'move-site',
        },
      },
      verify: {
        id: 'pl-07.verify',
        kind: 'sequence',
        stem: 'Put the steps of site selection for an ultrasound-guided thoracentesis in order.',
        hint: 'The position comes before anything that depends on it, and nothing moves after the mark.',
        teachingPoint:
          'Position, scan, choose, mark and prepare, then needle, with the patient still throughout.',
        sourceIds: ['bts-pleural-2023'],
        steps: [
          {
            id: 'scan',
            label:
              'Scan to identify the diaphragm, the fluid depth and the lung through the breath cycle',
          },
          { id: 'position', label: 'Position the patient as they will be for the procedure' },
          { id: 'insert', label: 'Anaesthetise and insert the needle just above the rib' },
          { id: 'choose', label: 'Choose the site with adequate fluid depth and a clear window' },
          { id: 'mark-prep', label: 'Mark and prepare the skin without moving the patient' },
        ],
        order: ['position', 'scan', 'choose', 'mark-prep', 'insert'],
        rationale:
          'The position is fixed first, because the scan is only valid for that position. The scan identifies the diaphragm, depth and lung; the site is chosen from it; the mark and preparation follow without movement; the needle enters just above the rib at the marked site.',
        earlyMisconceptions: { scan: 'pl-07.remote-mark', insert: 'pl-07.below-rib' },
      },
    },
    provenance: PILOT_PROVENANCE,
  },
]
