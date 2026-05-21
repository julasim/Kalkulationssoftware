import type { FastifyInstance } from 'fastify'

const ARTEN = ['lohn', 'material', 'geraet', 'sonstiges', 'nu'] as const

const betriebsmittelBody = {
  type: 'object',
  properties: {
    art: { type: 'string', enum: ARTEN },
    bezeichnung: { type: 'string', minLength: 1 },
    kennung: { type: ['string', 'null'] },
    einheit: { type: 'string', minLength: 1 },
    kostenProEinheit: { type: 'number', minimum: 0 },
    aufschlag: { type: 'number', minimum: -100 },
    gruppe: { type: ['string', 'null'] },
    notiz: { type: ['string', 'null'] },
    aktiv: { type: 'boolean' },
  },
} as const

export default async function betriebsmittelRoutes(app: FastifyInstance) {
  // ─── Betriebsmittel ─────────────────────────────────────────────────────────
  app.get(
    '/betriebsmittel',
    {
      onRequest: [app.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: { art: { type: 'string', enum: ARTEN }, aktiv: { type: 'string' } },
        },
      },
    },
    async (request) => {
      const { art, aktiv } = request.query as { art?: string; aktiv?: string }
      const betriebsmittel = await app.prisma.betriebsmittel.findMany({
        where: {
          ...(art ? { art: art as any } : {}),
          ...(aktiv !== undefined ? { aktiv: aktiv === 'true' } : {}),
        },
        orderBy: [{ art: 'asc' }, { bezeichnung: 'asc' }],
      })
      return { betriebsmittel }
    },
  )

  app.post(
    '/betriebsmittel',
    {
      onRequest: [app.requireAdmin],
      schema: { body: { ...betriebsmittelBody, required: ['art', 'bezeichnung', 'einheit', 'kostenProEinheit'] } },
    },
    async (request, reply) => {
      const b = request.body as any
      const bm = await app.prisma.betriebsmittel.create({
        data: {
          art: b.art,
          bezeichnung: String(b.bezeichnung).trim(),
          kennung: b.kennung?.trim() || null,
          einheit: String(b.einheit).trim(),
          kostenProEinheit: b.kostenProEinheit ?? 0,
          aufschlag: b.aufschlag ?? 0,
          gruppe: b.gruppe?.trim() || null,
          notiz: b.notiz?.trim() || null,
          aktiv: b.aktiv ?? true,
        },
      })
      return reply.code(201).send(bm)
    },
  )

  app.patch(
    '/betriebsmittel/:id',
    { onRequest: [app.requireAdmin], schema: { body: betriebsmittelBody } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const b = request.body as any
      try {
        const bm = await app.prisma.betriebsmittel.update({
          where: { id },
          data: {
            ...(b.art !== undefined ? { art: b.art } : {}),
            ...(b.bezeichnung !== undefined ? { bezeichnung: String(b.bezeichnung).trim() } : {}),
            ...(b.kennung !== undefined ? { kennung: b.kennung?.trim() || null } : {}),
            ...(b.einheit !== undefined ? { einheit: String(b.einheit).trim() } : {}),
            ...(b.kostenProEinheit !== undefined ? { kostenProEinheit: b.kostenProEinheit } : {}),
            ...(b.aufschlag !== undefined ? { aufschlag: b.aufschlag } : {}),
            ...(b.gruppe !== undefined ? { gruppe: b.gruppe?.trim() || null } : {}),
            ...(b.notiz !== undefined ? { notiz: b.notiz?.trim() || null } : {}),
            ...(b.aktiv !== undefined ? { aktiv: b.aktiv } : {}),
          },
        })
        return bm
      } catch (err) {
        if ((err as { code?: string }).code === 'P2025') {
          return reply.code(404).send({ error: 'Betriebsmittel nicht gefunden', code: 'NOT_FOUND' })
        }
        throw err
      }
    },
  )

  app.delete('/betriebsmittel/:id', { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await app.prisma.betriebsmittel.delete({ where: { id } })
      return reply.code(204).send()
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        return reply.code(404).send({ error: 'Betriebsmittel nicht gefunden', code: 'NOT_FOUND' })
      }
      throw err
    }
  })

  // ─── Zuschlagsschemata ────────────────────────────────────────────────────────
  const zuschlagBody = {
    type: 'object',
    properties: {
      bezeichnung: { type: 'string', minLength: 1 },
      agkProzent: { type: 'number' },
      guProzent: { type: 'number' },
      gewinnProzent: { type: 'number' },
      istStandard: { type: 'boolean' },
    },
  } as const

  app.get('/zuschlagsschemata', { onRequest: [app.authenticate] }, async () => {
    const zuschlagsschemata = await app.prisma.zuschlagsschema.findMany({
      orderBy: [{ istStandard: 'desc' }, { bezeichnung: 'asc' }],
    })
    return { zuschlagsschemata }
  })

  app.post(
    '/zuschlagsschemata',
    { onRequest: [app.requireAdmin], schema: { body: { ...zuschlagBody, required: ['bezeichnung'] } } },
    async (request, reply) => {
      const b = request.body as any
      const data = {
        bezeichnung: String(b.bezeichnung).trim(),
        agkProzent: b.agkProzent ?? 5,
        guProzent: b.guProzent ?? 3,
        gewinnProzent: b.gewinnProzent ?? 3,
        istStandard: b.istStandard ?? false,
      }
      const schema = await app.prisma.$transaction(async (tx) => {
        if (data.istStandard) await tx.zuschlagsschema.updateMany({ data: { istStandard: false } })
        return tx.zuschlagsschema.create({ data })
      })
      return reply.code(201).send(schema)
    },
  )

  app.patch(
    '/zuschlagsschemata/:id',
    { onRequest: [app.requireAdmin], schema: { body: zuschlagBody } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const b = request.body as any
      try {
        const schema = await app.prisma.$transaction(async (tx) => {
          if (b.istStandard === true) await tx.zuschlagsschema.updateMany({ data: { istStandard: false } })
          return tx.zuschlagsschema.update({
            where: { id },
            data: {
              ...(b.bezeichnung !== undefined ? { bezeichnung: String(b.bezeichnung).trim() } : {}),
              ...(b.agkProzent !== undefined ? { agkProzent: b.agkProzent } : {}),
              ...(b.guProzent !== undefined ? { guProzent: b.guProzent } : {}),
              ...(b.gewinnProzent !== undefined ? { gewinnProzent: b.gewinnProzent } : {}),
              ...(b.istStandard !== undefined ? { istStandard: b.istStandard } : {}),
            },
          })
        })
        return schema
      } catch (err) {
        if ((err as { code?: string }).code === 'P2025') {
          return reply.code(404).send({ error: 'Zuschlagsschema nicht gefunden', code: 'NOT_FOUND' })
        }
        throw err
      }
    },
  )

  app.delete('/zuschlagsschemata/:id', { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await app.prisma.zuschlagsschema.delete({ where: { id } })
      return reply.code(204).send()
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        return reply.code(404).send({ error: 'Zuschlagsschema nicht gefunden', code: 'NOT_FOUND' })
      }
      throw err
    }
  })
}
