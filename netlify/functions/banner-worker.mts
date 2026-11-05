import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { friendlyError, isModelError, models, openai, openaiKey } from '../lib/shared.mts'
import { backgroundImages, buildBackgroundPrompt, buildPrompt, orderedImages, type BackgroundInput, type PosterInput } from '../lib/poster.mts'

// Trabalho em segundo plano (até 15 min): gera o banner completo e guarda o resultado.
const jobs = () => getStore({ name: 'banner-jobs', consistency: 'strong' })

function toBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const type = /data:([^;]+)/.exec(head)?.[1] || 'image/jpeg'
  return new Blob([Buffer.from(b64, 'base64')], { type })
}

async function edit(model: string, prompt: string, images: string[], size: string, quality: string, fidelity: boolean) {
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('size', size)
  form.append('quality', quality)
  form.append('n', '1')
  if (fidelity) form.append('input_fidelity', 'high')
  images.forEach((img, i) => form.append('image[]', toBlob(img), `imagem-${i + 1}.jpg`))
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey()}` },
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export async function generate(input: PosterInput | BackgroundInput): Promise<{ image?: string; error?: string }> {
  const bgOnly = (input as BackgroundInput).kind === 'background'
  const prompt = bgOnly ? buildBackgroundPrompt(input as BackgroundInput) : buildPrompt(input as PosterInput)
  const images = bgOnly ? backgroundImages(input as BackgroundInput) : orderedImages(input as PosterInput)
  const size = input.format === 'quadrado' ? '1024x1024' : '1024x1536'
  const quality = Netlify.env.get('OPENAI_IMAGE_QUALITY') || (bgOnly ? 'medium' : 'high')

  for (const model of models('OPENAI_IMAGE_MODEL', ['gpt-image-1.5', 'gpt-image-1'])) {
    let r
    if (images.length) {
      r = await edit(model, prompt, images, size, quality, !bgOnly)
      // Alguns modelos não aceitam "input_fidelity": tenta de novo sem.
      if (!r.ok && r.status === 400 && /input_fidelity/i.test(r.data?.error?.message || '')) r = await edit(model, prompt, images, size, quality, false)
    } else {
      r = await openai('images/generations', { model, prompt, size, quality, n: 1 })
    }
    if (r.ok) {
      const b64 = r.data?.data?.[0]?.b64_json
      if (b64) return { image: `data:image/png;base64,${b64}` }
      const url = r.data?.data?.[0]?.url
      if (url) {
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
        return { image: `data:image/png;base64,${buf.toString('base64')}` }
      }
      return { error: 'A IA não devolveu a imagem. Toque em Refazer.' }
    }
    console.error('openai error', model, r.status, JSON.stringify(r.data).slice(0, 500))
    if (!isModelError(r.status, r.data)) return { error: friendlyError(r.status, r.data) }
  }
  return { error: 'Nenhum modelo de imagem da OpenAI disponível nesta conta.' }
}

export default async (req: Request) => {
  const { id, secret } = (await req.json().catch(() => ({}))) as { id?: string; secret?: string }
  if (!id || !secret) return
  const stored = (await jobs().get(`${id}/input`, { type: 'json' })) as { secret: string; input: PosterInput | BackgroundInput } | null
  if (!stored || stored.secret !== secret) return
  const job = (await jobs().get(id, { type: 'json' })) as { status: string; created: number } | null
  if (!job || job.status !== 'queued') return // já processado (ex.: nova tentativa automática)

  await jobs().setJSON(id, { status: 'working', created: job.created })
  try {
    const out = await generate(stored.input)
    await jobs().setJSON(id, { status: out.image ? 'done' : 'error', created: job.created, image: out.image, error: out.error })
  } catch (e) {
    console.error('worker failed', e)
    await jobs().setJSON(id, { status: 'error', created: job.created, error: 'A IA não conseguiu gerar agora. Toque em Refazer.' })
  } finally {
    await jobs().delete(`${id}/input`) // não guarda as fotos depois de usar
  }
}

export const config: Config = { background: true, path: '/api/banner-worker' }
