import type { Config } from '@netlify/functions'
import { authorized, friendlyError, isModelError, json, models, openai, openaiKey } from '../lib/shared.mts'

// Cria as chamadas, o subtítulo, a legenda e a descrição da imagem de fundo do banner.
export default async (req: Request) => {
  if (!(await authorized(req))) return json({ error: 'Sem permissão para usar a IA.' }, 401)
  if (!openaiKey()) return json({ error: 'A chave da OpenAI ainda não foi cadastrada no Netlify (OPENAI_API_KEY).' }, 503)

  const b = (await req.json().catch(() => ({}))) as Record<string, string>
  const info = [
    `Igreja: AD Novo Tempo (Assembleia de Deus, igreja evangélica pentecostal)`,
    `Evento: ${b.title || 'Culto'}`,
    `Data e hora: ${b.when || ''}`,
    b.theme && `Tema do culto: ${b.theme}`,
    b.verse && `Versículo do tema: ${b.verse}`,
    b.reading && `Leitura principal: ${b.reading}`,
    b.preacher && `Pregador: ${b.preacher}`,
  ]
    .filter(Boolean)
    .join('\n')

  const system = `Você cria textos de divulgação para os cultos de uma igreja evangélica pentecostal brasileira (Assembleia de Deus).
Linguagem: português do Brasil, reverente, calorosa e convidativa, fiel à Bíblia. Nada de gírias forçadas nem promessas exageradas.
Responda SOMENTE com um JSON válido, neste formato:
{
  "chamadas": ["3 chamadas curtas e fortes para o banner, de 2 a 6 palavras cada, sem ponto final"],
  "subtitulo": "uma frase curta de convite (até 12 palavras)",
  "legenda": "legenda para WhatsApp/Instagram com 3 a 6 linhas: convite, tema, dia e horário, uma frase do versículo se houver, e no final #ADNovoTempo e mais 2 hashtags. Pode usar poucos emojis.",
  "imagem": "descrição EM INGLÊS de uma cena simbólica e bonita para o FUNDO do banner, ligada ao tema (ex.: luz, natureza, céu, símbolos bíblicos). Sem pessoas em close, sem texto, sem letras, sem logotipos.",
  "conceito": "EM INGLÊS, 2 a 4 frases: o que é este culto/evento (ex.: Santa Ceia = comunhão, pão, uvas, cálice; Chá de Mulheres = delicadeza, flores; culto de jovens = energia; culto de missões = mundo, chamado), o clima visual, os elementos simbólicos e a paleta de cores sugerida para o banner."
}
As chamadas devem combinar com o TIPO de evento (ex.: para "Culto de Santa Ceia", uma das chamadas pode ser o próprio "Culto de Santa Ceia").`

  for (const model of models('OPENAI_TEXT_MODEL', ['gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini'])) {
    const { ok, status, data } = await openai('chat/completions', {
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: info },
      ],
    })
    if (ok) {
      try {
        const out = JSON.parse(data.choices?.[0]?.message?.content || '{}')
        return json({
          chamadas: (Array.isArray(out.chamadas) ? out.chamadas : []).map(String).slice(0, 3),
          subtitulo: String(out.subtitulo || ''),
          legenda: String(out.legenda || ''),
          imagem: String(out.imagem || ''),
          conceito: String(out.conceito || ''),
        })
      } catch {
        return json({ error: 'A IA respondeu num formato inesperado. Tente de novo.' }, 502)
      }
    }
    if (!isModelError(status, data)) return json({ error: friendlyError(status, data) }, 502)
  }
  return json({ error: 'Nenhum modelo de texto da OpenAI disponível nesta conta.' }, 502)
}

export const config: Config = { path: '/api/banner-text', method: 'POST' }
