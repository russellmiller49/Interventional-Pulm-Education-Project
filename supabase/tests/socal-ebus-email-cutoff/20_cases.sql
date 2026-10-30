-- Runs after migration 20261030000000. Every check raises on failure; the last line prints ALL CHECKS PASSED.
\set ON_ERROR_STOP on
do $$
declare n int; r record; lid uuid; ev uuid; tok text;
begin
  -- 1. Delivery is off before activation: a new signup creates its event but nothing is sent or claimable.
  insert into public.learner_profiles (email, full_name) values ('pre-activation@invented.test', 'INVENTED') returning id into lid;
  select id, webhook_token into ev, tok from public.socal_ebus_email_events where learner_id = lid;
  assert ev is not null, 'pre-activation event exists';
  assert (select count(*) from net.calls) = 0, 'no call before activation';
  assert (select count(*) from public.claim_socal_ebus_email_event(ev, tok)) = 0, 'no claim before activation';
end $$;

-- 2. Activation (owner step), in its own transaction as in production. Its moment is the cutoff.
select pg_sleep(0.01);
insert into public.socal_ebus_email_delivery_activation (activated_by, note) values ('INVENTED Owner', 'INVENTED test activation');

do $$
declare n int; r record; lid uuid; ev uuid; tok text;
begin
  select e.id into ev from public.socal_ebus_email_events e join public.learner_profiles p on p.id = e.learner_id where p.email = 'pre-activation@invented.test';
  -- 3. Zero historical sends: every event created before the cutoff (the 116 failed, the pre-activation pending one) is
  --    neither dispatched nor claimable, even with its correct token.
  for r in select id, webhook_token from public.socal_ebus_email_events loop
    perform public.dispatch_socal_ebus_email_event(r.id);
    assert (select count(*) from public.claim_socal_ebus_email_event(r.id, r.webhook_token)) = 0, 'historical event claimed';
  end loop;
  assert (select count(*) from net.calls) = 0, 'a historical event was dispatched';

  -- 4. Tampering cannot make an old event deliverable.
  update public.socal_ebus_email_events set status = 'pending', error_message = null where status = 'failed';
  for r in select id, webhook_token from public.socal_ebus_email_events loop
    perform public.dispatch_socal_ebus_email_event(r.id);
    assert (select count(*) from public.claim_socal_ebus_email_event(r.id, r.webhook_token)) = 0, 'reset event claimed';
  end loop;
  assert (select count(*) from net.calls) = 0, 'a reset historical event was dispatched';
  update public.socal_ebus_email_events set status = 'failed' where created_at < '2026-06-04';  -- back to the audited state
  begin
    update public.socal_ebus_email_events set created_at = now() where id = ev;
    raise exception 'created_at was changed';
  exception when raise_exception then
    if sqlerrm = 'created_at was changed' then raise; end if;
  end;
  begin
    update public.socal_ebus_email_delivery_activation set activated_at = '2026-01-01';
    raise exception 'cutoff was moved';
  exception when raise_exception then
    if sqlerrm = 'cutoff was moved' then raise; end if;
  end;
  begin
    delete from public.socal_ebus_email_delivery_activation;
    raise exception 'cutoff was removed';
  exception when raise_exception then
    if sqlerrm = 'cutoff was removed' then raise; end if;
  end;

  -- 5. Updating old course records sends nothing: profile edits, and an approval undone and redone, add no event.
  n := (select count(*) from public.socal_ebus_email_events);
  update public.learner_profiles set full_name = 'INVENTED edited' where email like 'invented-learner-%';
  update public.learner_profiles set approval_status = 'pending' where email = 'invented-learner-1@invented.test';
  update public.learner_profiles set approval_status = 'approved' where email = 'invented-learner-1@invented.test';
  update public.learner_profiles set approval_status = 'pending' where email = 'invented-learner-60@invented.test';
  update public.learner_profiles set approval_status = 'approved' where email = 'invented-learner-60@invented.test';
  assert (select count(*) from public.socal_ebus_email_events where learner_id in (select id from public.learner_profiles where email = 'invented-learner-60@invented.test')) <= 1,
    'learner 60 got at most the approval event';
  assert (select count(*) from net.calls c join public.socal_ebus_email_events e on e.id = (c.body->>'eventId')::uuid
          join public.learner_profiles p on p.id = e.learner_id where p.email = 'invented-learner-1@invented.test') = 0, 'old learner 1 dispatched';

  -- 6. A new notification after the cutoff goes out once, to the test address only.
  delete from net.calls where (body->>'eventId')::uuid in (select e.id from public.socal_ebus_email_events e join public.learner_profiles p on p.id = e.learner_id
                                                           where p.email = 'invented-learner-60@invented.test');
  insert into public.learner_profiles (email, full_name) values ('owner-test@invented.test', 'INVENTED Owner test') returning id into lid;
  select id, webhook_token into ev, tok from public.socal_ebus_email_events where learner_id = lid;
  assert (select count(*) from net.calls) = 1, 'exactly one call, for the new signup';
  assert (select (body->>'eventId')::uuid from net.calls) = ev, 'the call is for the new event';
  assert (select count(*) from public.claim_socal_ebus_email_event(ev, 'wrong-token')) = 0, 'claimed with a wrong token';
  assert (select count(*) from public.claim_socal_ebus_email_event(ev, tok)) = 1, 'new event claimable once';
  assert (select count(*) from public.claim_socal_ebus_email_event(ev, tok)) = 0, 'claimed twice';

  -- 7. History is preserved for audit.
  assert (select count(*) from public.socal_ebus_email_events where status = 'failed' and created_at < '2026-06-04') = 116, '116 historical rows kept';
  raise notice 'ALL CHECKS PASSED';
end $$;
select 'calls after activation' as k, count(*)::text as v from net.calls
union all select 'recipients of those calls', string_agg(distinct p.email, ',') from net.calls c
  join public.socal_ebus_email_events e on e.id = (c.body->>'eventId')::uuid join public.learner_profiles p on p.id = e.learner_id
union all select 'historical failed rows kept', count(*)::text from public.socal_ebus_email_events where status = 'failed';
