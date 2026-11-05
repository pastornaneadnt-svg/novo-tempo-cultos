// Monta o banner final: arte de fundo (IA) + pessoas recortadas das fotos ORIGINAIS
// + textos com tipografia moderna + logo oficial. Nada do rosto é redesenhado.

export type PosterFormat = 'vertical' | 'quadrado'
export type TitleFont = 'moderna' | 'elegante'

export interface PosterSpec {
  format: PosterFormat
  background?: HTMLImageElement | null
  people: HTMLImageElement[] // recortes (PNG transparente), na ordem da esquerda para a direita
  group?: HTMLImageElement | null // foto do grupo (recortada ou não)
  headline: string
  titleFont: TitleFont
  titleScale: number // 0.7 a 1.3
  accent: string
  subtitle?: string
  theme?: string
  preacher?: string
  singers?: string
  pastors?: string
  verse?: string
  extra?: string
  date?: string // ex.: SÁBADO · 06/11/2026
  time?: string // ex.: 19:00
  address?: string
  logo: boolean
}

export const POSTER_SIZE: Record<PosterFormat, [number, number]> = { vertical: [1080, 1620], quadrado: [1080, 1080] }

const SANS = 'Montserrat, Arial, sans-serif'
const SCRIPT = '"Great Vibes", "Brush Script MT", cursive'

const cache = new Map<string, Promise<HTMLImageElement>>()
function img(src: string) {
  if (!cache.has(src))
    cache.set(
      src,
      new Promise((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = src
      }),
    )
  return cache.get(src)!
}

export async function posterFonts() {
  try {
    await Promise.all([
      ...['500', '600', '700', '800', '900'].map((w) => document.fonts.load(`${w} 80px Montserrat`)),
      document.fonts.load('italic 500 40px Montserrat'),
      document.fonts.load('80px "Great Vibes"'),
    ])
  } catch {
    /* segue com a fonte reserva */
  }
}

type Ctx = CanvasRenderingContext2D
const spacing = (ctx: Ctx, px: number) => {
  const c = ctx as Ctx & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

function wrap(ctx: Ctx, text: string, maxW: number, maxLines = 99): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (!cur || ctx.measureText(t).width <= maxW) cur = t
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + '…'
    return kept
  }
  return lines
}

/** "Culto de Santa Ceia" → prefixo "culto de" + destaque ["Santa", "Ceia"]. */
export function splitTitle(headline: string): { prefix: string; main: string[] } {
  const h = headline.trim().replace(/\s+/g, ' ')
  const m = /^((?:culto|noite|ch[áa]|tarde|manh[ãa]|festa|congresso|confer[êe]ncia|encontro|vig[íi]lia|celebra[çc][ãa]o|escola|semin[áa]rio|retiro|culto especial)(?:\s+(?:de|da|do|das|dos|com))?)\s+(.+)$/i.exec(h)
  const prefix = m ? m[1] : ''
  const rest = m ? m[2] : h
  const words = rest.split(' ')
  if (words.length === 1) return { prefix, main: [rest] }
  if (words.length === 2) return { prefix, main: words }
  // equilibra em 2 linhas
  let best = 1
  let diff = Infinity
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length)
    if (d < diff) {
      diff = d
      best = i
    }
  }
  return { prefix, main: [words.slice(0, best).join(' '), words.slice(best).join(' ')] }
}

function cover(ctx: Ctx, im: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / im.naturalWidth, h / im.naturalHeight)
  const iw = im.naturalWidth * r
  const ih = im.naturalHeight * r
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
}

