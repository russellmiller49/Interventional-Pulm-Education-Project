import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import ts from 'typescript'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { crrtCaseReuseNote, crrtLearnPracticeCaseReuse } from '../caseReuse'
import { BaxterCrrtHub } from '../components/BaxterCrrtHub'
import { BaxterCrrtLearnLanding } from '../components/BaxterCrrtLearnLanding'
import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { CrrtFoundationLesson } from '../components/CrrtFoundationLesson'
import { baxterCrrtCases, getBaxterCrrtCase } from '../content/completeCases'
import {
  DECILITERS_PER_LITER,
  learnerMassConcentrationFromMilligramsPerLiter,
  milligramsPerDeciliterToMilligramsPerLiter,
  milligramsPerLiterToMilligramsPerDeciliter,
} from '../content/concentrationUnits'
import { crrtGlossary, crrtGlossaryEntry } from '../content/glossary'
import { baxterCrrtLearnLessons } from '../content/learnLessons'
import { BAXTER_CRRT_LEARN_LESSON_IDS } from '../content/learnerRegistry'
import {
  baxterCrrtLearnerFacingSourceById,
  crrtSourceSupportsClaim,
} from '../content/learnerSourceMap'
import { crrtLearnTasks } from '../content/learnTasks'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine/learningSession'
import { BAXTER_CRRT_PROGRESS_STORAGE_KEY, createDefaultProgress } from '../engine/progress'
import { selectCrrtLabEvidence } from '../labEvidence'
import { recordCrrtVisit } from '../selfPacedProgress'

/**
 * CRRT-FELLOW-04 — F-20 (visited means opened), F-24 (glossary, terminology, units), F-25
 * (titles and reset scope), X-04 (Learn reuses Practice cases, said honestly) and X-01 (what the
 * overview says about audience, order, visited, saving and time).
 */

jest.mock('@/features/critical-care/analytics', () => ({ recordCriticalCareEvent: jest.fn() }))
jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}))

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/en/baxter-crrt')
})

describe('visited means opened on this device, never completed (F-20)', () => {
  const markers = () => document.querySelectorAll('[data-visited-marker]')

  it('shows no visited marker in a clean state, and no completion tick at all', async () => {
    const { container } = render(<BaxterCrrtHub />)
    await settle()
    expect(markers()).toHaveLength(0)
    expect(container.querySelector('.lucide-check, .lucide-circle-check')).toBeNull()
    expect(container.querySelector('[data-complete]')).toBeNull()
  })

  it('marks an opened-and-skipped lesson "Visited", with the meaning spelled out', async () => {
    recordCrrtVisit({ section: 'learn', id: 'crrt-indications-modality', taskId: 'orient' })
    const { container } = render(<BaxterCrrtHub />)
    await settle()
    const visited = container.querySelectorAll('[data-visited="true"]')
    expect(visited.length).toBeGreaterThanOrEqual(2) // the sequence entry and the station chip
    for (const marker of Array.from(markers())) {
      expect(marker).toHaveTextContent('Visited')
      expect(marker).toHaveTextContent('opened on this device; not a record of completion')
    }
    expect(container.querySelector('.lucide-check')).toBeNull()
    // Opening did not create completion.
    const record = JSON.parse(window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!)
    expect(record.completedLessonIds).toEqual([])
    expect(record.selfPaced.visitedLessonIds).toEqual(['crrt-indications-modality'])
  })

  it('marks a visited case, and keeps markers for a returning learner', async () => {
    recordCrrtVisit({ section: 'practice', id: 'CRRT-01' })
    const first = render(<BaxterCrrtHub />)
    await settle()
    const chip = screen.getByRole('link', { name: /CRRT-01 · .* Visited/ })
    expect(chip).toHaveAttribute('data-visited', 'true')
    first.unmount()
    render(<BaxterCrrtHub />)
    await settle()
    expect(screen.getByRole('link', { name: /CRRT-01 · .* Visited/ })).toBeInTheDocument()
  })

  it('never reinterprets a historical completed array as visited, and writes nothing', async () => {
    const legacy = {
      ...createDefaultProgress(),
      completedLessonIds: ['crrt-indications-modality'],
      completedPracticeCaseIds: ['crrt-01'],
    }
    const bytes = JSON.stringify(legacy)
    window.localStorage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, bytes)
    render(<BaxterCrrtHub />)
    await settle()
    expect(markers()).toHaveLength(0)
    expect(window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)).toBe(bytes)
  })

  it('explains audience, order, what Visited means, what is saved — and claims no duration', async () => {
    const { container } = render(<BaxterCrrtHub />)
    await settle()
    const orientation = screen.getByRole('region', { name: 'Who this is for and how it works' })
    expect(orientation).toHaveTextContent('Who it is for')
    expect(orientation).toHaveTextContent('What you will practice')
    expect(orientation).toHaveTextContent('a recommendation, not a requirement')
    expect(orientation).toHaveTextContent('It is not a record of completion or competence')
    expect(orientation).toHaveTextContent('Answers, runs and settings are not saved')
    expect(container.textContent).not.toMatch(/\b\d+\s*(min|minutes|hours?)\b(?! of)/i)
  })

  it('labels the Learn landing’s section minutes as authoring estimates', () => {
    render(<BaxterCrrtLearnLanding />)
    expect(
      screen.getByText(
        /minutes shown beside each section are estimates .* not measured learner times/,
      ),
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/practise|behaviour/)
  })
})

