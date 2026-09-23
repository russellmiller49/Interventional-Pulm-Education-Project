import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
const fixture = JSON.parse(readFileSync('/tmp/socrates-rehearsal.json', 'utf8'))
const app = spawn(
  process.argv.includes('--build') ? 'npm' : process.execPath,
  process.argv.includes('--build')
    ? ['run', 'build']
    : [
        'node_modules/next/dist/bin/next',
        ...(process.argv.includes('--production') ? ['start'] : ['dev', '--webpack']),
        '--port',
        '3119',
      ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: fixture.url,
      SUPABASE_URL: fixture.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fixture.anon,
      SUPABASE_SERVICE_ROLE_KEY: fixture.service,
      NODE_OPTIONS: '--max-old-space-size=8192',
    },
  },
)
process.on('SIGTERM', () => app.kill('SIGTERM'))
process.on('SIGINT', () => app.kill('SIGINT'))
app.on('exit', (code) => process.exit(code ?? 1))
