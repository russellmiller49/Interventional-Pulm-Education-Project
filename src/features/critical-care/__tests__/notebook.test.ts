import {
  CRITICAL_CARE_NOTEBOOK_STORAGE_KEY,
  createEmptyCriticalCareNotebook,
  isCriticalCareNotebookItemSaved,
  parseCriticalCareNotebook,
  readCriticalCareNotebook,
  toggleCriticalCareNotebookItem,
  writeCriticalCareNotebook,
} from '../notebook'
import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'

const knownItemKeys = new Set(
  buildCriticalCarePublicClientCatalog().referenceItems.map((item) => `${item.kind}:${item.id}`),
)

describe('critical-care notebook persistence', () => {
  beforeEach(() => window.localStorage.clear())

  it('saves, resolves, reloads, and removes catalog-backed items', () => {
    const now = '2026-07-22T12:00:00.000Z'
    const item = { id: 'reference:hemodynamics:signal-validation', kind: 'reference' as const }
    const saved = toggleCriticalCareNotebookItem(
      createEmptyCriticalCareNotebook(now),
      item,
      knownItemKeys,
      now,
    )
    expect(isCriticalCareNotebookItemSaved(saved, item)).toBe(true)
    expect(writeCriticalCareNotebook(window.localStorage, saved)).toBe(true)
    expect(window.localStorage.getItem(CRITICAL_CARE_NOTEBOOK_STORAGE_KEY)).toContain(item.id)
    expect(readCriticalCareNotebook(window.localStorage, knownItemKeys)).toEqual(saved)
    expect(toggleCriticalCareNotebookItem(saved, item, knownItemKeys, now).items).toEqual([])
  })

  it('drops unknown catalog IDs and fails safely on corrupt or unavailable storage', () => {
    const parsed = parseCriticalCareNotebook(
      {
        version: 1,
        items: [
          {
            id: 'reference:missing:item',
            kind: 'reference',
            savedAt: '2026-07-22T12:00:00.000Z',
          },
        ],
        updatedAt: '2026-07-22T12:00:00.000Z',
      },
      knownItemKeys,
    )
    expect(parsed?.items).toEqual([])

    window.localStorage.setItem(CRITICAL_CARE_NOTEBOOK_STORAGE_KEY, '{bad')
    expect(readCriticalCareNotebook(window.localStorage, knownItemKeys).items).toEqual([])
    expect(
      readCriticalCareNotebook(
        {
          getItem: () => {
            throw new Error('blocked')
          },
          setItem: jest.fn(),
        },
        knownItemKeys,
      ).items,
    ).toEqual([])
  })

  it('drops draft and private catalog records from persistence', () => {
    const now = '2026-07-22T12:00:00.000Z'
    const parsed = parseCriticalCareNotebook(
      {
        version: 1,
        items: [
          { id: 'reference:ecmo:circuit-assessment', kind: 'reference', savedAt: now },
          { id: 'reference:icu:model-limits', kind: 'reference', savedAt: now },
          { id: 'ecmo-cardiohelp-circuit', kind: 'asset', savedAt: now },
          { id: 'icu-integrated-bedside', kind: 'asset', savedAt: now },
        ],
        updatedAt: now,
      },
      knownItemKeys,
    )

    expect(parsed?.items).toEqual([])
    expect(
      toggleCriticalCareNotebookItem(
        createEmptyCriticalCareNotebook(now),
        { id: 'reference:icu:model-limits', kind: 'reference' },
        knownItemKeys,
      ).items,
    ).toEqual([])
  })
})
