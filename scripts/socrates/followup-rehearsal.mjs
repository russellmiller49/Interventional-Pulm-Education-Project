// Synthetic data only, invoked inside the existing disposable PostgreSQL rehearsal.
export const narrative =
  'What to notice\nAt medium to high magnification: Synthetic observation with a qualification.\n\nKey learning point\nA synthetic teaching point.\n\nExpected study classification\nAdequacy: Synthetic adequate. Explicit synthetic reasoning.\nCancer vs non-cancer: Synthetic category. Explicit second reasoning.\n\nCommon pitfall\nA synthetic pitfall.\nAn additional paragraph remains unchanged.'

export function narrativeFields() {
  return {
    learnerNarrative: narrative,
    lowMagnificationObservations: [],
    highMagnificationObservations: [],
    keyLearningPoints: [],
    adequacy: { designation: 'Synthetic adequate', reasoning: 'Explicit synthetic reasoning.' },
    cancer: { designation: 'Synthetic category', reasoning: 'Explicit second reasoning.' },
    preliminaryDiagnosis: null,
  }
}
export function sourceFixture() {
  return {
    workbookSha256: 'a'.repeat(64),
    sourceSheet: 'Curriculum Sequence',
    sourceRow: 2,
    sourceValues: {
      'Overall Order': 1,
      Module: 'MODULE 1 — CORE SRH ORIENTATION',
      'Order in Module': 1,
      'Full Case Name': 'Case 841 · Series 2 · Synthetic case',
      'Curriculum Role': 'PRIVATE_CURRICULUM_ROLE',
      'Teaching Objective / Why Here': 'PRIVATE_CURRICULUM_OBJECTIVE',
      'Full Learner-Facing Text': narrative,
      'Internal Note · Not Learner-Facing': 'PRIVATE_SOURCE_NOTE',
    },
  }
}

