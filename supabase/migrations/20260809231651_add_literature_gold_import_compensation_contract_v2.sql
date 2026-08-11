-- Forward-only V2 repair for the literature gold import/compensation contract.
--
-- V1 remains historical, callable evidence.  This migration adds an explicit
-- version boundary and new V2-only helpers/RPCs; it does not replace a V1 RPC
-- or reinterpret a V1 state hash.  Existing reviews, item pointers, drafts,
-- events, operations, and actions are not updated.

-- Existing and future V1 journal rows use the fast-default V1 value.  V2 RPCs
-- always supply the V2 value explicitly.
alter table public.literature_gold_review_operations
  add column contract_version text not null
    default 'gold-review-import-compensation/1.0.0',
  add constraint literature_gold_review_operations_contract_version_check check (
    contract_version in (
      'gold-review-import-compensation/1.0.0',
      'gold-review-import-compensation/2.0.0'
    )
  );

comment on column public.literature_gold_review_operations.contract_version is
  'Immutable import/compensation machine-contract version. V1 is the historical default; V2 callers must supply gold-review-import-compensation/2.0.0 explicitly.';

-- operation_contract_version_code is independent of the nullable provenance
-- field.  It lets an upgrade expose V1 on existing operation-linked reviews
-- and NULL on existing ordinary reviews without rewriting either family.  V2
-- inserts must explicitly supply code 2.  The generated public discriminator
-- is therefore never inferred from full_text_used or any other nullable fact.
alter table public.literature_gold_set_reviews
  add column full_text_used boolean,
  add column operation_contract_version_code smallint not null default 1,
  add column operation_contract_version text generated always as (
    case
      when revision_kind = 'standard' then null
      when operation_contract_version_code = 1
        then 'gold-review-import-compensation/1.0.0'
      when operation_contract_version_code = 2
        then 'gold-review-import-compensation/2.0.0'
      else null
    end
  ) stored,
  add constraint literature_gold_reviews_contract_code_check check (
    operation_contract_version_code in (1, 2)
    and (
      (revision_kind = 'standard'
        and operation_contract_version_code = 1
        and operation_contract_version is null)
      or (revision_kind in ('import', 'compensation')
        and operation_contract_version is not null)
    )
  ),
  add constraint literature_gold_reviews_full_text_contract_check check (
    (revision_kind = 'standard' and full_text_used is null)
    or (
      operation_contract_version = 'gold-review-import-compensation/1.0.0'
      and full_text_used is null
    )
    or (
      revision_kind = 'import'
      and operation_contract_version = 'gold-review-import-compensation/2.0.0'
      and full_text_used is not null
    )
    or (
      revision_kind = 'compensation'
      and operation_contract_version = 'gold-review-import-compensation/2.0.0'
    )
  );

comment on column public.literature_gold_set_reviews.full_text_used is
  'Nullable checksum-authorized evidence that a complete PDF was used for finalized V3 enrichment. NULL means this fact was not captured; it is not false and is independent of supplemental-metadata use.';
comment on column public.literature_gold_set_reviews.operation_contract_version is
  'Generated immutable discriminator: NULL for standard reviews, V1 for V1 import/compensation reviews, and V2 for V2 import/compensation reviews.';
comment on column public.literature_gold_set_reviews.operation_contract_version_code is
  'Internal controlled marker backing operation_contract_version. V2 RPCs explicitly insert 2; ordinary and V1 inserts use the historical default 1.';

-- V1 import requirements remain unchanged.  V2 import rows still require all
-- enrichment-version fields, but source-authoritative status NULLs are valid
-- only for the exact empty excluded/uncertain categorization family.
alter table public.literature_gold_set_reviews
  drop constraint literature_gold_set_reviews_enrichment_versions_check,
  add constraint literature_gold_set_reviews_enrichment_versions_check check (
    revision_kind <> 'import'
    or (
      taxonomy_version is not null
      and label_schema_version is not null
      and enrichment_schema_version is not null
      and enrichment_provenance is not null
      and (
        (
          operation_contract_version = 'gold-review-import-compensation/1.0.0'
          and technology_tag_status is not null
          and disease_tag_status is not null
        )
        or operation_contract_version = 'gold-review-import-compensation/2.0.0'
      )
    )
  ),
  add constraint literature_gold_reviews_v2_source_shape_check check (
    revision_kind <> 'import'
    or operation_contract_version <> 'gold-review-import-compensation/2.0.0'
    or (
      relevance_label in ('include_core', 'include_adjacent')
      and technology_tag_status is not null
      and disease_tag_status is not null
    )
    or (
      relevance_label in ('exclude', 'uncertain')
      and cardinality(topic_ids) = 0
      and cardinality(technology_tags) = 0
      and cardinality(clinical_purposes) = 0
      and cardinality(disease_tags) = 0
      and study_design is null
      and publication_status is null
      and categorization_from_full_text = false
      and technology_tag_status is null
      and disease_tag_status is null
    )
  );

