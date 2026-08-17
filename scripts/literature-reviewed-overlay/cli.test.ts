/** @jest-environment node */

import { parseOverlayArguments } from './cli'

describe('parseOverlayArguments', () => {
  it('requires a known command and the artifact path', () => {
    expect(() => parseOverlayArguments([])).toThrow(/Usage/u)
    expect(() => parseOverlayArguments(['destroy'])).toThrow(/Usage/u)
    expect(() => parseOverlayArguments(['validate'])).toThrow(/--artifact/u)
    const parsed = parseOverlayArguments(['validate', '--artifact', '/tmp/a.csv'])
    expect(parsed.command).toBe('validate')
    expect(parsed.values.get('artifact')).toBe('/tmp/a.csv')
  })

  it('refuses credential-shaped arguments before anything else', () => {
    for (const argv of [
      ['apply', '--secret', 'sb_secret_x', '--artifact', '/a.csv'],
      ['apply', 'LITERATURE_SUPABASE_SECRET_KEY=sb_secret_x'],
      ['validate', '--url', 'https://x'],
    ]) {
      expect(() => parseOverlayArguments(argv)).toThrow(
        /only through the dedicated environment variables/u,
      )
    }
  })

  it('applies per-command option allowlists', () => {
    expect(() =>
      parseOverlayArguments(['validate', '--artifact', '/a.csv', '--record-batch-limit', '90']),
    ).toThrow(/does not accept/u)
    expect(() => parseOverlayArguments(['reconcile', '--artifact', '/a.csv'])).toThrow(
      /requires --checkpoint/u,
    )
    expect(() =>
      parseOverlayArguments(['dry-run', '--artifact', '/a.csv', '--confirm-production-write']),
    ).toThrow(/does not accept/u)
  })

  it('couples resume, checkpoint, and reconciliation correctly', () => {
    expect(() => parseOverlayArguments(['apply', '--artifact', '/a.csv', '--resume'])).toThrow(
      /requires --checkpoint/u,
    )
    expect(() =>
      parseOverlayArguments([
        'apply',
        '--artifact',
        '/a.csv',
        '--reconciliation',
        '/r.json',
        '--confirm-production-write',
      ]),
    ).toThrow(/only meaningful with --resume/u)
    const parsed = parseOverlayArguments([
      'apply',
      '--artifact',
      '/a.csv',
      '--resume',
      '--checkpoint',
      '/c.json',
      '--reconciliation',
      '/r.json',
      '--confirm-production-write',
    ])
    expect(parsed.flags.has('resume')).toBe(true)
    expect(parsed.flags.has('confirm-production-write')).toBe(true)
  })

  it('refuses repeated and valueless options', () => {
    expect(() =>
      parseOverlayArguments(['validate', '--artifact', '/a.csv', '--artifact', '/b.csv']),
    ).toThrow(/may not repeat/u)
    expect(() => parseOverlayArguments(['validate', '--artifact'])).toThrow(/requires a value/u)
    expect(() => parseOverlayArguments(['validate', '--artifact', '--resume'])).toThrow(
      /requires a value/u,
    )
  })
})
