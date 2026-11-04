import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Person } from '../lib/types'
import { Icon, initials, useToast } from './ui'

/**
 * Escolhe uma pessoa já cadastrada ou cadastra uma nova na hora
 * (nome, telefone e observação).
 */
export function PersonPicker({
  token,
  value,
  onChange,
  label = 'Responsável',
}: {
  token: string | null
  value: Person | null
  onChange: (p: Person | null) => void
  label?: string
}) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState<Partial<Person> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(() => {
      api.searchPeople(token, q).then((r) => alive && setResults(r)).catch(() => {})
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, open, token])

  async function saveNew() {
    if (!creating?.name?.trim()) return
    setSaving(true)
    try {
      const p = await api.savePerson(token, creating)
      onChange(p)
      setCreating(null)
      setOpen(false)
      setQ('')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (creating) {
    return (
      <div className="card stack" style={{ background: 'var(--orange-light)', boxShadow: 'none' }}>
        <div className="h2" style={{ fontSize: 13 }}>Cadastrar pessoa</div>
        <label className="field">
          <span>Nome</span>
          <input className="input" autoFocus value={creating.name || ''} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="Nome completo" />
        </label>
        <label className="field">
          <span>WhatsApp</span>
          <input className="input" inputMode="tel" value={creating.phone || ''} onChange={(e) => setCreating({ ...creating, phone: e.target.value })} placeholder="(00) 00000-0000" />
        </label>
        <label className="field">
          <span>Observação</span>
          <input className="input" value={creating.note || ''} onChange={(e) => setCreating({ ...creating, note: e.target.value })} placeholder="Ex.: filha da irmã Maria" />
        </label>
        <div className="row">
          <button type="button" className="btn ghost grow" onClick={() => setCreating(null)}>Cancelar</button>
          <button type="button" className="btn grow" disabled={saving || !creating.name?.trim()} onClick={saveNew}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="field">
      <span>{label}</span>
      {value && !open ? (
        <div className="person-opt on" style={{ cursor: 'default' }}>
          <div className="avatar">{initials(value.name)}</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{value.name}</div>
            <div className="tiny muted">{[value.phone, value.note].filter(Boolean).join(' · ') || 'Sem telefone'}</div>
          </div>
          <button type="button" className="btn sm secondary" onClick={() => setOpen(true)}>Trocar</button>
          <button type="button" className="icon-btn plain" aria-label="Remover" onClick={() => onChange(null)}><Icon.close /></button>
        </div>
      ) : open ? (
        <div className="stack tight">
          <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo nome…" />
          <button type="button" className="person-opt" onClick={() => setCreating({ name: q })}>
            <div className="avatar" style={{ background: 'var(--orange)', color: '#fff' }}><Icon.plus /></div>
            <div style={{ fontWeight: 700 }}>{q ? `Cadastrar “${q}”` : 'Cadastrar nova pessoa'}</div>
          </button>
          {results.map((p) => (
            <button type="button" key={p.id} className={`person-opt ${value?.id === p.id ? 'on' : ''}`} onClick={() => { onChange(p); setOpen(false); setQ('') }}>
              <div className="avatar">{initials(p.name)}</div>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="tiny muted">{[p.phone, p.note].filter(Boolean).join(' · ')}</div>
              </div>
            </button>
          ))}
          <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>Fechar busca</button>
        </div>
      ) : (
        <button type="button" className="person-opt" onClick={() => setOpen(true)}>
          <div className="avatar"><Icon.plus /></div>
          <div className="muted" style={{ fontWeight: 600 }}>Escolher pessoa</div>
        </button>
      )}
    </div>
  )
}
