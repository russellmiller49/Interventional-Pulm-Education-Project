import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import {
  criticalCareActivities,
  criticalCareActivityById,
  validateCurriculumStaging,
} from '../content/activities'
import {
  criticalCareLearningPathway,
  criticalCareLearningPathways,
  validateCriticalCareLearningPathways,
  validateLearningPathwayCoverage,
} from '../content/learningPathways'
import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { CriticalCareCasesLibrary } from '../components/CriticalCareCasesLibrary'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const catalog = buildCriticalCarePublicClientCatalog()

describe('curriculum staging metadata', () => {
  it('declares a stage and a stage ordinal on every activity', () => {
    expect(criticalCareActivities).not.toHaveLength(0)
    for (const activity of criticalCareActivities) {
      expect(activity.curriculumStage).toBeDefined()
      expect(Number.isInteger(activity.stageOrder)).toBe(true)
      expect(activity.stageOrder).toBeGreaterThan(0)
    }
    expect(validateCurriculumStaging(criticalCareActivities)).toEqual([])
  })

  it('rejects a duplicate stageOrder inside one module and stage', () => {
    const [first] = criticalCareActivities.filter(
      (activity) =>
        activity.moduleId === 'baxter-crrt' && activity.curriculumStage === 'foundation',
    )
    const clash = { ...first, id: `${first.id}-clone` }
    expect(validateCurriculumStaging([...criticalCareActivities, clash])).toEqual([
      expect.stringContaining('duplicate stageOrder'),
    ])
  })

  it('carries authored difficulty rather than a section-constant default', () => {
    const learnDifficulties = new Set(
      criticalCareActivities
        .filter((activity) => activity.id.includes(':learn:'))
        .map((activity) => activity.difficulty),
    )
    const practiceDifficulties = new Set(
      criticalCareActivities
        .filter((activity) => activity.id.includes(':practice:'))
        .map((activity) => activity.difficulty),
    )
    expect(learnDifficulties.size).toBeGreaterThan(1)
    expect(practiceDifficulties.size).toBeGreaterThan(1)
  })
})

describe('learning pathways', () => {
  it('validates every declared pathway against the activity catalog', () => {
    expect(validateCriticalCareLearningPathways(criticalCareActivities)).toEqual([])
  })

  it('gives each pathway exactly one integration section, and it is last', () => {
    for (const pathway of criticalCareLearningPathways) {
      const integrationIndexes = pathway.sections
        .map((section, index) => (section.stage === 'integration' ? index : -1))
        .filter((index) => index >= 0)
      expect(integrationIndexes).toHaveLength(1)
      expect(integrationIndexes[0]).toBe(pathway.sections.length - 1)
    }
  })

  it('never opens a pathway with device or console orientation before its physiology', () => {
    for (const pathway of criticalCareLearningPathways) {
      const firstFoundation = pathway.sections.findIndex(
        (section) => section.stage === 'foundation',
      )
      const firstApplication = pathway.sections.findIndex(
        (section) => section.stage === 'application',
      )
      expect(firstFoundation).toBeGreaterThanOrEqual(0)
      if (firstApplication >= 0) expect(firstFoundation).toBeLessThan(firstApplication)
    }
  })

  it('resolves every section to a real, same-module activity', () => {
    for (const pathway of criticalCareLearningPathways) {
      for (const section of pathway.sections) {
        const activity = criticalCareActivityById.get(section.activityId)
        expect(activity).toBeDefined()
        expect(activity?.moduleId).toBe(pathway.moduleId)
        expect(activity?.curriculumStage).toBe(section.stage)
      }
    }
  })

  it('has every module declaring a pathway, and ECMO declaring one per track', () => {
    expect(validateLearningPathwayCoverage()).toEqual([])
    const ecmoTracks = criticalCareLearningPathways
      .filter((pathway) => pathway.moduleId === 'cardiohelp-ecmo')
      .map((pathway) => pathway.trackId)
    expect(ecmoTracks).toEqual(['vv', 'va'])
  })
})

describe('CRRT pathway (WP10 §5.2)', () => {
  const pathway = criticalCareLearningPathway('baxter-crrt')

  it('teaches the circuit before the transport and prescription that assume it', () => {
    const order = pathway.sections.map((section) => section.id)
    expect(order.indexOf('crrt-circuit-pressures')).toBeLessThan(
      order.indexOf('crrt-solute-transport'),
    )
    expect(order.indexOf('crrt-circuit-pressures')).toBeLessThan(
      order.indexOf('crrt-prescription-dosing'),
    )
  })

  it('ends on an integration capstone lesson', () => {
    const last = pathway.sections.at(-1)
    expect(last?.id).toBe('crrt-pressure-profile-integration')
    expect(last?.stage).toBe('integration')
  })
})

