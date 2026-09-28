/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { claims } from '../content/claimRegister'
import { curriculumSection } from '../content/curriculum'
import { pleuralZones } from '../content/pleuralZones'
import { THORACOSCOPY_SECTION_IDS } from '../content/sectionIds'
import { WRITTEN_SECTIONS } from '../content/sections'
import { sectionClaimIds, sectionProblems, sectionSetProblems } from '../content/sectionValidation'
import type { ThoracoscopySectionSpec } from '../content/types'

/**
 * The written sections against the section authoring guide, and the validator against each rule
 * broken on purpose, so a rule that stops working fails here rather than letting a section through.
 */
const bySection = new Map(WRITTEN_SECTIONS.map((spec) => [spec.id, spec] as const))
const four = bySection.get('four-controls') as ThoracoscopySectionSpec
const survey = bySection.get('systematic-survey') as ThoracoscopySectionSpec

/** A spec with every field writable, so a test can break one rule at a time. */
type Mutable<T> = T extends RegExp
  ? T
  : T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T

function edited(
  spec: ThoracoscopySectionSpec,
  change: (copy: Mutable<ThoracoscopySectionSpec>) => void,
): ThoracoscopySectionSpec {
  // structuredClone keeps RegExp objects, which the answer phrases are.
  const copy = structuredClone(spec) as Mutable<ThoracoscopySectionSpec>
  change(copy)
  return copy as ThoracoscopySectionSpec
}

/** The module plan's ladder: "Rests on" and "Used again by", by section number. */
function ladder(): Map<string, { restsOn: string[]; usedAgainBy: string[] }> {
  const plan = readFileSync(join(process.cwd(), 'docs/medical-thoracoscopy/module-plan.md'), 'utf8')
  const expand = (cell: string): string[] =>
    cell
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && part !== '—' && !/^All$|^Assumed/.test(part))
      .flatMap((part) => {
        const range = part.match(/^([A-Z]?)(\d+)–\1?(\d+)$/)
        if (!range) return [part]
        const [, prefix, from, to] = range
        return Array.from({ length: Number(to) - Number(from) + 1 }, (_, n) => {
          return `${prefix}${Number(from) + n}`
        })
      })
      .map((part) => (/^\d+$/.test(part) ? THORACOSCOPY_SECTION_IDS[Number(part) - 1] : part))
  const rows = new Map<string, { restsOn: string[]; usedAgainBy: string[] }>()
  for (const line of plan.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim())
    const id = cells[2]?.match(/^`([a-z-]+)`$/)?.[1]
    if (!id) continue
    rows.set(id, { restsOn: expand(cells[6]), usedAgainBy: expand(cells[7]) })
  }
  return rows
}

describe('the written sections', () => {
  it('are sections 6, 7 and 11, in the course order', () => {
    expect(WRITTEN_SECTIONS.map((spec) => curriculumSection(spec.id).number)).toEqual([6, 7, 11])
  })

  it.each(WRITTEN_SECTIONS.map((spec) => [spec.id, spec] as const))(
    '%s keeps the authoring contract',
    (_id, spec) => {
      expect(sectionProblems(spec)).toEqual([])
    },
  )

  it('keep the rules that hold across sections', () => {
    expect(sectionSetProblems(WRITTEN_SECTIONS)).toEqual([])
  })

  it.each(WRITTEN_SECTIONS.map((spec) => [spec.id, spec] as const))(
    '%s rests on and is used by what the module plan says',
    (id, spec) => {
      const row = ladder().get(id)

      expect(row).toBeDefined()
      expect([...spec.suggestedBackground]).toEqual(row?.restsOn)
      expect([...spec.usedAgainBy]).toEqual(row?.usedAgainBy)
    },
  )

  it('tour every zone in section 6 and survey them in their order in section 11', () => {
    const tour = bySection.get('normal-pleural-space')?.activity
    const order = pleuralZones.map((zone) => zone.id)

    expect(tour?.kind === 'tour' && tour.stops.map((stop) => stop.zone)).toEqual(order)
    expect(survey.activity.kind === 'survey' && survey.activity.order).toEqual(order)
  })

  it('show all four controls in section 7, and let the learner use only what has been taught', () => {
    expect(four.controls.shown).toEqual(['port', 'scope', 'tool', 'space'])
    expect(four.controls.operable).toEqual(['scope'])
    expect(bySection.get('normal-pleural-space')?.controls).toEqual({ shown: [], operable: [] })
    for (const control of survey.controls.shown) expect(four.controls.shown).toContain(control)
  })

  it('carry nothing that counts, scores or ranks', () => {
    const keys = new Set<string>()
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object' && !(value instanceof RegExp)) {
        for (const [key, inner] of Object.entries(value)) {
          keys.add(key)
          walk(inner)
        }
      }
    }
    WRITTEN_SECTIONS.forEach(walk)

    for (const key of keys) expect(key).not.toMatch(/score|point|weight|mastery|pass|grade|rank/i)
  })

  it('cite exactly the claims that list them as written', () => {
    for (const spec of WRITTEN_SECTIONS) {
      const listing = claims
        .filter((claim) =>
          claim.surfaces.some(
            (surface) =>
              surface.kind === 'section' && surface.id === spec.id && surface.state === 'written',
          ),
        )
        .map((claim) => claim.id)
      expect(listing).toEqual([...sectionClaimIds(spec)].sort())
    }
  })

  it('appear in the traceability register with their claims, content and tests', () => {
    const traceability = JSON.parse(
      readFileSync(
        join(process.cwd(), 'docs/medical-thoracoscopy/registers/traceability.json'),
        'utf8',
      ),
    ) as {
      rows: {
        experience: string
        state: string
        content: string[]
        claims: string[]
        tests: string[]
      }[]
    }
    for (const spec of WRITTEN_SECTIONS) {
      const row = traceability.rows.find((entry) => entry.experience === spec.id)

      expect(row?.state).toBe('written')
      expect(row?.claims).toEqual([...sectionClaimIds(spec)].sort())
      for (const path of [...(row?.content ?? []), ...(row?.tests ?? [])]) {
        expect(existsSync(join(process.cwd(), path))).toBe(true)
      }
    }
  })
})

