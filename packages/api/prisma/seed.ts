import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // || statt ??: ein leerer String aus der .env (SEED_ADMIN_PASSWORD=) soll auf
  // den Default zurückfallen, nicht als leeres Passwort durchgereicht werden.
  const email = process.env.SEED_ADMIN_EMAIL || 'julius@sima.or.at'
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme123'
  const name = process.env.SEED_ADMIN_NAME || 'Julius Sima'

  const passwordHash = await bcrypt.hash(password, 12)

  // Bei erneutem Seed Passwort/Name/Rolle zurücksetzen (idempotenter Admin-Bootstrap).
  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: 'admin' },
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
