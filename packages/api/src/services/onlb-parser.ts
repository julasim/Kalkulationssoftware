import { XMLParser } from 'fast-xml-parser'

// ─── Light-HTML-Bereinigung ────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  'p', 'br', 'sup', 'sub', 'b', 'i', 'u', 'ul', 'li',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
])

/** Bereinigt ÖNORM-Langtext-Markup auf ein sicheres Light-HTML-Subset. */
export function sanitizeHtml(raw: unknown): string | null {
  if (raw == null) return null
  let s = String(raw)
  // <al>…</al> ist eine auszufüllende Lücke: leer → sichtbarer Platzhalter,
  // sonst der Inhalt selbst. Vor der übrigen Tag-Bereinigung ersetzen.
  s = s.replace(/<al>([\s\S]*?)<\/al>/g, (_m, inner) => (inner.trim() ? inner : '_____'))
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

// ─── Ergebnis-Typen ────────────────────────────────────────────────────────────

export interface KatalogRow {
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

export interface ParsedOnlb {
  kennung: string          // z.B. "HB"
  quelle: string           // "LB-HB"
  lbNummer: string         // "LB-HB 23"
  bezeichnung: string      // "Leistungsbeschreibung Hochbau"
  versionsnummer: string   // "23"
  versionsdatum: Date | null
  herausgeber: string | null
  rows: KatalogRow[]
}

// ─── Parser ─────────────────────────────────────────────────────────────────────

function kurztextOf(pe: any): string {
  return (
    toPlain(pe?.stichwort) ||
    toPlain(pe?.['stichwort-kurz']) ||
    toPlain(pe?.['stichwort-luecke']) ||
    '(ohne Kurztext)'
  )
}

function toDate(raw: unknown): Date | null {
  const s = toPlain(raw)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Parst eine ÖNORM A2063 `.onlb` (XML) zu Metadaten + Katalogzeilen. */
export function parse(xml: string): ParsedOnlb {
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
  const kennung = toPlain(kenn.lbkennung) || 'HB'
  const versionsnummer = toPlain(kenn.versionsnummer) || '?'
  const quelle = `LB-${kennung}`
  const lbNummer = `${quelle} ${versionsnummer}`
  const bezeichnung = toPlain(kenn.bezeichnung) || quelle
  const versionsdatum = toDate(kenn.versionsdatum)
  const herausgeber = toPlain(kenn.herausgeber?.firma?.name) || null

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

  return { kennung, quelle, lbNummer, bezeichnung, versionsnummer, versionsdatum, herausgeber, rows }
}
