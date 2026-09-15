import { ventilationUnitById, type VentilationObjective } from './learningCurriculum'

export interface VentilationQuestion {
  readonly id: string
  readonly unitId: string
  readonly objective: VentilationObjective
  readonly prompt: string
  /** `unsafe` marks an authored, potentially harmful choice; `safety` explains the harm in the stated case. Neither grades anything. */
  readonly choices: readonly {
    id: string
    label: string
    rationale: string
    unsafe?: boolean
    safety?: string
  }[]
  readonly correctId: string
  readonly provenance: 'authored-teaching-case'
  readonly authoredAt: '2026-09-05'
  readonly evidenceIds: readonly string[]
}

type Option = readonly [label: string, rationale: string, unsafe?: boolean, safety?: string]
function q(
  unitId: string,
  kind: string,
  prompt: string,
  correct: number,
  options: readonly Option[],
): VentilationQuestion {
  const unit = ventilationUnitById.get(unitId)
  if (!unit) throw new Error(`Unknown question unit: ${unitId}`)
  return {
    id: `${unitId}:${kind}`,
    unitId,
    objective: unit.objective,
    prompt,
    correctId: String(correct),
    choices: options.map(([label, rationale, unsafe, safety], index) => ({
      id: String(index),
      label,
      rationale,
      ...(unsafe ? { unsafe } : {}),
      ...(safety ? { safety } : {}),
    })),
    provenance: 'authored-teaching-case',
    authoredAt: '2026-09-05',
    evidenceIds: unit.evidenceIds,
  }
}

