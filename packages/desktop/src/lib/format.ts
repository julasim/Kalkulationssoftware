import type { Dezimal } from './types'

const eur = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
const num = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 3 })

export function toNum(v: Dezimal | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : Number(v)
}

export function formatEUR(v: Dezimal | null | undefined): string {
  return eur.format(toNum(v))
}

export function formatNum(v: Dezimal | null | undefined): string {
  return num.format(toNum(v))
}
