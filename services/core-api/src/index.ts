import { randomBytes } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

import { createCoreApp } from './app.js'
import { loadCoreConfig } from './config.js'
import { createEmailSender } from './identity/email-sender.js'

const config = loadCoreConfig()
const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
})
const redis = new Redis(config.redisUrl)
const emailSender = createEmailSender({
  providerUrl: config.emailProviderUrl,
  token: config.emailProviderToken,
})

const app = createCoreApp({
  prisma,
  redis,
  emailSender,
  now: () => new Date(),
  randomBytes,
  identity: {
    sessionSecret: config.sessionSecret,
    otpPepper: config.otpPepper,
    adminEmails: process.env.CORE_ADMIN_EMAILS ?? '',
    production: config.nodeEnv === 'production',
  },
})

app.listen(config.port)
