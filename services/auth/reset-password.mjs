import { PrismaClient } from './prisma/client/index.js'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
dotenv.config({ path: '../../.env' })

const prisma = new PrismaClient()
const email = 'tomoiri@free.com'
const newPassword = 'admin123456'

const hash = await bcrypt.hash(newPassword, 10)
await prisma.user.update({
  where: { email },
  data: { password: hash }
})

console.log(`Password reset for ${email} to: ${newPassword}`)
await prisma.$disconnect()
