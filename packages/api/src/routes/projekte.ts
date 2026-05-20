import type { FastifyInstance } from 'fastify'

export default async function projekteRoutes(app: FastifyInstance) {
  // Alle Routen hier erfordern Authentifizierung.
  app.addHook('onRequest', app.authenticate)

  app.get('/projekte', async () => {
    const projekte = await app.prisma.projekt.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { lvs: true } } },
    })
    return { projekte }
  })

  app.post('/projekte', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          beschreibung: { type: ['string', 'null'] },
          ort: { type: ['string', 'null'] },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { name?: string; beschreibung?: string; ort?: string }
    const name = body?.name?.trim()
    if (!name) return reply.code(400).send({ error: 'Name erforderlich', code: 'BAD_REQUEST' })

    const projekt = await app.prisma.projekt.create({
      data: {
        name,
        beschreibung: body.beschreibung?.trim() || null,
        ort: body.ort?.trim() || null,
        userId: request.user.id,
      },
    })
    return reply.code(201).send(projekt)
  })

  app.get('/projekte/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const projekt = await app.prisma.projekt.findUnique({
      where: { id },
      include: { lvs: { orderBy: [{ createdAt: 'asc' }, { version: 'desc' }] } },
    })
    if (!projekt) return reply.code(404).send({ error: 'Projekt nicht gefunden', code: 'NOT_FOUND' })
    return projekt
  })

  app.put('/projekte/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          beschreibung: { type: ['string', 'null'] },
          ort: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['offen', 'in_arbeit', 'abgeschlossen', 'archiviert'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string; beschreibung?: string | null; ort?: string | null; status?: string
    }
    const erlaubteStatus = ['offen', 'in_arbeit', 'abgeschlossen', 'archiviert']
    if (body.status !== undefined && !erlaubteStatus.includes(body.status)) {
      return reply.code(400).send({ error: 'Ungültiger Status', code: 'BAD_REQUEST' })
    }
    try {
      const projekt = await app.prisma.projekt.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.beschreibung !== undefined ? { beschreibung: body.beschreibung || null } : {}),
          ...(body.ort !== undefined ? { ort: body.ort || null } : {}),
          ...(body.status !== undefined ? { status: body.status as any } : {}),
        },
      })
      return projekt
    } catch {
      return reply.code(404).send({ error: 'Projekt nicht gefunden', code: 'NOT_FOUND' })
    }
  })

  app.delete('/projekte/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await app.prisma.projekt.delete({ where: { id } })
      return reply.code(204).send()
    } catch {
      return reply.code(404).send({ error: 'Projekt nicht gefunden', code: 'NOT_FOUND' })
    }
  })

  // ─── LVs eines Projekts ───────────────────────────────────────────────────
  app.get('/projekte/:id/lvs', async (request) => {
    const { id } = request.params as { id: string }
    const lvs = await app.prisma.lV.findMany({
      where: { projektId: id },
      orderBy: [{ createdAt: 'asc' }],
    })
    return { lvs }
  })

  app.post('/projekte/:id/lvs', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { bezeichnung?: string; notiz?: string }
    const bezeichnung = body?.bezeichnung?.trim()
    if (!bezeichnung) return reply.code(400).send({ error: 'Bezeichnung erforderlich', code: 'BAD_REQUEST' })

    const projekt = await app.prisma.projekt.findUnique({ where: { id } })
    if (!projekt) return reply.code(404).send({ error: 'Projekt nicht gefunden', code: 'NOT_FOUND' })

    const lv = await app.prisma.lV.create({
      data: { projektId: id, bezeichnung, notiz: body.notiz?.trim() || null },
    })
    return reply.code(201).send(lv)
  })
}