describe('glossary (F-24)', () => {
  // The pack's first-use list (PBP, prescribed versus delivered, effluent, net machine removal,
  // whole-patient balance, pre/post replacement, diffusion/convection/UF) plus makeup and syringe.
  const required = [
    'pbp',
    'dialysate',
    'delivered-dose',
    'prescribed-flow',
    'actual-flow',
    'effluent',
    'net-machine-removal',
    'whole-patient-balance',
    'pre-filter-replacement',
    'post-filter-replacement',
    'diffusion',
    'convection',
    'ultrafiltration',
    'makeup',
    'syringe',
    'urea-marker',
  ]

  it('defines every required term, with its sources resolving and supporting the claim', () => {
    for (const id of required) expect(crrtGlossaryEntry(id)).toBeDefined()
    for (const entry of crrtGlossary) {
      for (const basis of entry.basis) {
        if (basis.kind === 'module-drawing') continue
        for (const sourceId of basis.sourceIds) {
          expect({
            entry: entry.id,
            sourceId,
            resolves: baxterCrrtLearnerFacingSourceById.has(sourceId),
          }).toEqual({ entry: entry.id, sourceId, resolves: true })
          if (basis.kind === 'clinical-publication') {
            expect(crrtSourceSupportsClaim(sourceId, basis.topic)).toBe(true)
          }
        }
      }
    }
  })

  it('keeps distinct concepts distinct and the makeup question open', () => {
    const notSame = (id: string) => crrtGlossaryEntry(id)!.notTheSameAs.join(' ')
    expect(notSame('prescribed-flow')).toMatch(/Actual flow/)
    expect(notSame('effluent')).toMatch(/patient’s fluid loss/)
    expect(notSame('net-machine-removal')).toMatch(/Whole-patient fluid balance/)
    expect(notSame('net-machine-removal')).toMatch(/Ultrafiltration \(UF\)/)
    expect(notSame('ultrafiltration')).toMatch(/Net ultrafiltration/)
    expect(notSame('urea-marker')).toMatch(/not a laboratory value/)
    expect(crrtGlossaryEntry('urea-marker')!.term).not.toMatch(/BUN/)
    expect(crrtGlossaryEntry('makeup')!.openQuestion).toMatch(/Unresolved/)
    expect(crrtGlossaryEntry('makeup')!.openQuestion).toMatch(
      /withholds cumulative machine removal/,
    )
    expect(crrtGlossaryEntry('net-machine-removal')!.alsoCalled.join(' ')).toMatch(
      /Patient Fluid Removal \(PFR\)/,
    )
  })

  it('is reachable from the hub, a Learn lesson and the Practice task panel', async () => {
    const hub = render(<BaxterCrrtHub />)
    await settle()
    expect(screen.getByRole('button', { name: 'Glossary' })).toBeInTheDocument()
    hub.unmount()
    const lesson = render(
      <CrrtFoundationLesson
        lessonId="crrt-circuit-pressures"
        onNavigate={() => {}}
        onRestart={() => {}}
      />,
    )
    const trigger = screen.getByRole('button', { name: 'Glossary' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'CRRT glossary' })
    expect(within(dialog).getByText('Pre-blood-pump (PBP) fluid')).toBeInTheDocument()
    expect(within(dialog).getByText(/no clinician has reviewed them yet/)).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await settle()
    expect(screen.queryByRole('dialog', { name: 'CRRT glossary' })).toBeNull()
    expect(trigger).toHaveFocus()
    lesson.unmount()
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-02" />)
    await settle()
    expect(screen.getAllByRole('button', { name: 'Glossary' }).length).toBeGreaterThan(0)
  })

  it('expands TMP, PBP and PFR where Learn first uses them, and glosses effluent', () => {
    // Each task renders its instruction first, then its teaching, question and choices.
    const firstUse = (pattern: RegExp) => {
      for (const lessonId of BAXTER_CRRT_LEARN_LESSON_IDS) {
        for (const task of crrtLearnTasks[lessonId] ?? []) {
          const texts = [
            task.instruction,
            ...task.teaching,
            task.question ?? '',
            ...(task.choices ?? []).flatMap((choice) => [choice.label, choice.feedback]),
          ]
          const hit = texts.find((text) => pattern.test(text))
          if (hit) return `${lessonId}/${task.id}: ${hit}`
        }
      }
      return null
    }
    expect(firstUse(/\bTMP\b/)).toMatch(
      /^crrt-circuit-pressures\/read-sites: .*TMP \(transmembrane pressure\)/,
    )
    expect(firstUse(/\bPBP\b/)).toMatch(
      /^crrt-circuit-pressures\/trace-fluids: .*Pre-blood-pump \(PBP\) fluid/,
    )
    expect(firstUse(/\bPFR\b/)).toMatch(
      /^crrt-prescription-dosing\/worked-dose: .*net ultrafiltration the machine takes from the patient; PrisMax sets it as patient fluid removal \(PFR\)/,
    )
    expect(firstUse(/effluent/i)).toMatch(
      /^crrt-indications-modality\/modality-preview: .*effluent path, which carries everything leaving the fluid side of the filter to collection/,
    )
    expect(firstUse(/net fluid removal|net CRRT removal/i)).toMatch(
      /^crrt-indications-modality\/orient: .*Net fluid removal addresses how much fluid CRRT removes from the patient/,
    )
  })

  it('keeps learner strings in US spelling (identifiers and the audit harness excepted)', () => {
    const uk =
      /(?<![A-Za-z0-9-])(modelled|modelling|haemo\w*|haemat\w*|litres?|millilitres?|millimetres?|behaviour|colour|practise|labelled|unlabelled|normalised|normalises|judgement|catalogue)(?![A-Za-z0-9-])/i
    const root = path.join(process.cwd(), 'src/features/baxter-crrt')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const target = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__' && entry.name !== 'testSupport') walk(target)
        } else if (/\.tsx?$/.test(entry.name) && entry.name !== 'numericAudit.ts')
          files.push(target)
      }
    }
    walk(root)
    expect(files.length).toBeGreaterThan(80)
    const findings: string[] = []
    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      )
      const visit = (node: ts.Node) => {
        const text =
          ts.isStringLiteralLike(node) ||
          ts.isJsxText(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)
            ? node.text
            : null
        if (text && uk.test(text))
          findings.push(`${path.relative(root, file)}: ${text.slice(0, 80)}`)
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(findings).toEqual([])
  })
})

