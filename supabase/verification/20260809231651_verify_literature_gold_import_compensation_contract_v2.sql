\set ON_ERROR_STOP on

-- Synthetic, disposable verification for the forward-only V2 contract.  This
-- file never selects held-out identities and rolls back every fixture.
begin;
set local client_min_messages = notice;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if coalesce(p_condition, false) is not true then
    raise exception 'FAIL: %', p_message;
  end if;
end;
$$;

do $$
declare
  rpc regprocedure;
  rpc_name text;
begin
  perform pg_temp.assert_true(
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'literature_gold_set_reviews'
        and column_name = 'full_text_used'
        and data_type = 'boolean'
        and is_nullable = 'YES'
    ), 'full_text_used is not a nullable boolean persistence target'
  );
  perform pg_temp.assert_true(
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'literature_gold_set_reviews'
        and column_name = 'operation_contract_version'
        and is_generated = 'ALWAYS'
    ), 'review operation contract version is not generated/immutable'
  );
  perform pg_temp.assert_true(
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'literature_gold_review_operations'
        and column_name = 'contract_version'
        and is_nullable = 'NO'
    ), 'operation contract version is not explicit and non-null'
  );

  foreach rpc in array array[
    'public.apply_literature_gold_import_v2(uuid,text,uuid,text,text,jsonb,text,jsonb,uuid,text)'::regprocedure,
    'public.compensate_literature_gold_import_v2(uuid,uuid,text,uuid,text,text,jsonb,text,jsonb,uuid,text)'::regprocedure,
    'public.reconcile_literature_gold_review_operation_v2(uuid,text,jsonb)'::regprocedure
  ] loop
    select p.proname into rpc_name from pg_proc p where p.oid = rpc;
    perform pg_temp.assert_true(
      not exists (
        select 1
        from pg_proc p
        cross join lateral aclexplode(
          coalesce(p.proacl, acldefault('f', p.proowner))
        ) acl
        where p.oid = rpc and acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
        and not has_function_privilege('anon', rpc, 'EXECUTE')
        and not has_function_privilege('authenticated', rpc, 'EXECUTE')
        and has_function_privilege('service_role', rpc, 'EXECUTE'),
      rpc_name || ' does not have the exact service_role-only transition ACL'
    );
    perform pg_temp.assert_true(
      (select p.prosecdef from pg_proc p where p.oid = rpc),
      rpc_name || ' is not SECURITY DEFINER'
    );
    perform pg_temp.assert_true(
      (select p.proconfig = array['search_path=pg_catalog, public, extensions']
       from pg_proc p where p.oid = rpc),
      rpc_name || ' does not pin the exact safe search_path'
    );
    perform pg_temp.assert_true(
      (select pg_get_userbyid(p.proowner) in ('postgres', 'supabase_admin')
       from pg_proc p where p.oid = rpc),
      rpc_name || ' has an unsupported owner profile'
    );
  end loop;

  perform pg_temp.assert_true(
    not has_table_privilege('service_role',
      'public.literature_gold_review_operations', 'INSERT')
      and not has_table_privilege('service_role',
        'public.literature_gold_review_operations', 'UPDATE')
      and not has_table_privilege('service_role',
        'public.literature_gold_review_operation_actions', 'INSERT')
      and not has_table_privilege('service_role',
        'public.literature_gold_review_operation_actions', 'UPDATE'),
    'service_role can fabricate V2 journal rows directly'
  );
  perform pg_temp.assert_true(
    position('automated_signals_revealed_at' in pg_get_functiondef(
      'public.validate_literature_gold_import_review_payload_v2(uuid,jsonb,boolean)'::regprocedure
    )) > 0
      and position('is distinct from\n    (selected_item.automated_signals_revealed_at' in pg_get_functiondef(
        'public.validate_literature_gold_import_review_payload_v2(uuid,jsonb,boolean)'::regprocedure
      )) = 0,
    'V2 validator still couples source blinding to local automated reveal state'
  );
  raise notice 'OK  V2 columns, owners, ACLs, RLS boundary, and safe search paths are present';
end;
$$;

create temporary table v2_calls (
  operation_id uuid primary key,
  operation_kind text not null,
  target_import_operation_id uuid,
  idempotency_key text not null,
  batch_id uuid not null,
  artifact_sha256 text not null,
  plan_sha256 text not null,
  plan jsonb not null,
  authorization_sha256 text not null,
  authorization_payload jsonb not null,
  result jsonb not null
) on commit preserve rows;

create temporary table v2_evidence (
  key text primary key,
  value jsonb not null
) on commit preserve rows;

create or replace function pg_temp.item_state(p_item_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'reviewStatus', item.review_status,
    'startedAt', item.started_at,
    'completedAt', item.completed_at,
    'supplementalMetadataRevealedAt', item.supplemental_metadata_revealed_at,
    'automatedSignalsRevealedAt', item.automated_signals_revealed_at
  )
  from public.literature_gold_set_items item where item.id = p_item_id;
$$;

create or replace function pg_temp.v2_review(
  p_note text,
  p_full_text_used boolean,
  p_started_at timestamptz,
  p_completed_at timestamptz
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'reviewerUserId', null,
    'reviewerEmail', 'synthetic-v2@example.invalid',
    'relevanceLabel', 'include_core',
    'metadataSufficiency', 'adequate_abstract',
    'reviewerConfidence', 'high',
    'topicIds', jsonb_build_array('basic-bronchoscopy'),
    'technologyTags', '[]'::jsonb,
    'technologyTagStatus', 'not_applicable',
    'clinicalPurposes', jsonb_build_array('diagnosis'),
    'diseaseTags', '[]'::jsonb,
    'diseaseTagStatus', 'not_applicable',
    'studyDesign', 'review-article',
    'publicationStatus', 'full-article',
    'categorizationFromFullText', false,
    'fullTextUsed', p_full_text_used,
    'notes', p_note,
    'usedSupplementalMetadata', false,
    'reviewSeconds', 19,
    'isBlinded', false,
    'startedAt', p_started_at,
    'completedAt', p_completed_at,
    'createdAt', p_completed_at,
    'taxonomyVersion', '2.0.0',
    'labelSchemaVersion', '2.0.0',
    'enrichmentSchemaVersion', '2.0.0',
    'enrichmentProvenance', 'synthetic-v2-disposable'
  );
$$;

create or replace function pg_temp.v2_excluded_review()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'reviewerUserId', null,
    'reviewerEmail', 'synthetic-v2@example.invalid',
    'relevanceLabel', 'exclude',
    'metadataSufficiency', 'adequate_abstract',
    'reviewerConfidence', 'high',
    'topicIds', '[]'::jsonb,
    'technologyTags', '[]'::jsonb,
    'technologyTagStatus', null,
    'clinicalPurposes', '[]'::jsonb,
    'diseaseTags', '[]'::jsonb,
    'diseaseTagStatus', null,
    'studyDesign', null,
    'publicationStatus', null,
    'categorizationFromFullText', false,
    'fullTextUsed', false,
    'notes', 'synthetic source-authoritative null statuses',
    'usedSupplementalMetadata', false,
    'reviewSeconds', 7,
    'isBlinded', false,
    'startedAt', '2032-01-01T00:00:00Z',
    'completedAt', '2032-01-01T00:01:00Z',
    'createdAt', '2032-01-01T00:01:00Z',
    'taxonomyVersion', '2.0.0',
    'labelSchemaVersion', '2.0.0',
    'enrichmentSchemaVersion', '2.0.0',
    'enrichmentProvenance', 'synthetic-v2-disposable'
  );
