import type { Config } from '@netlify/functions'
import { authorized, friendlyError, isModelError, json, models, openai, openaiKey } from '../lib/shared.mts'

// Cria só a IMAGEM DE FUNDO do banner. O logo e os textos são colocados pelo app,
// para seguir o manual de identidade visual (a IA não desenha logo nem letras).
export default async (req: Request) => {
  if (!(await authorized(req))) return json({ error: 'Sem permissão para usar a IA.' }, 401)
  if (!openaiKey()) return json({ error: 'A chave da OpenAI ainda não foi cadastrada no Netlify (OPENAI_API_KEY).' }, 503)

  const b = (await req.json().catch(() => ({}))) as { scene?: string; format?: string }
  const portrait = b.format !== 'feed'
  const scene = (b.scene || 'warm divine light rays through clouds over a calm landscape at sunrise').slice(0, 800)
  const prompt = `Background image for a church event poster. Scene: ${scene}.
Style: cinematic, photographic, soft and reverent, warm light. Color palette dominated by deep charcoal graphite (#283135) and vibrant orange (#FE6402) with warm amber highlights.
Composition: ${portrait ? 'vertical poster' : 'square post'}, keep large calm darker areas (top and middle) where text will be placed later; main subject subtle, toward the ${portrait ? 'lower third' : 'right side'}.
Strictly NO text, NO letters, NO numbers, NO words, NO logos, NO watermarks, NO frames. No close-up faces.`

  for (const model of models('OPENAI_IMAGE_MODEL', ['gpt-image-1', 'gpt-image-1-mini'])) {
    const { ok, status, data } = await openai('images/generations', {
      model,
      prompt,
      size: portrait ? '1024x1536' : '1024x1024',
      quality: Netlify.env.get('OPENAI_IMAGE_QUALITY') || 'medium',
      output_format: 'jpeg',
      output_compression: 85,
      n: 1,
    })
    if (ok) {
      const b64 = data.data?.[0]?.b64_json
      if (b64) return json({ image: `data:image/jpeg;base64,${b64}` })
      const url = data.data?.[0]?.url
      if (url) return json({ image: url })
      return json({ error: 'A IA não devolveu a imagem. Tente de novo.' }, 502)
    }
    if (!isModelError(status, data)) return json({ error: friendlyError(status, data) }, 502)
  }
  return json({ error: 'Nenhum modelo de imagem da OpenAI disponível nesta conta.' }, 502)
}

export const config: Config = { path: '/api/banner-image', method: 'POST' }
