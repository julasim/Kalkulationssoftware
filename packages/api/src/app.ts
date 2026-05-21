import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import multipart from '@fastify/multipart'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import prismaPlugin from './plugins/prisma.js'
import authPlugin from './plugins/auth.js'
import routes from './routes/index.js'

export async function buildApp() {
  const app = Fastify({ logger: true })

  // CORS nur relevant, wenn Frontend getrennt läuft (Dev über Vite-Proxy = same origin).
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  })

  await app.register(prismaPlugin)
  await app.register(authPlugin)

  // Datei-Uploads (ONLB-Import) — eigenes Limit, unabhängig vom JSON-Body-Limit.
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } })

  // API unter /api
  await app.register(routes, { prefix: '/api' })

  // Zentrale Fehlerbehandlung im einheitlichen { error, code }-Format. Prisma
  // "Datensatz nicht gefunden" (P2025) → 404, Schema-Validierung → 400, sonst 500.
  // Verhindert, dass durchgereichte Fehler ein uneinheitliches Format bekommen.
  app.setErrorHandler((error, request, reply) => {
    if ((error as { validation?: unknown }).validation) {
      return reply.code(400).send({ error: error.message, code: 'BAD_REQUEST' })
    }
    if ((error as { code?: string }).code === 'P2025') {
      return reply.code(404).send({ error: 'Nicht gefunden', code: 'NOT_FOUND' })
    }
    const status = typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500
    if (status >= 500) request.log.error(error)
    return reply.code(status).send({
      error: status >= 500 ? 'Interner Serverfehler' : error.message,
      code: status >= 500 ? 'INTERNAL_ERROR' : 'ERROR',
    })
  })

  // In Produktion das gebaute Web-SPA ausliefern (gleiche Origin).
  // dist-Pfad relativ zu dieser kompilierten Datei (packages/api/dist/app.js).
  const spaDir = fileURLToPath(new URL('../../desktop/dist', import.meta.url))
  if (existsSync(spaDir)) {
    await app.register(fastifyStatic, { root: spaDir })
    // SPA-Fallback: nur GET/HEAD auf Nicht-/api-Routen liefern index.html.
    app.setNotFoundHandler((request, reply) => {
      const isGetLike = request.method === 'GET' || request.method === 'HEAD'
      if (request.raw.url?.startsWith('/api') || !isGetLike) {
        return reply.code(404).send({ error: 'Nicht gefunden', code: 'NOT_FOUND' })
      }
      return reply.sendFile('index.html')
    })
  } else {
    app.log.warn(`SPA-Verzeichnis nicht gefunden (${spaDir}) — nur API aktiv.`)
  }

  // Recovery: beim Neustart hängengebliebene Import-Jobs als Fehler markieren.
  await app.prisma.importJob.updateMany({
    where: { status: 'running' },
    data: { status: 'error', message: 'Import durch Neustart abgebrochen' },
  })

  return app
}
