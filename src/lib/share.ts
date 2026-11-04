import { READING_KINDS, itemLabel } from './catalog'
import { capitalize, fmtDateLong, fmtMin, hhmm, firstName } from './format'
import type { CultEvent, Item } from './types'

export function normalizePhone(phone?: string | null): string {
  let d = (phone || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('0')) d = d.replace(/^0+/, '')
  if (d.length <= 11) d = '55' + d
  return d
}

export function whatsappUrl(phone: string | null | undefined, text: string): string {
  const p = normalizePhone(phone)
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`
}

export function inviteLink(token: string): string {
  return `${window.location.origin}/c/${token}`
}

export function directorLink(token: string): string {
  return `${window.location.origin}/d/${token}`
}

export function inviteMessage(event: CultEvent, item: Item, start: number | null): string {
  const name = firstName(item.person?.name)
  const when = `${capitalize(fmtDateLong(event.event_date))}${start != null ? `, às ${fmtMin(start)}` : `, culto às ${hhmm(event.start_time)}`}`
  const lines = [
    `A paz do Senhor${name ? `, ${name}` : ''}! 🙏`,
    ``,
    `Você foi convidado(a) para *${itemLabel(item)}* no ${event.title || 'Culto'}.`,
    `📅 ${when}`,
  ]
  if (event.theme) lines.push(`🔥 Tema: ${event.theme}`)
  if (READING_KINDS.has(item.kind) && event.main_reading?.trim()) lines.push(`📖 Leitura: ${event.main_reading.trim()}`)
  lines.push(``, `Confirme e veja a programação completa pelo link:`, inviteLink(item.invite_token || ''))
  lines.push(``, `AD Novo Tempo`)
  return lines.join('\n')
}

export function directorMessage(event: CultEvent): string {
  const name = firstName(event.director?.name)
  return [
    `A paz do Senhor${name ? `, ${name}` : ''}! 🙏`,
    ``,
    `Você será o(a) dirigente do ${event.title || 'Culto'} de ${fmtDateLong(event.event_date)}, às ${hhmm(event.start_time)}.`,
    event.theme ? `🔥 Tema: ${event.theme}` : '',
    ``,
    `Por este link você pode organizar a programação do culto:`,
    directorLink(event.director_token || ''),
    ``,
    `AD Novo Tempo`,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
