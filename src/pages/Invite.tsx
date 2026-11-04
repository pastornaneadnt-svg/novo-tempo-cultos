import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { itemLabel, kindDef } from '../lib/catalog'
import { capitalize, firstName, fmtDateLong, fmtMin, hhmm, programItems, supportItems, withTimes } from '../lib/format'
import type { InviteBundle, ItemDetails, Status } from '../lib/types'
import { DetailFields } from '../components/DetailFields'
import { ReadOnlyTimeline } from '../components/Timeline'
import { Spinner, StatusBadge, usePolling, useToast } from '../components/ui'
import { BrandBar } from './Home'
import { InvalidLink } from './EventPage'

export function InvitePage() {
  const { token = '' } = useParams()
  const toast = useToast()
  const [data, setData] = useState<InviteBundle | null | undefined>(undefined)
  const [details, setDetails] = useState<ItemDetails | null>(null)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const b = await api.getInvite(token)
      setData(b)
      if (b) {
        setDetails((d) => d ?? b.item.details ?? {})
        setNote((n) => n || b.item.response_note || '')
      }
    } catch {
      setData((d) => (d === undefined ? null : d))
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])
  usePolling(load, 15000, !busy)

  if (data === undefined) return <Spinner />
  if (data === null) return <InvalidLink />

  const { item, event, items } = data
  const prog = programItems(items)
  const sup = supportItems(items)
  const rows = withTimes(event, prog)
  const mine = rows.find((r) => r.item.id === item.id)
  const def = kindDef(item.kind)
  const hasFields = def.fields.some((f) => f !== 'notes')
  const answered = item.status !== 'pendente'
  const showForm = !answered || editing

  async function respond(status: Status) {
    setBusy(true)
    try {
      await api.respondInvite(token, status, (details || {}) as Record<string, unknown>, note)
      setEditing(false)
      toast(status === 'aceito' ? 'Confirmado! Deus abençoe 🙏' : 'Resposta enviada. Obrigado por avisar.')
      await load()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <BrandBar />
      <main className="page">
        <div className="card stack">
          <div>
            <div className="eyebrow">Sua oportunidade</div>
            <p className="small muted" style={{ margin: '8px 0 0' }}>A paz do Senhor{item.person?.name ? `, ${firstName(item.person.name)}` : ''}! Você foi convidado(a) para:</p>
            <div className="h1" style={{ color: 'var(--orange)' }}>{itemLabel(item)}</div>
          </div>
          <div className="row wrap small" style={{ gap: 8 }}>
            {mine ? (
              <span><b>{fmtMin(mine.start)}</b> · {item.duration_min} min</span>
            ) : (
              <span>Equipe de apoio</span>
            )}
            <StatusBadge status={item.status} hasPerson />
          </div>
        </div>

        <div className="hero">
          <img className="bgmark" src="/simbolo-branco.png" alt="" />
          <div className="eyebrow">{capitalize(fmtDateLong(event.event_date))} · {hhmm(event.start_time)}</div>
          <div className="h1" style={{ margin: '6px 0 12px' }}>{event.theme || event.title}</div>
          <div className="info-grid" style={{ position: 'relative' }}>
            {event.theme && <div><div className="k">Evento</div><div className="v">{event.title}</div></div>}
            {event.verse && <div><div className="k">Versículo</div><div className="v">{event.verse}</div></div>}
            {event.main_reading && <div><div className="k">Leitura principal</div><div className="v">{event.main_reading}</div></div>}
            {event.director?.name && <div><div className="k">Dirigente</div><div className="v">{event.director.name}</div></div>}
            {event.notes && <div><div className="k">Observações</div><div className="v">{event.notes}</div></div>}
          </div>
        </div>
        {event.theme && <p className="small muted" style={{ margin: '-4px 4px 0' }}>🙏 Prepare seu louvor ou sua palavra de acordo com o tema do culto.</p>}

        {showForm ? (
          <div className="card stack">
            <div className="h2">{answered ? 'Alterar resposta' : 'Você aceita?'}</div>
            {hasFields && <p className="small muted" style={{ margin: 0 }}>Preencha os detalhes da sua participação:</p>}
            {details && <DetailFields kind={item.kind} value={details} onChange={setDetails} readingHint={event.main_reading} />}
            <label className="field">
              <span>Mensagem para o pastor (opcional)</span>
              <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: vou precisar de 2 microfones" />
            </label>
            <button className="btn block" disabled={busy} onClick={() => respond('aceito')}>✓ Aceito a oportunidade</button>
            <button className="btn ghost block" disabled={busy} onClick={() => respond('recusado')}>Não poderei participar</button>
            {answered && <button className="btn ghost sm" onClick={() => setEditing(false)}>Cancelar</button>}
          </div>
        ) : (
          <div className="card stack" style={{ background: item.status === 'aceito' ? 'var(--green-bg)' : 'var(--red-bg)', boxShadow: 'none' }}>
            <div className="h2" style={{ color: item.status === 'aceito' ? 'var(--green)' : 'var(--red)' }}>
              {item.status === 'aceito' ? '✓ Você confirmou presença' : 'Você informou que não poderá participar'}
            </div>
            <button className="btn ghost sm" style={{ background: '#fff' }} onClick={() => setEditing(true)}>Alterar resposta ou detalhes</button>
          </div>
        )}

        <section className="stack">
          <div className="eyebrow">Programação completa</div>
          <p className="tiny muted" style={{ margin: '-6px 0 0' }}>Atualiza automaticamente.</p>
          <ReadOnlyTimeline rows={rows} readingHint={event.main_reading} highlightId={item.id} />
        </section>

        {sup.length > 0 && (
          <section className="stack">
            <div className="eyebrow">Equipe de apoio</div>
            <ReadOnlyTimeline rows={sup.map((i) => ({ item: i, start: 0 }))} highlightId={item.id} showTime={false} />
          </section>
        )}

        <p className="tiny muted" style={{ textAlign: 'center' }}>AD Novo Tempo · Igreja Evangélica</p>
      </main>
    </div>
  )
}