describe('mass-concentration units are converted in one tested place (F-24)', () => {
  it('derives the factor from the units and converts both ways', () => {
    expect(DECILITERS_PER_LITER).toBe(10)
    expect(milligramsPerDeciliterToMilligramsPerLiter(2.9)).toBe(29)
    expect(milligramsPerLiterToMilligramsPerDeciliter(29.9)).toBeCloseTo(2.99, 12)
    for (const value of [0, 0.3, 1.05, 2.2, 3.6, 4.5, 5.2, 12.34, 250]) {
      expect(
        milligramsPerLiterToMilligramsPerDeciliter(
          milligramsPerDeciliterToMilligramsPerLiter(value),
        ),
      ).toBeCloseTo(value, 12)
      expect(
        milligramsPerDeciliterToMilligramsPerLiter(
          milligramsPerLiterToMilligramsPerDeciliter(value),
        ),
      ).toBeCloseTo(value, 12)
    }
    expect(() => milligramsPerDeciliterToMilligramsPerLiter(Number.NaN)).toThrow(RangeError)
    expect(learnerMassConcentrationFromMilligramsPerLiter(null)).toEqual({
      value: null,
      unit: 'mg/dL',
    })
  })

  it('leaves the engine pools in mg/L, bit-identical to the former × 10', () => {
    for (const definition of baxterCrrtCases) {
      const session = createCrrtLearningSession({
        caseDefinition: definition,
        experience: 'practice',
        roleLens: 'integrated',
        attempt: 1,
      })
      const patient = session.simulation.patient
      if (patient.status !== 'configured') continue
      const authored = definition.initialPatient.solutes
      expect(patient.solutes['creatinine-marker']?.concentrationUnit).toBe('mg/L')
      expect(patient.solutes['creatinine-marker']?.concentrationPerLiter).toBe(
        authored.creatinineMgPerDl * 10,
      )
      expect(patient.solutes.phosphate?.concentrationPerLiter).toBe(authored.phosphateMgPerDl * 10)
      expect(patient.solutes.magnesium?.concentrationPerLiter).toBe(authored.magnesiumMgPerDl * 10)
    }
  })

  it('presents supplied mass concentrations in mg/dL, consistent with the mg/L pools', () => {
    const session = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-15'),
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
    })
    const evidence = selectCrrtLabEvidence(session)
    const patient = session.simulation.patient
    if (patient.status !== 'configured') throw new Error('CRRT-15 must be configured')
    for (const id of ['creatinine-marker', 'phosphate', 'magnesium'] as const) {
      const row = evidence.suppliedBaseline.find((entry) => entry.id === id)!
      expect(row.unit).toBe('mg/dL')
      expect(row.value).toBeCloseTo(
        milligramsPerLiterToMilligramsPerDeciliter(patient.solutes[id]!.concentrationPerLiter),
        12,
      )
    }
    const urea = evidence.suppliedBaseline.find((entry) => entry.id === 'urea-marker')!
    expect(urea.unit).toBe('mmol/L')
    expect(urea.label).toMatch(/urea\) marker/)
    expect(urea.label).not.toMatch(/BUN/)
    // Dynamics stay unsupported after conversion: every pool is still listed as not modeled.
    expect(evidence.unmodeledResponses.map((entry) => entry.soluteId)).toEqual(
      expect.arrayContaining(['creatinine-marker', 'phosphate', 'magnesium', 'urea-marker']),
    )

    // Four simulated hours later the display is still the supplied case-start value in mg/dL,
    // and the pools are still listed as not modeled — conversion revealed no dynamic value.
    const later = selectCrrtLabEvidence(
      crrtLearningSessionReducer(session, { type: 'ADVANCE_TIME', seconds: 4 * 3600 }),
    )
    expect(later.suppliedBaseline).toEqual(evidence.suppliedBaseline)
    expect(later.unmodeledResponses.map((entry) => entry.soluteId)).toEqual(
      evidence.unmodeledResponses.map((entry) => entry.soluteId),
    )
  })

  it('shows mass concentrations in mg/dL, and no mg/L or BUN, in the debrief', async () => {
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-15" />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'End run and review debrief' }))
    await settle()
    const labs = screen.getByRole('region', { name: 'Laboratory values in this case' })
    expect(within(labs).getByText('Creatinine marker').nextElementSibling).toHaveTextContent(
      /^\d+\.\d mg\/dL$/,
    )
    expect(
      within(labs).getByText('Small-solute (urea) marker').nextElementSibling,
    ).toHaveTextContent(/mmol\/L$/)
    expect(document.body.textContent).not.toMatch(/mg\/L\b/)
    expect(document.body.textContent).not.toMatch(/\bBUN\b/)
  })
})

