import type { PrismaClient, Leistungsbuch } from '@prisma/client'
import type { KatalogRow, ParsedOnlb } from './onlb-parser.js'

/**
 * Legt das Leistungsbuch an bzw. aktualisiert es (idempotent über kennung+versionsnummer).
 * Gleiche Kennung+Version eines Re-Uploads aktualisiert die Metadaten statt zu duplizieren.
 */
export async function upsertLeistungsbuch(
  prisma: PrismaClient,
  parsed: ParsedOnlb,
  dateiname?: string,
): Promise<Leistungsbuch> {
  const meta = {
    bezeichnung: parsed.bezeichnung,
    versionsdatum: parsed.versionsdatum,
    herausgeber: parsed.herausgeber,
    typ: 'oenorm' as const,
    ...(dateiname ? { dateiname } : {}),
  }
  return prisma.leistungsbuch.upsert({
    where: { kennung_versionsnummer: { kennung: parsed.kennung, versionsnummer: parsed.versionsnummer } },
    update: meta,
    create: { kennung: parsed.kennung, versionsnummer: parsed.versionsnummer, ...meta },
  })
}

/**
 * Schreibt die Positionen eines Leistungsbuchs idempotent (Upsert auf
 * (leistungsbuchId, posNummer)) in Batches und entfernt anschließend veraltete
 * Positionen desselben Buchs. `onProgress` wird nach jedem Batch aufgerufen.
 */
export async function writePositions(
  prisma: PrismaClient,
  leistungsbuchId: string,
  rows: KatalogRow[],
  onProgress?: (processed: number) => void | Promise<void>,
): Promise<{ written: number; deleted: number }> {
  const CHUNK = 500
  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    await Promise.all(
      batch.map((row) => {
        const { posNummer: _p, ...update } = row
        return prisma.katalogPosition.upsert({
          where: { leistungsbuchId_posNummer: { leistungsbuchId, posNummer: row.posNummer } },
          create: { ...row, leistungsbuchId },
          update,
        })
      }),
    )
    written += batch.length
    if (onProgress) await onProgress(written)
  }

  // Veraltete Positionen dieses Buchs entfernen (scoped auf leistungsbuchId).
  const allePosNummern = rows.map((r) => r.posNummer)
  const del = await prisma.katalogPosition.deleteMany({
    where: { leistungsbuchId, posNummer: { notIn: allePosNummern } },
  })
  return { written, deleted: del.count }
}
