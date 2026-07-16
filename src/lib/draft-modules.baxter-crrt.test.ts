type BaxterCrrtPublicationStatus = 'draft' | 'published'

export {}

const stentReleasePath = '@/features/airway-stent-mechanics/explorer/release'
const baxterCrrtReleasePath = '@/features/baxter-crrt/content'
const cardiohelpReleasePath = '@/features/cardiohelp-ecmo/content/deviceProfile'
const ventilationReleasePath = '@/features/mechanical-ventilation/content/deviceProfiles'

async function loadPolicy(status: BaxterCrrtPublicationStatus) {
  let policy: typeof import('./draft-modules') | undefined

  await jest.isolateModulesAsync(async () => {
    jest.doMock(stentReleasePath, () => ({ stentExplorerPublicationStatus: 'published' }))
    jest.doMock(baxterCrrtReleasePath, () => ({ baxterCrrtPublicationStatus: status }))
    jest.doMock(cardiohelpReleasePath, () => ({ cardiohelpEcmoPublicationStatus: 'published' }))
    jest.doMock(ventilationReleasePath, () => ({
      mechanicalVentilationPublicationStatus: 'published',
    }))
    policy = await import('./draft-modules')
  })

  if (!policy) throw new Error('Unable to load Baxter CRRT draft policy.')
  return policy
}

describe('Baxter CRRT release gating', () => {
  afterEach(() => {
    jest.unmock(stentReleasePath)
    jest.unmock(baxterCrrtReleasePath)
    jest.unmock(cardiohelpReleasePath)
    jest.unmock(ventilationReleasePath)
    jest.resetModules()
  })

  it('recognizes localized draft routes and keeps them unlisted for every viewer', async () => {
    const policy = await loadPolicy('draft')
    for (const path of ['/baxter-crrt', '/es/baxter-crrt', '/zh-CN/baxter-crrt']) {
      expect(policy.isDraftModulePath(path)).toBe(true)
      expect(policy.isUnlistedModulePath(path)).toBe(true)
      expect(policy.isVisibleModulePath(path)).toBe(false)
      expect(policy.isVisibleModulePath(path, { isAdmin: true })).toBe(false)
    }
  })

  it('keeps a future published route unlisted until a separate listing decision', async () => {
    const policy = await loadPolicy('published')
    expect(policy.isDraftModulePath('/baxter-crrt')).toBe(false)
    expect(policy.isUnlistedModulePath('/baxter-crrt')).toBe(true)
    expect(policy.isVisibleModulePath('/baxter-crrt')).toBe(false)
  })
})
