// Funções compartilhadas pelas rotas de IA (banner de divulgação).

// Valores públicos (os mesmos do app). Podem ser trocados pelas variáveis do Netlify.
const SUPABASE_URL = Netlify.env.get('VITE_SUPABASE_URL') || 'https://vglpznssbpcigetghovq.supabase.co'
const SUPABASE_KEY = Netlify.env.get('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_aNsTVNeZY14tddGDfUvXEQ_m-Sv-X0m'

export function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

async function rpc(fn: string, args: Record<string, unknown>, jwt?: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) return null
  return res.json()
}

/**
 * Só o pastor (logado) ou um dirigente (com o link dele) pode usar a IA,
 * para ninguém de fora gastar créditos da conta.
 */
export async function authorized(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (jwt && (await rpc('is_admin', {}, jwt)) === true) return true
  const director = req.headers.get('x-director-token') || ''
  if (/^[0-9a-f-]{36}$/i.test(director) && (await rpc('director_event', { p_token: director }))) return true
  return false
}

export function openaiKey(): string | undefined {
  return Netlify.env.get('OPENAI_API_KEY') || undefined
}

/** Tenta os modelos em ordem: o configurado no Netlify primeiro, depois os padrões. */
export function models(envName: string, defaults: string[]): string[] {
  const custom = Netlify.env.get(envName)
  return [...(custom ? [custom] : []), ...defaults.filter((m) => m !== custom)]
}

export async function openai(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey()}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

/** Erro de modelo inexistente/sem acesso: aí vale tentar o próximo da lista. */
export function isModelError(status: number, data: { error?: { code?: string; message?: string } }) {
  const code = data?.error?.code || ''
  const msg = (data?.error?.message || '').toLowerCase()
  return status === 404 || code === 'model_not_found' || (status === 400 && msg.includes('model')) || (status === 403 && msg.includes('model'))
}

export function friendlyError(status: number, data: { error?: { message?: string; code?: string } }) {
  const code = data?.error?.code || ''
  if (status === 401) return 'A chave da OpenAI não foi aceita. Confira a chave cadastrada no Netlify.'
  if (status === 429 && code === 'insufficient_quota') return 'A conta da OpenAI está sem créditos. Adicione créditos em platform.openai.com.'
  if (status === 429) return 'Muitos pedidos seguidos. Espere um minutinho e tente de novo.'
  if (code === 'moderation_blocked' || /safety|moderation/i.test(data?.error?.message || '')) return 'A IA recusou essa imagem. Tente gerar de novo.'
  return 'A IA não conseguiu gerar agora. Tente de novo em instantes.'
}
