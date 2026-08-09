import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  statSync,
  writeFileSync,
  type BigIntStats,
} from 'node:fs'
import { lstat, realpath } from 'node:fs/promises'
import { basename, dirname, normalize, relative, resolve, sep } from 'node:path'

interface DirectoryAncestorIdentity {
  device: bigint
  inode: bigint
  path: string
  realPath: string
}

/** Opaque identity for one newly-created directory beneath an explicit approved root. */
export interface ExclusiveOutputDirectoryIdentity {
  readonly outputDirectory: string
  readonly outputRoot: string
  readonly __exclusiveOutputIdentity: unique symbol
}

interface InternalExclusiveOutputDirectoryIdentity extends ExclusiveOutputDirectoryIdentity {
  ancestors: DirectoryAncestorIdentity[]
  device: bigint
  inode: bigint
  outputDirectoryRealPath: string
  outputRootRealPath: string
}

export interface ExclusiveOutputFile {
  bytes: Buffer
  name: string
}

function internalIdentity(
  identity: ExclusiveOutputDirectoryIdentity,
): InternalExclusiveOutputDirectoryIdentity {
  return identity as InternalExclusiveOutputDirectoryIdentity
}

function containsTraversal(path: string): boolean {
  return path.split(/[\\/]/u).some((component) => component === '..')
}

export function assertSafeOutputPathArgument(path: string, label: string): void {
  if (containsTraversal(path) || normalize(path) !== path) {
    throw new Error(`${label} must be normalized and contain no traversal.`)
  }
}

function isStrictlyWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child)
  return pathFromParent !== '' && pathFromParent !== '..' && !pathFromParent.startsWith(`..${sep}`)
}

