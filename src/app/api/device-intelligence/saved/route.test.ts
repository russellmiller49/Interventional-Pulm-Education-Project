/** @jest-environment node */
import { GET } from './route'
import { deviceIntelligenceEnabled } from '@/features/device-intelligence/feature'
import products from '../../../../../data/ip-preference-cards/generated/catalog-products.json'

jest.mock('@/features/device-intelligence/feature', () => ({
  deviceIntelligenceEnabled: jest.fn(() => true),
}))
const request = (query: string) =>
  new Request(`http://localhost/api/device-intelligence/saved?${query}`)
const CRYO = 'PRD-05670F1B5F'

describe('Public saved-device lookup', () => {
  afterEach(() => {
    ;(deviceIntelligenceEnabled as jest.Mock).mockReturnValue(true)
  })
  it('requires the feature flag and never caches private saved selections', async () => {
    const response = await GET(request(`ids=${CRYO}`))
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect((await response.json()).devices[0].status.safetyDisplay).toBe('active_safety_notice')
    ;(deviceIntelligenceEnabled as jest.Mock).mockReturnValue(false)
    expect((await GET(request(`ids=${CRYO}`))).status).toBe(404)
  })
  it.each(['ids=invalid', `ids=${CRYO}&ids=${CRYO}`, `ids=${Array(101).fill(CRYO).join(',')}`])(
    'rejects malformed and oversized requests: %s',
    async (query) => {
      expect((await GET(request(query))).status).toBe(400)
    },
  )
  it('does not disclose non-cohort identities, even with a valid product id', async () => {
    const excluded = products.find((row) => row.verification_grade === 'candidate')!
    const response = await GET(request(`ids=${excluded.product_id},${CRYO}`))
    const text = await response.text()
    expect(text).not.toContain(excluded.product_id)
    expect(text).not.toContain(excluded.product_name)
    expect(JSON.parse(text).unavailableCount).toBe(1)
  })
})
