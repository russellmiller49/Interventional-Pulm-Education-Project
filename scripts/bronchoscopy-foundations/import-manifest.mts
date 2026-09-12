/**
 * Import the Bronchoscopy Foundations v2 implementation manifest into typed, generated TS.
 *
 *   npx tsx scripts/bronchoscopy-foundations/import-manifest.mts [manifest.json] [--check]
 *
 * The manifest lives outside this public repository (the owner's local-data folder). By default
 * the script reads `$BRONCH_FOUNDATIONS_MANIFEST`, then
 * `$HOME/Projects/Interventional-Pulm-Local-Data/Intro_courses/bronchoscopy_foundations_v2/…`.
 * `--check` regenerates in memory and exits non-zero when a committed file differs, so a manifest
 * revision cannot drift silently from the ids the course uses. Only the fields the course needs are
 * copied: no transcript file names, hashes or line counts, and no source text beyond what the
 * manifest itself states.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import * as prettier from 'prettier'

const OUT_DIR = path.resolve('src/features/bronchoscopy-foundations/data/generated')
const DEFAULT_MANIFEST = path.join(
  homedir(),
  'Projects/Interventional-Pulm-Local-Data/Intro_courses/bronchoscopy_foundations_v2/Bronchoscopy_Foundations_Implementation_Manifest_v2.json',
)

const args = process.argv.slice(2)
const check = args.includes('--check')
const manifestPath =
  args.find((arg) => !arg.startsWith('--')) ??
  process.env.BRONCH_FOUNDATIONS_MANIFEST ??
  DEFAULT_MANIFEST
if (!existsSync(manifestPath)) {
  console.error(
    `Manifest not found at ${manifestPath}. Pass its path or set BRONCH_FOUNDATIONS_MANIFEST.`,
  )
  process.exit(2)
}
const raw = readFileSync(manifestPath)
const sha256 = createHash('sha256').update(raw).digest('hex')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m: any = JSON.parse(raw.toString('utf8'))

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const strs = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
const nums = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'number') : []
const track = (value: unknown) => (value === 'extension' ? 'extension' : 'core')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modules = m.modules.map((mod: any) => ({
  id: mod.id,
  title: mod.title,
  track: track(mod.track),
  optional: mod.optional === true,
  knowledgeSections: nums(mod.knowledge_sections),
  prerequisites: strs(mod.recommended_prerequisites),
  sourceIds: strs(mod.source_ids),
  primaryPractice: str(mod.primary_practice),
  completionClaim: str(mod.completion_claim),
  drillIds: strs(mod.practice_drill_ids),
  caseIds: strs(mod.case_ids),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  objectiveIds: mod.objectives.map((o: any) => o.id),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const objectives = m.modules.flatMap((mod: any) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mod.objectives.map((o: any) => ({
    id: o.id,
    moduleId: mod.id,
    track: track(mod.track),
    text: o.text,
    assessmentEvidence: o.assessment_evidence,
    teachingSectionIds: nums(o.teaching_section_ids),
    drillIds: strs(o.practice_drill_ids),
    caseIds: strs(o.case_ids),
    questionIds: strs(o.question_ids),
    sourceIds: strs(o.source_ids),
    introducedIn: str(o.introduced_in),
  })),
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const drills = m.practice_drills.map((d: any) => ({
  id: d.id,
  title: d.title,
  moduleIds: strs(d.module_ids),
  specification: d.specification,
  setting: d.setting,
  evidenceBoundary: d.evidence_boundary,
  assessmentStatus: d.assessment_status,
  sourceIds: strs(d.source_ids),
  track: track(d.track),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cases = m.cases.map((c: any) => ({
  id: c.id,
  title: c.title,
  moduleIds: strs(c.module_ids),
  stem: c.stem,
  fourBox: {
    initialEvaluation: c.four_box_resolution.initial_evaluation,
    proceduralStrategy: c.four_box_resolution.procedural_strategy,
    techniquesAndResults: c.four_box_resolution.techniques_and_results,
    subsequentManagement: c.four_box_resolution.subsequent_management,
  },
  criticalError: c.critical_error,
  debriefQuestion: c.debrief_question,
  sourceIds: strs(c.source_ids),
  authorship: c.authorship,
  track: track(c.track),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const questionSeeds = m.knowledge_check_seeds.map((q: any) => ({
  id: q.id,
  objectiveId: q.objective_id,
  stem: q.stem,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: q.options.map((o: any) => ({ id: o.id, text: o.text, rationale: o.rationale })),
  correctOptionId: q.correct_option_id,
  sourceIds: strs(q.source_ids),
  track: track(q.track),
}))

const anatomy = {
  profileId: m.airway_anatomy.profile_id,
  geometryStatus: m.airway_anatomy.geometry_status,
  notes: strs(m.airway_anatomy.notes),
  sourceIds: strs(m.airway_anatomy.source_ids),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: m.airway_anatomy.nodes.map((n: any) => ({
    id: n.id,
    label: n.label,
    parentId: n.parent_id ?? null,
    type: n.type,
    side: n.side ?? null,
    aliases: strs(n.aliases),
  })),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localPolicies = m.local_policy_inputs.map((p: any) => ({
  id: p.id,
  description: p.description,
  status: p.status,
  missingBehavior: p.missing_behavior,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sources = m.sources.map((s: any) => ({
  id: s.id,
  kind: s.type,
  title: s.title,
  authors: str(s.authors),
  organization: str(s.organization),
  year: typeof s.year === 'number' ? s.year : null,
  doi: str(s.doi),
  url: str(s.url) ?? str(s.pdf_url) ?? (Array.isArray(s.urls) ? (str(s.urls[0]) ?? null) : null),
  reviewedScope: str(s.reviewed_scope),
  accessedDate: str(s.accessed_date),
  transcript:
    typeof s.collection === 'string'
      ? {
          collection: s.collection,
          duration: s.duration,
          durationSeconds: s.duration_seconds,
          moduleIds: strs(s.module_ids),
          adoptedContribution: s.adopted_contribution,
          audioVideoReviewed: s.audio_video_reviewed === true,
          slidesAvailable: s.slides_available === true,
          speakerIdentityVerified: s.speaker_identity_verified === true,
          publicationPermission: s.publication_permission,
        }
      : null,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const acceptanceTests = m.acceptance_tests.map((t: any) => ({
  id: t.id,
  title: t.title,
  requirement: t.requirement,
  scope: t.scope,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proposedMedia = m.proposed_media.map((v: any) => ({
  id: v.id,
  sourceId: v.source_id,
  approximateStart: v.approximate_start,
  approximateEnd: v.approximate_end,
  teachingUse: v.teaching_use,
  moduleIds: strs(v.module_ids),
  requiredAction: v.required_action,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reviewRegister = m.source_review_register.items.map((r: any) => ({
  id: r.id,
  sourceIds: strs(r.source_ids),
  sourceLocations: r.source_locations,
  topic: r.topic,
  sourceStatement: r.source_statement_or_problem,
  disposition: r.authoring_disposition,
  adoptedTreatment: r.adopted_course_treatment,
  verificationSourceIds: strs(r.verification_source_ids),
  priority: r.priority === 'high' ? 'high' : 'medium',
}))

const policy = m.assessment_policy
const assessmentPolicy = {
  rubricStatus: policy.rubric_status,
  ratingAnchors: policy.rating_anchors,
  nonNumericStates: strs(policy.non_numeric_states),
  criticalErrorsNoncompensatory: policy.critical_errors_noncompensatory === true,
  facultyDecisionRequiredForClinicalReadiness:
    policy.faculty_decision_required_for_clinical_readiness === true,
  appTelemetryCannotProve: strs(policy.app_telemetry_cannot_prove),
  domains: strs(policy.domains),
  allowedEvidenceTypes: strs(m.assessment_record_template?.allowed_evidence_types),
}

const control = m.control_model_requirements
const controlModel = {
  distinctControls: strs(control.distinct_controls),
  discloseAutomation: strs(control.disclose_automation),
  allowedSimplification: control.allowed_simplification,
  unsupportedInferences: strs(control.unsupported_inferences),
}

const meta = {
  documentVersion: m.document_version,
  preparedDate: m.prepared_date,
  manifestSha256: sha256,
  knowledgeDocumentSha256: m.knowledge_document.sha256,
  scope: m.scope,
  navigationPolicy: m.navigation_policy,
  credentialingPolicy: m.credentialing_policy,
  clinicalReviewStatus: m.clinical_review_status,
  counts: m.counts,
  excludedOperationalContent: strs(m.excluded_operational_content),
  provenanceRules: strs(m.provenance_rules),
}

const files: { name: string; type: string; exportName: string; value: unknown; array: boolean }[] =
  [
    { name: 'meta', type: 'ManifestMeta', exportName: 'MANIFEST_META', value: meta, array: false },
    {
      name: 'modules',
      type: 'ManifestModule',
      exportName: 'MANIFEST_MODULES',
      value: modules,
      array: true,
    },
    {
      name: 'objectives',
      type: 'ManifestObjective',
      exportName: 'MANIFEST_OBJECTIVES',
      value: objectives,
      array: true,
    },
    {
      name: 'drills',
      type: 'ManifestDrill',
      exportName: 'MANIFEST_DRILLS',
      value: drills,
      array: true,
    },
    {
      name: 'cases',
      type: 'ManifestCase',
      exportName: 'MANIFEST_CASES',
      value: cases,
      array: true,
    },
    {
      name: 'questionSeeds',
      type: 'ManifestQuestionSeed',
      exportName: 'MANIFEST_QUESTION_SEEDS',
      value: questionSeeds,
      array: true,
    },
    {
      name: 'anatomy',
      type: 'ManifestAnatomyProfile',
      exportName: 'MANIFEST_ANATOMY',
      value: anatomy,
      array: false,
    },
    {
      name: 'localPolicies',
      type: 'ManifestLocalPolicy',
      exportName: 'MANIFEST_LOCAL_POLICIES',
      value: localPolicies,
      array: true,
    },
    {
      name: 'sources',
      type: 'ManifestSource',
      exportName: 'MANIFEST_SOURCES',
      value: sources,
      array: true,
    },
    {
      name: 'acceptanceTests',
      type: 'ManifestAcceptanceTest',
      exportName: 'MANIFEST_ACCEPTANCE_TESTS',
      value: acceptanceTests,
      array: true,
    },
    {
      name: 'proposedMedia',
      type: 'ManifestProposedMedia',
      exportName: 'MANIFEST_PROPOSED_MEDIA',
      value: proposedMedia,
      array: true,
    },
    {
      name: 'reviewRegister',
      type: 'ManifestReviewItem',
      exportName: 'MANIFEST_REVIEW_REGISTER',
      value: reviewRegister,
      array: true,
    },
    {
      name: 'assessmentPolicy',
      type: 'ManifestAssessmentPolicy',
      exportName: 'MANIFEST_ASSESSMENT_POLICY',
      value: assessmentPolicy,
      array: false,
    },
    {
      name: 'controlModel',
      type: 'ManifestControlModel',
      exportName: 'MANIFEST_CONTROL_MODEL',
      value: controlModel,
      array: false,
    },
  ]

let drift = 0
for (const file of files) {
  const target = path.join(OUT_DIR, `${file.name}.generated.ts`)
  const source = [
    `// Generated by scripts/bronchoscopy-foundations/import-manifest.mts from the v${meta.documentVersion} implementation manifest`,
    `// (sha256 ${sha256}). Do not edit by hand; edit the manifest and re-run the script.`,
    `import type { ${file.type} } from '../manifestTypes'`,
    '',
    `export const ${file.exportName}: ${file.array ? `readonly ${file.type}[]` : file.type} = ${JSON.stringify(file.value, null, 2)}`,
    '',
  ].join('\n')
  const config = (await prettier.resolveConfig(target)) ?? {}
  const formatted = await prettier.format(source, { ...config, filepath: target })
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null
  if (check) {
    if (current !== formatted) {
      drift += 1
      console.error(`Out of date: ${path.relative(process.cwd(), target)}`)
    }
  } else if (current !== formatted) {
    writeFileSync(target, formatted)
    console.log(`wrote ${path.relative(process.cwd(), target)}`)
  }
}
if (check) {
  if (drift > 0) {
    console.error(`${drift} generated file(s) differ from the manifest. Re-run without --check.`)
    process.exit(1)
  }
  console.log('Generated manifest files match the manifest.')
}
console.log(
  `modules ${modules.length} · objectives ${objectives.length} · drills ${drills.length} · cases ${cases.length} · seeds ${questionSeeds.length} · sources ${sources.length} · review items ${reviewRegister.length}`,
)
