/**
 * The laser-pathway disclosure rule (owner-review F-07, derived per Codex C-07).
 *
 * The workspace's laser safety note is a statement about the governed data, so it is derived
 * from the governed data rather than gated on a procedure code: it is required exactly when
 * the composed workspace carries at least one laser-related governed requirement and none of
 * those requirements has an authored SELECTABLE option in the pinned release. The
 * requirement-level selectable facts are computed from the raw authored option rows — before
 * any public-cohort identity withholding — because this is a statement about authoring, not
 * about what the public view may identify.
 *
 * "Laser-related" is the `LASER*` role-code prefix — the same scope the release-wide F-07
 * assertion in `mechanisms.test.ts` pins across all procedure slots (deliberately excluding
 * `PHOTODYNAMIC_LASER`, which that test also documents).
 */

export const LASER_ROLE_CODE_PREFIX = 'LASER'

export interface LaserPathwayRequirementInput {
  roleCode: string
  /** Whether ANY raw authored option row for this requirement's slot is selectable. */
  hasAuthoredSelectableOption: boolean
}

export function requiresLaserPathwayDisclosure(
  requirements: readonly LaserPathwayRequirementInput[],
): boolean {
  const laserRequirements = requirements.filter((requirement) =>
    requirement.roleCode.startsWith(LASER_ROLE_CODE_PREFIX),
  )
  return (
    laserRequirements.length > 0 &&
    laserRequirements.every((requirement) => !requirement.hasAuthoredSelectableOption)
  )
}
