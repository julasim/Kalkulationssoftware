// Kalkulations-Engine — reine Funktion, kein DB-Zustand.
//
// EP-Basis (Herstellkosten je Einheit) =
//     Lohn       Σ aufwandswert × stundensatz
//   + Material   Σ menge × preis × (1 + aufschlag/100)
//   + Geräte     Σ menge × preis
//   + NU         Σ betrag
//   + Sonstiges  Σ betrag
//
// Einheitspreis = EP-Basis × (1+AGK%) × (1+GU%) × (1+Gewinn%)
// Gesamtpreis   = Einheitspreis × Menge

export interface LohnZeile { aufwandswert: number; stundensatz: number }
export interface MaterialZeile { menge: number; preis: number; aufschlag: number }
export interface GeraetZeile { menge: number; preis: number }
export interface BetragZeile { betrag: number }

export interface KalkulationInput {
  menge: number
  agkProzent: number
  guProzent: number
  gewinnProzent: number
  lohnzeilen: LohnZeile[]
  materialzeilen: MaterialZeile[]
  geraetezeilen: GeraetZeile[]
  nuZeilen: BetragZeile[]
  sonstigeZeilen: BetragZeile[]
}

export interface KalkulationErgebnis {
  lohn: number
  material: number
  geraet: number
  nu: number
  sonstiges: number
  epBasis: number
  zuschlagFaktor: number
  einheitspreis: number
  gesamtpreis: number
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const round = (n: number, d: number) => {
  const f = 10 ** d
  return Math.round((n + Number.EPSILON) * f) / f
}

export function berechneKalkulation(input: KalkulationInput): KalkulationErgebnis {
  const lohn = sum(input.lohnzeilen.map((z) => z.aufwandswert * z.stundensatz))
  const material = sum(input.materialzeilen.map((z) => z.menge * z.preis * (1 + z.aufschlag / 100)))
  const geraet = sum(input.geraetezeilen.map((z) => z.menge * z.preis))
  const nu = sum(input.nuZeilen.map((z) => z.betrag))
  const sonstiges = sum(input.sonstigeZeilen.map((z) => z.betrag))

  const epBasis = lohn + material + geraet + nu + sonstiges
  const zuschlagFaktor =
    (1 + input.agkProzent / 100) * (1 + input.guProzent / 100) * (1 + input.gewinnProzent / 100)

  const einheitspreis = epBasis * zuschlagFaktor
  const gesamtpreis = einheitspreis * input.menge

  return {
    lohn: round(lohn, 4),
    material: round(material, 4),
    geraet: round(geraet, 4),
    nu: round(nu, 4),
    sonstiges: round(sonstiges, 4),
    epBasis: round(epBasis, 4),
    zuschlagFaktor,
    einheitspreis: round(einheitspreis, 4),
    gesamtpreis: round(gesamtpreis, 2),
  }
}
