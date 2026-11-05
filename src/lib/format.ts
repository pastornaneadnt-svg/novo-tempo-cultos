import type { CultEvent, Item } from './types'

export const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
export const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function fmtDateLong(iso: string): string {
  const d = parseDate(iso)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

export function fmtDateShort(iso: string): string {
  const d = parseDate(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function fmtMin(total: number): string {
  const m = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function hhmm(t: string): string {
  return t.slice(0, 5)
}

export function fmtDuration(min: number): string {
  const sign = min < 0 ? '-' : ''
  const a = Math.abs(min)
  const h = Math.floor(a / 60)
  const m = a % 60
  if (h && m) return `${sign}${h}h${String(m).padStart(2, '0')}`
  if (h) return `${sign}${h}h`
  return `${sign}${m} min`
}

/** Calcula o horário de início de cada oportunidade da programação. */
export function withTimes(event: Pick<CultEvent, 'start_time'>, items: Item[]): { item: Item; start: number }[] {
  let t = toMin(event.start_time)
  return items.map((item) => {
    const start = t
    t += item.duration_min
    return { item, start }
  })
}

export function programItems(items: Item[]): Item[] {
  return items.filter((i) => i.section === 'programa').sort((a, b) => a.position - b.position)
}

export function supportItems(items: Item[]): Item[] {
  return items.filter((i) => i.section === 'apoio').sort((a, b) => a.position - b.position)
}

// Títulos que vêm antes do nome: a saudação usa "Irmã Joana", "Pr. Carlos"…
const TITLES = /^(irm[ãa]o?|irm\.?|pr\.?|pra\.?|pastor[a]?|pb\.?|presb[ií]tero|dc\.?|dca\.?|di[áa]cono[a]?|ev\.?|evangelista|miss\.?|mission[áa]ri[oa]|ir\.?|sr\.?|sra\.?|dona|d\.)$/i

export function firstName(name?: string | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1 && TITLES.test(parts[0])) return `${parts[0]} ${parts[1]}`
  return parts[0] || ''
}
