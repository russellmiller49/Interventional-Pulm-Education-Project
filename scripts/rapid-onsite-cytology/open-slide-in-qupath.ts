#!/usr/bin/env tsx

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { cytologySlides } from '../../src/features/rapid-onsite-cytology/content/slides'

const defaultQuPathBinary = '/Applications/QuPath-0.7.0-arm64.app/Contents/MacOS/QuPath-0.7.0-arm64'

interface Options {
  list: boolean
  printOnly: boolean
  slideQuery?: string
}

async function main() {
  const options = parseOptions(process.argv.slice(2))

  if (options.list || !options.slideQuery) {
    printSlideList()

    if (!options.slideQuery) {
      console.log('\nUsage: npm run rose:qupath -- <slide-id-or-short-title>')
      console.log('       npm run rose:qupath -- <slide-id-or-short-title> --print')
    }

    return
  }

  const qupathBinary = process.env.QUPATH_BIN?.trim() || defaultQuPathBinary

  if (!existsSync(qupathBinary)) {
    throw new Error(`QuPath binary not found: ${qupathBinary}`)
  }

  const slide = findSlide(options.slideQuery)

  if (!slide) {
    printSlideList()
    throw new Error(`No cytology slide matched "${options.slideQuery}".`)
  }

  const imagePath = await resolveImagePath(slide.id, slide.imageUrl)

  if (options.printOnly) {
    console.log(
      JSON.stringify(
        {
          qupathBinary,
          slideId: slide.id,
          title: slide.title,
          imagePath,
        },
        null,
        2,
      ),
    )
    return
  }

  const child = spawn(qupathBinary, ['--quiet', '--image', imagePath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  console.log(`Opened "${slide.title}" in QuPath.`)
  console.log(`Image path: ${imagePath}`)
}

function parseOptions(args: string[]): Options {
  return {
    list: args.includes('--list'),
    printOnly: args.includes('--print'),
    slideQuery: args.find((arg) => !arg.startsWith('--')),
  }
}

function printSlideList() {
  console.log('Rapid onsite cytology slides:')

  for (const slide of cytologySlides) {
    console.log(`- ${slide.id} (${slide.shortTitle})`)
  }
}

function findSlide(query: string) {
  const normalizedQuery = normalize(query)

  return (
    cytologySlides.find((slide) => slide.id === query) ??
    cytologySlides.find((slide) => normalize(slide.shortTitle).includes(normalizedQuery)) ??
    cytologySlides.find((slide) => normalize(slide.title).includes(normalizedQuery))
  )
}

async function resolveImagePath(slideId: string, imageUrl: string) {
  if (imageUrl.startsWith('/')) {
    return path.join(process.cwd(), 'public', imageUrl)
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    const cacheDir = path.join(process.cwd(), '.tmp', 'rapid-onsite-cytology', 'qupath-images')
    await mkdir(cacheDir, { recursive: true })

    const extension = path.extname(new URL(imageUrl).pathname) || '.jpg'
    const cachedPath = path.join(cacheDir, `${slideId}${extension}`)

    if (!existsSync(cachedPath)) {
      const response = await fetch(imageUrl)

      if (!response.ok) {
        throw new Error(`Unable to download ${imageUrl}: HTTP ${response.status}`)
      }

      await writeFile(cachedPath, Buffer.from(await response.arrayBuffer()))
    }

    return cachedPath
  }

  return path.resolve(process.cwd(), imageUrl)
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
