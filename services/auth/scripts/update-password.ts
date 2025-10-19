import { PrismaClient } from '../prisma/client/index.js'
import bcrypt from 'bcryptjs'

async function main() {
  const email = process.argv[2]
  const plain = process.argv[3]
  if (!email || !plain) {
    console.error('Usage: tsx scripts/update-password.ts <email> <newPassword>')
    process.exit(1)
  }
  const prisma = new PrismaClient()
  try {
    const hash = await bcrypt.hash(plain, 10)
    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hash },
      create: { email, name: email.split('@')[0], password: hash, role: 'user' },
    })
    console.log(`[update-password] updated user ${user.email}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

