# CRRT-12 terminal End repair — local review handoff

After **Stop → End interface run**, CRRT-12 now stays ended when simulated time crosses its first-minute checkpoint. Pumps remain stopped and no additional treatment is delivered. **Reset case** opens a clean run; uninterrupted delivery and supported authored pause/resume paths retain their existing behavior.

## Baseline and isolation

- Fresh fetched main: `46c5bb94f779a1464da6198bba4bcf8550379419`; no drift since the combined acceptance. Repair branch: `codex/crrt12-end-contract-20260930` in `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-crrt12-end-contract-20260930`.
- Allowed app inspection found “CRRT 9_21” idle and “Review CRRT-12 repair PR” not loaded. Other CRRT repair/review checkouts were clean. A 2-day-old Next server in `claude-crrt-06` was identified and preserved; no competing CRRT implementation/test job was identified. Existing 3110 preview stayed untouched; 3113 was free before this pass's isolated preview.
- Read repository instructions and traced current `completeCases`, `runtimeCaseNormalization`, `simulation`, `learningSession` and the existing adapter contract. The prior acceptance report/evidence and ECMO patch/reports remain in their original worktrees. No prohibited session files or databases were read.
- The user authorized this repair and a local commit. Nothing was pushed, published, merged or deployed. The literature lane, private input mounts, review gates, sponsor/media permissions and settings remain untouched.

## Exact change and why it sits here

The only runtime edit is in `src/features/baxter-crrt/engine/simulation.ts`, inside `applyScheduledEventAction`:

```ts
if (action.type === 'SET_DELIVERY_STATE') {
  // End is terminal for scenario events. A checkpoint cannot reopen delivery;
  // explicit user transitions still go through the simulation reducer.
  if (state.device.deliveryState === 'ended') return state
  // Existing readiness check and transition follow unchanged.
}
```

The source trace is:

1. `content/completeCases.ts:930` adds a 60-second checkpoint with a running-state effect and a `SET_DELIVERY_STATE(running)` fixture mapping.
2. `content/runtimeCaseNormalization.ts:156` resolves that mapping into the actual engine event. Editing only the visible case effect would not repair the executable event.
3. `engine/simulation.ts` applies due events while advancing time. The new guard refuses scheduled delivery transitions out of an already ended state; the event is still consumed once and its existing bookkeeping remains intact.
4. `engine/learningSession.ts:1111` advances the engine and synchronizes resulting delivery state back to the interface. With the engine still ended, the interface remains ended.

The guard belongs to the scheduled-event dispatcher so it does not remove the authored checkpoint, disable an ordinary scheduled start/resume, or alter the explicit action reducer. The existing adapter still refuses `START_TREATMENT` in an ended interface; its existing supported new-run transition is a full Reset/reload. Nonterminal idle/paused/running behavior, readiness gates and direct explicit transitions were not changed.

No fixtures, event times, action IDs/prerequisites/effects, chemistry, pressures, fluid equations, rounding rules, source records/statuses, clinical/device owner decisions or learner-facing teaching copy changed. No new clinical or device assumption was introduced.

## Regression coverage

- New `engine/__tests__/terminalEnd.test.ts`: **12 tests**. Ends CRRT-12 at 0/30/60/300 seconds and advances across/after its checkpoint; checks engine/interface End, stopped pump, unchanged effluent/treatment time, consumed event and refused adapter Start. Tests scheduled running/paused/idle transitions cannot unlock End. Also verifies never-ended delivery, clean Reset, existing scheduled starts from idle/paused, and explicit CRRT-13 correction/resume with elapsed paused downtime.
- Added **3 browser tests** to `e2e/baxter-crrt-self-paced.spec.ts`: End before and after checkpoint, advance, stopped pumps and actual Qb **0 mL/min**, Reset to 0 minutes then active delivery; plus a never-ended checkpoint journey. Uses visible native controls and the Case-tab clock, without bypassing the console or protected beta gates.
- Existing #286 information-gap behavior, CRRT-04 real machine setup/interlocks, case/role identity and CRRT-13 actual-versus-worked debrief were independently rerun in the browser.

## Actual verification

| Check                                                                                                                             | Result                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New reducer regression on unchanged `46c5bb94` before runtime edit                                                                | **5 failed / 7 passed**. Before-checkpoint End and the three scheduled transitions reproduce the defect; existing permitted paths pass.                                                                                      |
| Focused final suites: terminal End, CRRT-12 evidence, matched-time causality, safety invariants, time equivalence, setup workflow | **6 suites / 71 tests passed**, 1.226 s                                                                                                                                                                                      |
| Full CRRT plus relevant shared compatibility                                                                                      | **86 suites / 1,033 tests passed**, 31.990 s; CRRT **83 / 994**, shared **3 / 39**                                                                                                                                           |
| Chromium dev browser, one worker, no retries                                                                                      | **8 passed / 0 failed / 0 skipped**, 32.788 s: three new CRRT-12 transitions, existing information-gap case, real setup/divergence/stale-review/rereview, case/role preservation, CRRT-04 bypass refusal and CRRT-13 debrief |
| Changed-path ESLint, Prettier, `git diff --check`                                                                                 | Passed; normal local commit also runs the repository's pre-commit checks                                                                                                                                                     |

The initial authoring probe incorrectly expected time after terminal End to count as downtime. That assertion was corrected to preserve the existing charting behavior before the recorded unchanged-base regression above; no runtime accounting change or model decision was made. The final tests compare actual delivered treatment before/after End and verify elapsed paused downtime separately.

Full-repository TypeScript, production build/server, protected beta preview, exhaustive viewport/theme/locale/assistive-technology matrix and clinical/device acceptance **were not rerun for this three-line engine change**. The prior sparse-checkout TypeScript failure remains qualified: 147 diagnostics, none in CRRT, with missing assets/workspaces and unrelated diagnostics; it is not a green full-checkout result. Prior acceptance evidence is preserved rather than restated as new coverage.

Raw results/logs and the two new End screenshots are local at `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/crrt12-end-contract-repair-2026-09-30/`. The old combined-acceptance evidence remains unchanged in its separate directory. These are synthetic local outputs, not patient data or copied private source inputs.

## Independent review checkpoint

Review this branch's local commit against `46c5bb94f779a1464da6198bba4bcf8550379419`. Four intended files: the scheduled-event guard, the new reducer suite, the browser regressions, and this handoff. The change is engineering state truth, not module release acceptance.

Ask whether the scheduled-event boundary preserves terminal End while retaining existing explicit and nonterminal transitions. Recheck the negative baseline fixture and the successful End/advance/Reset browser journey. No independent model review was launched in this implementation turn.

Numeric rounding remains an owner display-policy decision. The 34 clinical/device/model decisions and 10 G01 decisions remain unreviewed. Other missing combined-acceptance cases and full production verification remain in the existing report; this repair does not close them.

The repair worktree uses existing dependencies temporarily. Generated Husky launch wrappers were restored only in this checkout from the primary so the existing pre-commit checks run; no Git hook setting or security policy was changed. At handoff the dependency symlink is removed, this checkout is clean after its local commit, and no preview/test process from this pass remains. Other worktrees and the existing previews are preserved.
