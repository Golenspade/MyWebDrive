import { parentPort, workerData } from 'worker_threads'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Writable } from 'stream'

async function run() {
  try {
    const { filePath } = (workerData || {}) as { filePath: string }
    if (!filePath) throw new Error('filePath required')

    const hash = createHash('md5')
    // Writable that only updates hash and discards output
    const sink = new Writable({
      write(chunk, _enc, cb) {
        try { hash.update(chunk as Buffer); cb() } catch (e) { cb(e as any) }
      },
    })
    await pipeline(createReadStream(filePath), sink)
    parentPort?.postMessage({ hash: hash.digest('hex') })
  } catch (e: any) {
    parentPort?.postMessage({ error: e?.message || 'md5_failed' })
  }
}

run().catch((e) => parentPort?.postMessage({ error: e?.message || 'md5_failed' }))

