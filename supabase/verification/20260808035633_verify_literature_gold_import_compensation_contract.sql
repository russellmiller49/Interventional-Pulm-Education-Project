\set ON_ERROR_STOP on

-- Disposable behavioral verification for the gold review import/compensation
-- contract.  The isolated runner creates a fresh PostgreSQL container, applies
-- the canonical migration chain, executes this file, and destroys the
-- container.  Every identity below is synthetic.  The script never selects or
-- prints held-out item identities.

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
begin
  perform pg_temp.assert_true(
    not has_table_privilege('service_role', 'public.literature_gold_review_operations', 'INSERT')
      and not has_table_privilege('service_role', 'public.literature_gold_review_operations', 'UPDATE')
      and not has_table_privilege('service_role', 'public.literature_gold_review_operation_actions', 'INSERT')
      and not has_table_privilege('service_role', 'public.literature_gold_review_operation_actions', 'UPDATE'),
    'service_role retained direct journal mutation privileges'
  );
  perform pg_temp.assert_true(
    position('pg_advisory_xact_lock' in pg_get_functiondef(
      'public.apply_literature_gold_import_v1(uuid,text,uuid,text,text,jsonb,text,jsonb,uuid,text)'::regprocedure
    )) > 0
      and position('pg_advisory_xact_lock' in pg_get_functiondef(
        'public.compensate_literature_gold_import_v1(uuid,uuid,text,uuid,text,text,jsonb,text,jsonb,uuid,text)'::regprocedure
      )) > 0,
    'operation/idempotency advisory replay serialization is absent'
  );
  perform pg_temp.assert_true(
    position('test_unlocked_at' in pg_get_functiondef(
      'public.apply_literature_gold_import_v1(uuid,text,uuid,text,text,jsonb,text,jsonb,uuid,text)'::regprocedure
    )) > 0
      and position('test_unlocked_at' in pg_get_functiondef(
        'public.compensate_literature_gold_import_v1(uuid,uuid,text,uuid,text,text,jsonb,text,jsonb,uuid,text)'::regprocedure
      )) > 0,
    'one or both mutation RPCs omit the gold-standard test-lock gate'
  );
  begin
    execute 'set local role service_role';
    insert into public.literature_gold_review_operations (
      id, batch_id, operation_kind, idempotency_key, artifact_sha256,
      plan_sha256, plan, authorization_sha256, authorization_payload,
      actor_email, planned_action_count, planned_apply_count,
      planned_noop_count, pre_physical_state_sha256, pre_effective_state_sha256
    ) values (
      'ff000000-0000-4000-8000-000000000001', gen_random_uuid(), 'import',
      repeat('a', 64), repeat('a', 64), repeat('a', 64), '{}', repeat('a', 64),
      '{}', 'forbidden@example.invalid', 1, 1, 0, repeat('a', 64), repeat('a', 64)
    );
    raise exception 'FAIL: service_role fabricated an operation journal row';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'OK  service_role cannot fabricate journal state and replay identities are serialized';
end;
$$;

create temporary table rehearsal_values (
  key text primary key,
  value text not null
) on commit drop;

create temporary table rehearsal_calls (
  operation_id uuid primary key,
  operation_kind text not null,
  target_import_operation_id uuid,
  idempotency_key text not null,
  batch_id uuid not null,
  artifact_sha256 text not null,
  plan_sha256 text not null,
  plan jsonb not null,
  authorization_sha256 text not null,
  authorization_payload jsonb not null
) on commit drop;

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
  from public.literature_gold_set_items as item
  where item.id = p_item_id;
$$;

create or replace function pg_temp.review_payload(
  p_note text,
  p_started_at timestamptz,
  p_completed_at timestamptz
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'reviewerUserId', null,
    'reviewerEmail', 'synthetic-rehearsal@example.invalid',
    'relevanceLabel', 'exclude',
    'metadataSufficiency', 'adequate_abstract',
    'reviewerConfidence', 'high',
    'topicIds', '[]'::jsonb,
    'technologyTags', '[]'::jsonb,
    'technologyTagStatus', 'not_applicable',
    'clinicalPurposes', '[]'::jsonb,
    'diseaseTags', '[]'::jsonb,
    'diseaseTagStatus', 'not_applicable',
    'studyDesign', null,
    'publicationStatus', null,
    'categorizationFromFullText', false,
    'notes', p_note,
    'usedSupplementalMetadata', false,
    'reviewSeconds', 17,
    'isBlinded', true,
    'startedAt', p_started_at,
    'completedAt', p_completed_at,
    'createdAt', p_completed_at,
    'taxonomyVersion', '2.0.0',
    'labelSchemaVersion', '2.0.0',
    'enrichmentSchemaVersion', '2.0.0',
    'enrichmentProvenance', 'synthetic-disposable-rehearsal'
  );
$$;

create or replace function pg_temp.effective_review_from_payload(p_review jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
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
    'notes', p_review -> 'notes',
    'usedSupplementalMetadata', p_review -> 'usedSupplementalMetadata',
    'reviewSeconds', p_review -> 'reviewSeconds',
    'isBlinded', p_review -> 'isBlinded',
    'taxonomyVersion', p_review -> 'taxonomyVersion',
    'labelSchemaVersion', p_review -> 'labelSchemaVersion',
    'enrichmentSchemaVersion', p_review -> 'enrichmentSchemaVersion',
    'enrichmentProvenance', p_review -> 'enrichmentProvenance'
  );
$$;

-- Exact no-op candidate projection consumed by the import RPC and effective
-- hash. It intentionally excludes reviewer identity and timestamps.
create or replace function pg_temp.current_effective_candidate(p_item_id uuid)
returns jsonb
language sql
stable
as $$
  select public.literature_gold_review_clinical_projection_v1(
    coalesce(head.effective_source_review_id, head.id)
  )
  from public.literature_gold_set_items as item
  join public.literature_gold_set_reviews as head
    on head.id = item.current_review_id and head.item_id = item.id
  where item.id = p_item_id and head.lifecycle_state = 'effective';
$$;

-- Compute the migration's effective projection with selected development-item
-- overrides.  Override keys are synthetic item UUIDs; values contain
-- reviewStatus and the exact semantic review JSON (or JSON null).
create or replace function pg_temp.expected_effective_hash(
  p_batch_id uuid,
  p_overrides jsonb
)
returns text
language plpgsql
stable
as $$
declare
  projection jsonb;
begin
  select jsonb_build_object(
    'projectionVersion', 'literature-gold-effective-state-v1',
    'datasetSplit', 'development',
    'items', coalesce(jsonb_agg(
      case when p_overrides ? item.id::text then
        jsonb_build_object(
          'pmid', item.pmid,
          'reviewStatus', p_overrides #> array[item.id::text, 'reviewStatus'],
          'review', p_overrides #> array[item.id::text, 'review']
        )
      else
        jsonb_build_object(
          'pmid', item.pmid,
          'reviewStatus', item.review_status,
          'review', case
            when head.lifecycle_state = 'withdrawn' or head.id is null then null
            else jsonb_build_object(
              'relevanceLabel', head.relevance_label,
              'metadataSufficiency', head.metadata_sufficiency,
              'reviewerConfidence', head.reviewer_confidence,
              'topicIds', to_jsonb(head.topic_ids),
              'technologyTags', to_jsonb(head.technology_tags),
              'technologyTagStatus', head.technology_tag_status,
              'clinicalPurposes', to_jsonb(head.clinical_purposes),
              'diseaseTags', to_jsonb(head.disease_tags),
              'diseaseTagStatus', head.disease_tag_status,
              'studyDesign', head.study_design,
              'publicationStatus', head.publication_status,
              'categorizationFromFullText', head.categorization_from_full_text,
              'notes', head.notes,
              'usedSupplementalMetadata', head.used_supplemental_metadata,
              'reviewSeconds', head.review_seconds,
              'isBlinded', head.is_blinded,
              'taxonomyVersion', head.taxonomy_version,
              'labelSchemaVersion', head.label_schema_version,
              'enrichmentSchemaVersion', head.enrichment_schema_version,
              'enrichmentProvenance', head.enrichment_provenance
            )
          end
        )
      end
      order by item.pmid::numeric, item.id
    ), '[]'::jsonb)
  )
  into projection
  from public.literature_gold_set_items as item
  left join public.literature_gold_set_reviews as head
    on head.id = item.current_review_id and head.item_id = item.id
  where item.batch_id = p_batch_id and item.dataset_split = 'development';

  return public.literature_gold_jsonb_sha256_v1(projection);
end;
$$;

create or replace function pg_temp.run_import(
  p_operation_id uuid,
  p_idempotency_key text,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_actions jsonb,
  p_expected_post_effective_sha256 text,
  p_fault_after_action integer default null,
  p_membership_sha256_override text default null,
  p_initial_count_override integer default null,
  p_idempotency_override text default null,
  p_authorized_at_override text default null
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
  plan_sha256 text;
  effective_idempotency_key text;
  plan_payload jsonb;
  authorization_content jsonb;
  authorization_sha256 text;
  authorization_payload jsonb;
  result jsonb;
begin
  select
    count(*) filter (where value ->> 'action' = 'import_initial')::integer,
    count(*) filter (where value ->> 'action' = 'import_revision')::integer,
    count(*) filter (where value ->> 'action' = 'import_noop')::integer
  into initial_count, revision_count, noop_count
  from jsonb_array_elements(p_actions);

  pre_physical := public.literature_gold_physical_state_hash_v1(p_batch_id, 'development');
  pre_effective := public.literature_gold_effective_state_hash_v1(p_batch_id, 'development');
  plan_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', 'import',
    'operationId', p_operation_id,
    'batchId', p_batch_id,
    'sourceArtifactSha256', p_artifact_sha256,
    'sourceAuthorizationSetSha256', repeat('9', 64),
    'expectedPhysicalStateSha256', pre_physical,
    'expectedEffectiveStateSha256', pre_effective,
    'expectedPostEffectiveStateSha256', p_expected_post_effective_sha256,
    'executionContext', jsonb_build_object(
      'targetDatabase', 'local',
      'remoteWritesAllowed', false,
      'migrationId', '20260808035633_add_literature_gold_import_compensation_contract',
      'importRpc', 'apply_literature_gold_import_v1',
      'compensationRpc', 'compensate_literature_gold_import_v1',
      'reconciliationRpc', 'reconcile_literature_gold_review_operation_v1',
      'developmentMembershipHash', 'literature_gold_development_membership_hash_v1',
      'physicalStateHash', 'literature_gold_physical_state_hash_v1',
      'effectiveStateHash', 'literature_gold_effective_state_hash_v1',
      'repositoryCommitSha', repeat('a', 40)
    ),
    'scope', jsonb_build_object(
      'datasetSplit', 'development',
      'heldOutIdentitiesAccessed', false,
      'developmentMembershipSha256', coalesce(
        p_membership_sha256_override,
        public.literature_gold_development_membership_hash_v1(p_batch_id)
      )
    ),
    'counts', jsonb_build_object(
      'total', jsonb_array_length(p_actions),
      'initial', coalesce(p_initial_count_override, initial_count),
      'revisions', revision_count,
      'noops', noop_count,
      'inserts', initial_count + revision_count
    ),
    'actions', p_actions
  ) || case when p_fault_after_action is null then '{}'::jsonb
    else jsonb_build_object('faultAfterAction', p_fault_after_action) end;
  plan_sha256 := public.literature_gold_jsonb_sha256_v1(plan_content);
  effective_idempotency_key := public.literature_gold_jsonb_sha256_v1(jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', 'import',
    'operationId', p_operation_id,
    'contentSha256', plan_sha256
  ));
  effective_idempotency_key := coalesce(p_idempotency_override, effective_idempotency_key);
  plan_payload := plan_content || jsonb_build_object(
    'binding', jsonb_build_object(
      'contentSha256', plan_sha256,
      'idempotencyKey', effective_idempotency_key
    )
  );

  authorization_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', 'import_authorization',
    'authorizationId', gen_random_uuid(),
    'authorized', true,
    'authorizedBy', 'synthetic-rehearsal@example.invalid',
    'authorizedAt', coalesce(p_authorized_at_override, '2031-01-01T00:00:00Z'),
    'authorizationNote', 'Disposable synthetic database rehearsal authorization.',
    'operationId', p_operation_id,
    'batchId', p_batch_id,
    'planSha256', plan_sha256,
    'idempotencyKey', effective_idempotency_key,
    'targetDatabase', 'local',
    'remoteWritesAllowed', false,
    'repositoryCommitSha', repeat('a', 40),
    'migrationId', '20260808035633_add_literature_gold_import_compensation_contract',
    'sourceArtifactSha256', p_artifact_sha256,
    'expectedPhysicalStateSha256', pre_physical,
    'expectedEffectiveStateSha256', pre_effective,
    'expectedPostEffectiveStateSha256', p_expected_post_effective_sha256
  );
  authorization_sha256 := public.literature_gold_jsonb_sha256_v1(authorization_content);
  authorization_payload := authorization_content || jsonb_build_object(
    'binding', jsonb_build_object('contentSha256', authorization_sha256)
  );

  result := public.apply_literature_gold_import_v1(
    p_operation_id,
    effective_idempotency_key,
    p_batch_id,
    p_artifact_sha256,
    plan_sha256,
    plan_payload,
    authorization_sha256,
    authorization_payload,
    null,
    'synthetic-rehearsal@example.invalid'
  );

  insert into rehearsal_calls values (
    p_operation_id, 'import', null, effective_idempotency_key, p_batch_id,
    p_artifact_sha256, plan_sha256, plan_payload,
    authorization_sha256, authorization_payload
  );
  return result;
