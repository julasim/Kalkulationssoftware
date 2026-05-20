import type { FastifyInstance } from 'fastify'
import healthRoutes from './health.js'
import authRoutes from './auth.js'
import katalogRoutes from './katalog.js'
import leistungsbuecherRoutes from './leistungsbuecher.js'
import betriebsmittelRoutes from './betriebsmittel.js'
import projekteRoutes from './projekte.js'
import lvRoutes from './lvs.js'
import kalkulationRoutes from './kalkulation.js'

// Alle API-Routen werden unter dem /api-Prefix registriert (siehe app.ts).
// Weitere Routen-Module hier ergänzen (projekte, lvs, katalog, ...).
export default async function routes(app: FastifyInstance) {
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(katalogRoutes)
  await app.register(leistungsbuecherRoutes)
  await app.register(betriebsmittelRoutes)
  await app.register(projekteRoutes)
  await app.register(lvRoutes)
  await app.register(kalkulationRoutes)
}
