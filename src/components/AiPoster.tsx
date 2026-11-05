import { useEffect, useRef, useState } from 'react'
import { capitalize, fmtDateShort, hhmm, parseDate, WEEKDAYS } from '../lib/format'
import { dataUrlToBlob, fileToDataUrl, stampLogo } from '../lib/images'
import { copyText } from '../lib/share'
import { supabase } from '../lib/supabase'
import type { CultEvent } from '../lib/types'
import { Icon, useToast } from './ui'

type Role = 'pastores' | 'pregador' | 'cantor' | 'grupo' | 'outra'
interface Photo {
  id: string
  role: Role
  name: string
  data: string
}
interface AiText {
  chamadas: string[]
  subtitulo: string
  legenda: string
  conceito?: string
}
interface Church {
  address: string
  pastors: string
  pastorsPhoto: string
}
interface Version {
  raw: string
  final: string
  note: string
}

const ROLE_LABEL: Record<Role, string> = {
  pastores: 'Pastores presidentes',
  pregador: 'Pregador(a)',
  cantor: 'Cantor(a)',
  grupo: 'Grupo / coral',
  outra: 'Outra imagem',
}

const CHURCH_KEY = 'nt-church'
const readLS = <T,>(k: string, fb: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? { ...fb, ...(JSON.parse(v) as T) } : fb
  } catch {
    return fb
  }
}
const writeLS = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sem espaço: segue sem salvar */
  }
}

async function authHeaders(token: string | null): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['x-director-token'] = token
  else {
    const { data } = await supabase.auth.getSession()
    if (data.session) h.Authorization = `Bearer ${data.session.access_token}`
  }
  return h
}

