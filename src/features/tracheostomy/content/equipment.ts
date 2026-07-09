import type { EquipmentMap } from '@/features/skill-lab/engine/types'

export interface TracheostomyEquipmentMap extends EquipmentMap {
  referenceIds: string[]
}

export const tracheostomyEquipment: TracheostomyEquipmentMap[] = [
  {
    id: 'tracheostomy-tube-components',
    title: 'Tracheostomy tube components',
    imageSrc: '/skill-lab/tracheostomy/tube-diagram.svg',
    imageAlt:
      'Neutral side-view schematic of a curved airway tube with a neck plate, removable internal element, inflatable seal, thin inflation line, and external balloon assembly',
    hotspots: [
      {
        id: 'connector',
        label: '15-mm connector',
        xPct: 12,
        yPct: 36,
        description:
          'Standard connection point for a ventilator circuit, bag, HME, tracheostomy mask adapter, or other compatible attachment.',
      },
      {
        id: 'flange',
        label: 'Flange / neck plate',
        xPct: 33,
        yPct: 36,
        description:
          'External plate used to secure the tube at the neck; depth markings and model information may be printed here.',
      },
      {
        id: 'outer-cannula',
        label: 'Outer cannula / shaft',
        xPct: 50,
        yPct: 45,
        description:
          'Curved body that maintains the tract and airway. Its outer diameter, length, curvature, and distal position must fit the anatomy.',
      },
      {
        id: 'inner-cannula',
        label: 'Inner cannula',
        xPct: 57,
        yPct: 51,
        description:
          'Removable internal tube that narrows the functional lumen but can be removed promptly when obstructed by secretions.',
      },
      {
        id: 'cuff',
        label: 'Cuff',
        xPct: 66,
        yPct: 66,
        description:
          'Inflatable seal used when a closed path for positive-pressure ventilation is needed; pressure is measured with a manometer.',
      },
      {
        id: 'distal-tip',
        label: 'Distal tip',
        xPct: 71,
        yPct: 82,
        description:
          'Patient-facing end that must remain intratracheal without abutting the wall or sitting too near the carina.',
      },
      {
        id: 'inflation-line',
        label: 'Inflation line',
        xPct: 53,
        yPct: 82,
        description:
          'Narrow tubing connecting the cuff to the external pilot-balloon and inflation-valve assembly.',
      },
      {
        id: 'pilot-balloon',
        label: 'Pilot balloon',
        xPct: 85,
        yPct: 80,
        description:
          'External indicator connected to the cuff system. Its feel does not provide an accurate cuff-pressure measurement.',
      },
      {
        id: 'inflation-valve',
        label: 'One-way inflation valve',
        xPct: 85,
        yPct: 95,
        description:
          'Access point used with a syringe or manometer to inflate, deflate, and measure the cuff system.',
      },
    ],
    referenceIds: ['tracheostomy-knowledge-base', 'mitchell-consensus-2013', 'ghattas-pdt-2021'],
  },
]
