# SoCal EBUS Prep Supabase setup

This app now supports:

- invited learner login with Supabase Auth
- self-service learner signup with separate login and institutional email fields
- course leadership approval before self-service signups can access modules
- shared-passcode admin dashboard at `/admin` with pretest and post-test answer review
- password recovery emails
- learner profile editing
- first-password setup after invite acceptance
- required pretest gating before other modules unlock
- persistent learner snapshots, pretest attempts, lecture completion, and module time tracking

## 1. Apply the schema

Run the SQL in [`schema.sql`](/home/rjm/projects/EBUS_course/supabase/schema.sql) inside your Supabase SQL editor.

## 2. Configure the web app

Add the client variables from [`apps/web/.env.example`](/home/rjm/projects/EBUS_course/apps/web/.env.example):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`

The web app also accepts `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_PROJECT_REF` if you already have those in your environment.

## 3. Invite learners

Create a text file with one email per line, then run:

```bash
cd /home/rjm/projects/EBUS_course/apps/web
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
INVITE_REDIRECT_TO="https://your-app-host/auth" \
npm run invite:learners -- --emails ./learners.txt
```

The script also accepts `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PROJECT_REF` as fallbacks for the project URL. It uses the admin API to send Supabase invite emails and seeds a `learner_profiles` row with `must_set_password = true`. Invite emails become the learner login email; institutional email can be added separately in the profile.

Invited learners are marked approved by the script. Self-service signups remain pending until course leadership opens `/admin`, enters the shared leadership password, and approves the learner.

## 4. Hosting notes

- In Supabase Auth settings, add your production app URL and local dev URL to the redirect allow-list.
- Include your app base callback URLs in the allow-list, for example
  `https://your-app-host/socal-ebus-course/app/?authMode=sign-in` and
  `https://your-app-host/socal-ebus-course/app/?authMode=reset-password`.
  For local testing, also include `http://localhost:5173/?authMode=reset-password` or the Vite port you are using.
- If the main `interventionalpulm.org` site provides a shared auth callback, set
  `VITE_SUPABASE_AUTH_CALLBACK_URL=https://interventionalpulm.org/auth/callback?app=socal-ebus-course`.
  Supabase recovery and sign-in emails will then request that callback with the correct `authMode`.
- If the app is deployed under a path such as `/socal-ebus-course/app/`, either leave `VITE_SITE_URL` unset so the app uses
  `VITE_BASE_URL`, or set `VITE_SITE_URL` to the full deployed app base URL including that path.
- The Supabase Reset Password email template should use `{{ .ConfirmationURL }}` for the reset link, or a manually-built
  verify URL using `redirect_to={{ .RedirectTo }}` with no leading spaces. Do not use `{{ .SiteURL }}` for recovery links.
- SMTP must be configured in Supabase if you want branded invite emails.
- The service-role key is only for the invite script. Do not expose it in the Vite client environment.
