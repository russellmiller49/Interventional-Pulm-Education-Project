import { stentExplorerStations } from '../explorer/stations'
import { stentExplorerCasePresets } from '../explorer/cases'

function getStation(id: (typeof stentExplorerStations)[number]['id']) {
  const station = stentExplorerStations.find((candidate) => candidate.id === id)
  if (!station) throw new Error(`Missing station ${id}`)
  return station
}

function bestAnswerCopy(station: (typeof stentExplorerStations)[number]): string {
  const bestChoice = station.prediction.choices.find(
    (choice) => choice.id === station.prediction.bestChoiceId,
  )
  if (!bestChoice) throw new Error(`Missing best choice for ${station.id}`)
  return `${bestChoice.label} ${bestChoice.rationale}`
}

describe('stent explorer clinical integrity', () => {
  it('keeps cough mechanics architecture-specific and granulation interpretation bounded', () => {
    const cough = getStation('cough-motion')
    const granulation = getStation('granulation')
    const coughCopy = JSON.stringify(cough)
    const granulationCopy = JSON.stringify(granulation)
    const bestGranulation = bestAnswerCopy(granulation)

    expect(bestAnswerCopy(cough)).toMatch(/architecture|braid|continuous wall/i)
    expect(cough.evidenceBoundary).toMatch(/not measured cough force/i)
    expect(cough.evidenceBoundary).toMatch(/no causal path/i)
    expect(coughCopy).not.toMatch(
      /\bcough(?:ing)?\b[^.!?]{0,120}\b(?:causes?|produces?|guarantees?|results? in|leads? to)\b[^.!?]{0,80}\bgranulation\b/i,
    )

    expect(granulation.evidenceRefs).toEqual(
      expect.arrayContaining([
        'ost-infection-granulation-2012',
        'hu-granulation-diameter-2011',
        'gupta-granulation-review-2025',
      ]),
    )
    expect(bestGranulation).toMatch(/multifactorial/i)
    expect(bestGranulation).toMatch(/fit|contact|motion/i)
    expect(bestGranulation).toMatch(/secretions|infection/i)
    expect(bestGranulation).toMatch(/time|host/i)
    expect(granulationCopy).toMatch(/cannot assign individual causality|probability|effect size/i)
  })

  it('does not reveal the committed prediction in pre-commit station copy', () => {
    const preCommitCopy = Object.fromEntries(
      stentExplorerStations.map((station) => [
        station.id,
        `${station.title} ${station.summary} ${station.clinicalHook} ${station.prediction.question} ${station.prediction.instruction} ${station.phases[0].instruction} ${station.phases[0].textEquivalent}`,
      ]),
    )

    for (const station of stentExplorerStations) {
      const bestChoice = station.prediction.choices.find(
        (choice) => choice.id === station.prediction.bestChoiceId,
      )
      expect(bestChoice).toBeDefined()
      expect(preCommitCopy[station.id].toLowerCase()).not.toContain(bestChoice!.label.toLowerCase())
    }

    expect(preCommitCopy['cough-motion']).not.toMatch(
      /braid[^.!?]{0,100}(?:shorten|end excursion)|continuous wall[^.!?]{0,100}(?:slide|straighten)/i,
    )
    expect(preCommitCopy['architecture-lumen']).not.toMatch(
      /continuous (?:silicone )?wall[^.!?]{0,120}thinner scaffold|thinner scaffold[^.!?]{0,120}continuous (?:silicone )?wall/i,
    )
    expect(preCommitCopy.migration).not.toMatch(
      /device moves relative to (?:a )?fixed airway landmark/i,
    )
    expect(preCommitCopy['curve-buckle']).not.toMatch(
      /central (?:inward )?(?:buckl|involution)|(?:end|branch) relationships/i,
    )
    expect(preCommitCopy['mucus-obstruction']).not.toMatch(
      /full lumen[^.!?]{0,120}(?:pocket|distal airway)|(?:pocket|distal airway)[^.!?]{0,120}full lumen/i,
    )
    expect(preCommitCopy.granulation).not.toMatch(
      /cannot (?:assign|determine)[^.!?]{0,100}(?:individual )?caus/i,
    )
    expect(preCommitCopy['tumor-ingrowth-overgrowth']).not.toMatch(
      /through (?:the )?(?:open )?cells[^.!?]{0,120}around (?:a )?covered end/i,
    )
    expect(preCommitCopy['fracture-cover-failure']).not.toMatch(
      /tortuos[^.!?]{0,120}repeated (?:load|loading)|repeated (?:load|loading)[^.!?]{0,120}tortuos/i,
    )
    expect(preCommitCopy['y-stent']).not.toMatch(
      /saddle[^.!?]{0,140}(?:limb|branch angle|distal orifice)|(?:limb|branch angle)[^.!?]{0,140}saddle/i,
    )
    expect(preCommitCopy['deploy-rescue']).not.toMatch(
      /both ends[^.!?]{0,160}(?:expansion|lumen|target coverage|adjacent branch)/i,
    )

    const preCommitCaseCopy = Object.fromEntries(
      stentExplorerCasePresets.map((preset) => [preset.id, `${preset.label} ${preset.summary}`]),
    )
    expect(preCommitCaseCopy['curved-left-mainstem-silicone-failure']).not.toMatch(
      /central (?:inward )?(?:buckl|involution)|branch crowd/i,
    )
    expect(preCommitCaseCopy['post-treatment-migration']).not.toMatch(
      /fixed landmark[^.!?]{0,120}(?:displace|movement)/i,
    )
    expect(preCommitCaseCopy['uncovered-sems-restenosis']).not.toMatch(/through open cells/i)
    expect(preCommitCaseCopy['tortuous-airway-fracture']).not.toMatch(/repeated (?:load|loading)/i)
    expect(preCommitCaseCopy['whole-y-carinal-mismatch']).not.toMatch(
      /saddle[^.!?]{0,140}(?:limb|branch angle|distal orifice)|(?:limb|branch angle)[^.!?]{0,140}saddle/i,
    )
  })

  it('does not promote a universal diameter cutoff, patient risk, or quantitative mechanics output', () => {
    const authoredCopy = JSON.stringify(stentExplorerStations)

    expect(authoredCopy).not.toMatch(/\b90\s*%/i)
    expect(authoredCopy).not.toMatch(
      /\b(?:oversize|size)\b[^.!?]{0,80}\b(?:exactly|at least|no more than)\s*\d+(?:\.\d+)?\s*(?:%|mm|millimeters?)\b/i,
    )
    expect(authoredCopy).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:mN|N(?:\/mm)?|kPa|Pa)\b/)
    expect(authoredCopy).not.toMatch(
      /\b(?:granulation|migration|fracture)\s+(?:risk|probability)\s*(?:is|=|:)\s*\d/i,
    )
  })

  it('frames tortuosity and repeated loading without making cough a sole fracture cause', () => {
    const fracture = getStation('fracture-cover-failure')
    const bestCopy = bestAnswerCopy(fracture)

    expect(fracture.evidenceRefs).toContain('chung-airway-fracture-2008')
    expect(bestCopy).toMatch(/tortuosity|tortuous/i)
    expect(bestCopy).toMatch(/repeated/i)
    expect(bestCopy).not.toMatch(/cough alone determines/i)
    expect(fracture.evidenceBoundary).toMatch(/no cough-only mechanism/i)
  })

  it('keeps metallic topology, material, coverage, and constraint as interacting variables', () => {
    const metal = getStation('metal-architecture')
    const bestCopy = bestAnswerCopy(metal)
    const authoredCopy = JSON.stringify(metal)

    expect(bestCopy).toMatch(/braid|crossing/i)
    expect(bestCopy).toMatch(/connector|linked rings/i)
    expect(bestCopy).toMatch(/not a universal performance ranking/i)
    expect(authoredCopy).toMatch(/topology|junction/i)
    expect(authoredCopy).toMatch(/coverage|material/i)
    expect(authoredCopy).toMatch(/constraint|finished geometry/i)
    expect(metal.evidenceRefs).toEqual(
      expect.arrayContaining([
        'textbook-sems-2025',
        'textbook-airway-stents-primer-2025',
        'ratnovsky-airway-mechanics-2015',
        'mckenna-covered-braid-2021',
        'pelton-nitinol-fatigue-2008',
      ]),
    )
    expect(metal.evidenceBoundary).toMatch(/no universal force|device-ranking/i)
    expect(authoredCopy).not.toMatch(/nitinol (?:is|performs) (?:always )?(?:best|better)/i)
    expect(authoredCopy).not.toMatch(
      /stainless steel (?:is|performs) (?:always )?(?:worse|inferior)/i,
    )
    expect(authoredCopy).not.toMatch(/laser-cut (?:stents? )?(?:never|cannot) foreshorten/i)
  })

  it('teaches coverage as a pathway tradeoff rather than absolute protection', () => {
    const tumor = getStation('tumor-ingrowth-overgrowth')
    const bestCopy = bestAnswerCopy(tumor)

    expect(bestCopy).toMatch(/through open cells/i)
    expect(bestCopy).toMatch(/around a covered end/i)
    expect(bestCopy).toMatch(/does not guarantee/i)
    expect(bestCopy).not.toMatch(/prevents all recurrent growth/i)
  })

  it('keeps procedure content conceptual and requires device-specific judgment', () => {
    const deploy = getStation('deploy-rescue')
    const authoredProcedureCopy = JSON.stringify({
      phases: deploy.phases,
      response: deploy.conceptualResponse,
      boundary: deploy.evidenceBoundary,
    })

    expect(deploy.evidenceBoundary).toMatch(/not instructions for unsupervised/i)
    expect(authoredProcedureCopy).toMatch(/device-specific instructions/i)
    expect(authoredProcedureCopy).not.toMatch(
      /\b(?:advance|insert)\b[^.!?]{0,80}\b(?:bronchoscope|forceps|loader|deployment catheter)\b/i,
    )
  })
})
