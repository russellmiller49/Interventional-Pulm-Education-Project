import {
  assertKnownArguments,
  numberArgument,
  parseCliArguments,
  stringArgument,
} from '../../../../scripts/literature/lib/cli'

describe('literature command-line parsing', () => {
  it('parses explicit values and positive integers', () => {
    const parsed = parseCliArguments([
      '--target=local',
      '--limit',
      '100',
      '--manifest',
      'fixture.json',
    ])

    expect(stringArgument(parsed, 'target')).toBe('local')
    expect(stringArgument(parsed, 'manifest')).toBe('fixture.json')
    expect(numberArgument(parsed, 'limit')).toBe(100)
  })

  it.each(['0', '-1', '1x', '1.5', '9007199254740992'])(
    'rejects malformed numeric value %s',
    (value) => {
      const parsed = parseCliArguments([`--limit=${value}`])
      expect(() => numberArgument(parsed, 'limit')).toThrow('--limit must be a positive integer.')
    },
  )

  it('rejects value options supplied as bare flags', () => {
    const parsed = parseCliArguments(['--manifest'])
    expect(() => stringArgument(parsed, 'manifest')).toThrow('--manifest requires a value.')
  })

  it('rejects unknown options', () => {
    const parsed = parseCliArguments(['--unexpected'])
    expect(() => assertKnownArguments(parsed, ['help'])).toThrow('Unknown option(s): --unexpected')
  })
})
