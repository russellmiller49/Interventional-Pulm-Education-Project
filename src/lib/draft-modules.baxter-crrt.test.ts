type BaxterCrrtReleaseStage =
  | 'private-development'
  | 'sme-review'
  | 'unlisted-preview'
  | 'published'

export {}

const stentReleasePath = '@/features/airway-stent-mechanics/explorer/release'
const baxterCrrtReleasePath = '@/features/baxter-crrt/content'
const cardiohelpReleasePath = '@/features/cardiohelp-ecmo/content/deviceProfile'
const ventilationReleasePath = '@/features/mechanical-ventilation/content/deviceProfiles'

async function loadPolicy(stage: BaxterCrrtReleaseStage) {
  let policy: typeof import('./draft-modules') | undefined
  await jest.isolateModulesAsync(async () => {
    jest.doMock(stentReleasePath, () => ({ stentExplorerPublicationStatus: 'published' }))
    jest.doMock(baxterCrrtReleasePath, () => ({ baxterCrrtReleaseStage: stage }))
    jest.doMock(cardiohelpReleasePath, () => ({ cardiohelpEcmoPublicationStatus: 'published' }))
    jest.doMock(ventilationReleasePath, () => ({
      mechanicalVentilationPublicationStatus: 'published',
    }))
    policy = await import('./draft-modules')
  })
  if (!policy) throw new Error('Unable to load Baxter CRRT policy.')
  return policy
}

describe('Baxter CRRT release-stage routing', () => {
  afterEach(() => {
    jest.unmock(stentReleasePath)
    jest.unmock(baxterCrrtReleasePath)
    jest.unmock(cardiohelpReleasePath)
    jest.unmock(ventilationReleasePath)
    jest.resetModules()
  })

  it.each(['private-development', 'sme-review', 'unlisted-preview'] as const)(
    'keeps %s unlisted and absent from visible navigation',
    async (stage) => {
      const policy = await loadPolicy(stage)
      for (const path of ['/baxter-crrt', '/es/baxter-crrt', '/zh-CN/baxter-crrt']) {
        expect(policy.isDraftModulePath(path)).toBe(true)
        expect(policy.isUnlistedModulePath(path)).toBe(true)
        expect(policy.isVisibleModulePath(path)).toBe(false)
      }
    },
  )

  it('makes every future published learner route public and listed', async () => {
    const policy = await loadPolicy('published')
    expect(policy.isDraftModulePath('/baxter-crrt')).toBe(false)
    expect(policy.isUnlistedModulePath('/baxter-crrt')).toBe(false)
    expect(policy.isVisibleModulePath('/baxter-crrt')).toBe(true)
    expect(policy.isUnlistedModulePath('/baxter-crrt/review')).toBe(false)
    expect(policy.isVisibleModulePath('/baxter-crrt/learn')).toBe(true)
    expect(policy.isVisibleModulePath('/baxter-crrt/practice')).toBe(true)
    expect(policy.isVisibleModulePath('/baxter-crrt/assess')).toBe(true)
  })
})
