# Peripheral Imaging usability session — issue and retest form (blank)

**Status: BLANK. No issue has been observed or retested.** Open an entry only from a real session recorded on the [observation form](PI-02-observation-form.md). Do not seed it with issues predicted from code review or automated tests; those belong in engineering notes, not here.

One entry per module issue. An issue is about the module — its navigation, controls, explanations, images, questions or technical behavior — not about a learner's performance. PI-03 addresses **at most three** of these, chosen by the owner.

## Issue entry

Copy this block for each issue.

### Issue `PI02-I-___`

**Where and on what build**

- Stop, section or case, and URL:
- Commit SHA or deployment label:
- Device, browser, viewport and input (copied from the observation form):
- Session code(s) where it was seen (pseudonymous; optional):
- Date first seen:

**What happened** — keep the three apart

| Kind            | Note |
| --------------- | ---- |
| Observed fact   |      |
| Interpretation  |      |
| Proposed change |      |

**Classification**

- Area (choose one): navigation · control or simulator interaction · explanation wording · image or visual · question value or friction · help, reveal or skip · progress or resume · technical or media · accessibility or layout · clinical or source content
- Seen in how many of the sessions so far (plain count of sessions, not of learners' attempts):
- Priority **of the module issue**:
  - **High** — blocks finding or using the teaching, or leaves a safety-relevant idea misunderstood after the explanation was open
  - **Medium** — slows or confuses, but the learner recovered with the module's own help
  - **Low** — wording or polish
- Clinical, source, image-rights or radiation-physics review needed before changing it (yes / no / unsure). If yes, the proposed change stays **pending attributable review**; note the reviewer role, not a name, until they agree to be named:
- Owner decision (PI-03 candidate / later / no change) and date:

**Repair**

- Change made (files or PR link):
- Evidence location for the repair (tests, screenshots):

**Retest**

- Retest date:
- Build used (commit SHA or deployment label):
- Device, browser, viewport and input:
- Session code (optional; may be a different learner):
- What was observed on retest (observed fact only):
- Status: resolved in this observation · partly resolved · not resolved · not retested
- Remaining limitation:

---

Do not record success rates, percent of learners who "passed" a stop, first-attempt results or help counts. A retest observes whether the module now explains or behaves as intended for one person on one build; it is not a validation study.
