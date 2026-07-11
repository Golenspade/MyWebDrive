import express from 'express'
import helmet from 'helmet'

import { createStorageApi } from './api.js'
import { createApiRuntime, createWorkerRuntime } from './runtime.js'
import { runWorker } from './worker.js'

async function main(): Promise<void> {
  const command = process.argv[2]
  if (command !== 'api' && command !== 'worker') {
    throw new Error('usage: node dist/index.js api|worker')
  }
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: false }))

  if (command === 'api') {
    const runtime = createApiRuntime()
    app.use(
      createStorageApi({
        storage: runtime.storage,
        redis: runtime.redis,
        queue: runtime.queue,
        grantSecret: runtime.grantSecret,
      }),
    )
    const server = app.listen(runtime.apiPort)
    const stop = () => server.close(() => void runtime.redis.quit())
    process.once('SIGTERM', stop)
    process.once('SIGINT', stop)
    return
  }

  const runtime = createWorkerRuntime()
  app.get('/live', (_req, res) => res.json({ status: 'live', service: 'storage-worker' }))
  app.get('/ready', async (_req, res) => {
    try {
      await Promise.all([runtime.queue.ready(), runtime.storage.ready()])
      return res.json({ status: 'ready', service: 'storage-worker' })
    } catch {
      return res.status(503).json({ status: 'not_ready', service: 'storage-worker' })
    }
  })
  const server = app.listen(runtime.workerPort)
  const controller = new AbortController()
  const stop = () => {
    controller.abort()
    server.close(() => void runtime.redis.quit())
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  await runWorker({
    storage: runtime.storage,
    queue: runtime.queue,
    callbackSecret: runtime.callbackSecret,
    coreApiUrl: runtime.coreApiUrl,
    signal: controller.signal,
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`storage startup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`)
  process.exitCode = 1
})
