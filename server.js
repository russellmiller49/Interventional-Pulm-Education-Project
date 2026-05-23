const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const portArgIndex = process.argv.findIndex((arg) => arg === '-p' || arg === '--port')
const port = process.env.PORT || (portArgIndex >= 0 ? process.argv[portArgIndex + 1] : '3000')
const nextBin = require.resolve('next/dist/bin/next')
const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js')
const command = fs.existsSync(standaloneServer) ? standaloneServer : nextBin
const args = fs.existsSync(standaloneServer) ? [] : ['start', '-p', port]

const child = spawn(process.execPath, [command, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port,
  },
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
