import { isApprovedInvenioDziUrl } from './schema'

export interface DziDescriptorInfo {
  width: number
  height: number
  tileSize: number
  overlap: number
  format: 'jpg' | 'jpeg'
}

function readAttribute(source: string, name: string) {
  return source.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]
}

function positiveInteger(value: string | undefined, label: string) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer.`)
  }
  return number
}

export function parseDziDescriptorXml(xml: string): DziDescriptorInfo {
  const imageTag = xml.match(/<Image\b([^>]*)>/i)?.[1]
  const sizeTag = xml.match(/<Size\b([^>]*)\/?\s*>/i)?.[1]
  if (!imageTag || !sizeTag) {
    throw new Error('The response is not a readable DZI descriptor.')
  }

  const format = readAttribute(imageTag, 'Format')?.toLowerCase()
  if (format !== 'jpg' && format !== 'jpeg') {
    throw new Error('The builder currently supports JPEG DZI pyramids only.')
  }

  const overlap = Number(readAttribute(imageTag, 'Overlap'))
  if (!Number.isInteger(overlap) || overlap < 0) {
    throw new Error('DZI overlap must be a non-negative integer.')
  }

  return {
    width: positiveInteger(readAttribute(sizeTag, 'Width'), 'DZI width'),
    height: positiveInteger(readAttribute(sizeTag, 'Height'), 'DZI height'),
    tileSize: positiveInteger(readAttribute(imageTag, 'TileSize'), 'DZI tile size'),
    overlap,
    format,
  }
}

export async function loadInvenioDziDescriptor(
  descriptorUrl: string,
  signal?: AbortSignal,
): Promise<DziDescriptorInfo> {
  if (!isApprovedInvenioDziUrl(descriptorUrl)) {
    throw new Error('Use an approved Invenio Cloud DZI descriptor URL.')
  }

  const response = await fetch(descriptorUrl, {
    credentials: 'omit',
    headers: { Accept: 'application/xml,text/xml' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Invenio returned HTTP ${response.status}.`)
  }

  return parseDziDescriptorXml(await response.text())
}
