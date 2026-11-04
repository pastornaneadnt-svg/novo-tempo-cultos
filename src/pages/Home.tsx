import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { capitalize, fmtDateLong, hhmm, parseDate, toISO, toMin, todayISO, WEEKDAYS } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { EventSummary } from '../lib/types'
import { Calendar } from '../components/Calendar'
import { EventFormSheet } from '../components/EventFormSheet'
import { Icon, useToast } from '../components/ui'

export function BrandBar({ right }: { right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/simbolo-branco.png" alt="" />
        <div>
          <div className="t1">AD Novo Tempo</div>
          <div className="t2">Programação</div>
        </div>
      </div>
      {right}
    </header>
  )
}

function EventRow({ e }: { e: EventSummary }) {
  const d = parseDate(e.event_date)
  const total = Math.max(1, toMin(e.end_time) - toMin(e.start_time))
  const pct = Math.min(100, (e.filled_min / total) * 100)
  return (
    <Link to={`/culto/${e.id}`} className="ev">
      <div className="date">
        <div className="d">{d.getDate()}</div>
        <div className="w">{WEEKDAYS[d.getDay()].slice(0, 3)}</div>
      </div>
      <div className="grow stack tight" style={{ gap: 4 }}>
        <div className="t">{e.title}</div>
        <div className="small muted">
          {hhmm(e.start_time)}–{hhmm(e.end_time)}
          {e.theme ? ` · ${e.theme}` : ''}
        </div>
        <div className="progress"><i style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : undefined }} /></div>
        <div className="tiny muted">
          {e.invited ? `${e.accepted}/${e.invited} confirmados` : 'Ninguém convidado ainda'}
          {e.declined ? ` · ${e.declined} recusou` : ''}
          {e.director_name ? ` · Dirigente: ${e.director_name}` : ''}
        </div>
      </div>
      <span className="muted" style={{ display: 'grid', width: 20 }}><Icon.next /></span>
    </Link>
  )
}

export function HomePage() {
  const nav = useNavigate()
  const toast = useToast()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(todayISO())
  const [events, setEvents] = useState<EventSummary[]>([])
  const [upcoming, setUpcoming] = useState<EventSummary[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const from = toISO(new Date(month.getFullYear(), month.getMonth() - 1, 20))
      const to = toISO(new Date(month.getFullYear(), month.getMonth() + 1, 12))
      const t = todayISO()
      const t60 = toISO(new Date(Date.now() + 60 * 86400000))
      const [a, b] = await Promise.all([api.listEvents(from, to), api.listEvents(t, t60)])
      setEvents(a)
      setUpcoming(b.slice(0, 8))
    } catch (e) {
      toast((e as Error).message)
    }
  }, [month, toast])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of events) c[e.event_date] = (c[e.event_date] || 0) + 1
    return c
  }, [events])
  const dayEvents = events.filter((e) => e.event_date === selected)

  return (
    <div className="app">
      <BrandBar right={<button className="icon-btn" aria-label="Sair" onClick={() => confirm('Sair da conta?') && supabase.auth.signOut()}><Icon.logout /></button>} />
      <main className="page">
        <Calendar
          month={month}
          onMonth={setMonth}
          selected={selected}
          onSelect={(iso) => {
            setSelected(iso)
            const d = parseDate(iso)
            if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
          }}
          counts={counts}
        />

        <section className="stack">
          <div className="row between">
            <div>
              <div className="eyebrow">Dia selecionado</div>
              <div className="h2" style={{ marginTop: 4 }}>{capitalize(fmtDateLong(selected))}</div>
            </div>
          </div>
          <div className="card flush">
            {dayEvents.length ? (
              dayEvents.map((e) => <EventRow key={e.id} e={e} />)
            ) : (
              <div className="empty">
                <b>Nenhum culto neste dia</b>
                <button className="btn secondary sm" style={{ marginTop: 10 }} onClick={() => setCreating(true)}><Icon.plus /> Programar culto</button>
              </div>
            )}
          </div>
        </section>

        <section className="stack">
          <div className="eyebrow">Próximos cultos</div>
          <div className="card flush">
            {upcoming.length ? upcoming.map((e) => <EventRow key={e.id} e={e} />) : <div className="empty">Nenhum culto programado para os próximos dias.</div>}
          </div>
        </section>
      </main>

      <button className="btn fab" onClick={() => setCreating(true)}><Icon.plus /> Novo culto</button>

      {creating && (
        <EventFormSheet
          initialDate={selected}
          token={null}
          isAdmin
          onClose={() => setCreating(false)}
          onSaved={(id) => nav(`/culto/${id}`)}
        />
      )}
    </div>
  )
}