$$;

create or replace function pg_temp.expected_effective_hash_v2(
  p_batch_id uuid,
  p_item_id uuid,
  p_review jsonb
)
returns text
language plpgsql
stable
as $$
declare
  projection jsonb;
  clinical jsonb;
begin
  clinical := jsonb_build_object(
    'relevanceLabel', p_review -> 'relevanceLabel',
    'metadataSufficiency', p_review -> 'metadataSufficiency',
    'reviewerConfidence', p_review -> 'reviewerConfidence',
    'topicIds', p_review -> 'topicIds',
    'technologyTags', p_review -> 'technologyTags',
    'technologyTagStatus', p_review -> 'technologyTagStatus',
    'clinicalPurposes', p_review -> 'clinicalPurposes',
    'diseaseTags', p_review -> 'diseaseTags',
    'diseaseTagStatus', p_review -> 'diseaseTagStatus',
    'studyDesign', p_review -> 'studyDesign',
    'publicationStatus', p_review -> 'publicationStatus',
    'categorizationFromFullText', p_review -> 'categorizationFromFullText',
    'fullTextUsed', p_review -> 'fullTextUsed',
    'notes', p_review -> 'notes',
    'usedSupplementalMetadata', p_review -> 'usedSupplementalMetadata',
    'reviewSeconds', p_review -> 'reviewSeconds',
    'taxonomyVersion', p_review -> 'taxonomyVersion',
    'labelSchemaVersion', p_review -> 'labelSchemaVersion',
    'enrichmentSchemaVersion', p_review -> 'enrichmentSchemaVersion',
    'enrichmentProvenance', p_review -> 'enrichmentProvenance',
    'isBlinded', p_review -> 'isBlinded',
    'operationContractVersion', 'gold-review-import-compensation/2.0.0'
  );
  select jsonb_build_object(
    'projectionVersion', 'literature-gold-effective-state-v2',
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'datasetSplit', 'development',
    'items', jsonb_agg(jsonb_build_object(
      'pmid', item.pmid,
      'reviewStatus', case when item.id = p_item_id then 'completed'
        else item.review_status end,
      'review', case when item.id = p_item_id then clinical else null end
    ) order by item.pmid::numeric, item.id)
  ) into projection
  from public.literature_gold_set_items item
  where item.batch_id = p_batch_id and item.dataset_split = 'development';
  return public.literature_gold_jsonb_sha256_v1(projection);
end;
$$;

create or replace function pg_temp.run_import_v2(
  p_operation_id uuid,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_actions jsonb,
  p_expected_post_effective text,
  p_fault_after_action integer default null
)
returns jsonb
language plpgsql
as $$
declare
  initial_count integer;
  revision_count integer;
  noop_count integer;
  pre_physical text;
  pre_effective text;
  plan_content jsonb;
  plan_sha text;
  operation_key text;
  plan_payload jsonb;
  auth_content jsonb;
  auth_sha text;
  auth_payload jsonb;
  result jsonb;
