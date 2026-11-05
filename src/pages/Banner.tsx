import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { canvasBlob, drawBanner, loadImg, type BannerFormat, type BannerStyle } from '../lib/banner'
import { capitalize, fmtDateLong, hhmm, parseDate, WEEKDAYS } from '../lib/format'
import { copyText } from '../lib/share'
import { supabase } from '../lib/supabase'
import type { EventBundle } from '../lib/types'
import { Icon, Spinner, useToast } from '../components/ui'
import { InvalidLink } from './EventPage'

interface AiText {
  chamadas: string[]
  subtitulo: string
  legenda: string
  imagem: string
}

const FOOTER_KEY = 'nt-banner-footer'
const textKey = (id: string) => `nt-banner-text-${id}`

function readLS<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function writeLS(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

async function callAi<T>(path: string, body: unknown, token: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['x-director-token'] = token
  else {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) })
  const out = await res.json().catch(() => ({ error: 'Não foi possível falar com o servidor.' }))
  if (!res.ok || out.error) throw new Error(out.error || 'Erro ao falar com a IA.')
  return out as T
}

function eyebrowFor(date: string, time: string) {
  const d = parseDate(date)
  const [h, m] = hhmm(time).split(':')
  return `${WEEKDAYS[d.getDay()].replace('-feira', '')} · ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${Number(h)}H${m !== '00' ? m : ''}`
}

export function BannerAdminPage() {
  const { id = '' } = useParams()
  return <BannerPage eventId={id} token={null} />
}

export function BannerDirectorPage() {
  const { token = '' } = useParams()
  const [id, setId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    api.directorEvent(token).then(setId).catch(() => setId(null))
  }, [token])
  if (id === undefined) return <Spinner />
  if (!id) return <InvalidLink />
  return <BannerPage eventId={id} token={token} />
}

