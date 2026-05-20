import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parse } from '../src/services/onlb-parser.js'
import { upsertLeistungsbuch, writePositions } from '../src/services/leistungsbuch-import.js'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--dry')
  const dry = process.argv.includes('--dry')
  const file = args[0] ?? '../../Test Daten/LB-HB-023-2021.onlb'
  console.log(`Lese ONLB: ${file}`)
  const xml = readFileSync(file, 'utf-8')

  const parsed = parse(xml)
  const { rows, lbNummer, kennung, bezeichnung, versionsnummer, herausgeber } = parsed
  console.log(`Geparst: ${rows.length} Positionen (${lbNummer} — ${bezeichnung}).`)

  if (dry) {
    const withFt = rows.filter((r) => r.ftNr).length
    const ungeteilt = rows.length - withFt
    const ohneEinheit = rows.filter((r) => !r.einheit).length
    const ohneKurztext = rows.filter((r) => r.kurztext === '(ohne Kurztext)').length
    const dupes = rows.length - new Set(rows.map((r) => r.posNummer)).size
    console.log(`  Buch: kennung=${kennung} version=${versionsnummer} herausgeber=${herausgeber ?? '—'}`)
    console.log(`  Folgepositionen: ${withFt} | ungeteilt: ${ungeteilt}`)
    console.log(`  ohne Einheit: ${ohneEinheit} | ohne Kurztext: ${ohneKurztext} | doppelte posNummer: ${dupes}`)
    console.log('  Beispiele:')
    for (const r of [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]]) {
      console.log(`   ${r.posNummer.padEnd(9)} [${r.einheit || '—'}] ${r.kurztext}`)
      console.log(`      ${r.lgNr}/${r.ulgNr} ${r.lgBezeichnung} › ${r.ulgBezeichnung}`)
      console.log(`      langtext: ${(r.langtext ?? '').slice(0, 120)}`)
    }
    await prisma.$disconnect()
    return
  }

  const dateiname = statSync(file, { throwIfNoEntry: false }) ? basename(file) : undefined
  const lb = await upsertLeistungsbuch(prisma, parsed, dateiname)
  console.log(`Leistungsbuch: ${lb.bezeichnung} (${lb.kennung} ${lb.versionsnummer}) [${lb.id}]`)

  const { written, deleted } = await writePositions(prisma, lb.id, rows, (processed) => {
    process.stdout.write(`\r  geschrieben: ${processed}/${rows.length}`)
  })
  console.log(`\nFertig. ${written} Positionen geschrieben${deleted ? `, ${deleted} veraltete entfernt` : ''}.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('\nImport fehlgeschlagen:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