begin
  select count(*) filter (where value ->> 'action' = 'import_initial')::integer,
    count(*) filter (where value ->> 'action' = 'import_revision')::integer,
    count(*) filter (where value ->> 'action' = 'import_noop')::integer
  into initial_count, revision_count, noop_count
  from jsonb_array_elements(p_actions);
  pre_physical := public.literature_gold_physical_state_hash_v2(p_batch_id, 'development');
  pre_effective := public.literature_gold_effective_state_hash_v2(p_batch_id, 'development');
  plan_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'kind', 'import', 'operationId', p_operation_id, 'batchId', p_batch_id,
    'sourceArtifactSha256', p_artifact_sha256,
    'sourceAuthorizationSetSha256', repeat('1', 64),
    'noteDispositionAuditSha256', repeat('2', 64),
    'booleanNormalizationLedgerSha256', repeat('3', 64),
    'orderedSetNormalizationLedgerSha256', repeat('4', 64),
    'expectedPhysicalStateSha256', pre_physical,
    'expectedEffectiveStateSha256', pre_effective,
    'expectedPostEffectiveStateSha256', p_expected_post_effective,
    'executionContext', jsonb_build_object(
      'targetDatabase', 'local', 'remoteWritesAllowed', false,
      'repositoryCommitSha', repeat('a', 40),
      'migrationId', '20260809231651_add_literature_gold_import_compensation_contract_v2',
      'importRpc', 'apply_literature_gold_import_v2',
      'compensationRpc', 'compensate_literature_gold_import_v2',
      'reconciliationRpc', 'reconcile_literature_gold_review_operation_v2',
      'developmentMembershipHash', 'literature_gold_development_membership_hash_v1',
      'physicalStateHash', 'literature_gold_physical_state_hash_v2',
      'effectiveStateHash', 'literature_gold_effective_state_hash_v2'
    ),
    'scope', jsonb_build_object(
      'datasetSplit', 'development', 'heldOutIdentitiesAccessed', false,
      'developmentMembershipSha256',
        public.literature_gold_development_membership_hash_v1(p_batch_id)
    ),
    'counts', jsonb_build_object(
      'total', jsonb_array_length(p_actions), 'initial', initial_count,
      'revisions', revision_count, 'noops', noop_count,
      'inserts', initial_count + revision_count
    ), 'actions', p_actions
  ) || case when p_fault_after_action is null then '{}'::jsonb
    else jsonb_build_object('faultAfterAction', p_fault_after_action) end;
  plan_sha := public.literature_gold_jsonb_sha256_v1(plan_content);
  operation_key := public.literature_gold_jsonb_sha256_v1(jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'kind', 'import', 'operationId', p_operation_id, 'contentSha256', plan_sha
  ));
  plan_payload := plan_content || jsonb_build_object('binding', jsonb_build_object(
    'contentSha256', plan_sha, 'idempotencyKey', operation_key
  ));
  auth_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'kind', 'import_authorization', 'authorizationId', p_operation_id,
    'authorized', true, 'authorizedBy', 'synthetic-v2@example.invalid',
    'authorizedAt', '2032-02-01T00:00:00Z',
    'authorizationNote', 'Disposable synthetic V2 import authorization.',
    'targetDatabase', 'local', 'remoteWritesAllowed', false,
    'repositoryCommitSha', repeat('a', 40),
    'migrationId', '20260809231651_add_literature_gold_import_compensation_contract_v2',
    'operationId', p_operation_id, 'batchId', p_batch_id,
    'planSha256', plan_sha, 'idempotencyKey', operation_key,
    'sourceArtifactSha256', p_artifact_sha256,
    'sourceAuthorizationSetSha256', repeat('1', 64),
    'noteDispositionAuditSha256', repeat('2', 64),
    'booleanNormalizationLedgerSha256', repeat('3', 64),
    'orderedSetNormalizationLedgerSha256', repeat('4', 64),
    'expectedPhysicalStateSha256', pre_physical,
    'expectedEffectiveStateSha256', pre_effective,
    'expectedPostEffectiveStateSha256', p_expected_post_effective
  );
  auth_sha := public.literature_gold_jsonb_sha256_v1(auth_content);
  auth_payload := auth_content || jsonb_build_object(
    'binding', jsonb_build_object('contentSha256', auth_sha)
  );
  result := public.apply_literature_gold_import_v2(
    p_operation_id, operation_key, p_batch_id, p_artifact_sha256,
    plan_sha, plan_payload, auth_sha, auth_payload, null,
    'synthetic-v2@example.invalid'
  );
  insert into v2_calls values (
    p_operation_id, 'import', null, operation_key, p_batch_id,
    p_artifact_sha256, plan_sha, plan_payload, auth_sha, auth_payload, result
  );
  return result;
end;
$$;

create or replace function pg_temp.run_compensation_v2(
  p_operation_id uuid,
  p_target_import_operation_id uuid,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_actions jsonb,
  p_expected_post_effective text
)
returns jsonb
language plpgsql
as $$
declare
  pre_physical text;
  pre_effective text;
  import_plan_sha text;
  import_receipt_sha text;
  restore_count integer;
  void_count integer;
  noop_count integer;
  plan_content jsonb;
  plan_sha text;
  operation_key text;
  plan_payload jsonb;
  auth_content jsonb;
  auth_sha text;
  auth_payload jsonb;
  result jsonb;
begin
  select operation.plan_sha256,
    public.literature_gold_review_operation_receipt_v2(operation.id, false)
      #>> '{binding,contentSha256}'
  into import_plan_sha, import_receipt_sha
  from public.literature_gold_review_operations operation
  where operation.id = p_target_import_operation_id;
  select count(*) filter (where value ->> 'action' = 'compensate_restore')::integer,
    count(*) filter (where value ->> 'action' = 'compensate_void')::integer,
    count(*) filter (where value ->> 'action' = 'compensate_noop')::integer
  into restore_count, void_count, noop_count
  from jsonb_array_elements(p_actions);
  pre_physical := public.literature_gold_physical_state_hash_v2(p_batch_id, 'development');
  pre_effective := public.literature_gold_effective_state_hash_v2(p_batch_id, 'development');
  plan_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'kind', 'compensation', 'operationId', p_operation_id,
    'targetImportOperationId', p_target_import_operation_id,
    'batchId', p_batch_id, 'importPlanSha256', import_plan_sha,
    'importReceiptSha256', import_receipt_sha,
    'sourceArtifactSha256', p_artifact_sha256,
    'sourceAuthorizationSetSha256', repeat('1', 64),
    'noteDispositionAuditSha256', repeat('2', 64),
    'booleanNormalizationLedgerSha256', repeat('3', 64),
    'orderedSetNormalizationLedgerSha256', repeat('4', 64),
    'expectedPhysicalStateSha256', pre_physical,
    'expectedEffectiveStateSha256', pre_effective,
    'expectedPostEffectiveStateSha256', p_expected_post_effective,
    'executionContext', jsonb_build_object(
      'targetDatabase', 'local', 'remoteWritesAllowed', false,
      'repositoryCommitSha', repeat('a', 40),
      'migrationId', '20260809231651_add_literature_gold_import_compensation_contract_v2',
      'importRpc', 'apply_literature_gold_import_v2',
      'compensationRpc', 'compensate_literature_gold_import_v2',
      'reconciliationRpc', 'reconcile_literature_gold_review_operation_v2',
      'developmentMembershipHash', 'literature_gold_development_membership_hash_v1',
      'physicalStateHash', 'literature_gold_physical_state_hash_v2',
      'effectiveStateHash', 'literature_gold_effective_state_hash_v2'
    ),
    'scope', jsonb_build_object(
      'datasetSplit', 'development', 'heldOutIdentitiesAccessed', false,
      'developmentMembershipSha256',
        public.literature_gold_development_membership_hash_v1(p_batch_id)
    ),
    'counts', jsonb_build_object(
      'total', jsonb_array_length(p_actions), 'restored', restore_count,
      'voided', void_count, 'noops', noop_count
    ), 'actions', p_actions
  );
  plan_sha := public.literature_gold_jsonb_sha256_v1(plan_content);
  operation_key := public.literature_gold_jsonb_sha256_v1(jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'kind', 'compensation', 'operationId', p_operation_id,
    'contentSha256', plan_sha
  ));
  plan_payload := plan_content || jsonb_build_object('binding', jsonb_build_object(
    'contentSha256', plan_sha, 'idempotencyKey', operation_key
  ));
  auth_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'kind', 'compensation_authorization', 'authorizationId', p_operation_id,
    'authorized', true, 'authorizedBy', 'synthetic-v2@example.invalid',
    'authorizedAt', '2032-02-01T00:00:00Z',
    'authorizationNote', 'Disposable synthetic V2 compensation authorization.',
    'targetDatabase', 'local', 'remoteWritesAllowed', false,
    'repositoryCommitSha', repeat('a', 40),
    'migrationId', '20260809231651_add_literature_gold_import_compensation_contract_v2',
    'operationId', p_operation_id,
    'targetImportOperationId', p_target_import_operation_id,
    'batchId', p_batch_id, 'planSha256', plan_sha,
    'idempotencyKey', operation_key, 'importReceiptSha256', import_receipt_sha,
    'sourceArtifactSha256', p_artifact_sha256,
    'sourceAuthorizationSetSha256', repeat('1', 64),
    'noteDispositionAuditSha256', repeat('2', 64),
    'booleanNormalizationLedgerSha256', repeat('3', 64),
    'orderedSetNormalizationLedgerSha256', repeat('4', 64),
    'expectedPhysicalStateSha256', pre_physical,
    'expectedEffectiveStateSha256', pre_effective,
    'expectedPostEffectiveStateSha256', p_expected_post_effective
  );
  auth_sha := public.literature_gold_jsonb_sha256_v1(auth_content);
  auth_payload := auth_content || jsonb_build_object(
    'binding', jsonb_build_object('contentSha256', auth_sha)
  );
  result := public.compensate_literature_gold_import_v2(
    p_operation_id, p_target_import_operation_id, operation_key, p_batch_id,
    p_artifact_sha256, plan_sha, plan_payload, auth_sha, auth_payload,
    null, 'synthetic-v2@example.invalid'
  );
  insert into v2_calls values (
    p_operation_id, 'compensation', p_target_import_operation_id,
    operation_key, p_batch_id, p_artifact_sha256, plan_sha, plan_payload,
    auth_sha, auth_payload, result
  );
  return result;