function BannerPage({ eventId, token }: { eventId: string; token: string | null }) {
  const toast = useToast()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<EventBundle | null | undefined>(undefined)
  const [format, setFormat] = useState<BannerFormat>('stories')
  const [style, setStyle] = useState<BannerStyle>('ia')
  const [ai, setAi] = useState<AiText | null>(() => readLS<AiText | null>(textKey(eventId), null))
  const [bg, setBg] = useState<Record<BannerFormat, HTMLImageElement | null>>({ stories: null, feed: null })
  const [headline, setHeadline] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [caption, setCaption] = useState('')
  const [showTheme, setShowTheme] = useState(true)
  const [showPreacher, setShowPreacher] = useState(true)
  const [footer, setFooter] = useState(() => readLS<string>(FOOTER_KEY, ''))
  const [busy, setBusy] = useState<'' | 'text' | 'image'>('')

  useEffect(() => {
    api.getEvent(eventId, token).then(setData).catch(() => setData(null))
  }, [eventId, token])

  const event = data?.event
  const preacher = useMemo(() => data?.items.find((i) => i.kind === 'pregacao')?.person?.name || '', [data])

  // Preenche os textos iniciais (da IA salva, ou do próprio culto)
  useEffect(() => {
    if (!event) return
    setHeadline((h) => h || ai?.chamadas[0] || event.theme || event.title)
    setSubtitle((s) => s || ai?.subtitulo || 'Venha celebrar conosco!')
    setCaption((c) => c || ai?.legenda || '')
  }, [event, ai])

  useEffect(() => writeLS(FOOTER_KEY, footer), [footer])

  const redraw = useCallback(async () => {
    if (!canvas.current || !event) return
    await drawBanner(canvas.current, {
      format,
      style,
      background: bg[format],
      eyebrow: eyebrowFor(event.event_date, event.start_time),
      headline: headline || event.title,
      subtitle,
      theme: showTheme && event.theme && event.theme.trim().toLowerCase() !== headline.trim().toLowerCase() ? event.theme : '',
      preacher: showPreacher ? preacher : '',
      footer,
    })
  }, [event, format, style, bg, headline, subtitle, showTheme, showPreacher, preacher, footer])

  useEffect(() => {
    redraw()
  }, [redraw])

  if (data === undefined) return <Spinner />
  if (data === null || !event) return <InvalidLink />

  const when = `${capitalize(fmtDateLong(event.event_date))}, às ${hhmm(event.start_time)}`
  const back = token ? `/d/${token}` : `/culto/${event.id}`

  async function genText(): Promise<AiText | null> {
    setBusy('text')
    try {
      const t = await callAi<AiText>(
        '/api/banner-text',
        { title: event!.title, when, theme: event!.theme, verse: event!.verse, reading: event!.main_reading, preacher },
        token,
      )
      setAi(t)
      writeLS(textKey(event!.id), t)
      if (t.chamadas[0]) setHeadline(t.chamadas[0])
      if (t.subtitulo) setSubtitle(t.subtitulo)
      if (t.legenda) setCaption(t.legenda)
      return t
    } catch (e) {
      toast((e as Error).message)
      return null
    } finally {
      setBusy('')
    }
  }

  async function genImage(scene?: string) {
    setBusy('image')
    try {
      const r = await callAi<{ image: string }>('/api/banner-image', { scene: scene || ai?.imagem || event!.theme, format }, token)
      const img = await loadImg(r.image)
      setBg((b) => ({ ...b, [format]: img }))
      setStyle('ia')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function genAll() {
    const t = ai || (await genText())
    if (t) await genImage(t.imagem)
  }

  async function share() {
    if (!canvas.current) return
    try {
      const blob = await canvasBlob(canvas.current)
      const file = new File([blob], `banner-${event!.event_date}-${format}.jpg`, { type: 'image/jpeg' })
      if (caption) await copyText(caption)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption || undefined })
      } else {
        download(blob, file.name)
        toast(caption ? 'Imagem baixada e legenda copiada!' : 'Imagem baixada!')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Não foi possível compartilhar: ' + (e as Error).message)
    }
  }

  async function save() {
    if (!canvas.current) return
    const blob = await canvasBlob(canvas.current)
    download(blob, `banner-${event!.event_date}-${format}.jpg`)
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const hasBg = !!bg[format]

  return (
    <div className="app">
      <header className="topbar">
        <Link to={back} className="icon-btn" aria-label="Voltar"><Icon.back /></Link>
        <div className="title">
          <div className="t1">Divulgação</div>
          <div className="t2">{event.title} · {when}</div>
        </div>
      </header>
      <main className="page">
        <div className="seg">
          <button className={format === 'stories' ? 'on' : ''} onClick={() => setFormat('stories')}>Stories / Status</button>
          <button className={format === 'feed' ? 'on' : ''} onClick={() => setFormat('feed')}>Feed / Grupo</button>
        </div>

        <div className="banner-preview">
          <canvas ref={canvas} className={format} aria-label="Prévia do banner" />
          {busy && (
            <div className="banner-busy">
              <div className="spinner" />
              <b>{busy === 'text' ? 'A IA está escrevendo os textos…' : 'A IA está criando a imagem…'}</b>
              {busy === 'image' && <span className="tiny">Pode levar até 1 minuto</span>}
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn grow" onClick={genAll} disabled={!!busy}>✨ {hasBg ? 'Gerar outra imagem' : 'Criar banner com IA'}</button>
        </div>
        {hasBg && (
          <button className="btn ghost sm" onClick={() => genImage()} disabled={!!busy} style={{ marginTop: -8 }}>Usar a mesma ideia e gerar outra imagem</button>
        )}

        <div className="field">
          <span>Fundo</span>
          <div className="seg">
            <button className={style === 'ia' ? 'on' : ''} onClick={() => setStyle('ia')}>✨ Imagem IA</button>
            <button className={style === 'laranja' ? 'on' : ''} onClick={() => setStyle('laranja')}>Laranja</button>
            <button className={style === 'grafite' ? 'on' : ''} onClick={() => setStyle('grafite')}>Grafite</button>
          </div>
          {style === 'ia' && !hasBg && <div className="tiny muted">Toque em “Criar banner com IA” para gerar a imagem de fundo. Enquanto isso, a prévia usa o fundo grafite.</div>}
        </div>

        <div className="card stack">
          <div className="h2" style={{ fontSize: 13 }}>Textos do banner</div>
          {ai?.chamadas?.length ? (
            <div className="field">
              <span>Sugestões da IA</span>
              <div className="chips">
                {ai.chamadas.map((c) => (
                  <button key={c} type="button" className={`chip ${c === headline ? 'on' : ''}`} onClick={() => setHeadline(c)}>{c}</button>
                ))}
              </div>
            </div>
          ) : null}
          <label className="field">
            <span>Chamada</span>
            <input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </label>
          <label className="field">
            <span>Frase de convite</span>
            <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </label>
          <label className="row" style={{ cursor: 'pointer' }}>
            <span className="grow small" style={{ fontWeight: 600 }}>Mostrar o tema do culto</span>
            <span className={`switch ${showTheme ? 'on' : ''}`}><input type="checkbox" checked={showTheme} onChange={(e) => setShowTheme(e.target.checked)} /><i /></span>
          </label>
          {preacher && (
            <label className="row" style={{ cursor: 'pointer' }}>
              <span className="grow small" style={{ fontWeight: 600 }}>Mostrar o pregador ({preacher})</span>
              <span className={`switch ${showPreacher ? 'on' : ''}`}><input type="checkbox" checked={showPreacher} onChange={(e) => setShowPreacher(e.target.checked)} /><i /></span>
            </label>
          )}
          <label className="field">
            <span>Rodapé (endereço / @instagram)</span>
            <input className="input" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Ex.: Rua Exemplo, 000 · @adnovotempo" />
          </label>
          <button className="btn secondary sm" onClick={genText} disabled={!!busy}>✨ Sugerir novos textos</button>
        </div>

        <div className="card stack">
          <div className="h2" style={{ fontSize: 13 }}>Legenda do post</div>
          <textarea className="textarea" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Toque em “Criar banner com IA” para a IA escrever a legenda." />
          <button className="btn ghost sm" disabled={!caption} onClick={async () => toast((await copyText(caption)) ? 'Legenda copiada!' : 'Não foi possível copiar')}><Icon.copy /> Copiar legenda</button>
        </div>
      </main>

      <div className="banner-actions">
        <button className="btn ghost" onClick={save} disabled={!!busy}>Baixar</button>
        <button className="btn whats grow" onClick={share} disabled={!!busy}><Icon.whats /> Compartilhar</button>
      </div>
    </div>
  )
}
