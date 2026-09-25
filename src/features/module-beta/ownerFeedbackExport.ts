import { feedbackReviewModuleById } from './catalog'
import type { OwnerFeedbackEntry, OwnerFeedbackFilter } from './ownerFeedbackStore'

// A code fence longer than any run in the text keeps Markdown-like comments verbatim.
function literal(value: string) {
  const fence = '`'.repeat(
    Math.max(3, ...Array.from(value.matchAll(/`+/g), (m) => m[0].length + 1)),
  )
  return `${fence}text\n${value}\n${fence}`
}

export async function exportOwnerFeedback(
  entries: OwnerFeedbackEntry[],
  filter: OwnerFeedbackFilter = {},
  now = new Date(),
) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const sorted = [...entries].sort(
    (a, b) =>
      a.module_id.localeCompare(b.module_id) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  )
  const records = []
  const markdown = [
    '# Owner review feedback',
    '',
    `Exported: ${now.toISOString()}`,
    'Storage: owner-local · local to this browser',
    '',
    `Scope: module=${filter.moduleId || 'all'}; status=${filter.status || 'all'}`,
    '',
  ]
  let moduleId = ''
  for (const entry of sorted) {
    // IDs are validated on read as UUIDs; also guard paths at the export boundary.
    if (!/^[0-9a-f-]{36}$/i.test(entry.id)) throw new Error('Invalid report ID in export.')
    const moduleTitle = feedbackReviewModuleById(entry.module_id)?.title ?? entry.module_id
    const filename = entry.screenshot ? `screenshots/${entry.id}.png` : null
    const { screenshot, ...fields } = entry
    records.push({
      ...fields,
      module: moduleTitle,
      screenshot_filename: filename,
      screenshot_metadata: screenshot
        ? {
            type: screenshot.type,
            size: screenshot.size,
            width: screenshot.width,
            height: screenshot.height,
          }
        : null,
    })
    if (screenshot && filename) zip.file(filename, await screenshot.blob.arrayBuffer())
    if (moduleId !== entry.module_id) {
      markdown.push(`## ${moduleTitle}`, '')
      moduleId = entry.module_id
    }
    markdown.push(
      `### Report ${entry.id}`,
      '',
      `Date: ${entry.created_at}`,
      `Updated: ${entry.updated_at}`,
      `Page: ${entry.page_path}`,
      `Status: ${entry.status}`,
      '',
      'Comment:',
      literal(entry.comment),
      '',
      'Selected/referenced text:',
      literal(entry.selected_text),
      '',
      'Reviewer notes:',
      literal(entry.reviewer_notes),
      '',
      filename ? `Screenshot: [${filename}](${filename})` : 'Screenshot: none',
      '',
    )
  }
  zip.file('feedback.md', markdown.join('\n'))
  zip.file(
    'feedback.json',
    JSON.stringify(
      {
        schemaVersion: 1,
        exportedAt: now.toISOString(),
        mode: 'owner-local',
        filters: filter,
        records,
      },
      null,
      2,
    ),
  )
  return {
    filename: `module-owner-feedback-${now.toISOString().slice(0, 10)}.zip`,
    blob: await zip.generateAsync({ type: 'blob' }),
  }
}
