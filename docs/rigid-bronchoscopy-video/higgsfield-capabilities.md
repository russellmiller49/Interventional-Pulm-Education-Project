# Higgsfield MCP Capability Audit (Phase 0.2)

**Status: BLOCKED — authentication required. No tools have been enumerated and no
media has been generated.**

## Connection status (as of this audit)

`claude mcp list` reports the Higgsfield MCP server as configured but **not
authenticated**:

```
claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ! Needs authentication
```

Because the server is not authenticated, its tools are **not exposed** to the
assistant. A tool search for Higgsfield returns nothing, so the tool names,
parameter schemas, supported durations/resolutions, and credit costs **cannot be
inspected yet**. Per the project instructions, we do **not** fabricate tool
names or generation results.

> This document must be completed by re-running the audit **after** the server is
> authenticated. Do not begin Phase 5 (prototype generation) until the capability
> table below is filled in from the live tool schemas.

## How to authenticate (physician / owner action)

The assistant cannot complete the OAuth flow. The owner must do one of:

1. In an interactive `claude` terminal, run `/mcp`, select **Higgsfield**, and
   complete the browser sign-in; **or**
2. Authenticate Higgsfield from the Claude **Connectors** UI
   (claude.ai / desktop app → Settings → Connectors → Higgsfield).

When `claude mcp list` shows `✔ Connected`, re-run the capability audit.

## Capabilities to document once connected

The audit must enumerate the exact MCP tool names and schemas and record the
following. Every cell is **UNKNOWN — pending authentication** today.

| Capability                                       | Tool name | Notes / params | Status                 |
| ------------------------------------------------ | --------- | -------------- | ---------------------- |
| List available models                            | —         | —              | UNKNOWN (pending auth) |
| Text-to-image generation                         | —         | —              | UNKNOWN (pending auth) |
| Image editing                                    | —         | —              | UNKNOWN (pending auth) |
| Multi-reference image generation                 | —         | —              | UNKNOWN (pending auth) |
| Image-to-video generation                        | —         | —              | UNKNOWN (pending auth) |
| Text-to-video generation                         | —         | —              | UNKNOWN (pending auth) |
| Camera / motion presets                          | —         | —              | UNKNOWN (pending auth) |
| Video analysis                                   | —         | —              | UNKNOWN (pending auth) |
| Generation-history retrieval                     | —         | —              | UNKNOWN (pending auth) |
| Job-status polling                               | —         | —              | UNKNOWN (pending auth) |
| Asset downloading                                | —         | —              | UNKNOWN (pending auth) |
| Video upscaling                                  | —         | —              | UNKNOWN (pending auth) |
| Image upscaling                                  | —         | —              | UNKNOWN (pending auth) |
| Character / location / reusable-element creation | —         | —              | UNKNOWN (pending auth) |

Also record, from the live schemas:

- Supported video durations
- Supported aspect ratios (target **16:9**)
- Supported resolutions (final **1080p**; drafts lowest practical preview res)
- Whether start **and** end frames are supported (needed for directional reliability)
- Whether multiple reference images are supported
- Whether negative prompts are supported (else append the global rejection
  constraints — see `prompts/global-style.md`)
- Whether audio can be disabled (it must be — no generated speech/dialogue)
- Which tool returns generation history
- Which tool polls asynchronous jobs
- How generated files are retrieved (download path/URL)
- Any credit-cost information exposed by the tools

## Confirmation

- ✅ No clinical media have been generated.
- ✅ No Higgsfield tool names have been invented.
- ✅ The blocker (authentication) has been reported to the owner.

## Baseline (recorded during Phase 0)

Recorded on branch `ebus_update` (working directly on this branch per owner
decision; no separate feature branch was created). The working tree already
contained unrelated in-progress changes when this baseline was taken.

- `npm run type-check` → **pass** (exit 0)
- `npm test` (jest) → **2 pre-existing failures**, 677 passed / 679 total. The
  failures are in
  `src/features/airway-stent-mechanics/__tests__/StentArchitectureLab.learningLab.test.tsx`
  (a reduced-motion Play-button assertion) and are **unrelated** to this module.
- `npm run lint` → **pass** (0 errors, 13 pre-existing warnings)
