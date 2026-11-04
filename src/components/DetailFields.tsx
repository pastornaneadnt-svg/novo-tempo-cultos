import { FIELD_LABELS, FIELD_PLACEHOLDERS, READING_KINDS, kindDef } from '../lib/catalog'
import type { ItemDetails } from '../lib/types'
import { HymnPicker } from './HymnPicker'

/** Campos específicos de cada tipo de oportunidade (hinos, louvor, tocado/playback…). */
export function DetailFields({
  kind,
  value,
  onChange,
  readingHint,
}: {
  kind: string
  value: ItemDetails
  onChange: (v: ItemDetails) => void
  readingHint?: string | null
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
        if (f === 'hymns')
          return (
            <div className="field" key={f}>
              <span>{FIELD_LABELS.hymns}</span>
              <HymnPicker value={value.hymns || []} onChange={(hymns) => set({ hymns })} />
            </div>
          )
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
        const multiline = f === 'songs' || f === 'notes' || f === 'musicos' || f === 'vocalistas'
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
  const out: string[] = []
  if (d.hymns?.length) out.push(d.hymns.map((h) => `${h.number} · ${h.title}`).join('\n'))
  if (d.songs?.trim()) out.push('♪ ' + d.songs.trim().split('\n').join(' · '))
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
