import { MANIFEST_REVIEW_REGISTER } from '../data/generated/reviewRegister.generated'

/**
 * The transcript review register, enforced.
 *
 * The register (R01–R51) records what the course may say where a lecture statement could not be
 * generalized: corrections, local practice, missing media, scope boundaries. The adopted treatment
 * is authoritative; the original statement is not an instruction. This file turns the high-risk
 * dispositions into phrases the course's copy gate refuses on every learner-facing surface.
 *
 * Two scopes:
 * - `absolute`: refused everywhere, with no exemption (a naloxone ceiling, colony counts, PEG port
 *   reconfiguration, billing rules, an unseen video described as seen).
 * - `instruction`: refused everywhere except inside a choice rationale or an item explanation that
 *   refutes it — and there only when the item lists an exemption naming the register item. This is
 *   how a distractor such as "the breath ends when the set pressure is reached" can exist and be
 *   explained as the error it is.
 *
 * A pattern is a guard, not a proof of accuracy. The register items stay pending faculty review.
 */
export type RegisterScope = 'absolute' | 'instruction'

export interface RegisterPattern {
  readonly reviewItemId: string
  readonly pattern: RegExp
  readonly scope: RegisterScope
  /** What the course says instead. */
  readonly say: string
}

export const REGISTER_PATTERNS: readonly RegisterPattern[] = [
  {
    reviewItemId: 'R04',
    pattern: /\b(follow|head (for|toward)) the dark/i,
    scope: 'instruction',
    say: 'Advance only along a patent airway you can see.',
  },
  {
    reviewItemId: 'R04',
    pattern: /\bdark(ness)? (means|is) the lumen\b/i,
    scope: 'instruction',
    say: 'A dark field has its own differential.',
  },
  {
    reviewItemId: 'R06',
    pattern: /\b(90|ninety)[- ]second/i,
    scope: 'instruction',
    say: 'Completeness is a status per airway, not elapsed time.',
  },
  {
    reviewItemId: 'R08',
    pattern: /\bextubat\w*\b.{0,60}\b(inspect|examin|subglott|withdraw|view|complete)/i,
    scope: 'instruction',
    say: 'Bronchoscope withdrawal is not endotracheal-tube removal.',
  },
  {
    reviewItemId: 'R11',
    pattern: /\btwo (registered )?nurses\b/i,
    scope: 'instruction',
    say: 'A designated qualified monitor separate from the proceduralist; staffing is local policy.',
  },
  {
    reviewItemId: 'R14',
    pattern: /\bbicarbonate\b/i,
    scope: 'absolute',
    say: 'Recognize toxicity, stop exposure, get help, use the approved LAST checklist.',
  },
  {
    reviewItemId: 'R14',
    pattern: /\blipid emulsion\b.{0,40}\d/i,
    scope: 'absolute',
    say: 'No LAST drug doses are reproduced.',
  },
  {
    reviewItemId: 'R15',
    pattern: /\bdexmedetomidine\b.{0,60}\b(no|without) respiratory depression/i,
    scope: 'absolute',
    say: 'Agent choice involves different effects; detailed drug claims need approved references.',
  },
  {
    reviewItemId: 'R16',
    pattern: /\bketamine\b.{0,40}\b(contraindicat|intracranial)/i,
    scope: 'absolute',
    say: 'Patient-specific anesthetic selection belongs to a separately reviewed module.',
  },
  {
    reviewItemId: 'R17',
    pattern: /\b(CPT|RVU)\b/,
    scope: 'absolute',
    say: 'No billing rules in this course.',
  },
  {
    reviewItemId: 'R17',
    pattern: /\bbill(ing|able)\b/i,
    scope: 'absolute',
    say: 'Record actual clinical time and care; coding needs a separate current source.',
  },
  {
    reviewItemId: 'R18',
    pattern: /\b(50|70|75)\s*(%|percent)\b.{0,50}\b(symptom|treat|stent|dilat)/i,
    scope: 'instruction',
    say: 'A narrowing estimate is not a symptom or treatment rule.',
  },
  {
    reviewItemId: 'R19',
    pattern: /\b50\s*(%|percent)\s*(collapse|reduction)\b/i,
    scope: 'instruction',
    say: 'Describe dynamic narrowing with its conditions; a single percentage does not diagnose.',
  },
  {
    reviewItemId: 'R19',
    pattern: /\bmalacia\b.{0,40}\b50\b/i,
    scope: 'instruction',
    say: 'Describe dynamic narrowing with its conditions; a single percentage does not diagnose.',
  },
  {
    reviewItemId: 'R21',
    pattern: /\bno suction before (the )?BAL\b/i,
    scope: 'instruction',
    say: 'Avoid unnecessary proximal suction; necessary airway clearance comes first.',
  },
  {
    reviewItemId: 'R21',
    pattern: /\bnever suction (before|prior)/i,
    scope: 'instruction',
    say: 'Avoid unnecessary proximal suction; necessary airway clearance comes first.',
  },
  {
    reviewItemId: 'R22',
    pattern: /\b(at least|a minimum of|minimum|≥)\s*(100|30|40|50)\s*mL\b/i,
    scope: 'instruction',
    say: 'Use the indication-specific approved BAL protocol; no universal volume or return threshold.',
  },
  {
    reviewItemId: 'R22',
    pattern: /\b30\s*(–|-|to)\s*40\s*mL\b/i,
    scope: 'instruction',
    say: 'No universal return threshold.',
  },
  {
    reviewItemId: 'R22',
    pattern: /\b(100|150|200|300)\s*mL\b.{0,30}\b(required|needed|the standard|adequate)\b/i,
    scope: 'instruction',
    say: 'No universal volume makes a lavage adequate.',
  },
  {
    reviewItemId: 'R23',
    pattern: /(?<!non-)\bbacteriostatic\b/i,
    scope: 'absolute',
    say: 'Sterile non-bacteriostatic saline under the approved collection protocol.',
  },
  {
    reviewItemId: 'R25',
    pattern: /\brelabel\w*\b.{0,40}\b(aspirate|wash(ing)?)\b/i,
    scope: 'instruction',
    say: 'Do not reclassify a specimen to change a culture threshold.',
  },
  {
    reviewItemId: 'R25',
    pattern: /\b10\s*\^?\s*[3-6]\s*(CFU|cfu)\b|\bCFU\s*\/\s*mL\b/i,
    scope: 'absolute',
    say: 'No colony counts are supplied or invented.',
  },
  {
    reviewItemId: 'R26',
    pattern: /\bsusceptib\w*\s+(show|showed|were|was|reveal)/i,
    scope: 'absolute',
    say: 'The susceptibility table is missing; no antibiotic key exists.',
  },
  {
    reviewItemId: 'R29',
    pattern: /\bpressure[- ]cycl/i,
    scope: 'instruction',
    say: 'Conventional mandatory pressure control is pressure-targeted and time-cycled.',
  },
  {
    reviewItemId: 'R29',
    pattern: /\b(terminat|end)\w*\s+(when|once|as soon as)\s+(the\s+)?(set|target)\s+pressure\b/i,
    scope: 'instruction',
    say: 'Reaching the target pressure does not normally end the mandatory breath.',
  },
  {
    reviewItemId: 'R31',
    pattern: /\b2[- ]?mm\s+(rule|margin|clearance|difference)\b.{0,40}\b(safe|adequate|guarantee)/i,
    scope: 'instruction',
    say: 'A diameter difference is screening information, not a ventilation guarantee.',
  },
  {
    reviewItemId: 'R32',
    pattern: /\bantifibrotic\b/i,
    scope: 'absolute',
    say: 'Tranexamic acid is antifibrinolytic.',
  },
  {
    reviewItemId: 'R34',
    pattern: /\balways\s+(suction|withdraw)/i,
    scope: 'instruction',
    say: 'Blood burden, containment and ventilation decide the immediate action.',
  },
  {
    reviewItemId: 'R34',
    pattern: /\b(opposite|contralateral|good)\s+(side|lung)\s+first\b/i,
    scope: 'instruction',
    say: 'Do not abandon a useful wedge to complete a contralateral survey.',
  },
  {
    reviewItemId: 'R37',
    pattern: /\bblind(ly)?\s+(place|placement|inflat|advance|reinflat)/i,
    scope: 'instruction',
    say: 'No blind blocker placement or reinflation.',
  },
  {
    reviewItemId: 'R39',
    pattern: /\bsecond[- ]generation\b.{0,40}\bcuff/i,
    scope: 'absolute',
    say: 'Device familiarization from the actual instructions, not a classification rule.',
  },
  {
    reviewItemId: 'R40',
    pattern: /\bMACOCHA\b/,
    scope: 'absolute',
    say: 'The score was not supplied and is not reconstructed.',
  },
  {
    reviewItemId: 'R41',
    pattern: /\b1\.5\s*(times|×|x)\b/i,
    scope: 'absolute',
    say: 'No tube-to-stenosis multiplier.',
  },
  {
    reviewItemId: 'R41',
    pattern: /\btube[- ]to[- ]stenosis\b|\bmultiplier\b/i,
    scope: 'instruction',
    say: 'An individualized expert airway, anesthesia and rescue plan.',
  },
  {
    reviewItemId: 'R44',
    pattern: /\bnitric oxide\b/i,
    scope: 'absolute',
    say: 'Cryotherapy gas is device-specific.',
  },
  {
    reviewItemId: 'R47',
    pattern: /\b7\s*(–|-|to)\s*10\s*days\b/i,
    scope: 'instruction',
    say: 'Tracheostomy timing rules remain unconfigured.',
  },
  {
    reviewItemId: 'R48',
    pattern: /\bPEG\b.{0,60}\b(insufflat|oxygen port|suction port)/i,
    scope: 'absolute',
    say: 'PEG configuration is outside this course.',
  },
  {
    reviewItemId: 'R49',
    pattern: /\b(killian|ikeda)\b.{0,20}\b(18|19)\d\d\b/i,
    scope: 'instruction',
    say: 'History is context, not an assessed fact.',
  },
  {
    reviewItemId: 'R51',
    pattern: /\bas shown in the (video|clip|slide|lecture)\b/i,
    scope: 'absolute',
    say: 'Unavailable media are not described as seen.',
  },
  {
    reviewItemId: 'R51',
    pattern: /\bin the lecture (video|slide)s?\b/i,
    scope: 'absolute',
    say: 'Unavailable media are not described as seen.',
  },
  // §24.1: the manual's naloxone ceiling is not adopted, and no reversal dose appears at all.
  {
    reviewItemId: 'R14',
    pattern: /\bnaloxone\b.{0,40}\b(\d+(\.\d+)?\s*mg|ceiling|maximum)\b|\b0\.4\s*mg\b/i,
    scope: 'absolute',
    say: 'Use the approved rescue protocol; no reversal doses.',
  },
  // R13/R33: educational concentration arithmetic lives only in synthesis blocks that say so.
  {
    reviewItemId: 'R33',
    pattern:
      /\b\d+(\.\d+)?\s*(mg|mcg|µg|mL)\s+(of\s+)?(epinephrine|adrenaline|phenylephrine|tranexamic acid|TXA)\b/i,
    scope: 'absolute',
    say: 'No topical hemostatic doses.',
  },
]

