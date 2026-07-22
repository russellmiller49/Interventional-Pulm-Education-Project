type IcuSimulationReleaseStage =
  | 'private-development'
  | 'sme-review'
  | 'tester-preview'
  | 'published'

export {}

const releasePath = '@/features/icu-simulation/content'

async function loadPolicy(stage: IcuSimulationReleaseStage) {
  let policy: typeof import('./draft-modules') | undefined

  await jest.isolateModulesAsync(async () => {
    jest.doMock(releasePath, () => ({ ICU_SIMULATION_RELEASE_STAGE: stage }))
    policy = await import('./draft-modules')
  })

  if (!policy) throw new Error('Unable to load the ICU Simulator draft-module policy.')
  return policy
}

describe('ICU Simulator release-stage routing', () => {
  afterEach(() => {
    jest.unmock(releasePath)
    jest.resetModules()
  })

  it.each(['private-development', 'sme-review', 'tester-preview'] as const)(
    'keeps %s routes draft, unlisted, and absent from visible navigation',
    async (stage) => {
      const policy = await loadPolicy(stage)

      for (const path of [
        '/icu-simulation',
        '/es/icu-simulation/learn',
        '/zh-CN/icu-simulation/practice',
        '/icu-simulation/assess',
        '/icu-simulation/sandbox',
      ]) {
        expect(policy.isDraftModulePath(path)).toBe(true)
        expect(policy.isUnlistedModulePath(path)).toBe(true)
        expect(policy.isVisibleModulePath(path)).toBe(false)
        expect(policy.isVisibleModulePath(path, { isAdmin: true })).toBe(false)
      }
    },
  )

  it('allows a future published route family to participate in visible navigation', async () => {
    const policy = await loadPolicy('published')

    for (const path of [
      '/icu-simulation',
      '/es/icu-simulation/learn',
      '/zh-CN/icu-simulation/practice',
      '/icu-simulation/assess',
      '/icu-simulation/sandbox',
    ]) {
      expect(policy.isDraftModulePath(path)).toBe(false)
      expect(policy.isUnlistedModulePath(path)).toBe(false)
      expect(policy.isVisibleModulePath(path)).toBe(true)
    }
  })
})
