import type { FastifyInstance } from 'fastify'
import { berechneKalkulation } from '../services/kalkulation.js'

const n = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

const ARTEN = ['lohn', 'material', 'geraet', 'sonstiges', 'nu'] as const

export default async function kalkulationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/positionen/:id/kalkulation', async (request, reply) => {
    const { id } = request.params as { id: string }
    const position = await app.prisma.position.findUnique({
      where: { id },
      include: {
        kalkulation: {
          include: { zeilen: { orderBy: { reihenfolge: 'asc' } } },
        },
      },
    })
    if (!position) return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })

    // Standard-Zuschlagsschema zur Vorbelegung neuer Kalkulationen.
    const standardSchema = await app.prisma.zuschlagsschema.findFirst({ where: { istStandard: true } })

    return {
      position: {
        id: position.id,
        nummer: position.nummer,
        kurztext: position.kurztext,
        einheit: position.einheit,
        menge: position.menge,
      },
      kalkulation: position.kalkulation, // null, falls noch nicht angelegt
      standardSchema,
    }
  })

  app.put(
    '/positionen/:id/kalkulation',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            agkProzent: { type: 'number' },
            guProzent: { type: 'number' },
            gewinnProzent: { type: 'number' },
            zeilen: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  art: { type: 'string', enum: ARTEN },
                  betriebsmittelId: { type: ['string', 'null'] },
                  bezeichnung: { type: 'string' },
                  einheit: { type: 'string' },
                  menge: { type: 'number' },
                  einzelpreis: { type: 'number' },
                  aufschlag: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as any

      const position = await app.prisma.position.findUnique({ where: { id } })
      if (!position) return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })

      const agkProzent = n(body.agkProzent ?? 5)
      const guProzent = n(body.guProzent ?? 3)
      const gewinnProzent = n(body.gewinnProzent ?? 3)

      const zeilen = (body.zeilen ?? []).map((z: any, i: number) => ({
        art: z.art,
        betriebsmittelId: z.betriebsmittelId || null,
        bezeichnung: String(z.bezeichnung ?? ''),
        einheit: String(z.einheit ?? ''),
        menge: n(z.menge),
        einzelpreis: n(z.einzelpreis),
        aufschlag: n(z.aufschlag),
        reihenfolge: i,
      }))

      const ergebnis = berechneKalkulation({
        menge: n(position.menge),
        agkProzent,
        guProzent,
        gewinnProzent,
        zeilen: zeilen.map((z: any) => ({ menge: z.menge, einzelpreis: z.einzelpreis, aufschlag: z.aufschlag })),
      })

      await app.prisma.$transaction(async (tx) => {
        const kalk = await tx.kalkulation.upsert({
          where: { positionId: id },
          create: {
            positionId: id, agkProzent, guProzent, gewinnProzent,
            einheitspreis: ergebnis.einheitspreis, gesamtpreis: ergebnis.gesamtpreis,
          },
          update: {
            agkProzent, guProzent, gewinnProzent,
            einheitspreis: ergebnis.einheitspreis, gesamtpreis: ergebnis.gesamtpreis,
          },
        })
        await tx.kalkulationszeile.deleteMany({ where: { kalkulationId: kalk.id } })
        if (zeilen.length) {
          await tx.kalkulationszeile.createMany({
            data: zeilen.map((z: any) => ({ ...z, kalkulationId: kalk.id })),
          })
        }
      })

      return { ergebnis }
    },
  )
}
