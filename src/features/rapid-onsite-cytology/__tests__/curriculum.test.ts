import {
  roseAdequacyAxes,
  roseArtifactRescues,
  roseDecisionCases,
  roseFrameworkSteps,
  roseReferences,
} from '../content/curriculum'

describe('ROSE curriculum integrity', () => {
  it('keeps the curriculum balanced around decisions, not just morphology labels', () => {
    expect(roseAdequacyAxes).toHaveLength(3)
    expect(roseArtifactRescues).toHaveLength(4)
    expect(roseFrameworkSteps).toHaveLength(6)
    expect(roseDecisionCases.length).toBeGreaterThanOrEqual(5)

    const focuses = new Set(roseDecisionCases.map((caseItem) => caseItem.focus))
    expect(focuses.size).toBe(roseDecisionCases.length)
  })

  it('keeps representation, endpoint sufficiency, and procedural staging separate', () => {
    const sufficiencyAxis = roseAdequacyAxes.find((axis) => axis.id === 'sufficient')
    const stagingCase = roseDecisionCases.find((caseItem) => caseItem.id === 'represented-node')

    expect(sufficiencyAxis?.positiveSignal).toMatch(/may not be knowable onsite/i)
    expect(stagingCase?.reveal.onsiteCall).toMatch(/specimen labeled station 4L/i)
    expect(stagingCase?.reveal.reasoning.join(' ')).toMatch(/N3, then N2, then N1/i)
    expect(stagingCase?.reveal.pitfall).toMatch(/completed mediastinal stage/i)
  })

  it('preserves infection and lymphoma pathways without overpromising exclusion', () => {
    const granulomaCase = roseDecisionCases.find((caseItem) => caseItem.id === 'granulomatous')
    const lymphomaCase = roseDecisionCases.find((caseItem) => caseItem.id === 'atypical-lymphoid')

    expect(granulomaCase?.reveal.onsiteCall).toMatch(
      /If infection is in the clinical differential/i,
    )
    expect(granulomaCase?.reveal.reasoning.join(' ')).toMatch(/TB PCR/i)
    expect(granulomaCase?.reveal.pitfall).toMatch(/opportunity for culture is permanently lost/i)
    expect(lymphomaCase?.reveal.reasoning.join(' ')).toMatch(
      /negative flow cytometry.*does not exclude lymphoma/i,
    )
    expect(lymphomaCase?.reveal.reasoning.join(' ')).toMatch(/architecture-preserving tissue/i)
  })

  it('provides two valid commit-before-reveal decisions and feedback for every case', () => {
    const caseIds = roseDecisionCases.map((caseItem) => caseItem.id)
    expect(new Set(caseIds).size).toBe(caseIds.length)

    for (const caseItem of roseDecisionCases) {
      for (const decision of [caseItem.assessment, caseItem.triage]) {
        const choiceIds = decision.choices.map((choice) => choice.id)
        expect(decision.choices.length).toBeGreaterThanOrEqual(3)
        expect(new Set(choiceIds).size).toBe(choiceIds.length)
        expect(choiceIds).toContain(decision.correctChoiceId)
        expect(decision.choices.every((choice) => choice.feedback.length > 30)).toBe(true)
      }

      expect(caseItem.reveal.onsiteCall).toMatch(/“.+”/)
      expect(caseItem.reveal.reasoning.length).toBeGreaterThanOrEqual(3)
      expect(caseItem.reveal.pitfall.length).toBeGreaterThan(30)
    }
  })

  it('includes traceable evidence and complete reuse metadata for teaching images', () => {
    expect(roseReferences.length).toBeGreaterThanOrEqual(4)
    expect(roseReferences.every((reference) => reference.url.startsWith('https://'))).toBe(true)
    expect(roseReferences.map((reference) => reference.id)).toEqual(
      expect.arrayContaining(['chest-2025', 'ers-staging-2026', 'cap-2020', 'cap-lymphoma-2021']),
    )

    const images = roseDecisionCases.flatMap((caseItem) => (caseItem.image ? [caseItem.image] : []))
    expect(images.length).toBeGreaterThanOrEqual(3)
    for (const image of images) {
      expect(image.sourceUrl).toMatch(/^https:\/\//)
      expect(image.licenseUrl).toMatch(/^https:\/\//)
      expect(image.attribution.length).toBeGreaterThan(10)
      expect(image.attribution).toMatch(/interactive teaching context added/i)
      expect(image.alt).not.toMatch(
        /adenocarcinoma|granulomatous inflammation|insufficient|lesional population/i,
      )
      expect(image.revealAlt).not.toBe(image.alt)
      expect(image.revealAlt.length).toBeGreaterThan(image.alt.length)
    }
  })
})
