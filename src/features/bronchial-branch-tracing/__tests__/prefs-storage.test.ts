import { DEFAULT_PREFS, PREFS_STORAGE_KEY, readPrefs, writePrefs } from '../engine/prefs-storage'

/** How the drive runs, kept on the device: one choice, off by default. */
class MemoryStorage implements Storage {
  private items = new Map<string, string>()
  failReads = false
  failWrites = false
  get length() {
    return this.items.size
  }
  clear() {
    this.items.clear()
  }
  getItem(key: string) {
    if (this.failReads) throw new Error('read refused')
    return this.items.get(key) ?? null
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('quota exceeded')
    this.items.set(key, value)
  }
}

describe('the drive preference', () => {
  test('nothing saved, or no storage at all, reads as the default: the central airways are flown through', () => {
    expect(DEFAULT_PREFS).toEqual({ everyFork: false })
    expect(readPrefs(new MemoryStorage())).toEqual({ everyFork: false })
    expect(readPrefs(null)).toEqual({ everyFork: false })
    expect(writePrefs({ everyFork: true }, null)).toBe(false)
  })

  test('a choice is written under the module’s own key and read back', () => {
    const storage = new MemoryStorage()
    expect(writePrefs({ everyFork: true }, storage)).toBe(true)
    expect(JSON.parse(storage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ version: 1, everyFork: true })
    expect(storage.length).toBe(1)
    expect(readPrefs(storage)).toEqual({ everyFork: true })
    expect(writePrefs({ everyFork: false }, storage)).toBe(true)
    expect(readPrefs(storage)).toEqual({ everyFork: false })
  })

  test('a value that does not parse reads as the default, and the next choice replaces it', () => {
    const storage = new MemoryStorage()
    for (const raw of [
      '{not json',
      '{"version":2,"everyFork":true}',
      '{"version":1,"everyFork":"yes"}',
      '{"version":1,"everyFork":true,"extra":1}',
    ]) {
      storage.setItem(PREFS_STORAGE_KEY, raw)
      expect([raw, readPrefs(storage)]).toEqual([raw, { everyFork: false }])
    }
    expect(writePrefs({ everyFork: true }, storage)).toBe(true)
    expect(readPrefs(storage)).toEqual({ everyFork: true })
  })

  test('storage that refuses is not an error: the default is used and the write reports it', () => {
    const storage = new MemoryStorage()
    storage.failReads = true
    expect(readPrefs(storage)).toEqual({ everyFork: false })
    storage.failWrites = true
    expect(writePrefs({ everyFork: true }, storage)).toBe(false)
  })
})
