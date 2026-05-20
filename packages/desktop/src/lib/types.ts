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

// ─── Leistungsbücher / Katalog ───────────────────────────────────────────────
export type LeistungsbuchTyp = 'oenorm' | 'eigen'
export type ImportStatus = 'pending' | 'running' | 'done' | 'error'

export interface Leistungsbuch {
  id: string
  kennung: string
  bezeichnung: string
  versionsnummer: string
  versionsdatum: string | null
  herausgeber: string | null
  typ: LeistungsbuchTyp
  aktiv: boolean
  dateiname: string | null
  createdAt: string
  updatedAt: string
  _count?: { positionen: number }
}

export interface ImportJobStatus {
  status: ImportStatus
  processed: number
  total: number
  message: string | null
  leistungsbuchId: string | null
}

// ─── Stammdaten / Betriebsmittel ─────────────────────────────────────────────
export type BetriebsmittelArt = 'lohn' | 'material' | 'geraet' | 'sonstiges' | 'nu'

export interface Betriebsmittel {
  id: string
  art: BetriebsmittelArt
  bezeichnung: string
  kennung: string | null
  einheit: string
  kostenProEinheit: Dezimal
  aufschlag: Dezimal
  gruppe: string | null
  notiz: string | null
  aktiv: boolean
  createdAt: string
  updatedAt: string
}

export interface Zuschlagsschema {
  id: string
  bezeichnung: string
  agkProzent: Dezimal
  guProzent: Dezimal
  gewinnProzent: Dezimal
  istStandard: boolean
}

// ─── Kalkulation (EP-Aufgliederung) ──────────────────────────────────────────
export interface Kalkulationszeile {
  id: string
  art: BetriebsmittelArt
  betriebsmittelId: string | null
  bezeichnung: string
  einheit: string
  menge: Dezimal
  einzelpreis: Dezimal
  aufschlag: Dezimal
  reihenfolge: number
}

export interface KalkulationGet {
  position: { id: string; nummer: string; kurztext: string; einheit: string; menge: Dezimal }
  kalkulation:
    | {
        agkProzent: Dezimal
        guProzent: Dezimal
        gewinnProzent: Dezimal
        einheitspreis: Dezimal | null
        gesamtpreis: Dezimal | null
        zeilen: Kalkulationszeile[]
      }
    | null
  standardSchema: Zuschlagsschema | null
}
