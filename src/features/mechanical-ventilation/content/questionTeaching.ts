import { ventilationEvidenceById } from './evidence'
import { ventilationQuestionById } from './learningQuestions'

/**
 * MV-03 explanatory-feedback batch: ten short-case items on air trapping and on confusing
 * oxygenation with ventilation. Each says why it is here and explains itself without an answer.
 * Stems, choice labels and keyed choices are unchanged, so saved records keep their meaning; a
 * weak item is shown as a worked comparison instead of being re-keyed. None of this is reviewed.
 */
export const VENTILATION_QUESTION_TEACHING_VERSION = 'mv-03-2026-09-15'

export type VentilationQuestionDisposition = 'keep' | 'rewrite' | 'replace' | 'combine' | 'remove'

export interface VentilationWorkedComparison {
  readonly id: string
  readonly title: string
  readonly caption: string
  readonly columns: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

export interface VentilationQuestionTeaching {
  readonly questionId: string
  readonly disposition: VentilationQuestionDisposition
  /** The concept taught or the confusion addressed, as recorded in the question ledger. */
  readonly concept: string
  /** Why the item is here, shown to the learner. */
  readonly purpose: string
  /** Where to look, without giving the reading. Worked comparisons have nothing to answer. */
  readonly hint?: string
  /** A worked explanation that stands on its own, before or without an answer. */
  readonly explanation: string
  readonly nextCheck: string
  readonly presentation: 'question' | 'worked-comparison'
  readonly comparison?: VentilationWorkedComparison
  readonly combinedWith?: readonly string[]
  readonly evidenceIds: readonly string[]
  readonly review: 'not-reviewed'
}

const rateAndExpiratoryTime: VentilationWorkedComparison = {
  id: 'rate-and-expiratory-time',
  title: 'Set rate, inspiratory time and the time left to exhale',
  caption:
    'Arithmetic for mandatory breaths: cycle length is 60 seconds divided by the rate, and expiration gets what remains after inspiration. A patient who triggers extra breaths shortens the cycle further.',
  columns: ['Set rate (/min)', 'Cycle length (s)', 'Inspiratory time (s)', 'Expiratory time (s)'],
  rows: [
    ['12', '5.0', '1.0', '4.0'],
    ['20', '3.0', '1.0', '2.0'],
    ['30', '2.0', '1.0', '1.0'],
    ['20', '3.0', '1.5', '1.5'],
  ],
}

const oxygenationAndCo2Axes: VentilationWorkedComparison = {
  id: 'oxygenation-and-co2-axes',
  title: 'Two gas-exchange questions: oxygenation and CO₂ clearance',
  caption:
    'Main levers only. The columns interact: lung volume and tidal volume also affect oxygenation.',
  columns: ['Aspect', 'Oxygenation', 'CO₂ clearance'],
  rows: [
    [
      'Main ventilator levers',
      'FiO₂; PEEP, which keeps lung open and reduces shunt',
      'Tidal volume and total rate, and whether each breath empties',
    ],
    [
      'Patient factors',
      'Shunt and ventilation–perfusion mismatch',
      'Dead space and CO₂ production',
    ],
    ['What you read', 'Saturation, PaO₂', 'PaCO₂'],
    [
      'Not changed directly',
      'Raising FiO₂ does not increase alveolar ventilation',
      'Raising rate or tidal volume does not add oxygen to the inspired gas',
    ],
  ],
}

export const ventilationQuestionTeaching: readonly VentilationQuestionTeaching[] = [
  {
    questionId: 'expiration-and-air-trapping:check',
    disposition: 'replace',
    concept:
      'Expiratory time against a slowly emptying lung: how rate and inspiratory time decide the time left to exhale',
    purpose:
      'See how a setting decides the time the lung has to empty, before judging whether a change helps.',
    explanation:
      'Outward flow at the start of each breath means this lung has not finished emptying. For mandatory breaths, a higher rate shortens the cycle and the loss comes out of expiration; a longer inspiratory time at the same rate does the same. Less expiratory time leaves more volume behind, so the next breath starts higher and trapped volume and intrinsic PEEP can rise. More expiratory time or less obstruction helps the lung empty, although in severe obstruction flow can persist even with a long expiration.',
    nextCheck:
      'After any change in rate or inspiratory time, look at expiratory flow at the moment the next breath starts; in a passive patient, a valid expiratory hold measures the intrinsic PEEP.',
    presentation: 'worked-comparison',
    comparison: rateAndExpiratoryTime,
    evidenceIds: ['tobin-3e-copd', 'tobin-3e-setting-ventilator'],
    review: 'not-reviewed',
  },
  {
    questionId: 'expiration-and-air-trapping:transfer',
    disposition: 'rewrite',
    concept:
      'Set PEEP against total PEEP: an expiratory hold reads what the lung holds, including intrinsic PEEP',
    purpose:
      'Separate the PEEP you set from the pressure the lung actually holds at end-expiration.',
    hint: 'During an expiratory hold the valves close and flow stops. With nothing flowing, which pressure does the airway reading come to match?',
    explanation:
      'An expiratory hold closes the circuit at end-expiration. Once flow stops, airway pressure equilibrates with alveolar pressure, so the reading is total PEEP. Set PEEP is only the baseline the ventilator applies; the excess is intrinsic PEEP, from volume still trapped because expiration did not finish. For example, set PEEP 5 cmH₂O with a hold reading of 12 cmH₂O means intrinsic PEEP of about 7 cmH₂O. The number is interpretable only when the patient makes no inspiratory or expiratory effort during the hold and the pressure has had time to plateau, and it can underestimate trapping behind airways that close completely.',
    nextCheck:
      'Compare it with the expiratory flow trace: flow still present when the next breath starts is the waveform sign of the same trapped volume.',
    presentation: 'question',
    evidenceIds: [
      'tobin-3e-peep',
      'tobin-3e-setting-ventilator',
      'tobin-3e-monitoring',
      'tobin-3e-copd',
    ],
    review: 'not-reviewed',
  },
  {
    questionId: 'expiration-and-air-trapping:placement',
    disposition: 'rewrite',
    concept: 'Which control change takes time from expiration and worsens trapping',
    purpose:
      'Link a control change to the time the lung has to empty; the idea returns in every obstructive case.',
    hint: 'Each cycle is split between inspiration and expiration. Which change takes time away from expiration?',
    explanation:
      'Expiratory flow that has not reached zero when the next breath starts means the lung is still emptying. Delivering mandatory breaths more often shortens each cycle; with inspiratory time unchanged, the time comes out of expiration and more gas stays behind. At a rate of 20 with a 1.0-second inspiratory time, expiration has 2.0 seconds; at 30 it has 1.0 second. The other two changes help emptying, one by adding time and the other by letting gas leave faster.',
    nextCheck:
      'After a rate or inspiratory-time change, recheck whether expiratory flow reaches zero before the next breath; in a passive patient, measure intrinsic PEEP with a valid expiratory hold.',
    presentation: 'question',
    evidenceIds: ['tobin-3e-copd', 'tobin-3e-setting-ventilator'],
    review: 'not-reviewed',
  },
  {
    questionId: 'high-peak-pressure-integration:transfer',
    disposition: 'rewrite',
    concept:
      'Dynamic hyperinflation as a circulatory emergency, and why raising the rate or the alarm limit makes it worse',
    purpose:
      'Recognize trapped gas that has become a circulatory problem, and why the quick fixes on the console make it worse.',
    hint: 'Three findings arrive together. Which one explains the other two, and what does trapped volume do to blood returning to the heart?',
    explanation:
      'Expiratory flow still present when the next breath starts shows incomplete emptying. As trapped volume builds, pressure in the chest rises, venous return and right-ventricular filling fall, and blood pressure can drop sharply. High airway pressure and hypotension with that flow pattern make dynamic hyperinflation the leading explanation, while other causes of high pressure with hypotension, such as tension pneumothorax, stay on the list. Treat it as a bedside emergency: get help, support the patient and assess emptying under your local emergency protocol.',
    nextCheck:
      'Reassess the same signals after each action: whether expiratory flow now reaches zero before the next breath, whether intrinsic PEEP falls and whether blood pressure recovers.',
    presentation: 'question',
    evidenceIds: ['tobin-3e-copd', 'tobin-3e-fighting-ventilator'],
    review: 'not-reviewed',
  },
  {
    questionId: 'ventilation-and-co2:final',
    disposition: 'rewrite',
    concept: 'Breath count is not effective ventilation, and oxygen fraction does not clear CO₂',
    purpose:
      'Keep breath count, effective ventilation and oxygen fraction apart when CO₂ is rising.',
    hint: 'CO₂ leaves with gas that reaches exchanging lung and then gets out. What does the expiratory trace say about how much gets out before each breath?',
    explanation:
      'CO₂ is set by its production relative to alveolar ventilation, not by the number of breaths. Here flow is still outward when each breath starts, so every breath begins from a larger trapped volume. Adding rate would shorten expiration further and add to trapping, and the expected fall in CO₂ may not follow. Oxygen fraction acts on oxygenation, not on CO₂ clearance.',
    nextCheck:
      'Compare exhaled tidal volume and total rate with expiratory flow at each breath start, and measure intrinsic PEEP with a valid hold when the patient is passive.',
    presentation: 'question',
    evidenceIds: ['tobin-3e-setting-ventilator', 'tobin-3e-copd'],
    review: 'not-reviewed',
  },
  {
    questionId: 'oxygenation-response:transfer',
    disposition: 'combine',
    concept:
      'A control changes its own variable: FiO₂ is an oxygenation lever, distinct from PEEP and from ventilation',
    purpose:
      'Name what a single control changes directly, and keep the patient’s response as a separate observation.',
    explanation:
      'Raising FiO₂ changes one thing directly: the oxygen fraction of every breath, on the oxygenation side. Whether saturation or PaO₂ improves is the patient’s response, which you still check. It is not the pressure between breaths, which is PEEP and did not change, and it is not the ventilation that clears CO₂, which belongs to the other column.',
    nextCheck:
      'Watch saturation or PaO₂ for the response and read CO₂ separately; in some patients with COPD, extra oxygen can raise CO₂ indirectly.',
    presentation: 'worked-comparison',
    comparison: oxygenationAndCo2Axes,
    combinedWith: ['ventilation-and-co2:placement'],
    evidenceIds: ['tobin-3e-setting-ventilator', 'tobin-3e-peep', 'tobin-3e-copd'],
    review: 'not-reviewed',
  },
  {
    questionId: 'ventilation-and-co2:check',
    disposition: 'rewrite',
    concept:
      'Rising CO₂ with acceptable saturation: work from the determinants of CO₂, not the oxygen numbers',
    purpose:
      'Work the CO₂ problem with the quantities that set CO₂, even when the oxygen numbers look reassuring.',
    hint: 'Saturation and CO₂ answer different questions. Which quantities decide how much CO₂ leaves the lung each minute?',
    explanation:
      'Arterial CO₂ reflects CO₂ production relative to alveolar ventilation, the part of each minute’s ventilation that reaches gas-exchanging lung. So the check has three parts: whether the breaths are delivered as set (exhaled tidal volume and total rate), whether the lung empties before the next breath and whether CO₂ production has risen. Acceptable saturation shows oxygen transfer is adequate on the current settings; it says nothing about whether ventilation is keeping up with CO₂.',
    nextCheck:
      'Check exhaled tidal volume against the setting, then expiratory flow at the next breath start, before changing rate or tidal volume.',
    presentation: 'question',
    evidenceIds: ['tobin-3e-setting-ventilator', 'tobin-3e-copd'],
    review: 'not-reviewed',
  },
  {
    questionId: 'ventilation-and-co2:placement',
    disposition: 'combine',
    concept: 'Oxygenation and CO₂ clearance are separate questions with separate levers',
    purpose:
      'Separate the two gas-exchange questions before choosing a control: oxygenation and CO₂ clearance.',
    explanation:
      'These two findings sit on different axes. Acceptable saturation says oxygen transfer is adequate on the current FiO₂ and PEEP. Rising CO₂ says alveolar ventilation is not keeping up with CO₂ production. The CO₂ question is answered from the CO₂ column — delivered tidal volume and rate, emptying, dead space and production — not from oxygen settings or alarm limits.',
    nextCheck:
      'Read exhaled tidal volume, total rate and expiratory flow at the next breath start, then trend CO₂ on blood gases.',
    presentation: 'worked-comparison',
    comparison: oxygenationAndCo2Axes,
    combinedWith: ['oxygenation-response:transfer'],
    evidenceIds: ['tobin-3e-setting-ventilator', 'tobin-3e-peep', 'tobin-3e-copd'],
    review: 'not-reviewed',
  },
  {
    questionId: 'breathing-with-support:transfer',
    disposition: 'rewrite',
    concept: 'Breath delivery is not oxygen transfer: shunt and ventilation–perfusion mismatch',
    purpose:
      'Separate a ventilator that is delivering breaths from a lung that is exchanging gas; this is the first form of the oxygenation-versus-ventilation distinction.',
    hint: 'The ventilator can only deliver gas to the airways. What has to happen after the gas arrives for oxygen to reach the blood?',
    explanation:
      'A ventilator moves gas in and out of the airways. Oxygen reaches the blood only in lung units that receive that gas and are also perfused. When units are collapsed or flooded, blood passes them without picking up oxygen (shunt), and poorly matched units add to the deficit. In respiratory failure on the ventilator, this ventilation–perfusion problem, rather than breath delivery, is the usual cause of hypoxemia, so regular timing shows delivery, not adequate oxygen transfer.',
    nextCheck:
      'Read the oxygenation levers and response — FiO₂, PEEP, saturation or PaO₂ — separately from breath delivery; the oxygenation section compares them directly.',
    presentation: 'question',
    evidenceIds: ['tobin-3e-setting-ventilator', 'tobin-3e-fighting-ventilator'],
    review: 'not-reviewed',
  },
  {
    questionId: 'ventilation-and-co2:transfer',
    disposition: 'rewrite',
    concept:
      'Two clocks: breath timing changes at once and arterial CO₂ later, so check delivery and emptying before escalating',
    purpose: 'Keep two clocks apart: the breath changes on the next cycle, the blood gas later.',
    hint: 'Which effects of the change can you verify on the screen now, and which need time before they mean anything?',
    explanation:
      'A rate change alters breath timing on the next cycle, but arterial CO₂ moves to its new level more slowly, so an early or missing blood gas cannot show whether the change worked. What can be checked now is mechanical: whether the new rate is delivered, whether exhaled tidal volume held and whether expiratory flow still reaches zero before each breath. Judge CO₂ on a blood gas taken after an appropriate interval, then decide whether a further change is needed.',
    nextCheck:
      'Confirm delivered rate and exhaled volume, look at end-expiratory flow for new trapping, then plan when to repeat the blood gas.',
    presentation: 'question',
    evidenceIds: ['tobin-3e-setting-ventilator', 'tobin-3e-copd'],
    review: 'not-reviewed',
  },
]

export const ventilationQuestionTeachingById: ReadonlyMap<string, VentilationQuestionTeaching> =
  new Map(ventilationQuestionTeaching.map((teaching) => [teaching.questionId, teaching]))

for (const teaching of ventilationQuestionTeaching) {
  if (!ventilationQuestionById.has(teaching.questionId))
    throw new Error(`Teaching for unknown ventilation question: ${teaching.questionId}`)
  if ((teaching.presentation === 'worked-comparison') !== Boolean(teaching.comparison))
    throw new Error(`Worked comparison mismatch: ${teaching.questionId}`)
  if (teaching.presentation === 'question' && !teaching.hint)
    throw new Error(`Question without a hint: ${teaching.questionId}`)
  for (const id of teaching.evidenceIds)
    if (!ventilationEvidenceById.has(id))
      throw new Error(`Unknown evidence ${id} for ${teaching.questionId}`)
}
