import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { authorized, json, openaiKey } from '../lib/shared.mts'
import type { PosterInput } from '../lib/poster.mts'

// POST: cria um pedido de banner completo e dispara o trabalho em segundo plano.
// GET ?id=: diz se o banner já ficou pronto (e devolve a imagem).
const jobs = () => getStore({ name: 'banner-jobs', consistency: 'strong' })

export default async (req: Request) => {
  if (!(await authorized(req))) return json({ error: 'Sem permissão para usar a IA.' }, 401)

  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id') || ''
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Pedido inválido.' }, 400)
    const job = (await jobs().get(id, { type: 'json' })) as { status: string; image?: string; error?: string; created: number } | null
    if (!job) return json({ status: 'working' })
    // Se o trabalho sumiu (ex.: erro no servidor), não deixa o app esperando para sempre.
    if (job.status !== 'done' && job.status !== 'error' && Date.now() - job.created > 6 * 60 * 1000)
      return json({ status: 'error', error: 'A IA demorou demais. Toque em Refazer.' })
    return json({ status: job.status, image: job.image, error: job.error })
  }

  if (!openaiKey()) return json({ error: 'A chave da OpenAI ainda não foi cadastrada no Netlify (OPENAI_API_KEY).' }, 503)
  const input = (await req.json().catch(() => null)) as PosterInput | null
  if (!input?.headline) return json({ error: 'Faltou o texto principal do banner.' }, 400)
  if ((input.photos?.length || 0) > 8) return json({ error: 'Use no máximo 8 fotos por banner.' }, 400)

  const id = crypto.randomUUID()
  const secret = crypto.randomUUID()
  await jobs().setJSON(id, { status: 'queued', created: Date.now() })
  await jobs().setJSON(`${id}/input`, { secret, input })

  const res = await fetch(new URL('/api/banner-worker', req.url), { method: 'POST', body: JSON.stringify({ id, secret }) })
  if (!res.ok && res.status !== 202) return json({ error: 'Não foi possível iniciar a IA. Tente de novo.' }, 502)
  return json({ id })
}

export const config: Config = { path: '/api/banner-job', method: ['GET', 'POST'] }
