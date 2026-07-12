type ClinicalReviewStatus = 'draft' | 'reviewed'

const clinicalModuleCopyPath = '@/features/airway-stent-mechanics/content/clinicalModuleCopy'

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

async function loadDraftModulePolicy(clinicalReviewStatus: ClinicalReviewStatus) {
  let policy: typeof import('./draft-modules') | undefined

  await jest.isolateModulesAsync(async () => {
    jest.doMock(clinicalModuleCopyPath, () => ({
      clinicalModuleCopy: { clinicalReviewStatus },
    }))
    policy = await import('./draft-modules')
  })

  if (!policy) throw new Error('Unable to load the isolated draft-module policy.')
  return policy
}

describe('airway-stent release visibility', () => {
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
    jest.unmock(clinicalModuleCopyPath)
    jest.resetModules()
  })

  it('hides a draft lab from ordinary production users while retaining admin preview', async () => {
    const policy = await loadDraftModulePolicy('draft')
    const path = '/airway-stent-mechanics'

    expect(policy.areDraftModulesEnabled).toBe(false)
    expect(policy.isDraftModulePath(path)).toBe(true)
    expect(policy.isVisibleModulePath(path)).toBe(false)
    expect(policy.isVisibleModulePath(path, { isAdmin: true })).toBe(true)
  })

  it('makes the lab visible to ordinary production users after clinical review', async () => {
    const policy = await loadDraftModulePolicy('reviewed')
    const path = '/airway-stent-mechanics'

    expect(policy.areDraftModulesEnabled).toBe(false)
    expect(policy.isDraftModulePath(path)).toBe(false)
    expect(policy.isVisibleModulePath(path)).toBe(true)
  })
})