end;
$$;

create or replace function pg_temp.run_compensation(
  p_operation_id uuid,
  p_target_import_operation_id uuid,
  p_idempotency_key text,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_actions jsonb,
  p_import_receipt_sha256 text,
  p_expected_post_effective_sha256 text,
  p_fault_after_action integer default null
)
returns jsonb
language plpgsql
as $$
declare
  restore_count integer;
  void_count integer;
  noop_count integer;
  pre_physical text;
  pre_effective text;
  import_plan_sha256 text;
  plan_content jsonb;
  plan_sha256 text;
  effective_idempotency_key text;
  plan_payload jsonb;
  authorization_content jsonb;
  authorization_sha256 text;
  authorization_payload jsonb;
  result jsonb;
begin
  select
    count(*) filter (where value ->> 'action' = 'compensate_restore')::integer,
    count(*) filter (where value ->> 'action' = 'compensate_void')::integer,
    count(*) filter (where value ->> 'action' = 'compensate_noop')::integer
  into restore_count, void_count, noop_count
  from jsonb_array_elements(p_actions);

  select operation.plan_sha256
  into import_plan_sha256
  from public.literature_gold_review_operations as operation
  where operation.id = p_target_import_operation_id;
  pre_physical := public.literature_gold_physical_state_hash_v1(p_batch_id, 'development');
  pre_effective := public.literature_gold_effective_state_hash_v1(p_batch_id, 'development');

  plan_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', 'compensation',
    'operationId', p_operation_id,
    'targetImportOperationId', p_target_import_operation_id,
    'batchId', p_batch_id,
    'sourceArtifactSha256', p_artifact_sha256,
    'importPlanSha256', import_plan_sha256,
    'importReceiptSha256', p_import_receipt_sha256,
    'expectedPhysicalStateSha256', pre_physical,
    'expectedEffectiveStateSha256', pre_effective,
    'expectedPostEffectiveStateSha256', p_expected_post_effective_sha256,
    'executionContext', jsonb_build_object(
      'targetDatabase', 'local',
      'remoteWritesAllowed', false,
      'migrationId', '20260808035633_add_literature_gold_import_compensation_contract',
      'compensationRpc', 'compensate_literature_gold_import_v1',
      'importRpc', 'apply_literature_gold_import_v1',
      'reconciliationRpc', 'reconcile_literature_gold_review_operation_v1',
      'developmentMembershipHash', 'literature_gold_development_membership_hash_v1',
      'physicalStateHash', 'literature_gold_physical_state_hash_v1',
      'effectiveStateHash', 'literature_gold_effective_state_hash_v1',
      'repositoryCommitSha', repeat('a', 40)
    ),
    'scope', jsonb_build_object(
      'datasetSplit', 'development',
      'heldOutIdentitiesAccessed', false,
      'developmentMembershipSha256',
        public.literature_gold_development_membership_hash_v1(p_batch_id)
    ),
    'counts', jsonb_build_object(
      'total', jsonb_array_length(p_actions),
      'restored', restore_count,
      'voided', void_count,
      'noops', noop_count
    ),
    'actions', p_actions
  ) || case when p_fault_after_action is null then '{}'::jsonb
    else jsonb_build_object('faultAfterAction', p_fault_after_action) end;
  plan_sha256 := public.literature_gold_jsonb_sha256_v1(plan_content);
  effective_idempotency_key := public.literature_gold_jsonb_sha256_v1(jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', 'compensation',
    'operationId', p_operation_id,
    'contentSha256', plan_sha256
  ));
  plan_payload := plan_content || jsonb_build_object(
    'binding', jsonb_build_object(
      'contentSha256', plan_sha256,
      'idempotencyKey', effective_idempotency_key
    )
  );

  authorization_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', 'compensation_authorization',
    'authorizationId', gen_random_uuid(),
    'authorized', true,
    'authorizedBy', 'synthetic-rehearsal@example.invalid',
    'authorizedAt', '2031-01-01T00:00:00Z',
    'authorizationNote', 'Disposable synthetic compensation authorization.',
    'operationId', p_operation_id,
    'targetImportOperationId', p_target_import_operation_id,
    'batchId', p_batch_id,
    'planSha256', plan_sha256,
    'idempotencyKey', effective_idempotency_key,
    'targetDatabase', 'local',
    'remoteWritesAllowed', false,
    'repositoryCommitSha', repeat('a', 40),
    'migrationId', '20260808035633_add_literature_gold_import_compensation_contract',
    'sourceArtifactSha256', p_artifact_sha256,
    'importReceiptSha256', p_import_receipt_sha256,
    'expectedPhysicalStateSha256', pre_physical,
    'expectedEffectiveStateSha256', pre_effective,
    'expectedPostEffectiveStateSha256', p_expected_post_effective_sha256
  );
  authorization_sha256 := public.literature_gold_jsonb_sha256_v1(authorization_content);
  authorization_payload := authorization_content || jsonb_build_object(
    'binding', jsonb_build_object('contentSha256', authorization_sha256)
  );

  result := public.compensate_literature_gold_import_v1(
    p_operation_id,
    p_target_import_operation_id,
    effective_idempotency_key,
    p_batch_id,
    p_artifact_sha256,
    plan_sha256,
    plan_payload,
    authorization_sha256,
    authorization_payload,
    null,
    'synthetic-rehearsal@example.invalid'
  );

  insert into rehearsal_calls values (
    p_operation_id, 'compensation', p_target_import_operation_id,
    effective_idempotency_key, p_batch_id, p_artifact_sha256, plan_sha256,
    plan_payload, authorization_sha256, authorization_payload
  );
  return result;
end;
$$;

create or replace function pg_temp.recover_operation(
  p_operation_id uuid,
  p_batch_id uuid,
  p_target_plan_sha256 text,
  p_target_idempotency_key text
)
returns jsonb
language plpgsql
as $$
declare
  authorization_content jsonb;
  authorization_sha256 text;
begin
  authorization_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', 'recovery_authorization',
    'authorizationId', gen_random_uuid(),
    'authorized', true,
    'permitsMutation', false,
    'authorizedBy', 'synthetic-recovery@example.invalid',
    'authorizedAt', '2031-06-01T00:00:00Z',
    'authorizationNote', 'Read-only disposable reconciliation rehearsal.',
    'targetDatabase', 'local',
    'remoteWritesAllowed', false,
    'migrationId', '20260808035633_add_literature_gold_import_compensation_contract',
    'repositoryCommitSha', repeat('a', 40),
    'recoveryAction', 'resolve_ambiguous_import',
    'targetOperationId', p_operation_id,
    'batchId', p_batch_id,
    'targetPlanSha256', p_target_plan_sha256,
    'targetIdempotencyKey', p_target_idempotency_key,
    'observedPhysicalStateSha256', public.literature_gold_physical_state_hash_v1(
      p_batch_id, 'development'
    ),
    'observedEffectiveStateSha256', public.literature_gold_effective_state_hash_v1(
      p_batch_id, 'development'
    )
  );
  authorization_sha256 := public.literature_gold_jsonb_sha256_v1(
    authorization_content
  );
  return public.reconcile_literature_gold_review_operation_v1(
    p_operation_id,
    authorization_sha256,
    authorization_content || jsonb_build_object(
      'binding', jsonb_build_object('contentSha256', authorization_sha256)
    )
  );
end;
$$;

-- Seed only synthetic rows.  Test-split rows exist solely to prove the scope
-- guard; their identities are never selected or printed below.
insert into public.literature_articles (
  pmid, title, metadata_hash, normalized_title, normalized_title_hash
)
select
  value::text,
  'Synthetic rehearsal article ' || value,
  repeat('a', 64),
  'synthetic rehearsal article ' || value,
  repeat('b', 64)
from generate_series(910001, 910012) as value;

insert into public.literature_articles (
  pmid, title, metadata_hash, normalized_title, normalized_title_hash
) values (
  '10000', 'Synthetic cross-runtime golden article', repeat('c', 64),
  'synthetic cross runtime golden article', repeat('d', 64)
);

insert into public.literature_gold_set_batches (
  id, name, kind, taxonomy_version, label_schema_version,
  relevance_definition_version, sampling_algorithm_version, sampling_seed,
  requested_size, test_percent, sampling_report, created_by_email
)
values
  ('b0000000-0000-4000-8000-000000000001', 'synthetic-main-contract', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v1', 'synthetic-v1', 101, 4, 25,
    '{"synthetic":true}', 'synthetic-rehearsal@example.invalid'),
  ('b0000000-0000-4000-8000-000000000002', 'synthetic-failed-import', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v1', 'synthetic-v1', 102, 3, 33,
    '{"synthetic":true}', 'synthetic-rehearsal@example.invalid'),
  ('b0000000-0000-4000-8000-000000000003', 'synthetic-failed-compensation', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v1', 'synthetic-v1', 103, 2, 50,
    '{"synthetic":true}', 'synthetic-rehearsal@example.invalid'),
  ('b0000000-0000-4000-8000-000000000004', 'synthetic-stale-compensation', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v1', 'synthetic-v1', 104, 2, 50,
    '{"synthetic":true}', 'synthetic-rehearsal@example.invalid'),
  ('b0000000-0000-4000-8000-000000000005', 'synthetic-effective-hash-golden', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v1', 'synthetic-v1', 105, 1, 0,
    '{"synthetic":true,"crossRuntimeGolden":true}',
    'synthetic-rehearsal@example.invalid');

