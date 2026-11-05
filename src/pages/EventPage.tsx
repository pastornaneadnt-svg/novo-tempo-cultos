import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { KindDef } from '../lib/catalog'
import { capitalize, fmtDateShort, hhmm, parseDate, WEEKDAYS, programItems, supportItems, toMin, withTimes } from '../lib/format'
import { copyText, directorLink, directorMessage, whatsappUrl } from '../lib/share'
import type { EventBundle, Item } from '../lib/types'
import { AddItemSheet } from '../components/AddItemSheet'
import { EventFormSheet } from '../components/EventFormSheet'
import { ItemSheet } from '../components/ItemSheet'
import { Timeline, TimeBar } from '../components/Timeline'
import { Icon, Sheet, Spinner, usePolling, useToast } from '../components/ui'

export function DirectorPage() {
  const { token = '' } = useParams()
  const [id, setId] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    api.directorEvent(token).then(setId).catch(() => setId(null))
  }, [token])
  if (id === undefined) return <Spinner />
  if (!id) return <InvalidLink />
  return <EventEditor eventId={id} token={token} />
}

export function EventPage() {
  const { id = '' } = useParams()
  return <EventEditor eventId={id} token={null} />
}

export function InvalidLink() {
  return (
    <div className="center-screen">
      <div className="card stack" style={{ maxWidth: 420, textAlign: 'center' }}>
        <img src="/simbolo-cor.png" alt="" style={{ width: 48, alignSelf: 'center' }} />
        <div className="h2">Link inválido ou expirado</div>
        <p className="muted small">Este link não funciona mais. Peça um novo link ao pastor.</p>
      </div>
    </div>
  )
}

type Open =
  | { t: 'item'; item: Item; start: number | null }
  | { t: 'add'; section: 'programa' | 'apoio' }
  | { t: 'info' }
  | { t: 'menu' }
  | { t: 'director' }
  | null

