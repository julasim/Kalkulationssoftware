import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const server = new McpServer({
  name: 'lv-manager',
  version: '0.1.0',
})

// ─── Tool: Alle Projekte abrufen ──────────────────────────────────────────────
server.tool(
  'get_projekte',
  'Gibt alle Projekte zurück (Name, Status, Anzahl LVs)',
  {},
  async () => {
    const projekte = await prisma.projekt.findMany({
      include: { _count: { select: { lvs: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return {
      content: [{ type: 'text', text: JSON.stringify(projekte, null, 2) }],
    }
  }
)

// ─── Tool: Einzelnes Projekt ──────────────────────────────────────────────────
server.tool(
  'get_projekt',
  'Gibt ein Projekt mit allen LVs zurück',
  { id: z.string().describe('Projekt-ID') },
  async ({ id }) => {
    const projekt = await prisma.projekt.findUnique({
      where: { id },
      include: { lvs: { orderBy: [{ version: 'desc' }] } },
    })
    if (!projekt) return { content: [{ type: 'text', text: 'Projekt nicht gefunden' }] }
    return { content: [{ type: 'text', text: JSON.stringify(projekt, null, 2) }] }
  }
)

// ─── Tool: LV mit Titeln und Positionen ───────────────────────────────────────
server.tool(
  'get_lv',
  'Gibt ein LV mit allen Titeln und Positionen zurück',
  { id: z.string().describe('LV-ID') },
  async ({ id }) => {
    const lv = await prisma.lV.findUnique({
      where: { id },
      include: {
        titel: {
          include: { positionen: true },
          orderBy: { reihenfolge: 'asc' },
        },
      },
    })
    if (!lv) return { content: [{ type: 'text', text: 'LV nicht gefunden' }] }
    return { content: [{ type: 'text', text: JSON.stringify(lv, null, 2) }] }
  }
)

// ─── Tool: Kalkulation einer Position ────────────────────────────────────────
server.tool(
  'get_kalkulation',
  'Gibt die vollständige Kalkulation einer Position zurück',
  { positionId: z.string().describe('Position-ID') },
  async ({ positionId }) => {
    const kal = await prisma.kalkulation.findUnique({
      where: { positionId },
      include: {
        zeilen: { orderBy: { reihenfolge: 'asc' } },
        position: true,
      },
    })
    if (!kal) return { content: [{ type: 'text', text: 'Keine Kalkulation gefunden' }] }
    return { content: [{ type: 'text', text: JSON.stringify(kal, null, 2) }] }
  }
)

// ─── Tool: Katalog durchsuchen ────────────────────────────────────────────────
server.tool(
  'search_katalog',
  'Durchsucht den LB-Katalog nach Standardpositionen',
  {
    query: z.string().describe('Suchbegriff, z.B. "Aushub" oder "Ziegelmauerwerk"'),
    limit: z.number().optional().default(10),
  },
  async ({ query, limit }) => {
    const results = await prisma.katalogPosition.findMany({
      where: {
        OR: [
          { kurztext: { contains: query, mode: 'insensitive' } },
          { langtext: { contains: query, mode: 'insensitive' } },
          { posNummer: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    })
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
  }
)

// ─── Tool: LV zusammenfassen ──────────────────────────────────────────────────
server.tool(
  'summarize_lv',
  'Erstellt eine strukturierte Zusammenfassung eines LV mit Gesamtsummen pro Titel',
  { id: z.string().describe('LV-ID') },
  async ({ id }) => {
    const lv = await prisma.lV.findUnique({
      where: { id },
      include: {
        projekt: true,
        titel: {
          include: {
            positionen: {
              include: { kalkulation: true },
            },
          },
          orderBy: { reihenfolge: 'asc' },
        },
      },
    })
    if (!lv) return { content: [{ type: 'text', text: 'LV nicht gefunden' }] }

    let totalNetto = 0
    const summary = {
      projekt: lv.projekt.name,
      lv: `${lv.bezeichnung} v${lv.version}`,
      titel: lv.titel.map((t) => {
        const aktive = t.positionen.filter((p) => !p.entfaellt)
        const titelSumme = aktive.reduce((sum, p) => {
          return sum + Number(p.kalkulation?.gesamtpreis ?? 0)
        }, 0)
        totalNetto += titelSumme
        return {
          nummer: t.nummer,
          bezeichnung: t.bezeichnung,
          positionen: t.positionen.length,
          summeNetto: titelSumme.toFixed(2),
        }
      }),
      gesamtNetto: totalNetto.toFixed(2),
      gesamtBrutto: (totalNetto * 1.2).toFixed(2),
    }

    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
  }
)

// ─── Tool: Angebot erstellen ──────────────────────────────────────────────────
server.tool(
  'create_angebot',
  'Erstellt einen Angebots-Snapshot aus einem LV',
  {
    lvId: z.string().describe('LV-ID'),
    bezeichnung: z.string().describe('Name des Angebots'),
  },
  async ({ lvId, bezeichnung }) => {
    const lv = await prisma.lV.findUnique({
      where: { id: lvId },
      include: {
        titel: {
          include: {
            positionen: { include: { kalkulation: true } },
          },
        },
      },
    })
    if (!lv) return { content: [{ type: 'text', text: 'LV nicht gefunden' }] }

    const summeNetto = lv.titel.reduce((sum, t) =>
      sum + t.positionen.reduce((s, p) => s + Number(p.kalkulation?.gesamtpreis ?? 0), 0), 0)

    const angebot = await prisma.angebot.create({
      data: {
        lvId,
        bezeichnung,
        snapshotJson: lv as any,
        summeNetto,
        summeBrutto: summeNetto * 1.2,
      },
    })

    return {
      content: [{ type: 'text', text: `Angebot erstellt: ${angebot.id}\nSumme netto: € ${summeNetto.toFixed(2)}` }],
    }
  }
)

// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
