// Hinweis: Prisma serialisiert Decimal-Felder als String. Werte vor dem Rechnen
// mit Number(...) konvertieren.
export type Dezimal = string | number

export type ProjektStatus = 'offen' | 'in_arbeit' | 'abgeschlossen' | 'archiviert'

export interface Projekt {
  id: string
  name: string
  beschreibung: string | null
  ort: string | null
  status: ProjektStatus
  createdAt: string
  updatedAt: string
  _count?: { lvs: number }
}

export interface LV {
  id: string
  bezeichnung: string
  version: number
  notiz: string | null
  projektId: string
  createdAt: string
}

export interface Position {
  id: string
  nummer: string
  kurztext: string
  langtext: string | null
  einheit: string
  menge: Dezimal
  typ: 'normal' | 'alternativ' | 'eventualposition' | 'pauschale'
  reihenfolge: number
  katalogPosId: string | null
  kalkulation: { einheitspreis: Dezimal | null; gesamtpreis: Dezimal | null } | null
}

export interface LVTitel {
  id: string
  nummer: string
  bezeichnung: string
  reihenfolge: number
  positionen: Position[]
}

export interface LVDetail extends LV {
  projekt: { id: string; name: string }
  titel: LVTitel[]
}