/** Distractors adapt the existing course-author casebook and lesson misconception rationales. */
export const ventilationUnitQuestions: readonly VentilationQuestion[] = [
  q(
    'breathing-with-support',
    'check',
    'In a passive supported breath, inspiration has just ended. Which event normally follows?',
    1,
    [
      [
        'The machine delivers another inward flow',
        'This skips expiration. The complete cycle includes gas leaving before the next inspiration.',
      ],
      [
        'Gas moves outward as the system recoils',
        'After inspiration, recoil drives outward flow through the expiratory pathway in this passive example.',
      ],
      [
        'Gas remains still until the next inspiration',
        'An end-inspiratory pause is a distinct maneuver, not the whole normal expiratory phase.',
      ],
    ],
  ),
  q(
    'breathing-with-support',
    'transfer',
    'A patient receives regular supported breaths, but oxygen transfer remains poor. Which interpretation best explains this possibility?',
    0,
    [
      [
        'Gas movement and oxygen transfer are different steps',
        'Delivering breaths moves gas to the airways; oxygen transfer also needs lung units that are both ventilated and perfused. Either step can fail while the other works.',
      ],
      [
        'Regular breath timing confirms effective oxygen transfer',
        'Tempting because the ventilator looks as if it is doing its job, but timing describes delivery only. Collapsed or flooded lung can receive regular breaths and still not transfer oxygen.',
      ],
      [
        'Outward gas movement prevents oxygen from reaching blood',
        'Expiration happens in every breath, including in patients whose oxygenation is normal, so it cannot explain why this patient’s oxygen transfer is poor.',
      ],
    ],
  ),
  q(
    'waveform-anatomy',
    'check',
    'During inspiration, inward flow stays constant. What should the breath-volume trace do while that flow continues?',
    2,
    [
      [
        'Stay level throughout the inward flow',
        'This confuses a constant rate of entry with a constant amount of gas.',
      ],
      [
        'Fall toward the start-of-breath baseline',
        'Falling volume would describe net gas leaving, not sustained inward flow.',
      ],
      [
        'Rise as incoming gas accumulates',
        'Volume is the running total of flow. Steady inward flow continues to add volume.',
      ],
    ],
  ),
  q(
    'waveform-anatomy',
    'transfer',
    'The flow trace lies below zero and becomes progressively closer to zero. Which description fits that interval?',
    0,
    [
      [
        'Gas is leaving at a decreasing rate',
        'Negative flow is outward in this display; approaching zero means less outward flow per unit time.',
      ],
      [
        'Gas is entering at a decreasing rate',
        'The direction depends on the side of zero, not whether the line slopes upward.',
      ],
      [
        'The breath volume is increasing steadily',
        'Outward flow reduces the volume referenced to this breath.',
      ],
    ],
  ),
  q(
    'controls-and-goals',
    'check',
    'The set mandatory rate is unchanged, but the total measured rate rises. What would best clarify the difference?',
    1,
    [
      [
        'Compare the oxygen setting with the saturation',
        'Those address oxygen delivery and response, not the source of additional breaths.',
      ],
      [
        'Compare effort with the start of each breath',
        'Patient effort can trigger extra breaths; relating effort to initiation helps interpret the total rate.',
      ],
      [
        'Compare the alarm limit with the set rate',
        'An alarm limit signals a boundary. It does not explain how breaths were initiated.',
      ],
    ],
  ),
  q(
    'controls-and-goals',
    'transfer',
    'A breath-size setting has been increased. Which observation most directly checks the delivered result?',
    2,
    [
      [
        'The selected mode name',
        'A name describes the mode, not how much volume was delivered on these breaths.',
      ],
      ['The entered setting value', 'Reading the instruction again does not check the result.'],
      [
        'The measured exhaled volume',
        'Exhaled volume helps assess delivery; pressure, effort, leaks, and the patient still need reassessment.',
      ],
    ],
  ),
  q(
    'mechanics-load-and-pressure',
    'check',
    'At unchanged flow, volume, and total PEEP, a passive patient’s peak pressure rises. A valid plateau is unchanged. Which load most likely increased?',
    0,
    [
      [
        'Resistance during gas movement',
        'The extra pressure occurs with flow, while the elastic pressure for this volume has changed little.',
      ],
      [
        'Elastic load during distension',
        'Greater elastic load at this volume and total PEEP would tend to raise the valid plateau.',
      ],
      [
        'Baseline pressure between breaths',
        'Total PEEP is unchanged in the stem, so a new baseline load does not explain the pattern.',
      ],
    ],
  ),
  q(
    'mechanics-load-and-pressure',
    'transfer',
    'A patient makes a strong inspiratory effort during a hold. The displayed plateau is low. What is the best interpretation?',
    1,
    [
      [
        'The low value confirms low lung stress',
        'Patient effort can lower airway pressure while contributing to lung distension. The number is not reassuring by itself.',
      ],
      [
        'Muscle activity confounds passive mechanics',
        'The muscles contribute pressure during the measurement. Do not interpret it as a passive peak-to-plateau split.',
      ],
      [
        'The low value confirms low airway resistance',
        'Resistance cannot be inferred from this effort-contaminated measurement alone.',
      ],
    ],
  ),
  q(
    'modes-and-breath-delivery',
    'check',
    'During conventional volume control, compliance falls while flow and the volume target stay unchanged. Assume no leak or pressure-limit interruption. What is expected?',
    2,
    [
      [
        'Volume falls at the same airway pressure',
        'That is the expected direction for a pressure-controlled breath at fixed pressure.',
      ],
      [
        'Volume stays fixed at lower airway pressure',
        'A stiffer respiratory system needs more, not less, pressure for the same volume.',
      ],
      [
        'Volume stays fixed at higher airway pressure',
        'The volume target is maintained under the stated assumptions; the required pressure rises.',
      ],
    ],
  ),
  q(
    'modes-and-breath-delivery',
    'transfer',
    'A passive patient is on conventional pressure control. Compliance improves with settings unchanged. Which delivered variable should be watched for an increase?',
    0,
    [
      [
        'Exhaled tidal volume',
        'At the same pressure and timing, improved compliance can yield more volume. Monitor delivery and lung protection.',
      ],
      [
        'Set inspiratory pressure',
        'This is the controlled setting in the stem; it has not been changed.',
      ],
      [
        'Set mandatory frequency',
        'The frequency setting does not automatically rise because compliance improves.',
      ],
    ],
  ),
  q(
    'lung-protection',
    'check',
    'An adult with ARDS gains substantial fluid weight. Which reference should guide how tidal volume is expressed per kilogram?',
    1,
    [
      [
        'Current weight after the fluid gain',
        'Fluid gain does not proportionally increase lung size. Actual weight is not the PBW reference.',
      ],
      [
        'Predicted weight from height and sex',
        'Guideline tidal-volume ranges are expressed per kilogram of predicted body weight, with inputs verified.',
      ],
      [
        'Average weight for the patient’s age',
        'Age-based average weight is not the guideline basis for tidal-volume scaling.',
      ],
    ],
  ),
  q(
    'lung-protection',
    'transfer',
    'An adult with ARDS has acceptable saturation. Which finding still calls for review of the ventilation strategy?',
    2,
    [
      [
        'A tidal volume indexed to predicted weight',
        'Indexing volume is an appropriate assessment step; the indexed value and other findings determine concern.',
      ],
      [
        'A plateau measured under passive conditions',
        'Valid measurement improves interpretation; the fact it was obtained is not itself the concerning finding.',
      ],
      [
        'A valid plateau above the guideline limit',
        'Oxygenation does not rule out injurious mechanical stress. ATS recommends plateau below 30 cmH₂O in adult ARDS.',
      ],
    ],
  ),
  q(
    'expiration-and-air-trapping',
    'check',
    'An obstructive patient still has outward flow when each new inspiration begins. What would shortening expiration tend to do?',
    0,
    [
      [
        'Increase the opportunity for gas trapping',
        'Outward flow at the next breath already shows incomplete emptying. Less expiratory time leaves more of each breath behind, so trapped volume and intrinsic PEEP can rise.',
      ],
      [
        'Increase the time available for gas release',
        'Shortening expiration means less time for gas release by definition. The reading is tempting because more breaths per minute can feel like more gas out, but each exhalation gets shorter.',
      ],
      [
        'Reduce resistance in the tube and airways',
        'Timing and obstruction are separate levers. Shortening expiration leaves the obstruction in place; treating the obstruction is what lets gas leave faster.',
      ],
    ],
  ),
  q(
    'expiration-and-air-trapping',
    'transfer',
    'A valid expiratory hold shows pressure above set PEEP. What does that difference represent in this passive example?',
    2,
    [
      [
        'Extra pressure chosen on the PEEP control',
        'The PEEP control sets the baseline the ventilator applies, and it has not changed. The console may display the higher total PEEP after the hold, but the excess was measured, not selected.',
      ],
      [
        'The flow-resistive peak during inspiration',
        'Peak pressure belongs to inspiration, when gas flows through the airways; its resistive part is the peak-to-plateau difference. An end-expiratory hold has no flow, so it contains no resistive pressure.',
      ],
      [
        'Intrinsic pressure remaining after expiration',
        'With flow stopped at end-expiration, the reading reflects pressure in the alveoli. The excess over set PEEP is intrinsic PEEP from gas that had not left before the next breath was due.',
      ],
    ],
  ),
  q(
    'triggering-and-cycling',
    'check',
    'Visible inspiratory efforts repeatedly occur without a machine breath following. Where is the mismatch located?',
    1,
    [
      [
        'The end of machine inspiration',
        'A cycling mismatch concerns when an existing supported inspiration ends.',
      ],
      [
        'The initiation of machine inspiration',
        'Efforts are not being followed by a breath. Assess triggering and the load the patient must overcome.',
      ],
      [
        'The delivery within machine inspiration',
        'A delivery mismatch occurs after a supported breath has started.',
      ],
    ],
  ),
  q(
    'triggering-and-cycling',
    'transfer',
    'A machine breath begins with patient effort, but support continues after the patient has started to exhale. Which feature should be assessed?',
    0,
    [
      [
        'The timing of cycling into expiration',
        'Support is ending late relative to the patient’s inspiration.',
      ],
      [
        'The oxygen fraction reaching the airway',
        'Oxygen fraction does not identify why support continues into patient expiration.',
      ],
      [
        'The delay before breath initiation',
        'The start aligned in this stem; the mismatch is at the other end of the breath.',
      ],
    ],
  ),
  q(
    'oxygenation-response',
    'check',
    'After PEEP increases, saturation rises but arterial pressure falls. Which response best fits the combined observations?',
    2,
    [
      [
        'Accept the change because saturation improved',
        'This overlooks a potentially important circulatory cost.',
        true,
        'Higher PEEP raises pressure in the chest, which can reduce venous return and cardiac output; the falling arterial pressure is the warning that this may be happening. Oxygen reaching the tissues depends on cardiac output as well as saturation, so it can fall while saturation rises, and accepting the change on saturation alone keeps that PEEP in place.',
      ],
      [
        'Treat the saturation reading as unreliable',
        'The findings can coexist. A pressure change can affect oxygenation and circulation differently.',
      ],
      [
        'Reassess perfusion and overall tolerance',
        'Judge oxygenation benefit together with pressure, volume, and circulatory tolerance.',
      ],
    ],
  ),
  q(
    'oxygenation-response',
    'transfer',
    'FiO₂ is increased with PEEP unchanged. Which statement describes what was directly changed?',
    1,
    [
      [
        'The pressure maintained between breaths',
        'That is PEEP, and the stem keeps PEEP unchanged. PEEP and FiO₂ are both oxygenation levers, which is why they are easy to confuse.',
      ],
      [
        'The oxygen fraction in inspired gas',
        'FiO₂ changes the oxygen concentration of every breath. Whether blood oxygen improves is a patient response that still has to be checked.',
      ],
      [
        'The effective volume clearing CO₂',
        'Tidal volume, rate, emptying and dead space set CO₂ clearance. Changing the oxygen fraction does not increase alveolar ventilation.',
      ],
    ],
  ),
  q(
    'ventilation-and-co2',
    'check',
    'CO₂ is rising while saturation remains acceptable. Which assessment best addresses the CO₂ problem?',
    0,
    [
      [
        'Delivered ventilation, emptying, and metabolic demand',
        'These are what set CO₂: the gas actually delivered, whether it can leave before the next breath and how much CO₂ the patient produces.',
      ],
      [
        'Oxygen concentration and the saturation alarm limit',
        'Tempting because the oxygen numbers are in front of you, but they describe oxygenation and when the monitor warns. Neither changes CO₂ removal.',
      ],
      [
        'Airway cuff pressure and the humidity setting',
        'Both matter in ventilator care, and a large cuff leak can lower delivered volume, but measuring delivery is how you would find that; they are not where the CO₂ question starts.',
      ],
    ],
  ),
  q(
    'ventilation-and-co2',
    'transfer',
    'The rate has just changed. Breath timing changes promptly, but a blood-gas response is not yet available. What is the best next interpretation?',
    2,
    [
      [
        'The rate change has already failed to affect CO₂',
        'Breath timing changed at once, but CO₂ takes longer to settle, so no result yet is not evidence that the change failed.',
      ],
      [
        'A repeat rate increase is needed immediately',
        'Tempting when CO₂ is the goal, but nothing yet shows the first change was insufficient.',
        true,
        'Stacking a second rate increase before the first has settled, and before checking emptying, can create trapping and hypotension while the CO₂ benefit is still unknown.',
      ],
      [
        'Mechanical effects need review before judging gas exchange',
        'Delivery and emptying can be checked now; gas exchange is judged on a blood gas taken after an appropriate interval.',
      ],
    ],
  ),
  q(
    'waveform-reading-sequence',
    'check',
    'The total rate is high. To distinguish patient demand from extra machine-triggered breaths, which observation is most useful?',
    1,
    [
      [
        'Whether the pressure alarm limit is high',
        'The limit does not explain who or what initiated each breath.',
      ],
      [
        'Whether effort precedes each machine breath',
        'Linking effort to initiation is the key discrimination; then assess the patient and trigger system.',
      ],
      [
        'Whether the oxygen concentration is high',
        'Oxygen concentration does not distinguish breath initiation mechanisms.',
      ],
    ],
  ),
  q(
    'waveform-reading-sequence',
    'transfer',
    'A peak-pressure rise is noticed on one breath. Which comparison provides the most useful next context?',
    0,
    [
      [
        'Pressure, flow, volume, and effort at matching times',
        'Synchronized traces put the pressure finding in its phase and patient context.',
      ],
      [
        'The peak alone against the previous alarm limit',
        'This tells you about an alarm threshold, not which load or interaction changed.',
      ],
      [
        'The current mode name against another device’s name',
        'Names are not a substitute for the delivered breath and patient response.',
      ],
    ],
  ),
  q(
    'dyssynchrony-mechanisms',
    'check',
    'A patient’s strong effort occurs during machine inspiration, with an inward dip in the pressure trace during fixed-flow volume delivery. Which mismatch deserves assessment?',
    2,
    [
      [
        'Failure of the patient to initiate a breath',
        'The machine inspiration is already underway when the effort and dip occur.',
      ],
      [
        'Failure of passive expiration to reach baseline',
        'That requires examination of the expiratory limb, not this inspiratory feature alone.',
      ],
      [
        'Delivered inspiratory flow relative to demand',
        'Effort deforming the pressure trace during delivery suggests assessing flow demand and its patient causes.',
      ],
    ],
  ),
  q(
    'dyssynchrony-mechanisms',
    'transfer',
    'A different patient has small efforts with no machine breath after them. What most helps separate this from an inspiratory delivery mismatch?',
    1,
    [
      [
        'The presence of a high total machine rate',
        'Rate alone does not locate the failure within the breath.',
      ],
      [
        'The absence of support after effort begins',
        'This points to initiation rather than inadequate delivery within an established inspiration.',
      ],
      [
        'The amount of oxygen selected at the airway',
        'The oxygen setting does not identify a trigger-versus-delivery mismatch.',
      ],
    ],
  ),
  q(
    'safety-reassessment-and-human-factors',
    'check',
    'A patient develops an alarm, new hypoxemia, hypotension, and asymmetric breath sounds. Which priority best fits?',
    0,
    [
      [
        'Get help and stabilize while assessing the cause',
        'Instability requires coordinated bedside support and urgent localization under local protocols.',
      ],
      [
        'Finish waveform classification before calling for help',
        'This delays stabilization of a deteriorating patient.',
        true,
        'New hypoxemia with hypotension can be fatal within minutes if the cause is not found and treated, and asymmetric breath sounds point to causes found at the bedside, such as a pneumothorax or a tube that has moved into the right main bronchus. Classifying the waveform before calling for help delays the support and bedside checks this patient needs now.',
      ],
      [
        'Acknowledge the alarm and observe for improvement',
        'Acknowledgment does not treat the cause of instability.',
        true,
        'Acknowledging the alarm changes only the warning; the hypoxemia, hypotension and asymmetric breath sounds are still there. Possible causes such as a pneumothorax or a displaced tube have to be found and treated, and in a patient this unstable, minutes spent watching for improvement can be fatal.',
      ],
    ],
  ),
  q(
    'safety-reassessment-and-human-factors',
    'transfer',
    'The alarm was acknowledged and the plan documented. The patient and delivered breath have not changed. What has been achieved?',
    2,
    [
      [
        'The physiologic cause has been corrected',
        'Neither acknowledgment nor documentation changes the cause.',
      ],
      [
        'A successful treatment response has been demonstrated',
        'A response requires reassessment after a meaningful intervention.',
      ],
      [
        'Communication tasks, with reassessment still needed',
        'These tasks matter, but completion is not evidence of physiologic improvement.',
      ],
    ],
  ),
  q(
    'high-peak-pressure-integration',
    'check',
    'At unchanged volume, flow, and total PEEP, peak and a valid plateau rise together in a passive patient. Expiratory flow finishes before the next breath. Which interpretation best fits?',
    1,
    [
      [
        'An isolated increase in flow resistance',
        'An isolated resistive rise would primarily widen the peak-to-plateau gap.',
      ],
      [
        'An increase in respiratory-system elastic load',
        'A higher passive plateau for the same volume and total PEEP supports an increased elastic load.',
      ],
      [
        'An isolated increase in trapped end-expiratory pressure',
        'The stem holds total PEEP constant and describes completed expiratory flow.',
      ],
    ],
  ),
  q(
    'high-peak-pressure-integration',
    'transfer',
    'Another patient has high pressure, persistent expiratory flow at the next breath, and worsening hypotension. What is the most appropriate priority?',
    0,
    [
      [
        'Urgent bedside support and assessment of incomplete emptying',
        'Flow still leaving at the next breath, rising pressure and falling blood pressure together point to trapped volume affecting the circulation. Getting help and assessing emptying treats the likely cause while the patient is supported.',
      ],
      [
        'A higher mandatory rate to correct gas exchange promptly',
        'Tempting when gas exchange looks like the problem, but more breaths per minute shorten each expiration, and this patient is already failing to empty.',
        true,
        'A higher rate shortens every expiration, so more gas is trapped, pressure in the chest rises further and blood pressure can fall further. Correcting CO₂ is not the immediate threat here.',
      ],
      [
        'A higher alarm limit while awaiting the next routine review',
        'An alarm limit changes when the ventilator warns you, not what is happening in the chest.',
        true,
        'Raising the limit silences a warning while trapped volume and hypotension continue, and a routine review is too slow for an unstable patient.',
      ],
    ],
  ),
]