-- Cross-table contract linkage cannot be represented by a CHECK constraint.
-- This trigger complements (and does not replace) V1's append-only journal
-- guard.  It also prevents a compensation operation from crossing versions.
create or replace function public.enforce_literature_gold_operation_contract_v2()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target_contract text;
begin
  if tg_op = 'UPDATE' then
    if new.contract_version is distinct from old.contract_version then
      raise exception using
        errcode = 'P7700',
        message = 'literature gold operation contract version is immutable';
    end if;
    return new;
  end if;

  if new.contract_version = 'gold-review-import-compensation/2.0.0'
    and new.plan ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/2.0.0' then
    raise exception using
      errcode = 'P7700',
      message = 'a V2 operation journal requires an exact V2 plan contract';
  end if;
  if new.contract_version = 'gold-review-import-compensation/1.0.0'
    and new.plan ? 'contractVersion'
    and new.plan ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/1.0.0' then
    raise exception using
      errcode = 'P7700',
      message = 'a V1 operation journal cannot carry another plan contract';
  end if;

  if new.operation_kind = 'compensation' then
    select operation.contract_version
    into target_contract
    from public.literature_gold_review_operations as operation
    where operation.id = new.target_import_operation_id;

    if not found or target_contract is distinct from new.contract_version then
      raise exception using
        errcode = 'P7700',
        message = 'a compensation operation must target an import under the same contract version';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_literature_gold_operation_plan_v2(
  p_plan jsonb,
  p_kind text,
  p_operation_id uuid,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_plan_sha256 text,
  p_idempotency_key text
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  allowed_keys text[];
  required_keys text[];
begin
  if p_kind = 'import' then
    allowed_keys := array[
      'contractVersion', 'kind', 'operationId', 'batchId',
      'sourceArtifactSha256', 'sourceAuthorizationSetSha256',
      'noteDispositionAuditSha256', 'booleanNormalizationLedgerSha256',
      'orderedSetNormalizationLedgerSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256',
      'executionContext', 'scope', 'counts', 'actions', 'faultAfterAction',
      'binding'
    ];
    required_keys := array[
      'contractVersion', 'kind', 'operationId', 'batchId',
      'sourceArtifactSha256', 'sourceAuthorizationSetSha256',
      'noteDispositionAuditSha256', 'booleanNormalizationLedgerSha256',
      'orderedSetNormalizationLedgerSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256',
      'executionContext', 'scope', 'counts', 'actions', 'binding'
    ];
  elsif p_kind = 'compensation' then
    allowed_keys := array[
      'contractVersion', 'kind', 'operationId', 'targetImportOperationId',
      'batchId', 'importPlanSha256', 'importReceiptSha256',
      'sourceArtifactSha256', 'sourceAuthorizationSetSha256',
      'noteDispositionAuditSha256', 'booleanNormalizationLedgerSha256',
      'orderedSetNormalizationLedgerSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256',
      'executionContext', 'scope', 'counts', 'actions', 'faultAfterAction',
      'binding'
    ];
    required_keys := array[
      'contractVersion', 'kind', 'operationId', 'targetImportOperationId',
      'batchId', 'importPlanSha256', 'importReceiptSha256',
      'sourceArtifactSha256', 'sourceAuthorizationSetSha256',
      'noteDispositionAuditSha256', 'booleanNormalizationLedgerSha256',
      'orderedSetNormalizationLedgerSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256',
      'executionContext', 'scope', 'counts', 'actions', 'binding'
    ];
  else
    raise exception using errcode = 'P7708', message = 'unknown V2 operation plan kind';
  end if;

  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan, allowed_keys, required_keys, 'V2 operation plan'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'executionContext',
    array[
      'targetDatabase', 'remoteWritesAllowed', 'repositoryCommitSha',
      'migrationId', 'importRpc', 'compensationRpc', 'reconciliationRpc',
      'developmentMembershipHash', 'physicalStateHash', 'effectiveStateHash'
    ],
    array[
      'targetDatabase', 'remoteWritesAllowed', 'repositoryCommitSha',
      'migrationId', 'importRpc', 'compensationRpc', 'reconciliationRpc',
      'developmentMembershipHash', 'physicalStateHash', 'effectiveStateHash'
    ],
    'V2 operation execution context'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'scope',
    array['datasetSplit', 'heldOutIdentitiesAccessed', 'developmentMembershipSha256'],
    array['datasetSplit', 'heldOutIdentitiesAccessed', 'developmentMembershipSha256'],
    'V2 operation scope'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'binding',
    array['contentSha256', 'idempotencyKey'],
    array['contentSha256', 'idempotencyKey'],
    'V2 operation plan binding'
  );
  if p_kind = 'import' then
    perform public.assert_literature_gold_jsonb_object_v1(
      p_plan -> 'counts',
      array['total', 'initial', 'revisions', 'noops', 'inserts'],
      array['total', 'initial', 'revisions', 'noops', 'inserts'],
      'V2 import counts'
    );
  else
    perform public.assert_literature_gold_jsonb_object_v1(
      p_plan -> 'counts',
      array['total', 'restored', 'voided', 'noops'],
      array['total', 'restored', 'voided', 'noops'],
      'V2 compensation counts'
    );
  end if;

  if p_plan is null or jsonb_typeof(p_plan) <> 'object'
    or jsonb_typeof(p_plan -> 'actions') <> 'array'
    or p_plan ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/2.0.0'
    or p_plan ->> 'kind' is distinct from p_kind
    or p_plan ->> 'operationId' is distinct from p_operation_id::text
    or p_plan ->> 'batchId' is distinct from p_batch_id::text
    or p_plan ->> 'sourceArtifactSha256' is distinct from p_artifact_sha256
    or p_plan #>> '{executionContext,targetDatabase}' is distinct from 'local'
    or jsonb_typeof(p_plan #> '{executionContext,remoteWritesAllowed}') <> 'boolean'
    or (p_plan #>> '{executionContext,remoteWritesAllowed}')::boolean
      is distinct from false
    or p_plan #>> '{executionContext,migrationId}'
      is distinct from '20260809231651_add_literature_gold_import_compensation_contract_v2'
    or p_plan #>> '{executionContext,importRpc}'
      is distinct from 'apply_literature_gold_import_v2'
    or p_plan #>> '{executionContext,compensationRpc}'
      is distinct from 'compensate_literature_gold_import_v2'
    or p_plan #>> '{executionContext,reconciliationRpc}'
      is distinct from 'reconcile_literature_gold_review_operation_v2'
    or p_plan #>> '{executionContext,developmentMembershipHash}'
      is distinct from 'literature_gold_development_membership_hash_v1'
    or p_plan #>> '{executionContext,physicalStateHash}'
      is distinct from 'literature_gold_physical_state_hash_v2'
    or p_plan #>> '{executionContext,effectiveStateHash}'
      is distinct from 'literature_gold_effective_state_hash_v2'
    or p_plan #>> '{executionContext,repositoryCommitSha}' !~ '^[a-f0-9]{40}$'
    or p_plan #>> '{scope,datasetSplit}' is distinct from 'development'
    or jsonb_typeof(p_plan #> '{scope,heldOutIdentitiesAccessed}') <> 'boolean'
    or (p_plan #>> '{scope,heldOutIdentitiesAccessed}')::boolean
      is distinct from false
    or p_plan #>> '{scope,developmentMembershipSha256}' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'sourceAuthorizationSetSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'noteDispositionAuditSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'booleanNormalizationLedgerSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'orderedSetNormalizationLedgerSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedPhysicalStateSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedPostEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or p_plan #>> '{binding,contentSha256}' !~ '^[a-f0-9]{64}$'
    or p_plan #>> '{binding,idempotencyKey}' !~ '^[a-f0-9]{64}$'
    or exists (
      select 1 from jsonb_each(p_plan -> 'counts') field
      where jsonb_typeof(field.value) <> 'number'
        or field.value #>> '{}' !~ '^(0|[1-9][0-9]*)$'
    )
    or (p_plan ? 'faultAfterAction' and (
      jsonb_typeof(p_plan -> 'faultAfterAction') <> 'number'
      or p_plan ->> 'faultAfterAction' !~ '^[1-9][0-9]*$'
    )) then
    raise exception using errcode = 'P7708', message = 'V2 operation plan has a malformed, unsafe, or mismatched contract field';
  end if;

  if public.literature_gold_jsonb_sha256_v1(p_plan - 'binding')
      is distinct from p_plan_sha256
    or p_plan #>> '{binding,contentSha256}' is distinct from p_plan_sha256
    or p_plan #>> '{binding,idempotencyKey}' is distinct from p_idempotency_key
    or p_idempotency_key is distinct from public.literature_gold_jsonb_sha256_v1(
      jsonb_build_object(
        'contractVersion', 'gold-review-import-compensation/2.0.0',
        'kind', p_kind,
        'operationId', p_operation_id,
        'contentSha256', p_plan_sha256
      )
    ) then
    raise exception using errcode = 'P7708', message = 'V2 operation plan checksum or idempotency binding is invalid';
  end if;
end;
$$;

create or replace function public.literature_gold_review_operation_result_v2(
  p_operation_id uuid,
  p_idempotent boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'contractVersion', operation.contract_version,
    'operationId', operation.id,
    'operationKind', operation.operation_kind,
    'targetImportOperationId', operation.target_import_operation_id,
    'status', operation.status,
    'idempotent', p_idempotent,
    'plannedActionCount', operation.planned_action_count,
    'plannedApplyCount', operation.planned_apply_count,
    'plannedNoopCount', operation.planned_noop_count,
    'appliedActionCount', operation.applied_action_count,
    'noopActionCount', operation.noop_action_count,
    'prePhysicalStateSha256', operation.pre_physical_state_sha256,
    'postPhysicalStateSha256', operation.post_physical_state_sha256,
    'preEffectiveStateSha256', operation.pre_effective_state_sha256,
    'postEffectiveStateSha256', operation.post_effective_state_sha256,
    'errorSqlstate', operation.error_sqlstate,
    'errorMessage', operation.error_message,
    'startedAt', operation.started_at,
    'completedAt', operation.completed_at
  ))
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id
    and operation.contract_version = 'gold-review-import-compensation/2.0.0';
$$;

create or replace function public.validate_literature_gold_operation_authorization_v2(
  p_authorization jsonb,
  p_authorization_sha256 text,
  p_kind text,
  p_operation_id uuid,
  p_target_import_operation_id uuid,
  p_batch_id uuid,
  p_plan_sha256 text,
  p_idempotency_key text,
  p_artifact_sha256 text,
  p_plan jsonb
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  allowed_keys text[];
  required_string_keys text[];
begin
  if p_kind = 'import' then
    allowed_keys := array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'operationId', 'batchId',
      'planSha256', 'idempotencyKey', 'sourceArtifactSha256',
      'sourceAuthorizationSetSha256', 'noteDispositionAuditSha256',
      'booleanNormalizationLedgerSha256', 'orderedSetNormalizationLedgerSha256',
      'expectedPhysicalStateSha256', 'expectedEffectiveStateSha256',
      'expectedPostEffectiveStateSha256', 'binding'
    ];
    required_string_keys := array[
      'contractVersion', 'kind', 'authorizationId', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase',
      'repositoryCommitSha', 'migrationId', 'operationId', 'batchId',
      'planSha256', 'idempotencyKey', 'sourceArtifactSha256',
      'sourceAuthorizationSetSha256', 'noteDispositionAuditSha256',
      'booleanNormalizationLedgerSha256', 'orderedSetNormalizationLedgerSha256',
      'expectedPhysicalStateSha256', 'expectedEffectiveStateSha256',
      'expectedPostEffectiveStateSha256'
    ];
  elsif p_kind = 'compensation' then
    allowed_keys := array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'operationId',
      'targetImportOperationId', 'batchId', 'planSha256', 'idempotencyKey',
      'importReceiptSha256', 'sourceArtifactSha256',
      'sourceAuthorizationSetSha256', 'noteDispositionAuditSha256',
      'booleanNormalizationLedgerSha256', 'orderedSetNormalizationLedgerSha256',
      'expectedPhysicalStateSha256', 'expectedEffectiveStateSha256',
      'expectedPostEffectiveStateSha256', 'binding'
    ];
    required_string_keys := array[
      'contractVersion', 'kind', 'authorizationId', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase',
      'repositoryCommitSha', 'migrationId', 'operationId',
      'targetImportOperationId', 'batchId', 'planSha256', 'idempotencyKey',
      'importReceiptSha256', 'sourceArtifactSha256',
      'sourceAuthorizationSetSha256', 'noteDispositionAuditSha256',
      'booleanNormalizationLedgerSha256', 'orderedSetNormalizationLedgerSha256',
      'expectedPhysicalStateSha256', 'expectedEffectiveStateSha256',
      'expectedPostEffectiveStateSha256'
    ];
  else
    raise exception using errcode = 'P7713', message = 'unknown V2 operation authorization kind';
  end if;

  perform public.assert_literature_gold_jsonb_object_v1(
    p_authorization, allowed_keys, allowed_keys, 'V2 operation authorization'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_authorization -> 'binding',
    array['contentSha256'], array['contentSha256'],
    'V2 operation authorization binding'
  );

  if exists (
      select 1 from unnest(required_string_keys) as required(field)
      where jsonb_typeof(p_authorization -> required.field)
        is distinct from 'string'
    )
    or jsonb_typeof(p_authorization #> '{binding,contentSha256}')
      is distinct from 'string'
    or p_authorization_sha256 !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/2.0.0'
    or p_authorization ->> 'kind'
      is distinct from p_kind || '_authorization'
    or p_authorization ->> 'authorizationId'
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_authorization -> 'authorized') <> 'boolean'
    or (p_authorization ->> 'authorized')::boolean is distinct from true
    or jsonb_typeof(p_authorization -> 'authorizedBy') <> 'string'
    or length(trim(p_authorization ->> 'authorizedBy')) not between 1 and 320
    or not public.literature_gold_is_timestamptz_v1(
      p_authorization ->> 'authorizedAt'
    )
    or length(trim(p_authorization ->> 'authorizationNote')) not between 5 and 2000
    or p_authorization ->> 'targetDatabase' is distinct from 'local'
    or jsonb_typeof(p_authorization -> 'remoteWritesAllowed') <> 'boolean'
    or (p_authorization ->> 'remoteWritesAllowed')::boolean is distinct from false
    or p_authorization ->> 'repositoryCommitSha'
      is distinct from p_plan #>> '{executionContext,repositoryCommitSha}'
    or p_authorization ->> 'migrationId'
      is distinct from '20260809231651_add_literature_gold_import_compensation_contract_v2'
    or p_authorization ->> 'operationId' is distinct from p_operation_id::text
    or p_authorization ->> 'batchId' is distinct from p_batch_id::text
    or p_authorization ->> 'planSha256' is distinct from p_plan_sha256
    or p_authorization ->> 'idempotencyKey' is distinct from p_idempotency_key
    or p_authorization ->> 'sourceArtifactSha256' is distinct from p_artifact_sha256
    or p_authorization ->> 'sourceAuthorizationSetSha256'
      is distinct from p_plan ->> 'sourceAuthorizationSetSha256'
    or p_authorization ->> 'noteDispositionAuditSha256'
      is distinct from p_plan ->> 'noteDispositionAuditSha256'
    or p_authorization ->> 'booleanNormalizationLedgerSha256'
      is distinct from p_plan ->> 'booleanNormalizationLedgerSha256'
    or p_authorization ->> 'orderedSetNormalizationLedgerSha256'
      is distinct from p_plan ->> 'orderedSetNormalizationLedgerSha256'
    or p_authorization ->> 'expectedPhysicalStateSha256'
      is distinct from p_plan ->> 'expectedPhysicalStateSha256'
    or p_authorization ->> 'expectedEffectiveStateSha256'
      is distinct from p_plan ->> 'expectedEffectiveStateSha256'
    or p_authorization ->> 'expectedPostEffectiveStateSha256'
      is distinct from p_plan ->> 'expectedPostEffectiveStateSha256'
    or p_authorization #>> '{binding,contentSha256}'
      is distinct from p_authorization_sha256
    or public.literature_gold_jsonb_sha256_v1(
      p_authorization - 'binding'
    ) is distinct from p_authorization_sha256 then
    raise exception using errcode = 'P7713', message = 'V2 operation authorization is malformed, unsafe, stale, or checksum-mismatched';
  end if;

  if p_kind = 'import' and p_target_import_operation_id is not null then
    raise exception using errcode = 'P7713', message = 'V2 import authorization cannot target another operation';
  end if;
  if p_kind = 'compensation' and (
    p_target_import_operation_id is null
    or p_authorization ->> 'targetImportOperationId'
      is distinct from p_target_import_operation_id::text
    or p_authorization ->> 'importReceiptSha256'
      is distinct from p_plan ->> 'importReceiptSha256'
  ) then
    raise exception using errcode = 'P7713', message = 'V2 compensation authorization target or receipt binding is invalid';
  end if;
end;
$$;

create or replace function public.literature_gold_review_operation_receipt_v2(
  p_operation_id uuid,
  p_idempotent boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  selected_operation public.literature_gold_review_operations%rowtype;
  receipt jsonb;
  receipt_identity jsonb;
  event_sequence jsonb;
  action_counts jsonb;
begin
  select * into selected_operation
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id
    and operation.contract_version = 'gold-review-import-compensation/2.0.0';

  if not found then
    return null;
  end if;
  if selected_operation.status = 'started'
    or selected_operation.post_physical_state_sha256 is null
    or selected_operation.post_effective_state_sha256 is null then
    raise exception using errcode = 'P7709', message = 'a terminal sealed V2 operation is required to produce a receipt';
  end if;

  select coalesce(
    jsonb_agg(event.event_type order by event.operation_event_sequence),
    '[]'::jsonb
  ) into event_sequence
  from public.literature_gold_set_events as event
  where event.operation_id = p_operation_id;

  action_counts := selected_operation.plan -> 'counts';
  if selected_operation.operation_kind = 'import' and (
      (action_counts ->> 'total')::integer
        is distinct from selected_operation.planned_action_count
      or (action_counts ->> 'inserts')::integer
        is distinct from selected_operation.planned_apply_count
      or (action_counts ->> 'noops')::integer
        is distinct from selected_operation.planned_noop_count
      or ((action_counts ->> 'initial')::integer
        + (action_counts ->> 'revisions')::integer)
        is distinct from (action_counts ->> 'inserts')::integer
    ) then
    raise exception using errcode = 'P7709', message = 'sealed V2 import action counts do not reconcile to its operation journal';
  elsif selected_operation.operation_kind = 'compensation' and (
      (action_counts ->> 'total')::integer
        is distinct from selected_operation.planned_action_count
      or ((action_counts ->> 'restored')::integer
        + (action_counts ->> 'voided')::integer)
        is distinct from selected_operation.planned_apply_count
      or (action_counts ->> 'noops')::integer
        is distinct from selected_operation.planned_noop_count
    ) then
    raise exception using errcode = 'P7709', message = 'sealed V2 compensation action counts do not reconcile to its operation journal';
  end if;

  receipt := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'migrationId', '20260809231651_add_literature_gold_import_compensation_contract_v2',
    'kind', case selected_operation.operation_kind
      when 'import' then 'import_receipt' else 'compensation_receipt' end,
    'operationId', selected_operation.id,
    'batchId', selected_operation.batch_id,
    'planSha256', selected_operation.plan_sha256,
    'idempotencyKey', selected_operation.idempotency_key,
    'sourceAuthorizationSetSha256',
      selected_operation.plan ->> 'sourceAuthorizationSetSha256',
    'noteDispositionAuditSha256',
      selected_operation.plan ->> 'noteDispositionAuditSha256',
    'booleanNormalizationLedgerSha256',
      selected_operation.plan ->> 'booleanNormalizationLedgerSha256',
    'orderedSetNormalizationLedgerSha256',
      selected_operation.plan ->> 'orderedSetNormalizationLedgerSha256',
    'outcome', case selected_operation.status
      when 'completed' then 'committed' else 'failed' end,
    'response', case when p_idempotent then 'idempotent_replay' else 'applied' end,
    'beforePhysicalStateSha256', selected_operation.pre_physical_state_sha256,
    'afterPhysicalStateSha256', selected_operation.post_physical_state_sha256,
    'beforeEffectiveStateSha256', selected_operation.pre_effective_state_sha256,
    'afterEffectiveStateSha256', selected_operation.post_effective_state_sha256,
    'counts', jsonb_build_object(
      'planned', selected_operation.planned_apply_count,
      'applied', selected_operation.applied_action_count,
      'noops', selected_operation.noop_action_count
    ),
    'actionCounts', action_counts,
    'eventSequence', event_sequence,
    'error', selected_operation.error_message
  );
  if selected_operation.operation_kind = 'compensation' then
    receipt := receipt || jsonb_build_object(
      'targetImportOperationId', selected_operation.target_import_operation_id
    );
  end if;

  receipt_identity := receipt - 'response';
  return receipt || jsonb_build_object(
    'binding', jsonb_build_object(
      'contentSha256', public.literature_gold_jsonb_sha256_v1(receipt_identity)
    )
  );
end;
$$;

create or replace function public.reconcile_literature_gold_review_operation_v2(
  p_operation_id uuid,
  p_recovery_authorization_sha256 text,
  p_recovery_authorization jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  selected_operation public.literature_gold_review_operations%rowtype;
  authorized_batch_id uuid;
  current_physical_hash text;
  current_effective_hash text;
begin
  perform public.assert_literature_gold_jsonb_object_v1(
    p_recovery_authorization,
    array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'recoveryAction', 'batchId',
      'targetOperationId', 'targetPlanSha256', 'targetIdempotencyKey',
      'observedPhysicalStateSha256', 'observedEffectiveStateSha256',
      'permitsMutation', 'binding'
    ],
    array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'recoveryAction', 'batchId',
      'targetOperationId', 'targetPlanSha256', 'targetIdempotencyKey',
      'observedPhysicalStateSha256', 'observedEffectiveStateSha256',
      'permitsMutation', 'binding'
    ],
    'V2 recovery authorization'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_recovery_authorization -> 'binding',
    array['contentSha256'], array['contentSha256'],
    'V2 recovery authorization binding'
  );

  if exists (
      select 1 from unnest(array[
        'contractVersion', 'kind', 'authorizationId', 'authorizedBy',
        'authorizedAt', 'authorizationNote', 'targetDatabase',
        'repositoryCommitSha', 'migrationId', 'recoveryAction', 'batchId',
        'targetOperationId', 'targetPlanSha256', 'targetIdempotencyKey',
        'observedPhysicalStateSha256', 'observedEffectiveStateSha256'
      ]) as required(field)
      where jsonb_typeof(p_recovery_authorization -> required.field)
        is distinct from 'string'
    )
    or jsonb_typeof(p_recovery_authorization #> '{binding,contentSha256}')
      is distinct from 'string'
    or p_operation_id is null
    or p_recovery_authorization_sha256 !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/2.0.0'
    or p_recovery_authorization ->> 'kind'
      is distinct from 'recovery_authorization'
    or p_recovery_authorization ->> 'authorizationId'
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_recovery_authorization -> 'authorized') <> 'boolean'
    or (p_recovery_authorization ->> 'authorized')::boolean is distinct from true
    or jsonb_typeof(p_recovery_authorization -> 'authorizedBy') <> 'string'
    or length(trim(p_recovery_authorization ->> 'authorizedBy')) not between 1 and 320
    or not public.literature_gold_is_timestamptz_v1(
      p_recovery_authorization ->> 'authorizedAt'
    )
    or length(trim(p_recovery_authorization ->> 'authorizationNote')) not between 5 and 2000
    or p_recovery_authorization ->> 'targetDatabase' is distinct from 'local'
    or jsonb_typeof(p_recovery_authorization -> 'remoteWritesAllowed') <> 'boolean'
    or (p_recovery_authorization ->> 'remoteWritesAllowed')::boolean is distinct from false
    or p_recovery_authorization ->> 'repositoryCommitSha' !~ '^[a-f0-9]{40}$'
    or p_recovery_authorization ->> 'migrationId'
      is distinct from '20260809231651_add_literature_gold_import_compensation_contract_v2'
    or p_recovery_authorization ->> 'recoveryAction' not in (
      'resolve_ambiguous_import', 'resolve_ambiguous_compensation'
    )
    or p_recovery_authorization ->> 'batchId'
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_recovery_authorization ->> 'targetOperationId'
      is distinct from p_operation_id::text
    or p_recovery_authorization ->> 'targetPlanSha256' !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization ->> 'targetIdempotencyKey' !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization ->> 'observedPhysicalStateSha256' !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization ->> 'observedEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_recovery_authorization -> 'permitsMutation') <> 'boolean'
    or (p_recovery_authorization ->> 'permitsMutation')::boolean is distinct from false
    or p_recovery_authorization #>> '{binding,contentSha256}'
      is distinct from p_recovery_authorization_sha256
    or public.literature_gold_jsonb_sha256_v1(
      p_recovery_authorization - 'binding'
    ) is distinct from p_recovery_authorization_sha256 then
    raise exception using errcode = 'P7710', message = 'invalid non-mutating V2 recovery authorization';
  end if;

  authorized_batch_id := (p_recovery_authorization ->> 'batchId')::uuid;
  current_physical_hash := public.literature_gold_physical_state_hash_v2(
    authorized_batch_id, 'development'
  );
  current_effective_hash := public.literature_gold_effective_state_hash_v2(
    authorized_batch_id, 'development'
  );
  if p_recovery_authorization ->> 'observedPhysicalStateSha256'
      is distinct from current_physical_hash
    or p_recovery_authorization ->> 'observedEffectiveStateSha256'
      is distinct from current_effective_hash then
    raise exception using errcode = 'P7711', message = 'V2 recovery authorization does not match current physical/effective evidence';
  end if;

  select * into selected_operation
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id;
  if not found then
    return jsonb_build_object(
      'contractVersion', 'gold-review-import-compensation/2.0.0',
      'operationId', p_operation_id,
      'status', 'absent',
      'physicalStateSha256', current_physical_hash,
      'effectiveStateSha256', current_effective_hash,
      'permitsMutation', false,
      'requiresFreshPlanAndAuthorization', true
    );
  end if;

  if selected_operation.contract_version
      is distinct from 'gold-review-import-compensation/2.0.0'
    or selected_operation.batch_id is distinct from authorized_batch_id
    or selected_operation.plan_sha256 is distinct from
      p_recovery_authorization ->> 'targetPlanSha256'
    or selected_operation.idempotency_key is distinct from
      p_recovery_authorization ->> 'targetIdempotencyKey'
    or (selected_operation.operation_kind = 'import') is distinct from
      (p_recovery_authorization ->> 'recoveryAction' = 'resolve_ambiguous_import') then
    raise exception using errcode = 'P7712', message = 'V2 recovery authorization target binding is stale or mismatched';
  end if;

  if selected_operation.status in ('completed', 'failed') then
    return public.literature_gold_review_operation_receipt_v2(p_operation_id, true);
  end if;
  return public.literature_gold_review_operation_result_v2(p_operation_id, false)
    || jsonb_build_object('recoveryRequired', true, 'permitsMutation', false);
end;
$$;

create trigger enforce_literature_gold_operation_contract_v2
  before insert or update on public.literature_gold_review_operations
  for each row
  execute function public.enforce_literature_gold_operation_contract_v2();

-- Preserve V1's complete payload-copy guard and add V2's independent
-- full_text_used/version linkage.  V2 compensation restores NULL exactly when
-- its prior effective source did not capture the complete-PDF fact.
create or replace function public.enforce_literature_gold_review_contract_v2()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  linked_operation_contract text;
  linked_operation_kind text;
  source_full_text_used boolean;
  inserted_contract text;
begin
  -- Stored generated columns are computed after BEFORE triggers.  Derive the
  -- same controlled value from the independent marker for insert-time linkage.
  inserted_contract := case new.operation_contract_version_code
    when 1 then 'gold-review-import-compensation/1.0.0'
    when 2 then 'gold-review-import-compensation/2.0.0'
    else null
  end;

  if new.revision_kind = 'standard' then
    if new.operation_contract_version_code <> 1
      or new.full_text_used is not null then
      raise exception using
        errcode = 'P7701',
        message = 'ordinary reviews cannot claim import-contract or full-text import provenance';
    end if;
    return new;
  end if;

  select operation.contract_version, operation.operation_kind
  into linked_operation_contract, linked_operation_kind
  from public.literature_gold_review_operation_actions as action
  join public.literature_gold_review_operations as operation
    on operation.id = action.operation_id
  where action.id = new.operation_action_id
    and action.item_id = new.item_id;

  if not found
    or linked_operation_contract is distinct from inserted_contract
    or (new.revision_kind = 'import' and linked_operation_kind <> 'import')
    or (new.revision_kind = 'compensation' and linked_operation_kind <> 'compensation') then
    raise exception using
      errcode = 'P7701',
      message = 'review operation contract version does not match its immutable operation/action linkage';
  end if;

  if inserted_contract = 'gold-review-import-compensation/1.0.0'
    and new.full_text_used is not null then
    raise exception using
      errcode = 'P7701',
      message = 'V1 reviews cannot claim the V2 full-text persistence target';
  end if;
  if new.revision_kind = 'import'
    and inserted_contract = 'gold-review-import-compensation/2.0.0'
    and new.full_text_used is null then
    raise exception using
      errcode = 'P7701',
      message = 'V2 imported reviews require an explicit full_text_used boolean';
  end if;

  if new.revision_kind = 'compensation' then
    if new.lifecycle_state = 'effective' then
      select source.full_text_used
      into source_full_text_used
      from public.literature_gold_set_reviews as source
      where source.id = new.effective_source_review_id
        and source.item_id = new.item_id;
    else
      select imported.full_text_used
      into source_full_text_used
      from public.literature_gold_set_reviews as imported
      where imported.id = new.compensates_review_id
        and imported.item_id = new.item_id;
    end if;

    if not found or new.full_text_used is distinct from source_full_text_used then
      raise exception using
        errcode = 'P7701',
        message = 'V2 compensation must copy full_text_used exactly, including NULL';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_literature_gold_review_contract_v2
  before insert on public.literature_gold_set_reviews
  for each row
  execute function public.enforce_literature_gold_review_contract_v2();

-- V2 effective payload.  Unlike V1, this projection binds the dedicated PDF
-- provenance and the explicit operation-contract discriminator.  Null values
-- remain JSON null; no COALESCE changes their meaning.
create or replace function public.literature_gold_review_clinical_projection_v2(
  p_review_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'relevanceLabel', review.relevance_label,
    'metadataSufficiency', review.metadata_sufficiency,
    'reviewerConfidence', review.reviewer_confidence,
    'topicIds', to_jsonb(array(select value from unnest(review.topic_ids) value order by value collate "C")),
    'technologyTags', to_jsonb(array(select value from unnest(review.technology_tags) value order by value collate "C")),
    'technologyTagStatus', review.technology_tag_status,
    'clinicalPurposes', to_jsonb(array(select value from unnest(review.clinical_purposes) value order by value collate "C")),
    'diseaseTags', to_jsonb(array(select value from unnest(review.disease_tags) value order by value collate "C")),
    'diseaseTagStatus', review.disease_tag_status,
    'studyDesign', review.study_design,
    'publicationStatus', review.publication_status,
    'categorizationFromFullText', review.categorization_from_full_text,
    'fullTextUsed', review.full_text_used,
    'notes', review.notes,
    'usedSupplementalMetadata', review.used_supplemental_metadata,
    'reviewSeconds', review.review_seconds,
    'taxonomyVersion', review.taxonomy_version,
    'labelSchemaVersion', review.label_schema_version,
    'enrichmentSchemaVersion', review.enrichment_schema_version,
    'enrichmentProvenance', review.enrichment_provenance,
    'isBlinded', review.is_blinded,
    'operationContractVersion', review.operation_contract_version
  )
  from public.literature_gold_set_reviews as review
  where review.id = p_review_id;
$$;

create or replace function public.literature_gold_effective_state_hash_v2(
  p_batch_id uuid,
  p_split text default 'development'
)
returns text
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  projection jsonb;
begin
  if p_split is distinct from 'development' then
    raise exception using
      errcode = 'P7702',
      message = 'V2 state hashes are restricted to the explicitly selected development split';
  end if;
  if not exists (
    select 1 from public.literature_gold_set_batches as batch
    where batch.id = p_batch_id
  ) then
    raise exception using errcode = 'P7702', message = 'gold-set batch not found';
  end if;

  select jsonb_build_object(
    'projectionVersion', 'literature-gold-effective-state-v2',
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'datasetSplit', 'development',
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'pmid', item.pmid,
        'reviewStatus', item.review_status,
        'review', case
          when head.lifecycle_state = 'withdrawn' or head.id is null then null
          else public.literature_gold_review_clinical_projection_v2(
            coalesce(head.effective_source_review_id, head.id)
          )
        end
      ) order by item.pmid::numeric, item.id
    ), '[]'::jsonb)
  )
  into projection
  from public.literature_gold_set_items as item
  left join public.literature_gold_set_reviews as head
    on head.id = item.current_review_id and head.item_id = item.id
  where item.batch_id = p_batch_id
    and item.dataset_split = 'development';

  return public.literature_gold_jsonb_sha256_v1(projection);
