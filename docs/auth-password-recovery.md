# Password recovery callback runbook

The main-site password recovery flow uses Supabase's server-side token-hash pattern:

1. `resetPasswordForEmail` sends the recovery email request.
2. The email links directly to `/auth/callback` with `token_hash` and `type=recovery`.
3. The callback verifies the token with `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`.
4. The existing `@supabase/ssr` cookie adapter persists the returned session on the redirect response.
5. `/auth/update-password` reads that session and calls `supabase.auth.updateUser({ password })`.

This avoids depending on the hosted Supabase `/verify -> redirect_to` handoff for password
recovery. The callback accepts no other token-hash OTP type. The existing PKCE code-exchange flow
and shared embedded-application callback remain separate.

See the Supabase documentation for [email-template variables](https://supabase.com/docs/guides/auth/auth-email-templates#terminology) and [`verifyOtp`](https://supabase.com/docs/reference/javascript/auth-verifyotp).

## Required hosted email-template change

Do not change the hosted Reset Password template until the token-hash callback implementation is
deployed. After the deployment is active, make this change manually in the Supabase Dashboard under
Authentication > Email Templates > Reset Password. Do not apply it through a management API.

Change the template from:

```html
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

to:

```html
<h2>Reset Password</h2>

<p>Follow this link to reset the password for your user:</p>

<p>
  <a
    href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=%2Fauth%2Fupdate-password"
  >
    Reset Password
  </a>
</p>
```

The application must be deployed first because new emails will stop using Supabase's hosted
`ConfirmationURL` and will depend immediately on the application callback's `token_hash` support.
Previously generated links keep their old behavior and should not be reused for validation.

## Production verification

After the code is merged and the Railway deployment is `ACTIVE`:

1. Apply the Reset Password template above in the Supabase Dashboard.
2. Generate a completely new password-reset email; do not reuse an older recovery link.
3. Open the new link and confirm the browser reaches
   `https://interventionalpulm.org/auth/update-password`.
4. Confirm the password form is enabled instead of reporting that no recovery session exists.
5. Enter and save a new password.
6. Confirm the application redirects to login.
7. Confirm login succeeds with the new password.
8. Confirm the URL chain contains no `0.0.0.0`, `localhost`, or `:8080` value.
9. Confirm no token hash remains in the URL after the callback redirect.