end;
$$;

create or replace function pg_temp.run_deterministic_cycle_v2()
returns jsonb
language plpgsql
as $$
declare
  item_id constant uuid := 'ad000000-0000-4000-8000-000000000001';
  batch_id constant uuid := 'bd000000-0000-4000-8000-000000000001';
  import_id constant uuid := 'fd000000-0000-4000-8000-000000000001';
  import_action_id constant uuid := 'cd000000-0000-4000-8000-000000000001';
  import_review_id constant uuid := 'dd000000-0000-4000-8000-000000000001';
  compensation_id constant uuid := 'fd000000-0000-4000-8000-000000000002';
  compensation_action_id constant uuid := 'cd000000-0000-4000-8000-000000000002';
  compensation_review_id constant uuid := 'dd000000-0000-4000-8000-000000000002';
  artifact_sha constant text := repeat('6', 64);
  baseline_effective text;
  expected_import_effective text;
  review_payload jsonb;
  import_actions jsonb;
  compensation_actions jsonb;
  import_result jsonb;
  compensation_result jsonb;
begin
  baseline_effective := public.literature_gold_effective_state_hash_v2(
    batch_id, 'development'
  );
  review_payload := pg_temp.v2_review(
    'deterministic V2 audit projection', true,
    '2032-06-01T00:00:00Z', '2032-06-01T00:01:00Z'
  );
  expected_import_effective := pg_temp.expected_effective_hash_v2(
    batch_id, item_id, review_payload
  );
  import_actions := jsonb_build_array(jsonb_build_object(
    'actionId', import_action_id, 'sequence', 1, 'itemId', item_id,
    'pmid', '991200004', 'datasetSplit', 'development',
    'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
    'preImportItemState', pg_temp.item_state(item_id),
    'action', 'import_initial', 'expectedRevision', 1,
    'expectedSupersedesReviewId', null, 'importedReviewId', import_review_id,
    'expectedHeadReviewIdAfter', import_review_id,
    'expectedEffectiveReviewIdAfter', import_review_id,
    'review', review_payload,
    'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_payload),
    'compensationAction', 'compensate_void',
    'expectedEventSequence', jsonb_build_array('review_imported')
  ));
  import_result := pg_temp.run_import_v2(
    import_id, batch_id, artifact_sha, import_actions, expected_import_effective
  );
  compensation_actions := jsonb_build_array(jsonb_build_object(
    'actionId', compensation_action_id, 'sourceActionId', import_action_id,
    'sequence', 1, 'itemId', item_id, 'pmid', '991200004',
    'datasetSplit', 'development', 'importedReviewId', import_review_id,
    'expectedCurrentReviewId', import_review_id,
    'expectedEffectiveReviewId', import_review_id,
    'action', 'compensate_void', 'expectedRevision', 2,
    'expectedSupersedesReviewId', import_review_id,
    'compensationReviewId', compensation_review_id,
    'effectiveSourceReviewId', null,
    'expectedHeadReviewIdAfter', compensation_review_id,
    'expectedEffectiveReviewIdAfter', null,
    'expectedEventSequence', jsonb_build_array('review_voided')
  ));
  compensation_result := pg_temp.run_compensation_v2(
    compensation_id, import_id, batch_id, artifact_sha,
    compensation_actions, baseline_effective
  );
  return jsonb_build_object(
    'importReceipt', import_result,
    'compensationReceipt', compensation_result,
    'finalPhysicalStateSha256',
      public.literature_gold_physical_state_hash_v2(batch_id, 'development'),
    'finalEffectiveStateSha256',
      public.literature_gold_effective_state_hash_v2(batch_id, 'development'),
    'importOperationStartedAt', (select operation.started_at
      from public.literature_gold_review_operations operation
      where operation.id = import_id),
    'compensationReviewCreatedAt', (select review.created_at
      from public.literature_gold_set_reviews review
      where review.id = compensation_review_id)
  );
end;
$$;

