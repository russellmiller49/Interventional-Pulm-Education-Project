import { NextResponse } from 'next/server'

export async function GET(_: Request, context: { params: Promise<{ fileId: string }> }) {
  const params = await context.params
  return NextResponse.json({
    status: 'pending',
    fileId: params.fileId,
    message: 'Download streaming will be implemented in milestone M12.',
  })
}