insert into public.literature_gold_set_items (
  id, batch_id, pmid, sample_stratum, sampling_reason, sampling_metadata,
  dataset_split, display_order
)
values
  ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '910001', 'likely_non_ip', 'synthetic prior review', '{}', 'development', 1),
  ('10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '910002', 'likely_non_ip', 'synthetic initial review', '{}', 'development', 2),
  ('10000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', '910003', 'likely_non_ip', 'synthetic no-op', '{}', 'development', 3),
  ('10000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', '910004', 'ambiguous_boundary', 'synthetic held-out scope sentinel', '{}', 'test', 4),
  ('20000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', '910005', 'likely_non_ip', 'synthetic import fault one', '{}', 'development', 1),
  ('20000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '910006', 'likely_non_ip', 'synthetic import fault two', '{}', 'development', 2),
  ('20000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', '910007', 'ambiguous_boundary', 'synthetic held-out scope sentinel', '{}', 'test', 3),
  ('30000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', '910008', 'likely_non_ip', 'synthetic compensation fault', '{}', 'development', 1),
  ('30000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', '910009', 'ambiguous_boundary', 'synthetic held-out scope sentinel', '{}', 'test', 2),
  ('40000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', '910010', 'likely_non_ip', 'synthetic stale compensation', '{}', 'development', 1),
  ('40000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000004', '910011', 'ambiguous_boundary', 'synthetic held-out scope sentinel', '{}', 'test', 2),
  ('50000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', '10000', 'likely_non_ip', 'cross-runtime effective hash golden', '{}', 'development', 1);

do $$
begin
  perform pg_temp.assert_true(
    public.literature_gold_effective_state_hash_v1(
      'b0000000-0000-4000-8000-000000000005', 'development'
    ) = '871cf871dbabb2818ba37104abddad33c2edb63aad023a8fb470b72b84bf5e85',
    'cross-runtime effective-state golden hash diverged'
  );
  raise notice 'OK  cross-runtime pending-item effective-state golden hash matches';
end;
$$;

-- Two legacy-style standard reviews exercise additive defaults.  They are
-- snapshotted byte-for-byte before any operation.
insert into public.literature_gold_set_reviews (
  id, item_id, revision, relevance_label, metadata_sufficiency,
  reviewer_confidence, notes, is_blinded, started_at, completed_at,
  technology_tag_status, disease_tag_status, taxonomy_version,
  label_schema_version, enrichment_schema_version, enrichment_provenance
)
values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1,
    'exclude', 'adequate_abstract', 'high', 'immutable prior A', true,
    '2030-01-01T00:00:00Z', '2030-01-01T00:01:00Z',
    'not_applicable', 'not_applicable', '2.0.0', '2.0.0', '2.0.0', 'synthetic-golden'),
  ('11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 1,
    'exclude', 'adequate_abstract', 'high', 'immutable prior C', true,
    '2030-01-03T00:00:00Z', '2030-01-03T00:01:00Z',
    'not_applicable', 'not_applicable', '2.0.0', '2.0.0', '2.0.0', 'synthetic-golden');

update public.literature_gold_set_items
set review_status = 'completed',
  current_review_id = case id
    when '10000000-0000-4000-8000-000000000001'::uuid then '11000000-0000-4000-8000-000000000001'::uuid
    else '11000000-0000-4000-8000-000000000003'::uuid end,
  started_at = case id
    when '10000000-0000-4000-8000-000000000001'::uuid then '2030-01-01T00:00:00Z'::timestamptz
    else '2030-01-03T00:00:00Z'::timestamptz end,
  completed_at = case id
    when '10000000-0000-4000-8000-000000000001'::uuid then '2030-01-01T00:01:00Z'::timestamptz
    else '2030-01-03T00:01:00Z'::timestamptz end
where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003'
);

do $$
begin
  perform pg_temp.assert_true(
    public.literature_gold_jsonb_sha256_v1(
      public.literature_gold_review_clinical_projection_v1(
        '11000000-0000-4000-8000-000000000001'
      )
    ) = '5b3c2c627e2320659a15ecf0ac8b5002a9f772efea3e1f62e382016dad0fb931',
    'cross-runtime clinical projection golden hash diverged'
  );
  raise notice 'OK  cross-runtime clinical projection golden hash matches';
end;
$$;

do $$
declare
  payload jsonb := pg_temp.review_payload(
    'strict JSON validation', '2030-01-05T00:00:00Z', '2030-01-05T00:01:00Z'
  );
begin
  perform pg_temp.assert_true(
    public.literature_gold_is_timestamptz_v1('2030-01-05T00:00:00Z')
      and public.literature_gold_is_timestamptz_v1('2030-01-05T00:00:00.123+05:30')
      and not public.literature_gold_is_timestamptz_v1('infinity')
      and not public.literature_gold_is_timestamptz_v1('2030-01-05')
      and not public.literature_gold_is_timestamptz_v1('2030-01-05T00:00:00'),
    'RFC3339 timestamp helper accepts a PostgreSQL-only or offset-free timestamp'
  );
  begin
    perform public.validate_literature_gold_import_review_payload_v1(
      '10000000-0000-4000-8000-000000000001',
      jsonb_set(payload, '{topicIds}', '[null]'::jsonb), false
    );
    raise exception 'FAIL: null controlled-label array element was accepted';
  exception when sqlstate 'P7650' then null;
  end;
  begin
    perform public.validate_literature_gold_import_review_payload_v1(
      '10000000-0000-4000-8000-000000000001',
      jsonb_set(payload, '{isBlinded}', '"true"'::jsonb), false
    );
    raise exception 'FAIL: string-coerced boolean was accepted';
  exception when sqlstate 'P7558' then null;
  end;
  begin
    perform public.validate_literature_gold_import_review_payload_v1(
      '10000000-0000-4000-8000-000000000001',
      jsonb_set(payload, '{reviewerUserId}', '"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"'::jsonb), false
    );
    raise exception 'FAIL: uppercase UUID text was accepted';
  exception when sqlstate 'P7650' then null;
  end;
  begin
    perform public.validate_literature_gold_import_review_payload_v1(
      '10000000-0000-4000-8000-000000000001',
      jsonb_set(payload, '{startedAt}', '"infinity"'::jsonb), false
    );
    raise exception 'FAIL: PostgreSQL infinity review timestamp was accepted';
  exception when sqlstate 'P7650' then null;
  end;
  raise notice 'OK  strict scalar, UUID, array, and RFC3339 review timestamp validation holds';
end;
$$;

insert into public.literature_gold_set_events (
  id, batch_id, actor_email, event_type, after_value
)
select
  ('e0000000-0000-4000-8000-' || lpad(row_number() over ()::text, 12, '0'))::uuid,
  batch.id,
  'synthetic-rehearsal@example.invalid',
  'batch_created',
  jsonb_build_object('synthetic', true)
from public.literature_gold_set_batches as batch
where batch.id in (
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003',
  'b0000000-0000-4000-8000-000000000004'
)
order by batch.id;

create temporary table legacy_review_snapshot on commit drop as
select review.id, to_jsonb(review) as row_json
from public.literature_gold_set_reviews as review
where review.id in (
  '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000003'
);

do $$
declare
  bad_defaults text;
begin
  select string_agg(column_name || '=' || coalesce(column_default, '<null>'), ', ')
  into bad_defaults
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'literature_gold_set_reviews'
    and (
      (column_name = 'revision_kind' and column_default is distinct from '''standard''::text')
      or (column_name = 'lifecycle_state' and column_default is distinct from '''effective''::text')
    );
  perform pg_temp.assert_true(bad_defaults is null, 'additive legacy defaults are wrong: ' || coalesce(bad_defaults, ''));
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_set_reviews
    where id in (
      '11000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000003'
    ) and (
      revision_kind <> 'standard' or lifecycle_state <> 'effective'
      or operation_action_id is not null or compensates_review_id is not null
      or effective_source_review_id is not null
    )
  ), 'legacy review defaults changed historical semantics');
  raise notice 'OK  additive defaults preserve legacy standard/effective semantics';
end;
$$;

-- Development-only hash guards must reject non-development scope without
-- enumerating or returning any held-out identity.
do $$
begin
  begin
    perform public.literature_gold_effective_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'test'
    );
    raise exception 'FAIL: effective hash accepted a non-development split';
  exception when sqlstate 'P7560' then
    null;
  end;
  begin
    perform public.literature_gold_physical_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'all'
    );
    raise exception 'FAIL: physical hash accepted a non-development split';
  exception when sqlstate 'P7560' then
    null;
  end;
  raise notice 'OK  held-out scope rejected without identity output';
end;
$$;

-- Mixed success: one revision, one initial review, and one no-op.
do $$
declare
  review_a jsonb := pg_temp.review_payload(
    'synthetic imported revision A', '2031-02-01T00:00:00Z', '2031-02-01T00:01:00Z'
  );
  review_b jsonb := pg_temp.review_payload(
    'synthetic imported initial B', '2031-02-02T00:00:00Z', '2031-02-02T00:01:00Z'
  );
  actions jsonb;
  expected_post text;
  pre_effective text;
  pre_physical text;
  result jsonb;
