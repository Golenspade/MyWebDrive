import { randomBytes } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

import { createCoreApp, type EmailSender } from './app.js'
import { loadCoreConfig } from './config.js'

const config = loadCoreConfig()
const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
})
const redis = new Redis(config.redisUrl)
const emailSender: EmailSender = {
  async sendOtp() {
    throw new Error('Email sender is not available until the identity module is mounted')
  },
}

const app = createCoreApp({
  prisma,
  redis,
  emailSender,
  now: () => new Date(),
  randomBytes,
})

app.listen(config.port)
