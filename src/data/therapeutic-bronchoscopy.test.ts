import { therapeuticBronchoscopyModules } from './therapeutic-bronchoscopy'

describe('therapeutic bronchoscopy catalog', () => {
  it('groups the four released therapeutic submodules under one hub', () => {
    expect(therapeuticBronchoscopyModules).toEqual([
      { id: 'rigidBronchoscopy', href: '/rigid-bronchoscopy' },
      { id: 'thermalAblation', href: '/thermal-ablation' },
      { id: 'peripheralAblation', href: '/peripheral-ablation' },
      { id: 'airwayStents', href: '/airway-stent-mechanics' },
    ])
  })

  it('keeps every submodule route unique and leaves tracheostomy as a separate module', () => {
    const hrefs = therapeuticBronchoscopyModules.map((module) => module.href)

    expect(new Set(hrefs).size).toBe(4)
    expect(hrefs).not.toContain('/tracheostomy')
  })
})
