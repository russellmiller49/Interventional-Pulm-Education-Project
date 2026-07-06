import type { DecisionScenario } from '@/features/skill-lab/engine/types'

/**
 * Branching recognition-and-management drills for the Pleuroscopy module.
 * Each teaches how to recognize and respond to a post-/intra-procedural
 * complication. Simulation only; vitals are illustrative, not patient-specific.
 *
 * Reference ids on terminals point at the same paraphrased sources cited in the
 * module lessons (bts-pleural-2023, bts-procedures-2023, bts-lat-2010).
 */
export const pleuroscopyScenarios: DecisionScenario[] = [
  {
    id: 'biopsy-site-bleeding',
    title: 'Bleeding at the parietal biopsy site',
    briefing:
      'During a diagnostic pleuroscopy you are taking parietal pleural biopsies. Recognize and control biopsy-site bleeding while protecting the intercostal vessels.',
    initialVitals: { spo2: 97, hr: 90, sbp: 130 },
    startNodeId: 'ooze',
    nodes: [
      {
        id: 'ooze',
        situation:
          'Steady bleeding wells up from the biopsy bed after a parietal sample. What is your immediate priority?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'tamponade',
            label: 'Apply direct tamponade to the biopsy site and pause',
            feedback:
              'Direct pressure controls most biopsy-site oozing and buys time to plan the next sample.',
            isSafe: true,
            nextNodeId: 'over-rib',
          },
          {
            id: 'keep-biopsying',
            label: 'Keep taking biopsies to finish the sampling quickly',
            feedback:
              'Continuing to biopsy — especially away from a rib — risks the intercostal artery and worsens bleeding.',
            isSafe: false,
            vitalsDelta: { hr: 14, sbp: -16, spo2: -2 },
            nextNodeId: 'brisk',
          },
        ],
      },
      {
        id: 'over-rib',
        situation:
          'Bleeding slows with pressure. How will you take the remaining parietal biopsies?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'on-rib',
            label: 'Sample the parietal pleura directly over a rib',
            feedback:
              'Biopsying over a rib keeps you away from the intercostal neurovascular bundle in the lower border groove.',
            isSafe: true,
            nextNodeId: 'controlled',
          },
          {
            id: 'between-ribs',
            label: 'Sample in the intercostal space for a larger specimen',
            feedback:
              'The intercostal vessels run in the interspace; biopsying there risks significant bleeding.',
            isSafe: false,
            vitalsDelta: { hr: 10, sbp: -12 },
            nextNodeId: 'brisk',
          },
        ],
      },
      {
        id: 'brisk',
        situation: 'Bleeding is now brisk and the blood pressure is drifting down.',
        decisionSeconds: 15,
        choices: [
          {
            id: 'resus-escalate',
            label:
              'Apply firm tamponade, resuscitate, and escalate for haemostasis and surgical review',
            feedback:
              'Tamponade, resuscitation, and early escalation are the correct rescue for a bleeding intercostal vessel.',
            isSafe: true,
            vitalsDelta: { sbp: 8 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'controlled',
        situation: 'Bleeding is controlled and sampling is completed safely.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Recognizing biopsy-site bleeding early, controlling it with tamponade, and biopsying over ribs keeps the intercostal vessels safe.',
          referenceIds: ['bts-procedures-2023', 'bts-lat-2010'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'The bleed is finally controlled after escalation.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'The bleed was controlled, but continuing to biopsy near the intercostal vessels made it worse first. Tamponade early and biopsy over ribs.',
          referenceIds: ['bts-procedures-2023', 'bts-lat-2010'],
        },
      },
    ],
  },
  {
    id: 're-expansion-oedema',
    title: 'Re-expansion pulmonary oedema during drainage',
    briefing:
      'You are draining a large, long-standing effusion at pleuroscopy. Recognize re-expansion pulmonary oedema and drain in a controlled way.',
    initialVitals: { spo2: 95, hr: 96, sbp: 126 },
    startNodeId: 'draining',
    nodes: [
      {
        id: 'draining',
        situation:
          'After draining roughly a litre, the patient develops a cough and chest tightness. What now?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'stop-slow',
            label: 'Stop or slow drainage and reassess symptoms',
            feedback:
              'New cough or chest tightness during large-volume drainage suggests re-expansion; stopping is the right first move.',
            isSafe: true,
            nextNodeId: 'supportive',
          },
          {
            id: 'keep-draining',
            label: 'Continue draining to fully empty the pleural space',
            feedback:
              'Continuing high-volume drainage against symptoms increases the risk and severity of re-expansion oedema.',
            isSafe: false,
            vitalsDelta: { spo2: -9, hr: 18 },
            nextNodeId: 'rpe',
          },
        ],
      },
      {
        id: 'supportive',
        situation: 'You paused drainage. The patient is mildly breathless with a persistent cough.',
        decisionSeconds: 20,
        choices: [
          {
            id: 'oxygen-support',
            label: 'Give oxygen and supportive care, keep drainage controlled, and monitor',
            feedback:
              'Supportive care with controlled, volume-limited drainage manages mild re-expansion oedema.',
            isSafe: true,
            nextNodeId: 'settled',
          },
          {
            id: 'resume-fast',
            label: 'Resume rapid drainage now that fluid is flowing again',
            feedback:
              'Resuming rapid drainage re-triggers the same mechanism; keep it controlled and volume-limited.',
            isSafe: false,
            vitalsDelta: { spo2: -7 },
            nextNodeId: 'rpe',
          },
        ],
      },
      {
        id: 'rpe',
        situation:
          'The patient is now hypoxaemic with a cough productive of frothy sputum — re-expansion pulmonary oedema.',
        decisionSeconds: 15,
        choices: [
          {
            id: 'stop-support',
            label: 'Stop drainage, give oxygen and supportive care, and escalate as needed',
            feedback:
              'Management is supportive: stop draining, oxygenate, and support — most cases are self-limited but can be severe.',
            isSafe: true,
            vitalsDelta: { spo2: 5 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'settled',
        situation: 'Symptoms settle with controlled drainage and supportive care.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Limiting drainage volume and responding to early symptoms prevents severe re-expansion pulmonary oedema.',
          referenceIds: ['bts-procedures-2023'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'The patient recovers with supportive care after developing oedema.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'Re-expansion oedema developed because drainage continued against symptoms. Drain large effusions in a controlled, volume-limited way and stop when symptoms appear.',
          referenceIds: ['bts-procedures-2023'],
        },
      },
    ],
  },
  {
    id: 'prolonged-air-leak',
    title: 'Prolonged air leak after pleuroscopy',
    briefing:
      'Two days after talc poudrage the chest drain still has a continuous air leak. Manage it without trapping air.',
    initialVitals: { spo2: 95, hr: 88, sbp: 124 },
    startNodeId: 'leak',
    nodes: [
      {
        id: 'leak',
        situation:
          'The drain bubbles with a continuous air leak although the lung is up on imaging. What is the appropriate approach?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'continue-drainage',
            label: 'Continue drainage on an appropriate setting and keep the lung inflated',
            feedback:
              'Most post-thoracoscopy air leaks settle with continued drainage while the lung stays apposed.',
            isSafe: true,
            nextNodeId: 'persists',
          },
          {
            id: 'clamp-early',
            label: 'Clamp the drain to see whether the leak has stopped',
            feedback:
              'Clamping a bubbling drain can trap air and precipitate a tension pneumothorax — avoid it with an active leak.',
            isSafe: false,
            vitalsDelta: { spo2: -8, hr: 16 },
            nextNodeId: 'tension',
          },
        ],
      },
      {
        id: 'persists',
        situation: 'The leak is smaller but still present after several more days.',
        decisionSeconds: 20,
        choices: [
          {
            id: 'assess-escalate',
            label:
              'Check the drain and connections, keep the lung inflated, and discuss persistent-leak options with the team',
            feedback:
              'Confirm the system is intact, keep the lung up, and plan escalation (e.g. surgical review) for a truly persistent leak.',
            isSafe: true,
            nextNodeId: 'resolved',
          },
          {
            id: 'pull-drain',
            label: 'Remove the drain to encourage the leak to seal',
            feedback:
              'Removing a drain with an active leak risks pneumothorax; the drain should stay until the leak resolves.',
            isSafe: false,
            vitalsDelta: { spo2: -6 },
            nextNodeId: 'tension',
          },
        ],
      },
      {
        id: 'tension',
        situation:
          'The patient becomes acutely breathless and hypoxaemic with a rising heart rate — trapped air.',
        decisionSeconds: 15,
        choices: [
          {
            id: 'restore-drainage',
            label: 'Immediately re-establish drainage and support the patient',
            feedback:
              'Re-establishing drainage decompresses trapped air; never clamp or remove a drain with an active leak.',
            isSafe: true,
            vitalsDelta: { spo2: 6 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'resolved',
        situation:
          'The leak resolves on continued drainage and the drain is removed appropriately.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'A persistent air leak is managed by keeping the lung apposed on drainage and escalating for options — not by clamping or pulling the drain.',
          referenceIds: ['bts-procedures-2023'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'Drainage is re-established and the patient stabilizes.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'Trapping air by clamping or removing a drain with an active leak caused acute deterioration. Keep the drain draining and escalate persistent leaks.',
          referenceIds: ['bts-procedures-2023'],
        },
      },
    ],
  },
  {
    id: 'post-procedure-empyema',
    title: 'Post-procedure pleural infection',
    briefing:
      'Four days after pleuroscopy the patient returns febrile with turbid drain output. Recognize pleural-space infection and prioritize source control.',
    initialVitals: { spo2: 96, hr: 98, sbp: 118 },
    startNodeId: 'fever',
    nodes: [
      {
        id: 'fever',
        situation:
          'The drain is now draining turbid, purulent fluid and the patient is febrile. What is your priority?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'cultures-abx-drain',
            label: 'Send fluid for culture, start antibiotics, and ensure the space is drained',
            feedback:
              'Suspected pleural-space infection is managed with cultures, antibiotics, and effective drainage/source control.',
            isSafe: true,
            nextNodeId: 'source-control',
          },
          {
            id: 'reassure-oral',
            label: 'Reassure, remove the drain, and arrange outpatient oral antibiotics',
            feedback:
              'Removing drainage from an infected space and undertreating risks progression to established empyema and sepsis.',
            isSafe: false,
            vitalsDelta: { hr: 12, sbp: -10 },
            nextNodeId: 'sepsis',
          },
        ],
      },
      {
        id: 'source-control',
        situation:
          'Cultures are sent and antibiotics started. The collection looks loculated on imaging.',
        decisionSeconds: 20,
        choices: [
          {
            id: 'ensure-drainage',
            label:
              'Confirm the drain is working, image the collection, and escalate if drainage stalls',
            feedback:
              'Effective drainage and early reassessment are central; escalate (e.g. intrapleural therapy or surgery) if it stalls.',
            isSafe: true,
            nextNodeId: 'controlled',
          },
          {
            id: 'wait-abx',
            label: 'Rely on antibiotics alone and defer any drainage decision',
            feedback:
              'Antibiotics without source control are a classic pitfall in pleural infection; drainage matters.',
            isSafe: false,
            vitalsDelta: { hr: 10 },
            nextNodeId: 'sepsis',
          },
        ],
      },
      {
        id: 'sepsis',
        situation: 'The patient becomes tachycardic and hypotensive with worsening infection.',
        decisionSeconds: 15,
        choices: [
          {
            id: 'resus-source',
            label: 'Resuscitate, confirm antibiotics, and achieve source control with drainage',
            feedback:
              'Sepsis from a pleural space needs resuscitation, antibiotics, and prompt source control.',
            isSafe: true,
            vitalsDelta: { sbp: 8 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'controlled',
        situation: 'The infection is controlled with antibiotics and effective drainage.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Post-procedure pleural infection is caught early with cultures, antibiotics, and effective drainage — escalating when drainage stalls.',
          referenceIds: ['bts-pleural-2023', 'bts-procedures-2023'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'The patient is resuscitated and source control is achieved.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'Undertreating an infected pleural space by relying on antibiotics alone or removing drainage allowed progression. Prioritize source control.',
          referenceIds: ['bts-pleural-2023', 'bts-procedures-2023'],
        },
      },
    ],
  },
]
