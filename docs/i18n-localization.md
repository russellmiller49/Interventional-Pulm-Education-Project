# Localizing interactive modules (es, zh-CN)

This project ships English (`en`), Spanish (`es`), and Simplified Chinese (`zh-CN`)
via [next-intl]. The app shell (nav, home, footer, search) was already localized in
`messages/*.json`. This doc covers localizing the **interactive learning modules**
(the `src/features/*` Learn → Practice → Assess tools), whose content was English-only.

The **thoracentesis-planner** module is the reference implementation — copy its shape.

## The two mechanisms

Use the right tool for each kind of text:

| Kind of text                                                                                          | Where it lives                                                                             | How the component reads it                                      |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **UI chrome** — page metadata, headers, nav, buttons, labels, option text, short engine-derived prose | `messages/{en,es,zh-CN}.json` under one namespace per module (e.g. `thoracentesisPlanner`) | `useTranslations(ns)` (client) / `getTranslations(ns)` (server) |
| **Structured learning content** — `LearnBlock[]`, `QuizQuestion[]`, objectives                        | the module's `content/*.ts` as locale-keyed variants + a selector                          | `getThoracentesis…(locale)` selector, English fallback          |

Why two? Chrome strings are scattered and benefit from next-intl's central catalog

- the parity test. Structured content is large, typed, and consumed by tests/engines,
  so it stays in TS (keeps type-safety and doesn't break the data shape) and is selected
  with `pickLocaleContent` from `src/i18n/content.ts`.

### Engine-derived prose

Engines (`engine/*.ts`) must not embed translated prose. They return **stable codes**
and the UI maps codes → localized strings. Example: `classifyBleedingRisk` returns
`reasonCodes: BleedingReasonCode[]`; the component renders
`t(\`bleeding.reasons.${code}\`)`. The English `reasons` strings stay for tests/non-UI
use. The engine's other returns (`level`, `pressureCmH2O`, `symptomTriggers`,
`reExpansionEdemaRisk`, `entryPosition`, `archetype`) are already codes the UI
translates via `riskLevel._`, `symptom._`, `drainageTeaching._`, `vesselRisk._`.

## Recipe: localize the next module

1. **Add a namespace** `<moduleName>` to `messages/en.json` with every chrome string
   (page metadata + headers, nav items, all component labels/options/buttons, and any
   engine-derived prose keyed by the engine's codes). Then translate the same keys into
   `es.json` and `zh-CN.json`. **Keys must be identical across all three files** — the
   parity test (`src/i18n/translations.test.ts`) enforces it.
2. **Localize structured content** in `content/*.ts`: keep the English exports (tests,
   QA tables, and other importers depend on them), add `…Es` / `…ZhCn` variants with the
   **same ids / answerIndex** but translated text, and export `get…(locale)` selectors
   built on `pickLocaleContent`.
3. **Codes, not prose, from engines.** Add a `…Codes` array to any engine output that
   currently returns conditional English prose. Keep the English array for tests.
4. **Rewire pages** (server components): add `params: Promise<{ locale: string }>`,
   convert `export const metadata` → `generateMetadata` using
   `getTranslations({ locale, namespace })`, call `setRequestLocale(locale)` in the page
   body, and pass `get…(locale)` content to the shared `LearnSection` / `AssessSection`.
   Pass a localized `eyebrow` to `ModuleHeader` (reuse `navigation.items.<x>.title`).
5. **Rewire components** (`'use client'`): `const t = useTranslations('<moduleName>')`;
   replace hardcoded strings with `t(...)`, arrays with `t.raw(...) as string[]`, and
   build option lists from id arrays so labels come from `t`.
6. **Verify** (see below).

## Verifying (routes are auth-gated)

The `/pleural-procedures/*` routes redirect to `/login`, so a browser screenshot needs
a session. Verify without one:

- `npm run type-check` — confirms components consume keys/selectors correctly.
- `npx jest src/features/<module> src/i18n` — runs the module's logic + content-selector
  tests and the locale **parity test**.
- **Resolve every key through the real ICU formatter.** The jest setup mocks next-intl to
  English, so to prove es/zh actually resolve, run a short Node script using
  `use-intl`'s `createTranslator({ locale, messages, namespace })` over the exact keys the
  components call (including `{arg}` interpolations and `t.raw` arrays). This is how the
  thoracentesis module was verified — 129 keys × 3 locales, all resolving.

## Machine-translation review status

Translations marked below are **AI-generated and pending clinical review** — search the
codebase for `MACHINE-TRANSLATED, PENDING CLINICAL REVIEW`. The chrome strings live in
`messages/es.json` / `messages/zh-CN.json` under the module namespace; the learning
content lives in the module's `content/*.ts` `…Es` / `…ZhCn` exports.

| Module                                | es         | zh-CN      | Reviewed by clinician?             |
| ------------------------------------- | ---------- | ---------- | ---------------------------------- |
| App shell (nav, home, footer, search) | ✅         | ✅         | ✅ (pre-existing)                  |
| thoracentesis-planner                 | ✅ machine | ✅ machine | ⬜ pending                         |
| pleural-fluid-analysis                | ✅ machine | ✅ machine | ⬜ pending                         |
| pleural-infection                     | ✅ machine | ✅ machine | ⬜ pending                         |
| pneumothorax-pathway                  | ✅ machine | ✅ machine | ⬜ pending                         |
| malignant-effusion                    | ✅ machine | ✅ machine | ⬜ pending                         |
| pleural-ultrasound                    | ✅ machine | ✅ machine | ⬜ pending                         |
| rapid-onsite-cytology                 | ⬜         | ⬜         | — (workbench shape; bespoke)       |
| chest-drainage                        | ⬜         | ⬜         | — (large simulator; bespoke)       |
| pleural-ultrasound-simulator          | ⬜         | ⬜         | — (3D/canvas; little text)         |
| intro-pleural-course                  | ⬜         | ⬜         | — (no [locale] route yet)          |
| pleural-dataset-lab                   | ⬜         | ⬜         | — (no [locale] route yet)          |
| fluoroview                            | ⬜         | ⬜         | — (large interactive app; bespoke) |
| airway-anatomy                        | ⬜         | ⬜         | — (large interactive app; bespoke) |
| bronchoscope-size-explorer            | ⬜         | ⬜         | —                                  |

When a clinician signs off on a module's medical accuracy, remove its
`PENDING CLINICAL REVIEW` markers and tick the Reviewed column.

[next-intl]: https://next-intl.dev
