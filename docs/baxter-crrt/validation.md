# Baxter CRRT validation record

## Automated acceptance

The suite verifies:

- exactly 18 registry cases, seven lessons, ten core cases, seven optional cases, five drills, two
  embedded labs, one PrisMax runtime profile, and one masked capstone;
- `CRRT-16` absent from every Practice list and accepted only through the capstone manifest;
- safe, accepted-alternative, unsafe, timed-response, reassessment, deterministic replay, and
  debrief behavior;
- PrisMax setup, calculations, pressure displays, alarm/stop framing, conservation, and downtime;
- the seven engine phases and four-stage presentation grouping;
- ProgressV3 parsing/reset, core-only assessment gating, and new stable lesson IDs;
- strict Overview/Learn/Practice/Assess analytics without device or detailed clinical payloads;
- safety, citrate, access, robots, discovery, and route metadata boundaries.

Required commands:

```text
npm run type-check
npm run lint
npm test -- --runInBand
npm run build
git diff --check
```

## Current run

Completed 2026-07-19 with release stage `sme-review`.

- `npm run type-check`: passed.
- Focused CRRT/routes/analytics run: 38 suites and 288 tests passed.
- `npm run lint`: passed with zero errors. Existing repository warnings were outside the CRRT
  feature after its scoped lint completed cleanly.
- `npm test -- --runInBand`: 223 suites and 1,564 tests passed.
- `npm run build`: passed; generated Overview, Learn, Practice, and Assess routes. Existing build
  warnings were the Mermaid/Langium dynamic dependency and global `metadataBase` notices.
- Scoped Prettier, stale-reference scans, and `git diff --check`: passed.

## Access update

On 2026-07-22, the release moved to `unlisted-preview`. Overview, Learn, Practice, and Assess are
publicly accessible by direct link, remain excluded from discovery, and retain noindex metadata.

## Browser and SME acceptance

Before publication, perform a desktop, tablet, and 320-pixel walkthrough of all
four routes. Exercise keyboard-only navigation, both embedded labs, a full Practice/debrief loop,
all five drills, locked and unlocked Assess states, 200% zoom, reduced motion, and the
reviewed-English fallback.

Automated validation establishes implementation behavior only. It does not establish clinical
efficacy, institutional configuration fidelity, certification, or independent competency. Clinical
and editorial findings belong in `final-sme-checklist.md` before any later public-release request.
