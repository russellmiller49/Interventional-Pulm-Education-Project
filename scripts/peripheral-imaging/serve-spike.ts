import { createServer } from 'vite'
import path from 'node:path'

async function main() {
  const root = process.cwd()
  const server = await createServer({
    configFile: false,
    root,
    publicDir: path.join(root, 'public'),
    resolve: {
      alias: { '@fluoroview': path.join(root, 'fluoro-viewer/src'), '@': path.join(root, 'src') },
    },
    esbuild: { jsx: 'automatic' },
    server: { host: '127.0.0.1', port: 5117, strictPort: true },
  })
  await server.listen()
  console.log('Detector spike: http://127.0.0.1:5117/scripts/peripheral-imaging/drr-spike.html')
}
void main()
