import type { FastifyInstance } from 'fastify'
import { berechneKalkulation } from '../services/kalkulation.js'

const n = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

export default async function kalkulationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/positionen/:id/kalkulation', async (request, reply) => {
    const { id } = request.params as { id: string }
    const position = await app.prisma.position.findUnique({
      where: { id },
      include: {
        kalkulation: {
          include: {
            lohnzeilen: { orderBy: { reihenfolge: 'asc' } },
            materialzeilen: { orderBy: { reihenfolge: 'asc' } },
            geraetezeilen: { orderBy: { reihenfolge: 'asc' } },
            nuZeilen: { orderBy: { reihenfolge: 'asc' } },
            sonstigeZeilen: { orderBy: { reihenfolge: 'asc' } },
          },
        },
      },
    })
    if (!position) return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })

    return {
      position: {
        id: position.id,
        nummer: position.nummer,
        kurztext: position.kurztext,
        einheit: position.einheit,
        menge: position.menge,
      },
      kalkulation: position.kalkulation, // null, falls noch nicht angelegt
    }
  })

  app.put('/positionen/:id/kalkulation', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as any

    const position = await app.prisma.position.findUnique({ where: { id } })
    if (!position) return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })

    const agkProzent = n(body.agkProzent ?? 5)
    const guProzent = n(body.guProzent ?? 3)
    const gewinnProzent = n(body.gewinnProzent ?? 3)

    const lohnzeilen = (body.lohnzeilen ?? []).map((z: any, i: number) => ({
      bezeichnung: String(z.bezeichnung ?? ''),
      aufwandswert: n(z.aufwandswert),
      stundensatz: n(z.stundensatz),
      reihenfolge: i,
    }))
    const materialzeilen = (body.materialzeilen ?? []).map((z: any, i: number) => ({
      bezeichnung: String(z.bezeichnung ?? ''),
      menge: n(z.menge),
      einheit: String(z.einheit ?? ''),
      preis: n(z.preis),
      aufschlag: n(z.aufschlag),
      reihenfolge: i,
    }))
    const geraetezeilen = (body.geraetezeilen ?? []).map((z: any, i: number) => ({
      bezeichnung: String(z.bezeichnung ?? ''),
      menge: n(z.menge),
      einheit: String(z.einheit ?? ''),
      preis: n(z.preis),
      reihenfolge: i,
    }))
    const nuZeilen = (body.nuZeilen ?? []).map((z: any, i: number) => ({
      bezeichnung: String(z.bezeichnung ?? ''),
      betrag: n(z.betrag),
      reihenfolge: i,
    }))
    const sonstigeZeilen = (body.sonstigeZeilen ?? []).map((z: any, i: number) => ({
      bezeichnung: String(z.bezeichnung ?? ''),
      betrag: n(z.betrag),
      reihenfolge: i,
    }))

    const ergebnis = berechneKalkulation({
      menge: n(position.menge),
      agkProzent, guProzent, gewinnProzent,
      lohnzeilen, materialzeilen, geraetezeilen, nuZeilen, sonstigeZeilen,
    })

    // Kalkulation + Zeilen atomar ersetzen.
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

      await Promise.all([
        tx.kalkulationLohn.deleteMany({ where: { kalkulationId: kalk.id } }),
        tx.kalkulationMaterial.deleteMany({ where: { kalkulationId: kalk.id } }),
        tx.kalkulationGeraet.deleteMany({ where: { kalkulationId: kalk.id } }),
        tx.kalkulationNU.deleteMany({ where: { kalkulationId: kalk.id } }),
        tx.kalkulationSonstige.deleteMany({ where: { kalkulationId: kalk.id } }),
      ])

      await Promise.all([
        lohnzeilen.length && tx.kalkulationLohn.createMany({ data: lohnzeilen.map((z: any) => ({ ...z, kalkulationId: kalk.id })) }),
        materialzeilen.length && tx.kalkulationMaterial.createMany({ data: materialzeilen.map((z: any) => ({ ...z, kalkulationId: kalk.id })) }),
        geraetezeilen.length && tx.kalkulationGeraet.createMany({ data: geraetezeilen.map((z: any) => ({ ...z, kalkulationId: kalk.id })) }),
        nuZeilen.length && tx.kalkulationNU.createMany({ data: nuZeilen.map((z: any) => ({ ...z, kalkulationId: kalk.id })) }),
        sonstigeZeilen.length && tx.kalkulationSonstige.createMany({ data: sonstigeZeilen.map((z: any) => ({ ...z, kalkulationId: kalk.id })) }),
      ].filter(Boolean) as Promise<unknown>[])
    })

    return { ergebnis }
  })
}
