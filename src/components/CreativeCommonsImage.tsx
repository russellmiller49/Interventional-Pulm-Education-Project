'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ExternalLink, ImageOff } from 'lucide-react'

interface CreativeCommonsImageProps {
  src: string
  alt: string
  className?: string
}

export default function CreativeCommonsImage({
  src,
  alt,
  className = '',
}: CreativeCommonsImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Always use proxy for NCBI images
  const getImageUrl = (url: string) => {
    if (url.includes('ncbi.nlm.nih.gov')) {
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`
      console.log('Using proxy for image:', { original: url, proxy: proxyUrl })
      return proxyUrl
    }
    console.log('Using direct URL for image:', url)
    return url
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Image failed to load:', src, e)
    setHasError(true)
    setIsLoading(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  const handleLoad = () => {
    console.log('Image loaded successfully:', src)
    setIsLoading(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  useEffect(() => {
    // Set a timeout to prevent infinite loading state
    // If image doesn't load within 8 seconds, check if it actually loaded
    timeoutRef.current = setTimeout(() => {
      if (isLoading && imgRef.current) {
        // Check if image actually loaded but onLoad didn't fire
        if (imgRef.current.complete && imgRef.current.naturalHeight > 0) {
          setIsLoading(false)
        } else if (imgRef.current.complete && imgRef.current.naturalHeight === 0) {
          // Image completed but has no height (likely error)
          setHasError(true)
          setIsLoading(false)
        } else {
          // Image still loading, give it more time (maybe slow connection)
          // Check again in 5 more seconds
          setTimeout(() => {
            if (imgRef.current && isLoading) {
              if (imgRef.current.complete && imgRef.current.naturalHeight > 0) {
                setIsLoading(false)
              } else {
                setHasError(true)
                setIsLoading(false)
              }
            }
          }, 5000)
        }
      }
    }, 8000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isLoading, src])

  // Reset state when src changes
  useEffect(() => {
    setHasError(false)
    setIsLoading(true)
  }, [src])

  // Callback ref to check if image is already loaded when it mounts
  const setImageRef = (node: HTMLImageElement | null) => {
    imgRef.current = node
    if (node) {
      // Check immediately if image is already loaded (from cache)
      if (node.complete && node.naturalHeight > 0) {
        setIsLoading(false)
      }
    }
  }

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 ${className}`}>
        <ImageOff className="text-gray-400 mb-2" size={48} />
        <p className="text-gray-500 text-sm mb-2">Image preview unavailable</p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-xs inline-flex items-center"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          View Original <ExternalLink className="ml-1" size={12} />
        </a>
      </div>
    )
  }

  return (
    <>
      {isLoading && (
        <div className={`flex items-center justify-center bg-gray-100 animate-pulse ${className}`}>
          <div className="text-gray-400">Loading...</div>
        </div>
      )}
      <img
        ref={setImageRef}
        src={getImageUrl(src)}
        alt={alt}
        className={`${className} ${isLoading ? 'hidden' : ''}`}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
      />
    </>
  )
}
