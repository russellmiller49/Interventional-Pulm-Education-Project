# Handoff — MT-00c foundation registers

| Field               | Value                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 2 of the first build round; work package MT-00                                                                                |
| Branch              | `claude/mt-00c-foundation-registers`                                                                                          |
| Base                | `origin/main` `519415e8bb60baabe16c979a976d7e054458e3d2`                                                                      |
| Prerequisite slices | `claude/mt-00a-foundation-manifest` at `3bc13220`, merged into this branch as its first commit                                |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-00c-foundation-registers.md` |
| Owner decision      | OD-07. The revised plan asks for claim, rights and device records before broad development                                    |
| Date                | 2026-09-28                                                                                                                    |

## Why

The build needs one place for each kind of fact before anything is modelled or taught: what the
manufacturer has published, what the literature is, what the course claims, what may be
distributed, and what has been measured. Each register enforces honesty, not correctness. It
cannot tell whether a dimension is right. It can tell that the dimension names the page it was
read on, and that nothing is marked reviewed without a named person.

## What changed

| Path                                                                                                     | Change                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/medical-thoracoscopy/content/data/device-definitions.json`                                 | New. 14 devices, 52 entries, 4 fit records, 5 documents. The file the model generator, the space engine and the device register all read |
| `src/features/medical-thoracoscopy/content/data/sources.json`                                            | New. Nine articles and the anatomy dataset, each checked against PubMed or its publisher's record                                        |
| `src/features/medical-thoracoscopy/content/data/claim-register.json`                                     | New. Three claims the prototype rests on                                                                                                 |
| `src/features/medical-thoracoscopy/content/{reviewRecords,deviceDefinitions,sources,claimRegister}.ts`   | New. The rules each register must keep, checked as it loads                                                                              |
| `docs/medical-thoracoscopy/registers/{device-register,claim-review-queue,source-register}.md`            | New. Printed from the three registers above. A test fails if a page and its register disagree                                            |
| `docs/medical-thoracoscopy/registers/{rights-register,asset-ledger,performance-table,traceability}.json` | New. Kept for reviewers; not read by the running course                                                                                  |
| `docs/medical-thoracoscopy/ATTRIBUTION.md`                                                               | New                                                                                                                                      |
| `docs/sponsorship/POLICY.md`                                                                             | New. A draft for the owner. Not in force                                                                                                 |
| `docs/local-authoring-assets.md`                                                                         | Rows added for the module's folders. No existing row changed                                                                             |
| `scripts/medical-thoracoscopy/render-registers.ts`                                                       | New. Prints the register pages, or checks them with `--check`                                                                            |
| `src/features/medical-thoracoscopy/test-support/{registerSchemas,renderRegisters}.ts`                    | New                                                                                                                                      |
| `src/features/medical-thoracoscopy/__tests__/registers.test.ts`                                          | New                                                                                                                                      |
| `docs/medical-thoracoscopy/README.md`                                                                    | Index extended                                                                                                                           |

No route, page or learner-facing text exists yet.

### One departure from the build plan

The plan placed the claim register under `docs/`. It is under
`src/features/medical-thoracoscopy/content/data/` instead, beside the device definitions and the
sources, because the running course reads all three: a lesson shows "Awaiting clinical review"
from a claim's own entry. The pages under `docs/…/registers/` are printed from them.

### Outside the repository

Two drafts were written to the owner's local data, under `medical_thoracoscopy/sponsor/`: the
sponsor request packet, and the manufacturer fact-check packet. They stay out of the repository
because it is public. Neither has been sent.

## Claims and assets touched

| Claim     | Assertion, in short                                                               | Decision     |
| --------- | --------------------------------------------------------------------------------- | ------------ |
| MT-C-0001 | With the port open and the fluid drained, air enters and the lung falls away      | NOT REVIEWED |
| MT-C-0002 | The collapsed lung sits at an authored distance from the port                     | NOT REVIEWED |
| MT-C-0003 | The prototype's port is in the right seventh intercostal space, mid-axillary line | NOT REVIEWED |

All three block publication. Assets: none.

## What was found while writing the registers

- **The FDA device database holds a record for every part in the US kit**, with dimensions. It
  agrees with the US sell sheet on every value where the international documents differ.
- **Three of the four manufacturer documents were already on the owner's disk.** Only the ERAGON
  brochure was fetched during review. The first-round plan said two and two.
- **The device database gives two jaw lengths no brochure does**: 12 mm for the double-spoon
  forceps insert and 14 mm for the dissection forceps insert.
- **How the telescope carries its image is stated two ways** by the manufacturer's own records.
  Nothing about the optics is taught until the manufacturer confirms it.
- **No guideline or textbook on thoracoscopy is held locally.** One lecture transcript is, and
  is institution practice from an automated transcript.

## Checks run

| Command                                                                | Result                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npx jest src/features/medical-thoracoscopy --runInBand`               | 2 suites, 65 tests, all passing                                                      |
| `npx tsx scripts/medical-thoracoscopy/render-registers.ts --check`     | All three pages match their registers                                                |
| Citations against PubMed                                               | Nine articles and the dataset paper found, with the volume, issue and pages recorded |
| Dataset record at its publisher                                        | Title, creators, date, version and licence read from the record                      |
| Device facts                                                           | Each read again from the document and page it cites while the file was written       |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`            | Clean                                                                                |
| `npm run lint`                                                         | 0 errors, 15 warnings. None is in a file this slice changed                          |
| Relative links in `docs/medical-thoracoscopy/` and `docs/sponsorship/` | All resolve                                                                          |
| `git diff --check`                                                     | Clean                                                                                |

## Real browser observations

Not applicable. Nothing in this slice is rendered.

## Checks not run

- **No source was read in full.** Abstracts were read where PubMed holds one. Three of the nine
  articles have no abstract in PubMed and were checked as citations only.
- **The scan was not compared with the dataset archive**, which is a single 5.0 GB download.
- **No manufacturer fact-check.** Every fact check reads NOT REVIEWED.
- **Full test suite, Storybook build, production build.** The next integration point follows
  slice 5.

## Unresolved decisions

- **S5**: whether the differing manufacturer values are listed in the repository as well as in
  the packet. They are not, by default.
- **S6**: permission to gather copies of the four manufacturer documents into local data.
- **S4**: who made the segmentation and on what terms. Until it is settled, no anatomy file is
  uploaded.
- The intended market, recorded as US and marked unresolved.

## What must not happen next

- Do not record a review decision. A reviewer records their own, and adds its id to the list in
  `registers.test.ts` themselves.
- Do not give a missing value a number at the point of use. `publishedNumber` throws for that
  reason. A measured or authored value is added to the definitions file, with its category.
- Do not list the manufacturer's differing values in the repository without the owner's decision.
- Do not edit the printed register pages. Edit the register and print them again.
- Do not upload any model or anatomy file. Three rights items block it.

This does not change publication status or constitute clinical approval.
