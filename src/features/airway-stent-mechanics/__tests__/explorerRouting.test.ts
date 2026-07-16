import {
  isStentExplorerStationId,
  legacyLessonToExplorerStation,
  resolveExplorerStationRequest,
} from '../explorer/routing'
import { STENT_EXPLORER_STATION_IDS } from '../explorer/types'

describe('stent explorer deep-link routing', () => {
  it('recognizes every canonical station and rejects arbitrary strings', () => {
    for (const stationId of STENT_EXPLORER_STATION_IDS) {
      expect(isStentExplorerStationId(stationId)).toBe(true)
      expect(resolveExplorerStationRequest({ station: stationId })).toBe(stationId)
    }

    expect(isStentExplorerStationId('assessment')).toBe(false)
    expect(isStentExplorerStationId(null)).toBe(false)
  })

  it('uses the first canonical value, trims it, and gives it precedence', () => {
    expect(
      resolveExplorerStationRequest({
        station: ['  mucus-obstruction  ', 'migration'],
        lesson: 'fit-behavior',
        panel: 'mechanics',
      }),
    ).toBe('mucus-obstruction')
  })

  it('maps active and legacy lesson links to their nearest explorer stations', () => {
    for (const [lesson, stationId] of Object.entries(legacyLessonToExplorerStation)) {
      expect(resolveExplorerStationRequest({ lesson })).toBe(stationId)
    }

    expect(resolveExplorerStationRequest({ lesson: ['force-lab', 'assessment'] })).toBe(
      'cough-motion',
    )
  })

  it('maps the former mechanics panel and sends unknown or assessment links to the hub', () => {
    expect(resolveExplorerStationRequest({ panel: 'mechanics' })).toBe('architecture-lumen')
    expect(resolveExplorerStationRequest({ panel: 'other' })).toBeNull()
    expect(resolveExplorerStationRequest({ lesson: 'assessment' })).toBeNull()
    expect(resolveExplorerStationRequest({ lesson: 'unknown', panel: 'mechanics' })).toBeNull()
    expect(resolveExplorerStationRequest({ station: 'unknown', lesson: 'force-lab' })).toBeNull()
    expect(resolveExplorerStationRequest({})).toBeNull()
  })
})
