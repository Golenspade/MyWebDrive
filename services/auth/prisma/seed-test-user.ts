import { PrismaClient } from '../prisma/client/index.js'
import bcrypt from 'bcryptjs'

async function main() {
  const prisma = new PrismaClient()
  try {
    const email = process.env.TEST_USER_EMAIL || 'testuser@example.com'
    const password = process.env.TEST_USER_PASSWORD || 'password123'
    const name = process.env.TEST_USER_NAME || 'Test User'

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      console.log(`[seed-test-user] user already exists: ${email}`)
      return
    }
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hash, role: 'user' },
    })
    console.log(`[seed-test-user] created test user: ${user.email}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('[seed-test-user] failed:', e)
  process.exit(1)
})

