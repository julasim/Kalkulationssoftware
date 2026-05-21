import type { FastifyInstance } from 'fastify'
import { parse } from '../services/onlb-parser.js'
import { upsertLeistungsbuch } from '../services/leistungsbuch-import.js'
import { startImportJob } from '../services/import-runner.js'

export default async function leistungsbuecherRoutes(app: FastifyInstance) {
  // Liste aller Leistungsbücher (mit Positionsanzahl).
  app.get('/leistungsbuecher', { onRequest: [app.authenticate] }, async () => {
    const leistungsbuecher = await app.prisma.leistungsbuch.findMany({
      orderBy: [{ kennung: 'asc' }, { versionsnummer: 'desc' }],
      include: { _count: { select: { positionen: true } } },
    })
    return { leistungsbuecher }
  })

  // Status eines Import-Jobs (Polling vom Frontend).
  app.get('/leistungsbuecher/imports/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const job = await app.prisma.importJob.findUnique({ where: { id } })
    if (!job) return reply.code(404).send({ error: 'Import nicht gefunden', code: 'NOT_FOUND' })
    return {
      status: job.status,
      processed: job.processed,
      total: job.total,
      message: job.message,
      leistungsbuchId: job.leistungsbuchId,
    }
  })

  // Upload + Import einer ONLB-Datei (Hintergrund-Job). Nur Admin.
  app.post('/leistungsbuecher/import', { onRequest: [app.requireAdmin] }, async (request, reply) => {
    let data
    try {
      data = await request.file()
    } catch {
      return reply.code(400).send({ error: 'Datei-Upload fehlgeschlagen', code: 'UPLOAD_FAILED' })
    }
    if (!data) return reply.code(400).send({ error: 'Keine Datei erhalten', code: 'NO_FILE' })

    let xml: string
    try {
      const buf = await data.toBuffer()
      xml = buf.toString('utf-8')
    } catch {
      return reply.code(400).send({ error: 'Datei zu groß oder unlesbar (max. 25 MB)', code: 'FILE_TOO_LARGE' })
    }

    let parsed
    try {
      parsed = parse(xml)
    } catch (e) {
      return reply.code(400).send({
        error: e instanceof Error ? e.message : 'Ungültige ONLB-Datei',
        code: 'INVALID_ONLB',
      })
    }

    // Lieferte der Parser keine Positionen, ist die Datei strukturell unbrauchbar —
    // ablehnen, bevor ein leeres Leistungsbuch angelegt und ein Job gestartet wird.
    if (parsed.rows.length === 0) {
      return reply.code(400).send({
        error: 'Keine Positionen in der ONLB-Datei gefunden — bitte Datei prüfen.',
        code: 'EMPTY_ONLB',
      })
    }

    const lb = await upsertLeistungsbuch(app.prisma, parsed, data.filename)
    const job = await app.prisma.importJob.create({
      data: {
        leistungsbuchId: lb.id,
        dateiname: data.filename || 'upload.onlb',
        status: 'pending',
        total: parsed.rows.length,
      },
    })
    startImportJob(app.prisma, job.id, lb.id, parsed.rows)
    return reply.code(202).send({ jobId: job.id, leistungsbuchId: lb.id, bezeichnung: lb.bezeichnung, total: parsed.rows.length })
  })

  // Bearbeiten (aktiv/inaktiv schalten, umbenennen). Nur Admin.
  app.patch(
    '/leistungsbuecher/:id',
    {
      onRequest: [app.requireAdmin],
      schema: {
        body: {
          type: 'object',
          properties: { aktiv: { type: 'boolean' }, bezeichnung: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as { aktiv?: boolean; bezeichnung?: string }
      try {
        const lb = await app.prisma.leistungsbuch.update({
          where: { id },
          data: {
            ...(body.aktiv !== undefined ? { aktiv: body.aktiv } : {}),
            ...(body.bezeichnung !== undefined ? { bezeichnung: body.bezeichnung.trim() } : {}),
          },
        })
        return lb
      } catch (err) {
        if ((err as { code?: string }).code === 'P2025') {
          return reply.code(404).send({ error: 'Leistungsbuch nicht gefunden', code: 'NOT_FOUND' })
        }
        throw err
      }
    },
  )

  // Löschen (Positionen werden per Cascade entfernt; LV-Bezüge -> NULL). Nur Admin.
  app.delete('/leistungsbuecher/:id', { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await app.prisma.leistungsbuch.delete({ where: { id } })
      return reply.code(204).send()
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') {
        return reply.code(404).send({ error: 'Leistungsbuch nicht gefunden', code: 'NOT_FOUND' })
      }
      throw err
    }
  })
}
