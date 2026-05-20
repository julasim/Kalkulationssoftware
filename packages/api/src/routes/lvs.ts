import type { FastifyInstance } from 'fastify'

export default async function lvRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // Vollständiges LV mit Titeln, Positionen und (sofern vorhanden) Preisen.
  app.get('/lvs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const lv = await app.prisma.lV.findUnique({
      where: { id },
      include: {
        projekt: { select: { id: true, name: true } },
        titel: {
          orderBy: { reihenfolge: 'asc' },
          include: {
            positionen: {
              orderBy: { reihenfolge: 'asc' },
              include: {
                kalkulation: { select: { einheitspreis: true, gesamtpreis: true } },
              },
            },
          },
        },
      },
    })
    if (!lv) return reply.code(404).send({ error: 'LV nicht gefunden', code: 'NOT_FOUND' })
    return lv
  })

  app.put('/lvs/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { bezeichnung?: string; notiz?: string | null }
    try {
      const lv = await app.prisma.lV.update({
        where: { id },
        data: {
          ...(body.bezeichnung !== undefined ? { bezeichnung: body.bezeichnung.trim() } : {}),
          ...(body.notiz !== undefined ? { notiz: body.notiz || null } : {}),
        },
      })
      return lv
    } catch {
      return reply.code(404).send({ error: 'LV nicht gefunden', code: 'NOT_FOUND' })
    }
  })

  // ─── Titel ────────────────────────────────────────────────────────────────
  app.post('/lvs/:id/titel', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { nummer?: string; bezeichnung?: string; parentId?: string }
    const bezeichnung = body?.bezeichnung?.trim()
    if (!bezeichnung) return reply.code(400).send({ error: 'Bezeichnung erforderlich', code: 'BAD_REQUEST' })

    const last = await app.prisma.lVTitel.findFirst({
      where: { lvId: id },
      orderBy: { reihenfolge: 'desc' },
      select: { reihenfolge: true },
    })
    const titel = await app.prisma.lVTitel.create({
      data: {
        lvId: id,
        bezeichnung,
        nummer: body.nummer?.trim() || String((last?.reihenfolge ?? 0) + 1).padStart(2, '0'),
        parentId: body.parentId || null,
        reihenfolge: (last?.reihenfolge ?? 0) + 1,
      },
    })
    return reply.code(201).send(titel)
  })

  app.delete('/titel/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await app.prisma.lVTitel.delete({ where: { id } })
      return reply.code(204).send()
    } catch {
      return reply.code(404).send({ error: 'Titel nicht gefunden', code: 'NOT_FOUND' })
    }
  })

  // ─── Positionen ───────────────────────────────────────────────────────────
  // Anlegen — optional aus einer Katalogposition übernommen.
  app.post('/lvs/:id/positionen', async (request, reply) => {
    const body = request.body as {
      titelId?: string
      katalogPosId?: string
      nummer?: string
      kurztext?: string
      langtext?: string
      einheit?: string
      menge?: number
      typ?: string
    }
    if (!body?.titelId) return reply.code(400).send({ error: 'titelId erforderlich', code: 'BAD_REQUEST' })

    const titel = await app.prisma.lVTitel.findUnique({ where: { id: body.titelId } })
    if (!titel) return reply.code(404).send({ error: 'Titel nicht gefunden', code: 'NOT_FOUND' })

    // Daten ggf. aus Katalog übernehmen
    let kurztext = body.kurztext?.trim()
    let langtext = body.langtext ?? null
    let einheit = body.einheit?.trim()
    if (body.katalogPosId) {
      const kp = await app.prisma.katalogPosition.findUnique({ where: { id: body.katalogPosId } })
      if (!kp) return reply.code(404).send({ error: 'Katalogposition nicht gefunden', code: 'NOT_FOUND' })
      kurztext ??= kp.kurztext
      langtext ??= [kp.grundtextLang, kp.langtext].filter(Boolean).join('\n') || null
      einheit ??= kp.einheit
    }
    if (!kurztext) return reply.code(400).send({ error: 'Kurztext erforderlich', code: 'BAD_REQUEST' })

    const last = await app.prisma.position.findFirst({
      where: { titelId: body.titelId },
      orderBy: { reihenfolge: 'desc' },
      select: { reihenfolge: true },
    })
    const reihenfolge = (last?.reihenfolge ?? 0) + 1

    const position = await app.prisma.position.create({
      data: {
        titelId: body.titelId,
        katalogPosId: body.katalogPosId || null,
        nummer: body.nummer?.trim() || `${titel.nummer}.${String(reihenfolge).padStart(2, '0')}`,
        kurztext,
        langtext,
        einheit: einheit || '',
        menge: body.menge ?? 0,
        typ: (body.typ as any) || 'normal',
        reihenfolge,
      },
    })
    return reply.code(201).send(position)
  })

  app.put('/positionen/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      nummer?: string; kurztext?: string; langtext?: string | null
      einheit?: string; menge?: number; typ?: string
    }
    try {
      const position = await app.prisma.position.update({
        where: { id },
        data: {
          ...(body.nummer !== undefined ? { nummer: body.nummer.trim() } : {}),
          ...(body.kurztext !== undefined ? { kurztext: body.kurztext.trim() } : {}),
          ...(body.langtext !== undefined ? { langtext: body.langtext } : {}),
          ...(body.einheit !== undefined ? { einheit: body.einheit.trim() } : {}),
          ...(body.menge !== undefined ? { menge: body.menge } : {}),
          ...(body.typ !== undefined ? { typ: body.typ as any } : {}),
        },
      })

      // Bei Mengenänderung den gespeicherten Gesamtpreis nachziehen, sofern ein EP existiert.
      if (body.menge !== undefined) {
        const kalkulation = await app.prisma.kalkulation.findUnique({
          where: { positionId: id },
          select: { einheitspreis: true },
        })
        if (kalkulation?.einheitspreis != null) {
          const gesamtpreis = Math.round(Number(kalkulation.einheitspreis) * body.menge * 100) / 100
          await app.prisma.kalkulation.update({
            where: { positionId: id },
            data: { gesamtpreis },
          })
        }
      }

      return position
    } catch {
      return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })
    }
  })

  app.delete('/positionen/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await app.prisma.position.delete({ where: { id } })
      return reply.code(204).send()
    } catch {
      return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })
    }
  })
}
