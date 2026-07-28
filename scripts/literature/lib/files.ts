import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

export async function listNbibFiles(directory: string): Promise<string[]> {
  const absoluteDirectory = resolve(directory)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(absoluteDirectory, entry.name)
      if (entry.isDirectory()) {
        return listNbibFiles(path)
      }
      return entry.isFile() && extname(entry.name).toLocaleLowerCase('en-US') === '.nbib'
        ? [path]
        : []
    }),
  )

  return files.flat().sort((left, right) => left.localeCompare(right))
}

export async function sha256File(filePath: string) {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)

  for await (const chunk of stream) {
    hash.update(chunk as Buffer)
  }

  return hash.digest('hex')
}

export function portablePath(filePath: string) {
  const fromCwd = relative(process.cwd(), resolve(filePath))
  return fromCwd.replaceAll('\\', '/')
}

export function resolveManifestPath(manifestPath: string) {
  return resolve(process.cwd(), manifestPath)
}
