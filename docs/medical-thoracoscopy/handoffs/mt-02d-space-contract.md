# Handoff — MT-02d space contract

| Field               | Value                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Slice               | 9 of the first build round; work package MT-02                                                                                 |
| Branch              | `claude/mt-02d-space-contract`                                                                                                 |
| Base                | `origin/main` `4f9329f3ed8fe985283ab1cf81d59040f13e995e` (main moved on since slice 8; slices 4 to 8 were based on `756c9aee`) |
| Prerequisite slices | `claude/mt-02c-lung-states` at `12a9a642` (which carries slices A, B and 1 to 8), merged as the first commit (`b729af26`)      |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-02d-space-contract.md`        |
| Owner decision      | OD-08; the approved first-round plan, sections 4.6 and 5 (row 9)                                                               |
| Date                | 2026-09-28                                                                                                                     |

## Why

The lessons need a pane that shows the pleural space, and the engine that moves the telescope and
the scene that draws it in 3D are still to come. This slice writes the seam between them first: the
state a pane is given, the commands it sends back, a pane that works without WebGL, the control
dock, the model's estimate for each survey region, the keys, and a stand-in for the engine, so that
the engine and the scene are built to a contract the tests already hold.

## What changed

| Path                                                                       | Change                                                                                                                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/medical-thoracoscopy/components/space/types.ts`              | New. The contract: the snapshot a state names, the telescope's pose, the ledger and its rules, the cut through the space, readiness, a refusal with its part, the state, the commands, the props |
| `src/features/medical-thoracoscopy/components/space/spaceWords.ts`         | New. Every word the pane shows, checked by the learner-copy gate as it loads, none with a digit                                                                                                  |
| `src/features/medical-thoracoscopy/components/space/spaceKeyMap.ts`        | New. The key map as data                                                                                                                                                                         |
| `src/features/medical-thoracoscopy/components/space/useHeldCommand.ts`     | New. A held control repeats, and lets go on pointer release, window blur, a hidden tab, or when the controls stop being usable; under reduced motion a press is one step                         |
| `src/features/medical-thoracoscopy/components/space/ControlDock.tsx`       | New. The dock                                                                                                                                                                                    |
| `src/features/medical-thoracoscopy/components/space/ZoneLedger.tsx`        | New. The model's estimate                                                                                                                                                                        |
| `src/features/medical-thoracoscopy/components/space/KeyMapHelp.tsx`        | New. The key help, read from the key map                                                                                                                                                         |
| `src/features/medical-thoracoscopy/components/space/SpaceCrossSection.tsx` | New. The Chest view without 3D, drawn in SVG                                                                                                                                                     |
| `src/features/medical-thoracoscopy/components/space/SpaceFallbackPane.tsx` | New. The pane without WebGL                                                                                                                                                                      |
| `src/features/medical-thoracoscopy/components/space/space-pane.module.css` | New                                                                                                                                                                                              |
| `src/features/medical-thoracoscopy/test-support/spaceTestDouble.tsx`       | New. The engine's stand-in, and the pane as plain DOM                                                                                                                                            |
| `src/features/medical-thoracoscopy/__tests__/spacePane.test.tsx`           | New. 22 tests                                                                                                                                                                                    |
| `docs/medical-thoracoscopy/README.md`                                      | A "Space pane" section                                                                                                                                                                           |

No page mounts the pane yet: the lesson host arrives in slice 12. No route, content, register,
engine or scene changed.

## How the contract is built

- **The pane works nothing out.** The lesson host hands it the engine's state, plain JSON; what is
  in view, what has been seen, what stopped the telescope and the cut through the space all come from
  the engine. So the same commands give the same ledger whichever pane draws them, and the tests
  check that a pane shows the ledger it is given, word for word.
- **Every state names its snapshot**: anatomy, device, optics, port, scenario, lung and fluid, and
  geometry (fidelity contract). The host compares snapshots before it passes a result on.
- **The ledger** holds every survey region once, in the survey order, as seen, partly seen or not
  seen; a region not seen whole carries one reason: not looked at yet, hidden by something in the
  way, or out of reach from this port. These are the survey section's own words. A region partly
  seen has been looked at. No number and no total: the pane refuses a ledger that breaks these rules
  rather than show it.
- **Commands** are one step of one part of the second control (pivot, depth, roll), a Step for a
  model waiting under reduced motion, and trying again after the anatomy could not be had. Course
  navigation and loading a teaching example are not commands. The engine decides how far a step goes
  and may refuse it, naming the part that stopped it.
- **Only the second control has commands.** The other three are shown with where they are used from
  ("Shown here, used from “…”"), as section 7 shows them. A section that makes one of them usable
  needs the contract extended first; the dock refuses to render otherwise, and a test checks that no
  written section asks for one.
- **The pivot's buttons name the hand**: "Hand toward the head", and so on, with the note that the
  tip swings the other way, which section 7 teaches. The keys: the arrows move the hand (right and
  left toward the head and feet, as in the Chest view; up and down toward the front and back), W and
  S take the telescope in and out, Q and E turn it, N steps a waiting model on, ? shows the keys.
  They act only while the pane itself has focus, never while a button or field in it does, and the
  arrows stay with the page when the anatomy is not ready.
- **While the anatomy loads or cannot be had**, the controls stay where they are and say why they
  wait; reading goes on. The buttons are marked unavailable rather than disabled, so the one with
  focus keeps it. Trying again never marks a region seen.
- **The Chest view without WebGL** is a cut through the space along the telescope: the wall run by
  run in its zone's ledger state (line style as well as colour), the lung, the telescope and its
  field. The engine will compute the cut from the same geometry and lung step as everything else; no
  anatomy is drawn from committed geometry.

## Claims and assets touched

None. No claim was added or reworded, and no asset was built.

## Checks run

| Command                                                                                                                                                    | Result                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/medical-thoracoscopy --runInBand`                                                                                                   | 15 suites, 241 tests, all passing (22 new, among them jest-axe on the pane ready, loading and unavailable) |
| The same suite with three behaviours broken on purpose: no release on blur; repeats under reduced motion; keys taken from a focused button                 | Each caught by one failing test; the files then restored byte for byte                                     |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; `npx eslint src/features/medical-thoracoscopy`; `npx prettier --check`; `git diff --check` | Clean                                                                                                      |

## Real browser observations

Not opened: no page mounts the pane yet. The lesson host in slice 12 mounts it, and its journeys
run in a real browser there.

## Checks not run

- **Holding a button with a real pointer and a finger**: jsdom has no pointer events, so the tests
  give it a small stand-in. Slice 12, in a real browser, with touch.
- **Layouts at 1440×900, 1024×768 and 390×844, 200 % zoom and 320 px reflow**: slice 12, once the
  pane sits in a lesson.
- **The full suite, Storybook and the production build**: the next integration point is slice 14.

## Unresolved decisions

- **The pivot's words and the keys** are defaults: naming the hand's movement follows section 7;
  naming the view's movement instead is the alternative. Yours to settle, with T8.
- Everything open after slice 8 stays open: MT-C-0001 and MT-C-0002, the lung proxy's departures
  from the plan, T6, the rib numbering, S3 and S4.

## What must not happen next

- Do not change the contract except by adding to it.
- Do not let a pane work out what is in view or seen: that is the engine's, and the ledger must be
  the same whichever pane draws it.
- Do not give the ledger a number or a total, or call a survey complete from it.
- Do not mount the pane in a section that makes usable a control the contract has no commands for.

This does not change publication status or constitute clinical approval.
