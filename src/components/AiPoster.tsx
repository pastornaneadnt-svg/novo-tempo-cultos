import { useCallback, useEffect, useRef, useState } from 'react'
import { cutoutPerson } from '../lib/cutout'
import { capitalize, fmtDateShort, hhmm, parseDate, WEEKDAYS } from '../lib/format'
import { fileToDataUrl, loadImage } from '../lib/images'
import { drawPoster, type PosterFormat, type TitleFont } from '../lib/posterCanvas'
import { copyText } from '../lib/share'
import { supabase } from '../lib/supabase'
import type { CultEvent } from '../lib/types'
import { Icon, useToast } from './ui'

type Role = 'pregador' | 'cantor' | 'grupo' | 'outra'
interface Photo {
  id: string
  role: Role
  name: string
  original: string
  cut: string // recorte (PNG) — os pixels do rosto são os da foto original
  removeBg: boolean
  status: 'cutting' | 'ok' | 'error'
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
  pastorsCut: string
}

const ROLE_LABEL: Record<Role, string> = { pregador: 'Pregador(a)', cantor: 'Cantor(a)', grupo: 'Grupo / coral', outra: 'Outra pessoa' }
const ACCENTS = [
  { name: 'Laranja', value: '#FE6402' },
  { name: 'Dourado', value: '#E8B04B' },
  { name: 'Rosa', value: '#E5408A' },
  { name: 'Branco', value: '#FFFFFF' },
]
const CHURCH_KEY = 'nt-church-v2'

function readLS<T>(k: string, fb: T): T {
  try {
    const v = localStorage.getItem(k)
    return v ? { ...fb, ...(JSON.parse(v) as T) } : fb
  } catch {
    return fb
  }
}
function writeLS(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sem espaço: segue sem salvar */
  }
}

