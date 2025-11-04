import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const imageUrl = searchParams.get('url')

  console.log('Image proxy requested for:', imageUrl)

  if (!imageUrl) {
    console.error('Missing image URL in proxy request')
    return new NextResponse('Missing image URL', { status: 400 })
  }

  try {
    // Validate that the URL is from NCBI
    const url = new URL(imageUrl)
    if (!url.hostname.includes('ncbi.nlm.nih.gov')) {
      return new NextResponse('Invalid image source', { status: 400 })
    }

    // Fetch the image from NCBI
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://pmc.ncbi.nlm.nih.gov/',
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      return new NextResponse(`Failed to fetch image: ${response.status}`, {
        status: response.status,
      })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const imageBuffer = await response.arrayBuffer()

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Error proxying image:', error)
    return new NextResponse('Failed to proxy image', { status: 500 })
  }
}
