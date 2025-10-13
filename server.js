const next = require('next')
const express = require('express')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = process.env.PORT || 3000
const app = next({ dev })
const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
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
    })
  })
  .catch((err) => {
    console.error('Failed to prepare Next.js app:', err)
    process.exit(1)
  })
