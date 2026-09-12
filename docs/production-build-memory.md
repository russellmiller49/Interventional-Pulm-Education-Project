# Production TypeScript build memory

Railway deployment `01278010` on 2026-09-12 finished webpack compilation and then aborted in the TypeScript worker. The log reports repeated collection at approximately 4 GB followed by `JavaScript heap out of memory` and `SIGABRT`. It used Node 22.19.0 and Next.js 16.2.2.

The shared `tsconfig.json` includes the whole repository. That made the production worker load maintenance scripts, test suites and their fixture data alongside the application. The source contains several large generated catalogs, so this combination leaves very little heap headroom.

## Change

`next.config.mjs` now selects `tsconfig.build.json` in production, using Next's [supported custom configuration path](https://nextjs.org/docs/app/api-reference/config/typescript#custom-tsconfig-path). The build config inherits all compiler checks and aliases from the existing config. It includes application sources, global declarations, build configuration files, Contentlayer output and generated route types. Tests and test-support files are excluded from its initial file set.

TypeScript still follows runtime imports. Four helpers under `scripts/ip-preference-cards/` remain in the build program because application code imports them. This change does not hide those dependencies or relax their checks. `ignoreBuildErrors` remains false and `strict` remains true.

The original `tsconfig.json`, editor behavior and `npm run type-check` still cover the full repository. No heap increase, application change, asset change or Railway variable edit is included.

## Validation

Both standalone compiler runs used Node 22.19.0, TypeScript 5.9.3, an explicit 4096 MiB old-space limit, no incremental cache and the same checkout/generated declarations:

```sh
node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit --incremental false --extendedDiagnostics
node --max-old-space-size=4096 node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit --incremental false --extendedDiagnostics
```

| Standalone compiler measurement |          Full repository |        Production config |
| ------------------------------- | -----------------------: | -----------------------: |
| Files including dependencies    |                    6,850 |                    5,505 |
| TypeScript-reported memory      | 4,161,177 KiB (3.97 GiB) | 3,255,631 KiB (3.10 GiB) |
| Total time                      |                  45.68 s |                  29.75 s |
| Type errors                     |                        0 |                        0 |

The production file set removes 1,345 files and approximately 6 MB of fixture/authoring JSON. Compiler memory fell by 21.8% in this comparison. These are single-run macOS measurements, not whole-build or Linux container peak-memory measurements. The full standalone compiler just fits locally; the supplied Railway log establishes the failure in the larger Next worker.

A temporary invalid application file produced TS2322 under the build config. A temporary test file was omitted from that build file set and remained included by the full config. Both probes were removed. Next's resolved production configuration was checked directly: it selects `tsconfig.build.json` with `ignoreBuildErrors: false`.

Formatting and config lint pass. With `.next/cache` removed, `npm run build` completed on Node 22.19.0 with `NODE_OPTIONS=--max-old-space-size=4096`. This includes both embedded training apps, content generation, asset validators, webpack, TypeScript (33.0 s), route generation and standalone packaging. The build explicitly reported `Using tsconfig file: tsconfig.build.json`.

`npm run start:prod` launched the packaged server with the same runtime and heap cap. The health endpoint, foundations overview, Five controls lesson and bench GLB returned HTTP 200. The real-bench Playwright test passed, exercising movement, locked controls, reset and observation.

The remote Railway deployment has not been retried by this change. A successful local build under the matching Node version and heap cap does not itself establish deployment success.