function EventEditor({ eventId, token }: { eventId: string; token: string | null }) {
  const nav = useNavigate()
  const toast = useToast()
  const [data, setData] = useState<EventBundle | null | undefined>(undefined)
  const [tab, setTab] = useState<'programa' | 'apoio'>('programa')
  const [open, setOpen] = useState<Open>(null)

  const load = useCallback(async () => {
    try {
      setData(await api.getEvent(eventId, token))
    } catch {
      setData((d) => (d === undefined ? null : d))
    }
  }, [eventId, token])

  useEffect(() => {
    load()
  }, [load])
  usePolling(load, 20000, open === null)

  if (data === undefined) return <Spinner />
  if (data === null) return <InvalidLink />

  const { event, items, is_admin } = data
  const prog = programItems(items)
  const sup = supportItems(items)
  const rows = withTimes(event, prog)
  const start = toMin(event.start_time)
  const end = toMin(event.end_time)
  const filled = prog.reduce((s, i) => s + i.duration_min, 0)

  async function reorder(section: 'programa' | 'apoio', ids: string[]) {
    setData((d) => d && { ...d, items: d.items.map((i) => (i.section === section && ids.includes(i.id) ? { ...i, position: ids.indexOf(i.id) } : i)) })
    try {
      await api.reorderItems(token, event.id, ids)
    } catch (e) {
      toast((e as Error).message)
      load()
    }
  }

  async function addKind(section: 'programa' | 'apoio', k: KindDef) {
    try {
      const id = await api.saveItem(token, { event_id: event.id, kind: k.key, duration_min: k.duration, section })
      const b = await api.getEvent(event.id, token)
      setData(b)
      const item = b.items.find((i) => i.id === id)
      if (item) {
        const r = withTimes(b.event, programItems(b.items)).find((x) => x.item.id === id)
        setOpen({ t: 'item', item, start: r ? r.start : null })
      } else setOpen(null)
    } catch (e) {
      toast((e as Error).message)
      setOpen(null)
    }
  }

  async function pdf() {
    setOpen(null)
    toast('Gerando PDF…')
    try {
      const { downloadProgramPdf } = await import('../lib/pdf')
      await downloadProgramPdf(event, items)
    } catch (e) {
      toast('Erro ao gerar PDF: ' + (e as Error).message)
    }
  }

  async function removeEvent() {
    if (!confirm('Excluir este culto e toda a programação? Esta ação não pode ser desfeita.')) return
    try {
      await api.deleteEvent(event.id)
      nav('/')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  async function regenDirector() {
    if (!confirm('Gerar um novo link do dirigente? O link antigo deixará de funcionar.')) return
    await api.regenDirectorToken(event.id)
    await load()
    toast('Novo link gerado')
  }

  return (
    <div className="app">
      <header className="topbar">
        {is_admin ? (
          <Link to="/" className="icon-btn" aria-label="Voltar"><Icon.back /></Link>
        ) : (
          <img src="/simbolo-branco.png" alt="" style={{ height: 34 }} />
        )}
        <div className="title">
          <div className="t1">{event.title}</div>
          <div className="t2">{capitalize(WEEKDAYS[parseDate(event.event_date).getDay()].slice(0, 3))}, {fmtDateShort(event.event_date)} · {hhmm(event.start_time)}–{hhmm(event.end_time)}</div>
        </div>
        <button className="icon-btn" aria-label="Baixar PDF" onClick={pdf}><Icon.pdf /></button>
        <button className="icon-btn" aria-label="Mais opções" onClick={() => setOpen({ t: 'menu' })}><Icon.more /></button>
      </header>

      <main className="page">
        {!is_admin && (
          <div className="card small" style={{ background: 'var(--orange-light)', boxShadow: 'none' }}>
            👋 Você está organizando este culto como <b>dirigente</b>{event.director?.name ? ` (${event.director.name})` : ''}. As alterações aparecem na hora para o pastor.
          </div>
        )}

        <div className="hero" onClick={() => setOpen({ t: 'info' })} role="button">
          <img className="bgmark" src="/simbolo-branco.png" alt="" />
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div className="eyebrow">Tema do culto</div>
            <span style={{ display: 'grid', width: 20, opacity: 0.8 }}><Icon.edit /></span>
          </div>
          <div className="h1" style={{ marginBottom: 10 }}>{event.theme || 'Toque para definir o tema'}</div>
          <div className="info-grid" style={{ position: 'relative' }}>
            {event.verse && <div><div className="k">Versículo</div><div className="v">{event.verse}</div></div>}
            {event.main_reading && <div><div className="k">Leitura principal</div><div className="v">{event.main_reading}</div></div>}
            <div><div className="k">Dirigente</div><div className="v">{event.director?.name || '—'}</div></div>
            {event.notes && <div><div className="k">Observações</div><div className="v">{event.notes}</div></div>}
          </div>
        </div>

        <Link to={token ? `/d/${token}/divulgacao` : `/culto/${event.id}/divulgacao`} className="btn dark block" style={{ justifyContent: 'flex-start' }}>
          <span>✨</span> <span className="grow" style={{ textAlign: 'left' }}>Divulgação · banner com IA</span> <Icon.next />
        </Link>

        <div className="seg">
          <button className={tab === 'programa' ? 'on' : ''} onClick={() => setTab('programa')}>Programação ({prog.length})</button>
          <button className={tab === 'apoio' ? 'on' : ''} onClick={() => setTab('apoio')}>Equipe de apoio ({sup.length})</button>
        </div>

        {tab === 'programa' ? (
          <>
            <TimeBar start={start} end={end} filled={filled} />
            {rows.length ? (
              <Timeline rows={rows} readingHint={event.main_reading} onOpen={(r) => setOpen({ t: 'item', item: r.item, start: r.start })} onReorder={(ids) => reorder('programa', ids)} />
            ) : (
              <div className="card empty"><b>Programação vazia</b>Adicione as oportunidades do culto.</div>
            )}
            <button className="btn secondary block" onClick={() => setOpen({ t: 'add', section: 'programa' })}><Icon.plus /> Adicionar oportunidade</button>
            <p className="tiny muted" style={{ textAlign: 'center', margin: 0 }}>Segure e arraste o ⋮⋮ para mudar a ordem.</p>
          </>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>Quem ajuda nos bastidores: fotografia, ceia, ofertas, recepção, som…</p>
            {sup.length ? (
              <Timeline
                rows={sup.map((item) => ({ item, start: 0 }))}
                showTime={false}
                onOpen={(r) => setOpen({ t: 'item', item: r.item, start: null })}
                onReorder={(ids) => reorder('apoio', ids)}
              />
            ) : (
              <div className="card empty"><b>Nenhuma função de apoio</b>Adicione quem vai ajudar no culto.</div>
            )}
            <button className="btn secondary block" onClick={() => setOpen({ t: 'add', section: 'apoio' })}><Icon.plus /> Adicionar função de apoio</button>
          </>
        )}
      </main>


      {open?.t === 'item' && (
        <ItemSheet event={event} item={open.item} start={open.start} token={token} onClose={() => setOpen(null)} onChanged={load} />
      )}
      {open?.t === 'add' && <AddItemSheet section={open.section} onClose={() => setOpen(null)} onPick={(k) => addKind(open.section, k)} />}
      {open?.t === 'info' && (
        <EventFormSheet event={event} token={token} isAdmin={is_admin} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load() }} />
      )}
      {open?.t === 'menu' && (
        <Sheet title="Opções do culto" onClose={() => setOpen(null)}>
          <div className="menu-list">
            <button className="btn ghost block" onClick={pdf}><Icon.pdf /> Baixar PDF da programação</button>
            <Link className="btn ghost block" to={token ? `/d/${token}/divulgacao` : `/culto/${event.id}/divulgacao`}>✨ Divulgação (banner com IA)</Link>
            <button className="btn ghost block" onClick={() => setOpen({ t: 'info' })}><Icon.edit /> Editar informações do culto</button>
            {is_admin && <button className="btn ghost block" onClick={() => setOpen({ t: 'director' })}><Icon.link /> Link do dirigente</button>}
            {is_admin && <hr className="sep" />}
            {is_admin && <button className="btn danger block" onClick={removeEvent}><Icon.trash /> Excluir culto</button>}
          </div>
        </Sheet>
      )}
      {open?.t === 'director' && (
        <Sheet title="Link do dirigente" onClose={() => setOpen(null)}>
          {event.director?.is_pastor ? (
            <>
              <p className="small" style={{ margin: 0 }}>
                Você mesmo é o dirigente deste culto, então <b>não precisa enviar link</b>.
              </p>
              <p className="tiny muted" style={{ margin: 0 }}>Se quiser que outra pessoa dirija, troque o dirigente nas informações do culto.</p>
              <button className="btn secondary block" onClick={() => setOpen({ t: 'info' })}>Trocar dirigente</button>
            </>
          ) : event.director ? (
            <>
              <p className="small" style={{ margin: 0 }}>
                Com este link, <b>{event.director.name}</b> pode organizar <b>somente este culto</b>, sem precisar de conta.
              </p>
              <a className="btn whats block" href={whatsappUrl(event.director.phone, directorMessage(event))} target="_blank" rel="noreferrer"><Icon.whats /> Enviar pelo WhatsApp</a>
              <button className="btn secondary block" onClick={async () => toast((await copyText(directorLink(event.director_token || ''))) ? 'Link copiado!' : 'Não foi possível copiar')}><Icon.copy /> Copiar link</button>
              <button className="btn ghost block" onClick={regenDirector}><Icon.refresh /> Gerar novo link (desativa o antigo)</button>
            </>
          ) : (
            <>
              <p className="small muted" style={{ margin: 0 }}>Este culto ainda não tem dirigente. Escolha o dirigente nas informações do culto.</p>
              <button className="btn block" onClick={() => setOpen({ t: 'info' })}>Escolher dirigente</button>
            </>
          )}
        </Sheet>
      )}
    </div>
  )
}
