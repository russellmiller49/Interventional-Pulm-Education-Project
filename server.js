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

app
  .prepare()
  .then(() => {
    console.log('Next.js app prepared successfully')
    const server = express()

    // Health check endpoint
    server.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: port,
        hostname: hostname,
      })
    })

    // Serve static files from the public directory
    server.use('/public', express.static(path.join(__dirname, 'public')))
    server.use('/models', express.static(path.join(__dirname, 'public', 'models')))
    server.use('/draco', express.static(path.join(__dirname, 'public', 'draco')))

    server.use((req, res) => {
      return handle(req, res)
    })

    server.listen(port, hostname, (err) => {
      if (err) {
        console.error('Failed to start server:', err)
        throw err
      }
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Environment: ${process.env.NODE_ENV}`)
      console.log(`> Port: ${port}`)
      console.log(`> Hostname: ${hostname}`)
    })
  })
  .catch((err) => {
    console.error('Failed to prepare Next.js app:', err)
    process.exit(1)
  })
