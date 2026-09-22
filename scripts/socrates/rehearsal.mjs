// Disposable PostgreSQL only. Never connects to shared Supabase or a remote database.
import { execFileSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const container = `socrates-rehearsal-${process.pid}`
const postgresImage = 'postgres:17-alpine'
const migration = readFileSync(
  path.join(root, 'supabase/migrations/20260922201126_socrates_training_study_v2.sql'),
  'utf8',
)
const run = (args, input) =>
  execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
function sql(source) {
  return run(
    ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres'],
    source,
  )
}
const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  one: '10000000-0000-4000-8000-000000000002',
  two: '10000000-0000-4000-8000-000000000003',
  outsider: '10000000-0000-4000-8000-000000000004',
}
function asUser(user, source) {
  return sql(
    `begin; set local role authenticated; select set_config('request.jwt.claims','${JSON.stringify({ sub: user, role: 'authenticated', is_anonymous: false })}',true); ${source}; commit;`,
  )
    .split('\n')
    .filter((line) => !['BEGIN', 'SET', 'COMMIT', ''].includes(line) && !line.startsWith('{"sub"'))
    .join('\n')
}
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`
const rpc = (user, name, args) =>
  asUser(
    user,
    `select public.${name}(${Object.values(args)
      .map((value) =>
        typeof value === 'object' ? `${lit(JSON.stringify(value))}::jsonb` : lit(value),
      )
      .join(',')})`,
  )
let checks = 0
function assert(condition, label) {
  if (!condition) throw new Error(label)
  checks++
  process.stdout.write(`PASS ${label}\n`)
}
function rejects(fn, label) {
  try {
    fn()
  } catch {
    assert(true, label)
    return
  }
  throw new Error(`Expected rejection: ${label}`)
}
function fixture(slug = 'synthetic-training') {
  return {
    schemaVersion: 2,
    slug,
    title: 'Synthetic training case',
    workflowStatus: 'draft',
    revision: 0,
    slide: {
      id: 'private-source-marker',
      descriptorUrl:
        'https://ucsd-slide-viewer-1080580899927.us-central1.run.app/generated/tiles/nio-006-series-4-barcode-ax00631/original.dzi',
      expectedDimensions: { width: 9000, height: 9900 },
      initialImageRect: { x: 0, y: 0, width: 9000, height: 9900 },
      attribution: {
        label: 'PRIVATE_SOURCE_MARKER',
        href: 'https://example.invalid/private-marker',
      },
      contentStatus: 'PRIVATE_STATUS_MARKER',
    },
    annotations: [
      {
        id: 'region',
        label: 'Synthetic region label',
        polygon: [
          { x: 470, y: 3581 },
          { x: 4903, y: 3581 },
          { x: 4903, y: 7503 },
          { x: 470, y: 7503 },
        ],
        style: 'parent',
        enterZoomRatio: 0,
        exitZoomRatio: 0,
        summary: 'Synthetic region summary',
        explanation: 'SYNTHETIC_REGION_EXPLANATION',
        placeholderNote: 'PRIVATE_REGION_NOTE',
        sortOrder: 0,
      },
    ],
    caseContent: {
      diagnosticCategory: 'Synthetic category A',
      subcategory: 'Synthetic subcategory',
      sortOrder: 0,
      trainingEligible: true,
      testingEligible: true,
      vignette:
        'Synthetic vignette: inspect this demonstration image. No clinical interpretation is assigned.',
      lowMagnificationObservations: ['Synthetic low-magnification observation'],
      highMagnificationObservations: ['Synthetic high-magnification observation'],
      keyLearningPoints: ['SYNTHETIC_LEARNING_POINT'],
      adequacy: { designation: 'SYNTHETIC_ADEQUACY_KEY', reasoning: 'SYNTHETIC_ADEQUACY_REASON' },
      cancer: { designation: 'SYNTHETIC_CANCER_KEY', reasoning: 'SYNTHETIC_CANCER_REASON' },
      preliminaryDiagnosis: null,
      annotationLegend: {
        reviewed: true,
        entries: [
          {
            label: 'Synthetic visual swatch (nonclinical)',
            color: '#888888',
            explanation: 'This is a synthetic test swatch, not an Invenio category.',
          },
        ],
      },
    },
    authorContent: {
      internalHighlightNotes: 'PRIVATE_HIGHLIGHT_MARKER',
      provenanceNotes: 'PRIVATE_PROVENANCE_MARKER',
      readiness: {
        contentReview: 'ready',
        deidentificationVerified: true,
        identifiersVerified: true,
        imaging: 'ready',
        secondaryRose: 'not-applicable',
        technicalHold: false,
        holdReason: 'PRIVATE_READINESS_MARKER',
      },
    },
  }
}
function cleanup() {
  try {
    run(['rm', '--force', '--volumes', container])
  } catch {}
}
process.on('SIGTERM', () => {
  cleanup()
  process.exit(0)
})
process.on('SIGINT', () => {
  cleanup()
  process.exit(0)
})
try {
  run([
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--network',
    'none',
    '--env',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    postgresImage,
  ])
  await new Promise((resolve) => setTimeout(resolve, 1500))
  for (let i = 0; i < 50; i++) {
    try {
      sql('select 1')
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create schema extensions; create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role; grant execute on all functions in schema auth to anon,authenticated,service_role;
 create table public.site_entitlements(user_id uuid,entitlement text,status text default 'active',expires_at timestamptz,
 constraint site_entitlements_entitlement_check check(entitlement in ('site_admin','socrates_editor')));
 grant select on public.site_entitlements to authenticated; grant all on public.site_entitlements to service_role;
 create function public.current_user_has_site_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.site_entitlements where user_id=auth.uid() and entitlement='site_admin' and status='active' and (expires_at is null or expires_at>now()))$$;
 create function public.set_site_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;`)
  sql(
    readFileSync(
      path.join(root, 'supabase/migrations/20260720225024_add_socrates_builder.sql'),
      'utf8',
    ),
  )
  sql(
    readFileSync(
      path.join(root, 'supabase/migrations/20260720235252_add_socrates_public_sandbox.sql'),
      'utf8',
    ),
  )
  // Both historical migrations run unchanged, followed by the additive migration.
  sql(migration)
  sql(`insert into auth.users(id,email_confirmed_at) values ${Object.values(ids)
    .map((id) => `(${lit(id)},now())`)
    .join(',')};
 insert into public.site_entitlements(user_id,entitlement) values (${lit(ids.admin)},'site_admin'),(${lit(ids.one)},'socrates_participant'),(${lit(ids.two)},'socrates_participant');`)
  // Exercise the public legacy path and reject private packages even at the RPC boundary.
  const legacy = fixture('synthetic-legacy')
  delete legacy.schemaVersion
  delete legacy.caseContent
  delete legacy.authorContent
  legacy.slide.descriptorUrl = 'https://www.invenio-cloud.com/api/thinslides/synthetic.dzi'
  legacy.annotations.forEach((a) => {
    delete a.explanation
  })
  const legacySaved = JSON.parse(
    rpc(ids.admin, 'save_socrates_slide_document', { payload: legacy }),
  )
  const legacyPublished = JSON.parse(
    rpc(ids.admin, 'publish_socrates_slide_document', { target_slide_id: legacySaved.recordId }),
  )
  assert(
    legacyPublished.annotations[0].id === legacy.annotations[0].id,
    'legacy save and publication remain readable',
  )
  const upgradedDraft = {
    ...legacyPublished,
    schemaVersion: 2,
    workflowStatus: 'draft',
    caseContent: fixture().caseContent,
    authorContent: fixture().authorContent,
  }
  upgradedDraft.authorContent.readiness.contentReview = 'incomplete'
  rpc(ids.admin, 'save_socrates_case_v2', { payload: upgradedDraft })
  const stillPublished = JSON.parse(
    rpc(ids.admin, 'get_published_socrates_slide', { requested_slug: legacy.slug }),
  )
  assert(
    stillPublished.revision === legacyPublished.revision,
    'v2 draft upgrade preserves an existing v1 published direct link',
  )
  rejects(
    () =>
      sql(
        `set role anon; select public.save_socrates_sandbox_document(${lit(JSON.stringify(fixture()))}::jsonb,'synthetic-token');`,
      ),
    'public sandbox refuses private case packages',
  )
  for (const invalid of [
    { ...fixture(), schemaVersion: '2' },
    {
      ...fixture(),
      authorContent: { ...fixture().authorContent, internalHighlightNotes: { note: 'invalid' } },
    },
    { ...fixture(), slide: { ...fixture().slide, secretNotes: 'unmapped' } },
    {
      ...fixture(),
      caseContent: {
        ...fixture().caseContent,
        annotationLegend: { ...fixture().caseContent.annotationLegend, secret: 'unmapped' },
      },
    },
  ])
    rejects(
      () => rpc(ids.admin, 'save_socrates_case_v2', { payload: invalid }),
      'malformed/unmapped case content rejected',
    )
  const original = fixture()
  const saved = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: original }))
  const cid = saved.recordId
  assert(
    saved.caseContent.vignette === original.caseContent.vignette &&
      saved.authorContent.internalHighlightNotes === original.authorContent.internalHighlightNotes,
    'full version 2 case and private notes round-trip',
  )
  assert(
    sql(`select explanation from public.socrates_annotations where slide_id=${lit(cid)}`).trim() ===
      'SYNTHETIC_REGION_EXPLANATION',
    'detailed explanations persist in structured annotation column',
  )
  assert(
    sql(`select descriptor_url from public.socrates_slides where id=${lit(cid)}`).trim() ===
      original.slide.descriptorUrl,
    'paired Invenio source persists',
  )
  assert(
    sql(`select label from public.socrates_case_legend where case_id=${lit(cid)}`).trim() ===
      original.caseContent.annotationLegend.entries[0].label,
    'legend persists in structured rows',
  )
  const published = JSON.parse(
    rpc(ids.admin, 'publish_socrates_slide_document', { target_slide_id: cid }),
  )
  const pub = JSON.parse(
    sql(
      `set role anon;select public.get_published_socrates_slide(${lit(original.slug)});reset role;`,
    )
      .split('\n')
      .find((l) => l.startsWith('{')),
  )
  assert(
    !JSON.stringify(pub).includes('PRIVATE_'),
    'published snapshot contains no private marker or source identifier',
  )
  assert(
    JSON.parse(rpc(ids.admin, 'list_socrates_author_cases', {}))[0].authorContent
      .internalHighlightNotes === 'PRIVATE_HIGHLIGHT_MARKER',
    'protected builder reload retains private notes',
  )
  assert(
    asUser(ids.one, 'select count(*) from public.socrates_case_readiness').trim() === '0',
    'participant cannot read case readiness',
  )
  assert(
    asUser(ids.one, 'select count(*) from public.socrates_revisions').trim() === '0',
    'participant cannot read answer snapshots',
  )
  rejects(
    () => asUser(ids.one, `update public.socrates_test_attempts set responses='{}'`),
    'direct participant response mutation denied',
  )
  const testDoc = fixture('synthetic-testing')
  testDoc.caseContent.trainingEligible = false
  testDoc.title = 'SYNTHETIC_DIAGNOSTIC_TITLE'
  const testSaved = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: testDoc }))
  const options = ['Synthetic option A', 'Synthetic option B']
  const survey = ['adequacy', 'cancer', 'confidence'].map((id) => ({
    id,
    prompt: `Synthetic ${id} question`,
    required: true,
    options,
  }))
  survey.push({ id: 'freeText', prompt: 'Optional comment', required: false, options: [] })
  const config = {
    slug: 'synthetic-study',
    title: 'Synthetic study',
    version: 'fixture-1',
    active: true,
    rounds: [1, 2].map((n) => ({
      key: `round-${n}`,
      title: `Round ${n}`,
      showLegend: false,
      showColorImage: n === 2,
      feedbackAfterSubmission: false,
      survey,
      cases: [{ caseId: testSaved.recordId, revision: 1 }],
    })),
  }
  const hold = fixture('synthetic-hold')
  hold.authorContent.readiness.deidentificationVerified = false
  const held = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: hold }))
  rejects(
    () =>
      rpc(ids.admin, 'socrates_save_study', {
        config: {
          ...config,
          slug: 'bad-study',
          rounds: [{ ...config.rounds[0], cases: [{ caseId: held.recordId, revision: 1 }] }],
        },
      }),
    'de-identification hold blocks study activation',
  )
  for (const [key, value] of Object.entries({
    contentReview: 'hold',
    identifiersVerified: false,
    imaging: 'incomplete',
    secondaryRose: 'hold',
    technicalHold: true,
  })) {
    const blocked = fixture(`synthetic-hold-${key.toLowerCase()}`)
    blocked.authorContent.readiness[key] = value
    const savedHold = JSON.parse(rpc(ids.admin, 'save_socrates_case_v2', { payload: blocked }))
    rejects(
      () =>
        rpc(ids.admin, 'socrates_save_study', {
          config: {
            ...config,
            slug: `blocked-${key.toLowerCase()}`,
            rounds: [{ ...config.rounds[0], cases: [{ caseId: savedHold.recordId, revision: 1 }] }],
          },
        }),
      `${key} blocks activation`,
    )
  }
  rejects(
    () => sql(`set role anon; select count(*) from public.socrates_test_attempts;`),
    'anonymous research-data reads denied',
  )
  assert(
    asUser(ids.one, 'select count(*) from public.socrates_studies').trim() === '0',
    'participants cannot read administrative configuration',
  )
  const sid = rpc(ids.admin, 'socrates_save_study', { config }).trim()
  for (const user of [ids.one, ids.two])
    rpc(ids.admin, 'socrates_enroll_participant', { sid, participant: user, enabled: true })
  rejects(
    () => rpc(ids.outsider, 'socrates_start_attempt', { sid, round_id: 'round-1', position: 1 }),
    'nonparticipant cannot start testing',
  )
  rejects(
    () => rpc(ids.admin, 'socrates_save_study', { config: { ...config, id: sid } }),
    'active study configuration cannot change',
  )
  rejects(
    () =>
      rpc(ids.one, 'socrates_record_training', {
        cid,
        rev: published.revision,
        stage: 'completed',
      }),
    'training completion requires teaching reveal',
  )
  rpc(ids.one, 'socrates_record_training', { cid, rev: published.revision, stage: 'revealed' })
  const training = rpc(ids.one, 'socrates_record_training', {
    cid,
    rev: published.revision,
    stage: 'completed',
  })
  assert(training.includes(cid), 'training progress persists')
  const attempt = JSON.parse(
    asUser(
      ids.one,
      `select row_to_json(a) from public.socrates_start_attempt(${lit(sid)},'round-1',1) a`,
    ),
  )
  const retry = JSON.parse(
    asUser(
      ids.one,
      `select row_to_json(a) from public.socrates_start_attempt(${lit(sid)},'round-1',1) a`,
    ),
  )
  assert(
    attempt.id === retry.id && attempt.started_at === retry.started_at,
    'reopening a case preserves one attempt and start time',
  )
  rejects(
    () => rpc(ids.two, 'socrates_submit_attempt', { attempt_id: attempt.id, answers: {} }),
    'another participant cannot submit the attempt',
  )
  rejects(
    () =>
      rpc(ids.one, 'socrates_submit_attempt', {
        attempt_id: attempt.id,
        answers: { adequacy: options[0] },
      }),
    'incomplete required responses rejected',
  )
  const answers = { adequacy: options[0], cancer: options[1], confidence: options[0] }
  const submitted = JSON.parse(
    asUser(
      ids.one,
      `select row_to_json(a) from public.socrates_submit_attempt(${lit(attempt.id)},${lit(JSON.stringify(answers))}::jsonb) a`,
    ),
  )
  const duplicate = JSON.parse(
    asUser(
      ids.one,
      `select row_to_json(a) from public.socrates_submit_attempt(${lit(attempt.id)},'{}'::jsonb) a`,
    ),
  )
  assert(
    submitted.submitted_at === duplicate.submitted_at &&
      JSON.stringify(duplicate.responses) === JSON.stringify(submitted.responses),
    'final submission is idempotent and immutable',
  )
  assert(
    submitted.elapsed_ms >= 0 &&
      submitted.confidence === options[0] &&
      submitted.missing_items.includes('freeText'),
    'server interpretation time, confidence and optional missingness recorded',
  )
  assert(
    asUser(
      ids.two,
      `select count(*) from public.socrates_test_attempts where id=${lit(attempt.id)}`,
    ).trim() === '0',
    'another participant cannot read responses under RLS',
  )
  assert(
    asUser(ids.admin, 'select count(*) from public.socrates_test_attempts').trim() === '1',
    'administrator can monitor responses',
  )
  const second = JSON.parse(
    asUser(
      ids.one,
      `select row_to_json(a) from public.socrates_start_attempt(${lit(sid)},'round-2',1) a`,
    ),
  )
  assert(
    second.round_key === 'round-2' && second.case_revision === 1,
    'Round 2 pins configured case revision',
  )
  const directory = JSON.parse(rpc(ids.one, 'socrates_participant_studies', {}))
  assert(
    directory[0].rounds[0].completed === 1 &&
      directory[0].rounds[1].completed === 0 &&
      directory[0].rounds[0].total === 1,
    'participant directory counts rounds independently without case/answer disclosure',
  )
  assert(
    !JSON.stringify(directory).includes('caseId') &&
      !JSON.stringify(directory).includes('responses'),
    'participant directory contains only enrolled labels and own counts',
  )
  const competing = JSON.parse(
    asUser(
      ids.two,
      `select row_to_json(a) from public.socrates_start_attempt(${lit(sid)},'round-2',1) a`,
    ),
  )
  const concurrentSql = (values) =>
    `begin;set local role authenticated;select set_config('request.jwt.claims',${lit(JSON.stringify({ sub: ids.two, role: 'authenticated', is_anonymous: false }))},true);select row_to_json(a) from public.socrates_submit_attempt(${lit(competing.id)},${lit(JSON.stringify(values))}::jsonb) a;commit;`
  const contenders = await Promise.all(
    [answers, { ...answers, cancer: options[0] }].map((values) =>
      promisify(execFile)(
        'docker',
        [
          'exec',
          container,
          'psql',
          '-X',
          '-v',
          'ON_ERROR_STOP=1',
          '-At',
          '-U',
          'postgres',
          '-c',
          concurrentSql(values),
        ],
        { encoding: 'utf8' },
      ),
    ),
  )
  const outcomes = contenders.map(({ stdout }) =>
    JSON.parse(stdout.split('\n').find((line) => line.startsWith('{"id"'))),
  )
  assert(
    JSON.stringify(outcomes[0]) === JSON.stringify(outcomes[1]),
    'concurrent finalizations return the same immutable winning response',
  )
  // Current safety holds also suspend a previously activated, pinned case.
  sql(
    `update public.socrates_case_readiness set technical_hold=true where case_id=${lit(testSaved.recordId)}`,
  )
  rejects(
    () => rpc(ids.two, 'socrates_start_attempt', { sid, round_id: 'round-1', position: 1 }),
    'new safety hold blocks existing study starts',
  )
  rejects(
    () => rpc(ids.one, 'socrates_submit_attempt', { attempt_id: second.id, answers }),
    'new safety hold blocks active attempt submission',
  )
  rpc(ids.admin, 'socrates_set_study_active', { sid, enabled: false })
  rejects(
    () => rpc(ids.admin, 'socrates_set_study_active', { sid, enabled: true }),
    'held study cannot resume',
  )
  sql(
    `update public.socrates_case_readiness set technical_hold=false where case_id=${lit(testSaved.recordId)}`,
  )
  rpc(ids.admin, 'socrates_set_study_active', { sid, enabled: true })
  process.stdout.write(`\n${checks} PostgreSQL checks passed.\n`)
  if (!process.argv.includes('--serve')) {
    cleanup()
    process.exit(0)
  }
  // Browser rehearsal bridge is added below. It never ships in the Next application.
  globalThis.rehearsal = {
    container,
    ids,
    cid,
    testCaseId: testSaved.recordId,
    studyId: sid,
    sql,
    asUser,
    lit,
    run,
    root,
    fixture,
    cleanup,
    checks,
  }
  await import('./serve-fixture.mjs')
} catch (error) {
  cleanup()
  process.stderr.write(String(error.stderr ?? error.stack ?? error) + '\n')
  process.exitCode = 1
}
