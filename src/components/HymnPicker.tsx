import { useMemo, useState } from 'react'
import harpa from '../harpa.json'
import type { Hymn } from '../lib/types'
import { Icon } from './ui'

const HYMNS: Hymn[] = (harpa as [number, string][]).map(([number, title]) => ({ number, title }))
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const INDEX = HYMNS.map((h) => ({ h, key: norm(h.title) }))

export function HymnPicker({ value, onChange }: { value: Hymn[]; onChange: (v: Hymn[]) => void }) {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const s = q.trim()
    if (!s) return []
    if (/^\d+$/.test(s)) {
      const n = Number(s)
      return HYMNS.filter((h) => String(h.number).startsWith(s)).sort((a, b) => (a.number === n ? -1 : b.number === n ? 1 : a.number - b.number)).slice(0, 12)
    }
    const k = norm(s)
    return INDEX.filter((x) => x.key.includes(k)).map((x) => x.h).slice(0, 20)
  }, [q])

  return (
    <div className="stack tight">
      {value.map((h, i) => (
        <div className="hymn-row" key={`${h.number}-${i}`}>
          <span className="n">{h.number}</span>
          <span className="grow" style={{ fontWeight: 600 }}>{h.title}</span>
          <button type="button" className="icon-btn plain" aria-label="Remover hino" onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon.close /></button>
        </div>
      ))}
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número ou nome do hino (ex.: 15)" inputMode="search" />
      {results.length > 0 && (
        <div className="hymn-results">
          {results.map((h) => (
            <button type="button" key={h.number} onClick={() => { onChange([...value, h]); setQ('') }}>
              <b style={{ color: 'var(--orange)', minWidth: 34 }}>{h.number}</b>
              <span>{h.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
