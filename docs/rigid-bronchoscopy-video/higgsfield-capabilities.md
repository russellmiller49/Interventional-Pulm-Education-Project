# Higgsfield MCP Capability Audit (Phase 0.2)

**Status: CONNECTED.** The Higgsfield MCP server is authenticated and its tools
are enumerated below. Generation of the `mainstem-direction` prototype has begun
(draft only — nothing approved; see `production-plan.md` and the generation
history manifest).

## Connection / account

- Server: `higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected`
- Plan: **Plus**. Workspace: single private workspace (selected as the billing
  target). Balance at audit time: **1180 credits**.

## Tools (enumerated from the live server)

| Capability                                 | MCP tool                                                       | Notes                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| List / search / get / **recommend** models | `models_explore`                                               | `action` ∈ list/search/get/recommend; filter by `type` (image/video/audio/3d) and `input` (text/image) |
| Text-to-image / image-to-image             | `generate_image`                                               | top-level `model`, `params.{aspect_ratio,resolution,count≤4,medias[]}`; `get_cost:true` preflights     |
| Text/image-to-video                        | `generate_video`                                               | `params.{aspect_ratio,resolution,duration,count≤4,medias[],preset_id}`; `get_cost:true` preflights     |
| Audio generation                           | `generate_audio`                                               | (not used — narration is authored + recorded deterministically)                                        |
| Image→3D (GLB)                             | `generate_3d`                                                  | candidate for validated-3D internal shots later                                                        |
| Camera / motion presets                    | `presets_show`, `motion_control`                               | image-to-video presets; motion transfer / recast                                                       |
| Video analysis                             | `video_analysis_create` / `_status` / `_jobs`                  | optional QA of generated clips                                                                         |
| Generation history                         | `show_generations`                                             | past non-Marketing-Studio generations                                                                  |
| Async job polling                          | `job_status`                                                   | `sync:true` waits ~25s; else obey `poll_after_seconds`                                                 |
| Asset download                             | (from `job_status`)                                            | `results.rawUrl` (full) + `results.minUrl` (webp preview) → HTTP GET                                   |
| Upscaling                                  | `upscale_image`, `upscale_video`                               | enhance to 2K/4K (use for approved finals)                                                             |
| Reframe / outpaint / cutout                | `reframe`, `outpaint_image`, `remove_background`               | aspect change / expand / transparent                                                                   |
| Reusable identity / elements               | `show_characters` (Soul), `show_reference_elements`, `soul_id` | reusable operator/instrument identity if needed                                                        |
| Credits / billing                          | `balance`, `show_plans_and_credits`, `transactions`            |                                                                                                        |
| Workspaces                                 | `list_workspaces`, `select_workspace`                          | billing target                                                                                         |
| Rights reveal (`ip_detected`)              | `reveal_generation`                                            | seedance-family only                                                                                   |

## Formats & constraints (from live model schemas)

- **Aspect ratio 16:9**: supported by the chosen models. ✅
- **Resolutions**: images `1k / 2k / 4k` (`nano_banana_pro`); video `720p / 1080p`
  (`kling3_0_turbo`), up to `4k` (`seedance_2_0` std, `kling3_0` pro/4k).
- **Start + end frames**: supported by `seedance_2_0` and `kling3_0`
  (`medias` roles `start_image` + `end_image`) — use end frames for directional
  reliability on the L/R maneuver clips. `kling3_0_turbo` is `start_image` only.
- **Multiple reference images**: supported (`medias[]`; `image_references` role on
  `seedance_2_0` / `gemini_omni`).
- **Negative prompts**: `nano_banana_pro` has **no** negative-prompt field →
  per plan, the global rejection constraints are appended into the prompt text.
- **Disable audio**: `seedance_2_0` `generate_audio:false`; `kling3_0` `sound:'off'`;
  `kling3_0_turbo` is silent. Generation audio is disabled (narration added later).
- **`medias[].value`** must be a `media_id`/`job_id` (a prior generation id), never
  a raw URL. Prior generations are reused by passing their id.

## Selected models (prototype)

- **Hero stills:** `nano_banana_pro` (resolves internally to `nano_banana_2`) —
  best hands/instrument coherence and prompt adherence. 16:9, 2k. **~2 credits/image.**
- **Draft image→video:** `kling3_0_turbo`, 720p, 5s, `start_image` = hero frame.
  **~7.5 credits/clip.** (Seedance 2.0 fast 720p = ~17.5.) Approved finals will be
  re-rendered at 1080p and may use `seedance_2_0`/`kling3_0` with start+end frames.

## Credit costs observed (preflight via `get_cost`)

| Generation | Model             | Settings                     | Credits |
| ---------- | ----------------- | ---------------------------- | ------- |
| Image      | `nano_banana_pro` | 16:9, 2k                     | 2       |
| Video      | `kling3_0_turbo`  | 16:9, 720p, 5s               | 7.5     |
| Video      | `seedance_2_0`    | 16:9, 720p, 5s, fast, silent | 17.5    |

Draft prototype (stills + ~5 short clips) is well under 100 credits. Approved
1080p re-renders and upscales cost more and are done only after physician review.

## Standing rules honored

- No Higgsfield tool names invented (all verified against the live server).
- No generation is claimed unless its result was retrieved and inspected.
- All generated media is DRAFT; nothing is approved. Internal airway anatomy is
  not generated free-form (validated-3D only).

## Baseline (recorded during Phase 0)

Recorded on branch `ebus_update` (working directly on this branch per owner
decision; no separate feature branch).

- `npm run type-check` → **pass** (exit 0)
- `npm test` (jest) → all pass on a clean run. An initial background baseline run
  showed 2 flaky failures in
  `src/features/airway-stent-mechanics/__tests__/StentArchitectureLab.learningLab.test.tsx`
  that pass on isolated/clean re-run (flaky under parallel load; unrelated).
- `npm run lint` → **pass** (0 errors, 13 pre-existing warnings)

After this module was added: **130 suites / 712 tests pass** (31 new tests across
5 suites), type-check clean, lint clean on the new files.
