# Critical-care testing and release

## Required automated checks

For every implementation slice:

```bash
npm run type-check
npm run lint
npx jest <focused paths> --runInBand
```

Before completing a migration or release-hardening slice:

```bash
npm run storybook:build
npm test -- --runInBand
npm run build
git diff --check
```

Storybook TypeScript checking is disabled by its current builder configuration, so
`npm run type-check` is independently mandatory.

## Test matrix

- Catalogs: stable/unique IDs, known references, evidence/release invariants, mastery rules, and
  heavy-asset alternatives.
- Progress: empty, partial, completed, mastered, corrupt JSON, unknown version, legacy keys,
  incompatible checkpoint, and storage exceptions.
- Routes: old URLs, new Overview/Learn/Practice/Assess routes, locale variants, query deep links,
  release guards, noindex, search, and sitemap boundaries.
- Activity shell: keyboard order, visible focus, phase orientation, resume, reset, drawers,
  Guided/Practice/Challenge differences, and assessment masking.
- Engine regression: existing calculations, reducers, time equivalence, device adapters, scoring,
  mastery, and critical errors remain green.
- Accessibility: non-color-only status, text alternatives, reduced motion, labels/descriptions,
  live-region restraint, 200% zoom, and 320-pixel reflow.
- Responsive behavior: 1440×900 fixed desktop workspace, 1024×768 tablet surface, and 390×844
  launch gate/lightweight alternative.
- Privacy: schemas reject free text, PHI, physiology, waveform/trend arrays, detailed settings,
  commands, and replay payloads; recursive client-import tests keep restricted catalogs and module
  runtimes out of public client bundles.
- Analytics: authored phase, prediction, hint, safety, debrief, transfer, completion, and mastery
  transitions emit bounded lifecycle events once, while page views and scrolling earn no credit.

No end-to-end framework is currently installed. Use Jest/RTL, Storybook accessibility checks, and
manual browser smoke testing unless a required behavior cannot be verified with that toolchain.

## Local browser verification

Run the application on port 3001. When a protected route must be tested, use the localhost-only
auth endpoint with `LOCAL_DEV_AUTH_TOKEN` read directly from `.env.local`; never expose the token in
logs, screenshots, commits, or reports.

Verify dashboard return states, exact/safe resume, keyboard-only operation, reduced motion, dark
module themes, internal versus document scrolling, small-screen launch gates, reference search,
notebook reload, and text alternatives for waveforms/3D/circuits.

## Release boundaries

Automated checks establish software behavior, not clinical validity, device competency, regulatory
approval, or publication readiness. Module-specific evidence and review documents remain
authoritative. Do not change draft, private-development, SME-review, tester-preview,
unlisted-preview, or published status without explicit separately reviewed authorization.

The following human gates remain mandatory before any corresponding release-stage change:

- Moderated learner usability testing, including the PAC activity's three orientation questions.
- Keyboard-only, 200% zoom, 320-pixel reflow, and representative assistive-technology review on
  supported browsers and devices.
- Module-owner and clinical SME review of instructional framing, masking, debriefs, and transfer
  prompts.
- Evidence/publication-owner approval for modules that are not already approved for public
  discovery.

Passing the automated matrix or local browser smoke test does not satisfy these gates.

## Baseline before rebuild runtime changes

Recorded 2026-07-22:

- `npm run type-check`: passed.
- `npm run lint`: passed with 14 pre-existing warnings and zero errors.
- Focused critical-care and progress checks: 10 suites, 57 tests passed.
- Full Jest: 256 suites, 1,826 tests passed.

The local runtime was newer than the repository-pinned npm version; the baseline still passed.
Future failures should be compared with this record and unrelated warnings reported separately.