insert into public.literature_articles (
  pmid, title, metadata_hash, normalized_title, normalized_title_hash
) values
  ('991200001', 'Synthetic V2 import article', repeat('a', 64),
    'synthetic v2 import article', repeat('b', 64)),
  ('991200002', 'Synthetic V2 standard article', repeat('c', 64),
    'synthetic v2 standard article', repeat('d', 64)),
  ('991200003', 'Synthetic V2 fault article', repeat('e', 64),
    'synthetic v2 fault article', repeat('f', 64)),
  ('991200004', 'Synthetic V2 determinism article', repeat('1', 64),
    'synthetic v2 determinism article', repeat('2', 64));

insert into public.literature_gold_set_batches (
  id, name, kind, taxonomy_version, label_schema_version,
  relevance_definition_version, sampling_algorithm_version, sampling_seed,
  requested_size, test_percent, sampling_report, created_by_email,
  created_at, updated_at
) values
  ('ba000000-0000-4000-8000-000000000001', 'synthetic-v2-main', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v2', 'synthetic-v2', 201, 1, 0,
    '{"synthetic":true}', 'synthetic-v2@example.invalid',
    '2031-01-01T00:00:00Z', '2031-01-01T00:00:00Z'),
  ('ba000000-0000-4000-8000-000000000002', 'synthetic-v2-standard', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v2', 'synthetic-v2', 202, 1, 0,
    '{"synthetic":true}', 'synthetic-v2@example.invalid',
    '2031-01-01T00:00:00Z', '2031-01-01T00:00:00Z'),
  ('ba000000-0000-4000-8000-000000000003', 'synthetic-v2-fault', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v2', 'synthetic-v2', 203, 1, 0,
    '{"synthetic":true}', 'synthetic-v2@example.invalid',
    '2031-01-01T00:00:00Z', '2031-01-01T00:00:00Z'),
  ('bd000000-0000-4000-8000-000000000001', 'synthetic-v2-determinism', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v2', 'synthetic-v2', 204, 1, 0,
    '{"synthetic":true}', 'synthetic-v2@example.invalid',
    '2031-01-01T00:00:00Z', '2031-01-01T00:00:00Z');

insert into public.literature_gold_set_items (
  id, batch_id, pmid, sample_stratum, sampling_reason, sampling_metadata,
  dataset_split, display_order, created_at, updated_at
) values
  ('aa000000-0000-4000-8000-000000000001',
    'ba000000-0000-4000-8000-000000000001', '991200001', 'likely_non_ip',
    'synthetic V2 import', '{}', 'development', 1,
    '2031-01-01T00:00:00Z', '2031-01-01T00:00:00Z'),
  ('aa000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000002', '991200002', 'likely_non_ip',
    'synthetic ordinary review', '{}', 'development', 1,
    '2031-01-01T00:00:00Z', '2031-01-01T00:00:00Z'),
  ('aa000000-0000-4000-8000-000000000003',
    'ba000000-0000-4000-8000-000000000003', '991200003', 'likely_non_ip',
    'synthetic V2 fault', '{}', 'development', 1,
    '2031-01-01T00:00:00Z', '2031-01-01T00:00:00Z'),
  ('ad000000-0000-4000-8000-000000000001',
    'bd000000-0000-4000-8000-000000000001', '991200004', 'likely_non_ip',
    'synthetic V2 determinism', '{}', 'development', 1,
    '2031-01-01T00:00:00Z', '2031-01-01T00:00:00Z');

do $$
declare
  excluded jsonb := pg_temp.v2_excluded_review();
  included_null_status jsonb;
  standard_result jsonb;
begin
  perform public.validate_literature_gold_import_review_payload_v2(
    'aa000000-0000-4000-8000-000000000001', excluded, true
  );
  begin
    perform public.validate_literature_gold_import_review_payload_v2(
      'aa000000-0000-4000-8000-000000000001',
      jsonb_set(excluded, '{technologyTagStatus}', '"not_applicable"'), true
    );
    raise exception 'FAIL: optional excluded status substitution was accepted';
  exception when sqlstate 'P7705' then null;
  end;
  included_null_status := jsonb_set(
    pg_temp.v2_review(
      'included status must remain source-non-null', false,
      '2032-02-01T00:00:00Z', '2032-02-01T00:01:00Z'
    ),
    '{technologyTagStatus}', 'null'::jsonb
  );
  begin
    perform public.validate_literature_gold_import_review_payload_v2(
      'aa000000-0000-4000-8000-000000000001', included_null_status, true
    );
    raise exception 'FAIL: included source-null status was accepted';
  exception when sqlstate 'P7705' then null;
  end;
  begin
    perform public.validate_literature_gold_import_review_payload_v2(
      'aa000000-0000-4000-8000-000000000001',
      excluded || jsonb_build_object('optionalTagStatusResolutions', '{}'), true
    );
    raise exception 'FAIL: retired optional-status overlay was accepted';
  exception when sqlstate 'P7558' then null;
  end;
  begin
    perform public.validate_literature_gold_import_review_payload_v2(
      'aa000000-0000-4000-8000-000000000001',
      jsonb_set(excluded, '{usedSupplementalMetadata}', 'true'), true
    );
    raise exception 'FAIL: supplemental use without local reveal was accepted';
  exception when sqlstate 'P7707' then null;
  end;

  standard_result := public.save_literature_gold_review_v1(
    'aa000000-0000-4000-8000-000000000002', null,
    'synthetic-v2@example.invalid',
    jsonb_build_object(
      'relevanceLabel', 'exclude',
      'metadataSufficiency', 'adequate_abstract',
      'reviewerConfidence', 'high', 'topicIds', '[]'::jsonb,
      'technologyTags', '[]'::jsonb, 'clinicalPurposes', '[]'::jsonb,
      'diseaseTags', '[]'::jsonb, 'studyDesign', null,
      'publicationStatus', null, 'categorizationFromFullText', false,
      'notes', 'ordinary first review', 'usedSupplementalMetadata', false,
      'reviewSeconds', 5
    ), true
  );
  perform pg_temp.assert_true(
    (standard_result ->> 'isBlinded')::boolean
      and exists (
        select 1 from public.literature_gold_set_reviews review
        where review.id = (standard_result ->> 'reviewId')::uuid
          and review.revision_kind = 'standard'
          and review.operation_contract_version is null
          and review.full_text_used is null
      ), 'ordinary first review lost blinded/standard/null-provenance behavior'
  );
  raise notice 'OK  source-null validation, supplemental separation, and ordinary first-review blinding hold';
end;
$$;

