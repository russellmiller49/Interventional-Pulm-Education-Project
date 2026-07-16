type HamiltonPublicationStatus = 'draft' | 'published'

export {}

const stentReleasePath = '@/features/airway-stent-mechanics/explorer/release'
const cardiohelpReleasePath = '@/features/cardiohelp-ecmo/content/deviceProfile'
const hamiltonReleasePath = '@/features/hamilton-c6-ventilation/content/deviceProfile'

async function loadPolicy(status: HamiltonPublicationStatus) {
  let policy: typeof import('./draft-modules') | undefined
  await jest.isolateModulesAsync(async () => {
    jest.doMock(stentReleasePath, () => ({ stentExplorerPublicationStatus: 'published' }))
    jest.doMock(cardiohelpReleasePath, () => ({ cardiohelpEcmoPublicationStatus: 'published' }))
    jest.doMock(hamiltonReleasePath, () => ({ hamiltonC6PublicationStatus: status }))
    policy = await import('./draft-modules')
  })
  if (!policy) throw new Error('Unable to load HAMILTON-C6 draft policy.')
  return policy
}

describe('HAMILTON-C6 release gating', () => {
  afterEach(() => {
    jest.unmock(stentReleasePath)
    jest.unmock(cardiohelpReleasePath)
    jest.unmock(hamiltonReleasePath)
    jest.resetModules()
  })

  it('recognizes the localized route while the review status is draft', async () => {
    const policy = await loadPolicy('draft')
    expect(policy.isDraftModulePath('/hamilton-c6-ventilation')).toBe(true)
    expect(policy.isDraftModulePath('/es/hamilton-c6-ventilation')).toBe(true)
  })

  it('removes the draft gate after a reviewed publication decision', async () => {
    const policy = await loadPolicy('published')
    expect(policy.isDraftModulePath('/hamilton-c6-ventilation')).toBe(false)
  })
})