export const ventilationPlacementQuestions: readonly VentilationQuestion[] = [
  q(
    'waveform-anatomy',
    'placement',
    'A breath has inward flow with increasing volume, followed by outward flow with falling volume. Which pair describes what flow and volume measure?',
    2,
    [
      [
        'Airway push and gas speed',
        'Pressure describes push; flow describes speed of gas movement.',
      ],
      [
        'Accumulated gas and airway push',
        'This reverses the meanings and substitutes pressure for volume.',
      ],
      [
        'Gas movement rate and accumulated gas',
        'Flow is a rate with direction; volume accumulates from that flow.',
      ],
    ],
  ),
  q(
    'modes-and-breath-delivery',
    'placement',
    'In conventional pressure control, airway resistance increases at unchanged settings. Which response most needs monitoring?',
    0,
    [
      [
        'A change in delivered tidal volume',
        'Pressure is controlled; the volume delivered over the available time can change.',
      ],
      [
        'An automatic increase in the set pressure',
        'The stem specifies fixed conventional settings, not an adaptive mode.',
      ],
      [
        'An automatic change in oxygen concentration',
        'Mechanics do not automatically change the FiO₂ setting.',
      ],
    ],
  ),
  q(
    'mechanics-load-and-pressure',
    'placement',
    'A plateau is recorded while the patient actively inspires. What is its main interpretive limitation?',
    1,
    [
      [
        'It directly measures the tube’s flow resistance',
        'A hold measurement with effort cannot isolate passive mechanics that way.',
      ],
      [
        'Patient muscle pressure contributes to the reading',
        'Effort changes airway pressure and prevents a simple passive mechanics interpretation.',
      ],
      [
        'It reflects the selected end-expiratory setting',
        'The measured value reflects more than the selected baseline.',
      ],
    ],
  ),
  q(
    'expiration-and-air-trapping',
    'placement',
    'Outward flow has not ended when the next inspiration starts. Which change could aggravate this pattern?',
    2,
    [
      [
        'Giving more time for expiration',
        'This works in the other direction. More expiratory time lets a slowly emptying lung get closer to its resting volume before the next breath.',
      ],
      [
        'Reducing a reversible airway obstruction',
        'This also helps emptying. Lower resistance lets gas leave faster, so more of the breath empties in the same expiratory time.',
      ],
      [
        'Delivering mandatory breaths more frequently',
        'More frequent breaths shorten each cycle. With inspiratory time unchanged, expiration absorbs the loss and more volume stays trapped.',
      ],
    ],
  ),
  q(
    'triggering-and-cycling',
    'placement',
    'Effort begins, a machine breath follows, and effort continues after support ends. Where does the described mismatch occur?',
    0,
    [
      [
        'At the end of machine inspiration',
        'The supported breath ends before patient inspiration has ended.',
      ],
      ['Before the machine breath begins', 'The start is not the mismatch described by the stem.'],
      ['During the delay in blood-gas response', 'Gas-response timing is a different phenomenon.'],
    ],
  ),
  q(
    'dyssynchrony-mechanisms',
    'placement',
    'Machine breaths repeatedly begin without visible preceding effort. What is the best next step?',
    1,
    [
      [
        'Increase assistance for presumed weak breaths',
        'No preceding effort suggests investigating triggering, not assuming inadequate assistance.',
      ],
      [
        'Inspect the circuit and trigger-related signals',
        'Leaks, condensate, or signal artifacts can contribute to extra machine breaths.',
      ],
      [
        'Raise the rate for presumed absent respiratory drive',
        'Extra machine breaths already occur; the cause needs assessment.',
      ],
    ],
  ),
  q(
    'ventilation-and-co2',
    'placement',
    'Saturation is acceptable, but CO₂ rises. What most directly addresses the underlying physiologic question?',
    2,
    [
      [
        'The FiO₂ setting compared with the oxygen alarm',
        'Both sit on the oxygenation side. They can look reassuring while CO₂ climbs.',
      ],
      [
        'The mode label compared with the device brand',
        'Names identify a mode or a console. They do not show how much gas reaches exchanging lung or leaves it.',
      ],
      [
        'Alveolar ventilation relative to metabolic production',
        'CO₂ is set by production relative to alveolar ventilation, so delivered volume, total rate, emptying and dead space are what to examine.',
      ],
    ],
  ),
  q(
    'safety-reassessment-and-human-factors',
    'placement',
    'A ventilated patient suddenly becomes hypoxemic and hypotensive during a high-pressure alarm. What is the best initial priority?',
    0,
    [
      [
        'Bedside assessment and support with urgent help',
        'Stabilization and cause localization should proceed together under local protocol.',
      ],
      [
        'Alarm acknowledgment and documentation alone',
        'These do not support a deteriorating patient.',
        true,
        'Acknowledging the alarm and writing it down do nothing to support the patient or find the cause. A high-pressure alarm with sudden hypoxemia and hypotension can come from an obstructed airway or a pneumothorax, and without bedside support and a search for the cause the patient may die within minutes.',
      ],
      [
        'Detailed waveform analysis before bedside evaluation',
        'This delays assessment and stabilization.',
        true,
        'In a patient this unstable, securing ventilation comes before diagnosis. Dangerous causes of a high-pressure alarm with hypoxemia and hypotension, such as an obstructed or displaced tube or a pneumothorax, are checked at the bedside by passing a suction catheter, checking the tube and examining the chest; detailed waveform analysis first spends minutes the patient may not have.',
      ],
    ],
  ),
]

