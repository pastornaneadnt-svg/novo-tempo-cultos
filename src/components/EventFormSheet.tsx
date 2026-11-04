import { useState } from 'react'
import { api } from '../lib/api'
import { DEFAULT_ORDER, kindDef } from '../lib/catalog'
import { hhmm, toMin } from '../lib/format'
import type { CultEvent, Person } from '../lib/types'
import { PersonPicker } from './PersonPicker'
import { Sheet, useToast } from './ui'

export function EventFormSheet({
  event,
  initialDate,
  token,
  isAdmin,
  onClose,
  onSaved,
}: {
  event?: CultEvent
  initialDate?: string
  token: string | null
  isAdmin: boolean
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const toast = useToast()
  const [f, setF] = useState({
    title: event?.title || 'Culto',
    event_date: event?.event_date || initialDate || '',
    start_time: event ? hhmm(event.start_time) : '19:00',
    end_time: event ? hhmm(event.end_time) : '21:00',
    theme: event?.theme || '',
    verse: event?.verse || '',
    main_reading: event?.main_reading || '',
    notes: event?.notes || '',
  })
  const [director, setDirector] = useState<Person | null>(event?.director || null)
  const [useDefault, setUseDefault] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const invalidTime = f.start_time && f.end_time && toMin(f.end_time) <= toMin(f.start_time)

  async function save() {
    if (!f.event_date) return toast('Escolha a data do culto')
    if (invalidTime) return toast('O horário de término precisa ser depois do início')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...f, id: event?.id }
      if (isAdmin) payload.director_id = director?.id || ''
      const id = await api.saveEvent(token, payload)
      if (!event && useDefault) {
        await Promise.all(
          DEFAULT_ORDER.map((k, i) =>
            api.saveItem(token, { event_id: id, kind: k, duration_min: kindDef(k).duration, position: i, section: 'programa' }),
          ),
        )
      }
      onSaved(id)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={event ? 'Informações do culto' : 'Novo culto'}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost grow" onClick={onClose}>Cancelar</button>
          <button className="btn grow" onClick={save} disabled={saving}>{saving ? 'Salvando…' : event ? 'Salvar' : 'Criar culto'}</button>
        </>
      }
    >
      <label className="field">
        <span>Nome do evento</span>
        <input className="input" value={f.title} onChange={set('title')} placeholder="Ex.: Culto de Domingo, Culto de Santa Ceia" />
      </label>
      <label className="field">
        <span>Data</span>
        <input className="input" type="date" value={f.event_date} onChange={set('event_date')} />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Início</span>
          <input className="input" type="time" value={f.start_time} onChange={set('start_time')} />
        </label>
        <label className="field">
          <span>Término</span>
          <input className="input" type="time" value={f.end_time} onChange={set('end_time')} />
        </label>
      </div>
      {invalidTime && <div className="error-box">O término precisa ser depois do início.</div>}
      <label className="field">
        <span>Tema do culto</span>
        <input className="input" value={f.theme} onChange={set('theme')} placeholder="Ex.: O tempo de Deus" />
      </label>
      <label className="field">
        <span>Versículo do tema</span>
        <textarea className="textarea" rows={3} value={f.verse} onChange={set('verse')} placeholder="Ex.: Eclesiastes 3:1 — Tudo tem o seu tempo determinado…" />
      </label>
      <label className="field">
        <span>Leitura bíblica principal</span>
        <input className="input" value={f.main_reading} onChange={set('main_reading')} placeholder="Ex.: Isaías 43:18-21" />
      </label>
      {isAdmin && (
        <PersonPicker token={token} value={director} onChange={setDirector} label="Dirigente do culto" />
      )}
      <label className="field">
        <span>Observações gerais</span>
        <textarea className="textarea" rows={2} value={f.notes} onChange={set('notes')} placeholder="Informações para todos que participam" />
      </label>
      {!event && (
        <label className="row card" style={{ boxShadow: 'none', background: 'var(--orange-light)', cursor: 'pointer' }}>
          <input type="checkbox" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--orange)' }} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Começar com a ordem padrão do culto</div>
            <div className="tiny muted">Já cria as oportunidades mais comuns. Você ajusta depois.</div>
          </div>
        </label>
      )}
    </Sheet>
  )
}