begin
  pre_effective := public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000001', 'development'
  );
  pre_physical := public.literature_gold_physical_state_hash_v1(
    'b0000000-0000-4000-8000-000000000001', 'development'
  );
  insert into rehearsal_values values
    ('main_pre_effective', pre_effective),
    ('main_pre_physical', pre_physical);

  expected_post := pg_temp.expected_effective_hash(
    'b0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      '10000000-0000-4000-8000-000000000001', jsonb_build_object(
        'reviewStatus', 'completed',
        'review', pg_temp.effective_review_from_payload(review_a)
      ),
      '10000000-0000-4000-8000-000000000002', jsonb_build_object(
        'reviewStatus', 'completed',
        'review', pg_temp.effective_review_from_payload(review_b)
      )
    )
  );

  actions := jsonb_build_array(
    jsonb_build_object(
      'actionId', 'a1000000-0000-4000-8000-000000000001',
      'sequence', 1,
      'itemId', '10000000-0000-4000-8000-000000000001',
      'pmid', '910001',
      'datasetSplit', 'development',
      'action', 'import_revision',
      'expectedCurrentReviewId', '11000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewId', '11000000-0000-4000-8000-000000000001',
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000001'),
      'expectedRevision', 2,
      'expectedSupersedesReviewId', '11000000-0000-4000-8000-000000000001',
      'importedReviewId', '12000000-0000-4000-8000-000000000001',
      'expectedHeadReviewIdAfter', '12000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewIdAfter', '12000000-0000-4000-8000-000000000001',
      'review', review_a,
      'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_a),
      'compensationAction', 'compensate_restore',
      'expectedEventSequence', jsonb_build_array('review_imported')
    ),
    jsonb_build_object(
      'actionId', 'a1000000-0000-4000-8000-000000000002',
      'sequence', 2,
      'itemId', '10000000-0000-4000-8000-000000000002',
      'pmid', '910002',
      'datasetSplit', 'development',
      'action', 'import_initial',
      'expectedCurrentReviewId', null,
      'expectedEffectiveReviewId', null,
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000002'),
      'expectedRevision', 1,
      'expectedSupersedesReviewId', null,
      'importedReviewId', '12000000-0000-4000-8000-000000000002',
      'expectedHeadReviewIdAfter', '12000000-0000-4000-8000-000000000002',
      'expectedEffectiveReviewIdAfter', '12000000-0000-4000-8000-000000000002',
      'review', review_b,
      'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_b),
      'compensationAction', 'compensate_void',
      'expectedEventSequence', jsonb_build_array('review_imported')
    ),
    jsonb_build_object(
      'actionId', 'a1000000-0000-4000-8000-000000000003',
      'sequence', 3,
      'itemId', '10000000-0000-4000-8000-000000000003',
      'pmid', '910003',
      'datasetSplit', 'development',
      'action', 'import_noop',
      'expectedCurrentReviewId', '11000000-0000-4000-8000-000000000003',
      'expectedEffectiveReviewId', '11000000-0000-4000-8000-000000000003',
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000003'),
      'expectedRevision', null,
      'expectedSupersedesReviewId', null,
      'importedReviewId', null,
      'expectedHeadReviewIdAfter', '11000000-0000-4000-8000-000000000003',
      'expectedEffectiveReviewIdAfter', '11000000-0000-4000-8000-000000000003',
      'candidateReview', pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000003'),
      'candidateReviewSha256', public.literature_gold_jsonb_sha256_v1(
        pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000003')
      ),
      'compensationAction', 'compensate_noop',
      'expectedEventSequence', '[]'::jsonb
    )
  );

  begin
    perform pg_temp.run_import(
      'f0900000-0000-4000-8000-000000000001', repeat('9', 64),
      'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
      actions, expected_post, null, repeat('0', 64), null
    );
    raise exception 'FAIL: wrong development membership hash was accepted';
  exception when sqlstate 'P7606' then
    null;
  end;

  begin
    perform pg_temp.run_import(
      'f0900000-0000-4000-8000-000000000002', repeat('a', 64),
      'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
      actions - 2, expected_post
    );
    raise exception 'FAIL: development item omission was accepted';
  exception when sqlstate 'P7606' then
    null;
  end;

  begin
    perform pg_temp.run_import(
      'f0900000-0000-4000-8000-000000000003', repeat('b', 64),
      'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
      actions, expected_post, null, null, 2
    );
    raise exception 'FAIL: incorrect import kind subtotal was accepted';
  exception when sqlstate 'P7605' then
    null;
  end;

  begin
    perform pg_temp.run_import(
      'f0900000-0000-4000-8000-000000000004', repeat('c', 64),
      'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
      actions, expected_post, null, null, null, repeat('f', 64)
    );
    raise exception 'FAIL: internally consistent but non-derived idempotency key was accepted';
  exception when sqlstate 'P7602' then
    null;
  end;

  begin
    perform pg_temp.run_import(
      'f0900000-0000-4000-8000-000000000005', repeat('d', 64),
      'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
      jsonb_set(
        actions, '{0,preImportItemState,startedAt}',
        '"2031-02-01T00:00:00"'::jsonb
      ),
      expected_post
    );
    raise exception 'FAIL: checksum-bound offset-free pre-state timestamp was accepted';
  exception when sqlstate 'P7605' then
    null;
  end;

  begin
    perform pg_temp.run_import(
      'f0900000-0000-4000-8000-000000000006', repeat('e', 64),
      'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
      actions, expected_post, null, null, null, null, '2031-01-01'
    );
    raise exception 'FAIL: checksum-bound bare-date authorization timestamp was accepted';
  exception when sqlstate 'P7602' then
    null;
  end;

  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_review_operations
    where id in (
      'f0900000-0000-4000-8000-000000000001',
      'f0900000-0000-4000-8000-000000000002',
      'f0900000-0000-4000-8000-000000000003',
      'f0900000-0000-4000-8000-000000000004',
      'f0900000-0000-4000-8000-000000000005',
      'f0900000-0000-4000-8000-000000000006'
    )
  ), 'preflight tamper rejection wrote operation journals');
  raise notice 'OK  membership, counts, idempotency, pre-state, and authorization tampering are rejected';

  result := pg_temp.run_import(
    'f1000000-0000-4000-8000-000000000001', repeat('1', 64),
    'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
    actions, expected_post
  );
  perform pg_temp.assert_true(
    result ->> 'outcome' = 'committed',
    'mixed import did not complete: ' || result::text
  );
  perform pg_temp.assert_true((result #>> '{counts,applied}')::integer = 2, 'mixed import applied count');
  perform pg_temp.assert_true((result #>> '{counts,noops}')::integer = 1, 'mixed import no-op count');
  perform pg_temp.assert_true(
    public.literature_gold_effective_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'development'
    ) = expected_post,
    'mixed import effective hash'
  );
  perform pg_temp.assert_true(
    result ->> 'afterPhysicalStateSha256' = public.literature_gold_physical_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'development'
    ),
    'sealed import receipt physical hash does not recompute immediately'
  );
  set constraints all immediate;
  set constraints all deferred;
  raise notice 'OK  mixed initial/revision/no-op import completed atomically';
end;
$$;

do $$
declare
  replay jsonb;
  call rehearsal_calls%rowtype;
  review_count integer;
  event_count integer;
begin
  select * into call from rehearsal_calls
  where operation_id = 'f1000000-0000-4000-8000-000000000001';
  select count(*) into review_count
  from public.literature_gold_set_reviews
  where operation_action_id in (
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000003'
  );
  select count(*) into event_count
  from public.literature_gold_set_events
  where operation_id = call.operation_id;

  replay := public.apply_literature_gold_import_v1(
    call.operation_id, call.idempotency_key, call.batch_id, call.artifact_sha256,
    call.plan_sha256, call.plan, call.authorization_sha256,
    call.authorization_payload, null, 'synthetic-rehearsal@example.invalid'
  );
  perform pg_temp.assert_true(replay ->> 'outcome' = 'committed', 'idempotent replay status');
  perform pg_temp.assert_true(replay ->> 'response' = 'idempotent_replay', 'idempotent replay flag');
  perform pg_temp.assert_true(review_count = (
    select count(*) from public.literature_gold_set_reviews
    where operation_action_id in (
      'a1000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000002',
      'a1000000-0000-4000-8000-000000000003'
    )
  ), 'idempotent replay appended reviews');
  perform pg_temp.assert_true(event_count = (
    select count(*) from public.literature_gold_set_events
    where operation_id = call.operation_id
  ), 'idempotent replay appended events');

  begin
    perform pg_temp.run_import(
      call.operation_id, call.idempotency_key, call.batch_id,
      call.artifact_sha256, call.plan -> 'actions',
      public.literature_gold_effective_state_hash_v1(call.batch_id, 'development')
    );
    raise exception 'FAIL: operation identity accepted changed checksum-bound inputs';
  exception when sqlstate 'P7603' then
    null;
  end;
  perform pg_temp.assert_true(event_count = (
    select count(*) from public.literature_gold_set_events
    where operation_id = call.operation_id
  ), 'changed-input operation collision appended events');
  raise notice 'OK  exact import replay is idempotent and changed-input collision is rejected';
end;
$$;

do $$
begin
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_set_reviews as review
    join legacy_review_snapshot as snapshot on snapshot.id = review.id
    where to_jsonb(review) is distinct from snapshot.row_json
  ), 'import mutated a pre-existing immutable review row');
  perform pg_temp.assert_true((
    select array_agg(event_type order by operation_event_sequence)
    from public.literature_gold_set_events
    where operation_id = 'f1000000-0000-4000-8000-000000000001'
  ) = array['import_started', 'review_imported', 'review_imported', 'import_completed'],
  'mixed import event sequence');
  perform pg_temp.assert_true((
    select count(*) from public.literature_gold_set_reviews
    where revision_kind = 'import'
      and operation_action_id in (
        'a1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000002'
      )
  ) = 2, 'mixed import did not append exactly two import rows');
  raise notice 'OK  historical rows stayed byte-for-byte immutable and events are exact';
end;
$$;

-- A checksum-bound no-op must prove that its candidate is byte-for-byte the
-- current effective review projection; a forged candidate seals only a failed
-- audit operation and leaves review/effective state unchanged.
do $$
declare
  actions jsonb;
  before_effective text;
  result jsonb;
begin
  before_effective := public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000001', 'development'
  );
  actions := jsonb_build_array(
    jsonb_build_object(
      'actionId', 'a1010000-0000-4000-8000-000000000001', 'sequence', 1,
      'itemId', '10000000-0000-4000-8000-000000000001', 'pmid', '910001',
      'datasetSplit', 'development', 'action', 'import_noop',
      'expectedCurrentReviewId', '12000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewId', '12000000-0000-4000-8000-000000000001',
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000001'),
      'expectedRevision', null, 'expectedSupersedesReviewId', null,
      'importedReviewId', null,
      'expectedHeadReviewIdAfter', '12000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewIdAfter', '12000000-0000-4000-8000-000000000001',
      'candidateReview', pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000001'),
      'candidateReviewSha256', public.literature_gold_jsonb_sha256_v1(
        pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000001')
      ),
      'compensationAction', 'compensate_noop',
      'expectedEventSequence', '[]'::jsonb
    ),
    jsonb_build_object(
      'actionId', 'a1010000-0000-4000-8000-000000000002', 'sequence', 2,
      'itemId', '10000000-0000-4000-8000-000000000002', 'pmid', '910002',
      'datasetSplit', 'development', 'action', 'import_noop',
      'expectedCurrentReviewId', '12000000-0000-4000-8000-000000000002',
      'expectedEffectiveReviewId', '12000000-0000-4000-8000-000000000002',
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000002'),
      'expectedRevision', null, 'expectedSupersedesReviewId', null,
      'importedReviewId', null,
      'expectedHeadReviewIdAfter', '12000000-0000-4000-8000-000000000002',
      'expectedEffectiveReviewIdAfter', '12000000-0000-4000-8000-000000000002',
      'candidateReview', pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000002'),
      'candidateReviewSha256', public.literature_gold_jsonb_sha256_v1(
        pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000002')
      ),
      'compensationAction', 'compensate_noop',
      'expectedEventSequence', '[]'::jsonb
    ),
    jsonb_build_object(
      'actionId', 'a1010000-0000-4000-8000-000000000003', 'sequence', 3,
      'itemId', '10000000-0000-4000-8000-000000000003', 'pmid', '910003',
      'datasetSplit', 'development', 'action', 'import_noop',
      'expectedCurrentReviewId', '11000000-0000-4000-8000-000000000003',
      'expectedEffectiveReviewId', '11000000-0000-4000-8000-000000000003',
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000003'),
      'expectedRevision', null, 'expectedSupersedesReviewId', null,
      'importedReviewId', null,
      'expectedHeadReviewIdAfter', '11000000-0000-4000-8000-000000000003',
      'expectedEffectiveReviewIdAfter', '11000000-0000-4000-8000-000000000003',
      'candidateReview', pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000003'),
      'candidateReviewSha256', repeat('0', 64),
      'compensationAction', 'compensate_noop',
      'expectedEventSequence', '[]'::jsonb
    )
  );
  result := pg_temp.run_import(
    'f1010000-0000-4000-8000-000000000001', repeat('c', 64),
    'b0000000-0000-4000-8000-000000000001', repeat('2', 64),
    actions, before_effective
  );
  perform pg_temp.assert_true(
    result ->> 'outcome' = 'failed'
      and result ->> 'error' = 'import no-op post-state or event contract is invalid',
    'candidate hash tamper did not produce the exact failed receipt'
  );
  perform pg_temp.assert_true(exists (
    select 1 from public.literature_gold_review_operations
    where id = 'f1010000-0000-4000-8000-000000000001'
      and status = 'failed' and error_sqlstate = 'P7612'
  ), 'candidate hash tamper lost exact SQLSTATE');
  perform pg_temp.assert_true(before_effective =
    public.literature_gold_effective_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'development'
    ), 'candidate hash tamper changed effective state');
  raise notice 'OK  checksum-bound no-op candidate tampering is rejected atomically';
end;
$$;

-- Append-only compensation of the mixed import: restore the prior effective
-- payload, append a withdrawn first-review head, and preserve the no-op item.
do $$
declare
  actions jsonb;
  result jsonb;
