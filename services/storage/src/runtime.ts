import os from 'node:os'

import Redis from 'ioredis'
import { Client as MinioClient } from 'minio'

import { FinalizationQueue, type StreamRedis } from './finalization-queue.js'
import { LocalObjectStorage } from './object-storage/local.js'
import { MinioObjectStorage } from './object-storage/minio.js'
import type { ObjectStorage } from './object-storage/types.js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set`)
  return value
}

function secret(name: string): string {
  const value = required(name)
  if (Buffer.byteLength(value, 'utf8') < 32) throw new Error(`${name} must be at least 32 bytes`)
  return value
}

function integer(name: string, fallback: number): number {
  const value = process.env[name]
  const parsed = value === undefined ? fallback : Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) throw new Error(`${name} is invalid`)
  return parsed
}

function minioStorage(): ObjectStorage {
  const rawEndpoint = required('MINIO_ENDPOINT')
  const endpoint = new URL(rawEndpoint.includes('://') ? rawEndpoint : `http://${rawEndpoint}`)
  const client = new MinioClient({
    endPoint: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === 'https:' ? 443 : 9000,
    useSSL: endpoint.protocol === 'https:',
    accessKey: required('MINIO_ACCESS_KEY'),
    secretKey: required('MINIO_SECRET_KEY'),
  })
  return new MinioObjectStorage(client, required('MINIO_BUCKET'))
}

function baseRuntime() {
  const adapter = process.env.STORAGE_ADAPTER ?? 'local'
  let storage: ObjectStorage
  if (adapter === 'local') storage = new LocalObjectStorage(process.env.STORAGE_PATH ?? 'storage')
  else if (adapter === 'minio') storage = minioStorage()
  else if (adapter === 'oss') {
    throw new Error('OSS runtime requires an injected OssClient adapter')
  } else throw new Error('STORAGE_ADAPTER must be local, minio or oss')

  const redis = new Redis(required('REDIS_URL'), {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  })
  const consumer = process.env.STORAGE_WORKER_CONSUMER ?? `${os.hostname()}-${process.pid}`
  return {
    storage,
    redis,
    queue: new FinalizationQueue(redis as unknown as StreamRedis, consumer),
    apiPort: integer('STORAGE_PORT', 7084),
    workerPort: integer('STORAGE_WORKER_PORT', 7085),
  }
}

export function createApiRuntime() {
  return { ...baseRuntime(), grantSecret: secret('STORAGE_GRANT_SECRET') }
}

export function createWorkerRuntime() {
  return {
    ...baseRuntime(),
    callbackSecret: secret('CORE_CALLBACK_SECRET'),
    coreApiUrl: required('CORE_API_URL'),
  }
}
