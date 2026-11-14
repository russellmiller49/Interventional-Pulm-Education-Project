import { clinicalLearningItemSchema } from '@/features/learning-module/activity/clinicalLearningItem'

import type { McsNumberId } from './teachingNumbers'

/**
 * Section 8, after the recap: two adults on a HeartMate 3 with no palpable pulse, one with an
 * adequate circulation and one in arrest, each worked to its first move.
 *
 * Four sources were read on 2026-11-03 and differ in two places, so the copy and the register show
 * both values:
 * - adequacy: MAP above 60 mm Hg and end-tidal CO₂ above 2 kPa in the 2024 British societies
 *   guideline and ERC 2025, against above 50 and above 20 mm Hg in AHA 2017 and AHA 2025;
 * - timing: CPR may wait at most 2 minutes for the pump in the British guideline (and in ERC 2025 for
 *   a lone rescuer), while AHA 2025 starts compressions at once with the device worked alongside.
 *
 * Patient B is set at the moment of discovery with two responders, where the keyed move holds under
 * AHA 2025 and ERC 2025 and the British guideline's deferral is permitted, not required. The HFSA,
 * SAEM and ISHLT consensus supplies the bedside device checks. Copy that names a pressure, a time, a
 * flow or an end-tidal CO₂ must match a register row or one of the case readings below;
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
  arrest: { capillaryRefillSeconds: 5 },
} as const

const { perfused, arrest } = MCS_LVAD_CASE_READINGS

export const MCS_LVAD_PERFUSION = {
  title: 'No pulse on an LVAD: perfused, or in arrest?',
  intro:
    'A continuous-flow pump leaves the arterial pulse small or absent. On an LVAD, a radial pulse you cannot feel, an automated cuff that gives no reading and a pulse oximeter with no trace are common, and none of them on its own means arrest. Read the circulation from the perfusion signs, never from the pulse alone.',
  signs: [
    { id: 'mentation', term: 'Mentation', finding: 'Responsive.' },
    {
      id: 'skin',
      term: 'Skin',
      finding:
        'Normal colour and temperature, not centrally cyanosed, with a normal capillary refill.',
    },
    {
      id: 'pressure',
      term: 'Pressure',
      finding:
        'Mean arterial pressure by Doppler with a manual cuff, or from an arterial line when there is one. The Doppler opening pressure stands in for the MAP, though it may read closer to the systolic.',
    },
    {
      id: 'etco2',
      term: 'End-tidal CO₂',
      finding:
        'In an intubated patient. AHA 2017 reads its threshold only through an endotracheal tube or tracheostomy, because a supraglottic airway gives a falsely elevated reading, and the British guideline warns that a loose mask or a laryngeal mask airway can mislead it.',
    },
    {
      id: 'controller',
      term: 'Controller',
      finding:
        'A normal display with no active alarm. The flow it shows is calculated from speed and power, not measured, so read it with the patient.',
    },
    {
      id: 'hum',
      term: 'Pump hum',
      finding: 'Heard on auscultation over the left chest and left upper abdomen.',
    },
  ],
  numbersTitle: 'An adequate circulation on an LVAD, in numbers',
  combining:
    'The sources also combine the signs differently. AHA 2025 counts the circulation as adequate when any one is present: normal skin colour and temperature, a normal capillary refill, a MAP above 50 mm Hg or an end-tidal CO₂ above 20 mm Hg. The British guideline reads several together, with clinical judgement, and draws its MAP line at 60 mm Hg.',
  deferralTitle: 'When compressions start',
  sequenceTitle: 'When the circulation is inadequate',
  sequence: [
    'Call the arrest team and the VAD team. The on-call VAD coordinator can guide the device checks by phone.',
    'The sources differ on timing. The British guideline allows CPR to wait at most 2 minutes while the pump is restored, and ERC 2025 keeps that delay for a rescuer working alone. AHA 2025 starts compressions at once, with the device worked alongside, and so does ERC 2025 when there are two or more of you.',
    'Controller: read the alarm. A blank HeartMate 3 screen can be normal, so press a button to wake it. A screen that stays blank means no power or a controller that has stopped working. Change the controller when that, or its own alarm, calls for it, with someone trained to do it.',
    'Power: the controller runs on two sources, two batteries or a battery and mains. Change a low or critical battery for a charged one, or connect mains power.',
    'Driveline: follow it from the controller to the exit site, under the binder and the dressing. On a HeartMate 3 the modular connector can come apart away from the controller.',
  ],
} as const

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
      stem: `Patient A has a HeartMate 3. On the evening round the nurse cannot feel a radial pulse, the automated cuff gives no reading and the pulse oximeter shows no trace. The patient is talking, the hands are warm and pink, and capillary refill is ${perfused.capillaryRefillSeconds} seconds. The Doppler MAP is ${perfused.dopplerMapMmHg} mm Hg, the controller shows a flow of ${perfused.controllerFlowLMin} L/min with no alarm, and the hum is clear over the chest. The nurse asks whether to call the arrest team. What is your first move?`,
      choices: [
        {
          id: 'adequate-no-compressions',
          label:
            'Confirm the circulation at the bedside and treat it as this patient’s usual state: no arrest call and no compressions. Record the Doppler MAP and the controller readings in place of a pulse and a cuff pressure.',
          plausibility: 'best',
          rationale:
            'Every sign of an adequate circulation is there, by either set of thresholds: responsive, warm and pink, a capillary refill under 3 seconds, a Doppler MAP above 60 mm Hg and so above 50, a quiet controller and an audible hum. A continuous-flow pump leaves little or no pulse, so the missing pulse, the blank cuff and the flat oximeter trace are what this circulation looks like.',
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
          rationale: `The cuff gives no reading because the pulse pressure is narrow, not because the pressure is low. The Doppler MAP of ${perfused.dopplerMapMmHg} mm Hg is the pressure, above the 60 mm Hg of the British guideline and the 50 mm Hg of the AHA.`,
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
        'No palpable pulse is an expected finding on a continuous-flow pump and does not, on its own, define arrest. Read mentation, skin colour, temperature and capillary refill, the Doppler MAP, end-tidal CO₂ when the patient is intubated, the controller and its alarms, and the hum. When they say the circulation is adequate, the patient is not in arrest, whatever the pulse.',
      evidenceIds: [
        'bsg-lvad-emergencies-2024',
        'aha-2025-special-circumstances',
        'aha-cpr-mcs-statement-2017',
        'hfsa-saem-ishlt-vad-emergency-2019',
      ],
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
      stem: `You and the bedside nurse find Patient B, also on a HeartMate 3, unresponsive and not breathing normally. The skin is grey and mottled, capillary refill is ${arrest.capillaryRefillSeconds} seconds, there is no Doppler signal and no hum over the chest, and the controller is alarming. The arrest team and the VAD coordinator have been called and are on their way. What is your first move?`,
      choices: [
        {
          id: 'compress-device-alongside',
          label:
            'Start chest compressions now while the nurse works the device at the same time: the controller alarm, both power sources and the whole driveline, including its modular connector.',
          plausibility: 'best',
          rationale:
            'No sign of an adequate circulation is present by any source: unresponsive, mottled, a slow capillary refill, no Doppler signal and no hum. With two of you, AHA 2025 and ERC 2025 start compressions at once and restore the device at the same time, so neither waits for the other. A HeartMate 3 driveline can come apart at its modular connector, away from the controller, so the nurse follows the whole line.',
        },
        {
          id: 'hold-for-the-graft',
          label:
            'Hold compressions, because they can tear the outflow graft, and work the device together until the VAD coordinator arrives.',
          plausibility: 'unsafe',
          rationale:
            'No study in the AHA 2025 review reported dislodgement after compressions, ERC 2025 judges the risk minimal, and the British guideline calls it probably overestimated. The belief that compressions are contraindicated is the commonest reason clinicians have withheld them from LVAD patients, and delayed compressions have been named as a possible contributor to poor outcomes. Waiting for the coordinator has no end point.',
        },
        {
          id: 'device-first-two-minutes',
          label:
            'Work the device first while the nurse takes the airway and the monitor, and start compressions if the pump has not restarted within 2 minutes.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'Defensible: it is the British guideline’s sequence, with CPR deferred at most 2 minutes, and the order of the AHA 2017 algorithm. ERC 2025 keeps that delay for a rescuer working alone. With two of you here, ERC 2025 and AHA 2025 start compressions now and restore the device at the same time, so the device work no longer delays the compressions.',
        },
        {
          id: 'carotid-pulse-first',
          label: 'Feel for a carotid pulse to confirm the arrest before starting compressions.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A pulse does not settle it on a continuous-flow pump: Patient A had none and was perfused. Every source reads the circulation from the perfusion signs, and none of them is present here.',
        },
      ],
      correctChoiceIds: ['compress-device-alongside'],
      explanation:
        'Read the circulation, not the pulse. When it is inadequate and there are two of you, compressions and the device work start together: compressions from one, the controller, power and the whole driveline from the other, and the VAD team on the phone. On timing, the sources differ only in how long CPR may wait: at most 2 minutes in the British guideline, and in ERC 2025 for a rescuer alone; not at all in AHA 2025.',
      evidenceIds: [
        'aha-2025-special-circumstances',
        'erc-2025-special-circumstances',
        'bsg-lvad-emergencies-2024',
        'hfsa-saem-ishlt-vad-emergency-2019',
      ],
      reviewStatus: 'draft',
    }),
  },
] as const