export async function runFollowupChecks({
  sql,
  rpc,
  asUser,
  ids,
  cid,
  fixture,
  assert,
  rejects,
  lit,
}) {
  const doc = fixture('synthetic-narrative')
  doc.title = 'Synthetic narrative case'
  doc.annotations = []
  Object.assign(doc.caseContent, narrativeFields())
  doc.authorContent.curriculumSource = sourceFixture()
  let saved = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: doc }))
  const loaded = JSON.parse(rpc(ids.admin, 'list_socrates_author_cases', {})).find(
    (d) => d.recordId === saved.recordId,
  )
  assert(
    JSON.stringify(saved) === JSON.stringify(loaded),
    'protected narrative/source snapshot reload is exact',
  )
  assert(
    sql(
      `select learner_narrative from public.socrates_case_content where case_id=${lit(saved.recordId)}`,
    ).trim() === narrative,
    'verbatim narrative persists in its protected typed column',
  )
  assert(
    JSON.parse(
      sql(
        `select curriculum_source from public.socrates_case_readiness where case_id=${lit(saved.recordId)}`,
      ),
    ).sourceValues['Internal Note · Not Learner-Facing'] === 'PRIVATE_SOURCE_NOTE',
    'source notes remain separate from learner content',
  )
  const bad = JSON.parse(JSON.stringify(saved))
  bad.caseContent.cancer.designation = 'Contradictory stale value'
  rejects(
    () => rpc(ids.admin, 'save_socrates_case_v2', { payload: bad }),
    'database rejects contradictory narrative/structured content',
  )
  const placeholder = JSON.parse(JSON.stringify(saved))
  placeholder.caseContent.annotationLegend.entries[0].label = 'Pending label'
  rejects(
    () => rpc(ids.admin, 'save_socrates_case_v2', { payload: placeholder }),
    'database rejects a reviewed placeholder key',
  )
  const changed = JSON.parse(JSON.stringify(saved))
  changed.caseContent.vignette = 'Current unsaved context, then saved.'
  const revised = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: changed }))
  assert(
    revised.authorContent.readiness.contentReview === 'incomplete',
    'database teaching edits invalidate content review',
  )
  rejects(
    () => rpc(ids.admin, 'save_socrates_case_v2', { payload: saved }),
    'stale revision rejects instead of losing newer author content',
  )
  rejects(
    () => rpc(ids.admin, 'socrates_save_case_v2_base', { payload: revised }),
    'old save helper cannot bypass the extension guard',
  )
  revised.authorContent.readiness.contentReview = 'ready'
  saved = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: revised }))
  assert(
    saved.caseContent.learnerNarrative === narrative,
    'explicit re-review preserves every source narrative character',
  )
  const published = JSON.parse(
    rpc(ids.admin, 'publish_socrates_slide_document', { target_slide_id: saved.recordId }),
  )
  const publicData = JSON.parse(
    rpc(ids.one, 'get_published_socrates_slide', { requested_slug: doc.slug }),
  )
  assert(
    !/PRIVATE_|learnerNarrative|curriculumSource|"designation"|synthetic pitfall/.test(
      JSON.stringify(publicData),
    ),
    'public v2 entry response excludes new narrative, classifications and all source metadata',
  )
  const incomplete = fixture('synthetic-unready-curriculum')
  incomplete.authorContent.readiness.deidentificationVerified = false
  const unready = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: incomplete }))
  const state = () =>
    [
      'socrates_studies',
      'socrates_study_rounds',
      'socrates_study_cases',
      'socrates_study_participants',
      'socrates_test_attempts',
      'socrates_training_progress',
    ]
      .map((table) =>
        sql(
          `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from public.${table} t`,
        ),
      )
      .join('\n')
  const before = state()
  const membership = (caseId, position, state = 'approved') => ({
    caseId,
    position,
    sourceOrder: position,
    sourceKey: `synthetic-${position}`,
    state,
    decision: 'Synthetic fixture decision only',
  })
  const config = {
    moduleId: 'core-srh-orientation',
    expectedRevision: 0,
    memberships: [
      membership(saved.recordId, 1),
      membership(cid, 6),
      membership(unready.recordId, 8),
    ],
  }
  rejects(
    () => rpc(ids.one, 'save_socrates_curriculum_memberships', { payload: config }),
    'participant cannot change or release curriculum memberships',
  )
  rejects(
    () =>
      asUser(
        ids.admin,
        "insert into public.socrates_curriculum_memberships(module_id) values ('core-srh-orientation')",
      ),
    'direct membership mutation cannot bypass revision checks',
  )
  const version = Number(
    rpc(ids.admin, 'save_socrates_curriculum_memberships', { payload: config }),
  )
  assert(version === 1, 'curriculum membership changes advance only the module revision')
  rejects(
    () => rpc(ids.admin, 'save_socrates_curriculum_memberships', { payload: config }),
    'stale curriculum revision fails safely',
  )
  assert(
    Number(
      rpc(ids.admin, 'save_socrates_curriculum_memberships', {
        payload: { ...config, expectedRevision: version },
      }),
    ) === version,
    'repeating unchanged curriculum writes is a no-op',
  )
  let modules = JSON.parse(rpc(ids.one, 'socrates_curriculum_catalog', {}))
  assert(
    modules.length === 6 &&
      JSON.stringify(modules.map((m) => m.plannedCount)) === '[20,5,8,14,6,6]',
    'six source-plan modules retain exact order and planned counts',
  )
  assert(
    modules[0].cases.length === 2 &&
      JSON.stringify(modules[0].cases.map((c) => c.position)) === '[1,6]',
    'module list sorts approved available cases by membership position and filters unready cases',
  )
  assert(
    !JSON.stringify(modules).includes('PRIVATE_') && !JSON.stringify(modules).includes('sourceKey'),
    'catalog excludes protected membership and source fields',
  )
  assert(
    asUser(ids.one, 'select count(*) from public.socrates_curriculum_memberships').trim() === '0',
    'membership RLS hides unpublished/proposed identities from participants',
  )
  rejects(
    () => sql('set role anon;select * from public.socrates_curriculum_memberships'),
    'anonymous direct membership reads denied',
  )
  const heldConfig = { ...config, expectedRevision: 1, memberships: [membership(cid, 6, 'held')] }
  rpc(ids.admin, 'save_socrates_curriculum_memberships', { payload: heldConfig })
  modules = JSON.parse(rpc(ids.one, 'socrates_curriculum_catalog', {}))
  assert(
    modules[0].cases.length === 1,
    'held membership removes availability without deleting the case or changing source order',
  )
  rejects(
    () =>
      rpc(ids.admin, 'save_socrates_curriculum_memberships', {
        payload: {
          ...heldConfig,
          expectedRevision: 2,
          memberships: [{ ...membership(cid, 6), decision: '' }],
        },
      }),
    'held membership release requires an explicit administrator decision',
  )
  rpc(ids.admin, 'save_socrates_curriculum_memberships', {
    payload: { ...config, expectedRevision: 2 },
  })
  assert(
    before === state(),
    'curriculum changes preserve every study, enrollment, pinned revision, attempt and genuine progress record',
  )
  // Return only synthetic IDs to the local browser fixture.
  return { narrativeCaseId: saved.recordId, narrativeRevision: published.revision }
}
