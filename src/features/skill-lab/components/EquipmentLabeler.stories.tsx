import type { Meta, StoryObj } from '@storybook/react'

import { EquipmentLabeler } from './EquipmentLabeler'
import type { EquipmentMap } from '../engine/types'

/**
 * Self-contained neutral schematic (inline SVG data URI) so the story needs no
 * external asset. The alt text is intentionally generic and does not name the
 * parts the learner must place.
 */
const schematic = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
     <rect width="400" height="200" fill="#f1f5f9"/>
     <rect x="40" y="80" width="280" height="40" rx="8" fill="#cbd5e1" stroke="#64748b" stroke-width="2"/>
     <rect x="320" y="70" width="40" height="60" rx="6" fill="#94a3b8" stroke="#475569" stroke-width="2"/>
     <circle cx="70" cy="100" r="10" fill="#e2e8f0" stroke="#475569" stroke-width="2"/>
     <line x1="180" y1="60" x2="180" y2="80" stroke="#475569" stroke-width="3"/>
     <rect x="168" y="40" width="24" height="20" rx="4" fill="#94a3b8" stroke="#475569" stroke-width="2"/>
   </svg>`,
)}`

const demoMap: EquipmentMap = {
  id: 'demo-instrument',
  title: 'Instrument schematic (demo)',
  imageSrc: schematic,
  imageAlt: 'Schematic outline of a tubular instrument with several attachments',
  hotspots: [
    {
      id: 'proximal-port',
      label: 'Proximal port',
      xPct: 17,
      yPct: 50,
      description: 'The proximal opening used to introduce instruments.',
    },
    {
      id: 'side-attachment',
      label: 'Side attachment',
      xPct: 45,
      yPct: 25,
      description: 'A side connection for an accessory line.',
    },
    {
      id: 'main-barrel',
      label: 'Main barrel',
      xPct: 55,
      yPct: 50,
      description: 'The main working channel of the instrument.',
    },
    {
      id: 'distal-adapter',
      label: 'Distal adapter',
      xPct: 85,
      yPct: 50,
      description: 'The distal adapter that couples to the working end.',
    },
  ],
}

const meta: Meta<typeof EquipmentLabeler> = {
  title: 'Skill Lab/EquipmentLabeler',
  component: EquipmentLabeler,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof EquipmentLabeler>

export const Default: Story = {
  args: { map: demoMap },
}
