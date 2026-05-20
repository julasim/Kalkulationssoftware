import type { FastifyInstance } from 'fastify'
import healthRoutes from './health.js'

// Alle API-Routen werden unter dem /api-Prefix registriert (siehe app.ts).
// Weitere Routen-Module hier ergänzen (auth, projekte, lvs, katalog, ...).
export default async function routes(app: FastifyInstance) {
  await app.register(healthRoutes)
}