savepoint deterministic_cycle_v2;
select pg_temp.run_deterministic_cycle_v2() as evidence
\gset deterministic_first_
rollback to savepoint deterministic_cycle_v2;
select pg_temp.run_deterministic_cycle_v2() as evidence
\gset deterministic_second_
select pg_temp.assert_true(
  :'deterministic_first_evidence'::jsonb
    = :'deterministic_second_evidence'::jsonb,
  'identical V2 import/compensation executions produced different receipts or state hashes'
);
release savepoint deterministic_cycle_v2;
insert into v2_evidence values ('determinism', jsonb_build_object(
  'savepointIsolatedSeededExecutionsCompared', 2,
  'completeReceiptsIdentical', true,
  'physicalStateHashesIdentical', true,
  'effectiveStateHashesIdentical', true,
  'timelineAnchor', 'authorization.authorizedAt',
  'importReceiptSha256',
    :'deterministic_second_evidence'::jsonb
      #>> '{importReceipt,binding,contentSha256}',
  'compensationReceiptSha256',
    :'deterministic_second_evidence'::jsonb
      #>> '{compensationReceipt,binding,contentSha256}'
));
\echo 'OK  identical seeded V2 executions produce byte-identical receipts and state hashes'

do $$
<<main_v2>>
declare
  item_id constant uuid := 'aa000000-0000-4000-8000-000000000001';
  batch_id constant uuid := 'ba000000-0000-4000-8000-000000000001';
  import_id constant uuid := 'fa000000-0000-4000-8000-000000000001';
  action_id constant uuid := 'ca000000-0000-4000-8000-000000000001';
  review_id constant uuid := 'da000000-0000-4000-8000-000000000001';
  compensation_id constant uuid := 'fa000000-0000-4000-8000-000000000002';
  compensation_action_id constant uuid := 'ca000000-0000-4000-8000-000000000002';
  compensation_review_id constant uuid := 'da000000-0000-4000-8000-000000000002';
  artifact_sha constant text := repeat('8', 64);
  review_payload jsonb;
  actions jsonb;
  compensation_actions jsonb;
  baseline_effective text;
  expected_import_effective text;
  import_result jsonb;
  replay_result jsonb;
  compensation_result jsonb;
  compensation_replay jsonb;
  call v2_calls%rowtype;
  mutation_before jsonb;
  mutation_after jsonb;
  recovery_content jsonb;
  recovery_sha text;
  recovery_result jsonb;
