import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { XMLParser } from 'fast-xml-parser'

const prisma = new PrismaClient()

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set(['p', 'br', 'sup', 'sub', 'b', 'i', 'u', 'ul', 'li'])

/** Bereinigt ÖNORM-Langtext-Markup auf ein sicheres Light-HTML-Subset. */
function sanitizeHtml(raw: unknown): string | null {
  if (raw == null) return null
  let s = String(raw)
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g, (_m, tag: string, selfSlash: string) => {
    const t = tag.toLowerCase()
    if (!ALLOWED_TAGS.has(t)) return ''
    if (t === 'br') return '<br/>'
    const isClosing = _m.startsWith('</')
    if (isClosing) return `</${t}>`
    return selfSlash ? `<${t}/>` : `<${t}>`
  })
  s = s.replace(/[ \t]+\n/g, '\n').trim()
  return s || null
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#160;': ' ', '&nbsp;': ' ',
}

/** Macht aus (ggf. markiertem) Inhalt reinen, einzeiligen Text. */
function toPlain(raw: unknown): string {
  if (raw == null) return ''
  let s = String(raw).replace(/<[^>]+>/g, ' ')
  for (const [ent, ch] of Object.entries(ENTITIES)) s = s.split(ent).join(ch)
  return s.replace(/\s+/g, ' ').trim()
}

function arrayify<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

// ─── Parser ─────────────────────────────────────────────────────────────────

interface KatalogRow {
  lbNummer: string
  posNummer: string
  kurztext: string
  langtext: string | null
  grundtextLang: string | null
  einheit: string
  quelle: string
  tags: string[]
  lgNr: string
  ulgNr: string
  gtNr: string
  ftNr: string | null
  lgBezeichnung: string
  ulgBezeichnung: string
}

function kurztextOf(pe: any): string {
  return (
    toPlain(pe?.stichwort) ||
    toPlain(pe?.['stichwort-kurz']) ||
    toPlain(pe?.['stichwort-luecke']) ||
    '(ohne Kurztext)'
  )
}

function parse(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    // Langtext/Stichwort/Überschrift als rohen Inhalt behalten, damit wir das
    // Markup selbst kontrolliert weiterverarbeiten können.
    stopNodes: ['*.langtext', '*.stichwort', '*.stichwort-kurz', '*.stichwort-luecke', '*.ueberschrift'],
    processEntities: false,
    trimValues: true,
  })
  const doc = parser.parse(xml)
  const onlb = doc.onlb
  if (!onlb) throw new Error('Kein <onlb>-Wurzelelement gefunden — ist das eine A2063-ONLB-Datei?')

  const kenn = onlb.lbkenndaten ?? {}
  const lbkennung = toPlain(kenn.lbkennung) || 'HB'
  const version = toPlain(kenn.versionsnummer) || '?'
  const quelle = `LB-${lbkennung}`
  const lbNummer = `${quelle} ${version}`

  const rows: KatalogRow[] = []

  for (const lg of arrayify<any>(onlb['lg-liste']?.lg)) {
    const lgNr = String(lg['@_nr'] ?? '').trim()
    const lgBez = toPlain(lg['lg-eigenschaften']?.ueberschrift)

    for (const ulg of arrayify<any>(lg['ulg-liste']?.ulg)) {
      const ulgNr = String(ulg['@_nr'] ?? '').trim()
      const ulgBez = toPlain(ulg['ulg-eigenschaften']?.ueberschrift)
      const positionen = ulg.positionen
      if (!positionen) continue

      for (const gtn of arrayify<any>(positionen.grundtextnr)) {
        const gtNr = String(gtn['@_nr'] ?? '').trim()
        const grundtextLang = sanitizeHtml(gtn.grundtext?.langtext)

        // Variante A: Grundtext + Folgepositionen
        for (const fp of arrayify<any>(gtn.folgeposition)) {
          const ftNr = String(fp['@_ftnr'] ?? '').trim()
          const pe = fp['pos-eigenschaften'] ?? {}
          rows.push({
            lbNummer, quelle, tags: [],
            posNummer: `${lgNr}${ulgNr}${gtNr}${ftNr}`,
            kurztext: kurztextOf(pe),
            langtext: sanitizeHtml(pe.langtext),
            grundtextLang,
            einheit: toPlain(pe.einheit),
            lgNr, ulgNr, gtNr, ftNr,
            lgBezeichnung: lgBez, ulgBezeichnung: ulgBez,
          })
        }

        // Variante B: ungeteilte Position (vollständig, ohne Folgekennung)
        for (const up of arrayify<any>(gtn.ungeteilteposition)) {
          const pe = up['pos-eigenschaften'] ?? {}
          rows.push({
            lbNummer, quelle, tags: [],
            posNummer: `${lgNr}${ulgNr}${gtNr}`,
            kurztext: kurztextOf(pe),
            langtext: sanitizeHtml(pe.langtext),
            grundtextLang: null,
            einheit: toPlain(pe.einheit),
            lgNr, ulgNr, gtNr, ftNr: null,
            lgBezeichnung: lgBez, ulgBezeichnung: ulgBez,
          })
        }
      }
    }
  }

  return { quelle, lbNummer, rows }
}

// ─── Import ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--dry')
  const dry = process.argv.includes('--dry')
  const file = args[0] ?? '../../Test Daten/LB-HB-023-2021.onlb'
  console.log(`Lese ONLB: ${file}`)
  const xml = readFileSync(file, 'utf-8')

  const { quelle, lbNummer, rows } = parse(xml)
  console.log(`Geparst: ${rows.length} Positionen (${lbNummer}).`)

  if (dry) {
    const withFt = rows.filter((r) => r.ftNr).length
    const ungeteilt = rows.length - withFt
    const ohneEinheit = rows.filter((r) => !r.einheit).length
    const ohneKurztext = rows.filter((r) => r.kurztext === '(ohne Kurztext)').length
    const dupes = rows.length - new Set(rows.map((r) => r.posNummer)).size
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

  // Idempotent: bestehende Positionen dieser Quelle ersetzen.
  const del = await prisma.katalogPosition.deleteMany({ where: { quelle } })
  if (del.count) console.log(`Bestehende ${del.count} Positionen der Quelle '${quelle}' entfernt.`)

  const CHUNK = 1000
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const res = await prisma.katalogPosition.createMany({ data: batch, skipDuplicates: true })
    inserted += res.count
    process.stdout.write(`\r  importiert: ${inserted}/${rows.length}`)
  }
  console.log(`\nFertig. ${inserted} Katalogpositionen aus '${lbNummer}' importiert.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('\nImport fehlgeschlagen:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
