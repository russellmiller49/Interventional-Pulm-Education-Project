# Mode: review — a finished language diff

Prefer a session separate from the implementer's. Say whether this is an independent-agent review
or a self-review; neither is physician approval. Read the diff, the baseline text, the rendered
surfaces where you can reach them, the module report, the relevant profile and the source passages
it cites. Don't rely on the implementer's claims, and don't rewrite accurate, natural copy to suit
your taste.

Check:

1. Did an observation become a diagnosis, a possibility a certainty, an association a cause, or a
   physiologic result an outcome benefit?
2. Were numbers, units, sample types, definitions, denominators, laterality, patient facts,
   timing, sequence or exceptions changed or dropped?
3. Were data bindings, the set, measured or estimated meaning of a label, routes, ids, progress,
   analytics, i18n keys, grading, choice order or reveal states affected?
4. Were local preferences, historical claims, transcript errors, advertisements or numeric
   heuristics promoted into general teaching?
5. Was legitimate vocabulary — sweep, state, trigger, cycle, compliance, pressure, flow — wrongly
   removed?
6. Does any pre-commit title, image, hint, tooltip, checklist or accessible label give the answer
   away? Were the deny patterns updated to the new keyed phrasing? Is the key conspicuous by length
   or register?
7. Were the copy gates respected — no loosened list, no override without a named term and reason,
   no string moved out of a scanned file?
8. Is the depth retained, the English natural, and every claimed surface actually reviewed? Is any
   transcript text, credential or case detail committed?
9. Do the reported tests match real commands and outputs, with pre-existing failures separated? Is
   any reworded item still marked `approved`?

Run the regression cases as reviewer checks. For each finding give the severity, exact file and
key or line, the before and after, why it matters, the source locator, and the minimal remedy —
clinical concerns kept apart from style preferences and from software regressions. Don't change the
branch unless asked; when asked, fix only safe editorial or compatibility issues, and never resolve
an E2 item by guessing.

Return the blocking findings, suggestions, good decisions worth keeping, the test evidence, and
accept or needs revision — with the physician-review items listed separately even when every
software check passes.
