export type HotspotControl =
  | 'sourceSuction'
  | 'drySuctionTarget'
  | 'waterSeal'
  | 'airLeak'
  | 'collection'
  | 'patientPressure'
  | 'clamp'
  | 'upright'
  | 'reference'

export interface DrySealHotspot {
  id: string
  label: string
  x: number
  y: number
  control: HotspotControl
  role: string
  knobology: string
  caution: string
}

export const drySealHotspots: DrySealHotspot[] = [
  {
    id: 'suction-port',
    label: 'Suction port',
    x: 61,
    y: 8,
    control: 'sourceSuction',
    role: 'Connection point for wall/source suction in this dry suction model.',
    knobology:
      'Increasing source flow makes the suction indicator more likely to appear, but the dial remains the target setting.',
    caution:
      'Do not treat the wall regulator number as the same thing as patient pleural pressure.',
  },
  {
    id: 'positive-pressure-release',
    label: 'Positive pressure release valve',
    x: 13,
    y: 13,
    control: 'patientPressure',
    role: 'A safety feature that vents excessive positive pressure from the drainage circuit.',
    knobology:
      'Watch the patient pressure float and patient status; positive pressure is interpreted in context.',
    caution:
      'Persistent pressure problems require patient assessment and system evaluation, not repeated venting alone.',
  },
  {
    id: 'water-seal-chamber',
    label: 'Water seal chamber',
    x: 23,
    y: 70,
    control: 'waterSeal',
    role: 'One-way seal and display chamber for air leak bubbling, tidaling, and pressure changes.',
    knobology:
      'Fill to the ordered/manufacturer fill mark in real life; this simulator uses 2 cm as a classic teaching reference.',
    caution: 'Too little water can compromise the seal; too much can increase resistance.',
  },
  {
    id: 'dry-suction-regulator',
    label: 'Dry suction regulator',
    x: 18,
    y: 29,
    control: 'drySuctionTarget',
    role: 'Dial that sets the target suction level for the regulator.',
    knobology:
      'Rotate the dial target, then confirm source suction and indicator status rather than trusting the knob alone.',
    caution:
      'Changing suction can change air leak appearance and re-expansion risk in selected clinical contexts.',
  },
  {
    id: 'suction-monitor-bellows',
    label: 'Suction monitor bellows',
    x: 22,
    y: 40,
    control: 'sourceSuction',
    role: 'Visual confirmation that source suction is sufficient for the dry suction regulator.',
    knobology:
      'Raise source flow until the indicator appears in the simulator; if absent, troubleshoot source and tubing setup.',
    caution: 'An absent indicator means the set dial target may not be achieved.',
  },
  {
    id: 'air-leak-monitor',
    label: 'Air leak monitor',
    x: 21,
    y: 76,
    control: 'airLeak',
    role: 'Displays bubbling levels from modeled patient or system air flow.',
    knobology:
      'Adjust air leak severity and cough to see bubbling move from intermittent to higher-level bubbling.',
    caution: 'Continuous bubbling requires a patient-first troubleshooting sequence.',
  },
  {
    id: 'patient-pressure-float-ball',
    label: 'Patient pressure float ball',
    x: 28,
    y: 78,
    control: 'patientPressure',
    role: 'Pressure indicator that moves with pleural pressure, ventilation mode, suction, and cough.',
    knobology: 'Toggle ventilation mode and cough to watch how pressure interpretation changes.',
    caution: 'Pressure displays support assessment; they do not replace clinical evaluation.',
  },
  {
    id: 'collection-chamber',
    label: 'Collection chamber',
    x: 67,
    y: 56,
    control: 'collection',
    role: 'Graduated chamber that tracks modeled fluid output over time.',
    knobology:
      'Increase output or fluid production to fill the chamber and watch canister capacity warnings.',
    caution:
      'Real output interpretation depends on indication, timing, bleeding risk, and local pathways.',
  },
  {
    id: 'filtered-high-negativity-vent',
    label: 'Filtered manual high negativity vent',
    x: 40,
    y: 12,
    control: 'patientPressure',
    role: 'Manual vent concept for excessive negative pressure in selected device designs.',
    knobology:
      'Lower suction target or relieve modeled negativity to see the patient pressure float return toward baseline.',
    caution: 'Use of relief features is device- and policy-specific.',
  },
  {
    id: 'needleless-access-port',
    label: 'Needleless access port',
    x: 70,
    y: 5,
    control: 'reference',
    role: 'Access point concept for sampling or system management when present on a device.',
    knobology:
      'The module keeps this as an anatomy hotspot because device-specific steps depend on the current IFU.',
    caution: 'Do not generalize access technique across manufacturers.',
  },
  {
    id: 'inline-connector',
    label: 'In-line connector',
    x: 72,
    y: 10,
    control: 'reference',
    role: 'Connection point where leaks, disconnections, or loose fittings may occur.',
    knobology:
      'Use continuous bubbling cases to practice checking connections after patient assessment.',
    caution: 'Do not skip the patient while focusing on the connector.',
  },
  {
    id: 'multi-position-hangers',
    label: 'Multi-position hangers',
    x: 72,
    y: 13,
    control: 'upright',
    role: 'Hardware for keeping the unit below the chest and stable.',
    knobology:
      'Toggle upright state and height below the chest to see how positioning affects the model.',
    caution: 'A tipped or elevated drainage unit can compromise readings and drainage.',
  },
  {
    id: 'easy-handle',
    label: 'Easy-to-grip handle',
    x: 48,
    y: 5,
    control: 'upright',
    role: 'Transport feature that should preserve upright, below-chest positioning.',
    knobology:
      'Use the positioning controls to compare upright transport with a knocked-over system.',
    caution: 'Mobility does not remove the need for tube security and patient assessment.',
  },
  {
    id: 'swing-out-floor-stand',
    label: 'Swing out floor stand',
    x: 48,
    y: 86,
    control: 'upright',
    role: 'Stabilizes the unit on the floor and supports upright chamber readings.',
    knobology:
      'Knock the unit over in the simulator to see warning behavior and reduced drainage reliability.',
    caution: 'If seal integrity is compromised in real care, follow device IFU and local policy.',
  },
  {
    id: 'patient-tube-clamp',
    label: 'Patient tube clamp',
    x: 74,
    y: 90,
    control: 'clamp',
    role: 'Clamp on patient tubing for specific protocol-driven actions.',
    knobology:
      'Toggle the clamp and watch flow stop. The simulator flags clamping with an active modeled air leak.',
    caution: 'Clamping an active air leak can be dangerous if air cannot evacuate.',
  },
  {
    id: 'patient-connector',
    label: 'Patient connector',
    x: 48,
    y: 96,
    control: 'reference',
    role: 'Connection to patient tubing where securement and integrity matter.',
    knobology:
      'Use troubleshooting rounds to connect bubbling or loss of suction to connector inspection.',
    caution: 'Connection checks happen after immediate patient assessment.',
  },
]
