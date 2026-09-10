/**
 * Universal Scope Tracker — shared input core.
 *
 * Canonical copy: src/lib/scope-input/core/ in Interventional-Pulm-Education-Project.
 * Both embedded apps import this source directly; no generated copies are needed.
 *
 * Contract: docs/scope-tracker-web-contract.md
 * Hardware plan: bronch_sim/Gen 2/universal_scope_tracker_plan_v4.md
 */

export * from './types'
export * from './constants'
export * from './decode'
export * from './frame-scheduler'
export * from './detect'
export * from './roll-unwrap'
export * from './profile'
export * from './gamepad-source'
export * from './virtual-source'
export * from './deltas'
export * from './serial'
