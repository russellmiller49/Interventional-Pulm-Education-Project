'use client'

import React from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Search, BookOpen, AlertCircle } from 'lucide-react'

const categories = [
  { name: '3D Reconstructions', slug: '3d-reconstructions', count: 8, icon: '🔬' },
  { name: 'Imaging', slug: 'imaging', count: 174, icon: '📷' },
  { name: 'Pathology', slug: 'pathology', count: 40, icon: '🔬' },
  { name: 'Miscellaneous', slug: 'miscellaneous', count: 23, icon: '📁' },
  { name: 'Peripheral Bronchoscopy', slug: 'peripheral-bronchoscopy', count: 87, icon: '🫁' },
  { name: 'Surgery', slug: 'surgery', count: 27, icon: '⚕️' },
  { name: 'Therapeutic Bronchoscopy', slug: 'therapeutic-bronchoscopy', count: 151, icon: '💊' },
  { name: 'Tracheostomy', slug: 'tracheostomy', count: 26, icon: '🏥' },
  { name: 'EBUS/EUS', slug: 'ebus-eus', count: 54, icon: '📊' },
  { name: 'Radiotherapy', slug: 'radiotherapy', count: 10, icon: '☢️' },
  {
    name: 'Bronchoscopic Lung Volume Reduction',
    slug: 'bronchoscopic-lung-volume-reduction',
    count: 12,
    icon: '🫁',
  },
  { name: 'Equipment', slug: 'equipment', count: 38, icon: '🔧' },
  { name: 'Pleural Procedures', slug: 'pleural-procedures', count: 30, icon: '💉' },
]

export default function CreativeCommonsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Creative Commons Medical Images</h1>
        <p className="text-lg text-gray-600 mb-6">
          A curated collection of medical images from peer-reviewed publications for educational use
        </p>
      </div>

      {/* Disclaimer Section */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
        <div className="flex items-start space-x-3 mb-4">
          <AlertCircle className="text-blue-600 mt-1" size={24} />
          <h2 className="text-2xl font-semibold text-blue-900">
            Image Use and Licensing Disclaimer
          </h2>
        </div>

        <p className="text-gray-700 mb-4">
          The images in this section are sourced exclusively from open-access, peer-reviewed medical
          publications released under Creative Commons (CC) licenses. These images are provided for
          educational and non-commercial purposes only.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-green-800 mb-2 flex items-center">
              <span className="mr-2">✓</span> Permitted Use
            </h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>
                • Download, display, and incorporate into educational presentations, lectures,
                manuscripts, or non-commercial publications
              </li>
              <li>
                • Proper attribution to the original article, author(s), and journal must be
                included
              </li>
              <li className="pl-4 text-xs italic">
                Example: Image reproduced from Smith et al., Journal of Thoracic Disease 2024, CC
                BY-NC 4.0
              </li>
              <li>
                • Adapt or modify images only if the original license permits derivatives (e.g., CC
                BY or CC BY-SA)
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-red-800 mb-2 flex items-center">
              <span className="mr-2">✗</span> Prohibited Use
            </h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>
                • Commercial promotion, advertising, resale, or paid online courses without
                additional permission
              </li>
              <li>• Removing or obscuring author names, figure legends, or copyright notices</li>
            </ul>
          </div>
        </div>
      </div>

      {/* How to Use Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center">
          <BookOpen className="mr-2" size={20} />
          How to Use Images Properly
        </h3>
        <ol className="text-sm text-gray-700 space-y-2">
          <li>
            <span className="font-semibold">1. Check the license</span> (noted under each figure)
            <ul className="ml-4 mt-1 space-y-1">
              <li>
                • <span className="font-mono text-xs bg-gray-200 px-1 rounded">CC BY 4.0</span> →
                Reuse, adapt, and redistribute with attribution
              </li>
              <li>
                • <span className="font-mono text-xs bg-gray-200 px-1 rounded">CC BY-NC 4.0</span> →
                Same as above, but non-commercial use only
              </li>
              <li>
                • <span className="font-mono text-xs bg-gray-200 px-1 rounded">CC BY-SA 4.0</span> →
                Reuse/adapt with attribution; derivatives must carry the same license
              </li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">2.</span> Provide citation and link to the original
            article or DOI whenever possible
          </li>
          <li>
            <span className="font-semibold">3.</span> Include attribution on or below the image (for
            presentations, posters, or online material)
          </li>
          <li>
            <span className="font-semibold">4.</span> If unsure, assume non-commercial educational
            use only and include full citation
          </li>
        </ol>
      </div>

      {/* Additional Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
        <p className="text-xs text-gray-700">
          <span className="font-semibold">Disclaimer:</span> All images remain the property of their
          respective authors and publishers under the terms of the Creative Commons license
          indicated. InterventionalPulm.com does not claim copyright ownership of these materials
          and hosts them solely for the purpose of advancing medical education in interventional
          pulmonology. Users are responsible for ensuring their own compliance with the applicable
          license terms.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <Link href="/resources/creative-commons/search">
          <div className="flex items-center bg-white border-2 border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer">
            <Search className="text-gray-500 mr-3" size={24} />
            <span className="text-gray-600">Search all images by keywords...</span>
          </div>
        </Link>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Link key={category.slug} href={`/resources/creative-commons/${category.slug}`}>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500 relative">
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-t-lg">
                <h3 className="text-base font-semibold truncate">{category.name}</h3>
              </div>
              <div className="mt-8">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{category.icon}</span>
                  <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
                    {category.count} images
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Browse {category.count} curated images in this category
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Total Count */}
      <div className="mt-8 text-center text-gray-600">
        <p className="text-lg">
          Total: <span className="font-semibold">680 medical images</span> from peer-reviewed
          publications
        </p>
      </div>
    </div>
  )
}
