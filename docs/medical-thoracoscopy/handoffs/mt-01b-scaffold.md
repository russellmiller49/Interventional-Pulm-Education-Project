# Handoff — MT-01b scaffold

| Field               | Value                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Slice               | 4 of the first build round; work package MT-01                                                                    |
| Branch              | `claude/mt-01b-scaffold`                                                                                          |
| Base                | `origin/main` `756c9aee7d7119f3817b5d85aaf73f9efa573418`                                                          |
| Prerequisite slices | `claude/mt-02a-device-kit` at `a23ac6c3` (which carries slices A, B, 1 and 2), merged as the first commit         |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-01b-scaffold.md` |
| Owner decision      | OD-05 (a new top-level module), OD-08; the approved first-round plan, section 4.2                                 |
| Date                | 2026-09-28                                                                                                        |

`origin/main` moved from `519415e8` to `756c9aee` while slice 3 was being built (CRRT and EBUS
changes only). This slice is the first to branch from the newer base.

## Why

The course needs its own address, its release stage and a frame before anything can be taught
in it: where it lives, who can open it, what every page says about safety, and where the
sponsorship disclosure will go. This slice builds that shell and nothing inside it.

## What changed

| Path                                                                                  | Change                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/sponsorship/{registry,policy}.ts`                                            | New. The sponsored modules and the one rule pages ask about: a disclosure is shown only once the owner has approved its wording, by name and date                                |
| `src/lib/sponsorship/sponsorship.test.ts`                                             | New                                                                                                                                                                              |
| `src/features/medical-thoracoscopy/content/{release,routes}.ts`                       | New. `unlisted-preview`; the five addresses, Cases at `/assess`                                                                                                                  |
| `src/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame.tsx`     | New. The shared frame with the module's tabs, safety notice, release badge and the sponsorship slot. The course is marked `lang="en"`; other locales are told it is English only |
| `src/features/medical-thoracoscopy/components/InPreparation.tsx`                      | New. What a page shows until its part is written                                                                                                                                 |
| `src/features/medical-thoracoscopy/components/medical-thoracoscopy-module.module.css` | New                                                                                                                                                                              |
| `src/app/[locale]/medical-thoracoscopy/{page,learn,practice,assess,reference}`        | New. Five pages, all `noindex, nofollow, noarchive`, with `routes.test.tsx`                                                                                                      |
| `src/features/medical-thoracoscopy/__tests__/{moduleFrame,releaseBoundary}.test.*`    | New                                                                                                                                                                              |
| `src/lib/site-auth/access.ts`                                                         | `/medical-thoracoscopy` and its subroutes: reachable by direct link, noindex; its own module id                                                                                  |
| `src/lib/draft-modules.ts`                                                            | Kept out of navigation while the stage is `unlisted-preview`                                                                                                                     |
| `src/lib/non-public-modules.ts`                                                       | Listed on the admin index, beside the earlier Pleuroscopy module                                                                                                                 |
| `src/features/learning-module/components/__tests__/ModuleFrameV2.consumers.test.tsx`  | The new frame added to the list of the shared frame's users, as that test asks of every new user. Test only                                                                      |
| `.claude/launch.json`                                                                 | `claude-thoracoscopy`, this worktree's dev server on port 3134                                                                                                                   |

Not changed, on purpose: the shared frame and the shared lesson stage; `moduleRoutes.ts`; the
sitemap, search, site navigation, home card, the development-beta catalogue and its framing
rules in `next.config.mjs`; the earlier module at `/pleural-procedures/pleuroscopy`, which keeps
its route, its access and its admin listing. Those change in the publish and retirement slices.

### The sponsorship disclosure

Owner default S1: the slot and the registry are built, and nothing renders until the owner
approves the wording. The registry records the sponsor and that editorial control is the
owner's; it records no legal entity, no dates and no wording (S2). `approvedDisclosure` returns
nothing, so the frame passes nothing and no disclosure appears. A wording can only be recorded
with the approver's name and the date, must name the sponsor and say who keeps editorial
control, and an approver must be a person. The admin index does not mention the sponsor.

The policy module also carries the word list the course's copy check will use to refuse praise
and claims of superiority (slice 5).

## Claims and assets touched

None.

## Checks run

| Command                                                                                                                                                                                                                                       | Result                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npx jest src/lib/sponsorship src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy" src/lib/site-auth src/lib/non-public-modules src/lib/draft-modules src/features/learning-module src/features/module-beta --runInBand` | 37 suites, 440 tests, all passing                                                    |
| The shared frame's consumer test, before the new frame was listed                                                                                                                                                                             | Failed, as designed: one unlisted user                                               |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                                                                                                                                                                   | Clean                                                                                |
| `npm run lint`                                                                                                                                                                                                                                | 0 errors, 15 warnings: the same 15 as at the base, none in a file this slice changed |
| `git diff --check`                                                                                                                                                                                                                            | Clean                                                                                |

## Real browser observations

Opened in the Browser pane on this worktree's dev server (`claude-thoracoscopy`, port 3134),
with no `.env.local` and not signed in:

| Route                                | Status | Robots                       | Active tab | English-only note | Disclosure |
| ------------------------------------ | -----: | ---------------------------- | ---------- | ----------------- | ---------- |
| `/en/medical-thoracoscopy`           |    200 | noindex, nofollow, noarchive | Overview   | No                | None       |
| `/en/medical-thoracoscopy/learn`     |    200 | noindex, nofollow, noarchive | Learn      | No                | None       |
| `/en/medical-thoracoscopy/practice`  |    200 | noindex, nofollow, noarchive | Practice   | No                | None       |
| `/en/medical-thoracoscopy/assess`    |    200 | noindex, nofollow, noarchive | Cases      | No                | None       |
| `/en/medical-thoracoscopy/reference` |    200 | noindex, nofollow, noarchive | Reference  | No                | None       |
| `/es/medical-thoracoscopy`           |    200 | noindex, nofollow, noarchive | Overview   | Yes               | None       |
| `/zh-CN/medical-thoracoscopy/learn`  |    200 | noindex, nofollow, noarchive | Learn      | Yes               | None       |

On every page `<html lang>` follows the site locale and the course's `<main>` is `lang="en"`. At
375 × 812 the page reflows with no horizontal scroll. The console showed two kinds of error, both
from outside the module: `GET /en` (the site's home page, which needs sign-in) and
`POST /api/analytics` returned 500 because this worktree has no Supabase keys.

## Checks not run

- **Signed-out access in production.** The dev server ran without Supabase keys; direct-link
  access is pinned by the access tests, not observed against the live proxy.
- **Full test suite, Storybook build, production build.** The next integration point follows
  slice 5.
- **A screen reader**, and dark/light theme switching: the module frame uses the dark theme only.

## Unresolved decisions

- S1 and S2: the disclosure's wording and the sponsor's legal entity.
- T1: the chapter assignment, which the Learn page's one-line description of the five chapters
  already follows.
- Whether the course joins the development-beta catalogue for testers, which would also add it to
  the framing rules in `next.config.mjs`.

## What must not happen next

- Do not record a disclosure without the owner's approval, name and date.
- Do not pass `sponsorNotice` from any other module.
- Do not change the release stage, the sitemap or navigation without the owner's decision.
- Do not touch `/pleural-procedures/pleuroscopy` before the retirement slice.

This does not change publication status or constitute clinical approval.
