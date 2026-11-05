// Desenha o banner de divulgação num <canvas>, seguindo o manual de identidade visual:
// laranja #FE6402, grafite #283135, Montserrat, logo oficial (sem redesenhar).

export type BannerFormat = 'stories' | 'feed'
export type BannerStyle = 'ia' | 'laranja' | 'grafite'

export interface BannerData {
  format: BannerFormat
  style: BannerStyle
  background?: HTMLImageElement | null
  eyebrow: string // ex.: DOMINGO · 19H
  headline: string
  subtitle?: string
  theme?: string
  preacher?: string
  footer?: string
}

export const SIZES: Record<BannerFormat, [number, number]> = { stories: [1080, 1920], feed: [1080, 1080] }

const ORANGE = '#FE6402'
const GRAPHITE = '#283135'
const FONT = 'Montserrat, Arial, sans-serif'

const imgCache = new Map<string, Promise<HTMLImageElement>>()
export function loadImg(src: string): Promise<HTMLImageElement> {
  if (!imgCache.has(src))
    imgCache.set(
      src,
      new Promise((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = src
      }),
    )
  return imgCache.get(src)!
}

export async function ensureFonts() {
  try {
    await Promise.all(['500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 60px Montserrat`)))
  } catch {
    /* usa Arial se a fonte não carregar */
  }
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (ctx.measureText(t).width <= maxW || !cur) cur = t
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

/** Ajusta o tamanho da fonte para o texto caber em no máximo `maxLines` linhas. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, min: number, maxW: number, maxLines: number) {
  let s = size
  for (; s >= min; s -= 4) {
    ctx.font = `${weight} ${s}px ${FONT}`
    const lines = wrap(ctx, text, maxW)
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { size: s, lines }
  }
  ctx.font = `${weight} ${min}px ${FONT}`
  return { size: min, lines: wrap(ctx, text, maxW).slice(0, maxLines) }
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const r = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const w = img.naturalWidth * r
  const h = img.naturalHeight * r
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
}

export async function drawBanner(canvas: HTMLCanvasElement, d: BannerData) {
  await ensureFonts()
  const [W, H] = SIZES[d.format]
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const stories = d.format === 'stories'
  const M = stories ? 96 : 80

  // ---------- Fundo ----------
  const onOrange = d.style === 'laranja'
  if (d.style === 'ia' && d.background) {
    cover(ctx, d.background, W, H)
    // Camada escura por cima da foto (manual: "foto com camada")
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(40,49,53,0.55)')
    g.addColorStop(0.45, 'rgba(40,49,53,0.45)')
    g.addColorStop(1, 'rgba(40,49,53,0.92)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  } else {
    ctx.fillStyle = onOrange ? ORANGE : GRAPHITE
    ctx.fillRect(0, 0, W, H)
    // Símbolo grande ao fundo, como nas peças do manual
    const sym = await loadImg(onOrange ? '/simbolo-branco.png' : '/simbolo-cor.png')
    const sh = stories ? H * 0.62 : H * 0.95
    const sw = (sym.naturalWidth / sym.naturalHeight) * sh
    ctx.globalAlpha = onOrange ? 0.16 : 0.9
    ctx.drawImage(sym, W - sw * (stories ? 0.78 : 0.62), H - sh * (stories ? 0.9 : 0.86), sw, sh)
    ctx.globalAlpha = 1
    if (!onOrange) {
      // escurece o símbolo para o texto ficar legível
      const g = ctx.createLinearGradient(0, 0, W, 0)
      g.addColorStop(0, 'rgba(40,49,53,0.95)')
      g.addColorStop(0.6, 'rgba(40,49,53,0.6)')
      g.addColorStop(1, 'rgba(40,49,53,0.1)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
  }

  // ---------- Logo (arquivo original; branco sobre laranja/foto, versão fundo escuro no grafite) ----------
  const logo = await loadImg(d.style === 'grafite' ? '/logo-escuro-t.png' : '/logo-branco-t.png')
  const lw = stories ? 300 : 210
  const lh = (logo.naturalHeight / logo.naturalWidth) * lw
  if (stories) ctx.drawImage(logo, (W - lw) / 2, 120, lw, lh)
  else ctx.drawImage(logo, M, 64, lw, lh)

  // ---------- Bloco de texto ----------
  const maxW = W - 2 * M
  const accent = onOrange ? '#FFFFFF' : ORANGE
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // Mede tudo antes, para posicionar o bloco de baixo para cima.
  // Se não couber, diminui tudo aos poucos (e por último tira a frase de convite).
  const bottomPad = stories ? (d.footer ? 230 : 170) : d.footer ? 130 : 90
  const top = stories ? 520 : 64 + (lh + 40)
  const info: [string, string][] = []
  if (d.theme) info.push(['TEMA', d.theme])
  if (d.preacher) info.push(['PALAVRA', d.preacher])
  const layout = (k: number, withSub: boolean) => {
    const z = (n: number) => Math.round(n * k)
    const head = fit(ctx, d.headline.toUpperCase(), 800, z(stories ? 128 : 96), z(stories ? 72 : 56), maxW, stories ? 4 : 3)
    const headLH = head.size * 1.04
    const subSize = z(stories ? 44 : 34)
    ctx.font = `500 ${subSize}px ${FONT}`
    const sub = withSub && d.subtitle ? wrap(ctx, d.subtitle, maxW).slice(0, stories ? 3 : 2) : []
    const subLH = subSize * 1.35
    const infoSize = z(stories ? 42 : 32)
    ctx.font = `600 ${infoSize}px ${FONT}`
    const infoLines = info.map(([key, v]) => [key, wrap(ctx, v, maxW).slice(0, 2)] as const)
    const infoLH = infoSize * 1.3
    const eyebrowH = z(stories ? 40 : 30)
    const gap = z(stories ? 34 : 24)
    const labelH = z(stories ? 30 : 24)
    const blockH =
      eyebrowH + gap * 0.8 + head.lines.length * headLH + gap + 10 + (sub.length ? gap + sub.length * subLH : 0) + infoLines.reduce((acc, [, l]) => acc + gap + labelH + l.length * infoLH, 0)
    return { head, headLH, sub, subSize, subLH, infoLines, infoSize, infoLH, eyebrowH, gap, labelH, blockH }
  }
  const avail = H - bottomPad - top
  let L = layout(1, true)
  for (let k = 0.96; L.blockH > avail && k >= 0.7; k -= 0.04) L = layout(k, true)
  if (L.blockH > avail) L = layout(0.7, false)
  const { head, headLH, sub, subSize, subLH, infoLines, infoSize, infoLH, eyebrowH, gap, labelH } = L
  let y = Math.max(top, H - bottomPad - L.blockH)

  // Sobretítulo: DOMINGO · 19H
  ctx.fillStyle = accent
  ctx.font = `700 ${eyebrowH}px ${FONT}`
  setSpacing(ctx, stories ? 8 : 6)
  y += eyebrowH
  ctx.fillText(d.eyebrow.toUpperCase(), M, y)
  setSpacing(ctx, 0)
  y += gap * 0.8

  // Chamada
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `800 ${head.size}px ${FONT}`
  for (const l of head.lines) {
    y += headLH
    ctx.fillText(l, M, y - head.size * 0.12)
  }

  // Filete laranja
  y += gap
  ctx.fillStyle = onOrange ? '#FFFFFF' : ORANGE
  ctx.fillRect(M, y, stories ? 130 : 110, 10)
  y += 10

  // Subtítulo
  if (sub.length) {
    y += gap
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `500 ${subSize}px ${FONT}`
    for (const l of sub) {
      y += subLH
      ctx.fillText(l, M, y - subLH * 0.25)
    }
  }

  // Tema / pregador
  for (const [k, lines] of infoLines) {
    y += gap
    ctx.fillStyle = accent
    ctx.font = `700 ${Math.round(labelH * 0.85)}px ${FONT}`
    setSpacing(ctx, 6)
    y += labelH
    ctx.fillText(k, M, y)
    setSpacing(ctx, 0)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `600 ${infoSize}px ${FONT}`
    for (const l of lines) {
      y += infoLH
      ctx.fillText(l, M, y - infoLH * 0.2)
    }
  }

  // Rodapé (endereço / @instagram)
  if (d.footer) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `600 ${stories ? 32 : 26}px ${FONT}`
    setSpacing(ctx, 2)
    const fl = wrap(ctx, d.footer, maxW).slice(0, 2)
    let fy = H - (stories ? 90 : 50) - (fl.length - 1) * (stories ? 44 : 36)
    ctx.textAlign = stories ? 'center' : 'left'
    for (const l of fl) {
      ctx.fillText(l, stories ? W / 2 : M, fy)
      fy += stories ? 44 : 36
    }
    setSpacing(ctx, 0)
    ctx.textAlign = 'left'
  }
  // Barra laranja no pé (como no papel timbrado e no verso do manual)
  if (!onOrange) {
    ctx.fillStyle = ORANGE
    ctx.fillRect(0, H - (stories ? 18 : 14), W, stories ? 18 : 14)
  }
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar imagem'))), 'image/jpeg', 0.92))
}