begin
  baseline_effective := public.literature_gold_effective_state_hash_v2(
    batch_id, 'development'
  );
  review_payload := pg_temp.v2_review(
    'exact synthetic V2 rationale', true,
    '2032-03-01T00:00:00Z', '2032-03-01T00:01:00Z'
  );
  expected_import_effective := pg_temp.expected_effective_hash_v2(
    batch_id, item_id, review_payload
  );
  actions := jsonb_build_array(jsonb_build_object(
    'actionId', action_id, 'sequence', 1, 'itemId', item_id,
    'pmid', '991200001', 'datasetSplit', 'development',
    'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
    'preImportItemState', pg_temp.item_state(item_id),
    'action', 'import_initial', 'expectedRevision', 1,
    'expectedSupersedesReviewId', null, 'importedReviewId', review_id,
    'expectedHeadReviewIdAfter', review_id,
    'expectedEffectiveReviewIdAfter', review_id,
    'review', review_payload,
    'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_payload),
    'compensationAction', 'compensate_void',
    'expectedEventSequence', jsonb_build_array('review_imported')
  ));
  import_result := pg_temp.run_import_v2(
    import_id, batch_id, artifact_sha, actions, expected_import_effective
  );
  perform pg_temp.assert_true(
    import_result ->> 'outcome' = 'committed'
      and import_result ->> 'contractVersion'
        = 'gold-review-import-compensation/2.0.0'
      and import_result ->> 'migrationId'
        = '20260809231651_add_literature_gold_import_compensation_contract_v2'
      and import_result ->> 'sourceAuthorizationSetSha256' = repeat('1', 64)
      and import_result ->> 'noteDispositionAuditSha256' = repeat('2', 64)
      and import_result ->> 'booleanNormalizationLedgerSha256' = repeat('3', 64)
      and import_result ->> 'orderedSetNormalizationLedgerSha256' = repeat('4', 64)
      and import_result -> 'actionCounts' = jsonb_build_object(
        'total', 1, 'initial', 1, 'revisions', 0, 'noops', 0, 'inserts', 1
      )
      and import_result -> 'counts' = jsonb_build_object(
        'planned', 1, 'applied', 1, 'noops', 0
      ),
    'V2 import receipt did not commit with exact evidence identities'
  );
  perform pg_temp.assert_true(exists (
    select 1
    from public.literature_gold_set_reviews review
    join public.literature_gold_set_items item on item.current_review_id = review.id
    where review.id = main_v2.review_id
      and review.item_id = main_v2.item_id
      and review.revision_kind = 'import'
      and review.operation_contract_version
        = 'gold-review-import-compensation/2.0.0'
      and review.full_text_used = true and review.is_blinded = false
      and review.used_supplemental_metadata = false
      and item.supplemental_metadata_revealed_at is null
      and item.automated_signals_revealed_at is null
  ), 'V2 import did not preserve full-text/blinding provenance independently of reveal state');

  select * into call from v2_calls where operation_id = import_id;
  replay_result := public.apply_literature_gold_import_v2(
    call.operation_id, call.idempotency_key, call.batch_id, call.artifact_sha256,
    call.plan_sha256, call.plan, call.authorization_sha256,
    call.authorization_payload, null, 'synthetic-v2@example.invalid'
  );
  perform pg_temp.assert_true(
    replay_result ->> 'response' = 'idempotent_replay'
      and replay_result #>> '{binding,contentSha256}'
        = import_result #>> '{binding,contentSha256}',
    'V2 import replay changed its receipt identity'
  );

  compensation_actions := jsonb_build_array(jsonb_build_object(
    'actionId', compensation_action_id, 'sourceActionId', action_id,
    'sequence', 1, 'itemId', item_id, 'pmid', '991200001',
    'datasetSplit', 'development', 'importedReviewId', review_id,
    'expectedCurrentReviewId', review_id,
    'expectedEffectiveReviewId', review_id,
    'action', 'compensate_void', 'expectedRevision', 2,
    'expectedSupersedesReviewId', review_id,
    'compensationReviewId', compensation_review_id,
    'effectiveSourceReviewId', null,
    'expectedHeadReviewIdAfter', compensation_review_id,
    'expectedEffectiveReviewIdAfter', null,
    'expectedEventSequence', jsonb_build_array('review_voided')
  ));
  compensation_result := pg_temp.run_compensation_v2(
    compensation_id, import_id, batch_id, artifact_sha,
    compensation_actions, baseline_effective
  );
  perform pg_temp.assert_true(
    compensation_result ->> 'outcome' = 'committed'
      and compensation_result -> 'actionCounts' = jsonb_build_object(
        'total', 1, 'restored', 0, 'voided', 1, 'noops', 0
      )
      and compensation_result -> 'counts' = jsonb_build_object(
        'planned', 1, 'applied', 1, 'noops', 0
      )
      and public.literature_gold_effective_state_hash_v2(batch_id, 'development')
        = baseline_effective
      and exists (
        select 1 from public.literature_gold_set_reviews review
        join public.literature_gold_set_items item on item.current_review_id = review.id
        where review.id = main_v2.compensation_review_id
          and review.revision_kind = 'compensation'
          and review.lifecycle_state = 'withdrawn'
          and review.operation_contract_version
            = 'gold-review-import-compensation/2.0.0'
          and review.full_text_used = true and review.is_blinded = false
          and review.notes = 'exact synthetic V2 rationale'
          and review.technology_tag_status = 'not_applicable'
          and review.disease_tag_status = 'not_applicable'
          and item.review_status = 'pending'
          and item.supplemental_metadata_revealed_at is null
          and item.automated_signals_revealed_at is null
      ), 'V2 compensation did not append an exact-copy void and restore effective state'
  );

  select * into call from v2_calls where operation_id = compensation_id;
  compensation_replay := public.compensate_literature_gold_import_v2(
    call.operation_id, call.target_import_operation_id, call.idempotency_key,
    call.batch_id, call.artifact_sha256, call.plan_sha256, call.plan,
    call.authorization_sha256, call.authorization_payload, null,
    'synthetic-v2@example.invalid'
  );
  perform pg_temp.assert_true(
    compensation_replay ->> 'response' = 'idempotent_replay'
      and compensation_replay #>> '{binding,contentSha256}'
        = compensation_result #>> '{binding,contentSha256}',
    'V2 compensation replay changed its receipt identity'
  );

  mutation_before := jsonb_build_object(
    'reviews', (select count(*) from public.literature_gold_set_reviews review
      where review.item_id = main_v2.item_id),
    'events', (select count(*) from public.literature_gold_set_events event
      where event.batch_id = main_v2.batch_id),
    'pointer', (select item.current_review_id
      from public.literature_gold_set_items item
      where item.id = main_v2.item_id)
  );
  select * into call from v2_calls where operation_id = import_id;
  recovery_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'kind', 'recovery_authorization', 'authorizationId', gen_random_uuid(),
    'authorized', true, 'authorizedBy', 'synthetic-v2@example.invalid',
    'authorizedAt', '2032-04-01T00:00:00Z',
    'authorizationNote', 'Disposable read-only V2 reconciliation.',
    'targetDatabase', 'local', 'remoteWritesAllowed', false,
    'repositoryCommitSha', repeat('a', 40),
    'migrationId', '20260809231651_add_literature_gold_import_compensation_contract_v2',
    'recoveryAction', 'resolve_ambiguous_import', 'batchId', batch_id,
    'targetOperationId', import_id, 'targetPlanSha256', call.plan_sha256,
    'targetIdempotencyKey', call.idempotency_key,
    'observedPhysicalStateSha256',
      public.literature_gold_physical_state_hash_v2(batch_id, 'development'),
    'observedEffectiveStateSha256',
      public.literature_gold_effective_state_hash_v2(batch_id, 'development'),
    'permitsMutation', false
  );
  recovery_sha := public.literature_gold_jsonb_sha256_v1(recovery_content);
  recovery_result := public.reconcile_literature_gold_review_operation_v2(
    import_id, recovery_sha, recovery_content || jsonb_build_object(
      'binding', jsonb_build_object('contentSha256', recovery_sha)
    )
  );
  mutation_after := jsonb_build_object(
    'reviews', (select count(*) from public.literature_gold_set_reviews review
      where review.item_id = main_v2.item_id),
    'events', (select count(*) from public.literature_gold_set_events event
      where event.batch_id = main_v2.batch_id),
    'pointer', (select item.current_review_id
      from public.literature_gold_set_items item
      where item.id = main_v2.item_id)
  );
  perform pg_temp.assert_true(
    mutation_after = mutation_before
      and recovery_result ->> 'response' = 'idempotent_replay'
      and recovery_result #>> '{binding,contentSha256}'
        = import_result #>> '{binding,contentSha256}',
    'V2 lost-ack reconciliation mutated state or changed receipt identity'
  );

  insert into v2_evidence values ('import_compensation', jsonb_build_object(
    'importCommitted', true, 'compensationCommitted', true,
    'effectiveStateRestored', true, 'exactPayloadCopy', true,
    'idempotentReplay', true, 'readOnlyReconcile', true,
    'fullTextUsed', true, 'isBlinded', false,
    'revealTimestampsSynthesized', false
  ));
  raise notice 'OK  V2 import, replay, exact-copy compensation, restoration, and reconciliation pass';
end;
$$;

do $$
declare
  call v2_calls%rowtype;
  malformed_field text;
  malformed_value jsonb;
  malformed_content jsonb;
  malformed_sha text;
  malformed_payload jsonb;
  recovery_content jsonb;
