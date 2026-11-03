import {
  DOLPHIN_REPORT_TEMPLATES,
  allowedReached,
  initialReportRow,
  reportRowErrors,
} from '../content/reportForm'

describe('the honest record', () => {
  const form = DOLPHIN_REPORT_TEMPLATES['nmmp-2019']
  const visited = new Set(['TRA', 'RTB', 'RMB'])
  const site = (abbr: string) => form.sites.find((s) => s.abbr === abbr)!

  it('pre-fills reached from the survey and refuses reached for a site never entered', () => {
    expect(initialReportRow(site('RMB'), visited).reached).toBe('reached')
    expect(initialReportRow(site('LMB'), visited)).toMatchObject({
      reached: 'not-reached',
      appearance: 'not-seen',
    })
    expect(allowedReached(site('LMB'), visited)).toEqual(['not-reached'])
    expect(
      reportRowErrors(
        site('LMB'),
        { reached: 'reached', appearance: 'normal', secretions: 'none', sampled: 'none' },
        visited,
      ),
    ).toHaveLength(1)
  })

  it('refuses a finding or a sample at a site not reached', () => {
    expect(
      reportRowErrors(
        site('RB5'),
        { reached: 'not-reached', appearance: 'normal', secretions: 'not-seen', sampled: 'lavage' },
        visited,
      ),
    ).toHaveLength(1)
  })
})
