// Runs in an isolated in-memory Postgres instance; never connects to Supabase.
// Install @electric-sql/pglite in a temporary directory, then pass that directory's
// node_modules/@electric-sql/pglite as the first argument. No app dependency is added.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const modulePath = process.argv[2] || '@electric-sql/pglite'
const { PGlite } = require(modulePath)
const loadPGlite = createRequire(require.resolve(modulePath))
const { pgcrypto } = loadPGlite('./contrib/pgcrypto.cjs')
const db = new PGlite({ extensions: { pgcrypto } })
const admin = '10000000-0000-4000-8000-000000000001'
const editor = '10000000-0000-4000-8000-000000000002'
const root = new URL('../../', import.meta.url)
const migration = async (file) =>
  db.exec(await readFile(new URL(`supabase/migrations/${file}`, root), 'utf8'))

try {
  // Minimal dependencies of the two existing SOCRATES migrations.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to authenticated, anon;
    create table public.site_entitlements (
      user_id uuid, entitlement text, status text, expires_at timestamptz
    );
    create function public.set_site_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at = now(); return new; end;
    $$;
    create function public.current_user_has_site_admin() returns boolean language sql stable as $$
      select auth.uid() = '${admin}'::uuid;
    $$;
    insert into auth.users values ('${admin}'), ('${editor}');
    insert into public.site_entitlements values
      ('${admin}', 'site_admin', 'active', null), ('${editor}', 'socrates_editor', 'active', null);
  `)
  await migration('20260720225024_add_socrates_builder.sql')
  await migration('20260720235252_add_socrates_public_sandbox.sql')
  await migration('20260908233000_add_socrates_invenio_comparison.sql')

  const descriptor =
    'https://ucsd-slide-viewer-1080580899927.us-central1.run.app/generated/tiles/nio-006-series-4-barcode-ax00631/original.dzi'
  const document = {
    slug: 'invenio-comparison-test',
    title: 'Comparison test',
    workflowStatus: 'draft',
    revision: 0,
    slide: {
      id: 'nio-006-series-4-barcode-ax00631',
      descriptorUrl: descriptor,
      expectedDimensions: { width: 9000, height: 9900 },
      initialImageRect: { x: 0, y: 0, width: 9000, height: 9900 },
      attribution: {
        label: 'Invenio Imaging',
        href: 'https://ucsd-slide-viewer-1080580899927.us-central1.run.app/',
      },
      contentStatus: 'Illustrative teaching content',
    },
    annotations: [
      {
        id: 'region-1',
        label: 'Example region',
        style: 'parent',
        enterZoomRatio: 0,
        exitZoomRatio: 0,
        polygon: [
          { x: 100, y: 100 },
          { x: 900, y: 100 },
          { x: 900, y: 900 },
          { x: 100, y: 900 },
        ],
        summary: 'Short summary.',
        explanation: 'Detailed observation.\nA separate teaching paragraph.',
        placeholderNote: 'Awaiting author review.',
        sortOrder: 0,
      },
    ],
  }
  const rpc = async (sql, params) => (await db.query(sql, params)).rows[0].document
  const actingAs = async (role, id = '') => {
    await db.exec(`reset role; set role ${role};`)
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
  }

  await actingAs('authenticated', editor)
  const saved = await rpc('select public.save_socrates_slide_document($1::jsonb) as document', [
    JSON.stringify(document),
  ])
  assert.equal(saved.revision, 1)
  const stored = (
    await db.query('select explanation from public.socrates_annotations where slide_id=$1', [
      saved.recordId,
    ])
  ).rows[0]
  assert.equal(stored.explanation, document.annotations[0].explanation)
  await assert.rejects(
    db.query('select public.publish_socrates_slide_document($1)', [saved.recordId]),
    /administrator/i,
  )

  await actingAs('authenticated', admin)
  const published = await rpc('select public.publish_socrates_slide_document($1) as document', [
    saved.recordId,
  ])
  assert.equal(published.slide.descriptorUrl, descriptor)
  assert.equal(published.annotations[0].explanation, document.annotations[0].explanation)
  await actingAs('anon')
  const publicDocument = await rpc('select public.get_published_socrates_slide($1) as document', [
    document.slug,
  ])
  assert.equal(publicDocument.annotations[0].explanation, document.annotations[0].explanation)
  await assert.rejects(
    db.query('select public.save_socrates_slide_document($1::jsonb)', [JSON.stringify(document)]),
    /permission denied/i,
  )

  const editKey = 'isolated-fixture-edit-key-01234567890123456789'
  const sandboxCopy = await rpc(
    'select public.save_socrates_sandbox_document($1::jsonb, $2) as document',
    [JSON.stringify(document), editKey],
  )
  assert.equal(sandboxCopy.annotations[0].explanation, document.annotations[0].explanation)
  const revised = structuredClone(document)
  revised.annotations[0].explanation = 'Revised teaching explanation.'
  const sandboxRevision = await rpc(
    'select public.save_socrates_sandbox_document($1::jsonb, $2, $3::uuid) as document',
    [JSON.stringify(revised), editKey, sandboxCopy.recordId],
  )
  assert.equal(sandboxRevision.revision, 2)
  assert.equal(sandboxRevision.annotations[0].explanation, revised.annotations[0].explanation)
  await assert.rejects(
    db.query('select public.save_socrates_sandbox_document($1::jsonb,$2,$3::uuid)', [
      JSON.stringify(revised),
      'incorrect-edit-key-01234567890123456789',
      sandboxCopy.recordId,
    ]),
    /edit key/i,
  )
  const listed = await rpc('select public.list_socrates_sandbox_documents() as document', [])
  assert.equal(listed[0].annotations[0].explanation, revised.annotations[0].explanation)
  assert.equal(JSON.stringify(listed).includes(editKey), false)
  await assert.rejects(
    db.query('select * from public.socrates_sandbox_documents'),
    /permission denied/i,
  )

  for (const invalid of [
    descriptor + '?token=x',
    descriptor.replace('run.app', 'run.app.evil.test'),
    descriptor.replace('https://', 'https://user:password@'),
  ]) {
    const bad = { ...document, slide: { ...document.slide, descriptorUrl: invalid } }
    await assert.rejects(
      db.query('select public.save_socrates_sandbox_document($1::jsonb,$2)', [
        JSON.stringify(bad),
        editKey,
      ]),
      /approved Invenio/i,
    )
  }
  const oversized = structuredClone(document)
  oversized.annotations[0].explanation = 'x'.repeat(8001)
  await assert.rejects(
    db.query('select public.save_socrates_sandbox_document($1::jsonb,$2)', [
      JSON.stringify(oversized),
      editKey,
    ]),
    /8000/,
  )
  await actingAs('authenticated', editor)
  oversized.slug = 'oversized-test'
  await assert.rejects(
    db.query('select public.save_socrates_slide_document($1::jsonb)', [JSON.stringify(oversized)]),
    /explanation_check/,
  )

  // Old single-image documents still save with an empty optional explanation.
  const legacy = structuredClone(document)
  legacy.slug = 'legacy-slide'
  legacy.slide.descriptorUrl =
    'https://www.invenio-cloud.com/api/thinslides/PATH_IP31-AC0501-2_7.dzi'
  delete legacy.annotations[0].explanation
  const legacySaved = await rpc(
    'select public.save_socrates_slide_document($1::jsonb) as document',
    [JSON.stringify(legacy)],
  )
  assert.equal(
    (
      await db.query('select explanation from public.socrates_annotations where slide_id=$1', [
        legacySaved.recordId,
      ])
    ).rows[0].explanation,
    '',
  )
  console.log(
    'PASS: protected save/reload/publish, sandbox save/update/list, legacy documents, URL and text validation, role and edit-key protections.',
  )
} finally {
  await db.close()
}
