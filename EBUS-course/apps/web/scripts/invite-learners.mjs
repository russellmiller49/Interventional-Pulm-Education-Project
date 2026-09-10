import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

function resolveSupabaseUrl(env) {
  const directUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;

  if (directUrl) {
    return directUrl;
  }

  const projectRef = env.VITE_SUPABASE_PROJECT_REF ?? env.NEXT_PUBLIC_SUPABASE_PROJECT_REF;

  return projectRef ? `https://${projectRef}.supabase.co` : '';
}

function parseArgs(argv) {
  const result = {
    emailsPath: '',
    redirectTo: process.env.INVITE_REDIRECT_TO ?? '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--emails') {
      result.emailsPath = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (argument === '--redirect') {
      result.redirectTo = argv[index + 1] ?? '';
      index += 1;
    }
  }

  return result;
}

function normalizeEmailList(source) {
  const tokens = source
    .split(/[\n,;]/)
    .map((value) => value.trim())
    .filter(Boolean);

  const unique = [...new Set(tokens.filter((value) => value.includes('@')))];

  return unique;
}

async function main() {
  const { emailsPath, redirectTo } = parseArgs(process.argv.slice(2));
  const supabaseUrl = resolveSupabaseUrl(process.env);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!emailsPath) {
    throw new Error('Pass a newline- or comma-separated list with --emails <path>.');
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Set SUPABASE_URL, VITE/NEXT_PUBLIC_SUPABASE_URL, or VITE/NEXT_PUBLIC_SUPABASE_PROJECT_REF plus SUPABASE_SERVICE_ROLE_KEY before running invites.',
    );
  }

  if (!redirectTo) {
    throw new Error('Provide an invite redirect with --redirect or INVITE_REDIRECT_TO.');
  }

  const emailSource = await readFile(emailsPath, 'utf8');
  const emails = normalizeEmailList(emailSource);

  if (emails.length === 0) {
    throw new Error(`No emails were found in ${emailsPath}.`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let sent = 0;

  for (const email of emails) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        app_scope: 'socal_ebus_course',
        course: 'SoCal EBUS Prep',
      },
    });

    if (error) {
      console.error(`Invite failed for ${email}: ${error.message}`);
      continue;
    }

    if (data.user?.id) {
      const now = new Date().toISOString();
      const { error: profileError } = await supabase.from('learner_profiles').upsert(
        {
          id: data.user.id,
          email,
          invite_sent_at: now,
          must_set_password: true,
          approval_status: 'approved',
          approved_at: now,
          approved_by: 'invite script',
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        console.error(`Profile seed failed for ${email}: ${profileError.message}`);
      }
    }

    sent += 1;
    console.log(`Invite sent to ${email}`);
  }

  console.log(`Finished: ${sent}/${emails.length} invites sent.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
