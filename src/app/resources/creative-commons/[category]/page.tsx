'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Download, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import CreativeCommonsImageSimple from '@/components/CreativeCommonsImageSimple'
import imagesData from '@/data/creative-commons-images.json'

// Category name mapping
const categoryMapping: { [key: string]: string } = {
  '3d-reconstructions': '3D reconstructions',
  imaging: 'Imaging',
  pathology: 'Pathology',
  miscellaneous: 'Miscellaneous',
  'peripheral-bronchoscopy': 'Peripheral Bronchoscopy (Navigation/Robotic/Intraprocedual Imaging)',
  surgery: 'Surgery',
  'therapeutic-bronchoscopy': 'Therapeutic Bronchoscopy',
  tracheostomy: 'Tracheostomy',
  'ebus-eus': 'EBUS/EUS',
  radiotherapy: 'Radiotherapy',
  'bronchoscopic-lung-volume-reduction': 'Bronchoscopic Lung Volume Reduction',
  equipment: 'Equipment',
  'pleural-procedures': 'Pleural Procedures',
}

interface ImageData {
  Category: string
  Image_url: string
  'Image Description': string
  article_title: string
  article_url: string
}

export default function CategoryPage() {
  const params = useParams()
  const category = params?.category as string
  const [images, setImages] = useState<ImageData[]>([])
  const [filteredImages, setFilteredImages] = useState<ImageData[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (category && categoryMapping[category]) {
      const categoryName = categoryMapping[category]
      const categoryImages = (imagesData as ImageData[]).filter(
        (img) => img.Category === categoryName,
      )
      setImages(categoryImages)
      setFilteredImages(categoryImages)
    }
  }, [category])

  useEffect(() => {
    if (searchTerm) {
      const filtered = images.filter(
        (img) =>
          img['Image Description'].toLowerCase().includes(searchTerm.toLowerCase()) ||
          img.article_title.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredImages(filtered)
    } else {
      setFilteredImages(images)
    }
  }, [searchTerm, images])

  const categoryName = categoryMapping[category] || category

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/resources/creative-commons"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="mr-2" size={20} />
          Back to Categories
        </Link>
        <h1 className="text-4xl font-bold mb-2">{categoryName}</h1>
        <p className="text-gray-600">
          {filteredImages.length} of {images.length} images in this category
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search within this category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredImages.map((image, index) => (
          <Card key={index} className="overflow-hidden hover:shadow-xl transition-shadow">
            <div className="relative h-64 bg-gray-100">
              <CreativeCommonsImageSimple
                src={image.Image_url}
                alt={image['Image Description']}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-4">
              {/* Image Description */}
              <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                {image['Image Description']}
              </p>

              {/* Article Title with Link */}
              <div className="mb-3">
                <a
                  href={image.article_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm inline-flex items-center hover:underline"
                >
                  {image.article_title}
                  <ExternalLink className="ml-1" size={14} />
                </a>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <a
                  href={image.Image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <Download className="mr-1" size={16} />
                  Download
                </a>
                <a
                  href={image.article_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-gray-200 text-gray-800 px-3 py-2 rounded text-sm font-medium hover:bg-gray-300 transition-colors flex items-center justify-center"
                >
                  <ExternalLink className="mr-1" size={16} />
                  Article
                </a>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* No Results Message */}
      {filteredImages.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No images found matching your search.</p>
          <button
            onClick={() => setSearchTerm('')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  )
}
