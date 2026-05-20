import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import type { JwtUser } from '../plugins/auth.js'

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { email?: string; password?: string }
    const email = body?.email?.trim().toLowerCase()
    const password = body?.password

    if (!email || !password) {
      return reply.code(400).send({ error: 'E-Mail und Passwort erforderlich', code: 'BAD_REQUEST' })
    }

    const user = await app.prisma.user.findUnique({ where: { email } })
    // Auch bei unbekanntem User hashen, um Timing-Unterschiede zu vermeiden.
    const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
    const ok = await bcrypt.compare(password, hash)

    if (!user || !ok) {
      return reply.code(401).send({ error: 'Ungültige Anmeldedaten', code: 'INVALID_CREDENTIALS' })
    }

    const payload: JwtUser = { id: user.id, email: user.email, role: user.role }
    const token = app.jwt.sign(payload, { expiresIn: '12h' })

    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  })

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (request) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, email: true, name: true, role: true },
    })
    return { user }
  })

  // JWT ist zustandslos — Logout passiert clientseitig (Token verwerfen).
  app.post('/auth/logout', async () => ({ ok: true }))
}
