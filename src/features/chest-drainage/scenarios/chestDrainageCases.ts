import type { TroubleshootingScenario } from '../engine/scenarioEngine'

export const troubleshootingScenarios: TroubleshootingScenario[] = [
  {
    id: 'continuous-bubbling',
    title: 'Continuous Bubbling',
    learnerSees:
      'Persistent bubbling in the water seal / air leak monitor with a modeled high air-leak trend.',
    patientFirstPrompt:
      'Is the patient stable, more dyspneic, hypoxemic, or showing worsening distress?',
    bestReasoning:
      'Differentiate patient air leak from system leak by assessing the patient, inspecting the circuit, checking connections, and avoiding unsafe routine clamping.',
    debrief:
      'Continuous bubbling can be patient leak, system leak, or setup issue. The safest mental model is patient first, then tube, unit, source suction, and disease physiology.',
    actions: [
      {
        id: 'assess-and-check-connections',
        label: 'Assess patient, then check tube path and connections',
        result: 'safe',
        feedback:
          'Correct. Patient status anchors interpretation before circuit troubleshooting narrows the source.',
      },
      {
        id: 'increase-wall-suction',
        label: 'Increase wall suction first',
        result: 'partial',
        feedback:
          'This may change bubbling but does not identify patient vs system leak and can worsen some modeled risk states.',
      },
      {
        id: 'clamp-and-walk-away',
        label: 'Clamp the patient tube and reassess later',
        result: 'unsafe',
        feedback:
          'Unsafe in this model with an active leak. Air may be trapped if it cannot evacuate.',
      },
    ],
  },
  {
    id: 'no-tidaling',
    title: 'No Tidaling',
    learnerSees: 'No water-column swing and low displayed airflow.',
    patientFirstPrompt:
      'Is the patient clinically stable, and does imaging suggest lung re-expansion?',
    bestReasoning:
      'No tidaling has a differential: occlusion, kink, dependent loop, malposition, re-expansion, positive-pressure ventilation, or device design.',
    debrief:
      'Absent tidaling is not a diagnosis. Relieving a kink may restore flow; a fully expanded stable lung may also have little visible swing.',
    actions: [
      {
        id: 'assess-tube-and-imaging',
        label: 'Assess patient, tube course, and imaging context',
        result: 'safe',
        feedback:
          'Correct. This handles both benign and dangerous causes without a reflex maneuver.',
      },
      {
        id: 'flush-without-context',
        label: 'Flush or manipulate the tube without assessment',
        result: 'partial',
        feedback:
          'Tube patency can matter, but the action is incomplete without patient and indication context.',
      },
      {
        id: 'assume-emergency',
        label: 'Assume all no-tidaling is an emergency',
        result: 'unsafe',
        feedback: 'That overcalls benign possibilities and may trigger unnecessary unsafe actions.',
      },
    ],
  },
  {
    id: 'high-output',
    title: 'High Output',
    learnerSees: 'Collection chamber fills quickly with a rising fluid trend.',
    patientFirstPrompt:
      'Are there signs of bleeding, hemodynamic compromise, or expected drainage after insertion?',
    bestReasoning:
      'Output rate must be interpreted against indication, timing, fluid character, patient status, and local escalation pathways.',
    debrief:
      'The chamber scale is a measurement aid, not a standalone decision rule. Escalation thresholds are local and indication-specific.',
    actions: [
      {
        id: 'assess-output-character',
        label: 'Assess patient and output character, then escalate per pathway',
        result: 'safe',
        feedback:
          'Correct. The collection chamber reading is only meaningful with clinical context.',
      },
      {
        id: 'empty-and-ignore',
        label: 'Reset documentation and ignore the trend',
        result: 'unsafe',
        feedback:
          'Unsafe. High or changing output requires documentation and patient-centered interpretation.',
      },
      {
        id: 'lower-device',
        label: 'Ensure the unit is below the chest',
        result: 'partial',
        feedback:
          'Positioning matters, but it does not replace assessment of volume, character, and patient stability.',
      },
    ],
  },
  {
    id: 'high-negativity',
    title: 'High Negative Pressure',
    learnerSees:
      'Patient pressure float moves toward high negativity after cough and higher suction.',
    patientFirstPrompt:
      'Is the patient coughing, distressed, or exposed to aggressive stripping/milking?',
    bestReasoning:
      'Stop harmful maneuvers, assess patient and tube, and use relief features only according to device instructions and policy.',
    debrief:
      'High negative pressure is a signal to reassess the whole circuit and patient, not a reason for blind repeated venting.',
    actions: [
      {
        id: 'stop-stripping-assess',
        label: 'Stop stripping/milking and assess patient/system',
        result: 'safe',
        feedback:
          'Correct. The simulator lowers risk when harmful negative-pressure drivers are removed.',
      },
      {
        id: 'press-relief-repeatedly',
        label: 'Repeatedly press relief without assessing',
        result: 'partial',
        feedback:
          'A relief feature can be appropriate in context, but repeated use without assessment misses the cause.',
      },
      {
        id: 'increase-suction',
        label: 'Increase suction to overcome the pressure reading',
        result: 'unsafe',
        feedback:
          'Unsafe in this model because high negativity and re-expansion risk rise further.',
      },
    ],
  },
  {
    id: 'subcutaneous-emphysema',
    title: 'Subcutaneous Emphysema',
    learnerSees: 'Increasing crepitus with persistent bubbling.',
    patientFirstPrompt:
      'Is the patient worsening, and are tube side holes fully intrathoracic and patent?',
    bestReasoning:
      'Evaluate tube position, patency, leak size, evacuation capacity, and escalation needs.',
    debrief:
      'Subcutaneous air improves only when leak evacuation exceeds leak generation and the tube is positioned/patent.',
    actions: [
      {
        id: 'assess-position-patency',
        label: 'Assess patient, tube position, side holes, and patency',
        result: 'safe',
        feedback: 'Correct. This targets both leak generation and leak evacuation.',
      },
      {
        id: 'cover-crepitus',
        label: 'Apply dressing over crepitus and continue routine checks',
        result: 'unsafe',
        feedback: 'Unsafe. The underlying leak and evacuation problem remain unaddressed.',
      },
      {
        id: 'suction-only',
        label: 'Increase suction without tube assessment',
        result: 'partial',
        feedback:
          'Suction may be part of a plan, but tube position and patient status cannot be skipped.',
      },
    ],
  },
  {
    id: 'digital-blocked-tube',
    title: 'Digital Blocked-Tube Alarm',
    learnerSees: 'Blocked-tube alarm, lower output, and changing pressure trend.',
    patientFirstPrompt: 'Is there respiratory compromise or rapidly changing clinical status?',
    bestReasoning:
      'Assess patient, inspect tubing/canister, straighten kinks, check dependent loops, and follow device IFU for alarm workflow.',
    debrief:
      'A reset button does not fix an occluded tube. The alarm should trigger a structured inspection and reassessment.',
    actions: [
      {
        id: 'inspect-before-reset',
        label: 'Assess patient and inspect tubing/canister before reset',
        result: 'safe',
        feedback: 'Correct. The modeled alarm resolves when obstruction drivers are corrected.',
      },
      {
        id: 'reset-only',
        label: 'Silence/reset the alarm only',
        result: 'unsafe',
        feedback: 'Unsafe. The obstruction recurs because the cause was not corrected.',
      },
      {
        id: 'document-alarm',
        label: 'Document the alarm and continue rounds',
        result: 'partial',
        feedback: 'Documentation matters, but alarm cause and patient status still need attention.',
      },
    ],
  },
  {
    id: 'knocked-over-system',
    title: 'Knocked-Over System',
    learnerSees: 'Drainage unit is tipped and water seal readings are unreliable.',
    patientFirstPrompt: 'Was the tube disconnected or seal compromised, and is the patient stable?',
    bestReasoning:
      'Re-establish a closed upright system, assess seal integrity, and replace the unit if compromised per policy/IFU.',
    debrief:
      'A tipped system is both a device and patient-safety problem. The first move is not cosmetic; it is restoring a trustworthy closed circuit.',
    actions: [
      {
        id: 'restore-closed-system',
        label: 'Assess patient and restore a closed upright system',
        result: 'safe',
        feedback:
          'Correct. The simulator restores chamber reliability after upright closed setup returns.',
      },
      {
        id: 'shake-unit',
        label: 'Shake the device until water returns to the chamber',
        result: 'unsafe',
        feedback:
          'Unsafe. Seal integrity and device IFU matter; shaking is not a reliable corrective action.',
      },
      {
        id: 'clamp-briefly-policy',
        label: 'Consider brief protocol-driven clamping only if indicated',
        result: 'partial',
        feedback:
          'Potentially reasonable only under policy and context; it is not the primary teaching answer here.',
      },
    ],
  },
  {
    id: 'reexpansion-risk',
    title: 'Re-Expansion Risk',
    learnerSees: 'Large chronic collapse and high negative pressure with rapid modeled drainage.',
    patientFirstPrompt:
      'How chronic and large is the collapse/effusion, and what is the ordered drainage strategy?',
    bestReasoning:
      'Avoid abrupt high negative pressure in high-risk modeled states; reassess symptoms, imaging, output pace, and local strategy.',
    debrief:
      'The model raises a risk meter when chronic collapse, rapid expansion, and high negative pressure stack together.',
    actions: [
      {
        id: 'stage-and-monitor',
        label: 'Use staged drainage/monitoring per local pathway',
        result: 'safe',
        feedback:
          'Correct. This reduces the modeled risk drivers while preserving patient-centered reassessment.',
      },
      {
        id: 'max-suction',
        label: 'Maximize suction to finish drainage quickly',
        result: 'unsafe',
        feedback: 'Unsafe. The simulator increases re-expansion risk with abrupt high suction.',
      },
      {
        id: 'water-seal-only',
        label: 'Switch to water seal without reassessing',
        result: 'partial',
        feedback:
          'Lower suction may reduce one risk driver, but indication, symptoms, imaging, and output still matter.',
      },
    ],
  },
]