begin
  actions := jsonb_build_array(
    jsonb_build_object(
      'actionId', 'a1100000-0000-4000-8000-000000000001',
      'sourceActionId', 'a1000000-0000-4000-8000-000000000001',
      'sequence', 1,
      'itemId', '10000000-0000-4000-8000-000000000001',
      'pmid', '910001',
      'datasetSplit', 'development',
      'action', 'compensate_restore',
      'importedReviewId', '12000000-0000-4000-8000-000000000001',
      'expectedCurrentReviewId', '12000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewId', '12000000-0000-4000-8000-000000000001',
      'expectedRevision', 3,
      'expectedSupersedesReviewId', '12000000-0000-4000-8000-000000000001',
      'compensationReviewId', '13000000-0000-4000-8000-000000000001',
      'effectiveSourceReviewId', '11000000-0000-4000-8000-000000000001',
      'expectedHeadReviewIdAfter', '13000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewIdAfter', '11000000-0000-4000-8000-000000000001',
      'expectedEventSequence', jsonb_build_array('review_compensated')
    ),
    jsonb_build_object(
      'actionId', 'a1100000-0000-4000-8000-000000000002',
      'sourceActionId', 'a1000000-0000-4000-8000-000000000002',
      'sequence', 2,
      'itemId', '10000000-0000-4000-8000-000000000002',
      'pmid', '910002',
      'datasetSplit', 'development',
      'action', 'compensate_void',
      'importedReviewId', '12000000-0000-4000-8000-000000000002',
      'expectedCurrentReviewId', '12000000-0000-4000-8000-000000000002',
      'expectedEffectiveReviewId', '12000000-0000-4000-8000-000000000002',
      'expectedRevision', 2,
      'expectedSupersedesReviewId', '12000000-0000-4000-8000-000000000002',
      'compensationReviewId', '13000000-0000-4000-8000-000000000002',
      'effectiveSourceReviewId', null,
      'expectedHeadReviewIdAfter', '13000000-0000-4000-8000-000000000002',
      'expectedEffectiveReviewIdAfter', null,
      'expectedEventSequence', jsonb_build_array('review_voided')
    ),
    jsonb_build_object(
      'actionId', 'a1100000-0000-4000-8000-000000000003',
      'sourceActionId', 'a1000000-0000-4000-8000-000000000003',
      'sequence', 3,
      'itemId', '10000000-0000-4000-8000-000000000003',
      'pmid', '910003',
      'datasetSplit', 'development',
      'action', 'compensate_noop',
      'importedReviewId', null,
      'expectedCurrentReviewId', '11000000-0000-4000-8000-000000000003',
      'expectedEffectiveReviewId', '11000000-0000-4000-8000-000000000003',
      'expectedRevision', null,
      'expectedSupersedesReviewId', null,
      'compensationReviewId', null,
      'effectiveSourceReviewId', '11000000-0000-4000-8000-000000000003',
      'expectedHeadReviewIdAfter', '11000000-0000-4000-8000-000000000003',
      'expectedEffectiveReviewIdAfter', '11000000-0000-4000-8000-000000000003',
      'expectedEventSequence', '[]'::jsonb
    )
  );

  begin
    perform pg_temp.run_compensation(
      'f1090000-0000-4000-8000-000000000001',
      'f1000000-0000-4000-8000-000000000001', repeat('1', 64),
      'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
      jsonb_set(
        actions, '{2,importedReviewId}',
        '"12000000-0000-4000-8000-000000000003"'::jsonb
      ),
      public.literature_gold_review_operation_receipt_v1(
        'f1000000-0000-4000-8000-000000000001', false
      ) #>> '{binding,contentSha256}',
      (select value from rehearsal_values where key = 'main_pre_effective')
    );
    raise exception 'FAIL: compensation no-op with importedReviewId was accepted';
  exception when sqlstate 'P7626' then null;
  end;

  begin
    perform pg_temp.run_compensation(
      'f1090000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000001', repeat('2', 64),
      'b0000000-0000-4000-8000-000000000001', repeat('a', 64),
      jsonb_set(actions, '{2,effectiveSourceReviewId}', 'null'::jsonb),
      public.literature_gold_review_operation_receipt_v1(
        'f1000000-0000-4000-8000-000000000001', false
      ) #>> '{binding,contentSha256}',
      (select value from rehearsal_values where key = 'main_pre_effective')
    );
    raise exception 'FAIL: compensation no-op effective source mismatch was accepted';
  exception when sqlstate 'P7626' then null;
  end;

  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_review_operations
    where id in (
      'f1090000-0000-4000-8000-000000000001',
      'f1090000-0000-4000-8000-000000000002'
    )
  ), 'compensation no-op parity rejection wrote an operation journal');

  result := pg_temp.run_compensation(
    'f1100000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001', repeat('2', 64),
    'b0000000-0000-4000-8000-000000000001', repeat('a', 64), actions,
    public.literature_gold_review_operation_receipt_v1(
      'f1000000-0000-4000-8000-000000000001', false
    ) #>> '{binding,contentSha256}',
    (select value from rehearsal_values where key = 'main_pre_effective')
  );
  perform pg_temp.assert_true(result ->> 'outcome' = 'committed', 'main compensation status');
  perform pg_temp.assert_true(
    public.literature_gold_effective_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'development'
    ) = (select value from rehearsal_values where key = 'main_pre_effective'),
    'compensation did not restore effective hash'
  );
  perform pg_temp.assert_true(
    public.literature_gold_physical_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'development'
    ) <> (select value from rehearsal_values where key = 'main_pre_physical'),
    'compensation incorrectly restored physical/audit hash'
  );
  perform pg_temp.assert_true(
    result ->> 'afterPhysicalStateSha256' = public.literature_gold_physical_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'development'
    ),
    'sealed compensation receipt physical hash does not recompute immediately'
  );
  set constraints all immediate;
  set constraints all deferred;
  raise notice 'OK  compensation no-op parity and append-only restore/void semantics hold';
end;
$$;

do $$
declare
  item_json jsonb;
begin
  perform pg_temp.assert_true(exists (
    select 1 from public.literature_gold_set_reviews
    where id = '13000000-0000-4000-8000-000000000001'
      and revision = 3
      and supersedes_review_id = '12000000-0000-4000-8000-000000000001'
      and compensates_review_id = '12000000-0000-4000-8000-000000000001'
      and effective_source_review_id = '11000000-0000-4000-8000-000000000001'
      and revision_kind = 'compensation' and lifecycle_state = 'effective'
  ), 'restore compensation node contract');
  perform pg_temp.assert_true(exists (
    select 1 from public.literature_gold_set_items as item
    join public.literature_gold_set_reviews as review on review.id = item.current_review_id
    where item.id = '10000000-0000-4000-8000-000000000002'
      and review.id = '13000000-0000-4000-8000-000000000002'
      and review.revision = 2
      and review.lifecycle_state = 'withdrawn'
      and item.review_status = 'pending'
      and item.completed_at is null
  ), 'withdrawn compensation head/status contract');
  item_json := public.get_literature_gold_review_item_v1(
    'b0000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002', 'all', 'development'
  );
  perform pg_temp.assert_true(item_json -> 'currentReview' = 'null'::jsonb, 'withdrawn getter exposed an effective current review');
  perform pg_temp.assert_true(item_json ->> 'chainHeadReviewId' = '13000000-0000-4000-8000-000000000002', 'getter lost physical withdrawn head');
  perform pg_temp.assert_true((
    select array_agg(event_type order by operation_event_sequence)
    from public.literature_gold_set_events
    where operation_id = 'f1100000-0000-4000-8000-000000000001'
  ) = array[
    'import_compensation_started', 'review_compensated', 'review_voided',
    'import_compensation_completed'
  ], 'compensation event sequence');
  raise notice 'OK  chain head and effective current review are distinct';
end;
$$;

-- A later import must treat the compensation node as the physical parent while
-- resolving the restored source row as the pre-import effective identity.
do $$
declare
  review_payload jsonb := pg_temp.review_payload(
    'second import after restore',
    '2031-02-10T00:00:00Z',
    '2031-02-10T00:01:00Z'
  );
  actions jsonb;
  expected_post text;
  result jsonb;
begin
  expected_post := pg_temp.expected_effective_hash(
    'b0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      '10000000-0000-4000-8000-000000000001', jsonb_build_object(
        'reviewStatus', 'completed',
        'review', pg_temp.effective_review_from_payload(review_payload)
      )
    )
  );
  actions := jsonb_build_array(
    jsonb_build_object(
      'actionId', 'a1200000-0000-4000-8000-000000000001',
      'sequence', 1,
      'itemId', '10000000-0000-4000-8000-000000000001',
      'pmid', '910001',
      'datasetSplit', 'development',
      'action', 'import_revision',
      'expectedCurrentReviewId', '13000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewId', '11000000-0000-4000-8000-000000000001',
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000001'),
      'expectedRevision', 4,
      'expectedSupersedesReviewId', '13000000-0000-4000-8000-000000000001',
      'importedReviewId', '14000000-0000-4000-8000-000000000001',
      'expectedHeadReviewIdAfter', '14000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewIdAfter', '14000000-0000-4000-8000-000000000001',
      'review', review_payload,
      'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_payload),
      'compensationAction', 'compensate_restore',
      'expectedEventSequence', jsonb_build_array('review_imported')
    ),
    jsonb_build_object(
      'actionId', 'a1200000-0000-4000-8000-000000000002',
      'sequence', 2,
      'itemId', '10000000-0000-4000-8000-000000000002',
      'pmid', '910002',
      'datasetSplit', 'development',
      'action', 'import_noop',
      'expectedCurrentReviewId', '13000000-0000-4000-8000-000000000002',
      'expectedEffectiveReviewId', null,
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000002'),
      'expectedRevision', null,
      'expectedSupersedesReviewId', null,
      'importedReviewId', null,
      'expectedHeadReviewIdAfter', '13000000-0000-4000-8000-000000000002',
      'expectedEffectiveReviewIdAfter', null,
      'candidateReview', null,
      'candidateReviewSha256', public.literature_gold_jsonb_sha256_v1('null'::jsonb),
      'compensationAction', 'compensate_noop',
      'expectedEventSequence', '[]'::jsonb
    ),
    jsonb_build_object(
      'actionId', 'a1200000-0000-4000-8000-000000000003',
      'sequence', 3,
      'itemId', '10000000-0000-4000-8000-000000000003',
      'pmid', '910003',
      'datasetSplit', 'development',
      'action', 'import_noop',
      'expectedCurrentReviewId', '11000000-0000-4000-8000-000000000003',
      'expectedEffectiveReviewId', '11000000-0000-4000-8000-000000000003',
      'preImportItemState', pg_temp.item_state('10000000-0000-4000-8000-000000000003'),
      'expectedRevision', null,
      'expectedSupersedesReviewId', null,
      'importedReviewId', null,
      'expectedHeadReviewIdAfter', '11000000-0000-4000-8000-000000000003',
      'expectedEffectiveReviewIdAfter', '11000000-0000-4000-8000-000000000003',
      'candidateReview', pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000003'),
      'candidateReviewSha256', public.literature_gold_jsonb_sha256_v1(
        pg_temp.current_effective_candidate('10000000-0000-4000-8000-000000000003')
      ),
      'compensationAction', 'compensate_noop',
      'expectedEventSequence', '[]'::jsonb
    )
  );
  result := pg_temp.run_import(
    'f1200000-0000-4000-8000-000000000001', repeat('8', 64),
    'b0000000-0000-4000-8000-000000000001', repeat('1', 64),
    actions, expected_post
  );
  perform pg_temp.assert_true(
    result ->> 'outcome' = 'committed',
    'second import after restore did not commit'
  );
  perform pg_temp.assert_true(exists (
    select 1
    from public.literature_gold_review_operation_actions as action
    join public.literature_gold_set_reviews as review
      on review.operation_action_id = action.id
    where action.id = 'a1200000-0000-4000-8000-000000000001'
      and action.pre_current_review_id = '13000000-0000-4000-8000-000000000001'
      and action.pre_effective_review_id = '11000000-0000-4000-8000-000000000001'
      and review.id = '14000000-0000-4000-8000-000000000001'
      and review.revision = 4
      and review.supersedes_review_id = '13000000-0000-4000-8000-000000000001'
  ), 'second import confused restored effective source with physical parent');
  raise notice 'OK  second import after restore preserves physical/effective identity split';
end;
$$;

-- A future ordinary reviewer save must append after the withdrawn physical
-- head at max(revision)+1; it must not create a second root or branch.
do $$
declare
  result jsonb;
  created_id uuid;
begin
  result := public.save_literature_gold_review_v1(
    '10000000-0000-4000-8000-000000000002', null,
    'future-reviewer@example.invalid',
    jsonb_build_object(
      'relevanceLabel', 'exclude',
      'metadataSufficiency', 'adequate_abstract',
      'reviewerConfidence', 'high',
      'topicIds', '[]'::jsonb,
      'technologyTags', '[]'::jsonb,
      'clinicalPurposes', '[]'::jsonb,
      'diseaseTags', '[]'::jsonb,
      'studyDesign', null,
      'publicationStatus', null,
      'categorizationFromFullText', false,
      'notes', 'ordinary review after withdrawn head',
      'usedSupplementalMetadata', false,
      'reviewSeconds', 9
    ),
    true
  );
  created_id := (result ->> 'reviewId')::uuid;
  perform pg_temp.assert_true(exists (
    select 1 from public.literature_gold_set_reviews
    where id = created_id
      and item_id = '10000000-0000-4000-8000-000000000002'
      and revision = 3
      and supersedes_review_id = '13000000-0000-4000-8000-000000000002'
      and revision_kind = 'standard'
      and lifecycle_state = 'effective'
  ), 'ordinary review after void did not append revision 3 from physical head');
  perform pg_temp.assert_true(exists (
    select 1 from public.literature_gold_set_items
    where id = '10000000-0000-4000-8000-000000000002'
      and current_review_id = created_id and review_status = 'completed'
  ), 'ordinary review did not become current physical/effective head');
  raise notice 'OK  ordinary save after void remains linear at max revision plus one';
end;
$$;

-- Injected import failure: all action rows remain as failed audit records, but
-- no review, pointer, item state, or review event from the inner savepoint may
-- survive.  Exact SQLSTATE/message must be preserved.
do $$
declare
  review_one jsonb := pg_temp.review_payload(
    'fault import one', '2031-03-01T00:00:00Z', '2031-03-01T00:01:00Z'
  );
  review_two jsonb := pg_temp.review_payload(
    'fault import two', '2031-03-02T00:00:00Z', '2031-03-02T00:01:00Z'
  );
  actions jsonb;
  before_effective text;
  before_items jsonb;
  result jsonb;
