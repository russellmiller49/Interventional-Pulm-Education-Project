import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { narrative, sourceFixture } from './followup-rehearsal.mjs'

export async function runImportChecks({ sql, rpc, ids, fixture, assert, rejects, lit, root }) {
  const directory = path.join(root, 'test-results/socrates-followup')
  mkdirSync(directory, { recursive: true })
  const output = path.join(directory, 'import-plan.cjs')
  await build({
    entryPoints: [path.join(root, 'scripts/socrates/import-plan.ts')],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    logLevel: 'error',
  })
  const { createImportPlan, digest } = createRequire(import.meta.url)(output)
  const makeTarget = (number, position) => {
    const doc = fixture('synthetic-import-' + number)
    doc.slide.descriptorUrl = `https://ucsd-slide-viewer-1080580899927.us-central1.run.app/generated/tiles/nio-${number}-series-2-barcode-synthetic${number}/original.dzi`
    Object.assign(doc.caseContent, {
      lowMagnificationObservations: [],
      highMagnificationObservations: [],
      keyLearningPoints: [],
      adequacy: { designation: '', reasoning: '' },
      cancer: { designation: '', reasoning: '' },
      preliminaryDiagnosis: null,
    })
    const saved = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: doc }))
    const source = sourceFixture()
    Object.assign(source.sourceValues, {
      'Overall Order': 53 + position,
      'Order in Module': position,
      Module: 'MODULE 6 — ADVANCED CASES',
      'Full Case Name': `Case ${number} · Series 2 · Synthetic case`,
      'Internal Note · Not Learner-Facing': null,
    })
    return {
      saved,
      record: {
        ...source,
        identity: {
          caseNumberAsWritten: String(number),
          seriesNumberAsWritten: '2',
          key: `case-${number}-series-2`,
        },
        moduleId: 'advanced-cases',
        membershipHold: null,
      },
    }
  }
  const protectedSnapshot = () => ({
    cases: JSON.parse(rpc(ids.admin, 'list_socrates_author_cases', {})),
    modules: JSON.parse(
      sql('select jsonb_agg(to_jsonb(m)) from public.socrates_curriculum_modules m'),
    ),
    memberships: JSON.parse(
      sql(
        "select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.socrates_curriculum_memberships m",
      ),
    ),
  })
  const inspection = (targets) => ({
    format: 'socrates-workbook-inspection-v1',
    sha256: 'a'.repeat(64),
    modules: [],
    records: targets.map((t) => t.record),
  })
  const mappings = (targets) =>
    targets.map(({ saved, record }) => ({
      sourceKey: record.identity.key,
      targetCaseUuid: saved.recordId,
      expectedRevision: saved.revision,
      expectedImageUrl: saved.slide.descriptorUrl,
      identityVerified: true,
      reviewedCurrentDraft: true,
      approvedFields: [],
    }))
  const one = makeTarget(841, 4)
  const plan = createImportPlan(inspection([one]), protectedSnapshot(), mappings([one]))
  assert(plan.canApply, 'actual TypeScript planner validates a mapped synthetic saved draft')
  rejects(
    () => rpc(ids.one, 'socrates_apply_workbook_import', { payload: plan.payload }),
    'participant cannot apply a protected workbook import',
  )
  const altered = structuredClone(plan.payload)
  altered.updates[0].document.annotations[0].polygon[0].x++
  rejects(
    () => rpc(ids.admin, 'socrates_apply_workbook_import', { payload: altered }),
    'import RPC refuses geometry changes even from an editor',
  )
  const publishing = structuredClone(plan.payload)
  publishing.modules[0].memberships[0].state = 'approved'
  rejects(
    () => rpc(ids.admin, 'socrates_apply_workbook_import', { payload: publishing }),
    'import RPC cannot release a membership',
  )
  assert(
    sql(
      `select revision from public.socrates_slides where id=${lit(one.saved.recordId)}`,
    ).trim() === '1',
    'late membership failure rolls back the earlier case save and revision',
  )
  const result = JSON.parse(
    rpc(ids.admin, 'socrates_apply_workbook_import', { payload: plan.payload }),
  )
  const retry = JSON.parse(
    rpc(ids.admin, 'socrates_apply_workbook_import', { payload: plan.payload }),
  )
  assert(
    JSON.stringify(result) === JSON.stringify(retry),
    'retry returns the same committed import receipt',
  )
  let snapshot = protectedSnapshot()
  const imported = snapshot.cases.find((d) => d.recordId === one.saved.recordId)
  assert(
    imported.revision === 2 && imported.caseContent.learnerNarrative === narrative,
    'batch save uses one revision and retains the exact complete narrative',
  )
  assert(
    imported.authorContent.internalHighlightNotes ===
      one.saved.authorContent.internalHighlightNotes &&
      imported.authorContent.curriculumSource.sourceValues['Internal Note · Not Learner-Facing'] ===
        null,
    'blank source notes preserve existing private notes',
  )
  assert(
    JSON.stringify(imported.slide) === JSON.stringify(one.saved.slide) &&
      JSON.stringify(imported.annotations) === JSON.stringify(one.saved.annotations) &&
      imported.caseContent.testingEligible === one.saved.caseContent.testingEligible &&
      imported.authorContent.readiness.contentReview === 'incomplete',
    'import preserves images, geometry, eligibility and invalidates review',
  )
  assert(
    snapshot.memberships.find((m) => m.case_id === imported.recordId).release_state === 'pending',
    'import creates only pending curriculum membership',
  )
  const noOp = createImportPlan(inspection([one]), snapshot, mappings([one]))
  assert(
    noOp.canApply && noOp.payload.updates.length === 0 && noOp.counts['no-op'] === 1,
    'fresh unchanged re-import produces no case or membership writes',
  )
  const member = snapshot.memberships.find((m) => m.case_id === one.saved.recordId)
  const moduleRevision = () => snapshot.modules.find((m) => m.id === member.module_id).revision
  const release = {
    caseId: member.case_id,
    position: member.position,
    sourceOrder: member.source_order,
    sourceKey: member.source_key,
  }
  rpc(ids.admin, 'save_socrates_curriculum_memberships', {
    payload: {
      moduleId: member.module_id,
      expectedRevision: moduleRevision(),
      memberships: [{ ...release, state: 'approved', decision: 'Synthetic administrator release' }],
    },
  })
  snapshot = protectedSnapshot()
  const settled = createImportPlan(inspection([one]), snapshot, mappings([one]))
  assert(
    settled.counts['no-op'] === 1 && settled.payload.modules.length === 0,
    'fresh re-import leaves an administrator-approved membership untouched',
  )
  const current = snapshot.cases.find((d) => d.recordId === one.saved.recordId)
  const demotion = {
    sourceSha256: 'a'.repeat(64),
    updates: [
      {
        sourceKey: member.source_key,
        expectedRevision: current.revision,
        expectedImageUrl: current.slide.descriptorUrl,
        approvedFields: [],
        document: current,
      },
    ],
    modules: [
      {
        moduleId: member.module_id,
        expectedRevision: moduleRevision(),
        memberships: [{ ...release, state: 'pending', decision: '' }],
      },
    ],
  }
  rejects(
    () =>
      rpc(ids.admin, 'socrates_apply_workbook_import', {
        payload: { importId: digest(demotion), ...demotion },
      }),
    'import cannot demote or rewrite an administrator-approved membership',
  )
  assert(
    sql(
      `select release_state||'|'||decision_note from public.socrates_curriculum_memberships where case_id=${lit(one.saved.recordId)}`,
    ).trim() === 'approved|Synthetic administrator release',
    'administrator release decision and note survive the rejected import',
  )
  const two = makeTarget(842, 5),
    three = makeTarget(843, 6)
  const batch = createImportPlan(
    inspection([two, three]),
    protectedSnapshot(),
    mappings([two, three]),
  )
  const newer = structuredClone(three.saved)
  newer.caseContent.vignette = 'Newer synthetic author edit'
  rpc(ids.admin, 'save_socrates_case_v2', { payload: newer })
  rejects(
    () => rpc(ids.admin, 'socrates_apply_workbook_import', { payload: batch.payload }),
    'one stale target rejects the entire batch',
  )
  snapshot = protectedSnapshot()
  assert(
    snapshot.cases.find((d) => d.recordId === two.saved.recordId).revision === 1 &&
      !snapshot.cases.find((d) => d.recordId === two.saved.recordId).caseContent.learnerNarrative,
    'stale second case leaves the first case and membership untouched',
  )
  const mismatch = structuredClone(batch.payload)
  mismatch.updates[0].expectedImageUrl = three.saved.slide.descriptorUrl
  mismatch.importId = digest(mismatch)
  rejects(
    () => rpc(ids.admin, 'socrates_apply_workbook_import', { payload: mismatch }),
    'source image mismatch rejects without a guessed replacement',
  )
  assert(
    sql('select count(*) from public.socrates_import_receipts').trim() === '1',
    'failed batches create no successful receipts',
  )
}
