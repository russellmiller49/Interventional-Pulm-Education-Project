import type { DecisionScenario } from '@/features/skill-lab/engine/types'

/**
 * Branching recognition-and-management drills for the Rigid Bronchoscopy
 * module. Each teaches how to recognize and manage an intraprocedural airway
 * emergency. Simulation only; vitals are illustrative, not patient-specific.
 *
 * Reference ids on terminals point at the module's paraphrased sources
 * (sakr-dutau-2010, ernst-cao-2004, chest-ip-2003, asa-or-fire-2013).
 */
export const rigidBronchoscopyScenarios: DecisionScenario[] = [
  {
    id: 'central-airway-hemorrhage',
    title: 'Central-airway hemorrhage',
    briefing:
      'During tumour debulking, brisk endobronchial bleeding fills the central airway. Protect the airway and achieve endobronchial hemostasis.',
    initialVitals: { spo2: 94, hr: 104, sbp: 128 },
    startNodeId: 'brisk-bleed',
    nodes: [
      {
        id: 'brisk-bleed',
        situation:
          'Brisk blood wells up from the tumour and pools in the central airway. What is your first priority?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'protect-airway',
            label:
              'Protect the airway: position the bleeding side down, suction, and prepare tamponade',
            feedback:
              'Protecting the contralateral lung — bleeding side down, suction, tamponade-ready — is the first priority in central-airway hemorrhage.',
            isSafe: true,
            nextNodeId: 'position-isolate',
          },
          {
            id: 'keep-coring',
            label: 'Keep coring to remove the bleeding source quickly',
            feedback:
              'Coring into a briskly bleeding tumour without airway protection soils the contralateral lung and worsens hypoxaemia.',
            isSafe: false,
            vitalsDelta: { spo2: -10, hr: 16 },
            nextNodeId: 'soiling',
          },
        ],
      },
      {
        id: 'position-isolate',
        situation:
          'The airway is suctioned and the bleeding side is dependent. How do you control the bleeding?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'tamponade-hemostatics',
            label:
              'Apply tamponade and topical hemostatics (cold saline, epinephrine, tranexamic acid), using APC or laser for a visible source',
            feedback:
              'Tamponade plus topical/pharmacologic hemostatics — with APC or laser for a visible source and lung isolation — is the endobronchial hemostasis response.',
            isSafe: true,
            nextNodeId: 'controlled',
          },
          {
            id: 'systemic-only',
            label: 'Rely on systemic measures and keep operating in the pooled blood',
            feedback:
              'Operating in pooled blood without local hemostasis or isolation risks losing the airway; local control and isolation come first.',
            isSafe: false,
            vitalsDelta: { spo2: -6 },
            nextNodeId: 'soiling',
          },
        ],
      },
      {
        id: 'soiling',
        situation: 'Blood has soiled the contralateral airway and the saturation is falling fast.',
        decisionSeconds: 15,
        choices: [
          {
            id: 'isolate-rescue',
            label:
              'Isolate the lungs, secure tamponade of the bleeding side, and restore oxygenation',
            feedback:
              'Lung isolation, tamponade, and restoring oxygenation are the rescue; protect the good lung earlier next time.',
            isSafe: true,
            vitalsDelta: { spo2: 7 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'controlled',
        situation: 'Bleeding is controlled and the airway is protected.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Central-airway hemorrhage is managed by protecting the airway (bleeding side down, lung isolation), tamponade, and endobronchial hemostasis before definitive control.',
          referenceIds: ['sakr-dutau-2010', 'ernst-cao-2004'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'Oxygenation is restored after the airway was soiled.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'The bleed was controlled, but operating without protecting the airway allowed soiling and desaturation. Position the bleeding side down and isolate early.',
          referenceIds: ['sakr-dutau-2010', 'ernst-cao-2004'],
        },
      },
    ],
  },
  {
    id: 'lost-airway',
    title: 'Lost airway during rigid insertion',
    briefing:
      'You cannot pass the rigid bronchoscope through the cords and the patient is desaturating. Re-establish oxygenation before anything else.',
    initialVitals: { spo2: 97, hr: 92, sbp: 130 },
    startNodeId: 'cannot-pass',
    nodes: [
      {
        id: 'cannot-pass',
        situation: 'You cannot pass the cords and the saturation begins to fall. What now?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'oxygenate-first',
            label:
              'Stop, withdraw, and re-oxygenate with bag-mask or a supraglottic device; call for help',
            feedback: 'Oxygenation comes before repeated attempts — stop, ventilate, and get help.',
            isSafe: true,
            nextNodeId: 'reattempt',
          },
          {
            id: 'force-attempts',
            label: 'Keep attempting to force the scope through the cords',
            feedback:
              'Repeated forceful attempts without oxygenation cause trauma and dangerous desaturation.',
            isSafe: false,
            vitalsDelta: { spo2: -12, hr: 18 },
            nextNodeId: 'critical-desat',
          },
        ],
      },
      {
        id: 'reattempt',
        situation: 'The patient is re-oxygenated and help is at hand. How do you proceed?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'optimize-reattempt',
            label:
              'Optimize position, confirm relaxation, and re-attempt under vision with the most experienced operator',
            feedback:
              'Optimizing the setup and re-attempting under vision with help maximizes a safe pass.',
            isSafe: true,
            nextNodeId: 'secured',
          },
          {
            id: 'blind-force',
            label: 'Re-attempt immediately and forcefully without changing anything',
            feedback:
              'Re-attempting without optimizing repeats the failure and risks the airway again.',
            isSafe: false,
            vitalsDelta: { spo2: -8 },
            nextNodeId: 'critical-desat',
          },
        ],
      },
      {
        id: 'critical-desat',
        situation: 'The patient is critically hypoxaemic with no secure airway.',
        decisionSeconds: 15,
        choices: [
          {
            id: 'rescue-oxygenation',
            label:
              'Prioritize rescue oxygenation (bag-mask / supraglottic), call for airway help, and follow a failed-airway plan',
            feedback:
              'Rescue oxygenation and a failed-airway plan take priority over another intubation attempt.',
            isSafe: true,
            vitalsDelta: { spo2: 8 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'secured',
        situation: 'The airway is secured under vision after optimization.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'A lost airway during rigid insertion is managed by oxygenation first, getting help, and re-attempting under vision after optimizing — not by forcing the scope.',
          referenceIds: ['chest-ip-2003'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'Oxygenation is restored with a rescue plan after repeated attempts.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'Oxygenation was eventually restored, but forceful repeated attempts risked the airway. Ventilate and get help before re-attempting.',
          referenceIds: ['chest-ip-2003'],
        },
      },
    ],
  },
  {
    id: 'airway-fire-safety',
    title: 'Operating-room airway-fire safety',
    briefing:
      'You are about to use the laser in a shared airway. Manage the fire triad — the oxidiser (FiO₂) is yours to control.',
    initialVitals: { spo2: 99, hr: 84, sbp: 126 },
    startNodeId: 'about-to-laser',
    nodes: [
      {
        id: 'about-to-laser',
        situation:
          'You are about to activate the Nd:YAG laser and the FiO₂ is 0.6. What must you do first?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'reduce-fio2',
            label:
              'Reduce FiO₂ to the lowest tolerated level and avoid nitrous oxide before activating the laser',
            feedback:
              'Minimizing FiO₂ (and avoiding N₂O) removes the oxidiser leg of the fire triad before airway energy is used.',
            isSafe: true,
            nextNodeId: 'monitor',
          },
          {
            id: 'laser-high-fio2',
            label: 'Activate the laser now to save time',
            feedback:
              'Using laser or electrosurgery in an oxygen-rich airway completes the fire triad and can cause an airway fire.',
            isSafe: false,
            vitalsDelta: { spo2: -4, hr: 20 },
            nextNodeId: 'fire',
          },
        ],
      },
      {
        id: 'monitor',
        situation:
          'FiO₂ is reduced and you begin. A moment later there is a flash at the tip. What is the immediate response?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'stop-gases-remove',
            label:
              'Stop the energy, stop the gases, remove the tube / flammable material, and flood the field with saline',
            feedback:
              'The fire response is: stop energy, stop gases, remove flammable material, and extinguish with saline — then ventilate and assess.',
            isSafe: true,
            nextNodeId: 'fire-controlled',
          },
          {
            id: 'continue-find-cause',
            label: 'Keep the oxygen flowing while you look for the cause',
            feedback: 'Leaving oxygen on feeds the fire; the gases must be stopped immediately.',
            isSafe: false,
            vitalsDelta: { spo2: -10 },
            nextNodeId: 'fire',
          },
        ],
      },
      {
        id: 'fire',
        situation: 'An airway fire is established with the oxygen still flowing.',
        decisionSeconds: 15,
        choices: [
          {
            id: 'execute-algorithm',
            label:
              'Execute the fire algorithm: stop gases, remove the tube, extinguish, then re-establish ventilation and assess for injury',
            feedback:
              'Follow the ASA/APSF airway-fire algorithm; prevention by FiO₂ reduction is far better than management.',
            isSafe: true,
            vitalsDelta: { spo2: 6 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'fire-controlled',
        situation: 'The flash is controlled immediately with no established fire.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Airway fire is prevented by reducing FiO₂ and avoiding N₂O before airway energy, and managed by immediately stopping energy and gases, removing flammable material, and extinguishing.',
          referenceIds: ['asa-or-fire-2013'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'The fire is extinguished after the algorithm is executed.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'The fire was controlled, but using energy at high FiO₂ caused it. Reduce FiO₂ and avoid N₂O before any airway energy device.',
          referenceIds: ['asa-or-fire-2013'],
        },
      },
    ],
  },
  {
    id: 'ventilation-barotrauma',
    title: 'Ventilation-related barotrauma',
    briefing:
      'During jet ventilation through the rigid scope, expiratory egress is compromised. Recognize gas trapping before it becomes barotrauma.',
    initialVitals: { spo2: 98, hr: 88, sbp: 124 },
    startNodeId: 'rising-pressure',
    nodes: [
      {
        id: 'rising-pressure',
        situation:
          'Chest excursion is increasing during jet ventilation and the airway is partially obstructed distally. What is your action?',
        decisionSeconds: 20,
        choices: [
          {
            id: 'ensure-egress',
            label: 'Pause jetting and ensure adequate expiratory egress before continuing',
            feedback:
              'Jetting against obstructed egress causes gas trapping and barotrauma; ensure the gas can escape before continuing.',
            isSafe: true,
            nextNodeId: 'stabilize',
          },
          {
            id: 'keep-jetting',
            label: 'Increase the jet rate to improve oxygenation',
            feedback:
              'Increasing jetting against obstructed egress worsens gas trapping and precipitates barotrauma.',
            isSafe: false,
            vitalsDelta: { spo2: -6, hr: 16, sbp: -12 },
            nextNodeId: 'barotrauma',
          },
        ],
      },
      {
        id: 'stabilize',
        situation: 'You paused jetting. The patient develops subcutaneous emphysema in the neck.',
        decisionSeconds: 20,
        choices: [
          {
            id: 'assess-adjust',
            label: 'Assess for pneumothorax, confirm egress, and adjust the ventilation strategy',
            feedback:
              'Recognizing barotrauma early, checking for pneumothorax, and adjusting the strategy limits harm.',
            isSafe: true,
            nextNodeId: 'controlled',
          },
          {
            id: 'ignore-continue',
            label: 'Ignore it and resume the original jetting settings',
            feedback: 'Ignoring subcutaneous emphysema and resuming risks a tension pneumothorax.',
            isSafe: false,
            vitalsDelta: { spo2: -8, sbp: -10 },
            nextNodeId: 'barotrauma',
          },
        ],
      },
      {
        id: 'barotrauma',
        situation:
          'The patient becomes hypotensive and hypoxaemic with a suspected tension pneumothorax.',
        decisionSeconds: 15,
        choices: [
          {
            id: 'decompress',
            label: 'Stop jetting, decompress the pneumothorax, and support the patient',
            feedback:
              'Stopping ventilation-induced trapping and decompressing the pneumothorax is the rescue.',
            isSafe: true,
            vitalsDelta: { spo2: 7, sbp: 10 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'controlled',
        situation: 'Gas trapping is relieved and the patient stabilizes with an adjusted strategy.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Ventilation-related barotrauma is avoided by ensuring expiratory egress during jet ventilation and recognized early by watching for subcutaneous emphysema and rising pressures.',
          referenceIds: ['chest-ip-2003'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'The pneumothorax is decompressed and the patient stabilizes.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'Barotrauma developed from jetting against obstructed egress. Ensure the gas can escape and recognize trapping before it becomes a tension pneumothorax.',
          referenceIds: ['chest-ip-2003'],
        },
      },
    ],
  },
]
