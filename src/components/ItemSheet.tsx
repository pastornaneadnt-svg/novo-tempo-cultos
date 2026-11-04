import { useState } from 'react'
import { api } from '../lib/api'
import { itemLabel, kindDef } from '../lib/catalog'
import { fmtMin } from '../lib/format'
import { copyText, inviteLink, inviteMessage, whatsappUrl } from '../lib/share'
import type { CultEvent, Item, ItemDetails, Person, Status } from '../lib/types'
import { DetailFields } from './DetailFields'
import { PersonPicker } from './PersonPicker'
import { Icon, Sheet, StatusBadge, useToast } from './ui'

const DURATIONS = [2, 3, 5, 8, 10, 15, 20, 30, 40, 50]

export function ItemSheet({
  event,
  item,
  start,
  token,
  onClose,
  onChanged,
}: {
  event: CultEvent
  item: Item
  start: number | null
  token: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const def = kindDef(item.kind)
  const isProgram = item.section === 'programa'
  const [title, setTitle] = useState(item.title || '')
  const [duration, setDuration] = useState(item.duration_min)
  const [person, setPerson] = useState<Person | null>(item.person)
  const [details, setDetails] = useState<ItemDetails>(item.details || {})
  const [status, setStatus] = useState<Status>(item.status)
  const [saving, setSaving] = useState(false)
  const personChanged = (person?.id || null) !== (item.person_id || null)
  const custom = item.kind === 'outro' || item.kind === 'apoio_outro'

  async function persist(): Promise<boolean> {
    setSaving(true)
    try {
      await api.saveItem(token, {
        id: item.id,
        title: custom ? title : item.title || '',
        duration_min: duration,
        person_id: person?.id || '',
        details,
        status,
      })
      return true
    } catch (e) {
      toast((e as Error).message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    if (await persist()) {
      onChanged()
      onClose()
    }
  }

  // Salva antes de enviar o convite (para o link já ter tudo atualizado).
  async function freshItem(): Promise<Item | null> {
    if (!(await persist())) return null
    const b = await api.getEvent(event.id, token)
    onChanged()
    return b.items.find((i) => i.id === item.id) || null
  }

  async function sendWhats() {
    if (!person) return toast('Escolha a pessoa primeiro')
    const win = window.open('', '_blank')
    const it = await freshItem()
    if (!it) return win?.close()
    const url = whatsappUrl(person.phone, inviteMessage(event, it, start))
    if (win) win.location.href = url
    else window.location.href = url
  }

  async function copyLink() {
    if (!person) return toast('Escolha a pessoa primeiro')
    const it = await freshItem()
    if (!it?.invite_token) return
    toast((await copyText(inviteLink(it.invite_token))) ? 'Link copiado!' : 'Não foi possível copiar')
  }

  async function regen() {
    if (!confirm('Gerar um novo link? O link antigo deixará de funcionar.')) return
    try {
      await api.regenItemToken(token, item.id)
      onChanged()
      toast('Novo link gerado. Envie de novo para a pessoa.')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  async function remove() {
    if (!confirm(`Remover “${itemLabel(item)}” da programação?`)) return
    try {
      await api.deleteItem(token, item.id)
      onChanged()
      onClose()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <Sheet
      title={itemLabel({ kind: item.kind, title: custom ? title : item.title })}
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" onClick={remove} aria-label="Remover"><Icon.trash /></button>
          <button className="btn grow" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      {isProgram && start != null && (
        <div className="row small muted">
          <b style={{ color: 'var(--orange)' }}>{fmtMin(start)}</b> até {fmtMin(start + duration)}
        </div>
      )}

      {custom && (
        <label className="field">
          <span>{isProgram ? 'Nome da oportunidade' : 'Nome da função'}</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isProgram ? 'Ex.: Homenagem às mães' : 'Ex.: Estacionamento'} />
        </label>
      )}

      {isProgram && (
        <div className="field">
          <span>Duração</span>
          <div className="stepper">
            <button type="button" onClick={() => setDuration(Math.max(0, duration - 1))} aria-label="Menos 1 minuto">−</button>
            <div className="val">{duration} min</div>
            <button type="button" onClick={() => setDuration(duration + 1)} aria-label="Mais 1 minuto">+</button>
          </div>
          <div className="chips">
            {DURATIONS.map((d) => (
              <button type="button" key={d} className={`chip ${d === duration ? 'on' : ''}`} onClick={() => setDuration(d)}>{d} min</button>
            ))}
          </div>
        </div>
      )}

      <PersonPicker token={token} value={person} onChange={setPerson} label={def.personLabel} />

      {person && (
        <div className="card stack" style={{ boxShadow: 'none', border: '1.5px solid var(--line)' }}>
          <div className="row between">
            <span className="h2" style={{ fontSize: 13 }}>Convite</span>
            {personChanged ? <span className="badge pendente">Novo convite</span> : <StatusBadge status={item.status} hasPerson />}
          </div>
          {!personChanged && item.response_note && <div className="small" style={{ fontStyle: 'italic' }}>“{item.response_note}”</div>}
          <button className="btn whats block" onClick={sendWhats} disabled={saving}><Icon.whats /> Enviar convite pelo WhatsApp</button>
          <div className="row">
            <button className="btn secondary sm grow" onClick={copyLink} disabled={saving}><Icon.copy /> Copiar link</button>
            {!personChanged && <button className="btn ghost sm grow" onClick={regen}><Icon.refresh /> Novo link</button>}
          </div>
          {!personChanged && (
            <div className="field">
              <span>Marcar status manualmente</span>
              <div className="seg">
                {(['pendente', 'aceito', 'recusado'] as Status[]).map((s) => (
                  <button type="button" key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
                    {s === 'pendente' ? 'Aguardando' : s === 'aceito' ? 'Confirmado' : 'Recusou'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <DetailFields kind={item.kind} value={details} onChange={setDetails} readingHint={event.main_reading} />
    </Sheet>
  )
}
