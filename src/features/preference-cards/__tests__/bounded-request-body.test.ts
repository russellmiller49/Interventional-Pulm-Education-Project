import { ReadableStream } from 'node:stream/web'

import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/features/preference-cards/server/bounded-request-body.server'

function streamingRequest(
  chunks: number[][],
  declaredLength?: string,
): { request: Request; consumedChunks: () => number } {
  let nextChunk = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (nextChunk >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(new Uint8Array(chunks[nextChunk]))
      nextChunk += 1
    },
  })
  const headers = new Headers()
  if (declaredLength !== undefined) headers.set('content-length', declaredLength)

  return {
    request: { body, headers } as unknown as Request,
    consumedChunks: () => nextChunk,
  }
}

describe('readBoundedRequestBody', () => {
  it('accepts bounded chunked input and preserves byte order', async () => {
    const { request } = streamingRequest([[1, 2], [3], [4, 5]], '5')

    await expect(readBoundedRequestBody(request, 5)).resolves.toEqual(
      new Uint8Array([1, 2, 3, 4, 5]),
    )
  })

  it('rejects a misleading small content length when streamed bytes exceed the limit', async () => {
    const { request } = streamingRequest([[1, 2], [3, 4], [5]], '1')

    await expect(readBoundedRequestBody(request, 4)).rejects.toMatchObject({
      maximumBytes: 4,
      name: 'RequestBodyTooLargeError',
    })
  })

  it('rejects an oversized chunked body without a content-length header', async () => {
    const { request } = streamingRequest([[1, 2], [3, 4], [5]])

    await expect(readBoundedRequestBody(request, 4)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    )
  })

  it('rejects an oversized declared length before consuming the stream', async () => {
    let bodyAccessed = false
    const request = {
      headers: new Headers({ 'content-length': '6' }),
      get body() {
        bodyAccessed = true
        throw new Error('The request body must not be accessed')
      },
    } as unknown as Request

    await expect(readBoundedRequestBody(request, 5)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    )
    expect(bodyAccessed).toBe(false)
  })
})
