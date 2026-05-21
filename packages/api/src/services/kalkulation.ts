// Kalkulations-Engine — reine Funktion, kein DB-Zustand.
//
// Jede Zeile (egal welche Art): Kosten = menge × einzelpreis × (1 + aufschlag/100).
//   Lohn:        menge = Aufwandswert (h/Einh.), einzelpreis = Stundensatz (€/h)
//   Material:    menge, einzelpreis = Preis, aufschlag = %
//   Geräte:      menge, einzelpreis = Preis
//   NU/Sonstige: menge = 1, einzelpreis = Betrag
//
// EP-Basis (Herstellkosten je Einheit) = Σ Zeilenkosten
// Einheitspreis = EP-Basis × (1+AGK%) × (1+GU%) × (1+Gewinn%)
// Gesamtpreis   = Einheitspreis × Menge

export interface KalkZeile {
  menge: number
  einzelpreis: number
  aufschlag: number
}

export interface KalkulationInput {
  menge: number
  agkProzent: number
  guProzent: number
  gewinnProzent: number
  zeilen: KalkZeile[]
}

export interface KalkulationErgebnis {
  epBasis: number
  zuschlagFaktor: number
  einheitspreis: number
  gesamtpreis: number
}

const round = (n: number, d: number) => {
  const f = 10 ** d
  return Math.round((n + Number.EPSILON) * f) / f
}

export function berechneKalkulation(input: KalkulationInput): KalkulationErgebnis {
  const epBasis = input.zeilen.reduce(
    (sum, z) => sum + z.menge * z.einzelpreis * (1 + z.aufschlag / 100),
    0,
  )
  const zuschlagFaktor =
    (1 + input.agkProzent / 100) * (1 + input.guProzent / 100) * (1 + input.gewinnProzent / 100)

  // Einheitspreis auf 4 Nachkommastellen runden und denselben (gespeicherten) Wert
  // für den Gesamtpreis verwenden — konsistent mit dem Mengen-Nachzug in lvs.ts,
  // der ebenfalls aus dem gerundeten, gespeicherten Einheitspreis rechnet.
  const einheitspreis = round(epBasis * zuschlagFaktor, 4)
  const gesamtpreis = round(einheitspreis * input.menge, 2)

  return {
    epBasis: round(epBasis, 4),
    zuschlagFaktor,
    einheitspreis,
    gesamtpreis,
  }
}
