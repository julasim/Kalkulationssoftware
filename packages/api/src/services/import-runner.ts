import type { PrismaClient } from '@prisma/client'
import type { KatalogRow } from './onlb-parser.js'
import { writePositions } from './leistungsbuch-import.js'

/**
 * Startet den Positions-Import als In-Process-Hintergrund-Job (fire-and-forget).
 * Der Fortschritt wird laufend in die ImportJob-Zeile geschrieben, sodass das
 * Frontend per Polling den Status abfragen kann. Bewusst NICHT awaited — die
 * Route antwortet sofort mit 202.
 */
export function startImportJob(
  prisma: PrismaClient,
  jobId: string,
  leistungsbuchId: string,
  rows: KatalogRow[],
): void {
  void (async () => {
    try {
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: 'running', total: rows.length, processed: 0 },
      })

      await writePositions(prisma, leistungsbuchId, rows, async (processed) => {
        // Fortschritt ist unkritisch — ein einzelnes fehlgeschlagenes Update darf
        // den bereits großteils erfolgten Import nicht auf "error" kippen lassen.
        try {
          await prisma.importJob.update({ where: { id: jobId }, data: { processed } })
        } catch {
          /* Fortschritts-Update ignorieren */
        }
      })

      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: 'done', processed: rows.length, finishedAt: new Date() },
      })
    } catch (e) {
      await prisma.importJob
        .update({
          where: { id: jobId },
          data: {
            status: 'error',
            message: e instanceof Error ? e.message : String(e),
            finishedAt: new Date(),
          },
        })
        .catch(() => {})
    }
  })()
}