describe('titles and reset scope (F-25)', () => {
  it('titles Lesson 8 as a noun phrase everywhere, with IDs and order unchanged', () => {
    expect([...BAXTER_CRRT_LEARN_LESSON_IDS]).toEqual([
      'crrt-indications-modality',
      'crrt-circuit-pressures',
      'crrt-solute-transport',
      'crrt-prescription-dosing',
      'crrt-alarms-troubleshooting',
      'crrt-anticoagulation',
      'crrt-fluid-liberation',
      'crrt-pressure-profile-integration',
    ])
    for (const lesson of baxterCrrtLearnLessons) expect(lesson.title).not.toMatch(/\?$/)
    const title = 'Pressure-profile integration'
    expect(baxterCrrtLearnLessons.at(-1)?.title).toBe(title)
    expect(criticalCareLearningPathway('baxter-crrt').sections.at(-1)?.title).toBe(title)
    expect(
      criticalCareActivityById.get('crrt:learn:crrt-pressure-profile-integration')?.title,
    ).toBe(title)
  })

  it('says what Restart lesson clears, and no control still says Repeat lesson', () => {
    render(
      <CrrtFoundationLesson
        lessonId="crrt-indications-modality"
        onNavigate={() => {}}
        onRestart={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Restart lesson' })).toHaveAccessibleDescription(
      /goes back to task 1 and clears this visit's answers and simulated runs\. Visited topics stay saved/,
    )
    expect(screen.queryByRole('button', { name: 'Repeat lesson' })).toBeNull()
  })

  it('says what Reset case clears, and resetting never touches stored history', async () => {
    const legacy = {
      ...createDefaultProgress(),
      completedLessonIds: ['crrt-indications-modality'],
      completedPracticeCaseIds: ['crrt-13'],
      attempts: { 'crrt-13': 2 },
    }
    window.localStorage.setItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY, JSON.stringify(legacy))
    const withoutSelfPaced = () => {
      const { selfPaced, ...rest } = JSON.parse(
        window.localStorage.getItem(BAXTER_CRRT_PROGRESS_STORAGE_KEY)!,
      )
      return { rest: JSON.stringify(rest), visitedCaseIds: selfPaced?.visitedCaseIds }
    }
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-13" />)
    await settle()
    const reset = screen.getByRole('button', { name: /Reset case/ })
    expect(reset).toHaveAccessibleDescription(
      /Starts a new run of this case: clears this run's actions, simulated time/,
    )
    const card = screen
      .getAllByRole('article')
      .find((article) => /Assess the patient and treatment/.test(article.textContent ?? ''))!
    fireEvent.click(within(card).getByRole('button'))
    fireEvent.click(reset)
    await settle()
    // The run restarted; the historical arrays are byte-identical and the visit is still recorded.
    expect(withoutSelfPaced()).toEqual({
      rest: JSON.stringify(legacy),
      visitedCaseIds: ['CRRT-13'],
    })
  })
})

