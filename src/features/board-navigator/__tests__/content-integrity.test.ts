import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { boardReviewChapters } from '@/data/board-review'
import { publicEbusTrainingModules } from '@/data/ebus-training'
import { teachingNumberErrors } from '@/features/learning-module/numbers/teachingNumbers'

import { BLUEPRINT_TOPICS, blueprintTopic } from '../content/blueprint'
import { OBJECTIVES, objectiveById, tasksOf } from '../content/objectives'
import { NAVIGATOR_SOURCE_IDS } from '../content/sources'
import { BOARD_NAVIGATOR_NUMBERS } from '../content/teachingNumbers'
import type { Task } from '../content/types'

/**
 * The content contract. Every objective has a lab whose verification task is a different kind from
 * its diagnostic task; every misconception an option names exists; every resource points at a route
 * that exists; every citation names a registered source; every number is traceable.
 */
const GRADING_TERMS = [
  'score',
  'scored',
  'points',
  'grade',
  'graded',
  'mastery',
  'mastered',
  'quiz',
  'certification',
  'certified',
  'competent',
] as const

function learnerCopy(task: Task): string[] {
  const copy: string[] = [task.stem, task.hint, task.teachingPoint]
  switch (task.kind) {
    case 'choice':
    case 'predict':
      for (const option of task.options) copy.push(option.label, option.rationale)
      if (task.kind === 'predict') copy.push(task.baseline, task.change)
      break
    case 'sequence':
      copy.push(task.rationale, ...task.steps.map((step) => step.label))
      break
    case 'sort':
      copy.push(...task.buckets.map((bucket) => bucket.label))
      for (const item of task.items) copy.push(item.label, item.rationale)
      break
    case 'hotspot':
      copy.push(task.rationale)
      break
  }
  return copy
}

