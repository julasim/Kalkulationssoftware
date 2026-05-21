import type { FastifyInstance } from 'fastify'

const TYP_ENUM = ['normal', 'alternativ', 'eventualposition', 'pauschale'] as const

export default async function lvRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // Vollständiges LV mit Titeln (inkl. parentId für die 2-Ebenen-Hierarchie),
  // Positionen (inkl. entfaellt) und Preisen.
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
              include: { kalkulation: { select: { einheitspreis: true, gesamtpreis: true } } },
            },
          },
        },
      },
    })
    if (!lv) return reply.code(404).send({ error: 'LV nicht gefunden', code: 'NOT_FOUND' })
    return lv
  })

  app.put(
    '/lvs/:id',
    { schema: { body: { type: 'object', properties: { bezeichnung: { type: 'string' }, notiz: { type: ['string', 'null'] } } } } },
    async (request, reply) => {
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
      } catch (err) {
        if ((err as { code?: string }).code === 'P2025') {
          return reply.code(404).send({ error: 'LV nicht gefunden', code: 'NOT_FOUND' })
        }
        throw err
      }
    },
  )

  // ─── Titel ────────────────────────────────────────────────────────────────
  app.post(
    '/lvs/:id/titel',
    {
      schema: {
        body: {
          type: 'object',
          required: ['bezeichnung'],
          properties: {
            bezeichnung: { type: 'string', minLength: 1 },
            nummer: { type: 'string' },
            parentId: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as { nummer?: string; bezeichnung?: string; parentId?: string | null }
      const bezeichnung = body?.bezeichnung?.trim()
      if (!bezeichnung) return reply.code(400).send({ error: 'Bezeichnung erforderlich', code: 'BAD_REQUEST' })

      // 2-Ebenen-Guard: Untertitel nur unter einem Top-Titel.
      if (body.parentId) {
        const parent = await app.prisma.lVTitel.findUnique({ where: { id: body.parentId }, select: { parentId: true } })
        if (!parent) return reply.code(404).send({ error: 'Übertitel nicht gefunden', code: 'NOT_FOUND' })
        if (parent.parentId !== null) return reply.code(400).send({ error: 'Maximal zwei Ebenen erlaubt', code: 'BAD_REQUEST' })
      }

      const last = await app.prisma.lVTitel.findFirst({ where: { lvId: id }, orderBy: { reihenfolge: 'desc' }, select: { reihenfolge: true } })
      const reihenfolge = (last?.reihenfolge ?? 0) + 1
      const titel = await app.prisma.lVTitel.create({
        data: {
          lvId: id,
          bezeichnung,
          nummer: body.nummer?.trim() || String(reihenfolge).padStart(2, '0'),
          parentId: body.parentId || null,
          reihenfolge,
        },
      })
      return reply.code(201).send(titel)
    },
  )

  app.patch(
    '/titel/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            bezeichnung: { type: 'string' },
            nummer: { type: 'string' },
            reihenfolge: { type: 'number' },
            parentId: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as { bezeichnung?: string; nummer?: string; reihenfolge?: number; parentId?: string | null }

      if (body.parentId !== undefined && body.parentId !== null) {
        if (body.parentId === id) return reply.code(400).send({ error: 'Titel kann nicht sein eigener Übertitel sein', code: 'BAD_REQUEST' })
        const self = await app.prisma.lVTitel.findUnique({ where: { id }, select: { lvId: true } })
        if (!self) return reply.code(404).send({ error: 'Titel nicht gefunden', code: 'NOT_FOUND' })
        const parent = await app.prisma.lVTitel.findUnique({ where: { id: body.parentId }, select: { parentId: true, lvId: true } })
        if (!parent) return reply.code(404).send({ error: 'Übertitel nicht gefunden', code: 'NOT_FOUND' })
        if (parent.lvId !== self.lvId) return reply.code(400).send({ error: 'Übertitel gehört nicht zu diesem LV', code: 'BAD_REQUEST' })
        if (parent.parentId !== null) return reply.code(400).send({ error: 'Maximal zwei Ebenen erlaubt', code: 'BAD_REQUEST' })
        const hatKinder = await app.prisma.lVTitel.count({ where: { parentId: id } })
        if (hatKinder > 0) return reply.code(400).send({ error: 'Titel mit Untertiteln kann nicht eingerückt werden', code: 'BAD_REQUEST' })
      }

      try {
        const titel = await app.prisma.lVTitel.update({
          where: { id },
          data: {
            ...(body.bezeichnung !== undefined ? { bezeichnung: body.bezeichnung.trim() } : {}),
            ...(body.nummer !== undefined ? { nummer: body.nummer.trim() } : {}),
            ...(body.reihenfolge !== undefined ? { reihenfolge: body.reihenfolge } : {}),
            ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
          },
        })
        return titel
      } catch (err) {
        if ((err as { code?: string }).code === 'P2025') {
          return reply.code(404).send({ error: 'Titel nicht gefunden', code: 'NOT_FOUND' })
        }
        throw err
      }
    },
  )

  // Hoch/Runter: tauscht reihenfolge mit dem Nachbarn auf gleicher Ebene.
  app.patch(
    '/titel/:id/reihenfolge',
    { schema: { body: { type: 'object', required: ['richtung'], properties: { richtung: { type: 'string', enum: ['hoch', 'runter'] } } } } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { richtung } = request.body as { richtung: 'hoch' | 'runter' }
      const t = await app.prisma.lVTitel.findUnique({ where: { id } })
      if (!t) return reply.code(404).send({ error: 'Titel nicht gefunden', code: 'NOT_FOUND' })
      const nachbar = await app.prisma.lVTitel.findFirst({
        where: { lvId: t.lvId, parentId: t.parentId, reihenfolge: richtung === 'hoch' ? { lt: t.reihenfolge } : { gt: t.reihenfolge } },
        orderBy: { reihenfolge: richtung === 'hoch' ? 'desc' : 'asc' },
      })
      if (!nachbar) return reply.code(204).send()
      await app.prisma.$transaction([
        app.prisma.lVTitel.update({ where: { id: t.id }, data: { reihenfolge: nachbar.reihenfolge } }),
        app.prisma.lVTitel.update({ where: { id: nachbar.id }, data: { reihenfolge: t.reihenfolge } }),
      ])
      return reply.code(204).send()
    },
  )

  // Löscht Titel inkl. Untertitel (deren Positionen folgen per FK-Cascade).
  app.delete('/titel/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await app.prisma.$transaction(async (tx) => {
        await tx.lVTitel.deleteMany({ where: { parentId: id } })
        await tx.lVTitel.delete({ where: { id } })
      })
      return reply.code(204).send()
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        return reply.code(404).send({ error: 'Titel nicht gefunden', code: 'NOT_FOUND' })
      }
      throw err
    }
  })

  // ─── Positionen ───────────────────────────────────────────────────────────
  app.post(
    '/lvs/:id/positionen',
    {
      schema: {
        body: {
          type: 'object',
          required: ['titelId'],
          properties: {
            titelId: { type: 'string' },
            katalogPosId: { type: ['string', 'null'] },
            nummer: { type: 'string' },
            kurztext: { type: 'string' },
            langtext: { type: ['string', 'null'] },
            einheit: { type: 'string' },
            menge: { type: 'number' },
            typ: { type: 'string', enum: TYP_ENUM },
          },
        },
      },
    },
    async (request, reply) => {
      const { id: lvId } = request.params as { id: string }
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
      if (titel.lvId !== lvId) return reply.code(400).send({ error: 'Titel gehört nicht zu diesem LV', code: 'BAD_REQUEST' })

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

      const last = await app.prisma.position.findFirst({ where: { titelId: body.titelId }, orderBy: { reihenfolge: 'desc' }, select: { reihenfolge: true } })
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
    },
  )

  app.put(
    '/positionen/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            nummer: { type: 'string' },
            kurztext: { type: 'string' },
            langtext: { type: ['string', 'null'] },
            einheit: { type: 'string' },
            menge: { type: 'number' },
            typ: { type: 'string', enum: TYP_ENUM },
            entfaellt: { type: 'boolean' },
            reihenfolge: { type: 'number' },
            titelId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        nummer?: string; kurztext?: string; langtext?: string | null
        einheit?: string; menge?: number; typ?: string; entfaellt?: boolean
        reihenfolge?: number; titelId?: string
      }

      // Verschieben in anderen Titel → ans Ende des Ziels (nur innerhalb desselben LV).
      let moveData: { titelId?: string; reihenfolge?: number } = {}
      if (body.titelId !== undefined) {
        const aktuell = await app.prisma.position.findUnique({ where: { id }, select: { titel: { select: { lvId: true } } } })
        if (!aktuell) return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })
        const ziel = await app.prisma.lVTitel.findUnique({ where: { id: body.titelId }, select: { lvId: true } })
        if (!ziel) return reply.code(404).send({ error: 'Ziel-Titel nicht gefunden', code: 'NOT_FOUND' })
        if (ziel.lvId !== aktuell.titel.lvId) return reply.code(400).send({ error: 'Ziel-Titel gehört nicht zu diesem LV', code: 'BAD_REQUEST' })
        const last = await app.prisma.position.findFirst({ where: { titelId: body.titelId }, orderBy: { reihenfolge: 'desc' }, select: { reihenfolge: true } })
        moveData = { titelId: body.titelId, reihenfolge: (last?.reihenfolge ?? 0) + 1 }
      }

      try {
        // Bei Mengenänderung wird der gespeicherte Gesamtpreis nachgezogen (wenn EP
        // existiert) — Positions- und Kalkulations-Update laufen dann atomar.
        const kalkulation = body.menge !== undefined
          ? await app.prisma.kalkulation.findUnique({ where: { positionId: id }, select: { einheitspreis: true } })
          : null

        const positionUpdate = app.prisma.position.update({
          where: { id },
          data: {
            ...(body.nummer !== undefined ? { nummer: body.nummer.trim() } : {}),
            ...(body.kurztext !== undefined ? { kurztext: body.kurztext.trim() } : {}),
            ...(body.langtext !== undefined ? { langtext: body.langtext } : {}),
            ...(body.einheit !== undefined ? { einheit: body.einheit.trim() } : {}),
            ...(body.menge !== undefined ? { menge: body.menge } : {}),
            ...(body.typ !== undefined ? { typ: body.typ as any } : {}),
            ...(body.entfaellt !== undefined ? { entfaellt: body.entfaellt } : {}),
            ...(body.reihenfolge !== undefined ? { reihenfolge: body.reihenfolge } : {}),
            ...moveData,
          },
        })

        if (body.menge !== undefined && kalkulation?.einheitspreis != null) {
          const gesamtpreis = Math.round(Number(kalkulation.einheitspreis) * body.menge * 100) / 100
          const [position] = await app.prisma.$transaction([
            positionUpdate,
            app.prisma.kalkulation.update({ where: { positionId: id }, data: { gesamtpreis } }),
          ])
          return position
        }

        return await positionUpdate
      } catch (err) {
        if ((err as { code?: string }).code === 'P2025') {
          return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })
        }
        throw err
      }
    },
  )

  app.patch(
    '/positionen/:id/reihenfolge',
    { schema: { body: { type: 'object', required: ['richtung'], properties: { richtung: { type: 'string', enum: ['hoch', 'runter'] } } } } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { richtung } = request.body as { richtung: 'hoch' | 'runter' }
      const p = await app.prisma.position.findUnique({ where: { id } })
      if (!p) return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })
      const nachbar = await app.prisma.position.findFirst({
        where: { titelId: p.titelId, reihenfolge: richtung === 'hoch' ? { lt: p.reihenfolge } : { gt: p.reihenfolge } },
        orderBy: { reihenfolge: richtung === 'hoch' ? 'desc' : 'asc' },
      })
      if (!nachbar) return reply.code(204).send()
      await app.prisma.$transaction([
        app.prisma.position.update({ where: { id: p.id }, data: { reihenfolge: nachbar.reihenfolge } }),
        app.prisma.position.update({ where: { id: nachbar.id }, data: { reihenfolge: p.reihenfolge } }),
      ])
      return reply.code(204).send()
    },
  )

  app.delete('/positionen/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await app.prisma.position.delete({ where: { id } })
      return reply.code(204).send()
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })
      }
      throw err
    }
  })

  // ─── Ordnungszahlen neu vergeben (Titel/Untertitel/Positionen nach Baum + reihenfolge) ───
  app.post('/lvs/:id/ordnungszahlen', async (request, reply) => {
    const { id } = request.params as { id: string }
    const lv = await app.prisma.lV.findUnique({ where: { id }, select: { id: true } })
    if (!lv) return reply.code(404).send({ error: 'LV nicht gefunden', code: 'NOT_FOUND' })

    const titel = await app.prisma.lVTitel.findMany({
      where: { lvId: id },
      orderBy: { reihenfolge: 'asc' },
      include: { positionen: { orderBy: { reihenfolge: 'asc' }, select: { id: true } } },
    })

    const pad = (n: number) => String(n).padStart(2, '0')
    const updates: any[] = []
    const tops = titel.filter((t) => t.parentId == null)
    tops.forEach((top, ti) => {
      const topNr = pad(ti + 1)
      updates.push(app.prisma.lVTitel.update({ where: { id: top.id }, data: { nummer: topNr } }))
      top.positionen.forEach((p, pi) =>
        updates.push(app.prisma.position.update({ where: { id: p.id }, data: { nummer: `${topNr}.${pad(pi + 1)}` } })),
      )
      const kinder = titel.filter((t) => t.parentId === top.id)
      kinder.forEach((sub, si) => {
        const subNr = `${topNr}.${pad(si + 1)}`
        updates.push(app.prisma.lVTitel.update({ where: { id: sub.id }, data: { nummer: subNr } }))
        sub.positionen.forEach((p, pi) =>
          updates.push(app.prisma.position.update({ where: { id: p.id }, data: { nummer: `${subNr}.${pad(pi + 1)}` } })),
        )
      })
    })

    if (updates.length) await app.prisma.$transaction(updates)
    return reply.code(204).send()
  })
}
