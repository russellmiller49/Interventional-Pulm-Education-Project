import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { sha256 } from '../literature-production-ingest/canonical'

/**
 * The committed Stage-A prompt. The markdown file is the reviewed artifact; only the text
 * between the BEGIN/END markers is sent to the model, so the surrounding documentation can
 * evolve without changing the prompt hash.
 */

export const LUNA_PROMPT_VERSION = 'literature-luna-stage-a-prompt/1.0.0'
export const LUNA_PROMPT_FILENAME = 'stage-a-triage-v1.md'

const BEGIN_MARKER = '<!-- PROMPT BEGIN -->'
const END_MARKER = '<!-- PROMPT END -->'

export function extractPromptText(markdown: string): string {
  const begin = markdown.indexOf(BEGIN_MARKER)
  const end = markdown.indexOf(END_MARKER)
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error('The prompt file is missing its BEGIN/END markers.')
  }
  return markdown.slice(begin + BEGIN_MARKER.length, end).trim()
}

/**
 * Load the committed prompt text and its hash. The lane runs from the repository root (the
 * same convention every literature package uses), so the committed file resolves from cwd.
 */
export function loadStageAPrompt(): { readonly text: string; readonly sha256: string } {
  const promptPath = resolve(
    process.cwd(),
    join('scripts', 'literature-luna-triage', 'prompts', LUNA_PROMPT_FILENAME),
  )
  if (!existsSync(promptPath)) {
    throw new Error(
      'The committed Stage-A prompt was not found; run this command from the repository root.',
    )
  }
  const markdown = readFileSync(promptPath, 'utf8')
  const text = extractPromptText(markdown)
  return { text, sha256: sha256(text) }
}