begin
  before_effective := public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000002', 'development'
  );
  select jsonb_agg(to_jsonb(item) order by item.id) into before_items
  from public.literature_gold_set_items as item
  where item.batch_id = 'b0000000-0000-4000-8000-000000000002'
    and item.dataset_split = 'development';
  actions := jsonb_build_array(
    jsonb_build_object(
      'actionId', 'a2000000-0000-4000-8000-000000000001', 'sequence', 1,
      'itemId', '20000000-0000-4000-8000-000000000001', 'pmid', '910005',
      'datasetSplit', 'development', 'action', 'import_initial',
      'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
      'preImportItemState', pg_temp.item_state('20000000-0000-4000-8000-000000000001'),
      'expectedRevision', 1, 'expectedSupersedesReviewId', null,
      'importedReviewId', '22000000-0000-4000-8000-000000000001',
      'expectedHeadReviewIdAfter', '22000000-0000-4000-8000-000000000001',
      'expectedEffectiveReviewIdAfter', '22000000-0000-4000-8000-000000000001',
      'review', review_one,
      'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_one),
      'compensationAction', 'compensate_void',
      'expectedEventSequence', jsonb_build_array('review_imported')
    ),
    jsonb_build_object(
      'actionId', 'a2000000-0000-4000-8000-000000000002', 'sequence', 2,
      'itemId', '20000000-0000-4000-8000-000000000002', 'pmid', '910006',
      'datasetSplit', 'development', 'action', 'import_initial',
      'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
      'preImportItemState', pg_temp.item_state('20000000-0000-4000-8000-000000000002'),
      'expectedRevision', 1, 'expectedSupersedesReviewId', null,
      'importedReviewId', '22000000-0000-4000-8000-000000000002',
      'expectedHeadReviewIdAfter', '22000000-0000-4000-8000-000000000002',
      'expectedEffectiveReviewIdAfter', '22000000-0000-4000-8000-000000000002',
      'review', review_two,
      'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_two),
      'compensationAction', 'compensate_void',
      'expectedEventSequence', jsonb_build_array('review_imported')
    )
  );
  result := pg_temp.run_import(
    'f2000000-0000-4000-8000-000000000001', repeat('3', 64),
    'b0000000-0000-4000-8000-000000000002', repeat('b', 64), actions,
    repeat('f', 64), 1
  );
  perform pg_temp.assert_true(result ->> 'outcome' = 'failed', 'faulted import status');
  perform pg_temp.assert_true(result ->> 'error' = 'controlled import rehearsal fault after action 1', 'faulted import message');
  perform pg_temp.assert_true(exists (
    select 1 from public.literature_gold_review_operations
    where id = 'f2000000-0000-4000-8000-000000000001'
      and error_sqlstate = 'P7699'
      and error_message = 'controlled import rehearsal fault after action 1'
  ), 'faulted import operation lost exact SQLSTATE/message');
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_set_reviews
    where operation_action_id in (
      'a2000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000002'
    )
  ), 'faulted import committed review rows');
  perform pg_temp.assert_true(before_items = (
    select jsonb_agg(to_jsonb(item) order by item.id)
    from public.literature_gold_set_items as item
    where item.batch_id = 'b0000000-0000-4000-8000-000000000002'
      and item.dataset_split = 'development'
  ), 'faulted import changed item/pointer state');
  perform pg_temp.assert_true(before_effective = public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000002', 'development'
  ), 'faulted import changed effective state');
  perform pg_temp.assert_true((
    select array_agg(event_type order by operation_event_sequence)
    from public.literature_gold_set_events
    where operation_id = 'f2000000-0000-4000-8000-000000000001'
  ) = array['import_started', 'import_failed'], 'faulted import event audit');
  perform pg_temp.assert_true((
    select count(*) from public.literature_gold_review_operation_actions
    where operation_id = 'f2000000-0000-4000-8000-000000000001'
      and action_status = 'failed'
      and result_state ->> 'errorSqlstate' = 'P7699'
  ) = 2, 'faulted import action audit');
  raise notice 'OK  injected import failure is atomic and preserves exact diagnostics';
end;
$$;

do $$
declare
  call rehearsal_calls%rowtype;
  original_receipt jsonb;
  replay jsonb;
  event_count integer;
  action_count integer;
begin
  select * into call from rehearsal_calls
  where operation_id = 'f2000000-0000-4000-8000-000000000001';
  original_receipt := public.literature_gold_review_operation_receipt_v1(
    call.operation_id, false
  );
  select count(*) into event_count from public.literature_gold_set_events
  where operation_id = call.operation_id;
  select count(*) into action_count
  from public.literature_gold_review_operation_actions
  where operation_id = call.operation_id;
  replay := public.apply_literature_gold_import_v1(
    call.operation_id, call.idempotency_key, call.batch_id, call.artifact_sha256,
    call.plan_sha256, call.plan, call.authorization_sha256,
    call.authorization_payload, null, 'synthetic-rehearsal@example.invalid'
  );
  perform pg_temp.assert_true(
    replay ->> 'outcome' = 'failed'
      and replay ->> 'response' = 'idempotent_replay'
      and replay #>> '{binding,contentSha256}' =
        original_receipt #>> '{binding,contentSha256}',
    'failed operation exact replay changed its sealed receipt identity'
  );
  perform pg_temp.assert_true(event_count = (
    select count(*) from public.literature_gold_set_events
    where operation_id = call.operation_id
  ) and action_count = (
    select count(*) from public.literature_gold_review_operation_actions
    where operation_id = call.operation_id
  ), 'failed operation replay appended audit rows');
  raise notice 'OK  exact replay of a failed import returns the sealed failure idempotently';
end;
$$;

-- Prepare a successful one-item import, then inject a compensation fault.  The
-- compensation journal remains, while its void node and pointer change do not.
do $$
declare
  review_payload jsonb := pg_temp.review_payload(
    'draft refusal candidate', '2031-03-20T00:00:00Z', '2031-03-20T00:01:00Z'
  );
  actions jsonb;
  expected_post text;
  result jsonb;
begin
  insert into public.literature_gold_set_review_drafts (
    item_id, reviewer_email, notes
  ) values (
    '30000000-0000-4000-8000-000000000001',
    'synthetic-draft@example.invalid',
    'synthetic draft must block import'
  );
  expected_post := pg_temp.expected_effective_hash(
    'b0000000-0000-4000-8000-000000000003',
    jsonb_build_object(
      '30000000-0000-4000-8000-000000000001', jsonb_build_object(
        'reviewStatus', 'completed',
        'review', pg_temp.effective_review_from_payload(review_payload)
      )
    )
  );
  actions := jsonb_build_array(jsonb_build_object(
    'actionId', 'a3010000-0000-4000-8000-000000000001', 'sequence', 1,
    'itemId', '30000000-0000-4000-8000-000000000001', 'pmid', '910008',
    'datasetSplit', 'development', 'action', 'import_initial',
    'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
    'preImportItemState', pg_temp.item_state('30000000-0000-4000-8000-000000000001'),
    'expectedRevision', 1, 'expectedSupersedesReviewId', null,
    'importedReviewId', '32100000-0000-4000-8000-000000000001',
    'expectedHeadReviewIdAfter', '32100000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewIdAfter', '32100000-0000-4000-8000-000000000001',
    'review', review_payload,
    'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_payload),
    'compensationAction', 'compensate_void',
    'expectedEventSequence', jsonb_build_array('review_imported')
  ));
  result := pg_temp.run_import(
    'f3010000-0000-4000-8000-000000000001', repeat('d', 64),
    'b0000000-0000-4000-8000-000000000003', repeat('3', 64),
    actions, expected_post
  );
  perform pg_temp.assert_true(
    result ->> 'outcome' = 'failed'
      and result ->> 'error' = 'an import cannot overwrite or ignore an unplanned review draft',
    'draft did not produce exact failed import receipt'
  );
  perform pg_temp.assert_true(exists (
    select 1 from public.literature_gold_review_operations
    where id = 'f3010000-0000-4000-8000-000000000001'
      and status = 'failed' and error_sqlstate = 'P7612'
  ), 'draft refusal lost exact SQLSTATE');
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_set_reviews
    where operation_action_id = 'a3010000-0000-4000-8000-000000000001'
  ), 'draft refusal appended a review');
  delete from public.literature_gold_set_review_drafts
  where item_id = '30000000-0000-4000-8000-000000000001';
  raise notice 'OK  an unplanned draft blocks import without review/pointer mutation';
end;
$$;

do $$
declare
  review_payload jsonb := pg_temp.review_payload(
    'compensation fault source', '2031-04-01T00:00:00Z', '2031-04-01T00:01:00Z'
  );
  actions jsonb;
  expected_post text;
  result jsonb;
begin
  expected_post := pg_temp.expected_effective_hash(
    'b0000000-0000-4000-8000-000000000003',
    jsonb_build_object(
      '30000000-0000-4000-8000-000000000001', jsonb_build_object(
        'reviewStatus', 'completed',
        'review', pg_temp.effective_review_from_payload(review_payload)
      )
    )
  );
  actions := jsonb_build_array(jsonb_build_object(
    'actionId', 'a3000000-0000-4000-8000-000000000001', 'sequence', 1,
    'itemId', '30000000-0000-4000-8000-000000000001', 'pmid', '910008',
    'datasetSplit', 'development', 'action', 'import_initial',
    'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
    'preImportItemState', pg_temp.item_state('30000000-0000-4000-8000-000000000001'),
    'expectedRevision', 1, 'expectedSupersedesReviewId', null,
    'importedReviewId', '32000000-0000-4000-8000-000000000001',
    'expectedHeadReviewIdAfter', '32000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewIdAfter', '32000000-0000-4000-8000-000000000001',
    'review', review_payload,
    'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_payload),
    'compensationAction', 'compensate_void',
    'expectedEventSequence', jsonb_build_array('review_imported')
  ));
  result := pg_temp.run_import(
    'f3000000-0000-4000-8000-000000000001', repeat('4', 64),
    'b0000000-0000-4000-8000-000000000003', repeat('d', 64), actions,
    expected_post
  );
  perform pg_temp.assert_true(result ->> 'outcome' = 'committed', 'compensation-fault source import');
end;
$$;

do $$
declare
  actions jsonb;
  before_effective text;
  before_pointer uuid;
  result jsonb;
begin
  before_effective := public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000003', 'development'
  );
  select current_review_id into before_pointer
  from public.literature_gold_set_items
  where id = '30000000-0000-4000-8000-000000000001';
  actions := jsonb_build_array(jsonb_build_object(
    'actionId', 'a3100000-0000-4000-8000-000000000001',
    'sourceActionId', 'a3000000-0000-4000-8000-000000000001',
    'sequence', 1, 'itemId', '30000000-0000-4000-8000-000000000001',
    'pmid', '910008', 'datasetSplit', 'development',
    'action', 'compensate_void',
    'importedReviewId', '32000000-0000-4000-8000-000000000001',
    'expectedCurrentReviewId', '32000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewId', '32000000-0000-4000-8000-000000000001',
    'expectedRevision', 2,
    'expectedSupersedesReviewId', '32000000-0000-4000-8000-000000000001',
    'compensationReviewId', '33000000-0000-4000-8000-000000000001',
    'effectiveSourceReviewId', null,
    'expectedHeadReviewIdAfter', '33000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewIdAfter', null,
    'expectedEventSequence', jsonb_build_array('review_voided')
  ));
  result := pg_temp.run_compensation(
    'f3100000-0000-4000-8000-000000000001',
    'f3000000-0000-4000-8000-000000000001', repeat('5', 64),
    'b0000000-0000-4000-8000-000000000003', repeat('d', 64), actions,
    public.literature_gold_review_operation_receipt_v1(
      'f3000000-0000-4000-8000-000000000001', false
    ) #>> '{binding,contentSha256}',
    (select pre_effective_state_sha256
     from public.literature_gold_review_operations
     where id = 'f3000000-0000-4000-8000-000000000001'),
    1
  );
  perform pg_temp.assert_true(result ->> 'outcome' = 'failed', 'faulted compensation status');
  perform pg_temp.assert_true(result ->> 'error' = 'controlled compensation rehearsal fault after action 1', 'faulted compensation message');
  perform pg_temp.assert_true(exists (
    select 1 from public.literature_gold_review_operations
    where id = 'f3100000-0000-4000-8000-000000000001'
      and error_sqlstate = 'P7699'
      and error_message = 'controlled compensation rehearsal fault after action 1'
  ), 'faulted compensation operation lost exact SQLSTATE/message');
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_set_reviews
    where id = '33000000-0000-4000-8000-000000000001'
  ), 'faulted compensation committed a void node');
  perform pg_temp.assert_true((
    select current_review_id from public.literature_gold_set_items
    where id = '30000000-0000-4000-8000-000000000001'
  ) = before_pointer, 'faulted compensation changed the pointer');
  perform pg_temp.assert_true(before_effective = public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000003', 'development'
  ), 'faulted compensation changed effective state');
  perform pg_temp.assert_true((
    select array_agg(event_type order by operation_event_sequence)
    from public.literature_gold_set_events
    where operation_id = 'f3100000-0000-4000-8000-000000000001'
  ) = array['import_compensation_started', 'import_compensation_failed'],
  'faulted compensation event audit');
  raise notice 'OK  injected compensation failure is atomic and preserves diagnostics';
