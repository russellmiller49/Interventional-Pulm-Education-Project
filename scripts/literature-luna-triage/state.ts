import { appendFile, lstat, mkdir, open, readFile, realpath } from 'node:fs/promises'
import { chmod } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

import { LUNA_DEFAULT_STATE_DIRECTORY } from './constants'

/**
 * Operation-owned filesystem discipline for the Luna triage lane.
 *
 * Every real artifact — packets, mappings, API results, predictions, physician reviews,
 * routing manifests — lives under a gitignored state root in mode-0700 directories as
 * mode-0600 files, written create-once (`wx`, which is O_CREAT|O_EXCL and never follows a
 * symlink) or as append-only journals that were themselves created exclusively. Symlinked
 * parents are refused because they redirect everything created inside them.
 */

export class StatePathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StatePathError'
  }
}

export interface StateRoot {
  /** Canonicalized absolute path of the state root. */
  readonly root: string
}

/**
 * Resolve and create the state root. A relative `--state-dir` resolves against the current
 * working directory, which the CLI requires to be the repository root; the default lands in
 * the blanket-gitignored `local-data/` tree.
 */
export async function resolveStateRoot(stateDir?: string): Promise<StateRoot> {
  const requested = stateDir ?? LUNA_DEFAULT_STATE_DIRECTORY
  const absolute = isAbsolute(requested) ? requested : resolve(process.cwd(), requested)
  await mkdir(absolute, { recursive: true, mode: 0o700 })
  // `mkdir`'s mode is umask-masked; the explicit chmod is what reliably yields 0700.
  await chmod(absolute, 0o700)
  const directoryStat = await lstat(absolute)
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new StatePathError('The state root must be a real directory, not a symbolic link.')
  }
  const canonical = await realpath(absolute)
  return { root: canonical }
}

/** Resolve a path inside the state root, refusing traversal outside it. */
export function resolveInsideRoot(state: StateRoot, ...segments: readonly string[]): string {
  const destination = resolve(state.root, ...segments)
  const inside = relative(state.root, destination)
  if (inside.startsWith('..') || inside.split(sep)[0] === '' || isAbsolute(inside)) {
    throw new StatePathError('A state path resolved outside the state root and was refused.')
  }
  return destination
}

/**
 * Create (or verify) a directory chain inside the root, asserting every component is a real
 * directory: `mkdir -p` happily accepts a symlinked parent, so each level is lstat-checked and
 * chmod-hardened after creation.
 */
export async function ensureStateDirectory(
  state: StateRoot,
  ...segments: readonly string[]
): Promise<string> {
  let current = state.root
  for (const segment of segments) {
    current = resolveInsideRoot(state, relative(state.root, resolve(current, segment)))
    await mkdir(current, { recursive: true, mode: 0o700 })
    await chmod(current, 0o700)
    const stat = await lstat(current)
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new StatePathError(
        'A state directory component is a symbolic link or not a directory; refusing to use it.',
      )
    }
    const canonical = await realpath(current)
    if (canonical !== current) {
      throw new StatePathError(
        'A state directory does not canonicalize to itself, so files written there would not ' +
          'be where they appear to be.',
      )
    }
  }
  return current
}

/**
 * Exclusive create-once write. `wx` never truncates and never follows an existing symlink; a
 * second write to the same path fails loudly instead of replacing an artifact an owner may
 * already have reviewed.
 */
export async function exclusiveWriteFile(path: string, contents: string): Promise<void> {
  const parentStat = await lstat(dirname(path))
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new StatePathError('Refusing to write below a symbolic-link parent directory.')
  }
  let handle
  try {
    handle = await open(path, 'wx', 0o600)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      throw new StatePathError(
        `An artifact already exists at ${path} and is not overwritten. Move or delete it ` +
          'deliberately, then run the command again.',
      )
    }
    throw error
  }
  try {
    await handle.writeFile(contents, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await chmod(path, 0o600)
}

/** Create an empty append-only journal exclusively; a later `appendJournalLine` extends it. */
export async function createJournal(path: string): Promise<void> {
  await exclusiveWriteFile(path, '')
}

/** Append one line to a journal previously created with `createJournal`. */
export async function appendJournalLine(path: string, line: string): Promise<void> {
  const stat = await lstat(path)
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new StatePathError('Refusing to append to a journal that is not a regular file.')
  }
  await appendFile(path, `${line}\n`, { encoding: 'utf8', mode: 0o600 })
}

export interface ExclusiveJournalWriter {
  readonly writeLine: (line: string) => Promise<void>
  readonly close: () => Promise<void>
}

/**
 * Open a journal exclusively and stream lines into it. For corpus-scale artifacts where
 * accumulating one string is not an option. The file is created `wx` mode 0600.
 */
export async function openExclusiveJournalWriter(path: string): Promise<ExclusiveJournalWriter> {
  const parentStat = await lstat(dirname(path))
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new StatePathError('Refusing to write below a symbolic-link parent directory.')
  }
  let handle
  try {
    handle = await open(path, 'wx', 0o600)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      throw new StatePathError(
        `An artifact already exists at ${path} and is not overwritten. Move or delete it ` +
          'deliberately, then run the command again.',
      )
    }
    throw error
  }
  await chmod(path, 0o600)
  const openHandle = handle
  return {
    writeLine: async (line: string) => {
      await openHandle.write(`${line}\n`, null, 'utf8')
    },
    close: async () => {
      await openHandle.sync()
      await openHandle.close()
    },
  }
}

/** Read a regular file, refusing symlinks. */
export async function readRegularFile(path: string): Promise<string> {
  const stat = await lstat(path)
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new StatePathError(`Refusing to read ${path}: not a regular file.`)
  }
  return readFile(path, 'utf8')
}

/** Read a JSONL journal into parsed lines, refusing symlinks. */
export async function readJournalLines(path: string): Promise<unknown[]> {
  const raw = await readRegularFile(path)
  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown)
}
