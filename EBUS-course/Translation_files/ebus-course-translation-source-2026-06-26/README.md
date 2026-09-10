# SoCal EBUS Prep translation handoff

Created: 2026-06-26
Source locale: English
Target locales: Spanish (`es`) and Mandarin Chinese, simplified (`zh-CN`)

This package contains the current English source files that hold learner-facing copy for the EBUS course web app. It is organized so translators can work from the `source/` folder while developers can preserve the original repo paths when adding locale support.

## What to translate

Prioritize these files first:

1. `content/course/*.json`
2. `content/modules/*.json`
3. `content/quizzes/*.json`
4. `content/stations/*.json`
5. `content/tnm-staging/*.json`
6. `apps/web/src/content/*.json`
7. `apps/web/src/content/courseSurveys.ts`
8. UI files listed in `files-to-translate.txt`

The JSON files are the main curriculum payload. The TypeScript and TSX files contain remaining UI shell copy such as route labels, button labels, progress text, quiz controls, accessibility labels, and fallback messages.

## Preserve exactly

Do not translate or change:

- JSON keys, object structure, IDs, slugs, route paths, enum values, storage keys, asset paths, image paths, or video paths.
- Station IDs and formal labels such as `2R`, `4L`, `11Rs`, `CT`, `EBUS`, `TNM`, `T`, `N`, and `M`, unless they appear inside explanatory prose where a conventional localized expansion is needed.
- Units and measurements such as `mm`, `cm`, `MHz`, percentages, dates, and numeric values.
- Sponsor names, product names, institution names, URLs, and citations unless there is a conventional translated institution name.
- Clinical meaning. This is educational content, not diagnostic guidance.

## Suggested delivery format

For each target language, return the same path structure with translated values in place:

- `es/source/...`
- `zh-CN/source/...`

Keep all files UTF-8 encoded. For JSON, keep valid JSON with no comments or trailing commas. For TypeScript and TSX, translators should preferably return annotated text changes or string tables rather than editing code logic directly.

## Developer notes

- `source/` mirrors the original repo paths.
- `files-to-translate.txt` is the source-of-truth list used to build this package.
- `manifest.json` records the target locales and broad categories.
- This package excludes media binaries and built `dist` output.
- If a file contains protected configuration or secrets, send only a sanitized string inventory to translators rather than the raw source file.
