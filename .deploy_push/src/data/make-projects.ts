import type { MakeProject } from '@/lib/types'

export const featuredMakeProject: MakeProject = {
  slug: 'airway-simulator',
  title: 'Airway Simulator V2',
  tagline: 'Modular bronchoscopy rehearsal platform with printable anatomy and tactile feedback.',
  summary:
    'Build a realistic airway lab station using readily available hardware, printable components, and a modular control box that simulates bleeding, suction, and ventilation scenarios.',
  heroImage: '/window.svg',
  license: 'CC BY-NC 4.0',
  disclaimers: [
    'This simulator is intended for educational use only and should not be used on patients.',
    'Always verify 3D print settings and perform post-processing before classroom use.',
  ],
  downloads: [
    {
      id: 'airway-simulator-stl-pack',
      name: 'Complete STL Pack',
      description:
        'Segmented airway, vascular tree, and modular base plates ready for 200 x 200 mm printers.',
      format: 'stl',
      sizeMB: 185,
      estimatedPrintTime: '38 hrs',
      estimatedMaterialCost: '$22 filament',
      difficulty: 'intermediate',
      version: '2.1.0',
      updatedAt: '2024-08-12',
      previewImage: '/window.svg',
    },
    {
      id: 'airway-simulator-electronics',
      name: 'Electronics Wiring Guide',
      description: 'Wiring diagram, firmware config, and laser-cut control panel layout.',
      format: 'pdf',
      sizeMB: 6.4,
      estimatedPrintTime: '—',
      estimatedMaterialCost: '$45 components',
      difficulty: 'beginner',
      version: '1.6.0',
      updatedAt: '2024-07-02',
      previewImage: '/window.svg',
    },
    {
      id: 'airway-simulator-firmware',
      name: 'Control Box Firmware',
      description: 'Arduino firmware with presets for bleeding, secretions, and ventilation cues.',
      format: 'zip',
      sizeMB: 1.2,
      estimatedPrintTime: 'Upload in <5 min',
      estimatedMaterialCost: '$0',
      difficulty: 'beginner',
      version: '1.2.3',
      updatedAt: '2024-06-18',
      previewImage: '/window.svg',
    },
  ],
  buildGuide: {
    overview:
      'The Airway Simulator emphasises modularity: swap different airway anatomies, connect to oxygen and suction, and trigger real-time responses via a compact control box. Assembly takes roughly a weekend with access to FDM printers and basic soldering tools.',
    objectives: [
      'Provide tactile rehearsal for bronchoscopy and stent placement.',
      'Allow quick swap of airway cartridges for varying pathology.',
      'Support video capture and suction to mimic OR feedback.',
    ],
    materials: [
      {
        name: 'PLA filament (1.75 mm)',
        quantity: '2 spools',
        cost: '$40',
        notes: 'Use higher temp PLA+ for durability.',
      },
      { name: 'Silicone tubing (6 mm ID)', quantity: '3 meters', cost: '$9' },
      {
        name: 'Peristaltic pump (12 V)',
        quantity: '1',
        cost: '$28',
        notes: 'For bleeding/secretions simulation.',
      },
      { name: 'Arduino Nano + relay shield', quantity: '1 set', cost: '$18' },
      {
        name: 'Neoprene sheet (3 mm)',
        quantity: '300 x 300 mm',
        cost: '$6',
        notes: 'Base padding.',
      },
      { name: 'M4 hardware kit', quantity: '1 pack', cost: '$12' },
    ],
    printing: {
      description:
        'Print the airway cartridges upright with supports and the base plates flat for rigidity. A 0.2 mm layer height and 20% gyroid infill balance strength and material use.',
      steps: [
        'Slice airway parts with tree supports and paint-on support blockers around the larynx to reduce cleanup.',
        'Print vascular overlays separately in flexible TPU for increased durability.',
        'Allow parts to cool fully before removing supports to prevent warping of long bronchial segments.',
      ],
    },
    assembly: [
      {
        title: 'Prepare airway cartridge',
        description:
          'Wet-sand support scars and seal the airway lumen with a thin silicone coat to improve scope glide.',
        image: undefined,
      },
      {
        title: 'Install tubing manifold',
        description:
          'Route silicone tubing through the anterior port, anchoring with M4 screws and compression gaskets.',
        image: undefined,
      },
      {
        title: 'Wire control box',
        description:
          'Solder the pump, LEDs, and sensors to the relay shield as per the wiring guide, then upload firmware.',
        image: undefined,
      },
      {
        title: 'Final enclosure fit',
        description:
          'Mount the airway cartridge, secure the removable cover, and perform a leak test with water.',
      },
    ],
    usageTips: [
      'Run a calibration cycle before each session to prime pumps and verify suction strength.',
      'Swap to the bleeding cassette to simulate hemoptysis control and gauging irrigation requirements.',
      'Pair with the Mediastinal Lymph Node atlas to stage cases before hands-on rehearsal.',
    ],
    maintenance: [
      'Flush tubing with warm water after each use to prevent clogging.',
      'Inspect relay contacts quarterly and replace any discoloured components.',
    ],
  },
  resources: [
    {
      label: 'Bill of materials spreadsheet',
      href: 'https://example.com/bom',
      description: 'Editable Google Sheet with supplier links and bulk pricing.',
    },
    {
      label: 'Workshop video walkthrough',
      href: 'https://example.com/workshop-video',
      description: '90 minute build-along session recorded at the IP Lab.',
    },
  ],
}
