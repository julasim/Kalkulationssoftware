import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
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

  // API unter /api
  await app.register(routes, { prefix: '/api' })

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

  return app
}