end;
$$;

-- A separate import gains an intervening ordinary revision.  Compensation of
-- the stale import must be rejected before a compensation journal is created.
do $$
declare
  review_payload jsonb := pg_temp.review_payload(
    'stale compensation source', '2031-05-01T00:00:00Z', '2031-05-01T00:01:00Z'
  );
  actions jsonb;
  expected_post text;
  result jsonb;
begin
  expected_post := pg_temp.expected_effective_hash(
    'b0000000-0000-4000-8000-000000000004',
    jsonb_build_object(
      '40000000-0000-4000-8000-000000000001', jsonb_build_object(
        'reviewStatus', 'completed',
        'review', pg_temp.effective_review_from_payload(review_payload)
      )
    )
  );
  actions := jsonb_build_array(jsonb_build_object(
    'actionId', 'a4000000-0000-4000-8000-000000000001', 'sequence', 1,
    'itemId', '40000000-0000-4000-8000-000000000001', 'pmid', '910010',
    'datasetSplit', 'development', 'action', 'import_initial',
    'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
    'preImportItemState', pg_temp.item_state('40000000-0000-4000-8000-000000000001'),
    'expectedRevision', 1, 'expectedSupersedesReviewId', null,
    'importedReviewId', '42000000-0000-4000-8000-000000000001',
    'expectedHeadReviewIdAfter', '42000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewIdAfter', '42000000-0000-4000-8000-000000000001',
    'review', review_payload,
    'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_payload),
    'compensationAction', 'compensate_void',
    'expectedEventSequence', jsonb_build_array('review_imported')
  ));
  result := pg_temp.run_import(
    'f4000000-0000-4000-8000-000000000001', repeat('6', 64),
    'b0000000-0000-4000-8000-000000000004', repeat('f', 64), actions,
    expected_post
  );
  perform pg_temp.assert_true(result ->> 'outcome' = 'committed', 'stale source import');

  perform public.save_literature_gold_review_v1(
    '40000000-0000-4000-8000-000000000001', null,
    'intervening-reviewer@example.invalid',
    jsonb_build_object(
      'relevanceLabel', 'exclude', 'metadataSufficiency', 'adequate_abstract',
      'reviewerConfidence', 'high', 'topicIds', '[]'::jsonb,
      'technologyTags', '[]'::jsonb, 'clinicalPurposes', '[]'::jsonb,
      'diseaseTags', '[]'::jsonb, 'studyDesign', null,
      'publicationStatus', null, 'categorizationFromFullText', false,
      'notes', 'intervening ordinary revision',
      'usedSupplementalMetadata', false, 'reviewSeconds', 3
    ), true
  );
end;
$$;

do $$
declare
  actions jsonb;
begin
  actions := jsonb_build_array(jsonb_build_object(
    'actionId', 'a4100000-0000-4000-8000-000000000001',
    'sourceActionId', 'a4000000-0000-4000-8000-000000000001',
    'sequence', 1, 'itemId', '40000000-0000-4000-8000-000000000001',
    'pmid', '910010', 'datasetSplit', 'development',
    'action', 'compensate_void',
    'importedReviewId', '42000000-0000-4000-8000-000000000001',
    'expectedCurrentReviewId', '42000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewId', '42000000-0000-4000-8000-000000000001',
    'expectedRevision', 2,
    'expectedSupersedesReviewId', '42000000-0000-4000-8000-000000000001',
    'compensationReviewId', '43000000-0000-4000-8000-000000000001',
    'effectiveSourceReviewId', null,
    'expectedHeadReviewIdAfter', '43000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewIdAfter', null,
    'expectedEventSequence', jsonb_build_array('review_voided')
  ));
  begin
    perform pg_temp.run_compensation(
      'f4100000-0000-4000-8000-000000000001',
      'f4000000-0000-4000-8000-000000000001', repeat('7', 64),
      'b0000000-0000-4000-8000-000000000004', repeat('f', 64), actions,
      public.literature_gold_review_operation_receipt_v1(
        'f4000000-0000-4000-8000-000000000001', false
      ) #>> '{binding,contentSha256}',
      (select pre_effective_state_sha256
       from public.literature_gold_review_operations
       where id = 'f4000000-0000-4000-8000-000000000001')
    );
    raise exception 'FAIL: stale compensation unexpectedly started';
  exception when sqlstate 'P7629' then
    null;
  end;
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_review_operations
    where id = 'f4100000-0000-4000-8000-000000000001'
  ), 'stale compensation wrote a journal before rejection');
  raise notice 'OK  intervening revision makes compensation stale and rejects it';
end;
$$;

-- Reconciliation is deliberately read-only: terminal operations return their
-- sealed receipts, an absent identity requires fresh authorization, and a
-- started journal remains started with an explicit recovery-required result.
do $$
declare
  selected_operation public.literature_gold_review_operations%rowtype;
  completed_result jsonb;
  failed_result jsonb;
  absent_result jsonb;
  started_result jsonb;
  before_physical text;
  before_effective text;
begin
  select * into selected_operation
  from public.literature_gold_review_operations
  where id = 'f1000000-0000-4000-8000-000000000001';
  before_physical := public.literature_gold_physical_state_hash_v1(
    selected_operation.batch_id, 'development'
  );
  before_effective := public.literature_gold_effective_state_hash_v1(
    selected_operation.batch_id, 'development'
  );
  completed_result := pg_temp.recover_operation(
    selected_operation.id, selected_operation.batch_id,
    selected_operation.plan_sha256, selected_operation.idempotency_key
  );
  perform pg_temp.assert_true(
    completed_result ->> 'outcome' = 'committed'
      and completed_result ->> 'response' = 'idempotent_replay',
    'completed recovery did not return sealed committed receipt'
  );
  perform pg_temp.assert_true(
    before_physical = public.literature_gold_physical_state_hash_v1(
      selected_operation.batch_id, 'development'
    ) and before_effective = public.literature_gold_effective_state_hash_v1(
      selected_operation.batch_id, 'development'
    ), 'completed recovery mutated state'
  );

  select * into selected_operation
  from public.literature_gold_review_operations
  where id = 'f2000000-0000-4000-8000-000000000001';
  failed_result := pg_temp.recover_operation(
    selected_operation.id, selected_operation.batch_id,
    selected_operation.plan_sha256, selected_operation.idempotency_key
  );
  perform pg_temp.assert_true(
    failed_result ->> 'outcome' = 'failed'
      and failed_result ->> 'response' = 'idempotent_replay'
      and failed_result ->> 'error' = 'controlled import rehearsal fault after action 1',
    'failed recovery did not return exact sealed failure receipt'
  );

  absent_result := pg_temp.recover_operation(
    'f5000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000004',
    repeat('4', 64), repeat('f', 64)
  );
  perform pg_temp.assert_true(
    absent_result ->> 'status' = 'absent'
      and not (absent_result ->> 'permitsMutation')::boolean
      and (absent_result ->> 'requiresFreshPlanAndAuthorization')::boolean,
    'absent recovery did not require a fresh plan and authorization'
  );

  before_physical := public.literature_gold_physical_state_hash_v1(
    'b0000000-0000-4000-8000-000000000004', 'development'
  );
  before_effective := public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000004', 'development'
  );
  insert into public.literature_gold_review_operations (
    id, batch_id, operation_kind, idempotency_key, artifact_sha256,
    plan_sha256, plan, authorization_sha256, authorization_payload,
    actor_email, planned_action_count, planned_apply_count,
    planned_noop_count, pre_physical_state_sha256,
    pre_effective_state_sha256
  ) values (
    'f5000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000004', 'import', repeat('e', 64),
    repeat('4', 64), repeat('5', 64),
    jsonb_build_object('syntheticStartedRecoveryFixture', true),
    repeat('6', 64),
    jsonb_build_object('syntheticStartedRecoveryAuthorization', true),
    'synthetic-recovery@example.invalid', 1, 1, 0,
    before_physical, before_effective
  );
  before_physical := public.literature_gold_physical_state_hash_v1(
    'b0000000-0000-4000-8000-000000000004', 'development'
  );
  before_effective := public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000004', 'development'
  );
  started_result := pg_temp.recover_operation(
    'f5000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000004',
    repeat('5', 64), repeat('e', 64)
  );
  perform pg_temp.assert_true(
    started_result ->> 'status' = 'started'
      and (started_result ->> 'recoveryRequired')::boolean
      and not (started_result ->> 'permitsMutation')::boolean,
    'started recovery did not remain non-mutating and recovery-required'
  );
  perform pg_temp.assert_true(
    before_physical = public.literature_gold_physical_state_hash_v1(
      'b0000000-0000-4000-8000-000000000004', 'development'
    ) and before_effective = public.literature_gold_effective_state_hash_v1(
      'b0000000-0000-4000-8000-000000000004', 'development'
    ), 'started recovery mutated state'
  );
  raise notice 'OK  recovery distinguishes completed, failed, absent, and started without mutation';
end;
$$;

-- Direct mutation attacks: rewind, branch, update, and delete must each fail.
do $$
declare
  current_head uuid;
begin
  select current_review_id into current_head
  from public.literature_gold_set_items
  where id = '10000000-0000-4000-8000-000000000002';

  begin
    update public.literature_gold_set_items
    set current_review_id = '13000000-0000-4000-8000-000000000002',
      review_status = 'pending', completed_at = null
    where id = '10000000-0000-4000-8000-000000000002';
    set constraints check_literature_gold_chain_head_after_item immediate;
    raise exception 'FAIL: direct pointer rewind was accepted';
  exception when sqlstate 'P7542' then
    null;
  end;
  set constraints check_literature_gold_chain_head_after_item deferred;
  perform pg_temp.assert_true((
    select current_review_id from public.literature_gold_set_items
    where id = '10000000-0000-4000-8000-000000000002'
  ) = current_head, 'failed rewind did not roll back');

  begin
    insert into public.literature_gold_set_reviews (
      id, item_id, revision, supersedes_review_id, relevance_label,
      metadata_sufficiency, reviewer_confidence, notes, is_blinded,
      started_at, completed_at
    ) values (
      '14000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000002', 4,
      '13000000-0000-4000-8000-000000000002', 'exclude',
      'adequate_abstract', 'high', 'forbidden branch', true, now(), now()
    );
    raise exception 'FAIL: direct branch insert was accepted';
  exception when sqlstate 'P7531' then
    null;
  end;

  begin
    update public.literature_gold_set_reviews
    set notes = 'forbidden rewrite'
    where id = '12000000-0000-4000-8000-000000000002';
    raise exception 'FAIL: immutable review update was accepted';
  exception when others then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;

  begin
    delete from public.literature_gold_set_reviews
    where id = '12000000-0000-4000-8000-000000000002';
    raise exception 'FAIL: immutable review delete was accepted';
  exception when others then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;

  raise notice 'OK  direct rewind, branch, update, and delete are rejected';
end;
$$;

do $$
begin
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_set_reviews as review
    join legacy_review_snapshot as snapshot on snapshot.id = review.id
    where to_jsonb(review) is distinct from snapshot.row_json
  ), 'final immutable legacy-row snapshot changed');
  perform pg_temp.assert_true(not exists (
    select 1
    from public.literature_gold_set_items as item
    join lateral (
      select review.id
      from public.literature_gold_set_reviews as review
      where review.item_id = item.id
      order by review.revision desc
      limit 1
    ) as latest on true
    where item.dataset_split = 'development'
      and item.current_review_id is distinct from latest.id
  ), 'a development current_review_id is not the latest physical head');
  set constraints all immediate;
  set constraints all deferred;
  raise notice 'OK  final immutable-row and chain-head invariants hold';
end;
$$;

-- Recovery is read-only, but its authorization must still meet the exact
-- signed TypeScript contract rather than relying on PostgreSQL coercions.
do $$
declare
  authorization_content jsonb;
  authorization_sha256 text;
