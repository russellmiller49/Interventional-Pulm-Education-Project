# Seasonal course availability

`config/course-availability.json` pauses the Southern California EBUS participant
course and PCCM Intro Course independently. Both are currently closed. This is a
source-controlled release setting, so changing it requires a rebuild and deployment.

Course content, enrollments, entitlements, assessments, and saved progress are retained.
No database migration or account deletion is part of the closure.

- Paused courses disappear from navigation, search, learner dashboard links, and code redemption.
- Old course bookmarks go through main-site login. A missing/incomplete main-site profile or
  missing current agreement/consent sends the user to `/signup?mode=complete`. Existing profile
  fields are prefilled, but the agreement is always unchecked. Saving updates the same account.
- Completed main-site users are sent to the dashboard with a course-closed notice.
- Main-site registration and consent are checked before all entitlement-protected page access.
- All PCCM course API endpoints reject requests while closed, including code redemption,
  video URLs/progress, and assessments. Cohort administration pages remain available for records.
- Former PCCM enrollment no longer redirects shared modules to the closed course's pretests.
- Standalone EBUS/TNM modules and their shared assets remain available. The embedded EBUS app
  blocks course hash routes even when loaded using a public-training URL or an old shared passcode.
- The existing site-admin-only EBUS `adminPreview=1` entry point remains available. Existing
  EBUS password-reset callbacks remain usable and send learners to main-site sign-in afterward.

Before reopening for a future year, review dates, cohort codes, enrollments, assessments,
consent language, and existing progress retention. The flags alone do not create a new cohort
or reset historical records. Main-site registration and consent remain required after reopening.

Validation includes `src/proxy.test.ts`, `src/lib/site-auth/access.test.ts`,
`src/lib/site-auth/user-agreement.test.ts`, `src/components/auth/SignupForm.test.tsx`,
and `src/features/pccm-intro-course/server.test.ts`.
