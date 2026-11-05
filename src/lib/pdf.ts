import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FIELD_LABELS, READING_KINDS, itemLabel, kindDef } from './catalog'
import { capitalize, fmtDateLong, fmtDuration, fmtMin, hhmm, programItems, supportItems, toMin, withTimes } from './format'
import type { CultEvent, Item } from './types'

const ORANGE: [number, number, number] = [254, 100, 2]
const GRAPHITE: [number, number, number] = [40, 49, 53]
const LIGHT: [number, number, number] = [255, 243, 235]

// As fontes padrão do PDF não têm alguns símbolos; troca por equivalentes.
const clean = (s: string) => s.replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")

async function loadImage(src: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(src)).blob()
    const data = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsDataURL(blob)
    })
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = data
    })
    return { data, w: img.naturalWidth, h: img.naturalHeight }
  } catch {
    return null
  }
}

export function detailsText(item: Item, mainReading?: string | null): string {
  const d = item.details || {}
  const def = kindDef(item.kind)
  const parts: string[] = []
  if (READING_KINDS.has(item.kind) && mainReading?.trim()) parts.push(`Texto: ${mainReading.trim()}`)
  for (const f of def.fields) {
    if (f === 'notes') continue
    if (f === 'hymns') {
      if (d.hymns?.length) parts.push(d.hymns.map((h) => `Hino ${h.number} - ${h.title}`).join('\n'))
      const missing = (d.hymn_count || 0) - (d.hymns?.length || 0)
      if (missing > 0) parts.push(`${missing} hino(s) a definir`)
      continue
    }
    if (f === 'songs') {
      const songs = (d.songs || '').split('\n').map((x) => x.trim()).filter(Boolean)
      if (songs.length) parts.push(songs.join('\n'))
      const missing = (d.song_count || 0) - songs.length
      if (missing > 0) parts.push(`${missing} louvor(es) a definir`)
      continue
    }
    if (f === 'mode') {
      if (d.mode === 'tocado') parts.push(d.tone?.trim() ? `Tocado - Tom: ${d.tone.trim()}` : 'Tocado')
      if (d.mode === 'playback') parts.push(d.playback_link?.trim() ? `Playback: ${d.playback_link.trim()}` : 'Playback')
      continue
    }
    const v = (d[f] as string | undefined)?.trim()
    if (!v) continue
    parts.push(`${FIELD_LABELS[f]}: ${v}`)
  }
  if (d.notes?.trim()) parts.push(`Obs.: ${d.notes.trim()}`)
  return parts.join('\n')
}

export async function downloadProgramPdf(event: CultEvent, items: Item[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 14

  // Cabeçalho laranja com a versão negativa (branca) da marca.
  doc.setFillColor(...ORANGE)
  doc.rect(0, 0, W, 44, 'F')
  const logo = await loadImage('/logo-branco-t.png')
  if (logo) {
    const h = 34
    doc.addImage(logo.data, 'PNG', M, 5, (logo.w / logo.h) * h, h)
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PROGRAMAÇÃO DO CULTO', W - M, 15, { align: 'right' })
  doc.setFontSize(18)
  doc.text(clean((event.title || 'Culto').toUpperCase()), W - M, 24, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text(clean(`${capitalize(fmtDateLong(event.event_date))} · ${hhmm(event.start_time)} às ${hhmm(event.end_time)}`), W - M, 31, {
    align: 'right',
  })

  // Bloco do tema
  let y = 52
  const info: [string, string][] = []
  if (event.theme) info.push(['TEMA', event.theme])
  if (event.verse) info.push(['VERSÍCULO', event.verse])
  if (event.main_reading) info.push(['LEITURA PRINCIPAL', event.main_reading])
  if (event.director?.name) info.push(['DIRIGENTE', event.director.name])
  if (info.length) {
    const lines = info.map(([k, v]) => ({ k, v: doc.splitTextToSize(clean(v), W - 2 * M - 48) as string[] }))
    const boxH = lines.reduce((s, l) => s + l.v.length * 5 + 2.5, 5)
    doc.setFillColor(...LIGHT)
    doc.roundedRect(M, y - 5, W - 2 * M, boxH, 2, 2, 'F')
    let yy = y + 0.5
    for (const l of lines) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...ORANGE)
      doc.setCharSpace(0.25)
      doc.text(l.k, M + 5, yy)
      doc.setCharSpace(0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.5)
      doc.setTextColor(...GRAPHITE)
      doc.text(l.v, M + 46, yy)
      yy += l.v.length * 5 + 2.5
    }
    y += boxH + 3
  }

  const prog = programItems(items)
  const timed = withTimes(event, prog)
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 18 },
    head: [['HORÁRIO', 'OPORTUNIDADE', 'RESPONSÁVEL', 'DETALHES']],
    body: timed.map(({ item, start }) => [
      `${fmtMin(start)}\n${item.duration_min} min`,
      clean(itemLabel(item)),
      clean(item.person?.name || '-'),
      clean(detailsText(item, event.main_reading)),
    ]),
    styles: { font: 'helvetica', fontSize: 9, textColor: GRAPHITE, cellPadding: 2.4, lineColor: [230, 230, 230], lineWidth: 0.2, valign: 'top' },
    headStyles: { fillColor: GRAPHITE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold', textColor: ORANGE },
      1: { cellWidth: 52, fontStyle: 'bold' },
      2: { cellWidth: 42 },
      3: { cellWidth: 'auto' },
    },
  })

  const end = toMin(event.start_time) + prog.reduce((s, i) => s + i.duration_min, 0)
  y = (doc as any).lastAutoTable.finalY + 6
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 110)
  doc.text(
    clean(`Término previsto pela programação: ${fmtMin(end)} · Duração total: ${fmtDuration(end - toMin(event.start_time))}`),
    M,
    y,
  )

  const sup = supportItems(items)
  if (sup.length) {
    y += 8
    if (y > H - 40) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...GRAPHITE)
    doc.text('EQUIPE DE APOIO', M, y)
    autoTable(doc, {
      startY: y + 3,
      margin: { left: M, right: M, bottom: 18 },
      head: [['FUNÇÃO', 'RESPONSÁVEL', 'OBSERVAÇÕES']],
      body: sup.map((i) => [clean(itemLabel(i)), clean(i.person?.name || '-'), clean(i.details?.notes || '')]),
      styles: { font: 'helvetica', fontSize: 9, textColor: GRAPHITE, cellPadding: 2.4, lineColor: [230, 230, 230], lineWidth: 0.2 },
      headStyles: { fillColor: ORANGE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 55 } },
    })
  }

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFillColor(...ORANGE)
    doc.rect(0, H - 10, W, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setCharSpace(0.3)
    doc.text('AD NOVO TEMPO · IGREJA EVANGÉLICA', M, H - 4)
    doc.setCharSpace(0)
    doc.setFont('helvetica', 'normal')
    doc.text(`${p}/${pages}`, W - M, H - 4, { align: 'right' })
  }

  const fname = `programacao-${event.event_date}${event.title ? '-' + event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''}.pdf`
  doc.save(fname)
}
