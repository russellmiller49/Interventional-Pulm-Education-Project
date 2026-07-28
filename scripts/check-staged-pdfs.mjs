import { execFileSync } from 'node:child_process'

const allowedPdfPaths = new Set(['public/downloads/rigid-bronch-checklist.pdf'])

function stagedPdfPaths() {
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', '*.pdf'],
    { encoding: 'utf8' },
  )

  return output.split('\0').filter(Boolean)
}

const disallowed = stagedPdfPaths().filter((path) => !allowedPdfPaths.has(path))

if (disallowed.length > 0) {
  console.error('Commit blocked: staged PDF files are outside the explicit public allowlist:')
  for (const path of disallowed) console.error(`  - ${path}`)
  console.error('Keep private authoring sources outside Git or update the reviewed allowlist.')
  process.exit(1)
}