export interface RegisterExemption {
  readonly reviewItemId: string
  readonly reason: string
}

export type RegisterSurface = 'instruction' | 'rationale'

/** Register findings for one string. Rationales may carry an exempted, refuted instruction phrase. */
export function registerFindings(
  where: string,
  text: string,
  surface: RegisterSurface = 'instruction',
  exemptions: readonly RegisterExemption[] = [],
): readonly string[] {
  const findings: string[] = []
  for (const entry of REGISTER_PATTERNS) {
    if (!entry.pattern.test(text)) continue
    const exempt =
      entry.scope === 'instruction' &&
      surface === 'rationale' &&
      exemptions.some((exemption) => exemption.reviewItemId === entry.reviewItemId)
    if (!exempt) {
      findings.push(
        `${where} carries a phrase the review register refuses (${entry.reviewItemId}, ${entry.scope}): ${entry.pattern.source}. Say instead: ${entry.say}`,
      )
    }
  }
  return findings
}

export const REVIEW_ITEM_IDS: ReadonlySet<string> = new Set(
  MANIFEST_REVIEW_REGISTER.map((item) => item.id),
)

export function reviewItem(id: string) {
  const item = MANIFEST_REVIEW_REGISTER.find((entry) => entry.id === id)
  if (!item) throw new Error(`Unknown review item ${id}`)
  return item
}
