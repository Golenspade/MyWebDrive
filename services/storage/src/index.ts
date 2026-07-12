import {
  createAppTelemetry,
  createDependencyReadinessMetrics,
  createDownloadMetrics,
  createStorageWorkerMetrics,
} from '@mywebdrive/observability'

import { createStorageApi } from './api.js'
import { connectRuntimeRedis, createApiRuntime, createWorkerRuntime } from './runtime.js'
import {
  checkStorageWorkerDependencies,
  createStorageApiApp,
  createStorageWorkerHealthApp,
} from './server.js'
import { runWorker, WorkerLoopState } from './worker.js'

async function main(): Promise<void> {
  const command = process.argv[2]
  if (command !== 'api' && command !== 'worker') {
    throw new Error('usage: node dist/index.js api|worker')
  }
  if (command === 'api') {
    const runtime = createApiRuntime()
    await connectRuntimeRedis(runtime.redis)
    const telemetry = createAppTelemetry({ service: 'storage-api' })
    const dependencyMetrics = createDependencyReadinessMetrics(telemetry.register)
    const app = createStorageApiApp({
      telemetry,
      router: createStorageApi({
        storage: runtime.storage,
        redis: runtime.redis,
        queue: runtime.queue,
        downloadEvents: runtime.downloadEvents,
        grantSecret: runtime.grantSecret,
        downloadMetrics: createDownloadMetrics(telemetry.register),
        dependencyMetrics,
      }),
    })
    const server = app.listen(runtime.apiPort)
    const stop = () => server.close(() => void runtime.redis.quit())
    process.once('SIGTERM', stop)
    process.once('SIGINT', stop)
    return
  }

  const runtime = createWorkerRuntime()
  await connectRuntimeRedis(runtime.redis)
  const workerState = new WorkerLoopState()
  const telemetry = createAppTelemetry({ service: 'storage-worker' })
  const dependencyMetrics = createDependencyReadinessMetrics(telemetry.register)
  const workerMetrics = createStorageWorkerMetrics(telemetry.register)
  const app = createStorageWorkerHealthApp({
    state: workerState,
    telemetry,
    ready: async () => {
      await checkStorageWorkerDependencies({
        redis: () => Promise.all([
          runtime.queue.ready(),
          runtime.downloadEvents.ready(),
        ]),
        objectStore: () => runtime.storage.ready(),
        metrics: dependencyMetrics,
      })
    },
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
      downloadEvents: runtime.downloadEvents,
      callbackSecret: runtime.callbackSecret,
      coreApiUrl: runtime.coreApiUrl,
      signal: controller.signal,
      state: workerState,
      metrics: workerMetrics,
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
