const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const portArgIndex = process.argv.findIndex((arg) => arg === '-p' || arg === '--port')
const hostnameArgIndex = process.argv.findIndex((arg) => arg === '-H' || arg === '--hostname')
const port = process.env.PORT || (portArgIndex >= 0 ? process.argv[portArgIndex + 1] : '3000')
const hostname =
  process.env.NEXT_HOSTNAME ||
  process.env.HOST ||
  (hostnameArgIndex >= 0 ? process.argv[hostnameArgIndex + 1] : '0.0.0.0')
const nextBin = require.resolve('next/dist/bin/next')
const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js')
const useStandalone = fs.existsSync(standaloneServer)
const command = useStandalone ? standaloneServer : nextBin
const args = useStandalone ? [] : ['start', '-p', port, '-H', hostname]

console.log(`Starting Next.js on ${hostname}:${port}`)

const child = spawn(process.execPath, [command, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOSTNAME: hostname,
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
