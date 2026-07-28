import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import {
  commonErrorSources,
  hemodynamicCases,
  hemodynamicTeachingArtifacts,
  hemodynamicsSources,
  troubleshootingEntries,
  troubleshootingReferenceRows,
} from '@/features/icu-hemodynamics/content'
import { feedbackForHemodynamicAction } from '@/features/icu-hemodynamics/content/hemodynamicTeaching'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity'

import { criticalCareActivities } from '../content/activities'
import { criticalCareConcepts } from '../content/concepts'

const criticalCareComponentRoots = [
  'critical-care',
  'icu-hemodynamics',
  'mechanical-ventilation',
  'mechanical-circulatory-support',
  'cardiohelp-ecmo',
  'baxter-crrt',
  'icu-simulation',
].map((feature) => path.join(process.cwd(), 'src', 'features', feature, 'components'))

const forbiddenStaticUiTerms = [
  'engine',
  'reducer',
  'seed',
  'localstorage',
  'score',
  'scored',
  'grade',
  'graded',
  'mastery',
  'mastered',
  'exam',
  'quiz',
  'assessment',
  'competency',
  'competent',
  'certification',
  'certified',
] as const

interface StaticUiCopy {
  readonly file: string
  readonly line: number
  readonly copy: string
}

function componentFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return componentFiles(target)
    return entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.')
      ? [target]
      : []
  })
}

function staticUiCopy(file: string): readonly StaticUiCopy[] {
  const sourceText = readFileSync(file, 'utf8')
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const copy: StaticUiCopy[] = []

  function add(node: ts.Node, value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (!normalized) return
    copy.push({
      file: path.relative(process.cwd(), file),
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      copy: normalized,
    })
  }

  function collectExpression(node: ts.Expression) {
    if (ts.isParenthesizedExpression(node)) {
      collectExpression(node.expression)
      return
    }
    if (ts.isStringLiteralLike(node)) {
      add(node, node.text)
      return
    }
    if (ts.isTemplateExpression(node)) {
      add(node, [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' '))
      return
    }
    if (ts.isConditionalExpression(node)) {
      collectExpression(node.whenTrue)
      collectExpression(node.whenFalse)
      return
    }
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) collectExpression(node.left)
      collectExpression(node.right)
      return
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        if (ts.isExpression(element)) collectExpression(element)
      }
    }
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) add(node, node.text)
    if (
      ts.isJsxAttribute(node) &&
      ['aria-label', 'alt', 'placeholder', 'title'].includes(node.name.getText(source))
    ) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) add(node, node.initializer.text)
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        collectExpression(node.initializer.expression)
      }
    }
    if (ts.isJsxExpression(node) && node.expression) collectExpression(node.expression)
    ts.forEachChild(node, visit)
  }

  visit(source)
  return copy
}

function expectLearnerCopyClear(label: string, copy: string) {
  expect({
    label,
    flaggedTerms: flaggedLearnerCopyTerms(copy),
  }).toEqual({
    label,
    flaggedTerms: [],
  })
}

describe('critical-care learner-copy framing', () => {
  it('keeps static component copy free of grading and software-internal labels', () => {
    const findings = criticalCareComponentRoots
      .flatMap(componentFiles)
      .flatMap(staticUiCopy)
      .flatMap((item) => {
        const terms = forbiddenStaticUiTerms.filter((term) =>
          new RegExp(`(^|[^A-Za-z0-9])${term}(?=$|[^A-Za-z0-9])`, 'i').test(item.copy),
        )
        return terms.length > 0 ? [{ ...item, terms }] : []
      })

    expect(findings).toEqual([])
  })

  it('keeps aggregate lesson, case, and step tallies out of learner progress copy', () => {
    const findings = criticalCareComponentRoots
      .flatMap(componentFiles)
      .flatMap(staticUiCopy)
      .filter((item) => /\b(?:lessons|cases|steps)\s+complete\b/i.test(item.copy))

    expect(findings).toEqual([])
  })

  it('keeps public activity and concept copy free of grading and software language', () => {
    for (const activity of criticalCareActivities) {
      expectLearnerCopyClear(activity.id, `${activity.title} ${activity.description}`)
    }
    for (const concept of criticalCareConcepts) {
      expectLearnerCopyClear(concept.id, `${concept.title} ${concept.shortExplanation}`)
    }
  })

  it('keeps the hemodynamics pilot feedback and expert traces teaching-centered', () => {
    for (const definition of hemodynamicCases) {
      expectLearnerCopyClear(
        `${definition.id}:case-copy`,
        [
          definition.title,
          definition.shortTitle,
          definition.presentation,
          ...definition.learningObjectives,
          definition.guidedPrompt,
          ...definition.debrief,
        ].join(' '),
      )
      for (const intervention of definition.interventions) {
        const feedback = feedbackForHemodynamicAction(
          definition,
          intervention,
          definition.safetyCriticalErrorIds.includes(intervention.id),
        )
        expect(feedback.whatHappened).toBeTruthy()
        expect(feedback.whyItHappened).toBeTruthy()
        expect(feedback.theCue).toBeTruthy()
        expect(feedback.conceptIds.length).toBeGreaterThan(0)
        expect(feedback.evidenceIds.length).toBeGreaterThan(0)
        expect(feedback.likelyFrame).toBeTruthy()
        expectLearnerCopyClear(
          `${definition.id}:${intervention.id}`,
          [
            intervention.label,
            intervention.shortLabel,
            intervention.description,
            intervention.response,
            feedback.whatHappened,
            feedback.whyItHappened,
            feedback.likelyFrame ?? '',
            feedback.theCue,
          ].join(' '),
        )
      }
    }

    for (const artifact of hemodynamicTeachingArtifacts) {
      expect(artifact.expertTrace).toHaveLength(3)
      expectLearnerCopyClear(
        `${artifact.caseId}:expert-trace`,
        artifact.expertTrace
          .flatMap((step) => [step.moment, step.cue, step.reasoning, step.commitment])
          .join(' '),
      )
    }

    for (const entry of troubleshootingEntries) {
      expectLearnerCopyClear(
        `${entry.id}:troubleshooting`,
        [
          entry.label,
          entry.shortLabel,
          ...entry.appearance,
          ...entry.causes,
          entry.numbersTeaching,
          entry.whyItMatters,
          ...entry.actions,
          ...entry.doNot,
        ].join(' '),
      )
    }
    for (const row of troubleshootingReferenceRows) {
      expectLearnerCopyClear(
        `${row.id}:reference-row`,
        [row.problem, row.waveform, row.causes, row.checks, row.action, row.warning].join(' '),
      )
    }
    expectLearnerCopyClear('hemodynamics:common-error-sources', commonErrorSources.join(' '))

    for (const source of hemodynamicsSources) {
      expectLearnerCopyClear(
        `${source.id}:source-scope`,
        [source.intendedUse, source.limitation ?? ''].join(' '),
      )
    }
  })
})
