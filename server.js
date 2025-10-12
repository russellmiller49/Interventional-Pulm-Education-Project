const next = require('next')
const express = require('express')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = process.env.PORT || 3000
// When using `pnpm dev`, we already have a Next.js server running on 3001
// so we need to use a different port for the custom server.
const app = next({ dev, hostname, port: dev ? 3002 : port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = express()

  // Serve static files from the public directory
  server.use('/public', express.static(path.join(__dirname, 'public')))
  server.use('/models', express.static(path.join(__dirname, 'public', 'models')))
  server.use('/draco', express.static(path.join(__dirname, 'public', 'draco')))

  server.all('*', (req, res) => {
    return handle(req, res)
  })

  server.listen(port, hostname, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
