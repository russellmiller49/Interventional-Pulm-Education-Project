type PublicationStatus = 'draft' | 'published'

const stentExplorerReleasePath = '@/features/airway-stent-mechanics/explorer/release'
const cardiohelpEcmoReleasePath = '@/features/cardiohelp-ecmo/content/deviceProfile'

function setNodeEnv(value: string | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, 'NODE_ENV')
    return
  }

  Object.defineProperty(process.env, 'NODE_ENV', {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

async function loadDraftModulePolicy(publicationStatus: PublicationStatus) {
  let policy: typeof import('./draft-modules') | undefined

  await jest.isolateModulesAsync(async () => {
    jest.doMock(stentExplorerReleasePath, () => ({
      stentExplorerPublicationStatus: publicationStatus,
    }))
    policy = await import('./draft-modules')
  })

  if (!policy) throw new Error('Unable to load the isolated draft-module policy.')
  return policy
}

async function loadCardiohelpDraftModulePolicy(publicationStatus: PublicationStatus) {
  let policy: typeof import('./draft-modules') | undefined

  await jest.isolateModulesAsync(async () => {
    jest.doMock(stentExplorerReleasePath, () => ({
      stentExplorerPublicationStatus: 'published',
    }))
    jest.doMock(cardiohelpEcmoReleasePath, () => ({
      cardiohelpEcmoPublicationStatus: publicationStatus,
    }))
    policy = await import('./draft-modules')
  })

  if (!policy) throw new Error('Unable to load the isolated CARDIOHELP draft-module policy.')
  return policy
}

describe('published module visibility', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalShowDraftModules = process.env.NEXT_PUBLIC_SHOW_DRAFT_MODULES

  beforeEach(() => {
    setNodeEnv('production')
    delete process.env.NEXT_PUBLIC_SHOW_DRAFT_MODULES
  })

  afterEach(() => {
    setNodeEnv(originalNodeEnv)
    if (originalShowDraftModules === undefined) {
      delete process.env.NEXT_PUBLIC_SHOW_DRAFT_MODULES
    } else {
      process.env.NEXT_PUBLIC_SHOW_DRAFT_MODULES = originalShowDraftModules
    }
    jest.unmock(stentExplorerReleasePath)
    jest.unmock(cardiohelpEcmoReleasePath)
    jest.resetModules()
  })

  it('hides a draft airway-stent explorer while retaining admin preview', async () => {
    const policy = await loadDraftModulePolicy('draft')
    const path = '/airway-stent-mechanics'

    expect(policy.areDraftModulesEnabled).toBe(false)
    expect(policy.isDraftModulePath(path)).toBe(true)
    expect(policy.isVisibleModulePath(path)).toBe(false)
    expect(policy.isVisibleModulePath(path, { isAdmin: true })).toBe(true)
  })

  it('makes the airway-stent explorer visible after the editorial publication decision', async () => {
    const policy = await loadDraftModulePolicy('published')
    const path = '/airway-stent-mechanics'

    expect(policy.areDraftModulesEnabled).toBe(false)
    expect(policy.isDraftModulePath(path)).toBe(false)
    expect(policy.isVisibleModulePath(path)).toBe(true)
  })

  it('keeps the CARDIOHELP ECMO lab hidden except for admin preview while review is pending', async () => {
    const policy = await loadCardiohelpDraftModulePolicy('draft')
    const path = '/cardiohelp-ecmo'

    expect(policy.isDraftModulePath(path)).toBe(true)
    expect(policy.isDraftModulePath('/es/cardiohelp-ecmo')).toBe(true)
    expect(policy.isVisibleModulePath(path)).toBe(false)
    expect(policy.isVisibleModulePath(path, { isAdmin: true })).toBe(true)
  })

  it('supports a reviewed publication decision without changing route code', async () => {
    const policy = await loadCardiohelpDraftModulePolicy('published')
    expect(policy.isDraftModulePath('/cardiohelp-ecmo')).toBe(false)
    expect(policy.isVisibleModulePath('/cardiohelp-ecmo')).toBe(true)
  })

  it('keeps every released therapeutic module and tracheostomy visible in production', async () => {
    const policy = await loadDraftModulePolicy('published')
    const releasedPaths = [
      '/rigid-bronchoscopy',
      '/thermal-ablation',
      '/peripheral-ablation',
      '/airway-stent-mechanics',
      '/tracheostomy',
      '/therapeutic-bronchoscopy',
    ]

    for (const path of releasedPaths) {
      expect(policy.isDraftModulePath(path)).toBe(false)
      expect(policy.isVisibleModulePath(path)).toBe(true)
    }
  })
})
