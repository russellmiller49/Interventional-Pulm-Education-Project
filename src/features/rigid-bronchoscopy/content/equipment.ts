import type { EquipmentMap } from '@/features/skill-lab/engine/types'

/**
 * Equipment-labeling maps for the Rigid Bronchoscopy module. Images are
 * original, neutral schematics (public/skill-lab/rigid-bronchoscopy/*.svg) with
 * generic alt text that does not name the parts a learner must place. Hotspot
 * coordinates are tuned to the schematic geometry.
 *
 * References: efer-user-manual, efer-ordering-information, chest-ip-2003,
 * chest-cao-guideline-2025.
 */
export const rigidBronchoscopyEquipment: EquipmentMap[] = [
  {
    id: 'rigid-barrel',
    title: 'EFER ventilating rigid bronchoscope',
    imageSrc: '/skill-lab/rigid-bronchoscopy/rigid-barrel.svg',
    imageAlt:
      'Simplified schematic of an EFER-style rigid tube with a proximal multiport head, axial telescope route, lateral connections, rigid barrel, and bevelled distal end',
    hotspots: [
      {
        id: 'main-axial-port',
        label: 'Main axial working port',
        xPct: 10,
        yPct: 50,
        description:
          'The large horizontal route for the telescope plus compatible optical forceps, suction, or other configuration-specific axial instruments through the selected main cap.',
      },
      {
        id: 'accessory-port',
        label: 'BB2401/BB2402 accessory port',
        xPct: 14,
        yPct: 35,
        description:
          'The smaller lateral port accepts a one- or two-gate obturator for compatible slender accessories; it is not the fixed jet gate.',
      },
      {
        id: 'anesthesia-circuit-port',
        label: 'Anaesthesia-circuit port',
        xPct: 14,
        yPct: 64,
        description:
          'The larger lateral ventilation port connects to the breathing circuit for controlled or spontaneous-assisted ventilation.',
      },
      {
        id: 'jet-ventilation-port',
        label: 'Fixed jet-ventilation port',
        xPct: 21,
        yPct: 72,
        description:
          'The dedicated inlet for jet pulses. Instruments must not be routed through this port.',
      },
      {
        id: 'barrel',
        label: 'Rigid barrel (working channel)',
        xPct: 54,
        yPct: 50,
        description:
          'The straight hollow tube that maintains the airway and carries gas, optics, and compatible instruments from the selected proximal interfaces.',
      },
      {
        id: 'distal-bevel',
        label: 'Bevelled distal tip',
        xPct: 93,
        yPct: 50,
        description:
          'The angled distal end used to intubate past the cords and to core through endoluminal tumour.',
      },
    ],
  },
  {
    id: 'ablative-adapters',
    title: 'Ablative and hemostatic instruments',
    imageSrc: '/skill-lab/rigid-bronchoscopy/ablative-adapters.svg',
    imageAlt:
      'Schematic of four slender probes side by side, each ending in a different tip: a fine point, a spray of short arcs, a rounded ball, and a pair of jaws',
    hotspots: [
      {
        id: 'laser-fibre',
        label: 'Nd:YAG laser fibre',
        xPct: 15,
        yPct: 63,
        description:
          'A non-contact photocoagulation fibre for debulking and hemostasis; requires strict FiO₂ reduction to avoid airway fire.',
      },
      {
        id: 'apc-probe',
        label: 'Argon plasma coagulation probe',
        xPct: 39,
        yPct: 63,
        description:
          'Delivers non-contact monopolar current via ionised argon for superficial coagulation and hemostasis.',
      },
      {
        id: 'cryoprobe',
        label: 'Cryoprobe',
        xPct: 63,
        yPct: 63,
        description:
          'Freezes tissue to remove tumour or clot by adhesion; low airway-fire risk but not immediately hemostatic.',
      },
      {
        id: 'optical-forceps',
        label: 'Optical (grasping) forceps',
        xPct: 85,
        yPct: 63,
        description:
          'Rigid forceps aligned with the telescope for mechanical debulking, foreign-body retrieval, and biopsy.',
      },
    ],
  },
]