async function call<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['x-director-token'] = token
  else {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  const res = await fetch(path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined })
  const out = await res.json().catch(() => ({ error: 'Não foi possível falar com o servidor.' }))
  if (!res.ok || out.error) throw new Error(out.error || 'Erro ao falar com a IA.')
  return out as T
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Reduz o recorte para guardar no celular sem ocupar muito espaço. */
async function shrinkPng(src: string, maxH = 900): Promise<string> {
  const im = await loadImage(src)
  const r = Math.min(1, maxH / im.naturalHeight)
  const c = document.createElement('canvas')
  c.width = Math.round(im.naturalWidth * r)
  c.height = Math.round(im.naturalHeight * r)
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

export function AiPoster({ event, token, preacher }: { event: CultEvent; token: string | null; preacher: string }) {
  const toast = useToast()
  const canvas = useRef<HTMLCanvasElement>(null)
  const d = parseDate(event.event_date)
  const [church, setChurch] = useState<Church>(() => readLS(CHURCH_KEY, { address: '', pastors: '', pastorsCut: '' }))
  const [format, setFormat] = useState<PosterFormat>('vertical')
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
  const [titleFont, setTitleFont] = useState<TitleFont>('moderna')
  const [titleScale, setTitleScale] = useState(1)
  const [accent, setAccent] = useState('#FE6402')
  const [withLogo, setWithLogo] = useState(true)
  const [bgs, setBgs] = useState<Record<PosterFormat, string[]>>({ vertical: [], quadrado: [] })
  const [bgIndex, setBgIndex] = useState<Record<PosterFormat, number>>({ vertical: -1, quadrado: -1 })
  const [change, setChange] = useState('')
  const [busy, setBusy] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const pendingRole = useRef<Role>('cantor')
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

  const bg = bgs[format][bgIndex[format]] || ''
  const hasPeople = photos.some((p) => p.status === 'ok') || (inc.fotoPastores && !!church.pastorsCut)

  // ---------- Monta o banner (instantâneo, no celular) ----------
  const render = useCallback(async () => {
    if (!canvas.current) return
    const ready = photos.filter((p) => p.status === 'ok')
    const people = await Promise.all(
      [...(inc.fotoPastores && church.pastorsCut ? [church.pastorsCut] : []), ...ready.filter((p) => p.role !== 'grupo').map((p) => (p.removeBg ? p.cut : p.original))].map(loadImage),
    )
    const groupPhoto = ready.find((p) => p.role === 'grupo')
    const group = groupPhoto ? await loadImage(groupPhoto.removeBg ? groupPhoto.cut : groupPhoto.original) : null
    const singers = ready.filter((p) => p.role === 'cantor' || p.role === 'grupo').map((p) => p.name.trim()).filter(Boolean).join(' · ')
    await drawPoster(canvas.current, {
      format,
      background: bg ? await loadImage(bg) : null,
      people,
      group,
      headline: headline.trim() || event.title,
      titleFont,
      titleScale,
      accent,
      subtitle,
      extra,
      theme: inc.tema && event.theme && event.theme.trim().toLowerCase() !== headline.trim().toLowerCase() ? event.theme : '',
      preacher: inc.pregador ? preacher : '',
      singers,
      pastors: inc.pastores ? church.pastors : '',
      verse: inc.versiculo ? event.verse || '' : '',
      date: inc.data ? `${WEEKDAYS[d.getDay()].replace('-feira', '').toUpperCase()} · ${d.toLocaleDateString('pt-BR')}` : '',
      time: inc.horario ? hhmm(event.start_time) : '',
      address: inc.local ? church.address : '',
      logo: withLogo,
    })
  }, [photos, inc, church, format, bg, headline, titleFont, titleScale, accent, subtitle, extra, event, preacher, withLogo, d])

  useEffect(() => {
    render()
  }, [render])

  // ---------- Fotos ----------
  async function addFiles(files: FileList | null, role: Role) {
    if (!files?.length) return
    for (const f of [...files].slice(0, 6)) {
      try {
        const original = await fileToDataUrl(f, 1400, 0.9)
        const id = crypto.randomUUID()
        setPhotos((p) => [...p, { id, role, name: role === 'pregador' ? preacher : '', original, cut: '', removeBg: true, status: 'cutting' }])
        cutoutPerson(original)
          .then((cut) => setPhotos((p) => p.map((x) => (x.id === id ? { ...x, cut, status: 'ok' } : x))))
          .catch(() => setPhotos((p) => p.map((x) => (x.id === id ? { ...x, status: 'ok', removeBg: false, cut: original } : x))))
      } catch (e) {
        toast((e as Error).message)
      }
    }
  }

  async function setPastorsPhoto(f: File) {
    setBusy('Recortando a foto dos pastores…')
    try {
      const original = await fileToDataUrl(f, 1400, 0.9)
      const cut = await shrinkPng(await cutoutPerson(original))
      setChurch((c) => ({ ...c, pastorsCut: cut }))
      setInc((x) => ({ ...x, fotoPastores: true }))
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  // ---------- IA ----------
  async function getText(): Promise<AiText | null> {
    setBusy('A IA está escrevendo os textos…')
    try {
      const when = `${capitalize(WEEKDAYS[d.getDay()])}, ${fmtDateShort(event.event_date)}, às ${hhmm(event.start_time)}`
      const t = await call<AiText>('/api/banner-text', token, { title: event.title, when, theme: event.theme, verse: event.verse, reading: event.main_reading, preacher })
      setAi(t)
      if (!subtitle && t.subtitulo) setSubtitle(t.subtitulo)
      if (t.legenda) setCaption(t.legenda)
      return t
    } catch (e) {
      toast((e as Error).message)
      return null
    } finally {
      setBusy('')
    }
  }

  async function runBackground(body: Record<string, unknown>) {
    setBusy(body.previous ? 'A IA está alterando a arte…' : 'A IA está criando a arte…')
    try {
      const { id } = await call<{ id: string }>('/api/banner-job', token, body)
      for (let i = 0; i < 100; i++) {
        await sleep(i < 4 ? 5000 : 3500)
        const r = await call<{ status: string; image?: string; error?: string }>(`/api/banner-job?id=${id}`, token)
        if (r.status === 'done' && r.image) {
          const f = format
          setBgs((b) => ({ ...b, [f]: [...b[f], r.image!] }))
          setBgIndex((x) => ({ ...x, [f]: bgs[f].length }))
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

  async function createArt() {
    const t = ai || (await getText())
    await runBackground({ kind: 'background', format, title: `${event.title}${event.theme ? ` — tema: ${event.theme}` : ''}`, concept: t?.conceito || '', hasPeople, reference: reference || undefined })
  }

  async function changeArt() {
    if (!bg) return toast('Crie a arte primeiro.')
    if (!change.trim()) return toast('Escreva o que você quer mudar na arte.')
    await runBackground({ kind: 'background', format, title: event.title, hasPeople, previous: bg, instruction: change.trim() })
    setChange('')
  }

  // ---------- Compartilhar ----------
  async function blob(): Promise<Blob | null> {
    if (!canvas.current) return null
    return new Promise((res) => canvas.current!.toBlob((b) => res(b), 'image/jpeg', 0.93))
  }
  async function share() {
    const b = await blob()
    if (!b) return
    try {
      const file = new File([b], `banner-${event.event_date}.jpg`, { type: 'image/jpeg' })
      if (caption) await copyText(caption)
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: caption || undefined })
      else {
        download(b)
        toast(caption ? 'Imagem baixada e legenda copiada!' : 'Imagem baixada!')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Não foi possível compartilhar.')
    }
  }
  async function download(b?: Blob | null) {
    const bb = b || (await blob())
    if (!bb) return
    const url = URL.createObjectURL(bb)
    const a = document.createElement('a')
    a.href = url
    a.download = `banner-${event.event_date}.jpg`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const chip = (k: keyof typeof inc, label: string, disabled = false) => (
    <label className={`chip ${inc[k] ? 'on' : ''}`} style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={inc[k]} disabled={disabled} onChange={(e) => setInc({ ...inc, [k]: e.target.checked })} />
      {inc[k] && !disabled ? '✓ ' : ''}
      {label}
    </label>
  )

  return (
    <>
      <div className="seg">
        <button className={format === 'vertical' ? 'on' : ''} onClick={() => setFormat('vertical')}>Vertical (post / status)</button>
        <button className={format === 'quadrado' ? 'on' : ''} onClick={() => setFormat('quadrado')}>Quadrado</button>
      </div>

      <div className="banner-preview">
        <canvas ref={canvas} className={`poster ${format}`} aria-label="Prévia do banner" />
        {busy && (
          <div className="banner-busy">
            <div className="spinner" />
            <b>{busy}</b>
            {busy.includes('arte') && <span className="tiny">Leva de 30 segundos a 2 minutos · {elapsed}s</span>}
          </div>
        )}
      </div>

      {bgs[format].length > 1 && (
        <div className="versions">
          {bgs[format].map((b, i) => (
            <button key={i} className={i === bgIndex[format] ? 'on' : ''} onClick={() => setBgIndex((x) => ({ ...x, [format]: i }))}>
              <img src={b} alt={`Arte ${i + 1}`} />
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 8 }}>
        <button className="btn grow" onClick={createArt} disabled={!!busy}>{bg ? <><Icon.refresh /> Refazer a arte</> : '✨ Criar arte com IA'}</button>
      </div>
      {!bg && <p className="tiny muted" style={{ margin: '-6px 0 0', textAlign: 'center' }}>A prévia já mostra o layout. A IA cria a arte de fundo combinando com o culto.</p>}
      {bg && (
        <div className="card stack">
          <label className="field">
            <span>Pedir alteração na arte</span>
            <textarea className="textarea" rows={2} value={change} onChange={(e) => setChange(e.target.value)} placeholder="Ex.: fundo mais escuro, tons de azul, mais luz dourada, tirar as uvas" />
          </label>
          <button className="btn dark" onClick={changeArt} disabled={!!busy || !change.trim()}>✨ Aplicar alteração</button>
          <p className="tiny muted" style={{ margin: 0 }}>Os textos, as fotos e as cores do título você muda aqui embaixo, e a prévia atualiza na hora.</p>
        </div>
      )}

      {/* Texto e estilo */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>Título e estilo</div>
        <label className="field">
          <span>Texto principal</span>
          <input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </label>
        {ai?.chamadas?.length ? (
          <div className="chips">
            {[...new Set([event.title, ...ai.chamadas])].map((c) => (
              <button key={c} type="button" className={`chip ${c === headline ? 'on' : ''}`} onClick={() => setHeadline(c)}>{c}</button>
            ))}
          </div>
        ) : (
          <button className="btn ghost sm" onClick={getText} disabled={!!busy}>✨ Sugerir títulos e legenda</button>
        )}
        <div className="field">
          <span>Fonte do título</span>
          <div className="seg">
            <button className={titleFont === 'moderna' ? 'on' : ''} onClick={() => setTitleFont('moderna')} style={{ fontWeight: 800 }}>Moderna</button>
            <button className={titleFont === 'elegante' ? 'on' : ''} onClick={() => setTitleFont('elegante')} style={{ fontFamily: '"Great Vibes", cursive', fontSize: 20 }}>Elegante</button>
          </div>
        </div>
        <div className="row between">
          <span className="small" style={{ fontWeight: 600 }}>Tamanho do título</span>
          <div className="stepper">
            <button type="button" onClick={() => setTitleScale((s) => Math.max(0.7, +(s - 0.1).toFixed(2)))} aria-label="Menor">−</button>
            <div className="val" style={{ minWidth: 60, fontSize: 15 }}>{Math.round(titleScale * 100)}%</div>
            <button type="button" onClick={() => setTitleScale((s) => Math.min(1.3, +(s + 0.1).toFixed(2)))} aria-label="Maior">+</button>
          </div>
        </div>
        <div className="field">
          <span>Cor de destaque</span>
          <div className="chips">
            {ACCENTS.map((a) => (
              <button key={a.value} type="button" className={`chip ${accent === a.value ? 'on' : ''}`} onClick={() => setAccent(a.value)}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: a.value, border: '1px solid #0002', marginRight: 6, verticalAlign: -1 }} />
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Frase de convite (opcional)</span>
          <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex.: Venha celebrar conosco!" />
        </label>
        <label className="field">
          <span>Texto extra (opcional)</span>
          <input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ex.: Traga sua família" />
        </label>
        <label className="row" style={{ cursor: 'pointer' }}>
          <span className="grow small" style={{ fontWeight: 600 }}>Logo oficial no banner</span>
          <span className={`switch ${withLogo ? 'on' : ''}`}><input type="checkbox" checked={withLogo} onChange={(e) => setWithLogo(e.target.checked)} /><i /></span>
        </label>
      </div>

      {/* O que vai no banner */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>O que vai no banner</div>
        <div className="chips">
          {chip('data', 'Data')}
          {chip('horario', 'Horário')}
          {chip('local', 'Local', !church.address)}
          {chip('tema', 'Tema', !event.theme)}
          {chip('versiculo', 'Versículo', !event.verse)}
          {chip('pregador', preacher ? `Pregador: ${preacher.split(' ').slice(0, 2).join(' ')}` : 'Pregador', !preacher)}
          {chip('pastores', 'Nome dos pastores presidentes', !church.pastors)}
          {chip('fotoPastores', 'Foto dos pastores presidentes', !church.pastorsCut)}
        </div>
        {(!church.address || !church.pastors || !church.pastorsCut) && <p className="tiny muted" style={{ margin: 0 }}>Os itens apagados precisam ser preenchidos em “Dados da igreja”, mais abaixo.</p>}
      </div>

      {/* Fotos */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>Fotos de pessoas</div>
        <p className="tiny muted" style={{ margin: 0 }}>O app só tira o fundo da foto: <b>o rosto fica exatamente igual</b>. Use fotos nítidas, de frente e da cintura para cima.</p>
        <div className="chips">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <button key={r} type="button" className="chip" onClick={() => { pendingRole.current = r; fileInput.current?.click() }}>+ {ROLE_LABEL[r]}</button>
          ))}
        </div>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files, pendingRole.current); e.target.value = '' }} />
        {photos.map((p, i) => (
          <div key={p.id} className="photo-row">
            <div className="cut-thumb">{p.status === 'cutting' ? <div className="spinner" style={{ width: 22, height: 22 }} /> : <img src={p.removeBg ? p.cut : p.original} alt="" />}</div>
            <div className="grow stack tight">
              <div className="row" style={{ gap: 6 }}>
                <select className="select" value={p.role} onChange={(e) => setPhotos(photos.map((x) => (x.id === p.id ? { ...x, role: e.target.value as Role } : x)))}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <input className="input" value={p.name} placeholder={p.role === 'pregador' ? 'Nome (já vai no “Ministrando a Palavra”)' : 'Nome (aparece no banner)'} onChange={(e) => setPhotos(photos.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
              <div className="row tiny" style={{ gap: 10 }}>
                <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={p.removeBg} onChange={(e) => setPhotos(photos.map((x) => (x.id === p.id ? { ...x, removeBg: e.target.checked } : x)))} /> Tirar o fundo
                </label>
                {i > 0 && <button className="btn ghost sm" style={{ minHeight: 28, padding: '2px 8px' }} onClick={() => setPhotos((ps) => { const n = [...ps]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })}>← Mover</button>}
              </div>
            </div>
            <button className="icon-btn plain" aria-label="Remover foto" onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}><Icon.close /></button>
          </div>
        ))}
      </div>

      {/* Referência */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>Referência de estilo (opcional)</div>
        <p className="tiny muted" style={{ margin: 0 }}>Anexe um banner de que vocês gostaram. A IA usa as cores, a luz e o clima dele na arte, sem copiar pessoas nem textos.</p>
        {reference ? (
          <div className="photo-row">
            <img src={reference} alt="Referência" className="ref-thumb" />
            <span className="grow small" style={{ fontWeight: 600 }}>Referência anexada</span>
            <button className="icon-btn plain" aria-label="Remover referência" onClick={() => setReference('')}><Icon.close /></button>
          </div>
        ) : (
          <button className="btn ghost sm" onClick={() => refInput.current?.click()}>+ Anexar referência</button>
        )}
        <input ref={refInput} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setReference(await fileToDataUrl(f)); e.target.value = '' }} />
      </div>

      {/* Dados da igreja */}
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
          {church.pastorsCut ? (
            <div className="photo-row">
              <div className="cut-thumb"><img src={church.pastorsCut} alt="Pastores presidentes" /></div>
              <span className="grow small muted">Fundo já removido. Usada quando marcado “Foto dos pastores presidentes”.</span>
              <button className="icon-btn plain" aria-label="Remover foto" onClick={() => setChurch({ ...church, pastorsCut: '' })}><Icon.close /></button>
            </div>
          ) : (
            <button className="btn ghost sm" onClick={() => pastorInput.current?.click()} disabled={!!busy}>+ Enviar foto dos pastores</button>
          )}
          <input ref={pastorInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPastorsPhoto(f); e.target.value = '' }} />
        </div>
      </div>

      {/* Legenda */}
      <div className="card stack">
        <div className="h2" style={{ fontSize: 13 }}>Legenda do post</div>
        <textarea className="textarea" rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A IA escreve a legenda quando você cria a arte." />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm grow" disabled={!caption} onClick={async () => toast((await copyText(caption)) ? 'Legenda copiada!' : 'Não foi possível copiar')}><Icon.copy /> Copiar</button>
          <button className="btn ghost sm grow" disabled={!!busy} onClick={getText}>✨ Novos textos</button>
        </div>
      </div>

      <div className="banner-actions">
        <button className="btn ghost" onClick={() => download()} disabled={!!busy}>Baixar</button>
        <button className="btn whats grow" onClick={share} disabled={!!busy}><Icon.whats /> Compartilhar</button>
      </div>
    </>
  )
}