describe('the objective catalogue', () => {
  it('has unique ids and at least the pilot size the vision asks for', () => {
    const ids = OBJECTIVES.map((objective) => objective.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(20)
  })

  it('covers the four pilot areas', () => {
    const topics = new Set(OBJECTIVES.map((objective) => objective.topicId))
    for (const topic of [
      'thoracic-oncology-staging',
      'ebus',
      'pleural-disease',
      'malignant-airway-obstruction',
      'airway-stenting',
      'airway-ablation-dilation',
    ] as const) {
      expect(topics.has(topic)).toBe(true)
    }
  })

  it('maps every objective to a blueprint topic and marks those topics as pilot', () => {
    for (const objective of OBJECTIVES) {
      expect(blueprintTopic(objective.topicId).pilot).toBe(true)
      for (const secondary of objective.secondaryTopicIds ?? [])
        expect(() => blueprintTopic(secondary)).not.toThrow()
    }
    for (const topic of BLUEPRINT_TOPICS.filter((entry) => entry.pilot)) {
      expect(OBJECTIVES.some((objective) => objective.topicId === topic.id)).toBe(true)
    }
  })

  it('names only existing objectives as prerequisites, with no cycles', () => {
    for (const objective of OBJECTIVES) {
      for (const id of objective.prerequisites) expect(() => objectiveById(id)).not.toThrow()
    }
    const visit = (id: string, seen: string[]): void => {
      expect(seen).not.toContain(id)
      for (const next of objectiveById(id).prerequisites) visit(next, [...seen, id])
    }
    for (const objective of OBJECTIVES) visit(objective.id, [])
  })

  it('verifies with a different task kind from the diagnosis, and every task has an answer', () => {
    for (const objective of OBJECTIVES) {
      const { diagnose, verify } = objective.lab
      expect(verify.kind).not.toBe(diagnose.kind)
      for (const task of tasksOf(objective)) {
        expect(task.id.startsWith(`${objective.id}.`)).toBe(true)
        switch (task.kind) {
          case 'choice':
          case 'predict':
            expect(task.options.some((option) => option.id === task.answerId)).toBe(true)
            expect(new Set(task.options.map((option) => option.id)).size).toBe(task.options.length)
            expect(task.options.length).toBeGreaterThanOrEqual(3)
            break
          case 'sequence':
            expect([...task.order].sort()).toEqual(task.steps.map((step) => step.id).sort())
            expect(task.order).not.toEqual(task.steps.map((step) => step.id))
            break
          case 'sort':
            for (const item of task.items)
              expect(task.buckets.some((bucket) => bucket.id === item.bucketId)).toBe(true)
            for (const bucket of task.buckets)
              expect(task.items.some((item) => item.bucketId === bucket.id)).toBe(true)
            break
          case 'hotspot':
            expect(task.answerRegionId.length).toBeGreaterThan(0)
            break
        }
      }
    }
  })

  it('documents at least two misconceptions per objective and references only those', () => {
    for (const objective of OBJECTIVES) {
      expect(objective.misconceptions.length).toBeGreaterThanOrEqual(2)
      const known = new Set(objective.misconceptions.map((entry) => entry.id))
      for (const entry of objective.misconceptions)
        expect(entry.id.startsWith(`${objective.id}.`)).toBe(true)
      const referenced = new Set<string>()
      for (const task of tasksOf(objective)) {
        switch (task.kind) {
          case 'choice':
          case 'predict':
            for (const option of task.options)
              if (option.misconceptionId) referenced.add(option.misconceptionId)
            break
          case 'sequence':
            for (const id of Object.values(task.earlyMisconceptions ?? {})) referenced.add(id)
            break
          case 'sort':
            for (const item of task.items)
              if (item.misconceptionId) referenced.add(item.misconceptionId)
            break
          case 'hotspot':
            for (const id of Object.values(task.regionMisconceptions ?? {})) referenced.add(id)
            break
        }
      }
      for (const id of referenced) expect(known.has(id)).toBe(true)
      // The diagnostic task must be able to name at least one documented wrong model.
      expect(referenced.size).toBeGreaterThan(0)
    }
  })

  it('cites only registered sources', () => {
    for (const objective of OBJECTIVES) {
      expect(objective.sourceIds.length).toBeGreaterThan(0)
      for (const id of objective.sourceIds) expect(NAVIGATOR_SOURCE_IDS.has(id)).toBe(true)
      for (const task of tasksOf(objective)) {
        expect(task.sourceIds.length).toBeGreaterThan(0)
        for (const id of task.sourceIds) expect(NAVIGATOR_SOURCE_IDS.has(id)).toBe(true)
      }
    }
  })

  it('keeps grading vocabulary out of learner copy', () => {
    const pattern = new RegExp(`\\b(${GRADING_TERMS.join('|')})\\b`, 'i')
    for (const objective of OBJECTIVES) {
      const copy = [
        objective.title,
        objective.competency,
        ...objective.whatToKnow,
        objective.lab.repair.principle,
        ...objective.lab.repair.explanation,
        objective.lab.repair.distinction,
        ...objective.misconceptions.flatMap((entry) => [entry.label, entry.repair]),
        ...tasksOf(objective).flatMap(learnerCopy),
      ]
      for (const line of copy) expect(line).not.toMatch(pattern)
    }
  })

  it('never leaks a correctness word into authored item text', () => {
    const pattern = /\b(correct|incorrect|wrong answer)\b/i
    for (const objective of OBJECTIVES) {
      for (const task of tasksOf(objective)) {
        expect(task.stem).not.toMatch(pattern)
        expect(task.hint).not.toMatch(pattern)
        if (task.kind === 'choice' || task.kind === 'predict') {
          for (const option of task.options) expect(option.label).not.toMatch(pattern)
        }
      }
    }
  })

  it('deep-links only to routes that exist', () => {
    const appDir = join(process.cwd(), 'src', 'app', '[locale]')
    const chapterSlugs = new Set(boardReviewChapters.map((chapter) => chapter.slug))
    const ebusSlugs = new Set(publicEbusTrainingModules.map((module) => module.slug))
    for (const objective of OBJECTIVES) {
      for (const resource of objective.resources) {
        if (resource.kind === 'external') continue
        const [, first, second] = resource.href.split('/')
        if (first === 'board-prep' && second) {
          expect(chapterSlugs.has(second)).toBe(true)
          continue
        }
        if (first === 'ebus-training' && second) {
          expect(ebusSlugs.has(second)).toBe(true)
          continue
        }
        const page = join(appDir, ...resource.href.split('/').filter(Boolean), 'page.tsx')
        expect(existsSync(page)).toBe(true)
      }
    }
  })

  it('keeps project metadata out of the learner-facing fields', () => {
    for (const objective of OBJECTIVES) {
      expect(objective.provenance.contentVersion.length).toBeGreaterThan(0)
      const copy = [objective.title, objective.competency, ...objective.whatToKnow].join(' ')
      expect(copy).not.toMatch(/NOT REVIEWED|draft|synthetic|authored/i)
    }
  })
})

describe('the numbers register', () => {
  it('traces every number to a registered source or declares a convention', () => {
    expect(teachingNumberErrors(BOARD_NAVIGATOR_NUMBERS, NAVIGATOR_SOURCE_IDS)).toEqual([])
  })
})
