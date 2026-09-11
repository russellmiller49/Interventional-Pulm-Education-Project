/** Static servers differ: some send .gz as a file, others set Content-Encoding. */
export function isGzip(bytes: Uint8Array) {
  return bytes[0] === 0x1f && bytes[1] === 0x8b
}
export async function decodeGzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (!isGzip(new Uint8Array(buffer))) return buffer
  return new Response(
    new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer()
}
