import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

const DEFAULT_LOCAL_ENV_PATH = '.env.local'

/**
 * Loads ignored local configuration only when the caller has not already supplied the key.
 *
 * `process.loadEnvFile` does not print values. Keeping this helper narrowly scoped also makes
 * it harder for a CLI error path to accidentally interpolate the secret.
 */
export function loadOpenFdaLocalEnvironment(envPath = DEFAULT_LOCAL_ENV_PATH): void {
  if (process.env.OPENFDA_API_KEY?.trim() || !existsSync(envPath)) return
  loadEnvFile(envPath)
}

export function hasOpenFdaApiKey(): boolean {
  return Boolean(process.env.OPENFDA_API_KEY?.trim())
}
