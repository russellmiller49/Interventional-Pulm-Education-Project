import { z } from 'zod'

/**
 * The canonical publication-instant contract (P92-C2b).
 *
 * A frozen (published or retired) release's `publishedAt` is the fact that places it in the
 * publication order, and the publication order is what first-publisher attribution derives
 * from. Before this contract existed the order was a `localeCompare` over raw strings guarded
 * only by a null check, so a non-null malformed value — `"zzzz-not-a-date"` — was accepted,
 * sorted lexicographically after every real timestamp, and written into the generated bundle
 * file by a zero-exit release generation. Every reader of publication order now goes through
 * this one parser; nothing sorts, compares, or attributes over an unparsed string.
 *
 * The accepted grammar is deliberately exactly what the committed release universe uses: an
 * RFC 3339 / ISO 8601 UTC instant with a four-digit year, a calendar-valid date, a full
 * time-of-day including seconds, optional fractional seconds of one to three digits, and the
 * `Z` designator — `2026-07-31T00:00:00.000Z`. Publication timestamps have millisecond
 * resolution, and the grammar says so: a fourth fractional digit would be precision the
 * ordering cannot honor, so it is refused rather than accepted-and-discarded (P92-C2c).
 * Offset forms (`+02:00`), timezone-less forms, date-only forms, and lowercase designators
 * are refused even when they name a real instant: no published release has ever carried one,
 * and admitting a second spelling of the same instant buys nothing while multiplying the
 * formats every downstream reader must prove it handles.
 *
 * Validation is `z.string().datetime()` — the repository's existing strict datetime parser,
 * already calendar-aware (leap years, days-in-month, hour/minute/second ranges, anchored,
 * `Z`-only) — composed with one shape refinement requiring the seconds component that zod
 * leaves optional. The shape regex doubles as the field extraction for the numeric instant,
 * so acceptance and extraction cannot drift apart. Nothing here calls `Date.parse` or the
 * `Date` string constructor: permissive engine parsing is exactly what a strict contract
 * must not lean on, so the epoch value is derived arithmetically from the validated fields.
 */

/**
 * Shape and extraction in one expression: seconds required, `Z` required, fraction optional
 * at one to three digits — the millisecond resolution the derived instant actually carries.
 * Calendar validity (leap years, month lengths, field ranges) is the zod check's job — this
 * regex pins the components zod's grammar leaves looser (optional seconds, unbounded
 * fraction length) and captures the fields.
 */
const PUBLISHED_INSTANT_FIELDS =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/

export const PUBLISHED_RELEASE_INSTANT_CONTRACT =
  'a calendar-valid RFC 3339 / ISO 8601 UTC instant with a four-digit year, seconds, ' +
  'optional fractional seconds of one to three digits (millisecond resolution), and the ' +
  '"Z" designator — e.g. "2026-07-31T00:00:00.000Z"'

/**
 * The one schema deciding whether a string is a canonical publication instant. Exported for
 * boundaries that only need acceptance; ordering callers use `parsePublishedReleaseInstant`,
 * which is this schema plus the derived epoch value.
 */
export const publishedReleaseInstantStringSchema = z
  .string()
  .datetime()
  .regex(PUBLISHED_INSTANT_FIELDS, {
    message: `Must be ${PUBLISHED_RELEASE_INSTANT_CONTRACT}.`,
  })

export type PublishedReleaseInstantParse =
  | {
      ok: true
      /** The authored string, byte-for-byte — generated output must carry it unchanged. */
      raw: string
      /**
       * The instant as epoch milliseconds, for chronological comparison only. The grammar
       * admits at most three fractional digits, so this value carries the string's full
       * precision: only spellings of the same instant (`.1` vs `.10`) compare equal, and
       * those fall to the caller's deterministic tiebreak.
       */
      epochMilliseconds: number
    }
  | {
      ok: false
      raw: unknown
      /** Why the value cannot establish a publication order, for the typed failure message. */
      reason: string
    }

/**
 * Render a non-string value for a failure reason without being able to throw doing it:
 * `JSON.stringify` rejects BigInt and cycles and re-throws a poisoned `toJSON`, and a
 * diagnostic path must not convert a bad value into a crash.
 */
function describeNonString(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '[unrepresentable value]'
    }
  }
}

/**
 * Parse a release's `publishedAt` under the canonical contract, or say exactly why not.
 *
 * Total over `unknown` — seed JSON can carry anything — and never throws: callers that must
 * refuse (the attribution validator, the release generator's phase A) turn the failure into
 * their typed `definition_set_attribution_unorderable_release` message, and the one caller
 * that must not proceed at all (`comparePublicationOrder`) throws its own error naming the
 * release. The valid string is returned byte-for-byte; nothing downstream re-serializes it.
 */
export function parsePublishedReleaseInstant(value: unknown): PublishedReleaseInstantParse {
  if (value === null || value === undefined) {
    return {
      ok: false,
      raw: value,
      reason: `is ${value === null ? 'null' : 'missing'} — the release records no publication instant`,
    }
  }
  if (typeof value !== 'string') {
    return {
      ok: false,
      raw: value,
      reason: `is ${describeNonString(value)} (a ${typeof value}), not a string, so it is not ${PUBLISHED_RELEASE_INSTANT_CONTRACT}`,
    }
  }
  if (!publishedReleaseInstantStringSchema.safeParse(value).success) {
    return {
      ok: false,
      raw: value,
      reason: `is "${value}", which is not ${PUBLISHED_RELEASE_INSTANT_CONTRACT}`,
    }
  }

  const fields = PUBLISHED_INSTANT_FIELDS.exec(value)
  if (!fields) {
    // Unreachable: the schema above includes this exact regex. Kept as a throw rather than a
    // silent reject so a future edit that splits the two surfaces immediately.
    throw new Error(
      `Publication instant "${value}" passed the canonical schema but not the field extraction — the two have drifted apart.`,
    )
  }
  const [, year, month, day, hour, minute, second, fraction] = fields
  // One to three fractional digits, right-padded to milliseconds — "5" is 500ms, "12" is
  // 120ms. Nothing is discarded: the grammar refuses a fourth digit outright.
  const milliseconds = fraction ? Number(fraction.padEnd(3, '0')) : 0

  // Arithmetic, not parsing. Every field is already range-valid (calendar-checked by the
  // schema), so nothing can roll over. `Date.UTC` is avoided for the same reason the Date
  // string constructor is: it reinterprets years 0–99 as 1900–1999, which the setters do not.
  const instant = new Date(0)
  instant.setUTCFullYear(Number(year), Number(month) - 1, Number(day))
  instant.setUTCHours(Number(hour), Number(minute), Number(second), milliseconds)

  return { ok: true, raw: value, epochMilliseconds: instant.getTime() }
}
