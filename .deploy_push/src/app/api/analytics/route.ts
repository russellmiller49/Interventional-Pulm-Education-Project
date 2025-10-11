import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)

  return NextResponse.json(
    {
      status: 'pending',
      received: payload,
      message: 'Analytics ingestion will be wired in milestone M12.',
    },
    { status: 202 },
  )
}
