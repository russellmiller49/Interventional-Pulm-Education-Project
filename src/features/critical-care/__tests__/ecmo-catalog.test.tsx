import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'

import { clinicalPracticeScenarios } from '@/features/cardiohelp-ecmo/content/clinicalCases'
import { cardiohelpScenarioById } from '@/features/cardiohelp-ecmo/content/scenarios'
import { criticalCareActivities } from '../content/activities'
import { criticalCareCatalogActivityHref } from '../content/activityRoutes'
import { criticalCareModuleCatalog } from '../content/modules'
import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { CriticalCareCasesLibrary } from '../components/CriticalCareCasesLibrary'

jest.mock('@/i18n/navigation', () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

const ecmoActivities = criticalCareActivities.filter(
  (activity) => activity.moduleId === 'cardiohelp-ecmo',
)

it('keeps all ECMO route, track and self-paced authority contracts from SHARED-01', () => {
  expect(ecmoActivities).toHaveLength(46)
  for (const activity of ecmoActivities) {
    expect(activity.prerequisiteActivityIds).toEqual([])
    expect(activity.creditPolicy).toBe('non-credit')
    expect(activity.completionEvidenceAuthority).toBe('none')
    expect(activity.masteryRuleId).toBeUndefined()
    expect(activity.reviewStatus).toBe('draft')
    expect(activity.kind).not.toBe('assessment')
    const url = new URL(criticalCareCatalogActivityHref(activity), 'https://test.invalid')
    const [, section, sourceId] = activity.id.split(':')
    expect(url.pathname).toBe(`/cardiohelp-ecmo/${section}`)
    expect(url.searchParams.get(section === 'learn' ? 'lesson' : 'case')).toBe(sourceId)
    expect(url.searchParams.get('track')).toBe(activity.query?.track)
    expect(['vv', 'va']).toContain(activity.query?.track)
    expect(`${activity.title} ${activity.description}`).not.toMatch(
      /\b(score|mastery|exam|independent|mandatory|prerequisite)\b/i,
    )
  }
})

it('uses the same useful title for each catalog case and the existing ECMO case', () => {
  expect(clinicalPracticeScenarios).toHaveLength(14)
  for (const scenario of clinicalPracticeScenarios) {
    const activity = ecmoActivities.find((item) => item.id === `ecmo:practice:${scenario.id}`)!
    expect(activity.title).toBe(scenario.title)
    expect(activity.query?.track).toBe(scenario.supportMode)
  }
  for (const activity of ecmoActivities.filter((item) => item.id.startsWith('ecmo:assess:'))) {
    const scenario = cardiohelpScenarioById.get(activity.query!.case)!
    expect(activity.title).toBe(scenario.title)
    expect(activity.supportedModes).toEqual(['challenge']) // legacy URL/mode identity only
    expect(activity.description).toMatch(/optional questions and explanations available on request/)
  }
})

it('renders searchable named cases and open legacy Assess links through the shared card consumer', () => {
  // Explicit test catalog exercises the shared renderer. Production still omits draft ECMO.
  const publicCatalog = buildCriticalCarePublicClientCatalog()
  render(
    <CriticalCareCasesLibrary
      catalog={{
        ...publicCatalog,
        modules: criticalCareModuleCatalog.filter((module) => module.id === 'cardiohelp-ecmo'),
        activities: ecmoActivities,
      }}
    />,
  )
  fireEvent.change(screen.getByRole('combobox', { name: 'Activity type' }), {
    target: { value: 'practice-case' },
  })
  expect(screen.getByRole('status')).toHaveTextContent('16 activities')
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search cases' }), {
    target: { value: 'recirculation' },
  })
  const heading = screen.getByRole('heading', {
    name: 'Refractory hypoxemia from VV recirculation',
  })
  const card = heading.closest('li')!
  expect(within(card).getByRole('link', { name: 'Open activity' })).toHaveAttribute(
    'href',
    '/cardiohelp-ecmo/practice?case=clinical-vv-recirculation-migration&track=vv',
  )
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search cases' }), {
    target: { value: 'integrated case' },
  })
  expect(screen.getByRole('status')).toHaveTextContent('2 activities')
  for (const track of ['vv', 'va']) {
    const activity = ecmoActivities.find(
      (item) => item.id.startsWith('ecmo:assess:') && item.query?.track === track,
    )!
    const integratedCard = screen.getByRole('heading', { name: activity.title }).closest('li')!
    expect(within(integratedCard).getByRole('link', { name: 'Open activity' })).toHaveAttribute(
      'href',
      criticalCareCatalogActivityHref(activity),
    )
    expect(integratedCard.textContent).not.toMatch(
      /challenge|score|mastery|prerequisite|independent/i,
    )
  }
  expect(publicCatalog.activities.some((activity) => activity.moduleId === 'cardiohelp-ecmo')).toBe(
    false,
  )
})
