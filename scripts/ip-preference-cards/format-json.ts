import { format } from 'prettier'

export async function formatJson(value: unknown): Promise<string> {
  return format(JSON.stringify(value, null, 2), { parser: 'json' })
}