begin
  authorization_content := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', 'recovery_authorization',
    'authorizationId', 'fa000000-0000-4000-8000-000000000001',
    'authorized', 'true',
    'authorizedBy', 'synthetic-recovery@example.invalid',
    'authorizedAt', '2031-06-01T00:00:00Z',
    'authorizationNote', 'Malformed recovery type rejection rehearsal.',
    'targetDatabase', 'local', 'remoteWritesAllowed', false,
    'repositoryCommitSha', repeat('a', 40),
    'migrationId', '20260808035633_add_literature_gold_import_compensation_contract',
    'recoveryAction', 'resolve_ambiguous_import',
    'batchId', 'b0000000-0000-4000-8000-000000000001',
    'targetOperationId', 'f1000000-0000-4000-8000-000000000001',
    'targetPlanSha256', (select plan_sha256 from public.literature_gold_review_operations
      where id = 'f1000000-0000-4000-8000-000000000001'),
    'targetIdempotencyKey', (select idempotency_key from public.literature_gold_review_operations
      where id = 'f1000000-0000-4000-8000-000000000001'),
    'observedPhysicalStateSha256', public.literature_gold_physical_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'development'
    ),
    'observedEffectiveStateSha256', public.literature_gold_effective_state_hash_v1(
      'b0000000-0000-4000-8000-000000000001', 'development'
    ),
    'permitsMutation', false
  );
  authorization_sha256 := public.literature_gold_jsonb_sha256_v1(authorization_content);
  begin
    perform public.reconcile_literature_gold_review_operation_v1(
      'f1000000-0000-4000-8000-000000000001', authorization_sha256,
      authorization_content || jsonb_build_object(
        'binding', jsonb_build_object('contentSha256', authorization_sha256)
      )
    );
    raise exception 'FAIL: string-coerced recovery authorization boolean was accepted';
  exception when sqlstate 'P7641' then null;
  end;
  raise notice 'OK  recovery authorization rejects SQL-coercible but TS-invalid fields';
end;
$$;

-- A gold-standard batch whose test split has been explicitly unlocked must be
-- refused without selecting or emitting any held-out identity.
do $$
declare
  actions jsonb;
  effective_hash text;
begin
  update public.literature_gold_set_batches
  set kind = 'gold_standard', requested_size = 2, test_percent = 50
  where id = 'b0000000-0000-4000-8000-000000000005';

  insert into public.literature_gold_set_items (
    id, batch_id, pmid, sample_stratum, sampling_reason, sampling_metadata,
    dataset_split, display_order
  ) values (
    '50000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000005', '910012', 'ambiguous_boundary',
    'synthetic locked-test sentinel', '{}', 'test', 2
  );
  insert into public.literature_gold_set_reviews (
    id, item_id, revision, relevance_label, metadata_sufficiency,
    reviewer_confidence, notes, review_seconds, is_blinded, started_at, completed_at,
    technology_tag_status, disease_tag_status, taxonomy_version,
    label_schema_version, enrichment_schema_version, enrichment_provenance
  ) values (
    '51000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001', 1, 'exclude',
    'adequate_abstract', 'high', 'synthetic unlock development review', 5, true,
    '2030-05-01T00:00:00Z', '2030-05-01T00:01:00Z',
    'not_applicable', 'not_applicable', '2.0.0', '2.0.0', '2.0.0', 'synthetic-golden'
  );
  update public.literature_gold_set_items
  set review_status = 'completed',
    current_review_id = '51000000-0000-4000-8000-000000000001',
    started_at = '2030-05-01T00:00:00Z', completed_at = '2030-05-01T00:01:00Z'
  where id = '50000000-0000-4000-8000-000000000001';
  insert into public.literature_gold_set_events (
    id, batch_id, actor_email, event_type, after_value
  ) values (
    'e5000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000005',
    'synthetic-rehearsal@example.invalid', 'batch_created', '{"synthetic":true}'
  );
  perform public.unlock_literature_gold_test_split_v1(
    'b0000000-0000-4000-8000-000000000005', null,
    'synthetic-rehearsal@example.invalid', 'Synthetic locked-test refusal rehearsal.'
  );

  actions := jsonb_build_array(jsonb_build_object(
    'actionId', 'a5000000-0000-4000-8000-000000000001', 'sequence', 1,
    'itemId', '50000000-0000-4000-8000-000000000001', 'pmid', '10000',
    'datasetSplit', 'development', 'action', 'import_noop',
    'expectedCurrentReviewId', '51000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewId', '51000000-0000-4000-8000-000000000001',
    'preImportItemState', pg_temp.item_state('50000000-0000-4000-8000-000000000001'),
    'expectedRevision', null, 'expectedSupersedesReviewId', null,
    'importedReviewId', null,
    'expectedHeadReviewIdAfter', '51000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewIdAfter', '51000000-0000-4000-8000-000000000001',
    'candidateReview', pg_temp.current_effective_candidate('50000000-0000-4000-8000-000000000001'),
    'candidateReviewSha256', public.literature_gold_jsonb_sha256_v1(
      pg_temp.current_effective_candidate('50000000-0000-4000-8000-000000000001')
    ),
    'compensationAction', 'compensate_noop', 'expectedEventSequence', '[]'::jsonb
  ));
  effective_hash := public.literature_gold_effective_state_hash_v1(
    'b0000000-0000-4000-8000-000000000005', 'development'
  );
  begin
    perform pg_temp.run_import(
      'f5000000-0000-4000-8000-000000000001', repeat('1', 64),
      'b0000000-0000-4000-8000-000000000005', repeat('5', 64),
      actions, effective_hash
    );
    raise exception 'FAIL: import was accepted after the held-out split unlock';
  exception when sqlstate 'P7606' then null;
  end;
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_review_operations
    where id = 'f5000000-0000-4000-8000-000000000001'
  ), 'test-unlock refusal wrote a journal row');
  raise notice 'OK  unlocked gold-standard test split blocks import without identity output';
end;
$$;

-- A durable started journal for the same batch blocks a different operation;
-- it cannot be bypassed with a fresh operation id/key.
do $$
declare
  actions jsonb;
  review_payload jsonb;
begin
  insert into public.literature_gold_set_batches (
    id, name, kind, taxonomy_version, label_schema_version,
    relevance_definition_version, sampling_algorithm_version, sampling_seed,
    requested_size, test_percent, sampling_report, created_by_email
  ) values (
    'b0000000-0000-4000-8000-000000000006', 'synthetic-started-block', 'pilot',
    '2.0.0', '2.0.0', 'synthetic-v1', 'synthetic-v1', 106, 1, 0,
    '{"synthetic":true}', 'synthetic-rehearsal@example.invalid'
  );
  insert into public.literature_gold_set_items (
    id, batch_id, pmid, sample_stratum, sampling_reason, sampling_metadata,
    dataset_split, display_order
  ) values (
    '60000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000006', '910012', 'likely_non_ip',
    'synthetic started operation block', '{}', 'development', 1
  );
  insert into public.literature_gold_review_operations (
    id, batch_id, operation_kind, idempotency_key, artifact_sha256,
    plan_sha256, plan, authorization_sha256, authorization_payload,
    actor_email, planned_action_count, planned_apply_count, planned_noop_count,
    pre_physical_state_sha256, pre_effective_state_sha256
  ) values (
    'f6000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000006', 'import', repeat('6', 64),
    repeat('6', 64), repeat('6', 64), '{}', repeat('6', 64), '{}',
    'synthetic-rehearsal@example.invalid', 1, 1, 0,
    public.literature_gold_physical_state_hash_v1(
      'b0000000-0000-4000-8000-000000000006', 'development'
    ),
    public.literature_gold_effective_state_hash_v1(
      'b0000000-0000-4000-8000-000000000006', 'development'
    )
  );
  review_payload := pg_temp.review_payload(
    'blocked by durable started operation',
    '2030-06-01T00:00:00Z', '2030-06-01T00:01:00Z'
  );
  actions := jsonb_build_array(jsonb_build_object(
    'actionId', 'a6000000-0000-4000-8000-000000000001', 'sequence', 1,
    'itemId', '60000000-0000-4000-8000-000000000001', 'pmid', '910012',
    'datasetSplit', 'development', 'action', 'import_initial',
    'expectedCurrentReviewId', null, 'expectedEffectiveReviewId', null,
    'preImportItemState', pg_temp.item_state('60000000-0000-4000-8000-000000000001'),
    'expectedRevision', 1, 'expectedSupersedesReviewId', null,
    'importedReviewId', '61000000-0000-4000-8000-000000000001',
    'expectedHeadReviewIdAfter', '61000000-0000-4000-8000-000000000001',
    'expectedEffectiveReviewIdAfter', '61000000-0000-4000-8000-000000000001',
    'review', review_payload,
    'reviewSha256', public.literature_gold_jsonb_sha256_v1(review_payload),
    'compensationAction', 'compensate_void',
    'expectedEventSequence', jsonb_build_array('review_imported')
  ));
  begin
    perform pg_temp.run_import(
      'f6000000-0000-4000-8000-000000000002', repeat('7', 64),
      'b0000000-0000-4000-8000-000000000006', repeat('6', 64),
      actions, repeat('0', 64)
    );
    raise exception 'FAIL: a different operation bypassed a same-batch started journal';
  exception when sqlstate 'P7604' then null;
  end;
  perform pg_temp.assert_true(not exists (
    select 1 from public.literature_gold_review_operations
    where id = 'f6000000-0000-4000-8000-000000000002'
  ), 'same-batch started-operation refusal wrote a second journal');
  raise notice 'OK  same-batch started operation blocks a fresh mutation identity';
  set constraints all immediate;
  raise notice 'ALL GOLD IMPORT-COMPENSATION CONTRACT CHECKS PASSED';
end;
$$;

rollback;

-- The behavioral matrix above deliberately rolls back its large synthetic
-- fixture. This separate disposable-only smoke transaction proves that the
-- deferred head constraint also survives an actual COMMIT boundary.
begin;

insert into public.literature_articles (
  pmid, title, metadata_hash, normalized_title, normalized_title_hash
) values (
  '910013', 'Synthetic committed constraint article', repeat('e', 64),
  'synthetic committed constraint article', repeat('f', 64)
);

insert into public.literature_gold_set_batches (
  id, name, kind, taxonomy_version, label_schema_version,
  relevance_definition_version, sampling_algorithm_version, sampling_seed,
  requested_size, test_percent, sampling_report, created_by_email
) values (
  'b7000000-0000-4000-8000-000000000001', 'synthetic-commit-smoke', 'pilot',
  '2.0.0', '2.0.0', 'synthetic-v1', 'synthetic-v1', 107, 1, 0,
  '{"synthetic":true}', 'synthetic-rehearsal@example.invalid'
);

insert into public.literature_gold_set_items (
  id, batch_id, pmid, sample_stratum, sampling_reason, sampling_metadata,
  dataset_split, display_order
) values (
  '70000000-0000-4000-8000-000000000001',
  'b7000000-0000-4000-8000-000000000001', '910013', 'likely_non_ip',
  'synthetic committed deferred-constraint smoke', '{}', 'development', 1
);

insert into public.literature_gold_set_reviews (
  id, item_id, revision, relevance_label, metadata_sufficiency,
  reviewer_confidence, notes, is_blinded, started_at, completed_at
) values (
  '71000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001', 1, 'exclude',
  'adequate_abstract', 'high', 'committed immutable head', true,
  '2030-07-01T00:00:00Z', '2030-07-01T00:01:00Z'
);

update public.literature_gold_set_items
set review_status = 'completed',
  current_review_id = '71000000-0000-4000-8000-000000000001',
  started_at = '2030-07-01T00:00:00Z',
  completed_at = '2030-07-01T00:01:00Z'
where id = '70000000-0000-4000-8000-000000000001';

commit;

do $$
begin
  if not exists (
    select 1
    from public.literature_gold_set_items item
    join public.literature_gold_set_reviews head
      on head.id = item.current_review_id and head.item_id = item.id
    where item.id = '70000000-0000-4000-8000-000000000001'
      and item.review_status = 'completed'
      and head.revision = 1
      and head.supersedes_review_id is null
  ) then
    raise exception 'FAIL: committed deferred chain-head smoke state is missing';
  end if;
  raise notice 'OK  deferred chain-head constraints survive a committed transaction';
end;
$$;
