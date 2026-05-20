import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'julius@sima.or.at'
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123'
  const name = process.env.SEED_ADMIN_NAME ?? 'Julius Sima'

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, role: 'admin' },
  })

  console.log(`Seed: Admin-User '${email}' bereit.`)
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`  Standard-Passwort: '${password}' — bitte nach erstem Login ändern.`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
