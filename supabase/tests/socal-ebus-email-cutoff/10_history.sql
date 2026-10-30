-- The May–June 2026 history: 58 learners signed up and were approved; every one of their 116 notifications failed
-- ("No email provider configured"), as in production. Three more approved learners have no events.
do $$
declare i int; lid uuid;
begin
  for i in 1..58 loop
    insert into public.learner_profiles (email, full_name) values (format('invented-learner-%s@invented.test', i), 'INVENTED') returning id into lid;
    update public.learner_profiles set approval_status = 'approved', approved_at = now() where id = lid;
  end loop;
  for i in 59..61 loop
    insert into public.learner_profiles (email, full_name, approval_status, invite_sent_at) values (format('invented-learner-%s@invented.test', i), 'INVENTED', 'approved', now());
  end loop;
  update public.socal_ebus_email_events set status = 'failed', attempt_count = 1, error_message = 'No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY.',
    created_at = timestamptz '2026-05-05' + (random() * interval '29 days');
  delete from net.calls;  -- the history's own dispatch attempts are not under test
end $$;
select count(*) as historical_failed_events from public.socal_ebus_email_events where status = 'failed';
