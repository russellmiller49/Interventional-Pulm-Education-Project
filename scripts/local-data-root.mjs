/**
 * Resolves the Interventional-Pulm-Local-Data root: the out-of-Git folder that holds
 * raw authoring inputs, private references, renders, and prompts that the production
 * build never reads. See docs/local-authoring-assets.md for the folder map.
 *
 * Resolution order: `IP_LOCAL_DATA` environment variable, then the default path.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DEFAULT_LOCAL_DATA_ROOT =
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'

export function localDataRoot() {
  const fromEnv = process.env.IP_LOCAL_DATA?.trim()
  if (fromEnv) {
    return path.resolve(fromEnv.replace(/^~(?=$|\/)/, os.homedir()))
  }
  return DEFAULT_LOCAL_DATA_ROOT
}

export function localDataPath(...segments) {
  return path.join(localDataRoot(), ...segments)
}

/** Like localDataPath, but throws a readable error when the input is missing. */
export function requireLocalDataPath(...segments) {
  const resolved = localDataPath(...segments)
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Local-Data input not found: ${resolved}\n` +
        'Set IP_LOCAL_DATA if the folder lives elsewhere. Folder map: docs/local-authoring-assets.md',
    )
  }
  return resolved
}
