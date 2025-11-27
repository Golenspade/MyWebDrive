import { PrismaClient } from './prisma/client/index.js'
import dotenv from 'dotenv'
dotenv.config({ path: '../../.env' })

const prisma = new PrismaClient()
const users = await prisma.user.findMany({
  select: { email: true, name: true, role: true },
  orderBy: { createdAt: 'desc' },
  take: 10
})
console.log(JSON.stringify(users, null, 2))
await prisma.$disconnect()