describe('Learn reuses Practice cases, and says so (X-04)', () => {
  it('derives which lesson tasks walk through which Practice case', () => {
    const summary = crrtLearnPracticeCaseReuse.map(
      (use) => `${use.caseId}@L${use.lessonNumber}:${use.taskNumbers.join(',')}`,
    )
    expect(summary).toEqual([
      'CRRT-04@L5:2,3,4',
      'CRRT-13@L5:5,6,7,8,9',
      'CRRT-04@L7:1,2,3,4',
      'CRRT-10@L7:5,6',
      'CRRT-14@L8:1,2,3,4,5,6,7,8,9',
    ])
    expect(crrtCaseReuseNote('CRRT-04')).toMatch(
      /^Revisit from Learn: Lesson 5 \(tasks 2–4\) and Lesson 7 \(tasks 1–4\) walked through a guided version of this case\./,
    )
    expect(crrtCaseReuseNote('CRRT-01')).toBeNull()
  })

  it('labels a reused case in Practice and leaves other cases unlabeled', async () => {
    const reused = render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-13" />)
    await settle()
    expect(document.querySelector('[data-crrt-case-reuse]')).toHaveTextContent(
      'Lesson 5 (tasks 5–9) walked through a guided version of this case. Here you practice it on your own',
    )
    reused.unmount()
    render(<BaxterCrrtPractice locale="en" initialCaseId="CRRT-01" />)
    await settle()
    expect(document.querySelector('[data-crrt-case-reuse]')).toBeNull()
  })
})
