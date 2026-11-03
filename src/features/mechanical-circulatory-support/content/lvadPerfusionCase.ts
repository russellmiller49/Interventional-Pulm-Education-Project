import { clinicalLearningItemSchema } from '@/features/learning-module/activity/clinicalLearningItem'

import { MCS_NUMBERS, type McsNumberId } from './teachingNumbers'

/**
 * Section 8, after the recap: two adults on a HeartMate 3 with no palpable pulse, one with an
 * adequate circulation and one in arrest, each worked to its first move.
 *
 * Every threshold is a register row read on 2026-11-03 from the 2024 British societies guideline,
 * full text and recommendation tables in PubMed Central. The 2017 AHA scientific statement on CPR
 * with mechanical circulatory support and the 2025 AHA special-circumstances guideline could not be
 * opened, so neither is cited and none of their figures is taught. Copy that names a pressure, a
 * time, a flow or an end-tidal CO₂ must match a register row or one of the case readings below;
 * `lvad-perfusion-case.test.tsx` checks it.
 */

export const MCS_LVAD_PERFUSION_SECTION_ID = 'lvad-alarms-emergencies'

/** The rows printed under the signs of an adequate circulation, in reading order. */
export const MCS_LVAD_ADEQUATE_CIRCULATION_NUMBER_IDS = [
  'lvad-adequate-capillary-refill',
  'lvad-adequate-map',
  'lvad-adequate-etco2',
  'lvad-adequate-controller-flow',
] as const satisfies readonly McsNumberId[]

/** The row the arrest decision rests on, shown once a move is chosen. */
export const MCS_LVAD_CPR_DEFERRAL_NUMBER_ID = 'lvad-cpr-deferral-limit' satisfies McsNumberId

/** The readings each stem gives, held here so the test can set them against the register. */
export const MCS_LVAD_CASE_READINGS = {
  perfused: { capillaryRefillSeconds: 2, dopplerMapMmHg: 74, controllerFlowLMin: 4.5 },
  arrest: { capillaryRefillSeconds: 5, minutesOnTheDevice: 2 },
} as const

const value = (id: McsNumberId) => MCS_NUMBERS.value(id)
const deferral = value(MCS_LVAD_CPR_DEFERRAL_NUMBER_ID)
const { perfused, arrest } = MCS_LVAD_CASE_READINGS

export const MCS_LVAD_PERFUSION = {
  title: 'No pulse on an LVAD: perfused, or in arrest?',
  intro:
    'A continuous-flow pump leaves the arterial pulse small or absent. On an LVAD, a radial pulse you cannot feel, an automated cuff that gives no reading and a pulse oximeter with no trace are common, and none of them on its own means arrest. Judge the circulation on several signs together, never on the pulse alone.',
  signs: [
    { id: 'mentation', term: 'Mentation', finding: 'Responsive.' },
    {
      id: 'skin',
      term: 'Skin',
      finding: 'Not centrally cyanosed, with a normal capillary refill.',
    },
    {
      id: 'pressure',
      term: 'Pressure',
      finding: 'Mean arterial pressure by Doppler, or from an arterial line when there is one.',
    },
    {
      id: 'etco2',
      term: 'End-tidal CO₂',
      finding:
        'In an intubated patient. It is only as good as the airway: a loose mask or a laryngeal mask airway can mislead it.',
    },
    {
      id: 'controller',
      term: 'Controller',
      finding:
        'A normal display with no active alarm. The flow it shows is estimated from power and hematocrit, not measured, so read it with the patient.',
    },
    { id: 'hum', term: 'Pump hum', finding: 'Heard on auscultation over the chest.' },
  ],
  numbersTitle: 'An adequate circulation on an LVAD, in numbers',
  deferralTitle: 'How long CPR waits for the pump',
  sequenceTitle: 'When the circulation is inadequate',
  sequence: [
    'Call the arrest team and the VAD team. The on-call VAD coordinator can guide the device checks by phone.',
    'One responder goes to the controller while another takes the airway, breathing and the ECG.',
    'Controller: a blank HeartMate 3 screen can be normal, so press a button to wake it. A screen that stays blank means no power or a controller that has stopped working: connect power, or change the controller.',
    'Power: change a low or critical battery for a charged one, or put the controller on mains power.',
    'Driveline: expose its whole length. On a HeartMate 3 the modular connector can come apart away from the controller.',
    `CPR waits ${deferral} for the pump. If the circulation is still inadequate, start compressions and keep the device work going beside them.`,
  ],
} as const

const evidenceIds = ['bsg-lvad-emergencies-2024']
const activityId = `mcs:learn:${MCS_LVAD_PERFUSION_SECTION_ID}`

