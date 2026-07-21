const SANDBOX_EDIT_KEY_PREFIX = 'socrates-sandbox-edit-key:'

function storageKey(recordId: string) {
  return `${SANDBOX_EDIT_KEY_PREFIX}${recordId}`
}

export function createSandboxEditKey() {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Secure browser storage is required to create a sandbox draft.')
  }

  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function readSandboxEditKey(recordId: string) {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(storageKey(recordId))
  } catch {
    return null
  }
}

export function rememberSandboxEditKey(recordId: string, editKey: string) {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(storageKey(recordId), editKey)
    return true
  } catch {
    return false
  }
}

export function forgetSandboxEditKey(recordId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(recordId))
  } catch {
    // Storage can be disabled in hardened/private browser contexts.
  }
}
