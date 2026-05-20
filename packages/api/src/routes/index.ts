import type { FastifyInstance } from 'fastify'
import healthRoutes from './health.js'
import authRoutes from './auth.js'
import katalogRoutes from './katalog.js'

// Alle API-Routen werden unter dem /api-Prefix registriert (siehe app.ts).
// Weitere Routen-Module hier ergänzen (projekte, lvs, katalog, ...).
export default async function routes(app: FastifyInstance) {
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(katalogRoutes)
}