/** A distinct mixed set of worked applications. The `:final` ids are kept for saved records; nothing here is a final check. */
export const ventilationFinalQuestions: readonly VentilationQuestion[] = [
  q(
    'modes-and-breath-delivery',
    'final',
    'A passive patient is on conventional volume control at unchanged flow and volume. Resistance increases without a change in compliance or total PEEP. What should change most directly?',
    1,
    [
      [
        'The selected tidal-volume target',
        'It remains the same in this conventional fixed-setting example.',
      ],
      [
        'The peak airway pressure during inspiration',
        'More pressure is required to move gas through the higher resistance.',
      ],
      [
        'The selected oxygen concentration',
        'FiO₂ does not change automatically with this mechanical load.',
      ],
    ],
  ),
  q(
    'oxygenation-response',
    'final',
    'A patient’s oxygen saturation rises after a pressure adjustment, while perfusion worsens. What best describes this response?',
    0,
    [
      [
        'A benefit accompanied by a possible circulatory cost',
        'Oxygenation and circulatory tolerance can move in opposite directions.',
      ],
      [
        'A successful change demonstrated by the saturation',
        'That interpretation overlooks the worsening perfusion.',
        true,
        'Worsening perfusion means less blood may be carrying oxygen to the tissues. A pressure change that raises saturation can also lower cardiac output, and oxygen delivery depends on both, so it can fall even as saturation improves. Calling the change a success on saturation alone would keep, or build on, a setting that may be reducing oxygen delivery.',
      ],
      [
        'A conflicting pattern best explained by sensor failure',
        'The two effects can coexist physiologically.',
      ],
    ],
  ),
  q(
    'triggering-and-cycling',
    'final',
    'The ventilator ends a breath while the patient is still trying to inhale. A second inflation follows with little gas leaving between. Which mismatch most directly explains the repeated inflations?',
    2,
    [
      [
        'A delay between neural onset and triggering',
        'The observed mismatch occurs at the first breath’s end; a delayed start is a different timing problem.',
      ],
      [
        'A delay in lung emptying after neural exhalation',
        'The patient is still inhaling when the first inflation ends. The initiating mismatch is earlier than passive emptying.',
      ],
      [
        'A shorter machine inspiratory time than neural inspiration',
        'Persistent patient inspiration after cycling can lead to another inflation and stacked volume.',
      ],
    ],
  ),
  q(
    'lung-protection',
    'final',
    'Two adults with ARDS have the same height and sex but very different actual weights. What follows for the PBW basis used to express tidal volume?',
    1,
    [
      [
        'Use the larger actual weight as the shared reference',
        'Actual weight is not the guideline PBW reference.',
      ],
      [
        'Use the same reference for the two patients',
        'Their relevant PBW inputs match; clinical settings still require individualized assessment.',
      ],
      [
        'Use the average of their measured body weights',
        'Averaging actual weight does not produce the guideline PBW basis.',
      ],
    ],
  ),
  q(
    'safety-reassessment-and-human-factors',
    'final',
    'After an intervention, the alarm becomes quieter but the patient remains hypoxemic and distressed. Which next step best assesses success?',
    0,
    [
      [
        'Reassess the patient, delivery, and original abnormal signals',
        'A successful response must be demonstrated in relevant physiology and patient findings.',
      ],
      [
        'Record completion because the sound has diminished',
        'Alarm behavior alone does not demonstrate resolution.',
        true,
        'Persistent hypoxemia and distress mean the problem has not resolved, and hypoxemia can be rapidly lethal. Recording completion because the alarm is quieter can stop the search for the cause and the escalation this patient still needs.',
      ],
      [
        'Raise the alarm limit to match the current display',
        'Changing the monitoring boundary does not correct the cause.',
        true,
      ],
    ],
  ),
  q(
    'mechanics-load-and-pressure',
    'final',
    'At the same volume and total PEEP, a valid passive plateau rises. Flow has not changed. What does the plateau change most directly suggest?',
    2,
    [
      [
        'A new trigger delay before inspiration',
        'Trigger delay is identified from effort and initiation, not this passive plateau change.',
      ],
      [
        'An isolated increase in tube flow resistance',
        'The flow-resistive contribution falls away during a valid hold.',
      ],
      [
        'A higher respiratory-system elastic load',
        'A rise in plateau at the same volume and total PEEP points to increased elastic load.',
      ],
    ],
  ),
  q(
    'ventilation-and-co2',
    'final',
    'A patient with rising CO₂ has a high total rate and persistent outward flow before every new breath. Which interpretation is most defensible?',
    1,
    [
      [
        'A high rate proves adequate CO₂ clearance',
        'Rate counts breaths, not the gas that reaches exchanging lung and leaves it. A high rate with incomplete emptying can coexist with rising CO₂.',
      ],
      [
        'Incomplete emptying may limit effective ventilation',
        'Outward flow at every breath start shows incomplete emptying. More rate would shorten expiration further, so the expected fall in CO₂ may not follow.',
      ],
      [
        'A higher oxygen fraction will directly clear the CO₂',
        'Oxygen fraction sets how much oxygen each breath carries; it does not increase alveolar ventilation, so it cannot clear CO₂. In some patients with COPD, extra oxygen can even raise CO₂.',
      ],
    ],
  ),
  q(
    'waveform-reading-sequence',
    'final',
    'A high total rate appears without a corresponding rise in observed patient effort. Which signal comparison best distinguishes extra machine breaths from patient-triggered breaths?',
    0,
    [
      [
        'Patient inspiration against ventilator inflation',
        'This tests whether each breath follows an apparent patient request.',
      ],
      [
        'Oxygen concentration against the set PEEP',
        'That comparison does not locate breath initiation.',
      ],
      [
        'Peak pressure against the high-rate alarm limit',
        'Those describe different quantities and do not answer the question.',
      ],
    ],
  ),
  q(
    'controls-and-goals',
    'final',
    'The entered tidal volume and measured exhaled volume differ substantially. Which response best checks the discrepancy?',
    2,
    [
      [
        'Use the entered number as the delivered volume',
        'The instruction is not proof of delivery.',
      ],
      [
        'Use the mode name as proof of correct delivery',
        'A mode name does not exclude limits, leaks, or measurement problems.',
      ],
      [
        'Assess delivery, circuit integrity, and measurement validity',
        'Compare setting and result, then investigate the patient, circuit, and signals.',
      ],
    ],
  ),
  q(
    'high-peak-pressure-integration',
    'final',
    'A new high-pressure alarm occurs with abrupt hypotension and asymmetric breath sounds. Which next priority is most appropriate?',
    1,
    [
      [
        'Wait for a relaxed plateau before requesting assistance',
        'A deteriorating patient cannot wait for a perfect mechanics measurement.',
        true,
        'A high-pressure alarm with abrupt hypotension and asymmetric breath sounds raises concern for a tension pneumothorax, and a patient this unstable may die within minutes if the cause is not treated. A plateau is worth measuring when possible, but waiting for a relaxed one before asking for help delays the support and treatment that come first.',
      ],
      [
        'Coordinate urgent bedside support and cause localization',
        'The clinical instability and examination demand concurrent stabilization and assessment under local protocol.',
      ],
      [
        'Silence the alarm while waiting for spontaneous resolution',
        'Acknowledgment does not treat the cause of instability.',
        true,
        'Silencing only mutes the alarm for a short time and treats nothing. High pressure, abrupt hypotension and asymmetric breath sounds together raise concern for a tension pneumothorax, which needs recognition and treatment rather than waiting; left untreated, a patient this unstable may die within minutes.',
      ],
    ],
  ),
]

export const ventilationQuestionById = new Map(
  [...ventilationUnitQuestions, ...ventilationPlacementQuestions, ...ventilationFinalQuestions].map(
    (item) => [item.id, item],
  ),
)
export function unitQuestion(unitId: string, kind: 'check' | 'transfer'): VentilationQuestion {
  const question = ventilationQuestionById.get(`${unitId}:${kind}`)
  if (!question) throw new Error(`Missing ventilation question: ${unitId}:${kind}`)
  return question
}