describe('the section validator refuses', () => {
  const problemsOf = (spec: ThoracoscopySectionSpec) => sectionProblems(spec).join('\n')

  it('a checklist longer than four', () => {
    const spec = edited(four, (copy) => {
      copy.anchor.checklist.push('A fifth thing')
    })
    expect(problemsOf(spec)).toMatch(/four items or fewer/)
  })

  it('a question with two best choices, or with its answer in the stem', () => {
    const twoBest = edited(four, (copy) => {
      copy.question.choices[0].plausibility = 'best'
    })
    expect(problemsOf(twoBest)).toMatch(/exactly one best choice/)

    const leaking = edited(four, (copy) => {
      copy.question.stem += ' Hint: toward the head.'
    })
    expect(problemsOf(leaking)).toMatch(/the stem gives the answer away/)
  })

  it('a prediction whose answer sits in a block placed before it', () => {
    const spec = edited(four, (copy) => {
      copy.blocks[0].body += ' Move the eyepiece toward the head.'
    })
    expect(problemsOf(spec)).toMatch(/placed before the question gives the answer away/)
  })

  it('background from a later section, and a forward link to an earlier one', () => {
    const spec = edited(four, (copy) => {
      copy.suggestedBackground = ['making-room']
      copy.usedAgainBy = ['the-instrument']
    })
    expect(problemsOf(spec)).toMatch(/suggested background making-room comes earlier/)
    expect(problemsOf(spec)).toMatch(/used again by the-instrument, which comes later/)
  })

  it('a claim the register does not hold, and a claim that lists the section it is not cited by', () => {
    const unknown = edited(four, (copy) => {
      copy.harmfulReflex.claimIds.push('MT-C-9999')
    })
    expect(problemsOf(unknown)).toMatch(/MT-C-9999, which is not in the claim register/)

    const orphan = claims.map((claim) =>
      claim.id === 'MT-C-0006'
        ? {
            ...claim,
            surfaces: [
              ...claim.surfaces,
              { kind: 'section' as const, id: 'systematic-survey', state: 'written' as const },
            ],
          }
        : claim,
    )
    expect(sectionProblems(survey, orphan).join('\n')).toMatch(
      /MT-C-0006 lists the section but the section does not cite it/,
    )
  })

  it('a harmful reflex that does not say what the model leaves unmodelled', () => {
    const spec = edited(four, (copy) => {
      copy.harmfulReflex.inThisModel = 'The model stops it.'
    })
    expect(problemsOf(spec)).toMatch(/does not model about the harmful reflex/)
  })

  it('a control used before the section that teaches it', () => {
    const spec = edited(four, (copy) => {
      copy.controls.operable.push('tool')
    })
    expect(problemsOf(spec)).toMatch(/control tool is usable only from the section that teaches it/)
  })

  it('a forward link to a section title that does not exist', () => {
    const spec = edited(survey, (copy) => {
      copy.blocks[0].body += ' More is taught in “Biopsy basics”.'
    })
    expect(problemsOf(spec)).toMatch(/links to “Biopsy basics”, not a section title/)
  })

  it('a survey out of the zone order', () => {
    const spec = edited(survey, (copy) => {
      if (copy.activity.kind === 'survey') copy.activity.order.reverse()
    })
    expect(problemsOf(spec)).toMatch(/survey keeps the order of the zone list/)
  })

  it('grading words, and a digit in a heading', () => {
    const spec = edited(four, (copy) => {
      copy.blocks[1].body += ' Your score goes up.'
      copy.blocks[1].heading = 'Step 2'
    })
    expect(problemsOf(spec)).toMatch(/vocabulary the learner-copy gate refuses/)
    expect(problemsOf(spec)).toMatch(/carries a digit/)
  })

  it('an authored label on a measured or derived signal', () => {
    const spec = edited(four, (copy) => {
      copy.signals[2].provenance = 'derived'
    })
    expect(problemsOf(spec)).toMatch(/an authored label on a derived signal/)
  })

  it('the best answer in the same place in every question', () => {
    const same = WRITTEN_SECTIONS.map((spec) =>
      edited(spec, (copy) => {
        for (const question of [copy.question, copy.transfer]) {
          const choices = question.choices
          const best = choices.findIndex((choice) => choice.plausibility === 'best')
          ;[choices[0], choices[best]] = [choices[best], choices[0]]
        }
      }),
    )
    expect(sectionSetProblems(same).join('\n')).toMatch(/not always in the same position/)
  })
})
