export class RequestBodyTooLargeError extends Error {
  constructor(readonly maximumBytes: number) {
    super(`Request body exceeds the ${maximumBytes}-byte limit.`)
    this.name = 'RequestBodyTooLargeError'
  }
}

export async function readBoundedRequestBody(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maximumBytes) {
    throw new RequestBodyTooLargeError(maximumBytes)
  }

  if (!request.body) return new Uint8Array()

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      byteLength += value.byteLength
      if (byteLength > maximumBytes) {
        await reader.cancel().catch(() => undefined)
        throw new RequestBodyTooLargeError(maximumBytes)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
