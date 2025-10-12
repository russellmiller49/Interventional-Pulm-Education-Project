const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const path = require('path')
const fs = require('fs')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const { pathname } = parsedUrl

      // Handle static files from public directory
      if (
        pathname.startsWith('/models/') ||
        pathname.startsWith('/window.svg') ||
        pathname.startsWith('/favicon.ico')
      ) {
        const filePath = path.join(__dirname, 'public', pathname)

        try {
          const stat = fs.statSync(filePath)
          if (stat.isFile()) {
            // Set appropriate content type
            if (pathname.endsWith('.glb')) {
              res.setHeader('Content-Type', 'model/gltf-binary')
            } else if (pathname.endsWith('.svg')) {
              res.setHeader('Content-Type', 'image/svg+xml')
            } else if (pathname.endsWith('.ico')) {
              res.setHeader('Content-Type', 'image/x-icon')
            }

            res.setHeader('Content-Length', stat.size)
            res.setHeader('Cache-Control', 'public, max-age=31536000')

            const fileStream = fs.createReadStream(filePath)
            fileStream.pipe(res)
            return
          }
        } catch (err) {
          // File not found, continue to Next.js
        }
      }

      // Handle all other requests with Next.js
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
