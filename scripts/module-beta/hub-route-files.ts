import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

/*
 * Where a hub module's address lives under `src/app/[locale]`. A segment can sit inside a route
 * group — a parenthesised folder that adds a layout without adding to the address — so resolving
 * an address has to look through those as well as the named folder.
 */

const isRouteGroup = (name: string) => /^\(.+\)$/.test(name)
// Dynamic segments need a value, private folders and parallel slots are not addresses.
const isNotAStaticSegment = (name: string) => /^[[_@]/.test(name)

/** The folders an address passes through, root first, ending at the one that holds its page. */
export function resolveRouteDirectories(appRoot: string, address: string): string[] | null {
  const walk = (directory: string, segments: readonly string[]): string[] | null => {
    if (segments.length === 0 && existsSync(path.join(directory, 'page.tsx'))) return [directory]
    if (segments.length > 0 && existsSync(path.join(directory, segments[0]))) {
      const rest = walk(path.join(directory, segments[0]), segments.slice(1))
      if (rest) return [directory, ...rest]
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isRouteGroup(entry.name)) continue
      const rest = walk(path.join(directory, entry.name), segments)
      if (rest) return [directory, ...rest]
    }
    return null
  }
  return walk(appRoot, address.split('/').filter(Boolean))
}

/** The layout files that wrap a page, outermost first. */
export function layoutsAbove(directories: readonly string[]): string[] {
  return directories
    .map((directory) => path.join(directory, 'layout.tsx'))
    .filter((layout) => existsSync(layout))
}

/** Every address under a route folder that opens without a parameter, the folder's own included. */
export function staticPageAddresses(directory: string, address: string): string[] {
  const found = new Set<string>()
  const visit = (current: string, currentAddress: string) => {
    if (existsSync(path.join(current, 'page.tsx'))) found.add(currentAddress)
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory() || isNotAStaticSegment(entry.name)) continue
      visit(
        path.join(current, entry.name),
        isRouteGroup(entry.name) ? currentAddress : `${currentAddress}/${entry.name}`,
      )
    }
  }
  visit(directory, address)
  return [...found].sort()
}