describe('ECMO pathways (WP10 §5.1)', () => {
  it.each(['vv', 'va'] as const)(
    'teaches the %s physiology before the console it operates on',
    (track) => {
      const order = criticalCareLearningPathway('cardiohelp-ecmo', track).sections.map(
        (section) => section.id,
      )
      const consoleIndex = order.findIndex((id) => id.includes('startup-sensor-orientation'))
      expect(consoleIndex).toBeGreaterThan(0)
      for (const physiologyId of [
        'why-extracorporeal-support',
        'circuit-flow-path',
        'pump-and-pressure-zones',
        'blood-flow-versus-sweep',
      ]) {
        expect(order.indexOf(physiologyId)).toBeLessThan(consoleIndex)
      }
      // The console tour is seventh, after the shared foundation and the track's own physiology.
      expect(consoleIndex).toBe(6)
    },
  )

  it('shares the same four foundation sections across both tracks', () => {
    const shared = ['why-extracorporeal-support', 'circuit-flow-path', 'pump-and-pressure-zones']
    for (const track of ['vv', 'va'] as const) {
      const ids = criticalCareLearningPathway('cardiohelp-ecmo', track).sections.map(
        (section) => section.id,
      )
      expect(ids.slice(0, 3)).toEqual(shared)
    }
  })
})

describe('ICU-sim dual-seeded scenarios (WP10 §5.5)', () => {
  const scenarioIds = criticalCareActivities
    .filter((activity) => activity.id.startsWith('icu:practice:'))
    .map((activity) => activity.id.replace('icu:practice:', ''))

  it('opens on the single-dominant-mechanism scenario, not the longest multisystem one', () => {
    expect(scenarioIds[0]).toBe('hemorrhagic')
    expect(scenarioIds.at(-1)).toBe('mixed-cardiogenic-vasodilatory')
  })

  it('differentiates every Practice/Challenge pair by mode and copy, not only by ID', () => {
    expect(scenarioIds).not.toHaveLength(0)
    for (const scenarioId of scenarioIds) {
      const practice = criticalCareActivityById.get(`icu:practice:${scenarioId}`)
      const challenge = criticalCareActivityById.get(`icu:assess:${scenarioId}`)
      expect(practice).toBeDefined()
      expect(challenge).toBeDefined()
      expect(practice?.supportedModes).not.toEqual(challenge?.supportedModes)
      expect(challenge?.supportedModes).toEqual(['challenge'])
      expect(practice?.description).not.toBe(challenge?.description)
      expect(challenge?.description).toMatch(/deferred to the debrief/i)
    }
  })
})

describe('activity library ordering (WP10 §4 bug A)', () => {
  it('renders CRRT cases in authored station order, not alphabetically by title', () => {
    render(<CriticalCareCasesLibrary catalog={catalog} />)
    fireEvent.change(screen.getByLabelText('Module'), { target: { value: 'baxter-crrt' } })
    fireEvent.change(screen.getByLabelText('Activity type'), {
      target: { value: 'practice-case' },
    })

    const authoredOrder = criticalCareActivities
      .filter((activity) => activity.id.startsWith('crrt:practice:'))
      .map((activity) => activity.title)
    const rendered = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '')

    expect(rendered).toEqual(authoredOrder)
    expect(rendered).not.toEqual([...rendered].sort((left, right) => left.localeCompare(right)))
  })

  it('keeps the deliberately non-alphabetical CRRT station pairs adjacent and in order', () => {
    render(<CriticalCareCasesLibrary catalog={catalog} />)
    fireEvent.change(screen.getByLabelText('Module'), { target: { value: 'baxter-crrt' } })
    fireEvent.change(screen.getByLabelText('Activity type'), {
      target: { value: 'practice-case' },
    })
    const rendered = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.id)

    // CRRT-08 precedes CRRT-07, and CRRT-13, CRRT-15, CRRT-14 run in that order.
    const titleFor = (id: string) => criticalCareActivityById.get(`crrt:practice:${id}`)?.title
    const positionOf = (id: string) =>
      screen
        .getAllByRole('heading', { level: 2 })
        .findIndex((heading) => heading.textContent === titleFor(id))

    expect(rendered.length).toBeGreaterThan(0)
    expect(positionOf('CRRT-08')).toBeLessThan(positionOf('CRRT-07'))
    expect(positionOf('CRRT-13')).toBeLessThan(positionOf('CRRT-15'))
    expect(positionOf('CRRT-15')).toBeLessThan(positionOf('CRRT-14'))
  })
})
