import { PrismaClient } from '../prisma/client/index.js'
import bcrypt from 'bcryptjs'

async function main() {
  const prisma = new PrismaClient()
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@local'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456'
    const requireInvite = (process.env.REGISTRATION_REQUIRE_INVITE || 'false').toLowerCase() === 'true'

    let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
    if (!admin) {
      const hash = await bcrypt.hash(adminPassword, 10)
      admin = await prisma.user.create({
        data: {
          name: 'Administrator',
          email: adminEmail,
          password: hash,
          role: 'admin'
        },
      })
      // eslint-disable-next-line no-console
      console.log(`[seed] created admin user: ${admin.email}`)
    } else {
      // eslint-disable-next-line no-console
      console.log('[seed] admin user already exists, skipping')
    }

    if (requireInvite) {
      const existing = await prisma.invitationCode.findFirst({ where: { issuedBy: admin.id, isActive: true } })
      if (!existing) {
        const code = `INV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
        await prisma.invitationCode.create({
          data: {
            code,
            issuedBy: admin.id,
            expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            usageLimit: parseInt(process.env.INVITE_DEFAULT_USAGE_LIMIT || '10', 10),
            usedCount: 0,
            isActive: true,
            notes: 'Seeded default invitation',
          },
        })
        // eslint-disable-next-line no-console
        console.log(`[seed] created invitation code: ${code}`)
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', e)
  process.exit(1)
})