// Ícones de linha (24×24), como nos banners de referência
const ICONS = {
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  pin: 'M12 22s-8-6.5-8-12a8 8 0 0116 0c0 5.5-8 12-8 12zM12 13a3 3 0 100-6 3 3 0 000 6z',
}
function icon(ctx: Ctx, name: keyof typeof ICONS, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(new Path2D(ICONS[name]))
  ctx.restore()
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Pessoas recortadas: lado a lado, com brilho por trás e base esfumada. */
function drawPeople(ctx: Ctx, s: PosterSpec, zone: { x: number; y: number; w: number; h: number }, W: number, H: number) {
  if (!s.people.length && !s.group) return
  const layer = document.createElement('canvas')
  layer.width = W
  layer.height = H
  const l = layer.getContext('2d')!
  // Grupo: atrás, mais largo e suave
  if (s.group) {
    const gh = zone.h * 0.62
    const gw = (s.group.naturalWidth / s.group.naturalHeight) * gh
    const gx = zone.x + (zone.w - Math.min(gw, zone.w * 1.1)) / 2
    l.globalAlpha = s.people.length ? 0.55 : 1
    l.drawImage(s.group, gx, zone.y + (s.people.length ? 0 : zone.h - gh), Math.min(gw, zone.w * 1.1), gh * (Math.min(gw, zone.w * 1.1) / gw))
    l.globalAlpha = 1
  }
  if (s.people.length) {
    const n = s.people.length
    const square = W === H
    const overlap = square ? 0.22 : 0.1
    const maxW = zone.w * (square ? 1.15 : 1)
    let h = zone.h
    const widths = () => s.people.map((p) => (p.naturalWidth / p.naturalHeight) * h)
    let total = widths().reduce((a, b) => a + b, 0) * (1 - overlap) + widths()[n - 1] * overlap
    if (total > maxW) {
      h *= maxW / total
      total = maxW
    }
    const ws = widths()
    // No quadrado as pessoas encostam na direita (podem sair um pouco da borda)
    let x = square ? Math.min(zone.x + (zone.w - total) / 2, W - total * 0.92) : zone.x + (zone.w - total) / 2
    const base = zone.y + zone.h
    s.people.forEach((p, i) => {
      // a pessoa do meio um pouco maior quando são 3
      const k = n === 3 && i === 1 ? 1.06 : 1
      const ph = h * k
      const pw = ws[i] * k
      l.drawImage(p, x - (pw - ws[i]) / 2, base - ph, pw, ph)
      x += ws[i] * (1 - overlap)
    })
  }
  // Base esfumada (a pessoa "entra" no título, como nos banners de referência)
  l.globalCompositeOperation = 'destination-in'
  const fade = l.createLinearGradient(0, zone.y + zone.h * 0.68, 0, zone.y + zone.h)
  fade.addColorStop(0, 'rgba(0,0,0,1)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  l.fillStyle = fade
  l.fillRect(0, 0, W, H)
  l.globalCompositeOperation = 'source-over'
  // Brilho por trás das pessoas (só ao redor; o rosto não recebe efeito)
  ctx.save()
  ctx.shadowColor = s.accent + 'aa'
  ctx.shadowBlur = 70
  ctx.globalAlpha = 0.9
  ctx.drawImage(layer, 0, 0)
  ctx.restore()
  ctx.drawImage(layer, 0, 0)
}

interface Block {
  h: number
  draw: (y: number) => void
}

export async function drawPoster(canvas: HTMLCanvasElement, s: PosterSpec) {
  await posterFonts()
  const [W, H] = POSTER_SIZE[s.format]
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  // Os dois formatos usam o layout "destaque" (pessoas em cima, título por cima delas);
  // o quadrado é uma versão mais compacta.
  const sq = s.format === 'quadrado'
  const vertical = true
  const M = sq ? 56 : 70

  // ---------- Fundo ----------
  if (s.background) cover(ctx, s.background, 0, 0, W, H)
  else {
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
    g.addColorStop(0, '#1d2326')
    g.addColorStop(0.55, '#283135')
    g.addColorStop(1, '#5a2a0c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.38, 10, W * 0.5, H * 0.38, W * 0.7)
    glow.addColorStop(0, s.accent + '88')
    glow.addColorStop(1, s.accent + '00')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    const sym = await img('/simbolo-branco.png')
    const sh = H * 0.55
    ctx.globalAlpha = 0.06
    ctx.drawImage(sym, W - (sym.naturalWidth / sym.naturalHeight) * sh * 0.75, H - sh * 0.95, (sym.naturalWidth / sym.naturalHeight) * sh, sh)
    ctx.globalAlpha = 1
  }
  // Escurece onde vai o texto, para ler bem
  const shade = vertical ? ctx.createLinearGradient(0, H * 0.45, 0, H) : ctx.createLinearGradient(0, 0, W * 0.75, 0)
  shade.addColorStop(0, 'rgba(12,12,14,0)')
  shade.addColorStop(vertical ? 0.35 : 0, vertical ? 'rgba(12,12,14,0.35)' : 'rgba(12,12,14,0.7)')
  shade.addColorStop(1, vertical ? 'rgba(12,12,14,0.85)' : 'rgba(12,12,14,0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)
  const topShade = ctx.createLinearGradient(0, 0, 0, H * 0.16)
  topShade.addColorStop(0, 'rgba(12,12,14,0.45)')
  topShade.addColorStop(1, 'rgba(12,12,14,0)')
  ctx.fillStyle = topShade
  ctx.fillRect(0, 0, W, H * 0.16)

  // ---------- Logo oficial (arquivo original, sem efeitos) ----------
  const logo = await img('/logo-escuro-t.png')
  const lw = sq ? 200 : 300
  const lh = (logo.naturalHeight / logo.naturalWidth) * lw
  const logoX = vertical ? (W - lw) / 2 : M
  const logoY = sq ? 30 : 46
  const logoBottom = logoY + lh

  // ---------- Textos (medidos de baixo para cima) ----------
  const colW = vertical ? W - 2 * M : W * 0.56 - M
  const cx = vertical ? W / 2 : M
  const align: CanvasTextAlign = vertical ? 'center' : 'left'
  const title = splitTitle(s.headline || 'Culto')

  const build = (k: number) => {
    const z = (n: number) => Math.round(n * k)
    const blocks: Block[] = []
    // Título
    const titleBlock = (): Block & { firstLine: number } => {
      const lines = title.main
      const script = s.titleFont === 'elegante'
      let size = z((vertical ? 230 : 150) * s.titleScale)
      const font = (sz: number) => (script ? `${sz}px ${SCRIPT}` : `800 ${sz}px ${SANS}`)
      ctx.font = font(size)
      spacing(ctx, script ? 0 : -Math.round(size * 0.02))
      while (size > 50 && lines.some((ln) => ctx.measureText(ln).width > colW)) {
        size -= 6
        ctx.font = font(size)
        spacing(ctx, script ? 0 : -Math.round(size * 0.02))
      }
      spacing(ctx, 0)
      const lh2 = size * (script ? 0.95 : 0.92)
      const pre = title.prefix
      const preSize = Math.round(script ? size * 0.3 : size * 0.36)
      const preH = pre ? preSize * 1.05 : 0
      return {
        firstLine: preH + lh2 * 0.8,
        h: preH + lines.length * lh2 + size * 0.08,
        draw: (y) => {
          ctx.textAlign = align
          let yy = y
          if (pre) {
            ctx.fillStyle = '#FFFFFF'
            ctx.font = script ? `700 ${preSize}px ${SANS}` : `600 ${preSize}px ${SANS}`
            spacing(ctx, script ? Math.round(preSize * 0.18) : -1)
            yy += preSize
            ctx.fillText(script ? pre.toUpperCase() : pre.toLowerCase(), cx, yy)
            spacing(ctx, 0)
            yy += preSize * 0.05
          }
          lines.forEach((ln, i) => {
            yy += lh2
            ctx.font = font(size)
            spacing(ctx, script ? 0 : -Math.round(size * 0.02))
            ctx.save()
            ctx.shadowColor = 'rgba(0,0,0,0.35)'
            ctx.shadowBlur = 30
            ctx.shadowOffsetY = 6
            ctx.fillStyle = lines.length > 1 && i === lines.length - 1 ? s.accent : '#FFFFFF'
            ctx.fillText(ln, cx, yy - size * 0.1)
            ctx.restore()
          })
          spacing(ctx, 0)
        },
      }
    }
    const t = titleBlock()
    blocks.push(t)

    const text = (str: string, weight: string, size: number, color: string, maxLines: number, ls = 0, italic = false): Block | null => {
      if (!str.trim()) return null
      ctx.font = `${italic ? 'italic ' : ''}${weight} ${z(size)}px ${SANS}`
      spacing(ctx, ls)
      const lines = wrap(ctx, str, colW, maxLines)
      spacing(ctx, 0)
      const lhh = z(size) * 1.3
      return {
        h: lines.length * lhh,
        draw: (y) => {
          ctx.font = `${italic ? 'italic ' : ''}${weight} ${z(size)}px ${SANS}`
          ctx.fillStyle = color
          ctx.textAlign = align
          spacing(ctx, ls)
          lines.forEach((ln, i) => ctx.fillText(ln, cx, y + (i + 0.78) * lhh))
          spacing(ctx, 0)
        },
      }
    }
    const gap = (n: number): Block => ({ h: z(n), draw: () => {} })
    const labeled = (label: string, value?: string): Block[] => {
      if (!value?.trim()) return []
      const a = text(label.toUpperCase(), '700', vertical ? 22 : 18, s.accent, 1, 5)
      const b = text(value, '700', vertical ? 38 : 30, '#FFFFFF', 2)
      return [gap(vertical ? 22 : 16), a!, gap(4), b!]
    }

    const sub = text(s.subtitle || '', '600', vertical ? 34 : 28, 'rgba(255,255,255,0.92)', 2)
    if (sub) blocks.push(gap(vertical ? 18 : 14), sub)
    if (s.extra?.trim()) blocks.push(gap(12), text(s.extra, '700', vertical ? 28 : 24, s.accent, 2, 2)!)
    blocks.push(...labeled('Tema', s.theme))
    blocks.push(...labeled('Ministrando a Palavra', s.preacher))
    blocks.push(...labeled('Louvor', s.singers))
    blocks.push(...labeled('Pastores Presidentes', s.pastors))
    if (s.verse?.trim()) {
      blocks.push(gap(vertical ? 26 : 18), text(s.verse, '500', vertical ? 28 : 22, 'rgba(255,255,255,0.9)', vertical ? 4 : 3, 0, true)!)
    }
    // Caixa de data e horário
    if (s.date || s.time) {
      const bh = z(vertical ? 128 : 96)
      blocks.push(gap(vertical ? 30 : 22), {
        h: bh,
        draw: (y) => {
          const bw = vertical ? W - 2 * M : colW
          const bx = vertical ? M : M
          ctx.save()
          roundRect(ctx, bx, y, bw, bh, bh / 2)
          ctx.fillStyle = 'rgba(0,0,0,0.28)'
          ctx.fill()
          ctx.lineWidth = 3
          ctx.strokeStyle = s.accent
          ctx.stroke()
          ctx.restore()
          const parts: [keyof typeof ICONS, string, string][] = []
          if (s.date) {
            const [wd, dt] = s.date.split(' · ')
            parts.push(['calendar', wd || '', dt || s.date])
          }
          if (s.time) parts.push(['clock', 'ÀS', `${s.time}h`])
          const slot = bw / parts.length
          parts.forEach(([ic, small, big], i) => {
            const sx = bx + slot * i
            const isz = z(vertical ? 54 : 40)
            ctx.font = `800 ${z(vertical ? 54 : 38)}px ${SANS}`
            const bigW = ctx.measureText(big).width
            const contentW = isz + z(18) + bigW
            const x0 = sx + (slot - contentW) / 2
            icon(ctx, ic, x0, y + (bh - isz) / 2, isz, '#FFFFFF')
            ctx.textAlign = 'left'
            ctx.fillStyle = '#FFFFFF'
            ctx.font = `700 ${z(vertical ? 24 : 18)}px ${SANS}`
            spacing(ctx, 2)
            ctx.fillText(small.toUpperCase(), x0 + isz + z(18), y + bh * 0.42)
            spacing(ctx, 0)
            ctx.font = `800 ${z(vertical ? 54 : 38)}px ${SANS}`
            ctx.fillText(big, x0 + isz + z(18), y + bh * 0.8)
            if (i > 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.6)'
              ctx.fillRect(sx, y + bh * 0.2, 2, bh * 0.6)
            }
          })
        },
      })
    }
    // Endereço
    if (s.address?.trim()) {
      ctx.font = `700 ${z(vertical ? 28 : 22)}px ${SANS}`
      const lines = wrap(ctx, s.address, colW - z(50), 2)
      const lhh = z(vertical ? 28 : 22) * 1.3
      blocks.push(gap(vertical ? 24 : 18), {
        h: lines.length * lhh,
        draw: (y) => {
          ctx.font = `700 ${z(vertical ? 28 : 22)}px ${SANS}`
          ctx.fillStyle = '#FFFFFF'
          const isz = z(vertical ? 40 : 30)
          const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
          const startX = vertical ? (W - (widest + isz + z(14))) / 2 : M
          icon(ctx, 'pin', startX, y + (lines.length * lhh - isz) / 2, isz, s.accent)
          ctx.textAlign = 'left'
          lines.forEach((ln, i) => ctx.fillText(ln, startX + isz + z(14), y + (i + 0.8) * lhh))
        },
      })
    }
    const total = blocks.reduce((a, b) => a + b.h, 0)
    return { blocks, total, firstLine: t.firstLine }
  }

  const hasPeople = s.people.length > 0 || !!s.group
  const bottomPad = sq ? 36 : 56
  const minPeopleH = sq ? 380 : 520
  const avail = vertical ? H - bottomPad - logoBottom - (hasPeople ? minPeopleH * 0.6 : 60) : H - bottomPad - logoBottom - 40
  const k0 = sq ? 0.68 : 1
  let L = build(k0)
  for (let k = k0 - 0.04; L.total > avail && k > 0.4; k -= 0.04) L = build(k)
  let y = H - bottomPad - L.total
  if (!vertical) y = Math.max(logoBottom + 40, Math.min(y, logoBottom + 40 + Math.max(0, (avail - L.total) * 0.5)))
  else if (!hasPeople) y = Math.max(logoBottom + 60, logoBottom + 60 + (avail - L.total) * 0.35)

  // ---------- Pessoas (antes do texto, para o título ficar por cima) ----------
  if (hasPeople) {
    const zone = vertical
      ? { x: M * 0.4, y: logoBottom + 14, w: W - M * 0.8, h: y + L.firstLine - logoBottom - 14 }
      : { x: W * 0.5, y: H * 0.16, w: W * 0.5, h: H * 0.84 }
    drawPeople(ctx, s, zone, W, H)
  }

  for (const b of L.blocks) {
    b.draw(y)
    y += b.h
  }

  if (s.logo) ctx.drawImage(logo, logoX, logoY, lw, lh)
  // Filete laranja no pé (como no manual)
  ctx.fillStyle = '#FE6402'
  ctx.fillRect(0, H - 12, W, 12)
}