end;
$$;

create or replace function public.literature_gold_physical_state_hash_v2(
  p_batch_id uuid,
  p_split text default 'development'
)
returns text
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  projection jsonb;
begin
  if p_split is distinct from 'development' then
    raise exception using
      errcode = 'P7702',
      message = 'V2 state hashes are restricted to the explicitly selected development split';
  end if;
  if not exists (
    select 1 from public.literature_gold_set_batches as batch
    where batch.id = p_batch_id
  ) then
    raise exception using errcode = 'P7702', message = 'gold-set batch not found';
  end if;

  select jsonb_build_object(
    'projectionVersion', 'literature-gold-physical-audit-state-v2',
    'contractVersion', 'gold-review-import-compensation/2.0.0',
    'datasetSplit', 'development',
    'batch', (
      select to_jsonb(batch)
      from public.literature_gold_set_batches as batch
      where batch.id = p_batch_id
    ),
    'items', coalesce((
      -- updated_at is a trigger-maintained wall clock, not semantic item state.
      select jsonb_agg(
        to_jsonb(item) - 'updated_at' order by item.pmid::numeric, item.id
      )
      from public.literature_gold_set_items as item
      where item.batch_id = p_batch_id and item.dataset_split = 'development'
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(to_jsonb(review) order by item.pmid::numeric, review.revision, review.id)
      from public.literature_gold_set_reviews as review
      join public.literature_gold_set_items as item on item.id = review.item_id
      where item.batch_id = p_batch_id and item.dataset_split = 'development'
    ), '[]'::jsonb),
    'drafts', coalesce((
      select jsonb_agg(to_jsonb(draft) order by item.pmid::numeric, draft.item_id)
      from public.literature_gold_set_review_drafts as draft
      join public.literature_gold_set_items as item on item.id = draft.item_id
      where item.batch_id = p_batch_id and item.dataset_split = 'development'
    ), '[]'::jsonb),
    'events', coalesce((
      -- Random surrogate IDs and insertion clocks do not identify audit meaning;
      -- the operation/action linkage, sequence, actors, type, and values do.
      select jsonb_agg(
        projected.payload order by projected.payload::text collate "C"
      )
      from (
        select to_jsonb(event) - array['id', 'created_at'] as payload
        from public.literature_gold_set_events as event
        left join public.literature_gold_set_items as item on item.id = event.item_id
        where event.batch_id = p_batch_id
          and (event.item_id is null or item.dataset_split = 'development')
      ) as projected
    ), '[]'::jsonb),
    'operations', coalesce((
      select jsonb_agg(
        -- State hashes are excluded to avoid self-reference. Operational clocks
        -- are excluded because authorization payloads bind their timeline anchor.
        to_jsonb(operation) - array[
          'pre_physical_state_sha256', 'post_physical_state_sha256',
          'pre_effective_state_sha256', 'post_effective_state_sha256',
          'started_at', 'completed_at'
        ] order by operation.id
      )
      from public.literature_gold_review_operations as operation
      where operation.batch_id = p_batch_id
        and operation.dataset_split = 'development'
    ), '[]'::jsonb),
    'actions', coalesce((
      -- Processing clocks are operational metadata; all planned/result payload,
      -- identities, linkage, dispositions, and structural sequence remain bound.
      select jsonb_agg(to_jsonb(action) - array['created_at', 'processed_at']
        order by operation.id, action.action_sequence)
      from public.literature_gold_review_operation_actions as action
      join public.literature_gold_review_operations as operation
        on operation.id = action.operation_id
      where operation.batch_id = p_batch_id
        and operation.dataset_split = 'development'
    ), '[]'::jsonb)
  ) into projection;

  return public.literature_gold_jsonb_sha256_v1(projection);
end;
$$;

