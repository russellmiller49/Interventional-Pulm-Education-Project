import type { DecisionScenario } from '@/features/skill-lab/engine/types'

/**
 * Adult professional-education scenarios. Vitals are illustrative, all rescue
 * actions assume an activated local emergency response, and device-specific or
 * patient-specific decisions remain with the bedside airway team.
 */
export const tracheostomyScenarios: DecisionScenario[] = [
  {
    id: 'blocked-tracheostomy',
    title: 'Blocked or displaced tracheostomy',
    briefing:
      'A patient with a tracheostomy develops acute respiratory distress and poor airflow. Use the universal emergency sequence to find simple reversible obstruction while prioritizing oxygenation.',
    initialVitals: { spo2: 90, hr: 118, sbp: 138 },
    startNodeId: 'acute-distress',
    nodes: [
      {
        id: 'acute-distress',
        situation:
          'The patient is distressed, airflow through the tracheostomy is poor, and the capnography waveform is fading. What is the first response?',
        choices: [
          {
            id: 'help-oxygen-simple-causes',
            label:
              'Call expert airway help, apply oxygen to the face and stoma as appropriate, remove the cap/valve/HME, and remove the inner cannula',
            feedback:
              'This follows the universal sequence: help and oxygenation first, then remove the simplest external causes and the potentially blocked inner cannula.',
            isSafe: true,
            vitalsDelta: { spo2: 2, hr: -4 },
            nextNodeId: 'assess-patency',
          },
          {
            id: 'force-ventilation',
            label: 'Force bag ventilation through the tracheostomy before checking its position',
            feedback:
              'A displaced tube may sit in pretracheal tissue. Forceful ventilation can worsen surgical emphysema and does not establish a patent airway.',
            isSafe: false,
            vitalsDelta: { spo2: -8, hr: 14, sbp: -10 },
            nextNodeId: 'deterioration',
          },
          {
            id: 'wait-for-imaging',
            label: 'Wait for a chest radiograph before manipulating the tube',
            feedback:
              'Imaging must not delay the emergency airway sequence in a deteriorating patient.',
            isSafe: false,
            vitalsDelta: { spo2: -7, hr: 12 },
            nextNodeId: 'deterioration',
          },
        ],
      },
      {
        id: 'assess-patency',
        situation:
          'External attachments and the inner cannula are removed. How should tube patency be assessed next?',
        choices: [
          {
            id: 'pass-suction-catheter',
            label: 'Attempt to pass a suction catheter without force and suction if indicated',
            feedback:
              'A catheter that passes into the trachea supports tube patency and permits clinically indicated suction. Continue ABCDE reassessment and investigate partial obstruction.',
            isSafe: true,
            vitalsDelta: { spo2: 6, hr: -8 },
            nextNodeId: 'patency-restored',
          },
          {
            id: 'cannot-pass-escalate',
            label:
              'If the catheter will not pass, treat the tube as blocked or displaced, deflate the cuff while reassessing, and proceed through the local emergency oxygenation and tube-removal pathway',
            feedback:
              'Failure to pass a suction catheter is a key sign of obstruction or displacement. Do not persist with ventilation through an unproven tube.',
            isSafe: true,
            nextNodeId: 'expert-rescue',
          },
          {
            id: 'force-catheter',
            label: 'Push a rigid instrument through the tube until the blockage clears',
            feedback:
              'Blind force can injure the airway or create a false passage and is not part of the emergency algorithm.',
            isSafe: false,
            vitalsDelta: { spo2: -6, hr: 10 },
            nextNodeId: 'deterioration',
          },
        ],
      },
      {
        id: 'deterioration',
        situation:
          'The patient is now severely hypoxemic and the tracheostomy has not been shown to be patent.',
        choices: [
          {
            id: 'universal-rescue',
            label:
              'Stop ventilating through the unproven tube, activate the resuscitation team, and use the airway-specific primary and secondary oxygenation plan',
            feedback:
              'Oxygenation is the goal. The local algorithm determines face, stoma, oral, and advanced replacement options from the known anatomy.',
            isSafe: true,
            vitalsDelta: { spo2: 9, hr: -6 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'patency-restored',
        situation:
          'The inner cannula was obstructed; airflow and capnography recover after removal.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Removing the external attachment and inner cannula before assessing patency resolved the obstruction. Continue reassessment, secretion management, humidification review, and root-cause prevention.',
          referenceIds: [
            'tracheostomy-knowledge-base',
            'mcgrath-ntsp-2012',
            'ntsp-emergency-algorithm',
            'blakeman-aarc-2022',
          ],
        },
      },
      {
        id: 'expert-rescue',
        situation: 'The blocked or displaced tube is managed through the local emergency pathway.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Failure to pass a suction catheter triggered the blocked/displaced-tube pathway without forceful ventilation through an unproven tube.',
          referenceIds: [
            'tracheostomy-knowledge-base',
            'mcgrath-ntsp-2012',
            'ntsp-emergency-algorithm',
          ],
        },
      },
      {
        id: 'rescued-late',
        situation: 'Oxygenation is restored after avoidable delay and worsening hypoxemia.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'The patient was rescued, but forceful ventilation or delay occurred before the tracheostomy was proven patent. Use the fixed universal sequence early.',
          referenceIds: ['mcgrath-ntsp-2012', 'ntsp-emergency-algorithm'],
        },
      },
    ],
  },
  {
    id: 'fresh-tracheostomy-dislodgement',
    title: 'Fresh tracheostomy dislodgement',
    briefing:
      'A 3-day-old tracheostomy has come out during a turn. Treat the tract as fresh or immature for at least 7 days or until the first planned change and local maturity criteria are met.',
    initialVitals: { spo2: 91, hr: 122, sbp: 132 },
    startNodeId: 'tube-out',
    nodes: [
      {
        id: 'tube-out',
        situation:
          'The tube is outside the stoma. The upper airway is documented as patent and bag-mask ventilation was feasible before tracheostomy. What should happen first?',
        choices: [
          {
            id: 'oxygenate-above-call-help',
            label:
              'Call the airway/code team, oxygenate and ventilate from above, and avoid blind reinsertion into the fresh tract',
            feedback:
              'A fresh tract can collapse or lead into pretracheal tissue. Use the known patent upper airway while skilled replacement is prepared.',
            isSafe: true,
            vitalsDelta: { spo2: 6, hr: -8 },
            nextNodeId: 'plan-replacement',
          },
          {
            id: 'blind-reinsertion',
            label: 'Push the same tube back through the stoma immediately without visualization',
            feedback:
              'Blind reinsertion through an immature tract can create a false passage and delay effective oxygenation.',
            isSafe: false,
            vitalsDelta: { spo2: -9, hr: 14, sbp: -12 },
            nextNodeId: 'false-passage',
          },
        ],
      },
      {
        id: 'plan-replacement',
        situation:
          'Oxygenation from above is effective and the experienced airway team has arrived. What is the replacement strategy?',
        choices: [
          {
            id: 'visualized-replacement',
            label:
              'Use bronchoscopy or direct surgical visualization and the documented fresh-tracheostomy plan for controlled replacement',
            feedback:
              'Visualization and experienced tract management reduce the risk of false passage while the patient remains oxygenated from above.',
            isSafe: true,
            nextNodeId: 'replaced-safely',
          },
          {
            id: 'repeated-probing',
            label: 'Repeatedly probe the stoma because oxygenation is currently stable',
            feedback:
              'Temporary stability is time to organize controlled replacement, not permission to traumatize an immature tract.',
            isSafe: false,
            vitalsDelta: { spo2: -4, hr: 8 },
            nextNodeId: 'false-passage',
          },
        ],
      },
      {
        id: 'false-passage',
        situation:
          'Ventilation through the reinserted tube produces neck swelling with no reliable capnography.',
        choices: [
          {
            id: 'stop-false-passage',
            label:
              'Stop using the tube, return to the known oxygenation route, and have the expert team re-establish the airway under visualization',
            feedback:
              'Absent capnography and neck swelling suggest a false passage. Stop insufflating tissue and restore a proven airway route.',
            isSafe: true,
            vitalsDelta: { spo2: 7, hr: -5 },
            nextNodeId: 'rescued-after-false-passage',
          },
        ],
      },
      {
        id: 'replaced-safely',
        situation: 'The tube is replaced under visualization and confirmed with capnography.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'Fresh displacement is an oxygenation problem first. Avoid blind reinsertion, use the documented upper-airway route when available, and replace under experienced visualization.',
          referenceIds: [
            'tracheostomy-knowledge-base',
            'mcgrath-ntsp-2012',
            'mitchell-consensus-2013',
          ],
        },
      },
      {
        id: 'rescued-after-false-passage',
        situation: 'The airway is re-established after a false passage was recognized.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'The airway was rescued, but blind reinsertion created a false passage. A tract under 7 days old or before its first planned change remains high risk unless the airway team documents otherwise.',
          referenceIds: [
            'tracheostomy-knowledge-base',
            'mcgrath-ntsp-2012',
            'mitchell-consensus-2013',
          ],
        },
      },
    ],
  },
  {
    id: 'sentinel-tracheostomy-bleed',
    title: 'Sentinel tracheostomy bleed',
    briefing:
      'A small delayed or pulsatile bleed can precede catastrophic tracheo-innominate hemorrhage. Treat it as a surgical emergency until proven otherwise.',
    initialVitals: { spo2: 95, hr: 108, sbp: 116 },
    startNodeId: 'sentinel-bleed',
    nodes: [
      {
        id: 'sentinel-bleed',
        situation:
          'A small pulsatile bleed appears from the tracheostomy and then stops. The patient is currently awake. What is the safest response?',
        choices: [
          {
            id: 'activate-tif-pathway',
            label:
              'Treat as possible tracheo-innominate fistula: activate emergency surgical and massive-hemorrhage pathways and prepare trained temporizing maneuvers',
            feedback:
              'A self-limited sentinel bleed may be the only warning before exsanguination. Definitive surgical or endovascular control must be activated immediately.',
            isSafe: true,
            nextNodeId: 'major-bleeding',
          },
          {
            id: 'routine-observation',
            label: 'Document the event and observe because the bleeding stopped',
            feedback:
              'Apparent resolution is not reassuring in a possible sentinel bleed and can precede catastrophic hemorrhage.',
            isSafe: false,
            vitalsDelta: { hr: 16, sbp: -24, spo2: -5 },
            nextNodeId: 'unprepared-hemorrhage',
          },
        ],
      },
      {
        id: 'major-bleeding',
        situation:
          'Brisk bleeding begins while the definitive team is mobilizing. Which temporizing strategy is appropriate?',
        choices: [
          {
            id: 'trained-tamponade',
            label:
              'Maintain the airway, use trained cuff hyperinflation for tamponade, resuscitate, and continue directly toward definitive control',
            feedback:
              'Cuff hyperinflation can temporize bleeding. External or advanced digital compression is reserved for trained teams if bleeding persists; none of these replaces definitive control.',
            isSafe: true,
            vitalsDelta: { sbp: 8, hr: -4 },
            nextNodeId: 'temporized',
          },
          {
            id: 'remove-tube-unplanned',
            label: 'Remove the tracheostomy tube immediately without a distal airway plan',
            feedback:
              'Unplanned removal may eliminate cuff tamponade and worsen airway contamination. Airway and hemorrhage control must be coordinated by the definitive team.',
            isSafe: false,
            vitalsDelta: { spo2: -10, sbp: -28, hr: 20 },
            nextNodeId: 'unprepared-hemorrhage',
          },
        ],
      },
      {
        id: 'unprepared-hemorrhage',
        situation: 'Massive hemorrhage now fills the airway and the patient is unstable.',
        choices: [
          {
            id: 'late-definitive-pathway',
            label:
              'Activate massive transfusion and definitive surgical control now; trained teams use cuff and compression maneuvers while protecting oxygenation',
            feedback:
              'The same pathway is required, but the opportunity created by the sentinel bleed was lost.',
            isSafe: true,
            vitalsDelta: { spo2: 6, sbp: 18, hr: -8 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'temporized',
        situation:
          'Bleeding is temporarily controlled while the patient proceeds to definitive treatment.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'The sentinel bleed triggered immediate definitive mobilization. Cuff hyperinflation and trained compression are bridges to surgical or endovascular control, not endpoints.',
          referenceIds: ['tracheostomy-knowledge-base', 'allan-tif-2003'],
        },
      },
      {
        id: 'rescued-late',
        situation: 'Resuscitation and definitive control follow after catastrophic deterioration.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'The patient reached definitive treatment, but observing a sentinel bleed delayed hemorrhage control. Treat delayed or pulsatile tracheostomy bleeding as TIF until proven otherwise.',
          referenceIds: ['tracheostomy-knowledge-base', 'allan-tif-2003'],
        },
      },
    ],
  },
  {
    id: 'speaking-valve-distress',
    title: 'Distress during a speaking-valve trial',
    briefing:
      'A one-way valve redirects all exhaled gas around the tracheostomy tube and through the upper airway. Distress means the expiratory path must be restored immediately.',
    initialVitals: { spo2: 93, hr: 106, sbp: 126 },
    startNodeId: 'valve-distress',
    nodes: [
      {
        id: 'valve-distress',
        situation:
          'Seconds after a one-way valve is attached, the patient develops stridor, increasing effort, and no audible exhalation. What is the immediate action?',
        choices: [
          {
            id: 'remove-valve',
            label:
              'Remove the speaking valve immediately and restore a known patent breathing circuit',
            feedback:
              'Valve removal restores expiration through the tracheostomy and is the immediate response to distress.',
            isSafe: true,
            vitalsDelta: { spo2: 5, hr: -8 },
            nextNodeId: 'reassess-valve-readiness',
          },
          {
            id: 'inflate-cuff',
            label: 'Inflate the cuff while leaving the one-way valve attached',
            feedback:
              'An inflated cuff plus a one-way valve can eliminate the expiratory path completely and cause asphyxiation.',
            isSafe: false,
            vitalsDelta: { spo2: -12, hr: 18, sbp: -10 },
            nextNodeId: 'severe-air-trapping',
          },
          {
            id: 'coach-through',
            label: 'Coach the patient to tolerate the valve for several more minutes',
            feedback:
              'Distress is a stop signal, not an adaptation exercise. Remove the valve and reassess.',
            isSafe: false,
            vitalsDelta: { spo2: -7, hr: 12 },
            nextNodeId: 'severe-air-trapping',
          },
        ],
      },
      {
        id: 'reassess-valve-readiness',
        situation:
          'The patient improves after valve removal. What should be checked before any future trial?',
        choices: [
          {
            id: 'multidisciplinary-reassessment',
            label:
              'Confirm complete cuff deflation, upper-airway patency, room around the tube for exhalation, secretion control, and respiratory stability with trained staff',
            feedback:
              'Speaking-valve readiness is a circuit and airway assessment. Tube outer diameter, secretions, laryngeal or suprastomal obstruction, and cuff state can all prevent expiration.',
            isSafe: true,
            nextNodeId: 'trial-deferred',
          },
          {
            id: 'retry-unchanged',
            label: 'Retry the same setup immediately because saturation has recovered',
            feedback:
              'Recovery after valve removal confirms the need to investigate the expiratory pathway before another trial.',
            isSafe: false,
            vitalsDelta: { spo2: -5, hr: 8 },
            nextNodeId: 'severe-air-trapping',
          },
        ],
      },
      {
        id: 'severe-air-trapping',
        situation: 'The patient becomes severely hypoxemic with no effective expiratory route.',
        choices: [
          {
            id: 'remove-valve-rescue',
            label:
              'Remove the valve, deflate the cuff if needed to relieve trapping under the local airway plan, and support oxygenation and ventilation',
            feedback: 'The obstruction is relieved only when a route for exhaled gas is restored.',
            isSafe: true,
            vitalsDelta: { spo2: 10, hr: -10 },
            nextNodeId: 'rescued-late',
          },
        ],
      },
      {
        id: 'trial-deferred',
        situation: 'The valve is deferred pending airway and multidisciplinary reassessment.',
        choices: [],
        terminal: {
          outcome: 'rescued',
          debrief:
            'A one-way speaking valve is safe only when the cuff is fully deflated and exhaled gas has an adequate path around the tube and through a patent upper airway.',
          referenceIds: [
            'tracheostomy-knowledge-base',
            'ntsp-speaking-valve',
            'medrinal-consensus-2026',
          ],
        },
      },
      {
        id: 'rescued-late',
        situation: 'Expiration and oxygenation recover after delayed valve removal.',
        choices: [],
        terminal: {
          outcome: 'mixed',
          debrief:
            'The patient recovered, but delayed valve removal or cuff inflation worsened air trapping. Distress requires immediate valve removal.',
          referenceIds: ['ntsp-speaking-valve', 'tracheostomy-knowledge-base'],
        },
      },
    ],
  },
]
