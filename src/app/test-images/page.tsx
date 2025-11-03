'use client'

import React, { useState } from 'react'

export default function TestImagesPage() {
  const [proxyStatus, setProxyStatus] = useState<string>('')
  const [directStatus, setDirectStatus] = useState<string>('')

  const testImageUrl =
    'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/b151/8766198/3b5d8a3d2627/ivab241f3.jpg'
  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(testImageUrl)}`

  const testProxy = async () => {
    try {
      const response = await fetch(proxyUrl)
      if (response.ok) {
        const blob = await response.blob()
        setProxyStatus(`Success! Received ${blob.size} bytes, type: ${blob.type}`)
      } else {
        setProxyStatus(`Failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setProxyStatus(`Error: ${error}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Image Loading Test Page</h1>

      <div className="space-y-8">
        {/* Test 1: Direct Image Load */}
        <div className="border-2 border-gray-300 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">
            Test 1: Direct Image Load (will likely fail due to CORS)
          </h2>
          <p className="text-sm text-gray-600 mb-2">URL: {testImageUrl}</p>
          <img
            src={testImageUrl}
            alt="Direct load test"
            className="max-w-full h-auto border border-gray-200"
            onLoad={() => setDirectStatus('Direct load successful!')}
            onError={(e) => setDirectStatus(`Direct load failed: ${e}`)}
          />
          <p className="mt-2 text-sm">{directStatus}</p>
        </div>

        {/* Test 2: Proxy Image Load */}
        <div className="border-2 border-gray-300 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Test 2: Proxy Image Load</h2>
          <p className="text-sm text-gray-600 mb-2">Proxy URL: {proxyUrl}</p>
          <img
            src={proxyUrl}
            alt="Proxy load test"
            className="max-w-full h-auto border border-gray-200"
            onLoad={() => console.log('Proxy image loaded')}
            onError={(e) => console.error('Proxy image failed:', e)}
          />
        </div>

        {/* Test 3: Fetch Test */}
        <div className="border-2 border-gray-300 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Test 3: Direct Fetch via Proxy</h2>
          <button
            onClick={testProxy}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Proxy Fetch
          </button>
          <p className="mt-2 text-sm">{proxyStatus}</p>
        </div>

        {/* Test 4: Simple HTML img tags */}
        <div className="border-2 border-gray-300 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Test 4: Simple HTML img tags</h2>
          <p className="text-sm mb-2">Direct (should show in console if blocked):</p>
          <img
            src="https://cdn.ncbi.nlm.nih.gov/pmc/blobs/b151/8766198/3b5d8a3d2627/ivab241f3.jpg"
            width="200"
            alt="Simple direct"
          />
          <p className="text-sm mb-2 mt-4">Via Proxy:</p>
          <img
            src={`/api/image-proxy?url=${encodeURIComponent('https://cdn.ncbi.nlm.nih.gov/pmc/blobs/b151/8766198/3b5d8a3d2627/ivab241f3.jpg')}`}
            width="200"
            alt="Simple proxy"
          />
        </div>
      </div>
    </div>
  )
}
