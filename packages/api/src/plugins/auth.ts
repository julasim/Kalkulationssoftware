import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export interface JwtUser {
  id: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser
    user: JwtUser
  }
}

export default fp(async (app: FastifyInstance) => {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    app.log.warn('JWT_SECRET fehlt oder ist zu kurz (<32 Zeichen) — nur für Dev geeignet.')
  }

  await app.register(jwt, {
    secret: secret ?? 'dev-secret-change-in-production-min-32-chars',
  })

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'Nicht autorisiert', code: 'UNAUTHORIZED' })
    }
  })

  // Wie authenticate, verlangt zusätzlich die Admin-Rolle (für Uploads/Verwaltung).
  app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'Nicht autorisiert', code: 'UNAUTHORIZED' })
    }
    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Nur für Administratoren', code: 'FORBIDDEN' })
    }
  })
})
