'use client'

import React, { useState } from 'react'
import { ExternalLink, ImageOff } from 'lucide-react'

interface CreativeCommonsImageProps {
  src: string
  alt: string
  className?: string
}

export default function CreativeCommonsImageSimple({
  src,
  alt,
  className = '',
}: CreativeCommonsImageProps) {
  const [hasError, setHasError] = useState(false)

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
          onClick={(e) => e.stopPropagation()}
        >
          View Original <ExternalLink className="ml-1" size={12} />
        </a>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  )
}
