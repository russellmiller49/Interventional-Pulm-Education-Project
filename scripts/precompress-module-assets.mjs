import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createBrotliCompress, createGzip, constants } from 'node:zlib'

const root = process.cwd()
const targets = [
  'public/bronch-navigation-trainer/app',
  'public/fluoroview',
  'public/models',
  'public/socal-ebus-course/app',
]
const compressibleExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.wasm'])
const minimumBytes = 8 * 1024

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return
    }
    throw error
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath)
    } else if (entry.isFile()) {
      yield fullPath
    }
  }
}

async function isFresh(source, destination) {
  try {
    const [sourceStat, destinationStat] = await Promise.all([stat(source), stat(destination)])
    return destinationStat.mtimeMs >= sourceStat.mtimeMs
  } catch {
    return false
  }
}

async function compressFile(source) {
  const sourceStat = await stat(source)
  if (sourceStat.size < minimumBytes) {
    return []
  }

  const outputs = []
  const brotliPath = `${source}.br`
  if (!(await isFresh(source, brotliPath))) {
    await pipeline(
      createReadStream(source),
      createBrotliCompress({
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
        },
      }),
      createWriteStream(brotliPath),
    )
    outputs.push(path.relative(root, brotliPath))
  }

  const gzipPath = `${source}.gz`
  if (!(await isFresh(source, gzipPath))) {
    await pipeline(createReadStream(source), createGzip({ level: 9 }), createWriteStream(gzipPath))
    outputs.push(path.relative(root, gzipPath))
  }

  return outputs
}

await mkdir(path.join(root, 'public'), { recursive: true })

const created = []
for (const target of targets) {
  for await (const filePath of walk(path.join(root, target))) {
    if (filePath.endsWith('.br') || filePath.endsWith('.gz')) {
      continue
    }

    if (!compressibleExtensions.has(path.extname(filePath).toLowerCase())) {
      continue
    }

    created.push(...(await compressFile(filePath)))
  }
}

if (created.length) {
  console.log(`Precompressed ${created.length} asset files:`)
  for (const output of created) {
    console.log(`- ${output}`)
  }
} else {
  console.log('No module assets needed precompression.')
}
