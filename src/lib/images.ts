// Utilidades de imagem no navegador (reduzir fotos antes de enviar, montar o logo no banner).

/** Lê uma foto e reduz para no máximo `max` px no lado maior (JPEG), para enviar rápido. */
export async function fileToDataUrl(file: File, max = 1024, quality = 0.86): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('Não foi possível abrir esta imagem.'))
      i.src = url
    })
    const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * r)
    c.height = Math.round(img.naturalHeight * r)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Imagem inválida'))
    i.src = src
  })
}

/**
 * Coloca o logo OFICIAL (arquivo original) no topo do banner feito pela IA.
 * Fundo claro → versão colorida; fundo escuro → versão para fundo escuro (manual, p. 10).
 */
export async function stampLogo(src: string, withLogo: boolean): Promise<string> {
  const img = await loadImage(src)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  if (withLogo) {
    const W = c.width
    const H = c.height
    const lw = Math.round(W * (H > W ? 0.34 : 0.28))
    const top = Math.round(H * 0.022)
    // brilho médio da área onde o logo vai ficar
    const data = ctx.getImageData(Math.round((W - lw) / 2), top, lw, Math.round(H * 0.1)).data
    let sum = 0
    for (let i = 0; i < data.length; i += 16) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const bright = sum / (data.length / 16) > 150
    const logo = await loadImage(bright ? '/logo-cor-t.png' : '/logo-escuro-t.png')
    const lh = Math.round((logo.naturalHeight / logo.naturalWidth) * lw)
    // O manual proíbe sombras/efeitos no logo: desenha o arquivo original, sem alterar.
    ctx.drawImage(logo, Math.round((W - lw) / 2), top, lw, lh)
  }
  return c.toDataURL('image/jpeg', 0.93)
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}
