type MechanicalVentilationPublicationStatus = 'draft' | 'published'

export {}

const stentReleasePath = '@/features/airway-stent-mechanics/explorer/release'
const cardiohelpReleasePath = '@/features/cardiohelp-ecmo/content/deviceProfile'
const hamiltonReleasePath = '@/features/mechanical-ventilation/content/deviceProfiles'

async function loadPolicy(status: MechanicalVentilationPublicationStatus) {
  let policy: typeof import('./draft-modules') | undefined
  await jest.isolateModulesAsync(async () => {
    jest.doMock(stentReleasePath, () => ({ stentExplorerPublicationStatus: 'published' }))
    jest.doMock(cardiohelpReleasePath, () => ({ cardiohelpEcmoPublicationStatus: 'published' }))
    jest.doMock(hamiltonReleasePath, () => ({ mechanicalVentilationPublicationStatus: status }))
    policy = await import('./draft-modules')
  })
  if (!policy) throw new Error('Unable to load mechanical ventilation draft policy.')
  return policy
}

describe('mechanical ventilation release gating', () => {
  afterEach(() => {
    jest.unmock(stentReleasePath)
    jest.unmock(cardiohelpReleasePath)
    jest.unmock(hamiltonReleasePath)
    jest.resetModules()
  })

  it('recognizes the localized route while the review status is draft', async () => {
    const policy = await loadPolicy('draft')
    expect(policy.isDraftModulePath('/mechanical-ventilation')).toBe(true)
    expect(policy.isDraftModulePath('/es/mechanical-ventilation')).toBe(true)
    expect(policy.isDraftModulePath('/hamilton-c6-ventilation')).toBe(true)
    expect(policy.isDraftModulePath('/es/hamilton-c6-ventilation')).toBe(true)
  })

  it('removes the draft gate after a reviewed publication decision', async () => {
    const policy = await loadPolicy('published')
    expect(policy.isDraftModulePath('/mechanical-ventilation')).toBe(false)
    expect(policy.isDraftModulePath('/hamilton-c6-ventilation')).toBe(false)
  })
})
