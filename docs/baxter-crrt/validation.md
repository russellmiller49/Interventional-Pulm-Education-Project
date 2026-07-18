# Baxter CRRT v1 validation record

## Automated acceptance

The repository test suite must establish:

- exactly 18 cases, seven drills, six tools, one PrisMax Mastery artifact, two operational adapters,
  and one transfer capstone;
- safe, accepted-alternative, unsafe, critical-error, timed response, reassessment, deterministic
  replay, and debrief paths for every case and drill;
- all four modalities, device-specific setup/displays/alarms/stop-end, bag/scale conservation,
  interruption/downtime, and canonical cross-device outcome equivalence within `1e-9`;
- pending/informational review metadata never blocks private runtime;
- citrate schemas, UI, progress, and analytics contain no amount, target, titration, adjustment, or
  actionable protocol instruction;
- clean Learn/Practice/Mastery isolation, Mastery score rules, progress v3 reset/parsing, and
  review-preview telemetry suppression;
- admin guards, robots, search, navigation, and sitemap behavior derived from release stage.

Required commands:

```text
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
```

Scoped formatting, stale-reference scans, and a final diff review follow the automated commands.

## Browser acceptance

Run authenticated desktop, tablet, and 320-pixel walkthroughs of both protected routes. Exercise:

- Learn, Practice, and masked Mastery from clean state;
- PrisMax and Prismaflex device selection and device-specific projections;
- all drill and tool selectors;
- cross-device transfer completion;
- keyboard-only tabs, controls, dialogs, alarm handling, and focus restoration;
- screen-reader labels/summaries, global alarms, 200% zoom, reduced motion, and reflow;
- reviewed-English fallback on non-English routes;
- absence of telemetry/progress writes in `/review`.

## Evidence boundary

Automated tests verify deterministic implementation behavior and the absence of forbidden fields.
They do not establish clinical efficacy, institutional configuration fidelity, certification, or an
independent competency decision. SME feedback is captured in `final-sme-checklist.md` and addressed
before any later public-release request.

## Current run

Completed 2026-07-17 with release stage `sme-review`; the module remains protected, unlisted,
excluded from search and sitemap output, and `noindex`.

### Command results

- `npm run type-check`: passed.
- `npm run lint`: passed with 0 errors and 13 pre-existing warnings outside the Baxter CRRT
  module.
- `npm test -- --runInBand`: 215/215 suites and 1,501/1,501 tests passed.
- `npm run build`: passed and generated both Baxter CRRT routes. Existing repository warnings were
  limited to the Mermaid/Langium dynamic dependency and unset global `metadataBase` notices.
- Scoped Prettier checks and `git diff --check`: passed.

### Browser observations

The protected routes resolved under local-development authentication and were exercised at desktop,
820-pixel tablet, and 320-pixel mobile widths.

- `/en/baxter-crrt` exposed release stage `sme-review`, learner persistence `v3`, two device
  profiles, exactly 18 case options, five experience tabs, seven runnable cause-first drills, and six
  learner tools.
- Device selection switched to Prismaflex; entering Mastery intentionally restored the required
  PrisMax profile and masked `CRRT-16`. The rendered criteria require at least 80, no critical error,
  completed reassessment, and expose no hint control.
- Keyboard Arrow Right moved focus and selection from Learn to Practice.
- Both tablet and 320-pixel layouts had no document-level horizontal overflow. All visible
  interactive controls inspected at 320 pixels met the 44-pixel target.
- `/en/baxter-crrt/review` rendered the full five-tab workspace plus the final-SME checklist and
  build version, with `review-preview`, telemetry `suppressed`, progress writes `suppressed`, and
  `noindex, nofollow, noarchive` metadata.
- One pair of transient Next.js CSS hot-reload messages appeared immediately after an in-session
  stylesheet edit; no module assertion failed, and the subsequent production build completed.

The automated accessibility suites cover reduced motion, 200% zoom/reflow rules, screen-reader
summaries, global alarms, focus restoration, and both protected route guards. These checks establish
implementation behavior only; the final SME pass remains the next editorial step.