async function api<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: body ? 'POST' : 'GET', headers: await authHeaders(token), body: body ? JSON.stringify(body) : undefined })
  const out = await res.json().catch(() => ({ error: 'Não foi possível falar com o servidor.' }))
  if (!res.ok || out.error) throw new Error(out.error || 'Erro ao falar com a IA.')
  return out as T
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function AiPoster({ event, token, preacher }: { event: CultEvent; token: string | null; preacher: string }) {
  const toast = useToast()
  const [church, setChurch] = useState<Church>(() => readLS(CHURCH_KEY, { address: '', pastors: '', pastorsPhoto: '' }))
  const [format, setFormat] = useState<'vertical' | 'quadrado'>('vertical')
  const d = parseDate(event.event_date)
  const [inc, setInc] = useState({
    data: true,
    horario: true,
    local: true,
    tema: !!event.theme,
    versiculo: !!event.verse,
    pregador: !!preacher,
    pastores: true,
    fotoPastores: true,
  })
  const [photos, setPhotos] = useState<Photo[]>([])
  const [reference, setReference] = useState('')
  const [ai, setAi] = useState<AiText | null>(null)
  const [headline, setHeadline] = useState(event.title)
  const [subtitle, setSubtitle] = useState('')
  const [extra, setExtra] = useState('')
  const [caption, setCaption] = useState('')
  const [withLogo, setWithLogo] = useState(true)
  const [versions, setVersions] = useState<Version[]>([])
  const [current, setCurrent] = useState(-1)
  const [change, setChange] = useState('')
  const [busy, setBusy] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const pendingRole = useRef<Role>('outra')
  const fileInput = useRef<HTMLInputElement>(null)
  const refInput = useRef<HTMLInputElement>(null)
  const pastorInput = useRef<HTMLInputElement>(null)

  useEffect(() => writeLS(CHURCH_KEY, church), [church])
  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

  const shown = versions[current]

  // Reaplica o logo quando liga/desliga
  useEffect(() => {
    if (!shown) return
    stampLogo(shown.raw, withLogo).then((final) => setVersions((v) => v.map((x, i) => (i === current ? { ...x, final } : x))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withLogo])

  async function addFiles(files: FileList | null, role: Role) {
    if (!files?.length) return
    try {
      const list = await Promise.all([...files].slice(0, 8).map((f) => fileToDataUrl(f)))
      setPhotos((p) => [...p, ...list.map((data) => ({ id: crypto.randomUUID(), role, name: role === 'pregador' ? preacher : '', data }))].slice(0, 8))
    } catch (e) {
      toast((e as Error).message)
    }
  }

  // Textos que a IA acabou de sugerir ainda não chegaram no estado: usa direto.
  const fresh = useRef<{ headline?: string; subtitle?: string }>({})

  async function getText(): Promise<AiText | null> {
    setBusy('Escrevendo os textos…')
    try {
      const when = `${capitalize(WEEKDAYS[d.getDay()])}, ${fmtDateShort(event.event_date)}, às ${hhmm(event.start_time)}`
      const t = await api<AiText>('/api/banner-text', token, { title: event.title, when, theme: event.theme, verse: event.verse, reading: event.main_reading, preacher })
      setAi(t)
      fresh.current = {}
      if (t.chamadas[0] && headline === event.title && !versions.length) {
        const h = t.chamadas.includes(event.title) ? event.title : t.chamadas[0]
        setHeadline(h)
        fresh.current.headline = h
      }
      if (t.subtitulo && !subtitle) {
        setSubtitle(t.subtitulo)
        fresh.current.subtitle = t.subtitulo
      }
      if (t.legenda) setCaption(t.legenda)
      return t
    } catch (e) {
      toast((e as Error).message)
      return null
    } finally {
      setBusy('')
    }
  }

  function buildInput(t: AiText | null, edit?: { previous: string; instruction: string }) {
    const all: Omit<Photo, 'id'>[] = [
      ...(inc.fotoPastores && church.pastorsPhoto ? [{ role: 'pastores' as Role, name: church.pastors, data: church.pastorsPhoto }] : []),
      ...photos,
    ]
    return {
      format,
      title: event.title,
      headline: (fresh.current.headline ?? headline).trim() || event.title,
      subtitle: (fresh.current.subtitle ?? subtitle).trim(),
      concept: t?.conceito || '',
      info: {
        data: inc.data ? `${capitalize(WEEKDAYS[d.getDay()])} · ${d.toLocaleDateString('pt-BR')}` : '',
        horario: inc.horario ? `Às ${hhmm(event.start_time)}h` : '',
        local: inc.local ? church.address : '',
        tema: inc.tema ? event.theme || '' : '',
        versiculo: inc.versiculo ? event.verse || '' : '',
        pregador: inc.pregador ? preacher : '',
        pastores: inc.pastores ? church.pastors : '',
        extra: extra.trim(),
      },
      photos: all.map(({ role, name, data }) => ({ role, name, data })),
      reference: reference || undefined,
      previous: edit?.previous,
      instruction: edit?.instruction,
    }
  }

  async function runJob(input: ReturnType<typeof buildInput>, note: string) {
    setBusy(input.previous ? 'Aplicando a alteração…' : 'Criando o banner…')
    try {
      const { id } = await api<{ id: string }>('/api/banner-job', token, input)
      for (let i = 0; i < 100; i++) {
        await sleep(i < 5 ? 5000 : 3500)
        const r = await api<{ status: string; image?: string; error?: string }>(`/api/banner-job?id=${id}`, token)
        if (r.status === 'done' && r.image) {
          const final = await stampLogo(r.image, withLogo)
          setVersions((v) => {
            const next = [...v, { raw: r.image!, final, note }]
            setCurrent(next.length - 1)
            return next
          })
          return
        }
        if (r.status === 'error') throw new Error(r.error || 'A IA não conseguiu gerar.')
      }
      throw new Error('Demorou demais. Toque em Refazer.')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function create() {
    if (inc.local && !church.address.trim()) return toast('Preencha o endereço da igreja (ou desmarque “Local”).')
    const t = ai || (await getText())
    const input = buildInput(t)
    fresh.current = {}
    await runJob(input, versions.length ? 'Refeito' : 'Primeira versão')
  }

  async function applyChange() {
    if (!shown || !change.trim()) return toast('Escreva o que você quer mudar.')
    await runJob(buildInput(ai, { previous: shown.raw, instruction: change.trim() }), change.trim())
    setChange('')
  }

  async function share() {
    if (!shown) return
    try {
      const blob = await dataUrlToBlob(shown.final)
      const file = new File([blob], `banner-${event.event_date}.jpg`, { type: 'image/jpeg' })
      if (caption) await copyText(caption)
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: caption || undefined })
      else {
        download()
        toast(caption ? 'Imagem baixada e legenda copiada!' : 'Imagem baixada!')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Não foi possível compartilhar.')
    }
  }

  function download() {
    if (!shown) return
    const a = document.createElement('a')
    a.href = shown.final
    a.download = `banner-${event.event_date}.jpg`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const check = (k: keyof typeof inc, label: string, disabled = false, hint = '') => (
    <label className={`chip ${inc[k] ? 'on' : ''}`} style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }} title={hint}>
      <input type="checkbox" checked={inc[k]} disabled={disabled} onChange={(e) => setInc({ ...inc, [k]: e.target.checked })} style={{ display: 'none' }} />
      {inc[k] ? '✓ ' : ''}
      {label}
    </label>
  )

  return (
    <>
      {/* Resultado */}
      <div className="poster-preview">
        {shown ? (
          <img src={shown.final} alt="Banner gerado pela IA" className={format} />
        ) : (
          <div className={`poster-empty ${format}`}>
            <img src="/simbolo-branco.png" alt="" style={{ width: 54, opacity: 0.9 }} />
            <b>Seu banner aparece aqui</b>
            <span className="tiny">Escolha o que vai no banner e toque em “Criar banner”.</span>
          </div>
        )}
        {busy && (
          <div className="banner-busy">
            <div className="spinner" />
            <b>{busy}</b>
            <span className="tiny">{busy.startsWith('Escrevendo') ? '' : `A IA leva de 1 a 3 minutos · ${elapsed}s`}</span>
          </div>
        )}
      </div>

      {versions.length > 1 && (
        <div className="versions">
          {versions.map((v, i) => (
            <button key={i} className={i === current ? 'on' : ''} onClick={() => setCurrent(i)} title={v.note}>
              <img src={v.final} alt={`Versão ${i + 1}`} />
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {shown ? (
        <div className="card stack">
          <div className="row" style={{ gap: 8 }}>
            <button className="btn secondary grow" onClick={create} disabled={!!busy}><Icon.refresh /> Refazer</button>
            <label className="row small" style={{ gap: 8, cursor: 'pointer', fontWeight: 600 }}>
              Logo
              <span className={`switch ${withLogo ? 'on' : ''}`}><input type="checkbox" checked={withLogo} onChange={(e) => setWithLogo(e.target.checked)} /><i /></span>
            </label>
          </div>
          <label className="field">
            <span>Pedir uma alteração</span>
            <textarea className="textarea" rows={2} value={change} onChange={(e) => setChange(e.target.value)} placeholder="Ex.: deixe o título maior, troque o fundo para tons de azul, corrija a palavra “Ceia”" />
          </label>
          <button className="btn dark" onClick={applyChange} disabled={!!busy || !change.trim()}>✨ Aplicar alteração</button>
        </div>
      ) : (
        <button className="btn block" onClick={create} disabled={!!busy}>✨ Criar banner com IA</button>
      )}

      <div className="seg">
        <button className={format === 'vertical' ? 'on' : ''} onClick={() => setFormat('vertical')}>Vertical (post / status)</button>
        <button className={format === 'quadrado' ? 'on' : ''} onClick={() => setFormat('quadrado')}>Quadrado</button>
      </div>

      {/* O que vai no banner */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>O que vai no banner</div>
        <div className="chips">
          {check('data', 'Data')}
          {check('horario', 'Horário')}
          {check('local', 'Local')}
          {check('tema', 'Tema', !event.theme, 'Defina o tema nas informações do culto')}
          {check('versiculo', 'Versículo', !event.verse, 'Defina o versículo nas informações do culto')}
          {check('pregador', preacher ? `Pregador: ${preacher.split(' ').slice(0, 2).join(' ')}` : 'Pregador', !preacher, 'Escolha o pregador na programação')}
          {check('pastores', 'Nome dos pastores presidentes')}
          {check('fotoPastores', 'Foto dos pastores presidentes', !church.pastorsPhoto)}
        </div>
        <label className="field">
          <span>Texto principal (título)</span>
          <input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </label>
        {ai?.chamadas?.length ? (
          <div className="chips">
            {[...new Set([event.title, ...ai.chamadas])].map((c) => (
              <button key={c} type="button" className={`chip ${c === headline ? 'on' : ''}`} onClick={() => setHeadline(c)}>{c}</button>
            ))}
          </div>
        ) : null}
        <label className="field">
          <span>Frase de convite (opcional)</span>
          <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex.: Venha celebrar conosco!" />
        </label>
        <label className="field">
          <span>Texto extra (opcional)</span>
          <input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ex.: Traga sua família · Haverá batismo" />
        </label>
      </div>

      {/* Fotos */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>Fotos para o banner</div>
        <p className="tiny muted" style={{ margin: 0 }}>A IA recorta as pessoas e coloca no banner. Use fotos nítidas, de frente.</p>
        <div className="chips">
          {(['pregador', 'cantor', 'grupo', 'outra'] as Role[]).map((r) => (
            <button key={r} type="button" className="chip" onClick={() => { pendingRole.current = r; fileInput.current?.click() }}>+ {ROLE_LABEL[r]}</button>
          ))}
        </div>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files, pendingRole.current); e.target.value = '' }} />
        {photos.map((p) => (
          <div key={p.id} className="photo-row">
            <img src={p.data} alt="" />
            <div className="grow stack tight">
              <select className="select" value={p.role} onChange={(e) => setPhotos(photos.map((x) => (x.id === p.id ? { ...x, role: e.target.value as Role } : x)))}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <input className="input" value={p.name} placeholder="Nome (aparece no banner)" onChange={(e) => setPhotos(photos.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
            </div>
            <button className="icon-btn plain" aria-label="Remover foto" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}><Icon.close /></button>
          </div>
        ))}
      </div>

      {/* Referência */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>Referência (opcional)</div>
        <p className="tiny muted" style={{ margin: 0 }}>Anexe um banner que vocês gostaram (de outra igreja, por exemplo). A IA segue o estilo, sem copiar textos nem pessoas.</p>
        {reference ? (
          <div className="photo-row">
            <img src={reference} alt="Referência" />
            <span className="grow small" style={{ fontWeight: 600 }}>Referência de estilo</span>
            <button className="icon-btn plain" aria-label="Remover referência" onClick={() => setReference('')}><Icon.close /></button>
          </div>
        ) : (
          <button className="btn ghost sm" onClick={() => refInput.current?.click()}>+ Anexar referência</button>
        )}
        <input ref={refInput} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setReference(await fileToDataUrl(f)); e.target.value = '' }} />
      </div>

      {/* Dados fixos da igreja */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>Dados da igreja (ficam salvos)</div>
        <label className="field">
          <span>Endereço</span>
          <input className="input" value={church.address} onChange={(e) => setChurch({ ...church, address: e.target.value })} placeholder="Ex.: Rua Capitão Miguel Ferreira nº 520 - Vila Lambari - Mococa SP" />
        </label>
        <label className="field">
          <span>Pastores presidentes</span>
          <input className="input" value={church.pastors} onChange={(e) => setChurch({ ...church, pastors: e.target.value })} placeholder="Ex.: Pastor Claudomiro e Pastora Cimeia" />
        </label>
        <div className="field">
          <span>Foto dos pastores presidentes</span>
          {church.pastorsPhoto ? (
            <div className="photo-row">
              <img src={church.pastorsPhoto} alt="Pastores presidentes" />
              <span className="grow small muted">Usada nos banners quando marcado “Foto dos pastores presidentes”.</span>
              <button className="icon-btn plain" aria-label="Remover foto" onClick={() => setChurch({ ...church, pastorsPhoto: '' })}><Icon.close /></button>
            </div>
          ) : (
            <button className="btn ghost sm" onClick={() => pastorInput.current?.click()}>+ Enviar foto dos pastores</button>
          )}
          <input ref={pastorInput} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setChurch({ ...church, pastorsPhoto: await fileToDataUrl(f, 900, 0.82) }); setInc((x) => ({ ...x, fotoPastores: true })) } e.target.value = '' }} />
        </div>
      </div>

      {/* Legenda */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>Legenda do post</div>
        <textarea className="textarea" rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A IA escreve a legenda quando você cria o banner." />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm grow" disabled={!caption} onClick={async () => toast((await copyText(caption)) ? 'Legenda copiada!' : 'Não foi possível copiar')}><Icon.copy /> Copiar</button>
          <button className="btn ghost sm grow" disabled={!!busy} onClick={getText}>✨ Novos textos</button>
        </div>
      </div>

      {shown && (
        <div className="banner-actions">
          <button className="btn ghost" onClick={download} disabled={!!busy}>Baixar</button>
          <button className="btn whats grow" onClick={share} disabled={!!busy}><Icon.whats /> Compartilhar</button>
        </div>
      )}
    </>
  )
}
