import express from 'express'
import helmet from 'helmet'

import { createStorageApi } from './api.js'
import { connectRuntimeRedis, createApiRuntime, createWorkerRuntime } from './runtime.js'
import { runWorker, WorkerLoopState } from './worker.js'

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
    await connectRuntimeRedis(runtime.redis)
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
  await connectRuntimeRedis(runtime.redis)
  const workerState = new WorkerLoopState()
  app.get('/live', (_req, res) => res.json({ status: 'live', service: 'storage-worker' }))
  app.get('/ready', async (_req, res) => {
    try {
      if (!workerState.isReady()) throw new Error('worker loop unavailable')
      await Promise.all([runtime.queue.ready(), runtime.storage.ready()])
      return res.json({ status: 'ready', service: 'storage-worker' })
    } catch {
      return res.status(503).json({ status: 'not_ready', service: 'storage-worker' })
    }
  })
  const server = app.listen(runtime.workerPort)
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  try {
    await runWorker({
      storage: runtime.storage,
      queue: runtime.queue,
      callbackSecret: runtime.callbackSecret,
      coreApiUrl: runtime.coreApiUrl,
      signal: controller.signal,
      state: workerState,
    })
  } finally {
    process.off('SIGTERM', stop)
    process.off('SIGINT', stop)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await runtime.redis.quit().catch(() => runtime.redis.disconnect())
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`storage startup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`)
  process.exitCode = 1
})
