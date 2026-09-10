# Mode: rollout — an approved batch across modules

The batch the user names is the scope. One module named is one module, not permission for a
site-wide pass.

1. Read the pilot reports, the owner's rulings in the approved examples, and whatever PR
   discussion is available. Never assume an approval that isn't recorded. A request to proceed
   authorizes the safe edits; draft clinical claims stay E2.
2. Leave peripheral imaging alone unless it is selected. Reuse a terminology decision only where
   it is clinically right for the target domain.
3. One worktree, branch, report and PR per module, so each module merges on its own. Before each,
   confirm the current code, local instructions, live surfaces, profile coverage and baseline
   tests. For CRRT, non-ECMO MCS and thinly covered topics, build from the module's own references
   and record the gap.
4. Run [implement](implement.md) in full for each module. A glossary scan is not a completed
   module.
5. Anything a shared surface needs goes to one integrator branch, reviewed against every module it
   touches — never folded into a module PR. With several agents, give each non-overlapping file
   ownership.
6. State lives in the per-module reports; build the rollout summary from their `Status:` lines.
   Complete as many bounded modules as the session allows, and say exactly where you stopped.

Finish with the rollout summary, the status of each module, representative pairs, the clinically
important holds, validation results, the remaining work, and the exact prompt to continue.
