import { MONTHS, WEEKDAYS_SHORT, toISO, todayISO } from '../lib/format'
import { Icon } from './ui'

export function Calendar({
  month,
  onMonth,
  selected,
  onSelect,
  counts,
}: {
  month: Date
  onMonth: (d: Date) => void
  selected: string
  onSelect: (iso: string) => void
  counts: Record<string, number>
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  // Remove a última semana se ela for inteira do mês seguinte
  while (days.length > 35 && days[days.length - 7].getMonth() !== month.getMonth()) days.splice(-7)
  const today = todayISO()

  return (
    <div className="card flush">
      <div className="cal-head">
        <button className="icon-btn plain" aria-label="Mês anterior" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon.back /></button>
        <div className="m">{MONTHS[month.getMonth()]} <span className="muted" style={{ fontWeight: 600 }}>{month.getFullYear()}</span></div>
        <button className="icon-btn plain" aria-label="Próximo mês" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon.next /></button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS_SHORT.map((w, i) => <div key={i} className="cal-wd">{w}</div>)}
        {days.map((d) => {
          const iso = toISO(d)
          const n = counts[iso] || 0
          const cls = ['cal-day', d.getMonth() !== month.getMonth() && 'out', iso === today && 'today', iso === selected && 'sel'].filter(Boolean).join(' ')
          return (
            <button key={iso} className={cls} onClick={() => onSelect(iso)} aria-label={`${d.getDate()}${n ? `, ${n} evento(s)` : ''}`}>
              <span>{d.getDate()}</span>
              <span className="cal-dots">{Array.from({ length: Math.min(n, 3) }).map((_, i) => <i key={i} />)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
