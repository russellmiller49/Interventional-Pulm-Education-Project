import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  LESSONS,
  BASE_PATH,
  VERSION,
  ORIENTATION_CONTRACT,
  SOURCE,
  lessonAfter,
} from '../../src/features/bronchial-branch-tracing/content/lessons'
import {
  ANNOTATION_VERSION,
  localExercise,
} from '../../src/features/bronchial-branch-tracing/content/local-exercises'
import { parentViewTask } from '../../src/features/bronchial-branch-tracing/content/local-teaching'
import { LOCAL_DRAFT_ALIASES } from '../../src/features/bronchial-branch-tracing/engine/local-draft-migration'
import {
  traceById,
  targetForTrace,
} from '../../src/features/bronchial-branch-tracing/geometry/native-ct'
import native from '../../public/branch-tracing/native-v1/manifest.json'

// Generated review evidence, never a second runtime lesson registry or a clinical answer key.
const manifest = {
  version: 'flow-coverage-v1',
  baseline: '2b10cb6a',
  registry: 'src/features/bronchial-branch-tracing/content/lessons.ts',
  sourceCaseCount: 1,
  sources: {
    method: SOURCE,
    nativeManifest: 'public/branch-tracing/native-v1/manifest.json',
    sourceSha256: native.sourceSha256,
    graphSha256: native.sourceGraphSha256,
    ijkToLps: native.ijkToLps,
    windowHu: native.windowHu,
  },
  contracts: {
    participationVersion: VERSION,
    newOrientationContract: ORIENTATION_CONTRACT,
    annotationVersion: ANNOTATION_VERSION,
    freshDisplay: 'standard axial; regional transforms are explicitly learner initiated',
    compatibleResume:
      'restore native marks, choices, slice, crop/magnification, display and separate attempts; disclose restored display',
    recovery:
      'retain incompatible/corrupted envelope under the existing draft key plus .recovery.<signature> before a replacement write',
    history:
      'first responses preserved; retries after comparison remain supported; earlier unspecified support remains legacy-unknown',
    clinicalScoring: false,
  },
  gaps: [
    {
      id: 'G1',
      requirement:
        'Faculty inspection of visible lumen/wall correspondence on every selected interval and response plane.',
      status: 'pending; provisional model locators only',
    },
    {
      id: 'G2',
      requirement: 'Faculty review of parent-view projection and opening relationships.',
      status: 'pending; diagrams use declared source camera basis, not measured ostial shapes',
    },
    {
      id: 'G3',
      requirement: 'Additional reviewed anatomical variant examples.',
      status: 'not supplied; variants-limits teaches uncertainty on existing routes',
    },
    {
      id: 'G4',
      requirement: 'Unfamiliar-patient evaluation.',
      status: 'not performed; all regional examples and simulated targets share one CT',
    },
    {
      id: 'G5',
      requirement: 'First-time learner walkthrough and educational-outcome study.',
      status: 'not performed; automated behavior checks are separate',
    },
  ],
  lessons: LESSONS.map((lesson, index) => ({
    id: lesson.id,
    position: index + 1,
    title: lesson.title,
    route: `/en${BASE_PATH}/learn?lesson=${lesson.id}`,
    nextLesson: lessonAfter(lesson.id)?.id ?? null,
    implementationStatus: 'implemented',
    objective: lesson.objective,
    prerequisite: lesson.prerequisite,
    sourcePages: lesson.sourcePages,
    preservedContent: ['concept', 'teaching', 'worked', 'interpretation', 'sourcePages'],
    composition:
      lesson.id === 'orientation'
        ? 'full-field CT context, fixed standard/comparison copies, same-lumen application'
        : lesson.id === 'orientation-changes'
          ? 'CT with persistent connected local map and source approach prelude'
          : lesson.exercises
            ? 'CT with adjacent task, source captions and optional declared parent view'
            : 'CT, current route decision, connected map and separate debrief',
    completion:
      lesson.id === 'orientation'
        ? 'new observer/display comprehension plus same-lumen response and manual comparison completion'
        : lesson.exercises
          ? 'all local responses, comparisons and required guided/independent parent applications; explicit Finish/Next lesson'
          : 'all modeled forks and distal approach on two routes; loaded target inspected, course and distal interpretation recorded; comparisons and Finish',
    draftImpact:
      lesson.id === 'orientation'
        ? {
            kind: 'new instructional contract; old completion retained as historical participation; old draft archived',
          }
        : {
            kind: 'compatible geometry and existing participation',
            acceptedBaselineSignatures: LOCAL_DRAFT_ALIASES[lesson.id] ?? [],
            additions: lesson.exercises
              ? 'attempt support; integration course required for new responses'
              : 'target inspection and immutable junction snapshots; earlier drafts default missing metadata conservatively',
          },
    gaps: ['G1', 'G2', 'G4', 'G5', ...(lesson.id === 'variants-limits' ? ['G3'] : [])],
    localExamples:
      lesson.exercises?.map((spec, exampleIndex) => {
        const exercise = localExercise(spec)
        const point = exercise.trace.checkpoints[0]
        return {
          id: exercise.id,
          task: spec.kind,
          sourceTrace: spec.traceId,
          sourceCheckpoint: spec.checkpointId,
          source: exercise.teaching,
          parent: exercise.trace.anchor,
          daughters:
            spec.kind === 'same-lumen' || spec.kind === 'viewpoint' ? [] : point.decision?.options,
          nativeInterval: exercise.trace.range,
          orderedDemonstrationFrames: exercise.frames,
          responses: exercise.answerPoints,
          instructions: exercise.task,
          comparison: exercise.explanation,
          review: exercise.review,
          display: {
            fresh: 'standard',
            optionalConvention: exercise.trace.preset,
            cameraFrame: exercise.teaching.referenceFrame,
          },
          parentApplication: parentViewTask(spec, exampleIndex),
          assistance:
            exampleIndex === 0 ||
            lesson.exercises
              ?.slice(0, exampleIndex)
              .some((e) => e.checkpointId === spec.checkpointId)
              ? 'guided, demonstrated or same-division application'
              : 'less-supported application within the same source CT; requested help and retries retained',
          scope:
            spec.kind === 'integration'
              ? {
                  mappedDivisions: lesson.exercises?.map((e) => e.checkpointId),
                  startingParent: 'LB6',
                  approachContext:
                    'LLL descends to the LB6 origin; LB6 returns cranially. Proximal division 6 is demonstrated, not credited in the segmental map.',
                  omittedForksWithinDeclaredInterval: 0,
                }
              : 'local interval only; no full route credited',
        }
      }) ?? [],
    fullRoutes: lesson.exercises
      ? []
      : [lesson.example, lesson.prediction, lesson.transfer].map((id, i) => {
          const trace = traceById(id)
          return {
            id,
            role: [
              'worked example',
              'first interpretation',
              'second interpretation in the same CT',
            ][i],
            sourceEdges: trace.sourceEdgeIds,
            nativeInterval: trace.range,
            suppliedParent: trace.anchor,
            target: targetForTrace(trace).segment,
            checkpoints: trace.checkpoints,
            reviewStatus: 'provisional model reference; nodule is authored simulation',
            scope: 'all intervening source forks from trachea, then separate distal approach',
          }
        }),
  })),
}
const path = resolve('docs/bronchial-branch-tracing/flow-coverage.json')
if (process.argv.includes('--check')) {
  if (JSON.stringify(JSON.parse(readFileSync(path, 'utf8'))) !== JSON.stringify(manifest))
    throw new Error(
      'Coverage is stale: run npx --no-install tsx scripts/branch-tracing/flow-coverage.ts',
    )
  console.log(`Coverage matches all ${LESSONS.length} registry lessons.`)
} else {
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Wrote ${path}`)
}
