import { PrismaClient } from '../prisma/client/index.js'

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: tsx scripts/delete-user.ts <email>')
    process.exit(1)
  }
  const prisma = new PrismaClient()
  try {
    await prisma.user.delete({ where: { email } })
    console.log(`[delete-user] deleted user ${email}`)
  } catch (e:any) {
    console.error('[delete-user] failed:', e?.message || e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

