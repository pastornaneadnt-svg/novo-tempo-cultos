import { FIELD_LABELS, FIELD_PLACEHOLDERS, READING_KINDS, kindDef } from '../lib/catalog'
import type { ItemDetails } from '../lib/types'
import { HymnPicker } from './HymnPicker'

const ORD = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º']

export function songLines(d: ItemDetails): string[] {
  return (d.songs || '').split('\n')
}

/** Quantidade de louvores definida pelo pastor (ou a quantidade já preenchida). */
export function songCount(d: ItemDetails): number {
  const filled = songLines(d).filter((s) => s.trim()).length
  return Math.max(d.song_count || 1, filled, 1)
}

function CountStepper({ label, value, onChange, unit }: { label: string; value: number; onChange: (n: number) => void; unit: [string, string] }) {
  return (
    <div className="row between">
      <span className="small" style={{ fontWeight: 600 }}>{label}</span>
      <div className="stepper">
        <button type="button" onClick={() => onChange(Math.max(1, value - 1))} aria-label="Menos">−</button>
        <div className="val" style={{ minWidth: 92, fontSize: 15 }}>{value} {value === 1 ? unit[0] : unit[1]}</div>
        <button type="button" onClick={() => onChange(Math.min(8, value + 1))} aria-label="Mais">+</button>
      </div>
    </div>
  )
}

/**
 * Campos específicos de cada tipo de oportunidade (hinos, louvor, tocado/playback…).
 * `canSetCount`: só o pastor/dirigente define quantos louvores/hinos; quem recebe o convite preenche.
 */
export function DetailFields({
  kind,
  value,
  onChange,
  readingHint,
  canSetCount = false,
}: {
  kind: string
  value: ItemDetails
  onChange: (v: ItemDetails) => void
  readingHint?: string | null
  canSetCount?: boolean
}) {
  const def = kindDef(kind)
  const set = (patch: Partial<ItemDetails>) => onChange({ ...value, ...patch })
  return (
    <>
      {READING_KINDS.has(kind) && (
        <div className="card stack tight" style={{ boxShadow: 'none', background: 'var(--orange-light)' }}>
          <div className="eyebrow">Texto da leitura</div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{readingHint?.trim() || 'O pastor ainda vai definir o texto'}</div>
          <div className="tiny muted">É a leitura principal do culto, definida pelo pastor.</div>
        </div>
      )}
      {def.fields.map((f) => {
        if (f === 'hymns') {
          const hymns = value.hymns || []
          const count = Math.max(value.hymn_count || 1, hymns.length, 1)
          const missing = count - hymns.length
          return (
            <div className="field" key={f}>
              <span>{FIELD_LABELS.hymns}</span>
              {canSetCount ? (
                <CountStepper label="Quantos hinos?" value={count} unit={['hino', 'hinos']} onChange={(n) => set({ hymn_count: Math.max(n, hymns.length) })} />
              ) : (
                <div className="small muted">Escolha {count === 1 ? '1 hino' : `${count} hinos`} da Harpa Cristã.</div>
              )}
              <HymnPicker value={hymns} onChange={(h) => set({ hymns: h })} max={count} />
              {missing > 0 && <div className="tiny muted">{missing === 1 ? 'Falta 1 hino' : `Faltam ${missing} hinos`}</div>}
            </div>
          )
        }
        if (f === 'songs') {
          const count = songCount(value)
          const lines = songLines(value)
          const setLine = (i: number, v: string) => {
            const next = Array.from({ length: count }, (_, j) => (j === i ? v : lines[j] || ''))
            set({ songs: next.join('\n').replace(/\n+$/, ''), song_count: count })
          }
          return (
            <div className="field" key={f}>
              <span>{FIELD_LABELS.songs}</span>
              {canSetCount ? (
                <CountStepper
                  label="Quantos louvores?"
                  value={count}
                  unit={['louvor', 'louvores']}
                  onChange={(n) => set({ song_count: n, songs: lines.slice(0, n).join('\n').replace(/\n+$/, '') })}
                />
              ) : (
                <div className="small muted">Coloque {count === 1 ? 'o louvor' : `os ${count} louvores`} de acordo com o tema do culto.</div>
              )}
              {Array.from({ length: count }, (_, i) => (
                <input key={i} className="input" value={lines[i] || ''} placeholder={`${ORD[i]} louvor`} onChange={(e) => setLine(i, e.target.value)} />
              ))}
            </div>
          )
        }
        if (f === 'mode')
          return (
            <div className="field" key={f}>
              <span>{FIELD_LABELS.mode}</span>
              <div className="seg">
                <button type="button" className={value.mode === 'tocado' ? 'on' : ''} onClick={() => set({ mode: value.mode === 'tocado' ? '' : 'tocado' })}>🎸 Tocado</button>
                <button type="button" className={value.mode === 'playback' ? 'on' : ''} onClick={() => set({ mode: value.mode === 'playback' ? '' : 'playback' })}>🎧 Playback</button>
              </div>
            </div>
          )
        const multiline = f === 'notes' || f === 'musicos' || f === 'vocalistas'
        const placeholder = FIELD_PLACEHOLDERS[f]
        return (
          <label className="field" key={f}>
            <span>{FIELD_LABELS[f]}</span>
            {multiline ? (
              <textarea className="textarea" rows={f === 'notes' ? 2 : 3} value={(value[f] as string) || ''} placeholder={placeholder} onChange={(e) => set({ [f]: e.target.value })} />
            ) : (
              <input className="input" value={(value[f] as string) || ''} placeholder={placeholder} onChange={(e) => set({ [f]: e.target.value })} />
            )}
          </label>
        )
      })}
    </>
  )
}

/** Resumo curto dos detalhes, para mostrar no cartão da linha do tempo. */
export function detailsSummary(kind: string, d: ItemDetails, readingHint?: string | null): string {
  const def = kindDef(kind)
  const out: string[] = []
  if (d.hymns?.length) out.push(d.hymns.map((h) => `${h.number} · ${h.title}`).join('\n'))
  if (def.fields.includes('hymns')) {
    const missing = (d.hymn_count || 0) - (d.hymns?.length || 0)
    if (missing > 0) out.push(d.hymns?.length ? `+ ${missing} hino(s) a definir` : `${missing} hino(s) a definir`)
  }
  const songs = songLines(d).map((s) => s.trim()).filter(Boolean)
  if (songs.length) out.push('♪ ' + songs.join(' · '))
  if (def.fields.includes('songs')) {
    const missing = (d.song_count || 0) - songs.length
    if (missing > 0) out.push(songs.length ? `+ ${missing} louvor(es) a definir` : `♪ ${missing} louvor(es) a definir`)
  }
  if (d.message_title?.trim()) out.push(`“${d.message_title.trim()}”`)
  const ref = READING_KINDS.has(kind) ? readingHint?.trim() || '' : d.reference?.trim() || ''
  if (ref) out.push('📖 ' + ref)
  if (d.regente?.trim()) out.push('Regente: ' + d.regente.trim())
  if (d.solista?.trim()) out.push('Solista: ' + d.solista.trim())
  if (d.vocalistas?.trim()) out.push('Vocal: ' + d.vocalistas.trim().replace(/\n/g, ', '))
  if (d.musicos?.trim()) out.push('Músicos: ' + d.musicos.trim().replace(/\n/g, ', '))
  if (d.instrumentos?.trim()) out.push('Instrumentos: ' + d.instrumentos.trim())
  if (d.notes?.trim()) out.push('Obs.: ' + d.notes.trim())
  return out.join('\n')
}