export const MCS_LVAD_PERFUSION_DECISIONS = [
  {
    kind: 'perfused',
    title: 'Patient A: the evening round',
    item: clinicalLearningItemSchema.parse({
      id: 'mcs.learn.lvad-alarms-emergencies.no-pulse-perfused',
      activityId,
      phase: 'recognize',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: `Patient A has a HeartMate 3. On the evening round the nurse cannot feel a radial pulse, the automated cuff gives no reading and the pulse oximeter shows no trace. The patient is talking, the hands are warm, and capillary refill is ${perfused.capillaryRefillSeconds} seconds. The Doppler MAP is ${perfused.dopplerMapMmHg} mm Hg, the controller shows a flow of ${perfused.controllerFlowLMin} L/min with no alarm, and the hum is clear over the chest. The nurse asks whether to call the arrest team. What is your first move?`,
      choices: [
        {
          id: 'adequate-no-compressions',
          label:
            'Confirm the circulation at the bedside and treat it as this patient’s usual state: no arrest call and no compressions. Record the Doppler MAP and the controller readings in place of a pulse and a cuff pressure.',
          plausibility: 'best',
          rationale: `Every sign of an adequate circulation is there: responsive, warm, a capillary refill ${value('lvad-adequate-capillary-refill')}, a Doppler MAP ${value('lvad-adequate-map')}, a quiet controller and an audible hum. A continuous-flow pump leaves little or no pulse, so the missing pulse, the blank cuff and the flat oximeter trace are what this circulation looks like.`,
        },
        {
          id: 'call-arrest-compress',
          label:
            'Call the arrest team and start chest compressions: there is no palpable pulse and no recordable blood pressure.',
          plausibility: 'unsafe',
          rationale:
            'The patient is talking. Arrest on an LVAD is an inadequate circulation, read from mentation, skin, pressure, the controller and the hum, not a missing pulse. Compressions here would treat a finding the pump is expected to produce.',
        },
        {
          id: 'fluid-for-the-cuff',
          label: 'Treat it as hypotension: give a fluid bolus and repeat the automated cuff.',
          plausibility: 'incorrect-mechanism',
          rationale: `The cuff gives no reading because the pulse pressure is narrow, not because the pressure is low. The Doppler MAP of ${perfused.dopplerMapMmHg} mm Hg is the pressure, and it is ${value('lvad-adequate-map')}.`,
        },
        {
          id: 'arterial-line-first',
          label: 'Ask for an arterial line before deciding whether the patient is perfused.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'An arterial line gives a continuous pressure when an LVAD patient is unwell and needs one. This decision does not wait for it: mentation, skin, the Doppler MAP, the controller and the hum have already answered the question.',
        },
      ],
      correctChoiceIds: ['adequate-no-compressions'],
      explanation:
        'No palpable pulse is an expected finding on a continuous-flow pump and does not, on its own, define arrest. Read mentation, skin and capillary refill, the Doppler MAP, end-tidal CO₂ when the patient is intubated, the controller and its alarms, and the hum. When they say the circulation is adequate, the patient is not in arrest, whatever the pulse.',
      evidenceIds,
      reviewStatus: 'draft',
    }),
  },
  {
    kind: 'arrest',
    title: 'Patient B: found unresponsive',
    item: clinicalLearningItemSchema.parse({
      id: 'mcs.learn.lvad-alarms-emergencies.no-pulse-arrest',
      activityId,
      phase: 'recognize',
      itemType: 'management-decision',
      contextRequirement: 'context-independent',
      stem: `Patient B, also on a HeartMate 3, is found unresponsive and not breathing normally. The skin is grey and mottled, capillary refill is ${arrest.capillaryRefillSeconds} seconds, there is no Doppler signal and no hum over the chest. The arrest team and the VAD coordinator have been called. For ${arrest.minutesOnTheDevice} minutes the nurse has worked the device: a button press woke the controller screen, a charged battery is connected, and the driveline is seated in the controller. The controller is still alarming and the circulation has not come back. What is your first move?`,
      choices: [
        {
          id: 'compress-device-alongside',
          label:
            'Start chest compressions now, with one person still on the device: the whole driveline exposed, including its modular connector, and the VAD coordinator on the line.',
          plausibility: 'best',
          rationale: `The circulation is inadequate on every sign, and the time CPR may wait for the pump, ${deferral}, has been used. Compressions start and the device work goes on beside them. A HeartMate 3 driveline can come apart at its modular connector, away from the controller, so a driveline seated in the controller is not the whole check.`,
        },
        {
          id: 'hold-for-the-graft',
          label:
            'Hold compressions, because they can tear the outflow graft, and keep troubleshooting until the VAD coordinator arrives.',
          plausibility: 'unsafe',
          rationale:
            'The risk to the outflow graft has probably been overestimated, especially once the patient is past the early postoperative period, and the belief that CPR is unsafe on an LVAD has delayed CPR when it was needed. CPR can be performed safely in an LVAD patient with an inadequate circulation, and the time allowed for restoring the pump is spent.',
        },
        {
          id: 'carotid-pulse-first',
          label: 'Feel for a carotid pulse to confirm the arrest before starting compressions.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A pulse does not settle it either way on a continuous-flow pump: Patient A had none and was perfused. The decision rests on the signs already read: unresponsive, mottled, a slow capillary refill, no Doppler signal and no hum.',
        },
        {
          id: 'change-controller-first',
          label:
            'Change the controller first, and start compressions only if the pump does not restart.',
          plausibility: 'reasonable-but-incomplete',
          rationale: `A controller that stays blank after a button press means no power or a controller that has stopped working, and it is changed. This screen woke, and the time CPR may wait for the pump, ${deferral}, is spent. If the controller is to be changed, that happens beside the compressions, not before them.`,
        },
      ],
      correctChoiceIds: ['compress-device-alongside'],
      explanation: `A working pump is the most effective treatment an LVAD patient in arrest has, so the device comes first, but CPR waits ${deferral} for it. When the circulation is still inadequate, start compressions and keep the device work going beside them: power, the controller, the whole driveline and the VAD team.`,
      evidenceIds,
      reviewStatus: 'draft',
    }),
  },
] as const
