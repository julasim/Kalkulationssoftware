import type { FastifyInstance } from 'fastify'

export default async function katalogRoutes(app: FastifyInstance) {
  // Volltextsuche über Kurztext, Positionsnummer und Langtext.
  app.get('/katalog/search', { onRequest: [app.authenticate] }, async (request) => {
    const { q, limit, quelle } = request.query as { q?: string; limit?: string; take?: string; quelle?: string }
    const term = (q ?? '').trim()
    const take = Math.min(Math.max(Number(limit) || 30, 1), 100)

    if (term.length < 2) {
      return { results: [], total: 0 }
    }

    const where = {
      ...(quelle ? { quelle } : {}),
      OR: [
        { kurztext: { contains: term, mode: 'insensitive' as const } },
        { posNummer: { contains: term.replace(/\s+/g, ''), mode: 'insensitive' as const } },
        { langtext: { contains: term, mode: 'insensitive' as const } },
      ],
    }

    const [results, total] = await Promise.all([
      app.prisma.katalogPosition.findMany({
        where,
        take,
        orderBy: [{ lgNr: 'asc' }, { ulgNr: 'asc' }, { gtNr: 'asc' }, { ftNr: 'asc' }],
        select: {
          id: true, posNummer: true, kurztext: true, langtext: true, grundtextLang: true,
          einheit: true, quelle: true, lbNummer: true,
          lgNr: true, ulgNr: true, lgBezeichnung: true, ulgBezeichnung: true,
        },
      }),
      app.prisma.katalogPosition.count({ where }),
    ])

    return { results, total }
  })

  // Einzelne Katalogposition (Detailansicht).
  app.get('/katalog/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const pos = await app.prisma.katalogPosition.findUnique({ where: { id } })
    if (!pos) return reply.code(404).send({ error: 'Position nicht gefunden', code: 'NOT_FOUND' })
    return pos
  })
}
