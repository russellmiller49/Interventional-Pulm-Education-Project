import type { AirwayGeneration } from '@/lib/bronchoscope-size-explorer/types'

export const airwayGenerations: AirwayGeneration[] = [
  {
    generation: 0,
    label: 'Trachea',
    approximateDiameterMm: 18.0,
  },
  {
    generation: 1,
    label: 'Main bronchi',
    approximateDiameterMm: 12.0,
  },
  {
    generation: 2,
    label: 'Lobar bronchi',
    approximateDiameterMm: 9.0,
  },
  {
    generation: 3,
    label: 'Segmental bronchi',
    approximateDiameterMm: 7.0,
  },
  {
    generation: 4,
    label: 'Proximal subsegmental',
    approximateDiameterMm: 5.5,
  },
  {
    generation: 5,
    label: 'Subsegmental',
    approximateDiameterMm: 4.5,
  },
  {
    generation: 6,
    label: 'Distal subsegmental',
    approximateDiameterMm: 3.5,
  },
  {
    generation: 7,
    label: 'Small distal airway',
    approximateDiameterMm: 2.8,
  },
  {
    generation: 8,
    label: 'Very small distal airway',
    approximateDiameterMm: 2.2,
  },
]
