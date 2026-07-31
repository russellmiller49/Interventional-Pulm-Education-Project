/** @jest-environment node */

import { requireLiteratureSiteAdminApi } from '@/features/literature/server/access'
import { loadLiteratureGoldReviewItem } from '@/features/literature/server/gold-set'

import { GET } from './route'

jest.mock('@/features/literature/server/access', () => ({
  requireLiteratureSiteAdminApi: jest.fn(),
}))

jest.mock('@/features/literature/server/gold-set', () => ({
  loadLiteratureGoldReviewItem: jest.fn(),
  saveLiteratureGoldReview: jest.fn(),
  updateLiteratureGoldReviewItem: jest.fn(),
}))

describe('gold-set item route', () => {
  const itemId = '00000000-0000-4000-8000-000000000001'
  const requireAdmin = requireLiteratureSiteAdminApi as jest.Mock
  const loadItem = loadLiteratureGoldReviewItem as jest.Mock

  beforeEach(() => {
    requireAdmin.mockResolvedValue({
      ok: true,
      user: { id: 'admin-user', email: 'admin@example.test' },
    })
    loadItem.mockResolvedValue({
      data: { id: itemId, batchId: '00000000-0000-4000-8000-000000000002' },
      error: null,
    })
  })

  it('defaults direct reads to the development split', async () => {
    const response = await GET(
      new Request(`http://localhost/api/admin/literature/gold-set/item/${itemId}`),
      { params: Promise.resolve({ itemId }) },
    )

    expect(response.status).toBe(200)
    expect(loadItem).toHaveBeenCalledWith(undefined, itemId, 'all', 'development')
  })
})
