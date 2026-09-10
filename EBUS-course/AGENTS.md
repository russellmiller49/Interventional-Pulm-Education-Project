# AGENTS.md

## Product
Build **SoCal EBUS Prep** as a web app.
Use the existing React + Vite + TypeScript web stack in `apps/web` unless the repo already has another approved web stack.

## Course-derived v1 scope
The first three modules are:
1. Ultrasound Foundations + EBUS Knobology
2. Mediastinal Station Map
3. CT ↔ Bronchoscopic ↔ Ultrasound Station Explorer

These modules should feel like a modern, touch-friendly learning app, not a slide viewer.

## Working style
For any medium or large task:
1. Read this file and relevant skills.
2. Create a short plan.
3. Inspect existing files before changing architecture.
4. Make the smallest clean set of changes that advances the product.
5. Run the relevant checks.
6. Summarize what changed, what was verified, and any follow-up risk.

## Architecture rules
- Single web app codebase.
- Prefer browser-native and Vite-compatible packages.
- Keep routing simple and explicit.
- Separate content from components.
- Prefer reusable feature folders over dumping logic into screens.
- Use TypeScript throughout.
- Keep dependencies lean.
- Ask for confirmation before adding a large or unusual dependency.

## Content rules
- This is an educational product, not a diagnostic device.
- Do not present simulated visuals as clinically validated.
- Do not hardcode protected health information.
- Do not bundle copyrighted slide screenshots into the production UI.
- Use placeholders and app-owned diagrams when needed.
- Keep all curriculum text in local content files for easy update later.

## UX rules
- Responsive, touch-friendly, clean, minimal, high-contrast UI.
- Fast startup.
- Offline-first for v1.
- Large tap targets.
- Accessibility labels on interactive controls.
- Avoid gestures that are impossible to discover.

## Data model rules
Create stable content contracts for:
- modules
- stations
- quiz questions
- learner progress
- bookmarks / quick review

Progress should persist locally.

## Module-specific expectations
### Knobology
Must teach:
- depth
- gain
- contrast
- color Doppler
- calipers
- freeze
- save

Include at least one interactive “fix the image” experience.

### Mediastinal station map
Must support:
- core station recognition
- IASLC-style station naming
- tap-to-learn details
- a quiz mode

Start with core stations in v1:
- 2R, 2L
- 4R, 4L
- 7
- 10R, 10L
- 11R, 11L

### Station explorer
Must correlate, for each included station:
- CT view
- bronchoscopic landmark view
- EBUS / ultrasound view

Use structured local content so later asset swaps do not require component rewrites.

## Quality bar
Before considering a task done:
- app compiles
- typecheck passes
- lint passes if configured
- new routes render without crashes
- key state persists after restart when relevant
- tests added or updated for non-trivial logic

## Done when
A task is done only when:
- the requested feature exists in the UI
- the code is organized and readable
- checks were run or the reason they were not run is clearly stated
- follow-up gaps are explicitly called out
