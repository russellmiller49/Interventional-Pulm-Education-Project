import { fireEvent, render, screen } from '@testing-library/react'

import { IntroPracticeActivities } from '../components/IntroPracticeActivities'
import type { IntroPracticeActivity } from '../types'

const activities: IntroPracticeActivity[] = [
  {
    type: 'case-triage',
    id: 'triage-test',
    title: 'Would you scope?',
    prompt: 'Pick the best plan.',
    cases: [
      {
        id: 'case-1',
        title: 'Microbiology-changing case',
        scenario: 'Dry cough with CT target and no sputum.',
        bestChoiceId: 'scope',
        choices: [
          {
            id: 'scope',
            label: 'Bronchoscopy for targeted BAL',
            verdict: 'scope',
            feedback: 'Reasonable because the sample changes management.',
          },
          {
            id: 'defer',
            label: 'Defer all sampling',
            verdict: 'defer',
            feedback: 'This misses the management-changing microbiology need.',
          },
        ],
      },
    ],
  },
]

const scopePhotoAtlasActivity: IntroPracticeActivity = {
  type: 'hotspot-diagram',
  id: 'scope-photo-atlas-test',
  title: 'Real scope part atlas',
  prompt: 'Use the real bronchoscope photos.',
  diagram: 'scope-photo-atlas',
  photoAtlas: {
    manifestUrl: '/intro-bronchoscopy/scope-anatomy/scope-photo-atlas.json',
  },
}

const scopePhotoAtlasManifest = {
  images: [
    {
      id: 'full-scope',
      title: 'Full flexible bronchoscope',
      alt: 'Full scope',
      summary: 'Orient to the whole scope.',
      src: '/intro-bronchoscopy/scope-anatomy/full-scope.png',
      width: 100,
      height: 80,
      annotations: [
        {
          id: 'control-section',
          label: 'Control section',
          points: [
            [10, 10],
            [40, 10],
            [40, 40],
            [10, 40],
          ],
          centroid: { x: 25, y: 25 },
        },
      ],
    },
    {
      id: 'suction-valve-setup',
      title: 'Suction valve setup',
      alt: 'Suction setup',
      summary: 'Seat the suction valve.',
      src: '/intro-bronchoscopy/scope-anatomy/suction-valve-setup.png',
      width: 80,
      height: 120,
      annotations: [
        {
          id: 'suction-valve',
          label: 'Suction valve',
          points: [
            [12, 12],
            [50, 12],
            [50, 50],
            [12, 50],
          ],
          centroid: { x: 31, y: 31 },
        },
        {
          id: 'suction-port',
          label: 'Suction valve Port',
          points: [
            [20, 60],
            [58, 60],
            [58, 95],
            [20, 95],
          ],
          centroid: { x: 39, y: 78 },
        },
      ],
    },
  ],
}

describe('IntroPracticeActivities', () => {
  it('reveals case-triage feedback only after the learner commits', () => {
    render(<IntroPracticeActivities activities={activities} />)

    expect(screen.queryByText(/Reasonable because/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bronchoscopy for targeted BAL' }))
    expect(screen.getByText(/Best choice/)).toBeInTheDocument()
    expect(screen.getByText(/Reasonable because/)).toBeInTheDocument()
  })

  it('loads the real scope photo atlas and switches annotated photos', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => scopePhotoAtlasManifest,
    } as Response)

    try {
      render(<IntroPracticeActivities activities={[scopePhotoAtlasActivity]} />)

      expect(await screen.findAllByText('Full flexible bronchoscope')).toHaveLength(2)
      expect(screen.getAllByText('Control section').length).toBeGreaterThanOrEqual(1)

      fireEvent.click(screen.getByRole('button', { name: 'Suction valve setup' }))
      expect(await screen.findByText('Suction valve Port')).toBeInTheDocument()
      expect(global.fetch).toHaveBeenCalledWith(
        '/intro-bronchoscopy/scope-anatomy/scope-photo-atlas.json',
        { cache: 'no-cache' },
      )
    } finally {
      global.fetch = originalFetch
    }
  })
})
