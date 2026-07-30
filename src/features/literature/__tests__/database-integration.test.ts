/** @jest-environment node */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const execFileAsync = promisify(execFile)
const integrationEnabled = process.env.LITERATURE_INTEGRATION_TEST === '1'
const describeIntegration = integrationEnabled ? describe : describe.skip

interface SearchResultRow {
  pmid: string
  abstract_snippet: string | null
  confirmed_topics: Array<{ id: string }>
  suggested_topics: Array<{ id: string }>
  matched_by: string[]
  rank_score: number
  relevance_state: string
  visibility_state: string
  total_count: number | string
}

function requiredEnvironment(name: string, fallback?: string) {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined)
  if (!value) {
    throw new Error(`${name} is required for the literature integration test.`)
  }
  return value
}

function assertLocalUrl(value: string) {
  const hostname = new URL(value).hostname
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostname)) {
    throw new Error(`Refusing to run literature integration tests against ${hostname}.`)
  }
}

async function runLiteratureCommand(script: string, arguments_: string[]) {
  await execFileAsync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', script, '--', ...arguments_],
    {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
    },
  )
}

describeIntegration('literature database integration', () => {
  let serviceClient: SupabaseClient
  let anonymousClient: SupabaseClient

  beforeAll(() => {
    const url = requiredEnvironment('LITERATURE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = requiredEnvironment(
      'LITERATURE_SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    )
    const anonymousKey = requiredEnvironment('LITERATURE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY')
    assertLocalUrl(url)

    const options = (storageKey: string) => ({
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey,
      },
    })
    serviceClient = createClient(url, serviceRoleKey, options('literature-integration-service'))
    anonymousClient = createClient(url, anonymousKey, options('literature-integration-anonymous'))
  })

  it('proves import, provenance, curation, RLS, and lexical-search invariants', async () => {
    await runLiteratureCommand('literature:seed-taxonomy', ['--commit', '--target', 'local'])

    await runLiteratureCommand('literature:import', [
      '--file',
      'tests/fixtures/literature/complex.nbib',
      '--limit',
      '1',
      '--commit',
      '--target',
      'local',
    ])

    for (const fixture of ['simple.nbib', 'complex.nbib', 'duplicate-a.nbib', 'duplicate-b.nbib']) {
      await runLiteratureCommand('literature:import', [
        '--file',
        `tests/fixtures/literature/${fixture}`,
        '--commit',
        '--target',
        'local',
      ])
    }

    const initialArticleCount = await serviceClient
      .from('literature_articles')
      .select('*', { count: 'exact', head: true })
    const initialSimpleSources = await serviceClient
      .from('literature_article_sources')
      .select('*', { count: 'exact', head: true })
      .eq('pmid', '12345678')
    expect(initialArticleCount.error).toBeNull()
    expect(initialSimpleSources.error).toBeNull()

    await runLiteratureCommand('literature:import', [
      '--file',
      'tests/fixtures/literature/simple.nbib',
      '--commit',
      '--target',
      'local',
    ])

    const repeatedArticleCount = await serviceClient
      .from('literature_articles')
      .select('*', { count: 'exact', head: true })
    const repeatedSimpleSources = await serviceClient
      .from('literature_article_sources')
      .select('*', { count: 'exact', head: true })
      .eq('pmid', '12345678')
    expect(repeatedArticleCount.count).toBe(initialArticleCount.count)
    expect(repeatedSimpleSources.count).toBe(initialSimpleSources.count)

    const simpleBatches = await serviceClient
      .from('literature_import_batches')
      .select('*', { count: 'exact', head: true })
      .eq('source_filename', 'simple.nbib')
      .eq('status', 'completed')
      .is('record_limit', null)
    expect(simpleBatches.error).toBeNull()
    expect(simpleBatches.count).toBe(1)

    const complexBatches = await serviceClient
      .from('literature_import_batches')
      .select('record_limit')
      .eq('source_filename', 'complex.nbib')
      .eq('status', 'completed')
      .order('record_limit', { ascending: true, nullsFirst: false })
    expect(complexBatches.error).toBeNull()
    expect(complexBatches.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ record_limit: 1 }),
        expect.objectContaining({ record_limit: null }),
      ]),
    )
    const complexArticles = await serviceClient
      .from('literature_articles')
      .select('pmid')
      .in('pmid', ['23456789', '34567890'])
    expect(complexArticles.error).toBeNull()
    expect(complexArticles.data?.map((article) => article.pmid).sort()).toEqual([
      '23456789',
      '34567890',
    ])

    const duplicateArticle = await serviceClient
      .from('literature_articles')
      .select('title')
      .eq('pmid', '56789012')
      .single()
    const duplicateSources = await serviceClient
      .from('literature_article_sources')
      .select('*', { count: 'exact', head: true })
      .eq('pmid', '56789012')
    expect(duplicateArticle.error).toBeNull()
    expect(duplicateArticle.data?.title).toContain('refreshed metadata')
    expect(duplicateSources.error).toBeNull()
    expect(duplicateSources.count).toBe(2)

    await runLiteratureCommand('literature:suggest-topics', [
      '--state',
      'unreviewed',
      '--limit',
      '100',
      '--commit',
      '--target',
      'local',
    ])

    const simpleCuration = await serviceClient.rpc('curate_literature_article_v1', {
      p_pmid: '12345678',
      p_actor_user_id: null,
      p_actor_email: 'integration-test@interventionalpulm.invalid',
      p_relevance_state: 'included',
      p_visibility_state: 'published',
      p_is_landmark: true,
      p_topic_decisions: [
        {
          topicId: 'ebus-mediastinal-staging',
          state: 'confirmed',
        },
      ],
      p_reason: 'Local integration verification.',
    })
    expect(simpleCuration.error).toBeNull()

    const duplicateCuration = await serviceClient.rpc('curate_literature_article_v1', {
      p_pmid: '56789012',
      p_actor_user_id: null,
      p_actor_email: 'integration-test@interventionalpulm.invalid',
      p_relevance_state: 'included',
      p_visibility_state: 'published',
      p_is_landmark: true,
      p_topic_decisions: [],
      p_reason: 'Verify manual decisions survive refreshed metadata.',
    })
    expect(duplicateCuration.error).toBeNull()

    await runLiteratureCommand('literature:import', [
      '--file',
      'tests/fixtures/literature/duplicate-a.nbib',
      '--commit',
      '--target',
      'local',
      '--force',
    ])
    const afterOlderMetadata = await serviceClient
      .from('literature_articles')
      .select('title,relevance_state,visibility_state,is_landmark,manual_override')
      .eq('pmid', '56789012')
      .single()
    expect(afterOlderMetadata.error).toBeNull()
    expect(afterOlderMetadata.data).toMatchObject({
      title: 'Duplicate PMID fixture.',
      relevance_state: 'included',
      visibility_state: 'published',
      is_landmark: true,
      manual_override: true,
    })

    await runLiteratureCommand('literature:import', [
      '--file',
      'tests/fixtures/literature/duplicate-b.nbib',
      '--commit',
      '--target',
      'local',
      '--force',
    ])
    const afterRefreshedMetadata = await serviceClient
      .from('literature_articles')
      .select('title,relevance_state,visibility_state,is_landmark,manual_override')
      .eq('pmid', '56789012')
      .single()
    expect(afterRefreshedMetadata.error).toBeNull()
    expect(afterRefreshedMetadata.data).toMatchObject({
      title: 'Duplicate PMID fixture with refreshed metadata.',
      relevance_state: 'included',
      visibility_state: 'published',
      is_landmark: true,
      manual_override: true,
    })

    const complexBatch = await serviceClient
      .from('literature_import_batches')
      .select('id')
      .eq('source_filename', 'complex.nbib')
      .eq('status', 'completed')
      .is('record_limit', null)
      .single()
    expect(complexBatch.error).toBeNull()
    expect(complexBatch.data?.id).toBeTruthy()

    const importErrorCount = async () => {
      const result = await serviceClient
        .from('literature_import_errors')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', complexBatch.data?.id)
      expect(result.error).toBeNull()
      return result.count
    }
    const errorsBeforeReplay = await importErrorCount()
    await runLiteratureCommand('literature:import', [
      '--file',
      'tests/fixtures/literature/complex.nbib',
      '--commit',
      '--target',
      'local',
      '--force',
    ])
    const errorsAfterFirstReplay = await importErrorCount()
    await runLiteratureCommand('literature:import', [
      '--file',
      'tests/fixtures/literature/complex.nbib',
      '--commit',
      '--target',
      'local',
      '--force',
    ])
    expect(errorsBeforeReplay).toBeGreaterThan(0)
    expect(errorsAfterFirstReplay).toBe(errorsBeforeReplay)
    expect(await importErrorCount()).toBe(errorsBeforeReplay)

    const rankingFixtures = [
      {
        pmid: '999999990001',
        title: 'Xenonavigation bronchoscopic benchmark title signal.',
        abstract: 'A deliberately neutral comparison abstract.',
        publication_year: 2026,
        metadata_hash: 'a'.repeat(64),
        normalized_title: 'xenonavigation bronchoscopic benchmark title signal',
        normalized_title_hash: 'b'.repeat(64),
        relevance_state: 'included',
        visibility_state: 'published',
        manual_override: true,
      },
      {
        pmid: '999999990002',
        title: 'Abstract-only benchmark comparator.',
        abstract: 'This abstract evaluates xenonavigation as a bronchoscopic signal.',
        publication_year: 2025,
        metadata_hash: 'c'.repeat(64),
        normalized_title: 'abstract only benchmark comparator',
        normalized_title_hash: 'd'.repeat(64),
        relevance_state: 'included',
        visibility_state: 'published',
        manual_override: true,
      },
    ]
    const rankingInsert = await serviceClient
      .from('literature_articles')
      .upsert(rankingFixtures, { onConflict: 'pmid' })
    expect(rankingInsert.error).toBeNull()

    const search = async (
      overrides: Partial<{
        p_query: string
        p_journal_ids: string[]
        p_topic_ids: string[]
        p_year_from: number | null
        p_year_to: number | null
        p_publication_types: string[]
        p_landmark_only: boolean
        p_sort: string
        p_page: number
        p_page_size: number
        p_admin_preview: boolean
      }> = {},
    ) => {
      const result = await serviceClient.rpc('search_literature_v1', {
        p_query: '',
        p_journal_ids: [],
        p_topic_ids: [],
        p_year_from: null,
        p_year_to: null,
        p_publication_types: [],
        p_landmark_only: false,
        p_sort: 'relevance',
        p_page: 1,
        p_page_size: 20,
        p_admin_preview: false,
        ...overrides,
      })
      expect(result.error).toBeNull()
      return (result.data ?? []) as SearchResultRow[]
    }

    const publicDraftSearch = await search({
      p_query: 'deliberately wrapped',
    })
    const adminDraftSearch = await search({
      p_query: 'deliberately wrapped',
      p_admin_preview: true,
    })
    expect(publicDraftSearch).toHaveLength(0)
    expect(adminDraftSearch.map((row) => row.pmid)).toContain('23456789')

    const rankingResults = await search({
      p_query: 'xenonavigation',
    })
    expect(rankingResults.map((row) => row.pmid)).toEqual(['999999990001', '999999990002'])
    expect(rankingResults[0]?.rank_score).toBeGreaterThan(rankingResults[1]?.rank_score ?? 0)
    expect(rankingResults[0]?.matched_by).toContain('title')
    expect(rankingResults[1]?.matched_by).toContain('abstract')

    const firstPage = await search({
      p_query: 'xenonavigation',
      p_page_size: 1,
      p_page: 1,
    })
    const secondPage = await search({
      p_query: 'xenonavigation',
      p_page_size: 1,
      p_page: 2,
    })
    expect(firstPage[0]?.pmid).not.toBe(secondPage[0]?.pmid)
    expect(Number(firstPage[0]?.total_count)).toBe(2)
    expect(Number(secondPage[0]?.total_count)).toBe(2)

    const topicFiltered = await search({
      p_topic_ids: ['ebus-mediastinal-staging'],
    })
    const curatedSimple = topicFiltered.find((row) => row.pmid === '12345678')
    expect(curatedSimple).toBeDefined()
    expect(curatedSimple?.confirmed_topics).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'ebus-mediastinal-staging' })]),
    )
    expect(curatedSimple?.suggested_topics).toEqual([])
    expect(curatedSimple?.abstract_snippet?.length).toBeLessThanOrEqual(600)

    const curatedSimpleAdmin = await search({
      p_query: 'EBUS-TBNA',
      p_admin_preview: true,
    })
    expect(curatedSimpleAdmin.find((row) => row.pmid === '12345678')?.suggested_topics).toEqual([])

    const rejectedSuggestedTopic = await serviceClient.rpc('curate_literature_article_v1', {
      p_pmid: '23456789',
      p_actor_user_id: null,
      p_actor_email: 'integration-test@interventionalpulm.invalid',
      p_relevance_state: null,
      p_visibility_state: null,
      p_is_landmark: null,
      p_topic_decisions: [
        {
          topicId: 'peripheral-navigation.robotic-bronchoscopy',
          state: 'rejected',
        },
      ],
      p_reason: 'Verify human rejection suppresses rule suggestions.',
    })
    expect(rejectedSuggestedTopic.error).toBeNull()
    const rejectedTopicSearch = await search({
      p_topic_ids: ['peripheral-navigation.robotic-bronchoscopy'],
      p_admin_preview: true,
    })
    expect(rejectedTopicSearch.map((row) => row.pmid)).not.toContain('23456789')

    const journalFiltered = await search({
      p_journal_ids: ['chest'],
      p_admin_preview: true,
      p_page_size: 50,
    })
    expect(journalFiltered.map((row) => row.pmid)).toEqual(
      expect.arrayContaining(['12345678', '56789012']),
    )

    const invalidPublish = await serviceClient.rpc('curate_literature_article_v1', {
      p_pmid: '34567890',
      p_actor_user_id: null,
      p_actor_email: 'integration-test@interventionalpulm.invalid',
      p_relevance_state: 'unreviewed',
      p_visibility_state: 'published',
      p_is_landmark: false,
      p_topic_decisions: [],
      p_reason: 'This transaction must fail.',
    })
    expect(invalidPublish.error).not.toBeNull()

    const auditEvent = await serviceClient
      .from('literature_curation_events')
      .select('id')
      .eq('pmid', '56789012')
      .limit(1)
      .single()
    expect(auditEvent.error).toBeNull()
    const auditMutation = await serviceClient
      .from('literature_curation_events')
      .update({ reason: 'tamper attempt' })
      .eq('id', auditEvent.data?.id)
    expect(auditMutation.error).not.toBeNull()

    const stats = await serviceClient.rpc('literature_admin_stats_v1')
    expect(stats.error).toBeNull()
    expect(stats.data).toEqual(
      expect.objectContaining({
        total_articles: expect.any(Number),
        relevance_counts: expect.any(Object),
        visibility_counts: expect.any(Object),
        last_successful_import: expect.any(Object),
      }),
    )

    const anonymousTableRead = await anonymousClient
      .from('literature_articles')
      .select('pmid')
      .limit(1)
    expect(anonymousTableRead.error).not.toBeNull()
    const anonymousSearch = await anonymousClient.rpc('search_literature_v1', {
      p_query: '',
      p_journal_ids: [],
      p_topic_ids: [],
      p_year_from: null,
      p_year_to: null,
      p_publication_types: [],
      p_landmark_only: false,
      p_sort: 'relevance',
      p_page: 1,
      p_page_size: 20,
      p_admin_preview: false,
    })
    expect(anonymousSearch.error).not.toBeNull()
  }, 120_000)

  it('enforces the one-way audited gold-standard test unlock', async () => {
    const developmentPmid = '999999990101'
    const testPmid = '999999990102'
    const preUnlockedInsert = await serviceClient.from('literature_gold_set_batches').insert({
      name: `integration-preunlocked-${Date.now()}`,
      kind: 'gold_standard',
      taxonomy_version: 'integration',
      label_schema_version: 'integration',
      relevance_definition_version: 'integration',
      sampling_algorithm_version: 'integration',
      sampling_seed: 2,
      requested_size: 2,
      test_percent: 50,
      sampling_report: {},
      test_unlocked_at: new Date().toISOString(),
      test_unlocked_by_email: 'integration-test@interventionalpulm.invalid',
      test_unlock_reason: 'Attempt to bypass the audited unlock.',
    })
    expect(preUnlockedInsert.error?.message).toMatch(/must begin with the test lock intact/u)

    const articleInsert = await serviceClient.from('literature_articles').upsert([
      {
        pmid: developmentPmid,
        title: 'Gold lock development fixture.',
        abstract: 'Development review fixture.',
        publication_year: 2026,
        metadata_hash: 'e'.repeat(64),
        normalized_title: 'gold lock development fixture',
        normalized_title_hash: 'f'.repeat(64),
      },
      {
        pmid: testPmid,
        title: 'Gold lock held-out fixture.',
        abstract: 'Held-out review fixture.',
        publication_year: 2026,
        metadata_hash: '1'.repeat(64),
        normalized_title: 'gold lock held out fixture',
        normalized_title_hash: '2'.repeat(64),
      },
    ])
    expect(articleInsert.error).toBeNull()

    const name = `integration-gold-${Date.now()}`
    const created = await serviceClient.rpc('create_literature_gold_set_batch_v1', {
      p_batch: {
        name,
        kind: 'gold_standard',
        taxonomyVersion: 'integration',
        labelSchemaVersion: 'integration',
        relevanceDefinitionVersion: 'integration',
        samplingAlgorithmVersion: 'integration',
        samplingSeed: 1,
        requestedSize: 2,
        testPercent: 50,
        samplingReport: {},
      },
      p_items: [
        {
          pmid: developmentPmid,
          sampleStratum: 'ambiguous_boundary',
          samplingReason: 'integration development fixture',
          samplingMetadata: {},
          datasetSplit: 'development',
          displayOrder: 1,
        },
        {
          pmid: testPmid,
          sampleStratum: 'ambiguous_boundary',
          samplingReason: 'integration test fixture',
          samplingMetadata: {},
          datasetSplit: 'test',
          displayOrder: 2,
        },
      ],
      p_actor_user_id: null,
      p_actor_email: 'integration-test@interventionalpulm.invalid',
    })
    expect(created.error).toBeNull()
    const batchId = String((created.data as { id?: unknown } | null)?.id)

    const items = await serviceClient
      .from('literature_gold_set_items')
      .select('id,pmid')
      .eq('batch_id', batchId)
    expect(items.error).toBeNull()
    const developmentItemId = String(items.data?.find((item) => item.pmid === developmentPmid)?.id)
    const testItemId = String(items.data?.find((item) => item.pmid === testPmid)?.id)

    const lockedRead = await serviceClient.rpc('get_literature_gold_review_item_v2', {
      p_batch_id: batchId,
      p_item_id: testItemId,
      p_status: 'all',
      p_split: 'development',
    })
    expect(lockedRead.error?.message).toMatch(/test split is locked/u)

    const retiredReader = await serviceClient.rpc('get_literature_gold_review_item_v1', {
      p_batch_id: batchId,
      p_item_id: testItemId,
      p_status: 'all',
      p_split: 'test',
    })
    expect(retiredReader.error).not.toBeNull()

    const splitEscape = await serviceClient
      .from('literature_gold_set_items')
      .update({ dataset_split: 'development' })
      .eq('id', testItemId)
    expect(splitEscape.error?.message).toMatch(/composition is immutable/u)

    const kindEscape = await serviceClient
      .from('literature_gold_set_batches')
      .update({ kind: 'pilot' })
      .eq('id', batchId)
    expect(kindEscape.error?.message).toMatch(/cannot change kind/u)

    const forgedUnlockEvent = await serviceClient.from('literature_gold_set_events').insert({
      batch_id: batchId,
      actor_email: 'integration-test@interventionalpulm.invalid',
      event_type: 'test_split_unlocked',
      after_value: {
        unlockedAt: new Date().toISOString(),
        reason: 'Forged event while the batch is still locked.',
        testItemCount: 1,
      },
    })
    expect(forgedUnlockEvent.error?.message).toMatch(/must match the audited batch transition/u)

    const prematureUnlock = await serviceClient.rpc('unlock_literature_gold_test_split_v1', {
      p_batch_id: batchId,
      p_actor_user_id: null,
      p_actor_email: 'integration-test@interventionalpulm.invalid',
      p_reason: 'Premature integration unlock attempt.',
    })
    expect(prematureUnlock.error?.message).toMatch(/complete the development split/u)

    const completed = await serviceClient.rpc('save_literature_gold_review_v1', {
      p_item_id: developmentItemId,
      p_actor_user_id: null,
      p_actor_email: 'integration-test@interventionalpulm.invalid',
      p_review: {
        relevanceLabel: 'exclude',
        metadataSufficiency: 'adequate_abstract',
        reviewerConfidence: 'high',
        topicIds: [],
        technologyTags: [],
        clinicalPurposes: [],
        diseaseTags: [],
        studyDesign: null,
        publicationStatus: null,
        categorizationFromFullText: false,
        notes: '',
        usedSupplementalMetadata: false,
        reviewSeconds: 1,
      },
      p_complete: true,
    })
    expect(completed.error).toBeNull()

    const unlocked = await serviceClient.rpc('unlock_literature_gold_test_split_v1', {
      p_batch_id: batchId,
      p_actor_user_id: null,
      p_actor_email: 'integration-test@interventionalpulm.invalid',
      p_reason: 'Development fixture completed; open final evaluation.',
    })
    expect(unlocked.error).toBeNull()

    const unlockedRead = await serviceClient.rpc('get_literature_gold_review_item_v2', {
      p_batch_id: batchId,
      p_item_id: testItemId,
      p_status: 'all',
      p_split: 'test',
    })
    expect(unlockedRead.error).toBeNull()
    expect((unlockedRead.data as { article?: { pmid?: string } } | null)?.article?.pmid).toBe(
      testPmid,
    )

    const auditTamper = await serviceClient
      .from('literature_gold_set_batches')
      .update({ test_unlock_reason: 'Changed after unlock.' })
      .eq('id', batchId)
    expect(auditTamper.error?.message).toMatch(/unlock is immutable/u)

    const auditEvents = await serviceClient
      .from('literature_gold_set_events')
      .select('id,after_value')
      .eq('batch_id', batchId)
      .eq('event_type', 'test_split_unlocked')
    expect(auditEvents.error).toBeNull()
    expect(auditEvents.data).toHaveLength(1)
    expect(auditEvents.data?.[0]?.after_value).toEqual(
      expect.objectContaining({
        reason: 'Development fixture completed; open final evaluation.',
        testItemCount: 1,
      }),
    )
  }, 30_000)
})
