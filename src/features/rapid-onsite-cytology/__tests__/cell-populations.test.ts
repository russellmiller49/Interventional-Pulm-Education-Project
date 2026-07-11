import { cellPopulations, cellReadingSteps } from '../content/cell-populations'

describe('ROSE cell-population curriculum', () => {
  it('defines six distinct populations with complete interactive features', () => {
    expect(cellReadingSteps).toHaveLength(5)
    expect(cellPopulations).toHaveLength(6)
    expect(new Set(cellPopulations.map((population) => population.id)).size).toBe(6)

    for (const population of cellPopulations) {
      expect(population.features).toHaveLength(3)
      expect(population.diagramAlt.length).toBeGreaterThan(30)
      expect(population.oneLook.length).toBeGreaterThan(30)
      expect(population.onsiteMeaning.length).toBeGreaterThan(50)
      expect(population.pitfall.length).toBeGreaterThan(50)

      for (const feature of population.features) {
        expect(feature.xPct).toBeGreaterThan(0)
        expect(feature.xPct).toBeLessThan(100)
        expect(feature.yPct).toBeGreaterThan(0)
        expect(feature.yPct).toBeLessThan(100)
      }
    }
  })

  it('protects the high-yield distinctions learners should not overcall', () => {
    const bronchial = cellPopulations.find((population) => population.id === 'bronchial-epithelial')
    const neutrophil = cellPopulations.find((population) => population.id === 'neutrophil')
    const malignant = cellPopulations.find((population) => population.id === 'malignant-epithelial')
    const redCells = cellPopulations.find((population) => population.id === 'red-blood-cell')

    expect(bronchial?.onsiteMeaning).toMatch(/do not prove.*peripheral nodule/i)
    expect(neutrophil?.onsiteMeaning).toMatch(/do not identify the cause/i)
    expect(malignant?.pitfall).toMatch(/One atypical cell.*is not enough/i)
    expect(redCells?.onsiteMeaning).toMatch(/not proof of target representation/i)
  })
})
