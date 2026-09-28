/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  compositionLine,
  COURSE_MINUTES_ESTIMATE,
  curriculumChapters,
  curriculumSections,
  integratedCases,
  MODEL_BOUNDARIES,
  practiceScenarios,
  TITLE_REWORDINGS,
} from '../content/curriculum'
import { thoracoscopyCopyErrors } from '../content/learnerCopy'
import { THORACOSCOPY_SECTION_IDS } from '../content/sectionIds'
import { spineSentence, THORACOSCOPY_SPINE } from '../content/spine'

type Manifest = {
  learnSections: {
    number: number
    id: string
    title: string
    activity: string
    minutesEstimate: number
  }[]
  learnMinutesEstimateTotal: number
  chapters: {
    names: string[]
    assignment: { status: string; proposal: { chapter: string; sections: number[] }[] }
  }
  practiceScenarios: { id: string; title: string; pairsWithLearn: number[] }[]
  integratedCases: { id: string; title: string }[]
  spine: { phases: string[] }
  modelBoundaries: { text: string }[]
  routes: { base: string; learnerLabels: { assess: string } }
  progress: { storageKey: string; neverTouch: { key: string }[] }
}

const manifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/medical-thoracoscopy/implementation-manifest.json'),
    'utf8',
  ),
) as Manifest

/**
 * The course's order comes from one place, and that place is the imported inventory. Every id,
 * number, title, minute estimate, pairing and chapter here is held to the manifest.
 */
describe('curriculum registry', () => {
  it('lists the nineteen sections of the manifest, in its order, with its ids and numbers', () => {
    expect(THORACOSCOPY_SECTION_IDS).toEqual(manifest.learnSections.map((section) => section.id))
    expect(curriculumSections.map((section) => [section.number, section.id])).toEqual(
      manifest.learnSections.map((section) => [section.number, section.id]),
    )
  })

  it('keeps each imported title, activity and minute estimate', () => {
    manifest.learnSections.forEach((imported, index) => {
      const section = curriculumSections[index]
      expect(section.importedTitle).toBe(imported.title)
      expect(section.plannedActivity).toBe(imported.activity)
      expect(section.minutes).toBe(imported.minutesEstimate)
    })
    expect(COURSE_MINUTES_ESTIMATE).toBe(manifest.learnMinutesEstimateTotal)
  })

  it('shows a learner a different title only where a rewording is recorded, with its reason', () => {
    for (const section of curriculumSections) {
      const rewording = TITLE_REWORDINGS[section.id]
      if (rewording) {
        expect(section.title).toBe(rewording.learner)
        expect(section.title).not.toBe(section.importedTitle)
        expect(thoracoscopyCopyErrors('imported', section.importedTitle)).not.toEqual([])
      } else {
        expect(section.title).toBe(section.importedTitle)
      }
    }
    expect(Object.keys(TITLE_REWORDINGS)).toEqual(['complications'])
  })

  it('uses the chapter names of the plan and the assignment the owner has been offered', () => {
    expect(curriculumChapters.map((chapter) => chapter.title)).toEqual(manifest.chapters.names)
    expect(manifest.chapters.assignment.status).toBe('proposed change')
    expect(
      curriculumChapters.map((chapter) =>
        chapter.sectionIds.map((id) => THORACOSCOPY_SECTION_IDS.indexOf(id) + 1),
      ),
    ).toEqual(manifest.chapters.assignment.proposal.map((entry) => entry.sections))
  })

  it('pairs each practice scenario with the sections the manifest names, and lists the cases', () => {
    expect(
      practiceScenarios.map((scenario) => [
        scenario.id,
        scenario.title,
        scenario.pairsWith.map((id) => THORACOSCOPY_SECTION_IDS.indexOf(id) + 1),
      ]),
    ).toEqual(
      manifest.practiceScenarios.map((entry) => [entry.id, entry.title, entry.pairsWithLearn]),
    )
    expect(integratedCases.map((item) => [item.id, item.title])).toEqual(
      manifest.integratedCases.map((entry) => [entry.id, entry.title]),
    )
  })

  it('carries the spine and one learner statement per model boundary', () => {
    expect([...THORACOSCOPY_SPINE]).toEqual(manifest.spine.phases)
    expect(spineSentence()).toBe(
      'Decide, set up, enter, make room, survey, sample, treat and finish.',
    )
    expect(MODEL_BOUNDARIES).toHaveLength(manifest.modelBoundaries.length)
    expect(MODEL_BOUNDARIES[0]).toBe(manifest.modelBoundaries[0].text)
    expect(MODEL_BOUNDARIES[5]).toMatch(/not competence/)
  })

  it('opens nothing yet: every section, scenario and case is in preparation', () => {
    for (const entry of [...curriculumSections, ...practiceScenarios, ...integratedCases]) {
      expect(entry.state).toBe('in-preparation')
    }
  })

  it('counts its own composition line', () => {
    expect(compositionLine()).toBe('19 sections in 5 chapters · about 154 min')
  })
})

describe('learner-copy gate', () => {
  it('refuses examination and correctness words, praise, and digits where they are refused', () => {
    expect(thoracoscopyCopyErrors('x', 'Pass the test to continue.').join()).toMatch(/pass, test/)
    expect(thoracoscopyCopyErrors('x', 'When something goes wrong').join()).toMatch(/wrong/)
    expect(thoracoscopyCopyErrors('x', 'The best single-port telescope.').join()).toMatch(/best/)
    expect(thoracoscopyCopyErrors('x', 'Chapter 2', { allowDigits: false }).join()).toMatch(/digit/)
    expect(thoracoscopyCopyErrors('x', '   ')).toEqual(['x is empty.'])
  })

  it('exempts a term only when a reason is named', () => {
    expect(
      thoracoscopyCopyErrors('x', 'Pleural fluid pH below 7.2 in 90 % of cases.', {
        exemptions: [{ term: '%', reason: 'A proportion from the cited source.' }],
      }),
    ).toEqual([])
  })

  it('accepts plain clinical copy', () => {
    expect(thoracoscopyCopyErrors('x', 'Look everywhere, in order.')).toEqual([])
  })
})

describe('routes and progress as the manifest declares them', () => {
  it('uses the manifest base and labels the fourth tab Cases', () => {
    expect(manifest.routes.base).toBe('/medical-thoracoscopy')
    expect(manifest.routes.learnerLabels.assess).toBe('Cases')
  })

  it('names the storage key the engine uses, and the one it must never touch', async () => {
    const engine = await import('../engine/selfPacedProgress')
    expect(engine.THORACOSCOPY_PROGRESS_STORAGE_KEY).toBe(manifest.progress.storageKey)
    expect(manifest.progress.neverTouch.map((entry) => entry.key)).toEqual([
      'ip-pleural-module-progress-v1',
    ])
  })
})
