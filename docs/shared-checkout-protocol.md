# Shared-checkout commit protocol

Two agent sessions work in this single working directory at the same time:

- **Codex** — preference-cards, literature, openFDA enrichment. Branch: `codex/ip-openfda-enrichment-v0-1`
- **Claude Code** — critical-care module rebuild (ECMO, CRRT, MCS). Branch: `critical-care/module-rebuild`

Git has one checked-out branch per directory, so **whoever commits, commits onto whatever branch is currently checked out** — including the other session's files if they stage broadly. That has already happened once: commit `075bc07c "updates"` swept an in-progress snapshot of critical-care engine work into an openFDA commit. The tree survived; the history did not.

This protocol prevents a repeat. It costs two extra commands per commit.

## The rule

**Never stage broadly.** These four are banned in this checkout:

```
git add -A
git add .
git add -u
git commit -a   (and -am)
```

Every one of them stages the other session's in-flight work.

## Committing, step by step

```bash
# 1. Where am I? The other session may have left its branch checked out.
git branch --show-current

# 2. If it is not your branch, switch. Uncommitted work carries across safely
#    because the two file sets do not overlap.
git checkout codex/ip-openfda-enrichment-v0-1

# 3. Stage explicit paths only — never a bare directory you do not own.
git add src/features/preference-cards src/features/literature scripts/ip-preference-cards

# 4. Verify scope BEFORE committing. This is the step that catches mistakes.
git diff --cached --name-only

# 5. Commit only if step 4 listed nothing outside your paths.
git commit -m "..."
```

Leave your branch checked out when you finish. The other session runs step 1 and switches when it needs to.

## Path ownership

**Codex owns:**

```
src/features/preference-cards
src/features/literature
scripts/ip-preference-cards
scripts/literature
data/ip-preference-cards
docs/ip-preference-cards
config/literature
supabase/migrations
messages/{en,es,zh-CN}.json
src/app/[locale]/**/preference-cards
src/app/[locale]/**/literature
```

**Claude Code owns:**

```
src/features/critical-care
src/features/cardiohelp-ecmo
src/features/mechanical-circulatory-support
src/features/icu-hemodynamics
src/features/mechanical-ventilation
src/features/baxter-crrt
scripts/critical-care
docs/critical-care
```

**Shared — coordinate before touching:**

- `package.json` — both sessions add script entries. Add only your own lines; never revert or reformat the whole scripts block.
- `jest.config.cjs`, `.gitignore`, `.env.example`

If you need to change a file outside your list, say so in your response rather than committing it silently.

## If you staged something that is not yours

```bash
git restore --staged <path>
```

Do this before committing. If you have already committed someone else's file, do not rewrite shared history — say so plainly in your final report so it can be sorted out deliberately.

## Verification

Run the gates for your own area only. The other session's failures are not yours to fix:

- Codex: the preference-cards and literature suites
- Claude Code: `npm run audit:critical-care-guides`, `npm run dump:ecmo-signals`, the critical-care suites

`npm run type-check` and `npm test` cover the whole repo, so both sessions will see the other's in-flight breakage. **Do not fix a failure outside your own paths** — check whether it reproduces with your work stashed, and if it does, report it as pre-existing and move on.

```bash
git stash push -u -- <your paths>
npx jest <the failing suite>
git stash pop
```
