import { PrismaClient } from './prisma/client/index.js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../../.env') })

const prisma = new PrismaClient()
const files = await prisma.file.findMany({
  select: { id: true, name: true, size: true, mimeType: true, ownerId: true },
  orderBy: { createdAt: 'desc' },
  take: 10
})
console.log('Total files:', await prisma.file.count())
console.log('\nRecent files:')
console.log(JSON.stringify(files, null, 2))
await prisma.$disconnect()
