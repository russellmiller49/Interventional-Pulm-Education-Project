import { recordSiteModuleEvent } from '@/lib/analytics'

import {
  buildCriticalCareDashboardAnalyticsPayload,
  recordCriticalCareDashboardEvent,
} from '../analytics'

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: jest.fn(),
}))

describe('critical-care dashboard analytics', () => {
  beforeEach(() => {
    jest.mocked(recordSiteModuleEvent).mockClear()
  })

  it('builds a bounded allowlisted payload and truncates catalog identifiers', () => {
    const payload = buildCriticalCareDashboardAnalyticsPayload({
      interaction: 'critical_care_recommendation_selected',
      targetId: 'x'.repeat(300),
      targetType: 'activity',
    })

    expect(payload).toEqual({
      interaction: 'critical_care_recommendation_selected',
      targetId: 'x'.repeat(160),
      targetType: 'activity',
      schemaVersion: 1,
    })
    expect(payload).not.toHaveProperty('notes')
    expect(payload).not.toHaveProperty('patient')
    expect(payload).not.toHaveProperty('waveforms')
  })

  it('rejects values that are not catalog-shaped identifiers', () => {
    expect(() =>
      buildCriticalCareDashboardAnalyticsPayload({
        interaction: 'critical_care_lab_selected',
        targetId: 'free text must not enter analytics',
        targetType: 'lab',
      }),
    ).toThrow()
  })

  it('maps meaningful interactions onto an existing database event class', () => {
    recordCriticalCareDashboardEvent({
      interaction: 'critical_care_resume_selected',
      targetId: 'hemodynamics:learn:pac-signal-validation',
      targetType: 'activity',
    })

    expect(recordSiteModuleEvent).toHaveBeenCalledWith({
      eventType: 'module_opened',
      moduleId: 'critical-care',
      eventPayload: {
        interaction: 'critical_care_resume_selected',
        targetId: 'hemodynamics:learn:pac-signal-validation',
        targetType: 'activity',
        schemaVersion: 1,
      },
    })
  })
})
