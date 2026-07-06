import type { EquipmentMap } from '@/features/skill-lab/engine/types'

/**
 * Equipment-labeling maps for the Rigid Bronchoscopy module. Images are
 * original, neutral schematics (public/skill-lab/rigid-bronchoscopy/*.svg) with
 * generic alt text that does not name the parts a learner must place. Hotspot
 * coordinates are tuned to the schematic geometry.
 *
 * References: chest-ip-2003, ernst-cao-2004.
 */
export const rigidBronchoscopyEquipment: EquipmentMap[] = [
  {
    id: 'rigid-barrel',
    title: 'Rigid (ventilating) bronchoscope',
    imageSrc: '/skill-lab/rigid-bronchoscopy/rigid-barrel.svg',
    imageAlt:
      'Schematic of a long rigid tube with a proximal multiport head, a lower side connector, an inline rod, and a bevelled distal end',
    hotspots: [
      {
        id: 'telescope',
        label: 'Telescope / optics',
        xPct: 6,
        yPct: 50,
        description:
          'The rod-lens telescope passed down the barrel to give the operator a magnified view of the airway.',
      },
      {
        id: 'ventilation-port',
        label: 'Ventilation side port',
        xPct: 20,
        yPct: 72,
        description:
          'The side port through which the anaesthesia circuit or a jet ventilator connects to ventilate through the barrel.',
      },
      {
        id: 'barrel',
        label: 'Rigid barrel (working channel)',
        xPct: 54,
        yPct: 50,
        description:
          'The hollow rigid tube that maintains the airway and passes instruments; its lumen is the working channel.',
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
