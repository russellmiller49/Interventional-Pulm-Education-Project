/**
 * Types for the Intro to Bronchoscopy — Airway Anatomy lesson.
 *
 * A single hierarchical map of the tracheobronchial tree drives every view in
 * the module: the labeled dendrogram, the animated endoscopic survey, the
 * clickable 3D model (FluoroView labeled segments GLB), and the quiz. Keeping
 * one source of truth means selecting a segment anywhere highlights it
 * everywhere.
 */

/** Lobe / territory an airway belongs to. Drives color coding across views. */
export type Lobe = 'central' | 'RUL' | 'RML' | 'RLL' | 'LUL' | 'lingula' | 'LLL'

/** Coarse structural role, used for diagram styling and survey grouping. */
export type AirwayKind = 'central' | 'lobar' | 'division' | 'segmental'

/**
 * One opening ("ostium") visible in the endoluminal view of a bifurcation,
 * placed on a clock face (12 = top of the scope image).
 */
export interface EndoscopicOpening {
  /** id of the child AirwayNode this opening leads into. */
  childId: string
  /** Clock position 1–12 (12 at top of the image). Schematic teaching value. */
  clock: number
  /** Relative opening size, 0.4–1 (bigger = more in-line / larger caliber). */
  size?: number
  /** Optional short caption drawn next to the opening. */
  label?: string
}

/** A non-lumen wall feature to annotate in the endoluminal view. */
export interface EndoscopicWallFeature {
  clock: number
  label: string
}

/**
 * How a bifurcation looks through the scope — powers the generated SVG
 * "endoscopic view" and the animated survey narration.
 */
export interface EndoscopicView {
  /** One-line orientation cue (which way is anterior / where the spur sits). */
  orientation: string
  /** Child openings arranged on the clock face. */
  openings: EndoscopicOpening[]
  /** Optional wall landmarks (membranous wall, spur, etc.). */
  wallFeatures?: EndoscopicWallFeature[]
}

export interface AirwayNode {
  /** Stable key shared by diagram, survey, 3D model, and quiz. */
  id: string
  /** Segmental code where applicable, e.g. 'RB1', 'LB7+8'. */
  code?: string
  /** Descriptive name, e.g. 'Apical segment'. */
  name: string
  /** Full teaching name, e.g. 'RUL apical segment (RB1)'. */
  fullName: string
  /** Compact label for the diagram node (code, or a short word). */
  shortLabel: string
  lobe: Lobe
  kind: AirwayKind
  parentId: string | null
  /** Airway generation (trachea = 0, main bronchi = 1, ...). */
  generation: number
  /**
   * Token used to match this node to a mesh in the FluoroView labeled GLB.
   * For segments this is the code (matched case-insensitively inside the mesh
   * name's parentheses); for central airways it is a keyword.
   */
  glbMatch?: string
  /** One-sentence summary shown in the diagram tooltip and detail header. */
  summary: string
  /** Bronchoscopic appearance — what the trainee actually sees. */
  whatYouSee: string[]
  /** Clinical / procedural pearls. */
  pearls: string[]
  /** Endoluminal appearance config for bifurcations (optional). */
  endoscopicView?: EndoscopicView
}

/** A single stop on the guided airway survey (ordered walk-through). */
export interface SurveyStep {
  /** AirwayNode id this step centers on. */
  nodeId: string
  /** Survey stage label, e.g. 'Central airways'. */
  stage: string
  /** Teaching title for the step. */
  title: string
  /** Narration paragraphs read aloud / shown for this stop. */
  narration: string[]
}
