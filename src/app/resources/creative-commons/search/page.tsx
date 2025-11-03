'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Download, Search, Filter } from 'lucide-react'
import { Card } from '@/components/ui/card'
import CreativeCommonsImageSimple from '@/components/CreativeCommonsImageSimple'
import imagesData from '@/data/creative-commons-images.json'

interface ImageData {
  Category: string
  Image_url: string
  'Image Description': string
  article_title: string
  article_url: string
}

const categories = [
  '3D reconstructions',
  'Imaging',
  'Pathology',
  'Miscellaneous',
  'Peripheral Bronchoscopy (Navigation/Robotic/Intraprocedual Imaging)',
  'Surgery',
  'Therapeutic Bronchoscopy',
  'Tracheostomy',
  'EBUS/EUS',
  'Radiotherapy',
  'Bronchoscopic Lung Volume Reduction',
  'Equipment',
  'Pleural Procedures',
]

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [filteredImages, setFilteredImages] = useState<ImageData[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    let filtered = imagesData as ImageData[]

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((img) => img.Category === selectedCategory)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (img) =>
          img['Image Description'].toLowerCase().includes(searchTerm.toLowerCase()) ||
          img.article_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          img.Category.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    setFilteredImages(filtered)
  }, [searchTerm, selectedCategory])

  const getCategorySlug = (categoryName: string) => {
    const mapping: { [key: string]: string } = {
      '3D reconstructions': '3d-reconstructions',
      Imaging: 'imaging',
      Pathology: 'pathology',
      Miscellaneous: 'miscellaneous',
      'Peripheral Bronchoscopy (Navigation/Robotic/Intraprocedual Imaging)':
        'peripheral-bronchoscopy',
      Surgery: 'surgery',
      'Therapeutic Bronchoscopy': 'therapeutic-bronchoscopy',
      Tracheostomy: 'tracheostomy',
      'EBUS/EUS': 'ebus-eus',
      Radiotherapy: 'radiotherapy',
      'Bronchoscopic Lung Volume Reduction': 'bronchoscopic-lung-volume-reduction',
      Equipment: 'equipment',
      'Pleural Procedures': 'pleural-procedures',
    }
    return mapping[categoryName] || categoryName.toLowerCase().replace(/\s+/g, '-')
  }

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
        <h1 className="text-4xl font-bold mb-2">Search Creative Commons Images</h1>
        <p className="text-gray-600">Search across all {imagesData.length} medical images</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search by description, title, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 border-2 rounded-lg flex items-center gap-2 transition-colors ${
              showFilters
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Filter size={20} />
            Filters
          </button>
        </div>

        {/* Category Filter */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-gray-600">
          Found <span className="font-semibold">{filteredImages.length}</span> images
          {searchTerm && ` matching "${searchTerm}"`}
          {selectedCategory !== 'all' && ` in ${selectedCategory}`}
        </p>
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

              {/* Category Badge */}
              <Link
                href={`/resources/creative-commons/${getCategorySlug(image.Category)}`}
                className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs hover:bg-opacity-90 transition-colors"
              >
                {image.Category}
              </Link>
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
          <p className="text-gray-500 text-lg">No images found matching your criteria.</p>
          <div className="mt-4 space-x-4">
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-blue-600 hover:text-blue-800"
              >
                Clear search
              </button>
            )}
            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="text-blue-600 hover:text-blue-800"
              >
                Show all categories
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
