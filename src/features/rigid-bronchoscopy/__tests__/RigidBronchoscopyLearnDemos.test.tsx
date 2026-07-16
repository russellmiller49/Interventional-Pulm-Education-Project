import { render, screen } from '@testing-library/react'

import { RigidBronchoscopyLearnDemos } from '../components/RigidBronchoscopyLearnDemos'

const mockLocalizedChrome: Record<string, string> = {
  'learn.demonstrations.heading': 'Guided demonstrations',
  'learn.demonstrations.intro': 'Learn first, then practice.',
  'learn.demonstrations.assemblyHeading': '3D assembly and ventilation demonstration',
  'learn.demonstrations.assemblyIntro': 'Explore the equipment with teaching cues.',
  'learn.demonstrations.assemblyEyebrow': 'Guided 3D demonstration',
  'learn.demonstrations.assemblyLabTitle': 'Explore a rigid bronchoscopy set',
  'learn.demonstrations.assemblyLabDescription': 'Follow the connections and pathways.',
  'learn.demonstrations.assemblyModeDescription': 'Watch the correct connection order.',
  'learn.demonstrations.assemblyHelp': 'Inspect each connection.',
  'learn.demonstrations.ventilationIntro': 'Compare the displayed anatomy and flow.',
  'learn.demonstrations.sequencesHeading': 'Workflow demonstrations',
  'learn.demonstrations.sequencesIntro': 'Review all workflows.',
  'learn.demonstrations.sequenceCorrectOrder': 'Correct sequence',
  'learn.demonstrations.sequenceRationale': 'Why the order matters',
  'learn.demonstrations.scenariosHeading': 'Decision-path demonstrations',
  'learn.demonstrations.scenariosIntro': 'Review all scenarios.',
  'learn.demonstrations.scenarioBriefing': 'Briefing',
  'learn.demonstrations.scenarioGuidedResponse': 'Guided response',
  'learn.demonstrations.scenarioRecommendedAction': 'Recommended action',
  'learn.demonstrations.scenarioTeachingPoint': 'Why this step matters',
  'learn.demonstrations.scenarioDebrief': 'Debrief',
  'learn.demonstrations.equipmentHeading': 'Equipment-map demonstrations',
  'learn.demonstrations.equipmentIntro': 'Review both equipment maps.',
  'learn.demonstrations.equipmentLabels': 'Labels',
  'learn.demonstrations.equipmentReviewInstruction': 'Review each numbered component.',
}

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => mockLocalizedChrome[key] ?? key,
}))

jest.mock('../components/RigidBronchoscopyAssemblyLabDynamic', () => ({
  RigidBronchoscopyAssemblyLabDynamic: ({
    copy,
    experience,
  }: {
    copy: {
      assemblyModeDescription: string
      dragHelp: string
      eyebrow: string
      title: string
      ventilationScenarioIntro: string
    }
    experience?: string
  }) => (
    <div data-testid="assembly-demonstration" data-experience={experience}>
      {copy.eyebrow} · {copy.title} · {copy.assemblyModeDescription} · {copy.dragHelp} ·{' '}
      {copy.ventilationScenarioIntro}
    </div>
  ),
}))

jest.mock('@/features/skill-lab/components/StepSequencer', () => ({
  StepSequencer: ({
    experience,
    labels,
    sequence,
  }: {
    experience?: string
    labels?: { correctOrderHeading?: string }
    sequence: { id: string }
  }) => (
    <div data-testid="sequence-demonstration" data-experience={experience}>
      {sequence.id} · {labels?.correctOrderHeading}
    </div>
  ),
}))

jest.mock('@/features/skill-lab/components/DecisionScenario', () => ({
  DecisionScenario: ({
    experience,
    labels,
    scenario,
  }: {
    experience?: string
    labels?: { demonstrationHeading?: string }
    scenario: { id: string }
  }) => (
    <div data-testid="scenario-demonstration" data-experience={experience}>
      {scenario.id} · {labels?.demonstrationHeading}
    </div>
  ),
}))

jest.mock('@/features/skill-lab/components/EquipmentLabeler', () => ({
  EquipmentLabeler: ({
    experience,
    labels,
    map,
  }: {
    experience?: string
    labels?: { demonstrationInstruction?: string }
    map: { id: string }
  }) => (
    <div data-testid="equipment-demonstration" data-experience={experience}>
      {map.id} · {labels?.demonstrationInstruction}
    </div>
  ),
}))

describe('RigidBronchoscopyLearnDemos', () => {
  it('presents every Practice activity as an answer-visible demonstration', () => {
    render(<RigidBronchoscopyLearnDemos />)

    expect(screen.getByRole('heading', { name: 'Guided demonstrations' })).toBeInTheDocument()
    expect(screen.getByText(/Guided 3D demonstration/)).toBeInTheDocument()
    expect(screen.getByText(/Watch the correct connection order/)).toBeInTheDocument()
    expect(screen.getByText(/Compare the displayed anatomy and flow/)).toBeInTheDocument()

    expect(screen.getAllByTestId('sequence-demonstration')).toHaveLength(3)
    expect(screen.getAllByTestId('scenario-demonstration')).toHaveLength(4)
    expect(screen.getAllByTestId('equipment-demonstration')).toHaveLength(2)

    for (const element of screen.getAllByTestId(/-demonstration$/)) {
      expect(element).toHaveAttribute('data-experience', 'demonstration')
    }

    expect(screen.getAllByText(/Correct sequence/)).toHaveLength(3)
    expect(screen.getAllByText(/Guided response/)).toHaveLength(4)
    expect(screen.getAllByText(/Review each numbered component/)).toHaveLength(2)
  })
})
