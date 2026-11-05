// Recorta a(s) pessoa(s) de uma foto, removendo só o fundo.
// O rosto e o corpo continuam sendo os pixels ORIGINAIS da foto: nada é redesenhado.
// Roda no próprio celular (MediaPipe, licença Apache-2.0).
import type { ImageSegmenter } from '@mediapipe/tasks-vision'

let segmenterPromise: Promise<ImageSegmenter> | null = null

function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe')
      const make = (delegate: 'GPU' | 'CPU') =>
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/models/selfie_multiclass_256x256.tflite', delegate },
          runningMode: 'IMAGE',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        })
      try {
        return await make('GPU')
      } catch {
        return await make('CPU')
      }
    })()
    segmenterPromise.catch(() => (segmenterPromise = null))
  }
  return segmenterPromise
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Imagem inválida'))
    i.src = src
  })
}

/** A imagem já tem fundo transparente (PNG recortado)? Então não precisa recortar. */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data
  let clear = 0
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 20) clear++
  return clear / (d.length / 28) > 0.08
}

/**
 * Devolve um PNG com fundo transparente, já cortado justo na pessoa.
 * `confidence` controla a borda (mais alto = recorte mais justo).
 */
export async function cutoutPerson(src: string, confidence = 0.5): Promise<string> {
  const img = await loadImage(src)
  const W = img.naturalWidth
  const H = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  if (!hasTransparency(ctx, W, H)) {
    const seg = await getSegmenter()
    const result = seg.segment(img)
    // Categoria 0 = fundo. Pessoa = 1 - confiança do fundo.
    const bg = result.confidenceMasks?.[0]
    if (!bg) throw new Error('Não consegui recortar esta foto.')
    const mw = bg.width
    const mh = bg.height
    const mask = bg.getAsFloat32Array()
    result.close()
    // Máscara em escala de cinza → canvas, suavizada, depois aplicada como canal alfa.
    const m = document.createElement('canvas')
    m.width = mw
    m.height = mh
    const mctx = m.getContext('2d')!
    const md = mctx.createImageData(mw, mh)
    const lo = Math.max(0, confidence - 0.25)
    const hi = Math.min(1, confidence + 0.25)
    for (let i = 0; i < mask.length; i++) {
      const p = 1 - mask[i]
      const a = p <= lo ? 0 : p >= hi ? 1 : (p - lo) / (hi - lo)
      md.data[i * 4 + 3] = Math.round(a * 255)
    }
    mctx.putImageData(md, 0, 0)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.filter = `blur(${Math.max(1, Math.round(W / 700))}px)`
    ctx.drawImage(m, 0, 0, W, H)
    ctx.restore()
  }
  // Corta justo na pessoa (sem sobras transparentes)
  const d = ctx.getImageData(0, 0, W, H).data
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2)
      if (d[(y * W + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 <= x0 || y1 <= y0) throw new Error('Não encontrei nenhuma pessoa nesta foto.')
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}