create or replace function public.validate_literature_gold_import_review_payload_v2(
  p_item_id uuid,
  p_review jsonb,
  p_expected_first_effective boolean
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  selected_item public.literature_gold_set_items%rowtype;
  relevance text;
  topic_ids text[];
  technology_tags text[];
  clinical_purposes text[];
  disease_tags text[];
  technology_status text;
  disease_status text;
  study_design text;
  publication_status text;
  used_supplemental boolean;
begin
  -- The argument is retained to keep the V1/V2 helper boundary mechanically
  -- comparable.  V2 intentionally does not derive source blinding from first
  -- local effectiveness.
  perform p_expected_first_effective;

  select * into selected_item
  from public.literature_gold_set_items as item
  where item.id = p_item_id;

  if not found or p_review is null or jsonb_typeof(p_review) <> 'object'
    or jsonb_typeof(p_review -> 'topicIds') <> 'array'
    or jsonb_typeof(p_review -> 'technologyTags') <> 'array'
    or jsonb_typeof(p_review -> 'clinicalPurposes') <> 'array'
    or jsonb_typeof(p_review -> 'diseaseTags') <> 'array' then
    raise exception using errcode = 'P7703', message = 'V2 import review payload is incomplete';
  end if;

  perform public.assert_literature_gold_jsonb_object_v1(
    p_review,
    array[
      'relevanceLabel', 'metadataSufficiency', 'reviewerConfidence', 'topicIds',
      'technologyTags', 'technologyTagStatus', 'clinicalPurposes', 'diseaseTags',
      'diseaseTagStatus', 'studyDesign', 'publicationStatus',
      'categorizationFromFullText', 'fullTextUsed', 'notes',
      'usedSupplementalMetadata', 'reviewSeconds', 'taxonomyVersion',
      'labelSchemaVersion', 'enrichmentSchemaVersion', 'enrichmentProvenance',
      'reviewerUserId', 'reviewerEmail', 'isBlinded', 'startedAt', 'completedAt',
      'createdAt'
    ],
    array[
      'relevanceLabel', 'metadataSufficiency', 'reviewerConfidence', 'topicIds',
      'technologyTags', 'technologyTagStatus', 'clinicalPurposes', 'diseaseTags',
      'diseaseTagStatus', 'studyDesign', 'publicationStatus',
      'categorizationFromFullText', 'fullTextUsed', 'notes',
      'usedSupplementalMetadata', 'reviewSeconds', 'taxonomyVersion',
      'labelSchemaVersion', 'enrichmentSchemaVersion', 'enrichmentProvenance',
      'reviewerUserId', 'reviewerEmail', 'isBlinded', 'startedAt', 'completedAt',
      'createdAt'
    ],
    'V2 import review payload'
  );

  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'relevanceLabel', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'metadataSufficiency', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'reviewerConfidence', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'technologyTagStatus', 'string', true, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'diseaseTagStatus', 'string', true, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'studyDesign', 'string', true, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'publicationStatus', 'string', true, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'categorizationFromFullText', 'boolean', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'fullTextUsed', 'boolean', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'notes', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'usedSupplementalMetadata', 'boolean', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'reviewSeconds', 'number', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'taxonomyVersion', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'labelSchemaVersion', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'enrichmentSchemaVersion', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'enrichmentProvenance', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'reviewerUserId', 'string', true, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'reviewerEmail', 'string', true, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'isBlinded', 'boolean', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'startedAt', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'completedAt', 'string', false, 'V2 import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'createdAt', 'string', false, 'V2 import review payload');

  if exists (
    select 1 from jsonb_array_elements(p_review -> 'topicIds') element
    where jsonb_typeof(element) <> 'string'
      or length(trim(element #>> '{}')) not between 1 and 160
  ) or exists (
    select 1 from jsonb_array_elements(p_review -> 'technologyTags') element
    where jsonb_typeof(element) <> 'string'
      or length(trim(element #>> '{}')) not between 1 and 160
  ) or exists (
    select 1 from jsonb_array_elements(p_review -> 'clinicalPurposes') element
    where jsonb_typeof(element) <> 'string'
      or length(trim(element #>> '{}')) not between 1 and 160
  ) or exists (
    select 1 from jsonb_array_elements(p_review -> 'diseaseTags') element
    where jsonb_typeof(element) <> 'string'
      or length(trim(element #>> '{}')) not between 1 and 160
  ) or p_review ->> 'reviewSeconds' !~ '^(0|[1-9][0-9]*)$'
    or (jsonb_typeof(p_review -> 'reviewerUserId') <> 'null'
      and p_review ->> 'reviewerUserId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or (jsonb_typeof(p_review -> 'reviewerEmail') <> 'null'
      and length(trim(p_review ->> 'reviewerEmail')) not between 1 and 320)
    or not public.literature_gold_is_timestamptz_v1(p_review ->> 'startedAt')
    or not public.literature_gold_is_timestamptz_v1(p_review ->> 'completedAt')
    or not public.literature_gold_is_timestamptz_v1(p_review ->> 'createdAt') then
    raise exception using errcode = 'P7703', message = 'V2 import review has invalid scalar or array element types';
  end if;

  relevance := p_review ->> 'relevanceLabel';
  topic_ids := array(select jsonb_array_elements_text(p_review -> 'topicIds'));
  technology_tags := array(select jsonb_array_elements_text(p_review -> 'technologyTags'));
  clinical_purposes := array(select jsonb_array_elements_text(p_review -> 'clinicalPurposes'));
  disease_tags := array(select jsonb_array_elements_text(p_review -> 'diseaseTags'));
  technology_status := case when jsonb_typeof(p_review -> 'technologyTagStatus') = 'null'
    then null else p_review ->> 'technologyTagStatus' end;
  disease_status := case when jsonb_typeof(p_review -> 'diseaseTagStatus') = 'null'
    then null else p_review ->> 'diseaseTagStatus' end;
  study_design := case when jsonb_typeof(p_review -> 'studyDesign') = 'null'
    then null else p_review ->> 'studyDesign' end;
  publication_status := case when jsonb_typeof(p_review -> 'publicationStatus') = 'null'
    then null else p_review ->> 'publicationStatus' end;
  used_supplemental := (p_review ->> 'usedSupplementalMetadata')::boolean;

  if relevance not in ('include_core', 'include_adjacent', 'exclude', 'uncertain')
    or p_review ->> 'metadataSufficiency' not in (
      'adequate_abstract', 'limited_abstract', 'no_abstract', 'conflicting_metadata'
    )
    or p_review ->> 'reviewerConfidence' not in ('high', 'moderate', 'low')
    or length(p_review ->> 'notes') > 4000
    or (p_review ->> 'reviewSeconds')::integer not between 0 and 86400
    or cardinality(topic_ids) > 100
    or cardinality(technology_tags) > 100
    or cardinality(clinical_purposes) > 30
    or cardinality(disease_tags) > 30
    or cardinality(topic_ids) <> cardinality(array(select distinct value from unnest(topic_ids) value))
    or cardinality(technology_tags) <> cardinality(array(select distinct value from unnest(technology_tags) value))
    or cardinality(clinical_purposes) <> cardinality(array(select distinct value from unnest(clinical_purposes) value))
    or cardinality(disease_tags) <> cardinality(array(select distinct value from unnest(disease_tags) value)) then
    raise exception using errcode = 'P7704', message = 'V2 import review labels, notes, elapsed time, or uniqueness are invalid';
  end if;

  if nullif(trim(p_review ->> 'taxonomyVersion'), '') is null
    or nullif(trim(p_review ->> 'labelSchemaVersion'), '') is null
    or nullif(trim(p_review ->> 'enrichmentSchemaVersion'), '') is null
    or nullif(trim(p_review ->> 'enrichmentProvenance'), '') is null then
    raise exception using errcode = 'P7704', message = 'V2 import enrichment versions or provenance are invalid';
  end if;

  if relevance in ('include_core', 'include_adjacent') then
    if cardinality(topic_ids) = 0 or cardinality(clinical_purposes) = 0
      or study_design is null or publication_status is null
      or technology_status is null
      or technology_status not in ('tagged', 'not_applicable', 'not_assessable')
      or disease_status is null
      or disease_status not in ('tagged', 'not_applicable', 'not_assessable')
      or (cardinality(technology_tags) > 0) is distinct from (technology_status = 'tagged')
      or (cardinality(disease_tags) > 0) is distinct from (disease_status = 'tagged') then
      raise exception using errcode = 'P7705', message = 'included V2 imports require complete labels and exact non-null tag statuses';
    end if;
  elsif cardinality(topic_ids) <> 0 or cardinality(technology_tags) <> 0
    or cardinality(clinical_purposes) <> 0 or cardinality(disease_tags) <> 0
    or study_design is not null or publication_status is not null
    or (p_review ->> 'categorizationFromFullText')::boolean
    or technology_status is not null or disease_status is not null then
    raise exception using errcode = 'P7705', message = 'excluded or uncertain V2 imports require the exact empty source-null status shape';
  end if;

  if exists (
    select 1 from unnest(topic_ids) as supplied(value)
    where supplied.value <> all(array[
      'basic-bronchoscopy', 'ebus-mediastinal-staging', 'peripheral-navigation',
      'peripheral-biopsy-localization', 'central-airway-obstruction',
      'airway-stents-stenosis', 'pleural-interventions',
      'bronchoscopic-lung-volume-reduction', 'persistent-air-leak-fistula',
      'transbronchial-cryobiopsy', 'hemoptysis-airway-bleeding',
      'tracheostomy-airway-access', 'bronchoscopic-tumor-ablation',
      'other-advanced-bronchoscopy', 'safety-anesthesia-complications',
      'education-simulation-quality', 'ai-imaging-technology',
      'adjacent-surgical-procedural-analogue',
      'specimen-adequacy-molecular-pathology', 'health-services-economics'
    ]::text[])
  ) or exists (
    select 1 from unnest(technology_tags) as supplied(value)
    where supplied.value <> all(array[
      'convex-ebus', 'eus-b', 'radial-ebus', 'robotic-bronchoscopy',
      'electromagnetic-navigation', 'cone-beam-ct', 'augmented-fluoroscopy',
      'virtual-bronchoscopy', 'transbronchial-cryobiopsy', 'endobronchial-valve',
      'airway-stent', 'rigid-bronchoscopy', 'electrocautery',
      'argon-plasma-coagulation', 'laser', 'cryotherapy', 'photodynamic-therapy',
      'brachytherapy', 'indwelling-pleural-catheter', 'medical-thoracoscopy',
      'bronchial-thermoplasty', 'whole-lung-lavage', 'percutaneous-tracheostomy',
      'thoracentesis', 'chest-tube', 'pleurodesis', 'bronchoalveolar-lavage',
      'conventional-tbna', 'rapid-on-site-evaluation', 'endobronchial-coils',
      'balloon-bronchoplasty', 'mediastinal-cryobiopsy', 'foreign-body-removal',
      'bronchial-artery-embolization', 'narrow-band-imaging',
      'autofluorescence-bronchoscopy', 'confocal-laser-endomicroscopy',
      'topical-hemostatic-agent', 'transbronchial-thermal-ablation', 'surgical-vats'
    ]::text[])
  ) or exists (
    select 1 from unnest(clinical_purposes) as supplied(value)
    where supplied.value <> all(array[
      'diagnosis', 'staging', 'treatment', 'palliation', 'surveillance',
      'localization', 'training', 'safety-complication-prevention',
      'multiple-general-overview', 'not-assessable-from-available-metadata',
      'cost-effectiveness-health-services', 'specimen-adequacy',
      'workflow-operations-quality'
    ]::text[])
  ) or exists (
    select 1 from unnest(disease_tags) as supplied(value)
    where supplied.value <> all(array[
      'lung-cancer', 'mesothelioma', 'emphysema', 'interstitial-lung-disease',
      'immune-inflammatory-disease', 'infection', 'transplant',
      'benign-airway-stenosis', 'pleural-disease',
      'lymphoma-hematologic-malignancy', 'metastatic-extrathoracic-malignancy',
      'tracheobronchomalacia-edac', 'asthma', 'foreign-body-aspiration',
      'hemoptysis', 'bronchiectasis', 'pulmonary-alveolar-proteinosis',
      'airway-amyloidosis', 'congenital-airway-disorder'
    ]::text[])
  ) then
    raise exception using errcode = 'P7706', message = 'V2 import review contains an unknown taxonomy 2.0 controlled label';
  end if;

  if study_design is not null and study_design <> all(array[
    'randomized-trial', 'prospective-cohort', 'retrospective-cohort',
    'diagnostic-accuracy', 'systematic-review', 'meta-analysis', 'guideline',
    'consensus', 'case-series', 'case-report', 'technical-note', 'editorial',
    'review-article', 'not-assessable-from-available-metadata',
    'cross-sectional-survey', 'economic-evaluation', 'animal-preclinical',
    'bench-in-vitro', 'qualitative-study', 'case-control'
  ]::text[]) then
    raise exception using errcode = 'P7706', message = 'V2 import review contains an unknown study design';
  end if;
  if publication_status is not null and publication_status <> all(array[
    'full-article', 'conference-abstract', 'letter', 'editorial', 'correction',
    'retraction', 'protocol', 'interactive-clinical-case',
    'not-assessable-from-available-metadata'
  ]::text[]) then
    raise exception using errcode = 'P7706', message = 'V2 import review contains an unknown publication status';
  end if;

  if used_supplemental is distinct from
      (selected_item.supplemental_metadata_revealed_at is not null) then
    raise exception using
      errcode = 'P7707',
      message = 'V2 supplemental-metadata use must match its independent local reveal event';
  end if;
  -- isBlinded is checksum-authorized source-review provenance in V2.  It is
  -- intentionally not compared to automated_signals_revealed_at, and this
  -- helper never writes either reveal timestamp.
  if (p_review ->> 'completedAt')::timestamptz
      < (p_review ->> 'startedAt')::timestamptz then
    raise exception using errcode = 'P7707', message = 'V2 import review requires valid checksum-bound timestamps';
  end if;
end;
$$;

create or replace function public.apply_literature_gold_import_v2(
  p_operation_id uuid,
  p_idempotency_key text,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_plan_sha256 text,
  p_plan jsonb,
  p_authorization_sha256 text,
  p_authorization jsonb,
  p_actor_user_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  normalized_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  normalized_email text := nullif(trim(coalesce(p_actor_email, '')), '');
  mutation_anchor timestamptz;
  terminal_anchor timestamptz;
  existing_operation public.literature_gold_review_operations%rowtype;
  locked_batch public.literature_gold_set_batches%rowtype;
  action_json jsonb;
  review_json jsonb;
  action_row public.literature_gold_review_operation_actions%rowtype;
  locked_item public.literature_gold_set_items%rowtype;
  head_review public.literature_gold_set_reviews%rowtype;
  created_review public.literature_gold_set_reviews%rowtype;
  actual_effective_review_id uuid;
  expected_current_review_id uuid;
  expected_effective_review_id uuid;
  expected_supersedes_review_id uuid;
  expected_revision integer;
  planned_action_count integer;
  planned_initial_count integer;
  planned_revision_count integer;
  planned_apply_count integer;
  planned_noop_count integer;
  applied_count integer := 0;
  noop_count integer := 0;
  pre_physical_hash text;
  pre_effective_hash text;
  post_physical_hash text;
  post_effective_hash text;
  expected_post_effective_hash text;
  development_membership_hash text;
  current_effective_payload jsonb;
  fault_after_action integer;
  caught_sqlstate text;
  caught_message text;
begin
  if p_operation_id is null or p_batch_id is null
    or normalized_key !~ '^[a-f0-9]{64}$'
    or p_artifact_sha256 !~ '^[a-f0-9]{64}$'
    or p_plan_sha256 !~ '^[a-f0-9]{64}$'
    or p_authorization_sha256 !~ '^[a-f0-9]{64}$'
    or (p_actor_user_id is null and normalized_email is null) then
    raise exception using errcode = 'P7720', message = 'V2 import identities, actor, and lowercase SHA-256 bindings are required';
  end if;

  perform public.validate_literature_gold_operation_plan_v2(
    p_plan, 'import', p_operation_id, p_batch_id, p_artifact_sha256,
    p_plan_sha256, normalized_key
  );
  perform public.validate_literature_gold_operation_authorization_v2(
    p_authorization, p_authorization_sha256, 'import', p_operation_id, null,
    p_batch_id, p_plan_sha256, normalized_key, p_artifact_sha256, p_plan
  );
  -- All V2 operational clocks derive from this checksum-bound authorization
  -- field, so the same sealed package produces the same append-only timeline.
  mutation_anchor := (p_authorization ->> 'authorizedAt')::timestamptz;

  perform pg_advisory_xact_lock(
    hashtextextended(least(p_operation_id::text, 'v2-import:' || normalized_key), 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(greatest(p_operation_id::text, 'v2-import:' || normalized_key), 0)
  );

  select * into existing_operation
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id
     or (operation.operation_kind = 'import'
       and operation.idempotency_key = normalized_key)
  order by case when operation.id = p_operation_id then 0 else 1 end
  limit 1
  for update;

  if found then
    if existing_operation.id is distinct from p_operation_id
      or existing_operation.contract_version
        is distinct from 'gold-review-import-compensation/2.0.0'
      or existing_operation.operation_kind <> 'import'
      or existing_operation.idempotency_key is distinct from normalized_key
      or existing_operation.batch_id is distinct from p_batch_id
      or existing_operation.artifact_sha256 is distinct from p_artifact_sha256
      or existing_operation.plan_sha256 is distinct from p_plan_sha256
      or existing_operation.plan is distinct from p_plan
      or existing_operation.authorization_sha256 is distinct from p_authorization_sha256
      or existing_operation.authorization_payload is distinct from p_authorization then
      raise exception using errcode = 'P7721', message = 'V2 idempotency identity was reused with different import inputs';
    end if;
    if existing_operation.status = 'started' then
      raise exception using errcode = 'P7722', message = 'an existing started V2 import requires explicit recovery authorization';
    end if;
    return public.literature_gold_review_operation_receipt_v2(
      existing_operation.id, true
    );
  end if;

  planned_action_count := jsonb_array_length(p_plan -> 'actions');
  select
    count(*) filter (where value ->> 'action' = 'import_initial')::integer,
    count(*) filter (where value ->> 'action' = 'import_revision')::integer,
    count(*) filter (where value ->> 'action' in ('import_initial', 'import_revision'))::integer,
    count(*) filter (where value ->> 'action' = 'import_noop')::integer
  into planned_initial_count, planned_revision_count,
    planned_apply_count, planned_noop_count
  from jsonb_array_elements(p_plan -> 'actions');

  if planned_action_count < 1 or planned_action_count > 5000
    or planned_apply_count + planned_noop_count <> planned_action_count
    or (p_plan #>> '{counts,total}')::integer is distinct from planned_action_count
    or (p_plan #>> '{counts,initial}')::integer is distinct from planned_initial_count
    or (p_plan #>> '{counts,revisions}')::integer is distinct from planned_revision_count
    or (p_plan #>> '{counts,inserts}')::integer is distinct from planned_apply_count
    or (p_plan #>> '{counts,noops}')::integer is distinct from planned_noop_count then
    raise exception using errcode = 'P7723', message = 'V2 import plan counts or action dispositions are invalid';
  end if;

  for action_json in select value from jsonb_array_elements(p_plan -> 'actions') loop
    if action_json ->> 'action' in ('import_initial', 'import_revision') then
      perform public.assert_literature_gold_jsonb_object_v1(
        action_json,
        array[
          'actionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
          'expectedCurrentReviewId', 'expectedEffectiveReviewId',
          'preImportItemState', 'action', 'expectedRevision',
          'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter',
          'review', 'reviewSha256', 'compensationAction',
          'expectedEventSequence'
        ],
        array[
          'actionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
          'expectedCurrentReviewId', 'expectedEffectiveReviewId',
          'preImportItemState', 'action', 'expectedRevision',
          'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter',
          'review', 'reviewSha256', 'compensationAction',
          'expectedEventSequence'
        ], 'V2 applied import action'
      );
    elsif action_json ->> 'action' = 'import_noop' then
      perform public.assert_literature_gold_jsonb_object_v1(
        action_json,
        array[
          'actionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
          'expectedCurrentReviewId', 'expectedEffectiveReviewId',
          'preImportItemState', 'action', 'expectedRevision',
          'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter',
          'candidateReview', 'candidateReviewSha256', 'compensationAction',
          'expectedEventSequence'
        ],
        array[
          'actionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
          'expectedCurrentReviewId', 'expectedEffectiveReviewId',
          'preImportItemState', 'action', 'expectedRevision',
          'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter',
          'candidateReview', 'candidateReviewSha256', 'compensationAction',
          'expectedEventSequence'
        ], 'V2 import no-op action'
      );
    else
      raise exception using errcode = 'P7723', message = 'V2 import action has an unknown disposition';
    end if;

    perform public.assert_literature_gold_jsonb_object_v1(
      action_json -> 'preImportItemState',
      array[
        'reviewStatus', 'startedAt', 'completedAt',
        'supplementalMetadataRevealedAt', 'automatedSignalsRevealedAt'
      ],
      array[
        'reviewStatus', 'startedAt', 'completedAt',
        'supplementalMetadataRevealedAt', 'automatedSignalsRevealedAt'
      ], 'V2 import action pre-state'
    );

    if action_json ->> 'actionId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(action_json -> 'sequence') <> 'number'
      or action_json ->> 'sequence' !~ '^[1-9][0-9]*$'
      or action_json ->> 'itemId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or action_json ->> 'pmid' !~ '^[0-9]{1,12}$'
      or action_json ->> 'datasetSplit' is distinct from 'development'
      or jsonb_typeof(action_json -> 'expectedEventSequence') <> 'array'
      or exists (
        select 1 from jsonb_array_elements(action_json -> 'expectedEventSequence') element
        where jsonb_typeof(element) <> 'string'
      )
      or jsonb_typeof(action_json #> '{preImportItemState,reviewStatus}') <> 'string'
      or action_json #>> '{preImportItemState,reviewStatus}' not in (
        'pending', 'in_progress', 'return_later', 'completed'
      )
      or exists (
        select 1 from unnest(array[
          'startedAt', 'completedAt', 'supplementalMetadataRevealedAt',
          'automatedSignalsRevealedAt'
        ]) field
        where jsonb_typeof(action_json -> 'preImportItemState' -> field)
            not in ('string', 'null')
          or (jsonb_typeof(action_json -> 'preImportItemState' -> field) = 'string'
            and not public.literature_gold_is_timestamptz_v1(
              action_json -> 'preImportItemState' ->> field
            ))
      )
      or exists (
        select 1 from unnest(array[
          'expectedCurrentReviewId', 'expectedEffectiveReviewId',
          'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter'
        ]) field
        where jsonb_typeof(action_json -> field) not in ('string', 'null')
          or (jsonb_typeof(action_json -> field) = 'string'
            and action_json ->> field
              !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      )
      or jsonb_typeof(action_json -> 'expectedRevision') not in ('number', 'null')
      or (jsonb_typeof(action_json -> 'expectedRevision') = 'number'
        and action_json ->> 'expectedRevision' !~ '^[1-9][0-9]*$')
      or (action_json ->> 'action' in ('import_initial', 'import_revision') and (
        jsonb_typeof(action_json -> 'review') <> 'object'
        or action_json ->> 'reviewSha256' !~ '^[a-f0-9]{64}$'
      ))
      or (action_json ->> 'action' = 'import_noop' and (
        jsonb_typeof(action_json -> 'candidateReview') <> 'object'
        or action_json ->> 'candidateReviewSha256' !~ '^[a-f0-9]{64}$'
        or jsonb_typeof(action_json -> 'expectedRevision') <> 'null'
        or jsonb_typeof(action_json -> 'expectedSupersedesReviewId') <> 'null'
        or jsonb_typeof(action_json -> 'importedReviewId') <> 'null'
      ))
      or (action_json ->> 'action' = 'import_initial' and (
        jsonb_typeof(action_json -> 'expectedCurrentReviewId') <> 'null'
        or jsonb_typeof(action_json -> 'expectedEffectiveReviewId') <> 'null'
        or jsonb_typeof(action_json -> 'expectedSupersedesReviewId') <> 'null'
        or jsonb_typeof(action_json -> 'expectedRevision') <> 'number'
        or (action_json ->> 'expectedRevision')::integer <> 1
        or jsonb_typeof(action_json -> 'importedReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedHeadReviewIdAfter') <> 'string'
        or jsonb_typeof(action_json -> 'expectedEffectiveReviewIdAfter') <> 'string'
      ))
      or (action_json ->> 'action' = 'import_revision' and (
        jsonb_typeof(action_json -> 'expectedCurrentReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedSupersedesReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedRevision') <> 'number'
        or (action_json ->> 'expectedRevision')::integer < 2
        or jsonb_typeof(action_json -> 'importedReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedHeadReviewIdAfter') <> 'string'
        or jsonb_typeof(action_json -> 'expectedEffectiveReviewIdAfter') <> 'string'
      )) then
      raise exception using errcode = 'P7723', message = 'V2 import action has malformed or incorrectly typed fields';
    end if;
  end loop;

  if (
    select count(distinct value ->> 'actionId') <> planned_action_count
      or count(distinct (value ->> 'sequence')::integer) <> planned_action_count
      or count(distinct value ->> 'itemId') <> planned_action_count
      or count(distinct value ->> 'importedReviewId') filter (
        where value ->> 'action' in ('import_initial', 'import_revision')
      ) <> planned_apply_count
      or min((value ->> 'sequence')::integer) <> 1
      or max((value ->> 'sequence')::integer) <> planned_action_count
    from jsonb_array_elements(p_plan -> 'actions')
  ) then
    raise exception using errcode = 'P7723', message = 'V2 import action identities, items, and contiguous sequences must be unique';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_plan -> 'actions') as planned(value)
    left join public.literature_gold_set_items as item
      on item.id = (planned.value ->> 'itemId')::uuid
    where item.id is null
      or item.batch_id is distinct from p_batch_id
      or item.dataset_split is distinct from 'development'
      or item.pmid is distinct from planned.value ->> 'pmid'
      or (planned.value ->> 'action' = 'import_initial'
        and (planned.value ->> 'compensationAction') is distinct from 'compensate_void')
      or (planned.value ->> 'action' = 'import_revision'
        and nullif(planned.value ->> 'expectedEffectiveReviewId', '') is null
        and (planned.value ->> 'compensationAction') is distinct from 'compensate_void')
      or (planned.value ->> 'action' = 'import_revision'
        and nullif(planned.value ->> 'expectedEffectiveReviewId', '') is not null
        and (planned.value ->> 'compensationAction') is distinct from 'compensate_restore')
      or (planned.value ->> 'action' = 'import_noop'
        and (planned.value ->> 'compensationAction') is distinct from 'compensate_noop')
  ) then
    raise exception using errcode = 'P7724', message = 'every V2 import action must match an exact development item, PMID, and compensation disposition';
  end if;

  select * into locked_batch
  from public.literature_gold_set_batches as batch
  where batch.id = p_batch_id
  for update;
  if not found or locked_batch.status <> 'active' then
    raise exception using errcode = 'P7724', message = 'only an active gold-set batch may receive a V2 import';
  end if;
  if locked_batch.kind = 'gold_standard' and locked_batch.test_unlocked_at is not null then
    raise exception using errcode = 'P7724', message = 'V2 import is forbidden after the held-out test split is unlocked';
  end if;
  if exists (
    select 1 from public.literature_gold_review_operations operation
    where operation.batch_id = p_batch_id and operation.status = 'started'
  ) then
    raise exception using errcode = 'P7722', message = 'the batch has a started operation that requires explicit recovery';
  end if;

  perform item.id
  from public.literature_gold_set_items as item
  where item.batch_id = p_batch_id and item.dataset_split = 'development'
  order by item.display_order, item.id
  for update;

  development_membership_hash :=
    public.literature_gold_development_membership_hash_v1(p_batch_id);
  if p_plan #>> '{scope,developmentMembershipSha256}'
      is distinct from development_membership_hash
    or planned_action_count is distinct from (
      select count(*)::integer
      from public.literature_gold_set_items as item
      where item.batch_id = p_batch_id and item.dataset_split = 'development'
    ) then
    raise exception using errcode = 'P7724', message = 'V2 import must cover exact checksum-bound development membership';
  end if;

  pre_physical_hash := public.literature_gold_physical_state_hash_v2(
    p_batch_id, 'development'
  );
  pre_effective_hash := public.literature_gold_effective_state_hash_v2(
    p_batch_id, 'development'
  );
  expected_post_effective_hash := p_authorization ->> 'expectedPostEffectiveStateSha256';
  if p_plan ->> 'expectedPhysicalStateSha256' is distinct from pre_physical_hash
    or p_plan ->> 'expectedEffectiveStateSha256' is distinct from pre_effective_hash
    or p_authorization ->> 'expectedPhysicalStateSha256' is distinct from pre_physical_hash
    or p_authorization ->> 'expectedEffectiveStateSha256' is distinct from pre_effective_hash then
    raise exception using errcode = 'P7725', message = 'V2 import authorization does not match current V2 state';
  end if;

  fault_after_action := nullif(p_plan ->> 'faultAfterAction', '')::integer;
  if fault_after_action is not null
    and fault_after_action not between 1 and planned_action_count then
    raise exception using errcode = 'P7723', message = 'faultAfterAction must identify a planned V2 import action';
  end if;
  terminal_anchor := mutation_anchor
    + (planned_action_count + 1) * interval '1 microsecond';

  insert into public.literature_gold_review_operations (
    id, batch_id, operation_kind, contract_version, idempotency_key,
    artifact_sha256, plan_sha256, plan, authorization_sha256,
    authorization_payload, actor_user_id, actor_email, planned_action_count,
    planned_apply_count, planned_noop_count, pre_physical_state_sha256,
    pre_effective_state_sha256, started_at
  ) values (
    p_operation_id, p_batch_id, 'import',
    'gold-review-import-compensation/2.0.0', normalized_key,
    p_artifact_sha256, p_plan_sha256, p_plan, p_authorization_sha256,
    p_authorization, p_actor_user_id, normalized_email, planned_action_count,
    planned_apply_count, planned_noop_count, pre_physical_hash,
    pre_effective_hash, mutation_anchor
  );

  insert into public.literature_gold_review_operation_actions (
    id, operation_id, action_sequence, item_id, pmid, action_kind,
    planned_review_id, pre_current_review_id, pre_effective_review_id,
    expected_revision, expected_supersedes_review_id, planned_state, created_at
  )
  select
    (planned.value ->> 'actionId')::uuid, p_operation_id,
    (planned.value ->> 'sequence')::integer,
    (planned.value ->> 'itemId')::uuid, planned.value ->> 'pmid',
    planned.value ->> 'action',
    nullif(planned.value ->> 'importedReviewId', '')::uuid,
    nullif(planned.value ->> 'expectedCurrentReviewId', '')::uuid,
    nullif(planned.value ->> 'expectedEffectiveReviewId', '')::uuid,
    nullif(planned.value ->> 'expectedRevision', '')::integer,
    nullif(planned.value ->> 'expectedSupersedesReviewId', '')::uuid,
    planned.value,
    mutation_anchor + (planned.value ->> 'sequence')::integer * interval '1 microsecond'
  from jsonb_array_elements(p_plan -> 'actions') as planned(value);

  insert into public.literature_gold_set_events (
    batch_id, actor_user_id, actor_email, event_type, after_value,
    operation_id, operation_event_sequence, created_at
  ) values (
    p_batch_id, p_actor_user_id, normalized_email, 'import_started',
    jsonb_build_object(
      'contractVersion', 'gold-review-import-compensation/2.0.0',
      'operationId', p_operation_id, 'artifactSha256', p_artifact_sha256,
      'planSha256', p_plan_sha256,
      'authorizationSha256', p_authorization_sha256,
      'sourceAuthorizationSetSha256', p_plan ->> 'sourceAuthorizationSetSha256',
      'noteDispositionAuditSha256', p_plan ->> 'noteDispositionAuditSha256',
      'plannedActionCount', planned_action_count,
      'prePhysicalStateSha256', pre_physical_hash,
      'preEffectiveStateSha256', pre_effective_hash
    ), p_operation_id, 1, mutation_anchor
  );

  begin
    perform item.id
    from public.literature_gold_set_items as item
    join jsonb_array_elements(p_plan -> 'actions') as planned(value)
      on item.id = (planned.value ->> 'itemId')::uuid
    order by item.display_order, item.id
    for update of item;

    for action_json in
      select value from jsonb_array_elements(p_plan -> 'actions')
      order by (value ->> 'sequence')::integer
    loop
      select * into action_row
      from public.literature_gold_review_operation_actions as action
      where action.id = (action_json ->> 'actionId')::uuid
        and action.operation_id = p_operation_id;

      select * into locked_item
      from public.literature_gold_set_items as item
      where item.id = action_row.item_id;

      select * into head_review
      from public.literature_gold_set_reviews as review
      where review.id = locked_item.current_review_id
        and review.item_id = locked_item.id;
      if found and head_review.lifecycle_state = 'effective' then
        actual_effective_review_id := coalesce(
          head_review.effective_source_review_id, head_review.id
        );
      else
        actual_effective_review_id := null;
      end if;

      expected_current_review_id :=
        nullif(action_json ->> 'expectedCurrentReviewId', '')::uuid;
      expected_effective_review_id :=
        nullif(action_json ->> 'expectedEffectiveReviewId', '')::uuid;
      if locked_item.current_review_id is distinct from expected_current_review_id
        or actual_effective_review_id is distinct from expected_effective_review_id
        or action_json #>> '{preImportItemState,reviewStatus}'
          is distinct from locked_item.review_status
        or nullif(action_json #>> '{preImportItemState,startedAt}', '')::timestamptz
          is distinct from locked_item.started_at
        or nullif(action_json #>> '{preImportItemState,completedAt}', '')::timestamptz
          is distinct from locked_item.completed_at
        or nullif(action_json #>> '{preImportItemState,supplementalMetadataRevealedAt}', '')::timestamptz
          is distinct from locked_item.supplemental_metadata_revealed_at
        or nullif(action_json #>> '{preImportItemState,automatedSignalsRevealedAt}', '')::timestamptz
          is distinct from locked_item.automated_signals_revealed_at then
        raise exception using errcode = 'P7726', message = 'V2 import action pre-state drifted from its checksum-bound plan';
      end if;
      perform public.assert_literature_gold_review_chain_head_v1(locked_item.id);

      if exists (
        select 1 from public.literature_gold_set_review_drafts as draft
        where draft.item_id = locked_item.id
      ) then
        raise exception using errcode = 'P7727', message = 'V2 import cannot overwrite or ignore an unplanned review draft';
      end if;

      if action_row.action_kind = 'import_noop' then
        current_effective_payload :=
          public.literature_gold_review_clinical_projection_v2(
            actual_effective_review_id
          );
        if nullif(action_json ->> 'expectedHeadReviewIdAfter', '')::uuid
            is distinct from locked_item.current_review_id
          or nullif(action_json ->> 'expectedEffectiveReviewIdAfter', '')::uuid
            is distinct from actual_effective_review_id
          or action_json -> 'expectedEventSequence' is distinct from '[]'::jsonb
          or action_json -> 'candidateReview' is distinct from
            coalesce(current_effective_payload, 'null'::jsonb)
          or action_json ->> 'candidateReviewSha256' is distinct from
            public.literature_gold_jsonb_sha256_v1(
              coalesce(current_effective_payload, 'null'::jsonb)
            ) then
          raise exception using errcode = 'P7727', message = 'V2 import no-op state or projection checksum is invalid';
        end if;
        update public.literature_gold_review_operation_actions
        set action_status = 'noop',
          processed_at = mutation_anchor
            + action_row.action_sequence * interval '1 microsecond',
          result_state = jsonb_build_object(
            'currentReviewId', locked_item.current_review_id,
            'effectiveReviewId', actual_effective_review_id,
            'operationContractVersion', case
              when actual_effective_review_id is null then null
              else (select review.operation_contract_version
                from public.literature_gold_set_reviews review
                where review.id = actual_effective_review_id)
            end
          )
        where id = action_row.id;
        noop_count := noop_count + 1;
      else
        review_json := action_json -> 'review';
        perform public.validate_literature_gold_import_review_payload_v2(
          locked_item.id, review_json, actual_effective_review_id is null
        );

        expected_revision := (action_json ->> 'expectedRevision')::integer;
        expected_supersedes_review_id :=
          nullif(action_json ->> 'expectedSupersedesReviewId', '')::uuid;
        if expected_supersedes_review_id is distinct from locked_item.current_review_id
          or expected_revision is distinct from coalesce(head_review.revision, 0) + 1
          or (action_row.action_kind = 'import_initial'
            and locked_item.current_review_id is not null)
          or (action_row.action_kind = 'import_revision'
            and locked_item.current_review_id is null)
          or action_json ->> 'expectedHeadReviewIdAfter'
            is distinct from action_row.planned_review_id::text
          or action_json ->> 'expectedEffectiveReviewIdAfter'
            is distinct from action_row.planned_review_id::text
          or action_json -> 'expectedEventSequence'
            is distinct from '["review_imported"]'::jsonb
          or action_json ->> 'reviewSha256' is distinct from
            public.literature_gold_jsonb_sha256_v1(review_json) then
          raise exception using errcode = 'P7728', message = 'V2 import action kind, review checksum, or chain position is invalid';
        end if;

        insert into public.literature_gold_set_reviews (
          id, item_id, revision, supersedes_review_id, reviewer_user_id,
          reviewer_email, relevance_label, metadata_sufficiency,
          reviewer_confidence, topic_ids, technology_tags, clinical_purposes,
          disease_tags, study_design, publication_status,
          categorization_from_full_text, full_text_used, notes,
          used_supplemental_metadata, review_seconds, is_blinded, started_at,
          completed_at, created_at, technology_tag_status, disease_tag_status,
          taxonomy_version, label_schema_version, enrichment_schema_version,
          enrichment_provenance, revision_kind, lifecycle_state,
          operation_action_id, operation_contract_version_code
        ) values (
          action_row.planned_review_id, locked_item.id, expected_revision,
          expected_supersedes_review_id,
          nullif(review_json ->> 'reviewerUserId', '')::uuid,
          nullif(trim(coalesce(review_json ->> 'reviewerEmail', '')), ''),
          review_json ->> 'relevanceLabel',
          review_json ->> 'metadataSufficiency',
          review_json ->> 'reviewerConfidence',
          array(select jsonb_array_elements_text(review_json -> 'topicIds')),
          array(select jsonb_array_elements_text(review_json -> 'technologyTags')),
          array(select jsonb_array_elements_text(review_json -> 'clinicalPurposes')),
          array(select jsonb_array_elements_text(review_json -> 'diseaseTags')),
          nullif(review_json ->> 'studyDesign', ''),
          nullif(review_json ->> 'publicationStatus', ''),
          (review_json ->> 'categorizationFromFullText')::boolean,
          (review_json ->> 'fullTextUsed')::boolean,
          review_json ->> 'notes',
          (review_json ->> 'usedSupplementalMetadata')::boolean,
          (review_json ->> 'reviewSeconds')::integer,
          (review_json ->> 'isBlinded')::boolean,
          (review_json ->> 'startedAt')::timestamptz,
          (review_json ->> 'completedAt')::timestamptz,
          (review_json ->> 'createdAt')::timestamptz,
          nullif(review_json ->> 'technologyTagStatus', ''),
          nullif(review_json ->> 'diseaseTagStatus', ''),
          review_json ->> 'taxonomyVersion',
          review_json ->> 'labelSchemaVersion',
          review_json ->> 'enrichmentSchemaVersion',
          review_json ->> 'enrichmentProvenance',
          'import', 'effective', action_row.id, 2
        ) returning * into created_review;

        update public.literature_gold_set_items
        set review_status = 'completed', current_review_id = created_review.id,
          started_at = coalesce(started_at, created_review.started_at),
          completed_at = created_review.completed_at
        where id = locked_item.id;

        update public.literature_gold_review_operation_actions
        set action_status = 'applied', result_review_id = created_review.id,
          processed_at = mutation_anchor
            + action_row.action_sequence * interval '1 microsecond',
          result_state = jsonb_build_object(
            'reviewId', created_review.id, 'revision', created_review.revision,
            'supersedesReviewId', created_review.supersedes_review_id,
            'currentReviewId', created_review.id,
            'effectiveReviewId', created_review.id,
            'fullTextUsed', created_review.full_text_used,
            'isBlinded', created_review.is_blinded,
            'operationContractVersion', created_review.operation_contract_version,
            'clinicalProjectionSha256', public.literature_gold_jsonb_sha256_v1(
              public.literature_gold_review_clinical_projection_v2(created_review.id)
            )
          )
        where id = action_row.id;

        insert into public.literature_gold_set_events (
          batch_id, item_id, actor_user_id, actor_email, event_type,
          before_value, after_value, operation_id, operation_action_id,
          operation_event_sequence, created_at
        ) values (
          p_batch_id, locked_item.id, p_actor_user_id, normalized_email,
          'review_imported',
          jsonb_build_object(
            'currentReviewId', locked_item.current_review_id,
            'effectiveReviewId', actual_effective_review_id
          ),
          jsonb_build_object(
            'reviewId', created_review.id, 'revision', created_review.revision,
            'revisionKind', 'import', 'lifecycleState', 'effective',
            'operationContractVersion', created_review.operation_contract_version,
            'fullTextUsed', created_review.full_text_used,
            'isBlinded', created_review.is_blinded,
            'technologyTagStatus', created_review.technology_tag_status,
            'diseaseTagStatus', created_review.disease_tag_status
          ), p_operation_id, action_row.id, action_row.action_sequence + 1,
          mutation_anchor
            + action_row.action_sequence * interval '1 microsecond'
        );
        applied_count := applied_count + 1;
      end if;

      if fault_after_action = action_row.action_sequence then
        raise exception using errcode = 'P7799', message = format(
          'controlled V2 import rehearsal fault after action %s', fault_after_action
        );
      end if;
    end loop;

    if applied_count <> planned_apply_count or noop_count <> planned_noop_count then
      raise exception using errcode = 'P7729', message = 'V2 import outcomes do not match planned dynamic counts';
    end if;
    for action_row in
      select action.*
      from public.literature_gold_review_operation_actions as action
      where action.operation_id = p_operation_id
      order by action.item_id
    loop
      perform public.assert_literature_gold_review_chain_head_v1(action_row.item_id);
    end loop;

    post_effective_hash := public.literature_gold_effective_state_hash_v2(
      p_batch_id, 'development'
    );
    if post_effective_hash is distinct from expected_post_effective_hash then
      raise exception using errcode = 'P7730', message = 'V2 import effective post-state does not match authorization';
    end if;

    update public.literature_gold_review_operations
    set status = 'completed', applied_action_count = applied_count,
      noop_action_count = noop_count,
      completed_at = terminal_anchor
    where id = p_operation_id;

    insert into public.literature_gold_set_events (
      batch_id, actor_user_id, actor_email, event_type, after_value,
      operation_id, operation_event_sequence, created_at
    ) values (
      p_batch_id, p_actor_user_id, normalized_email, 'import_completed',
      jsonb_build_object(
        'contractVersion', 'gold-review-import-compensation/2.0.0',
        'operationId', p_operation_id, 'appliedActionCount', applied_count,
        'noopActionCount', noop_count,
        'postEffectiveStateSha256', post_effective_hash
      ), p_operation_id, planned_action_count + 2,
      terminal_anchor
    );

    post_physical_hash := public.literature_gold_physical_state_hash_v2(
      p_batch_id, 'development'
    );
    update public.literature_gold_review_operations
    set post_physical_state_sha256 = post_physical_hash,
      post_effective_state_sha256 = post_effective_hash
    where id = p_operation_id;
  exception when others then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message = message_text;

    update public.literature_gold_review_operation_actions
    set action_status = 'failed',
      processed_at = mutation_anchor
        + action_sequence * interval '1 microsecond',
      result_state = jsonb_build_object(
        'errorSqlstate', caught_sqlstate,
        'errorMessage', left(caught_message, 4000)
      )
    where operation_id = p_operation_id and action_status = 'planned';
    update public.literature_gold_review_operations
    set status = 'failed', applied_action_count = 0, noop_action_count = 0,
      error_sqlstate = caught_sqlstate, error_message = left(caught_message, 4000),
      completed_at = terminal_anchor
    where id = p_operation_id;
    insert into public.literature_gold_set_events (
      batch_id, actor_user_id, actor_email, event_type, after_value,
      operation_id, operation_event_sequence, created_at
    ) values (
      p_batch_id, p_actor_user_id, normalized_email, 'import_failed',
      jsonb_build_object(
        'contractVersion', 'gold-review-import-compensation/2.0.0',
        'operationId', p_operation_id, 'errorSqlstate', caught_sqlstate,
        'errorMessage', left(caught_message, 4000),
        'reviewAndPointerMutationsCommitted', false
      ), p_operation_id, planned_action_count + 2,
      terminal_anchor
    );

    post_effective_hash := public.literature_gold_effective_state_hash_v2(
      p_batch_id, 'development'
    );
    if post_effective_hash is distinct from pre_effective_hash then
      raise exception using errcode = 'P7798', message = format(
        'failed V2 import changed effective state after rollback; original SQLSTATE %s: %s',
        caught_sqlstate, left(caught_message, 3500)
      );
    end if;
    post_physical_hash := public.literature_gold_physical_state_hash_v2(
      p_batch_id, 'development'
    );
    update public.literature_gold_review_operations
    set post_physical_state_sha256 = post_physical_hash,
      post_effective_state_sha256 = post_effective_hash
    where id = p_operation_id;
    return public.literature_gold_review_operation_receipt_v2(
      p_operation_id, false
    );
  end;

  return public.literature_gold_review_operation_receipt_v2(
    p_operation_id, false
  );
end;
$$;

create or replace function public.compensate_literature_gold_import_v2(
  p_operation_id uuid,
  p_target_import_operation_id uuid,
  p_idempotency_key text,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_plan_sha256 text,
  p_plan jsonb,
  p_authorization_sha256 text,
  p_authorization jsonb,
  p_actor_user_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  normalized_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  normalized_email text := nullif(trim(coalesce(p_actor_email, '')), '');
  mutation_anchor timestamptz;
  terminal_anchor timestamptz;
  existing_operation public.literature_gold_review_operations%rowtype;
  target_import public.literature_gold_review_operations%rowtype;
  locked_batch public.literature_gold_set_batches%rowtype;
  action_json jsonb;
  action_row public.literature_gold_review_operation_actions%rowtype;
  source_action public.literature_gold_review_operation_actions%rowtype;
  locked_item public.literature_gold_set_items%rowtype;
  imported_review public.literature_gold_set_reviews%rowtype;
  source_review public.literature_gold_set_reviews%rowtype;
  created_review public.literature_gold_set_reviews%rowtype;
  current_effective_review_id uuid;
  planned_action_count integer;
  planned_restored_count integer;
  planned_voided_count integer;
  planned_apply_count integer;
  planned_noop_count integer;
  applied_count integer := 0;
  noop_count integer := 0;
  pre_physical_hash text;
  pre_effective_hash text;
  post_physical_hash text;
  post_effective_hash text;
  expected_post_effective_hash text;
  development_membership_hash text;
  fault_after_action integer;
  restored_status text;
  restored_started_at timestamptz;
  restored_completed_at timestamptz;
  restored_supplemental_at timestamptz;
  restored_automated_at timestamptz;
  caught_sqlstate text;
  caught_message text;
begin
  if p_operation_id is null or p_target_import_operation_id is null
    or p_operation_id = p_target_import_operation_id or p_batch_id is null
    or normalized_key !~ '^[a-f0-9]{64}$'
    or p_artifact_sha256 !~ '^[a-f0-9]{64}$'
    or p_plan_sha256 !~ '^[a-f0-9]{64}$'
    or p_authorization_sha256 !~ '^[a-f0-9]{64}$'
    or (p_actor_user_id is null and normalized_email is null) then
    raise exception using errcode = 'P7740', message = 'V2 compensation identities, actor, and lowercase SHA-256 bindings are required';
  end if;

  perform public.validate_literature_gold_operation_plan_v2(
    p_plan, 'compensation', p_operation_id, p_batch_id, p_artifact_sha256,
    p_plan_sha256, normalized_key
  );
  if p_plan ->> 'targetImportOperationId'
      is distinct from p_target_import_operation_id::text
    or p_plan ->> 'importPlanSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'importReceiptSha256' !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7740', message = 'V2 compensation plan target bindings are invalid';
  end if;
  perform public.validate_literature_gold_operation_authorization_v2(
    p_authorization, p_authorization_sha256, 'compensation', p_operation_id,
    p_target_import_operation_id, p_batch_id, p_plan_sha256, normalized_key,
    p_artifact_sha256, p_plan
  );
  mutation_anchor := (p_authorization ->> 'authorizedAt')::timestamptz;

  perform pg_advisory_xact_lock(hashtextextended(
    least(p_operation_id::text, 'v2-compensation:' || normalized_key), 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    greatest(p_operation_id::text, 'v2-compensation:' || normalized_key), 0
  ));

  select * into existing_operation
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id
     or (operation.operation_kind = 'compensation'
       and operation.idempotency_key = normalized_key)
  order by case when operation.id = p_operation_id then 0 else 1 end
  limit 1
  for update;

  if found then
    if existing_operation.id is distinct from p_operation_id
      or existing_operation.contract_version
        is distinct from 'gold-review-import-compensation/2.0.0'
      or existing_operation.operation_kind <> 'compensation'
      or existing_operation.target_import_operation_id
        is distinct from p_target_import_operation_id
      or existing_operation.idempotency_key is distinct from normalized_key
      or existing_operation.batch_id is distinct from p_batch_id
      or existing_operation.artifact_sha256 is distinct from p_artifact_sha256
      or existing_operation.plan_sha256 is distinct from p_plan_sha256
      or existing_operation.plan is distinct from p_plan
      or existing_operation.authorization_sha256 is distinct from p_authorization_sha256
      or existing_operation.authorization_payload is distinct from p_authorization then
      raise exception using errcode = 'P7741', message = 'V2 idempotency identity was reused with different compensation inputs';
    end if;
    if existing_operation.status = 'started' then
      raise exception using errcode = 'P7742', message = 'an existing started V2 compensation requires explicit recovery authorization';
    end if;
    return public.literature_gold_review_operation_receipt_v2(
      existing_operation.id, true
    );
  end if;

  select * into target_import
  from public.literature_gold_review_operations as operation
  where operation.id = p_target_import_operation_id
  for update;
  if not found or target_import.contract_version
      is distinct from 'gold-review-import-compensation/2.0.0'
    or target_import.operation_kind <> 'import'
    or target_import.status <> 'completed'
    or target_import.batch_id is distinct from p_batch_id
    or target_import.dataset_split <> 'development'
    or target_import.post_physical_state_sha256 is null
    or target_import.post_effective_state_sha256 is null then
    raise exception using errcode = 'P7743', message = 'V2 compensation requires a sealed completed V2 development import in the same batch';
  end if;
  if target_import.artifact_sha256 is distinct from p_artifact_sha256
    or p_plan ->> 'importPlanSha256' is distinct from target_import.plan_sha256
    or p_plan ->> 'importReceiptSha256' is distinct from (
      public.literature_gold_review_operation_receipt_v2(
        p_target_import_operation_id, false
      ) #>> '{binding,contentSha256}'
    )
    or p_plan ->> 'sourceAuthorizationSetSha256'
      is distinct from target_import.plan ->> 'sourceAuthorizationSetSha256'
    or p_plan ->> 'noteDispositionAuditSha256'
      is distinct from target_import.plan ->> 'noteDispositionAuditSha256'
    or p_plan ->> 'booleanNormalizationLedgerSha256'
      is distinct from target_import.plan ->> 'booleanNormalizationLedgerSha256'
    or p_plan ->> 'orderedSetNormalizationLedgerSha256'
      is distinct from target_import.plan ->> 'orderedSetNormalizationLedgerSha256' then
    raise exception using errcode = 'P7743', message = 'V2 compensation is not bound to the target import plan, receipt, artifact, and evidence identities';
  end if;
  if exists (
    select 1 from public.literature_gold_review_operations as prior
    where prior.target_import_operation_id = p_target_import_operation_id
      and prior.operation_kind = 'compensation'
      and prior.status in ('started', 'completed')
  ) then
    raise exception using errcode = 'P7744', message = 'the V2 target import already has an active or completed compensation';
  end if;

  planned_action_count := jsonb_array_length(p_plan -> 'actions');
  select
    count(*) filter (where value ->> 'action' = 'compensate_restore')::integer,
    count(*) filter (where value ->> 'action' = 'compensate_void')::integer,
    count(*) filter (where value ->> 'action' in ('compensate_restore', 'compensate_void'))::integer,
    count(*) filter (where value ->> 'action' = 'compensate_noop')::integer
  into planned_restored_count, planned_voided_count,
    planned_apply_count, planned_noop_count
  from jsonb_array_elements(p_plan -> 'actions');

  if planned_action_count <> target_import.planned_action_count
    or planned_action_count < 1
    or planned_apply_count + planned_noop_count <> planned_action_count
    or (p_plan #>> '{counts,total}')::integer is distinct from planned_action_count
    or (p_plan #>> '{counts,restored}')::integer is distinct from planned_restored_count
    or (p_plan #>> '{counts,voided}')::integer is distinct from planned_voided_count
    or (p_plan #>> '{counts,noops}')::integer is distinct from planned_noop_count then
    raise exception using errcode = 'P7745', message = 'V2 compensation must account exactly once for every import action';
  end if;

  for action_json in select value from jsonb_array_elements(p_plan -> 'actions') loop
    perform public.assert_literature_gold_jsonb_object_v1(
      action_json,
      array[
        'actionId', 'sourceActionId', 'sequence', 'itemId', 'pmid',
        'datasetSplit', 'importedReviewId', 'expectedCurrentReviewId',
        'expectedEffectiveReviewId', 'action', 'expectedRevision',
        'expectedSupersedesReviewId', 'compensationReviewId',
        'effectiveSourceReviewId', 'expectedHeadReviewIdAfter',
        'expectedEffectiveReviewIdAfter', 'expectedEventSequence'
      ],
      array[
        'actionId', 'sourceActionId', 'sequence', 'itemId', 'pmid',
        'datasetSplit', 'importedReviewId', 'expectedCurrentReviewId',
        'expectedEffectiveReviewId', 'action', 'expectedRevision',
        'expectedSupersedesReviewId', 'compensationReviewId',
        'effectiveSourceReviewId', 'expectedHeadReviewIdAfter',
        'expectedEffectiveReviewIdAfter', 'expectedEventSequence'
      ], 'V2 compensation action'
    );
    if action_json ->> 'action' not in (
        'compensate_restore', 'compensate_void', 'compensate_noop'
      )
      or action_json ->> 'actionId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or action_json ->> 'sourceActionId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(action_json -> 'sequence') <> 'number'
      or action_json ->> 'sequence' !~ '^[1-9][0-9]*$'
      or action_json ->> 'itemId'
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or action_json ->> 'pmid' !~ '^[0-9]{1,12}$'
      or action_json ->> 'datasetSplit' is distinct from 'development'
      or jsonb_typeof(action_json -> 'expectedEventSequence') <> 'array'
      or exists (
        select 1 from jsonb_array_elements(action_json -> 'expectedEventSequence') element
        where jsonb_typeof(element) <> 'string'
      )
      or exists (
        select 1 from unnest(array[
          'importedReviewId', 'expectedCurrentReviewId',
          'expectedEffectiveReviewId', 'expectedSupersedesReviewId',
          'compensationReviewId', 'effectiveSourceReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter'
        ]) field
        where jsonb_typeof(action_json -> field) not in ('string', 'null')
          or (jsonb_typeof(action_json -> field) = 'string'
            and action_json ->> field
              !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      )
      or jsonb_typeof(action_json -> 'expectedRevision') not in ('number', 'null')
      or (jsonb_typeof(action_json -> 'expectedRevision') = 'number'
        and action_json ->> 'expectedRevision' !~ '^[1-9][0-9]*$')
      or (action_json ->> 'action' = 'compensate_noop' and (
        jsonb_typeof(action_json -> 'importedReviewId') is distinct from 'null'
        or jsonb_typeof(action_json -> 'compensationReviewId') is distinct from 'null'
        or jsonb_typeof(action_json -> 'expectedRevision') is distinct from 'null'
        or jsonb_typeof(action_json -> 'expectedSupersedesReviewId') is distinct from 'null'
        or action_json ->> 'effectiveSourceReviewId'
          is distinct from action_json ->> 'expectedEffectiveReviewId'
      ))
      or (action_json ->> 'action' in ('compensate_restore', 'compensate_void') and (
        jsonb_typeof(action_json -> 'importedReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedCurrentReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedEffectiveReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedRevision') <> 'number'
        or (action_json ->> 'expectedRevision')::integer < 2
        or jsonb_typeof(action_json -> 'expectedSupersedesReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'compensationReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedHeadReviewIdAfter') <> 'string'
      ))
      or (action_json ->> 'action' = 'compensate_restore' and (
        jsonb_typeof(action_json -> 'effectiveSourceReviewId') <> 'string'
        or jsonb_typeof(action_json -> 'expectedEffectiveReviewIdAfter') <> 'string'
      ))
      or (action_json ->> 'action' = 'compensate_void' and (
        jsonb_typeof(action_json -> 'effectiveSourceReviewId') <> 'null'
        or jsonb_typeof(action_json -> 'expectedEffectiveReviewIdAfter') <> 'null'
      )) then
      raise exception using errcode = 'P7745', message = 'V2 compensation action has malformed or incorrectly typed fields';
    end if;
  end loop;

  if (
    select count(distinct value ->> 'actionId') <> planned_action_count
      or count(distinct value ->> 'sourceActionId') <> planned_action_count
      or count(distinct (value ->> 'sequence')::integer) <> planned_action_count
      or count(distinct value ->> 'itemId') <> planned_action_count
      or count(distinct value ->> 'compensationReviewId') filter (
        where value ->> 'action' in ('compensate_restore', 'compensate_void')
      ) <> planned_apply_count
      or min((value ->> 'sequence')::integer) <> 1
      or max((value ->> 'sequence')::integer) <> planned_action_count
    from jsonb_array_elements(p_plan -> 'actions')
  ) then
    raise exception using errcode = 'P7745', message = 'V2 compensation action/source/item identities and sequences must be unique';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_plan -> 'actions') as planned(value)
    left join public.literature_gold_review_operation_actions as source
      on source.id = (planned.value ->> 'sourceActionId')::uuid
     and source.operation_id = p_target_import_operation_id
    left join public.literature_gold_set_items as item
      on item.id = (planned.value ->> 'itemId')::uuid
    where source.id is null
      or source.item_id is distinct from item.id
      or source.pmid is distinct from planned.value ->> 'pmid'
      or item.batch_id is distinct from p_batch_id
      or item.dataset_split is distinct from 'development'
      or (source.action_kind = 'import_initial'
        and planned.value ->> 'action' is distinct from 'compensate_void')
      or (source.action_kind = 'import_revision' and (
        (source.pre_effective_review_id is null
          and planned.value ->> 'action' is distinct from 'compensate_void')
        or (source.pre_effective_review_id is not null
          and planned.value ->> 'action' is distinct from 'compensate_restore')
      ))
      or (source.action_kind = 'import_noop'
        and planned.value ->> 'action' is distinct from 'compensate_noop')
      or (source.action_kind in ('import_initial', 'import_revision') and (
        source.action_status <> 'applied'
        or (planned.value ->> 'importedReviewId')::uuid
          is distinct from source.result_review_id
      ))
      or (source.action_kind = 'import_noop' and source.action_status <> 'noop')
  ) then
    raise exception using errcode = 'P7746', message = 'V2 compensation must map one-for-one to target import actions and outcomes';
  end if;
  if exists (
    select 1
    from public.literature_gold_review_operation_actions as source
    where source.operation_id = p_target_import_operation_id
      and not exists (
        select 1 from jsonb_array_elements(p_plan -> 'actions') as planned(value)
        where (planned.value ->> 'sourceActionId')::uuid = source.id
      )
  ) then
    raise exception using errcode = 'P7746', message = 'V2 compensation omitted a target import action';
  end if;

  select * into locked_batch
  from public.literature_gold_set_batches as batch
  where batch.id = p_batch_id
  for update;
  if not found or locked_batch.status <> 'active' then
    raise exception using errcode = 'P7747', message = 'only an active gold-set batch may be compensated';
  end if;
  if locked_batch.kind = 'gold_standard' and locked_batch.test_unlocked_at is not null then
    raise exception using errcode = 'P7747', message = 'V2 compensation is forbidden after the held-out test split is unlocked';
  end if;
  if exists (
    select 1 from public.literature_gold_review_operations operation
    where operation.batch_id = p_batch_id and operation.status = 'started'
  ) then
    raise exception using errcode = 'P7742', message = 'the batch has a started operation that requires explicit recovery';
  end if;

  perform item.id
  from public.literature_gold_set_items as item
  where item.batch_id = p_batch_id and item.dataset_split = 'development'
  order by item.display_order, item.id
  for update;

  development_membership_hash :=
    public.literature_gold_development_membership_hash_v1(p_batch_id);
  if p_plan #>> '{scope,developmentMembershipSha256}'
      is distinct from development_membership_hash
    or planned_action_count is distinct from (
      select count(*)::integer from public.literature_gold_set_items as item
      where item.batch_id = p_batch_id and item.dataset_split = 'development'
    ) then
    raise exception using errcode = 'P7747', message = 'V2 compensation must cover exact checksum-bound development membership';
  end if;

  pre_physical_hash := public.literature_gold_physical_state_hash_v2(
    p_batch_id, 'development'
  );
  pre_effective_hash := public.literature_gold_effective_state_hash_v2(
    p_batch_id, 'development'
  );
  expected_post_effective_hash := p_authorization ->> 'expectedPostEffectiveStateSha256';
  if pre_effective_hash is distinct from target_import.post_effective_state_sha256
    or p_plan ->> 'expectedPhysicalStateSha256' is distinct from pre_physical_hash
    or p_plan ->> 'expectedEffectiveStateSha256' is distinct from pre_effective_hash
    or p_authorization ->> 'expectedPhysicalStateSha256' is distinct from pre_physical_hash
    or p_authorization ->> 'expectedEffectiveStateSha256' is distinct from pre_effective_hash
    or expected_post_effective_hash is distinct from target_import.pre_effective_state_sha256 then
    raise exception using errcode = 'P7748', message = 'V2 compensation authorization does not match target import or current/restored state';
  end if;

  fault_after_action := nullif(p_plan ->> 'faultAfterAction', '')::integer;
  if fault_after_action is not null
    and fault_after_action not between 1 and planned_action_count then
    raise exception using errcode = 'P7745', message = 'faultAfterAction must identify a planned V2 compensation action';
  end if;
  terminal_anchor := mutation_anchor
    + (planned_action_count + 1) * interval '1 microsecond';

  insert into public.literature_gold_review_operations (
    id, batch_id, operation_kind, target_import_operation_id, contract_version,
    idempotency_key, artifact_sha256, plan_sha256, plan,
    authorization_sha256, authorization_payload, actor_user_id, actor_email,
    planned_action_count, planned_apply_count, planned_noop_count,
    pre_physical_state_sha256, pre_effective_state_sha256, started_at
  ) values (
    p_operation_id, p_batch_id, 'compensation', p_target_import_operation_id,
    'gold-review-import-compensation/2.0.0', normalized_key,
    p_artifact_sha256, p_plan_sha256, p_plan, p_authorization_sha256,
    p_authorization, p_actor_user_id, normalized_email, planned_action_count,
    planned_apply_count, planned_noop_count, pre_physical_hash,
    pre_effective_hash, mutation_anchor
  );

  insert into public.literature_gold_review_operation_actions (
    id, operation_id, action_sequence, item_id, pmid, action_kind,
    source_operation_action_id, planned_review_id, pre_current_review_id,
    pre_effective_review_id, expected_revision,
    expected_supersedes_review_id, planned_state, created_at
  )
  select
    (planned.value ->> 'actionId')::uuid, p_operation_id,
    (planned.value ->> 'sequence')::integer, source.item_id, source.pmid,
    planned.value ->> 'action', source.id,
    nullif(planned.value ->> 'compensationReviewId', '')::uuid,
    source.pre_current_review_id, source.pre_effective_review_id,
    nullif(planned.value ->> 'expectedRevision', '')::integer,
    nullif(planned.value ->> 'expectedSupersedesReviewId', '')::uuid,
    planned.value,
    mutation_anchor + (planned.value ->> 'sequence')::integer * interval '1 microsecond'
  from jsonb_array_elements(p_plan -> 'actions') as planned(value)
  join public.literature_gold_review_operation_actions as source
    on source.id = (planned.value ->> 'sourceActionId')::uuid
   and source.operation_id = p_target_import_operation_id;

  insert into public.literature_gold_set_events (
    batch_id, actor_user_id, actor_email, event_type, after_value,
    operation_id, operation_event_sequence, created_at
  ) values (
    p_batch_id, p_actor_user_id, normalized_email,
    'import_compensation_started',
    jsonb_build_object(
      'contractVersion', 'gold-review-import-compensation/2.0.0',
      'operationId', p_operation_id,
      'targetImportOperationId', p_target_import_operation_id,
      'artifactSha256', p_artifact_sha256, 'planSha256', p_plan_sha256,
      'authorizationSha256', p_authorization_sha256,
      'sourceAuthorizationSetSha256', p_plan ->> 'sourceAuthorizationSetSha256',
      'noteDispositionAuditSha256', p_plan ->> 'noteDispositionAuditSha256',
      'plannedActionCount', planned_action_count,
      'prePhysicalStateSha256', pre_physical_hash,
      'preEffectiveStateSha256', pre_effective_hash
    ), p_operation_id, 1, mutation_anchor
  );

  begin
    perform item.id
    from public.literature_gold_set_items as item
    join jsonb_array_elements(p_plan -> 'actions') as planned(value)
      on item.id = (planned.value ->> 'itemId')::uuid
    order by item.display_order, item.id
    for update of item;

    for action_json in
      select value from jsonb_array_elements(p_plan -> 'actions')
      order by (value ->> 'sequence')::integer
    loop
      select * into action_row
      from public.literature_gold_review_operation_actions as action
      where action.id = (action_json ->> 'actionId')::uuid
        and action.operation_id = p_operation_id;
      select * into source_action
      from public.literature_gold_review_operation_actions as action
      where action.id = action_row.source_operation_action_id
        and action.operation_id = p_target_import_operation_id
        and action.item_id = action_row.item_id;
      if not found then
        raise exception using errcode = 'P7749', message = 'V2 compensation source action is not from the target import and same item';
      end if;

      select * into locked_item
      from public.literature_gold_set_items as item
      where item.id = action_row.item_id;
      select * into imported_review
      from public.literature_gold_set_reviews as review
      where review.id = source_action.result_review_id
        and review.item_id = locked_item.id
        and review.operation_action_id = source_action.id
        and review.revision_kind = 'import'
        and review.operation_contract_version
          = 'gold-review-import-compensation/2.0.0';

      if exists (
        select 1 from public.literature_gold_set_review_drafts as draft
        where draft.item_id = locked_item.id
      ) then
        raise exception using errcode = 'P7750', message = 'V2 compensation is blocked by an intervening review draft';
      end if;

      if source_action.action_kind = 'import_noop' then
        if locked_item.review_status is distinct from
            source_action.planned_state #>> '{preImportItemState,reviewStatus}'
          or locked_item.started_at is distinct from nullif(
            source_action.planned_state #>> '{preImportItemState,startedAt}', ''
          )::timestamptz
          or locked_item.completed_at is distinct from nullif(
            source_action.planned_state #>> '{preImportItemState,completedAt}', ''
          )::timestamptz
          or locked_item.supplemental_metadata_revealed_at is distinct from nullif(
            source_action.planned_state
              #>> '{preImportItemState,supplementalMetadataRevealedAt}', ''
          )::timestamptz
          or locked_item.automated_signals_revealed_at is distinct from nullif(
            source_action.planned_state
              #>> '{preImportItemState,automatedSignalsRevealedAt}', ''
          )::timestamptz then
          raise exception using errcode = 'P7750', message = 'V2 no-op target item changed after import';
        end if;
      else
        if imported_review.id is null or locked_item.review_status <> 'completed'
          or locked_item.started_at is distinct from coalesce(
            nullif(source_action.planned_state
              #>> '{preImportItemState,startedAt}', '')::timestamptz,
            imported_review.started_at
          )
          or locked_item.completed_at is distinct from imported_review.completed_at
          or locked_item.supplemental_metadata_revealed_at is distinct from nullif(
            source_action.planned_state
              #>> '{preImportItemState,supplementalMetadataRevealedAt}', ''
          )::timestamptz
          or locked_item.automated_signals_revealed_at is distinct from nullif(
            source_action.planned_state
              #>> '{preImportItemState,automatedSignalsRevealedAt}', ''
          )::timestamptz then
          raise exception using errcode = 'P7750', message = 'V2 imported item state changed before compensation';
        end if;
      end if;

      select case when head.lifecycle_state = 'effective'
        then coalesce(head.effective_source_review_id, head.id) else null end
      into current_effective_review_id
      from public.literature_gold_set_reviews as head
      where head.id = locked_item.current_review_id;

      if nullif(action_json ->> 'expectedCurrentReviewId', '')::uuid
          is distinct from locked_item.current_review_id
        or nullif(action_json ->> 'expectedEffectiveReviewId', '')::uuid
          is distinct from current_effective_review_id then
        raise exception using errcode = 'P7750', message = 'V2 compensation current/effective head guard drifted';
      end if;

      if action_row.action_kind = 'compensate_noop' then
        if locked_item.current_review_id is distinct from source_action.pre_current_review_id
          or current_effective_review_id is distinct from source_action.pre_effective_review_id
          or nullif(action_json ->> 'expectedHeadReviewIdAfter', '')::uuid
            is distinct from locked_item.current_review_id
          or nullif(action_json ->> 'expectedEffectiveReviewIdAfter', '')::uuid
            is distinct from current_effective_review_id
          or action_json -> 'expectedEventSequence' is distinct from '[]'::jsonb then
          raise exception using errcode = 'P7750', message = 'V2 no-op compensation target drifted';
        end if;
        update public.literature_gold_review_operation_actions
        set action_status = 'noop',
          processed_at = mutation_anchor
            + action_row.action_sequence * interval '1 microsecond',
          result_state = jsonb_build_object(
            'currentReviewId', locked_item.current_review_id,
            'effectiveReviewId', current_effective_review_id
          )
        where id = action_row.id;
        noop_count := noop_count + 1;
      else
        if locked_item.current_review_id is distinct from imported_review.id
          or action_row.expected_supersedes_review_id is distinct from imported_review.id
          or action_row.expected_revision is distinct from imported_review.revision + 1
          or nullif(action_json ->> 'expectedHeadReviewIdAfter', '')::uuid
            is distinct from action_row.planned_review_id
          or (action_row.action_kind = 'compensate_restore' and (
            nullif(action_json ->> 'expectedEffectiveReviewIdAfter', '')::uuid
              is distinct from source_action.pre_effective_review_id
            or nullif(action_json ->> 'effectiveSourceReviewId', '')::uuid
              is distinct from source_action.pre_effective_review_id
          ))
          or (action_row.action_kind = 'compensate_void' and (
            nullif(action_json ->> 'expectedEffectiveReviewIdAfter', '')::uuid
              is not null
            or nullif(action_json ->> 'effectiveSourceReviewId', '')::uuid
              is not null
          ))
          or action_json -> 'expectedEventSequence' is distinct from (case
            when action_row.action_kind = 'compensate_restore'
              then '["review_compensated"]'::jsonb
            else '["review_voided"]'::jsonb end) then
          raise exception using errcode = 'P7751', message = 'V2 compensation requires the exact imported physical head and disposition';
        end if;
        perform public.assert_literature_gold_review_chain_head_v1(locked_item.id);

        restored_status := source_action.planned_state
          #>> '{preImportItemState,reviewStatus}';
        restored_started_at := nullif(source_action.planned_state
          #>> '{preImportItemState,startedAt}', '')::timestamptz;
        restored_completed_at := nullif(source_action.planned_state
          #>> '{preImportItemState,completedAt}', '')::timestamptz;
        restored_supplemental_at := nullif(source_action.planned_state
          #>> '{preImportItemState,supplementalMetadataRevealedAt}', '')::timestamptz;
        restored_automated_at := nullif(source_action.planned_state
          #>> '{preImportItemState,automatedSignalsRevealedAt}', '')::timestamptz;
        if restored_status not in (
          'pending', 'in_progress', 'return_later', 'completed'
        ) then
          raise exception using errcode = 'P7752', message = 'V2 import did not journal a valid pre-import item state';
        end if;

        if action_row.action_kind = 'compensate_restore' then
          select * into source_review
          from public.literature_gold_set_reviews as review
          where review.id = source_action.pre_effective_review_id
            and review.item_id = locked_item.id;
          if not found or restored_status <> 'completed' then
            raise exception using errcode = 'P7753', message = 'V2 restore requires the exact prior effective payload';
          end if;

          insert into public.literature_gold_set_reviews (
            id, item_id, revision, supersedes_review_id, reviewer_user_id,
            reviewer_email, relevance_label, metadata_sufficiency,
            reviewer_confidence, topic_ids, technology_tags, clinical_purposes,
            disease_tags, study_design, publication_status,
            categorization_from_full_text, full_text_used, notes,
            used_supplemental_metadata, review_seconds, is_blinded,
            started_at, completed_at, created_at, technology_tag_status,
            disease_tag_status, taxonomy_version, label_schema_version,
            enrichment_schema_version, enrichment_provenance, revision_kind,
            lifecycle_state, operation_action_id, compensates_review_id,
            effective_source_review_id, operation_contract_version_code
          ) values (
            action_row.planned_review_id, locked_item.id,
            action_row.expected_revision, imported_review.id,
            source_review.reviewer_user_id, source_review.reviewer_email,
            source_review.relevance_label, source_review.metadata_sufficiency,
            source_review.reviewer_confidence, source_review.topic_ids,
            source_review.technology_tags, source_review.clinical_purposes,
            source_review.disease_tags, source_review.study_design,
            source_review.publication_status,
            source_review.categorization_from_full_text,
            source_review.full_text_used, source_review.notes,
            source_review.used_supplemental_metadata,
            source_review.review_seconds, source_review.is_blinded,
            mutation_anchor
              + action_row.action_sequence * interval '1 microsecond',
            mutation_anchor
              + action_row.action_sequence * interval '1 microsecond',
            mutation_anchor
              + action_row.action_sequence * interval '1 microsecond',
            source_review.technology_tag_status,
            source_review.disease_tag_status, source_review.taxonomy_version,
            source_review.label_schema_version,
            source_review.enrichment_schema_version,
            source_review.enrichment_provenance, 'compensation', 'effective',
            action_row.id, imported_review.id, source_review.id, 2
          ) returning * into created_review;
        else
          if source_action.pre_effective_review_id is not null
            or restored_status = 'completed' then
            raise exception using errcode = 'P7754', message = 'V2 void is valid only for a first effective import';
          end if;

          insert into public.literature_gold_set_reviews (
            id, item_id, revision, supersedes_review_id, reviewer_user_id,
            reviewer_email, relevance_label, metadata_sufficiency,
            reviewer_confidence, topic_ids, technology_tags, clinical_purposes,
            disease_tags, study_design, publication_status,
            categorization_from_full_text, full_text_used, notes,
            used_supplemental_metadata, review_seconds, is_blinded,
            started_at, completed_at, created_at, technology_tag_status,
            disease_tag_status, taxonomy_version, label_schema_version,
            enrichment_schema_version, enrichment_provenance, revision_kind,
            lifecycle_state, operation_action_id, compensates_review_id,
            effective_source_review_id, operation_contract_version_code
          ) values (
            action_row.planned_review_id, locked_item.id,
            action_row.expected_revision, imported_review.id,
            imported_review.reviewer_user_id, imported_review.reviewer_email,
            imported_review.relevance_label, imported_review.metadata_sufficiency,
            imported_review.reviewer_confidence, imported_review.topic_ids,
            imported_review.technology_tags, imported_review.clinical_purposes,
            imported_review.disease_tags, imported_review.study_design,
            imported_review.publication_status,
            imported_review.categorization_from_full_text,
            imported_review.full_text_used, imported_review.notes,
            imported_review.used_supplemental_metadata,
            imported_review.review_seconds, imported_review.is_blinded,
            mutation_anchor
              + action_row.action_sequence * interval '1 microsecond',
            mutation_anchor
              + action_row.action_sequence * interval '1 microsecond',
            mutation_anchor
              + action_row.action_sequence * interval '1 microsecond',
            imported_review.technology_tag_status,
            imported_review.disease_tag_status, imported_review.taxonomy_version,
            imported_review.label_schema_version,
            imported_review.enrichment_schema_version,
            imported_review.enrichment_provenance, 'compensation', 'withdrawn',
            action_row.id, imported_review.id, null, 2
          ) returning * into created_review;
        end if;

        update public.literature_gold_set_items
        set current_review_id = created_review.id,
          review_status = restored_status, started_at = restored_started_at,
          completed_at = restored_completed_at,
          supplemental_metadata_revealed_at = restored_supplemental_at,
          automated_signals_revealed_at = restored_automated_at
        where id = locked_item.id;

        update public.literature_gold_review_operation_actions
        set action_status = 'applied', result_review_id = created_review.id,
          processed_at = mutation_anchor
            + action_row.action_sequence * interval '1 microsecond',
          result_state = jsonb_build_object(
            'reviewId', created_review.id, 'revision', created_review.revision,
            'supersedesReviewId', created_review.supersedes_review_id,
            'lifecycleState', created_review.lifecycle_state,
            'currentReviewId', created_review.id,
            'effectiveReviewId', case
              when created_review.lifecycle_state = 'effective'
                then created_review.effective_source_review_id else null end,
            'fullTextUsed', created_review.full_text_used,
            'isBlinded', created_review.is_blinded,
            'operationContractVersion', created_review.operation_contract_version
          )
        where id = action_row.id;

        insert into public.literature_gold_set_events (
          batch_id, item_id, actor_user_id, actor_email, event_type,
          before_value, after_value, operation_id, operation_action_id,
          operation_event_sequence, created_at
        ) values (
          p_batch_id, locked_item.id, p_actor_user_id, normalized_email,
          case when created_review.lifecycle_state = 'withdrawn'
            then 'review_voided' else 'review_compensated' end,
          jsonb_build_object(
            'importedReviewId', imported_review.id,
            'currentReviewId', locked_item.current_review_id
          ),
          jsonb_build_object(
            'reviewId', created_review.id, 'revision', created_review.revision,
            'revisionKind', 'compensation',
            'lifecycleState', created_review.lifecycle_state,
            'effectiveSourceReviewId', created_review.effective_source_review_id,
            'operationContractVersion', created_review.operation_contract_version,
            'fullTextUsed', created_review.full_text_used,
            'isBlinded', created_review.is_blinded,
            'technologyTagStatus', created_review.technology_tag_status,
            'diseaseTagStatus', created_review.disease_tag_status
          ), p_operation_id, action_row.id, action_row.action_sequence + 1,
          mutation_anchor
            + action_row.action_sequence * interval '1 microsecond'
        );
        applied_count := applied_count + 1;
      end if;

      if fault_after_action = action_row.action_sequence then
        raise exception using errcode = 'P7799', message = format(
          'controlled V2 compensation rehearsal fault after action %s',
          fault_after_action
        );
      end if;
    end loop;

    if applied_count <> planned_apply_count or noop_count <> planned_noop_count then
      raise exception using errcode = 'P7755', message = 'V2 compensation outcomes do not match planned dynamic counts';
    end if;
    for action_row in
      select action.* from public.literature_gold_review_operation_actions action
      where action.operation_id = p_operation_id order by action.item_id
    loop
      perform public.assert_literature_gold_review_chain_head_v1(action_row.item_id);
    end loop;

    post_effective_hash := public.literature_gold_effective_state_hash_v2(
      p_batch_id, 'development'
    );
    if post_effective_hash is distinct from expected_post_effective_hash then
      raise exception using errcode = 'P7756', message = 'V2 compensation did not restore authorized effective state';
    end if;

    update public.literature_gold_review_operations
    set status = 'completed', applied_action_count = applied_count,
      noop_action_count = noop_count,
      completed_at = terminal_anchor
    where id = p_operation_id;
    insert into public.literature_gold_set_events (
      batch_id, actor_user_id, actor_email, event_type, after_value,
      operation_id, operation_event_sequence, created_at
    ) values (
      p_batch_id, p_actor_user_id, normalized_email,
      'import_compensation_completed',
      jsonb_build_object(
        'contractVersion', 'gold-review-import-compensation/2.0.0',
        'operationId', p_operation_id,
        'targetImportOperationId', p_target_import_operation_id,
        'appliedActionCount', applied_count, 'noopActionCount', noop_count,
        'restoredEffectiveStateSha256', post_effective_hash
      ), p_operation_id, planned_action_count + 2,
      terminal_anchor
    );
    post_physical_hash := public.literature_gold_physical_state_hash_v2(
      p_batch_id, 'development'
    );
    update public.literature_gold_review_operations
    set post_physical_state_sha256 = post_physical_hash,
      post_effective_state_sha256 = post_effective_hash
    where id = p_operation_id;
  exception when others then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message = message_text;
    update public.literature_gold_review_operation_actions
    set action_status = 'failed',
      processed_at = mutation_anchor
        + action_sequence * interval '1 microsecond',
      result_state = jsonb_build_object(
        'errorSqlstate', caught_sqlstate,
        'errorMessage', left(caught_message, 4000)
      )
    where operation_id = p_operation_id and action_status = 'planned';
    update public.literature_gold_review_operations
    set status = 'failed', applied_action_count = 0, noop_action_count = 0,
      error_sqlstate = caught_sqlstate, error_message = left(caught_message, 4000),
      completed_at = terminal_anchor
    where id = p_operation_id;
    insert into public.literature_gold_set_events (
      batch_id, actor_user_id, actor_email, event_type, after_value,
      operation_id, operation_event_sequence, created_at
    ) values (
      p_batch_id, p_actor_user_id, normalized_email,
      'import_compensation_failed',
      jsonb_build_object(
        'contractVersion', 'gold-review-import-compensation/2.0.0',
        'operationId', p_operation_id,
        'targetImportOperationId', p_target_import_operation_id,
        'errorSqlstate', caught_sqlstate,
        'errorMessage', left(caught_message, 4000),
        'reviewAndPointerMutationsCommitted', false
      ), p_operation_id, planned_action_count + 2,
      terminal_anchor
    );

    post_effective_hash := public.literature_gold_effective_state_hash_v2(
      p_batch_id, 'development'
    );
    if post_effective_hash is distinct from pre_effective_hash then
      raise exception using errcode = 'P7798', message = format(
        'failed V2 compensation changed effective state after rollback; original SQLSTATE %s: %s',
        caught_sqlstate, left(caught_message, 3500)
      );
    end if;
    post_physical_hash := public.literature_gold_physical_state_hash_v2(
      p_batch_id, 'development'
    );
    update public.literature_gold_review_operations
    set post_physical_state_sha256 = post_physical_hash,
      post_effective_state_sha256 = post_effective_hash
    where id = p_operation_id;
    return public.literature_gold_review_operation_receipt_v2(
      p_operation_id, false
    );
  end;

  return public.literature_gold_review_operation_receipt_v2(
    p_operation_id, false
  );
end;
$$;

-- Default function EXECUTE includes PUBLIC.  Establish an explicit read-only
-- helper surface and an exact service_role-only transition boundary.
revoke all on function public.enforce_literature_gold_operation_contract_v2()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_literature_gold_review_contract_v2()
  from public, anon, authenticated, service_role;
revoke all on function public.validate_literature_gold_operation_plan_v2(
  jsonb, text, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.validate_literature_gold_operation_authorization_v2(
  jsonb, text, text, uuid, uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.literature_gold_review_clinical_projection_v2(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.literature_gold_effective_state_hash_v2(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.literature_gold_physical_state_hash_v2(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.validate_literature_gold_import_review_payload_v2(
  uuid, jsonb, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.literature_gold_review_operation_result_v2(
  uuid, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.literature_gold_review_operation_receipt_v2(
  uuid, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.reconcile_literature_gold_review_operation_v2(
  uuid, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.apply_literature_gold_import_v2(
  uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.compensate_literature_gold_import_v2(
  uuid, uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) from public, anon, authenticated, service_role;

grant execute on function public.validate_literature_gold_operation_plan_v2(
  jsonb, text, uuid, uuid, text, text, text
) to service_role;
grant execute on function public.validate_literature_gold_operation_authorization_v2(
  jsonb, text, text, uuid, uuid, uuid, text, text, text, jsonb
) to service_role;
grant execute on function public.literature_gold_review_clinical_projection_v2(uuid)
  to service_role;
grant execute on function public.literature_gold_effective_state_hash_v2(uuid, text)
  to service_role;
grant execute on function public.literature_gold_physical_state_hash_v2(uuid, text)
  to service_role;
grant execute on function public.validate_literature_gold_import_review_payload_v2(
  uuid, jsonb, boolean
) to service_role;
grant execute on function public.literature_gold_review_operation_result_v2(
  uuid, boolean
) to service_role;
grant execute on function public.literature_gold_review_operation_receipt_v2(
  uuid, boolean
) to service_role;
grant execute on function public.reconcile_literature_gold_review_operation_v2(
  uuid, text, jsonb
) to service_role;
grant execute on function public.apply_literature_gold_import_v2(
  uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) to service_role;
grant execute on function public.compensate_literature_gold_import_v2(
  uuid, uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) to service_role;

comment on function public.apply_literature_gold_import_v2(
  uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) is 'Applies an exact checksum-authorized development-only gold review import under gold-review-import-compensation/2.0.0.';
comment on function public.compensate_literature_gold_import_v2(
  uuid, uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) is 'Appends exact-copy restore/void revisions for a sealed V2 import; never rewinds review history.';
comment on function public.reconcile_literature_gold_review_operation_v2(
  uuid, text, jsonb
) is 'Non-mutating lost-ack reconciliation for a checksum-bound V2 operation.';

notify pgrst, 'reload schema';
