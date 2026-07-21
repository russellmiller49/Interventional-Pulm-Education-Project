import { loadInvenioDziDescriptor, parseDziDescriptorXml } from '../descriptor'

const descriptor = `<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008" Format="jpg" Overlap="1" TileSize="510">
  <Size Height="5900" Width="5400" />
</Image>`

describe('Invenio DZI descriptor loading', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalFetch) {
      global.fetch = originalFetch
    } else {
      delete (global as { fetch?: typeof fetch }).fetch
    }
  })

  it('parses the image dimensions and pyramid settings', () => {
    expect(parseDziDescriptorXml(descriptor)).toEqual({
      width: 5400,
      height: 5900,
      tileSize: 510,
      overlap: 1,
      format: 'jpg',
    })
  })

  it.each([
    ['missing tags', '<xml />', /readable DZI descriptor/i],
    [
      'unsupported format',
      descriptor.replace('Format="jpg"', 'Format="png"'),
      /JPEG DZI pyramids only/i,
    ],
    ['invalid width', descriptor.replace('Width="5400"', 'Width="0"'), /positive integer/i],
  ])('rejects %s', (_label, xml, expectedMessage) => {
    expect(() => parseDziDescriptorXml(xml)).toThrow(expectedMessage)
  })

  it('loads an approved descriptor without credentials', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(descriptor),
    })
    global.fetch = fetchMock

    await expect(
      loadInvenioDziDescriptor(
        'https://www.invenio-cloud.com/api/thinslides/PATH_IP31-AC0501-2_7.dzi',
      ),
    ).resolves.toMatchObject({ width: 5400, height: 5900 })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('www.invenio-cloud.com/api/thinslides/'),
      expect.objectContaining({ credentials: 'omit' }),
    )
  })

  it('does not fetch unapproved hosts', async () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock

    await expect(loadInvenioDziDescriptor('https://example.com/slide.dzi')).rejects.toThrow(
      /approved Invenio Cloud/i,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
