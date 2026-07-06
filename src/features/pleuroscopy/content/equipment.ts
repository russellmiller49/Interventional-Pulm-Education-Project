import type { EquipmentMap } from '@/features/skill-lab/engine/types'

/**
 * Equipment-labeling maps for the Pleuroscopy module. Images are original,
 * neutral schematics (public/skill-lab/pleuroscopy/*.svg); their alt text is
 * deliberately generic and does not name the parts a learner must place.
 * Hotspot coordinates are tuned to the schematic geometry.
 *
 * References: bts-lat-2010 (technique/instrumentation framing), bts-procedures-2023.
 */
export const pleuroscopyEquipment: EquipmentMap[] = [
  {
    id: 'thoracoscope-assembly',
    title: 'Thoracoscope and access cannula',
    imageSrc: '/skill-lab/pleuroscopy/thoracoscope-assembly.svg',
    imageAlt:
      'Schematic of a rigid endoscope assembly with an eyepiece, an angled side post, a proximal port, an outer sleeve, and a distal end',
    hotspots: [
      {
        id: 'optics',
        label: 'Eyepiece / optical head',
        xPct: 9,
        yPct: 50,
        description:
          'The optical head the operator looks through (or that carries the camera) to inspect the pleural surfaces.',
      },
      {
        id: 'light-post',
        label: 'Light-guide post',
        xPct: 25,
        yPct: 26,
        description: 'Connects the fibre-optic light cable that illuminates the pleural cavity.',
      },
      {
        id: 'working-port',
        label: 'Instrument (working) port',
        xPct: 23,
        yPct: 73,
        description:
          'The channel through which biopsy forceps and other instruments pass to reach the pleura.',
      },
      {
        id: 'cannula',
        label: 'Access cannula / trocar sleeve',
        xPct: 78,
        yPct: 50,
        description:
          'The rigid sleeve placed through the single intercostal entry site; the scope and instruments pass through it.',
      },
      {
        id: 'distal-end',
        label: 'Distal objective end',
        xPct: 92,
        yPct: 50,
        description:
          'The working end that enters the pleural space and carries the objective lens.',
      },
    ],
  },
  {
    id: 'pleural-instruments',
    title: 'Biopsy and pleurodesis instruments',
    imageSrc: '/skill-lab/pleuroscopy/pleural-instruments.svg',
    imageAlt:
      'Schematic of three separate hand instruments: a long jawed instrument, a bulb-and-nozzle device, and a curved drainage tube with side eyelets',
    hotspots: [
      {
        id: 'biopsy-forceps',
        label: 'Parietal biopsy forceps',
        xPct: 14,
        yPct: 52,
        description:
          'Jawed forceps used to take parietal pleural biopsies, taken over a rib to avoid the intercostal bundle.',
      },
      {
        id: 'talc-atomizer',
        label: 'Talc atomizer / insufflator',
        xPct: 50,
        yPct: 54,
        description:
          'Bulb-and-nozzle device that disperses graded talc evenly across the pleural surfaces for poudrage pleurodesis.',
      },
      {
        id: 'chest-drain',
        label: 'Chest drain',
        xPct: 85,
        yPct: 50,
        description:
          'Placed at the end of the procedure; its side eyelets drain fluid and air while the lung re-expands.',
      },
    ],
  },
]
