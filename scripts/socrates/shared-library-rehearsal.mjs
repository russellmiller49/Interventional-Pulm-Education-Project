import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sourceFixture } from './followup-rehearsal.mjs'
export async function runSharedLibraryChecks({
  sql,
  rpc,
  asUser,
  ids,
  fixture,
  assert,
  rejects,
  lit,
  root,
}) {
  sql(
    readFileSync(
      path.join(root, 'supabase/migrations/20260927143811_socrates_shared_slide_library.sql'),
      'utf8',
    ),
  )
  sql(
    `insert into public.site_entitlements(user_id,entitlement) values (${lit(ids.two)},'socrates_editor')`,
  )
  const id = '70000000-0000-4000-8000-000000000001'
  const doc = fixture('synthetic-shared-library')
  const args = (payload, version = 0, assignment = 'teaching', libraryId = id) => ({
    library_id: libraryId,
    expected_version: version,
    assignment,
    payload,
  })
  rejects(
    () => rpc(ids.one, 'list_socrates_library_slides', {}),
    'participant cannot read shared drafts',
  )
  rejects(
    () => rpc(ids.one, 'save_socrates_library_slide', args(doc)),
    'participant cannot save shared drafts',
  )
  let one = JSON.parse(rpc(ids.two, 'save_socrates_library_slide', args(doc)))
  assert(
    one.version === 1 && one.document.revision === 1 && !one.publishedRevision,
    'editor creates shared draft without publishing',
  )
  assert(
    JSON.parse(rpc(ids.admin, 'list_socrates_library_slides', {}))[0].id === id,
    'another author sees saved draft',
  )
  rejects(
    () =>
      asUser(
        ids.two,
        `update public.socrates_library_slides set published_revision=1 where id=${lit(id)}`,
      ),
    'direct DML cannot bypass publication checks',
  )
  rejects(
    () =>
      rpc(ids.two, 'publish_socrates_library_slide', {
        library_id: id,
        expected_version: 1,
        expected_revision: 1,
        release: true,
      }),
    'editor cannot publish',
  )
  rejects(
    () =>
      rpc(ids.admin, 'publish_socrates_library_slide', {
        library_id: id,
        expected_version: 1,
        expected_revision: 99,
        release: true,
      }),
    'publish rejects unseen newer revision',
  )
  const publish = (slide, release = true) =>
    JSON.parse(
      rpc(ids.admin, 'publish_socrates_library_slide', {
        library_id: id,
        expected_version: slide.version,
        expected_revision: slide.document.revision,
        release,
      }),
    )
  one = publish(one)
  assert(
    one.publishedRevision === 1 && one.publishedAssignment === 'teaching',
    'administrator releases the reviewed snapshot',
  )
  const stale = one
  const changed = JSON.parse(JSON.stringify(one.document))
  changed.title = 'New unpublished title'
  one = JSON.parse(
    rpc(ids.two, 'save_socrates_library_slide', args(changed, one.version, 'testing')),
  )
  assert(
    one.publishedRevision === 1 && one.publishedAssignment === 'teaching',
    'draft edits and reassignment retain previous release',
  )
  const releases = () => JSON.parse(sql('select public.socrates_library_releases()'))
  assert(
    releases()[0].document.title === doc.title,
    'learner release keeps old content while authors edit',
  )
  rejects(
    () => rpc(ids.admin, 'save_socrates_library_slide', args(stale.document, stale.version)),
    'stale editor cannot overwrite newer content',
  )
  rejects(() => publish(one), 'unreviewed changed content cannot be published')
  const reviewed = JSON.parse(JSON.stringify(one.document))
  reviewed.authorContent.readiness.contentReview = 'ready'
  one = JSON.parse(
    rpc(ids.two, 'save_socrates_library_slide', args(reviewed, one.version, 'testing')),
  )
  one = publish(one)
  assert(
    releases()[0].assignment === 'testing' && releases()[0].document.title === changed.title,
    'reviewed new revision and testing assignment release together',
  )
  rejects(
    () => rpc(ids.one, 'socrates_library_releases', {}),
    'participants cannot fetch raw released snapshots or testing answers',
  )
  assert(
    asUser(ids.one, 'select count(*) from public.socrates_library_slides').trim() === '0',
    'RLS hides draft metadata from participants',
  )
  const held = JSON.parse(JSON.stringify(one.document))
  held.authorContent.readiness.technicalHold = true
  one = JSON.parse(rpc(ids.two, 'save_socrates_library_slide', args(held, one.version, 'testing')))
  assert(
    releases().length === 0,
    'technical hold immediately withdraws learner image/content access',
  )
  one = publish(one, false)
  assert(!one.publishedRevision, 'administrator can explicitly withdraw a release')
  rejects(
    () => sql('set role anon; select public.list_socrates_library_slides()'),
    'anonymous cannot read author library',
  )
  sql(`update auth.users set email_confirmed_at=null where id=${lit(ids.two)}`)
  rejects(
    () => rpc(ids.two, 'list_socrates_library_slides', {}),
    'unverified editor cannot use shared library',
  )
  sql(`update auth.users set email_confirmed_at=now() where id=${lit(ids.two)}`)
  const sourceDoc = fixture('synthetic-shared-workbook')
  sourceDoc.authorContent.curriculumSource = sourceFixture()
  const sourceId = '70000000-0000-4000-8000-000000000002'
  const source = JSON.parse(
    rpc(ids.two, 'save_socrates_library_slide', args(sourceDoc, 0, 'unassigned', sourceId)),
  )
  rejects(
    () =>
      rpc(
        ids.admin,
        'save_socrates_library_slide',
        args(
          { ...sourceDoc, slug: 'another-browser-same-source' },
          0,
          'unassigned',
          '70000000-0000-4000-8000-000000000003',
        ),
      ),
    'workbook imports from another browser do not duplicate or replace shared source',
  )
  assert(
    source.importKey ===
      `workbook:${'a'.repeat(64)}:${sourceDoc.authorContent.curriculumSource.sourceRow}`,
    'server derives import identity from validated source metadata',
  )
  assert(
    sql(
      "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('list_socrates_library_slides','save_socrates_library_slide','publish_socrates_library_slide','socrates_library_releases','socrates_library_editor') and p.prosecdef and p.proconfig @> array['search_path=\"\"']",
    ).trim() === '5',
    'privileged library functions pin an empty search path',
  )
}
