import { NextResponse } from 'next/server'

interface DownloadRouteParams {
  params: { fileId: string }
}

export async function GET(_: Request, { params }: DownloadRouteParams) {
  return NextResponse.json({
    status: 'pending',
    fileId: params.fileId,
    message: 'Download streaming will be implemented in milestone M12.',
  })
}