begin
  select * into call from v2_calls
  where operation_id = 'fa000000-0000-4000-8000-000000000001';

  foreach malformed_field in array array['authorizedAt', 'authorizationNote'] loop
    malformed_value := case malformed_field
      when 'authorizedAt' then '20320201'::jsonb
      else '12345'::jsonb
    end;
    malformed_content := jsonb_set(
      call.authorization_payload - 'binding', array[malformed_field],
      malformed_value
    );
    malformed_sha := public.literature_gold_jsonb_sha256_v1(malformed_content);
    malformed_payload := malformed_content || jsonb_build_object(
      'binding', jsonb_build_object('contentSha256', malformed_sha)
    );
    begin
      perform public.validate_literature_gold_operation_authorization_v2(
        malformed_payload, malformed_sha, 'import', call.operation_id, null,
        call.batch_id, call.plan_sha256, call.idempotency_key,
        call.artifact_sha256, call.plan
      );
      raise exception 'FAIL: rebound numeric import authorization % was accepted',
        malformed_field;
    exception when sqlstate 'P7713' then null;
    end;
  end loop;

  recovery_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'kind', 'recovery_authorization',
    'authorizationId', 'ee000000-0000-4000-8000-000000000001'::uuid,
    'authorized', true, 'authorizedBy', 'synthetic-v2@example.invalid',
    'authorizedAt', '2032-04-01T00:00:00Z',
    'authorizationNote', 'Disposable read-only type-guard reconciliation.',
    'targetDatabase', 'local', 'remoteWritesAllowed', false,
    'repositoryCommitSha', repeat('a', 40),
    'migrationId', '20260809231651_add_literature_gold_import_compensation_contract_v2',
    'recoveryAction', 'resolve_ambiguous_import', 'batchId', call.batch_id,
    'targetOperationId', call.operation_id,
    'targetPlanSha256', call.plan_sha256,
    'targetIdempotencyKey', call.idempotency_key,
    'observedPhysicalStateSha256',
      public.literature_gold_physical_state_hash_v2(call.batch_id, 'development'),
    'observedEffectiveStateSha256',
      public.literature_gold_effective_state_hash_v2(call.batch_id, 'development'),
    'permitsMutation', false
  );
  foreach malformed_field in array array['authorizedAt', 'authorizationNote'] loop
    malformed_value := case malformed_field
      when 'authorizedAt' then '20320401'::jsonb
      else '12345'::jsonb
    end;
    malformed_content := jsonb_set(
      recovery_content, array[malformed_field], malformed_value
    );
    malformed_sha := public.literature_gold_jsonb_sha256_v1(malformed_content);
    malformed_payload := malformed_content || jsonb_build_object(
      'binding', jsonb_build_object('contentSha256', malformed_sha)
    );
    begin
      perform public.reconcile_literature_gold_review_operation_v2(
        call.operation_id, malformed_sha, malformed_payload
      );
      raise exception 'FAIL: rebound numeric recovery authorization % was accepted',
        malformed_field;
    exception when sqlstate 'P7710' then null;
    end;
  end loop;

  insert into v2_evidence values ('authorization_type_guards', jsonb_build_object(
    'operationAuthorizationNumericAuthorizedAtRejected', true,
    'operationAuthorizationNumericAuthorizationNoteRejected', true,
    'recoveryAuthorizationNumericAuthorizedAtRejected', true,
    'recoveryAuthorizationNumericAuthorizationNoteRejected', true
  ));
  raise notice 'OK  checksum-rebound numeric authorization scalar substitutions are rejected';
end;
$$;

do $$
<<fault_v2>>
declare
  item_id constant uuid := 'aa000000-0000-4000-8000-000000000003';
  batch_id constant uuid := 'ba000000-0000-4000-8000-000000000003';
  review_payload jsonb;
  actions jsonb;
  expected_effective text;
  result jsonb;
begin
  review_payload := pg_temp.v2_review(
    'controlled atomic failure', false,
    '2032-05-01T00:00:00Z', '2032-05-01T00:01:00Z'
  );
  expected_effective := pg_temp.expected_effective_hash_v2(
    batch_id, item_id, review_payload
  );
  actions := jsonb_build_array(jsonb_build_object(
    'actionId', 'cb000000-0000-4000-8000-000000000001', 'sequence', 1,
    'itemId', item_id, 'pmid', '991200003', 'datasetSplit', 'development',
    'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
    'preImportItemState', pg_temp.item_state(item_id),
    'action', 'import_initial', 'expectedRevision', 1,
    'expectedSupersedesReviewId', null,
    'importedReviewId', 'db000000-0000-4000-8000-000000000001',
    'expectedHeadReviewIdAfter', 'db000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewIdAfter', 'db000000-0000-4000-8000-000000000001',
    'review', review_payload,
    'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_payload),
    'compensationAction', 'compensate_void',
    'expectedEventSequence', jsonb_build_array('review_imported')
  ));
  result := pg_temp.run_import_v2(
    'fb000000-0000-4000-8000-000000000001', batch_id, repeat('7', 64),
    actions, expected_effective, 1
  );
  perform pg_temp.assert_true(
    result ->> 'outcome' = 'failed'
      and not exists (
        select 1 from public.literature_gold_set_reviews review
        where review.item_id = fault_v2.item_id
      )
      and (select item.current_review_id is null
        from public.literature_gold_set_items item
        where item.id = fault_v2.item_id)
      and (select item.automated_signals_revealed_at is null
          and item.supplemental_metadata_revealed_at is null
        from public.literature_gold_set_items item
        where item.id = fault_v2.item_id)
      and exists (
        select 1 from public.literature_gold_review_operations operation
        where operation.id = 'fb000000-0000-4000-8000-000000000001'
          and operation.status = 'failed'
          and operation.error_sqlstate = 'P7799'
          and operation.post_physical_state_sha256 is not null
      ), 'controlled V2 fault committed a review/pointer/reveal mutation or failed to seal audit state'
  );
  insert into v2_evidence values ('atomicity', jsonb_build_object(
    'failedJournalSealed', true, 'reviewMutationCount', 0,
    'pointerMutationCount', 0, 'revealTimestampMutationCount', 0
  ));
  raise notice 'OK  controlled V2 fault is atomic and seals only append-only failure evidence';
end;
$$;

do $$
declare
  evidence jsonb;
begin
  evidence := jsonb_build_object(
    'schemaVersion', 'gold-import-compensation-v2-verifier/1.0.0',
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'migrationId', '20260809231651_add_literature_gold_import_compensation_contract_v2',
    'fixtureScope', 'synthetic_small_fixture',
    'productionCohortCountsVerifiedElsewhere', true,
    'scenarios', (select jsonb_object_agg(key, value order by key) from v2_evidence),
    'allChecksPassed', true
  );
  raise notice 'V2_REHEARSAL_EVIDENCE_JSON:%', evidence::text;
  raise notice 'ALL LITERATURE GOLD IMPORT-COMPENSATION V2 CHECKS PASSED';
end;
$$;

rollback;