async function captureDirectoryAncestors(
  outputRoot: string,
  targetParent: string,
  outputRootRealPath: string,
): Promise<DirectoryAncestorIdentity[]> {
  const pathFromRoot = relative(outputRoot, targetParent)
  if (
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${sep}`) ||
    resolve(outputRoot, pathFromRoot) !== targetParent
  ) {
    throw new Error('Output parent escapes its explicitly approved root.')
  }
  const components = pathFromRoot === '' ? [] : pathFromRoot.split(sep)
  const paths = [outputRoot]
  for (const component of components) paths.push(resolve(paths.at(-1) ?? outputRoot, component))

  return Promise.all(
    paths.map(async (path) => {
      const [stat, resolved] = await Promise.all([lstat(path, { bigint: true }), realpath(path)])
      if (
        stat.isSymbolicLink() ||
        !stat.isDirectory() ||
        (resolved !== outputRootRealPath && !isStrictlyWithin(outputRootRealPath, resolved))
      ) {
        throw new Error(`Output ancestor is not a confined real directory: ${path}`)
      }
      return { device: stat.dev, inode: stat.ino, path, realPath: resolved }
    }),
  )
}

function sameAncestors(
  before: readonly DirectoryAncestorIdentity[],
  after: readonly DirectoryAncestorIdentity[],
): boolean {
  return (
    before.length === after.length &&
    before.every(
      (entry, index) =>
        entry.path === after[index]?.path &&
        entry.realPath === after[index]?.realPath &&
        entry.device === after[index]?.device &&
        entry.inode === after[index]?.inode,
    )
  )
}

export async function createExclusiveOutputDirectory(input: {
  beforeAnchoredCreateForTest?: (parentDirectory: string) => Promise<void> | void
  outputDirectory: string
  outputRoot: string
}): Promise<ExclusiveOutputDirectoryIdentity> {
  assertSafeOutputPathArgument(input.outputRoot, 'Output root')
  assertSafeOutputPathArgument(input.outputDirectory, 'Output directory')
  const outputRoot = resolve(input.outputRoot)
  const outputDirectory = resolve(input.outputDirectory)
  if (!isStrictlyWithin(outputRoot, outputDirectory)) {
    throw new Error('Output directory must be a new child of the explicitly approved output root.')
  }

  const rootBefore = await lstat(outputRoot, { bigint: true })
  if (rootBefore.isSymbolicLink() || !rootBefore.isDirectory()) {
    throw new Error('Output root must be an existing non-symlink directory.')
  }
  const outputRootRealPath = await realpath(outputRoot)
  const parent = dirname(outputDirectory)
  const ancestorsBefore = await captureDirectoryAncestors(outputRoot, parent, outputRootRealPath)
  const capturedRoot = ancestorsBefore[0]
  if (
    !capturedRoot ||
    capturedRoot.device !== rootBefore.dev ||
    capturedRoot.inode !== rootBefore.ino
  ) {
    throw new Error('Output root identity changed during validation.')
  }

  await input.beforeAnchoredCreateForTest?.(parent)
  const parentIdentity = ancestorsBefore.at(-1)
  if (!parentIdentity) throw new Error('Output parent identity was not captured.')
  const outputName = basename(outputDirectory)
  const previousWorkingDirectory = process.cwd()
  let creationError: unknown
  let createdOutputStat: BigIntStats | undefined
  try {
    process.chdir(parent)
    const anchoredParentStat = statSync('.', { bigint: true })
    if (
      !anchoredParentStat.isDirectory() ||
      anchoredParentStat.dev !== parentIdentity.device ||
      anchoredParentStat.ino !== parentIdentity.inode ||
      realpathSync('.') !== parentIdentity.realPath ||
      (parentIdentity.realPath !== outputRootRealPath &&
        !isStrictlyWithin(outputRootRealPath, parentIdentity.realPath))
    ) {
      throw new Error('Output parent identity changed before anchored directory creation.')
    }
    mkdirSync(outputName, { mode: 0o700, recursive: false })
    const createdStat = lstatSync(outputName, { bigint: true })
    const createdRealPath = realpathSync(outputName)
    const expectedCreatedRealPath = resolve(parentIdentity.realPath, outputName)
    if (
      createdStat.isSymbolicLink() ||
      !createdStat.isDirectory() ||
      (createdStat.mode & 0o777n) !== 0o700n ||
      createdRealPath !== expectedCreatedRealPath ||
      !isStrictlyWithin(outputRootRealPath, createdRealPath)
    ) {
      throw new Error('Anchored output directory creation produced an unsafe identity.')
    }
    createdOutputStat = createdStat
  } catch (error) {
    creationError = error
  }
  let restorationError: unknown
  try {
    process.chdir(previousWorkingDirectory)
  } catch (error) {
    restorationError = error
  }
  if (creationError !== undefined && restorationError !== undefined) {
    throw new AggregateError(
      [creationError, restorationError],
      'Output directory creation failed and the process working directory could not be restored.',
    )
  }
  if (restorationError !== undefined) throw restorationError
  if (creationError !== undefined) throw creationError
  if (!createdOutputStat)
    throw new Error('Anchored output directory creation returned no identity.')

  const [ancestorsAfter, outputStat, outputDirectoryRealPath] = await Promise.all([
    captureDirectoryAncestors(outputRoot, parent, outputRootRealPath),
    lstat(outputDirectory, { bigint: true }),
    realpath(outputDirectory),
  ])
  if (
    !sameAncestors(ancestorsBefore, ancestorsAfter) ||
    outputStat.dev !== createdOutputStat.dev ||
    outputStat.ino !== createdOutputStat.ino ||
    outputStat.isSymbolicLink() ||
    !outputStat.isDirectory() ||
    (outputStat.mode & 0o777n) !== 0o700n ||
    !isStrictlyWithin(outputRootRealPath, outputDirectoryRealPath)
  ) {
    throw new Error('Output ancestry or directory identity changed during exclusive creation.')
  }

  return {
    ancestors: ancestorsAfter,
    device: outputStat.dev,
    inode: outputStat.ino,
    outputDirectory,
    outputDirectoryRealPath,
    outputRoot,
    outputRootRealPath,
  } as InternalExclusiveOutputDirectoryIdentity
}

function assertAnchoredOutputDirectoryIdentity(
  identity: InternalExclusiveOutputDirectoryIdentity,
): void {
  const stat = statSync('.', { bigint: true })
  const resolved = realpathSync('.')
  if (
    !stat.isDirectory() ||
    stat.dev !== identity.device ||
    stat.ino !== identity.inode ||
    (stat.mode & 0o777n) !== 0o700n ||
    resolved !== identity.outputDirectoryRealPath ||
    !isStrictlyWithin(identity.outputRootRealPath, resolved)
  ) {
    throw new Error('Output directory identity changed during anchored publication.')
  }
}

export async function assertExclusiveOutputDirectoryIdentity(
  opaqueIdentity: ExclusiveOutputDirectoryIdentity,
): Promise<void> {
  const identity = internalIdentity(opaqueIdentity)
  const [stat, resolved, ancestors] = await Promise.all([
    lstat(identity.outputDirectory, { bigint: true }),
    realpath(identity.outputDirectory),
    captureDirectoryAncestors(
      identity.outputRoot,
      dirname(identity.outputDirectory),
      identity.outputRootRealPath,
    ),
  ])
  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    stat.dev !== identity.device ||
    stat.ino !== identity.inode ||
    (stat.mode & 0o777n) !== 0o700n ||
    resolved !== identity.outputDirectoryRealPath ||
    !sameAncestors(identity.ancestors, ancestors) ||
    !isStrictlyWithin(identity.outputRootRealPath, resolved)
  ) {
    throw new Error('Output directory identity changed during publication.')
  }
}

function safeFilename(name: string): void {
  if (
    name.length === 0 ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    name === '.' ||
    name === '..'
  ) {
    throw new Error(`Output filename is not one safe path component: ${name}`)
  }
}

function closeDescriptor(fd: number, primaryError: unknown): void {
  try {
    closeSync(fd)
  } catch (closeError) {
    if (primaryError !== undefined) {
      throw new AggregateError(
        [primaryError, closeError],
        'Output publication and file-descriptor cleanup both failed.',
      )
    }
    throw closeError
  }
  if (primaryError !== undefined) throw primaryError
}

function writeAnchoredFile(file: ExclusiveOutputFile): void {
  safeFilename(file.name)
  const fd = openSync(
    file.name,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  )
  let primaryError: unknown
  try {
    writeFileSync(fd, file.bytes)
    fchmodSync(fd, 0o600)
    fsyncSync(fd)
    const handleStat = fstatSync(fd, { bigint: true })
    if (
      !handleStat.isFile() ||
      handleStat.isSymbolicLink() ||
      handleStat.nlink !== 1n ||
      (handleStat.mode & 0o777n) !== 0o600n
    ) {
      throw new Error(`Published output ${file.name} is not a private regular file.`)
    }
    const pathStat = lstatSync(file.name, { bigint: true })
    if (
      !pathStat.isFile() ||
      pathStat.isSymbolicLink() ||
      pathStat.nlink !== 1n ||
      (pathStat.mode & 0o777n) !== 0o600n ||
      pathStat.dev !== handleStat.dev ||
      pathStat.ino !== handleStat.ino
    ) {
      throw new Error(`Published output ${file.name} identity changed during publication.`)
    }
  } catch (error) {
    primaryError = error
  }
  closeDescriptor(fd, primaryError)
}

export function writeExclusiveOutputFiles(
  opaqueIdentity: ExclusiveOutputDirectoryIdentity,
  files: readonly ExclusiveOutputFile[],
): void {
  const identity = internalIdentity(opaqueIdentity)
  const names = files.map(({ name }) => name)
  if (new Set(names).size !== names.length) {
    throw new Error('Output publication contains duplicate filenames.')
  }
  for (const name of names) safeFilename(name)

  const previousWorkingDirectory = process.cwd()
  let publicationError: unknown
  try {
    process.chdir(identity.outputDirectory)
    assertAnchoredOutputDirectoryIdentity(identity)
    for (const file of files) {
      assertAnchoredOutputDirectoryIdentity(identity)
      writeAnchoredFile(file)
      assertAnchoredOutputDirectoryIdentity(identity)
    }
  } catch (error) {
    publicationError = error
  }

  let restorationError: unknown
  try {
    process.chdir(previousWorkingDirectory)
  } catch (error) {
    restorationError = error
  }
  if (publicationError !== undefined && restorationError !== undefined) {
    throw new AggregateError(
      [publicationError, restorationError],
      'Output publication failed and the process working directory could not be restored.',
    )
  }
  if (restorationError !== undefined) throw restorationError
  if (publicationError !== undefined) throw publicationError
}
