import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Person } from '../lib/types'
import { Icon, initials, useToast } from './ui'

// O pastor muda pouco: guarda em memória para não buscar toda vez.
const pastorCache = new Map<string, Promise<Person | null>>()
function loadPastor(token: string | null, fresh = false) {
  const k = token || 'admin'
  if (fresh || !pastorCache.has(k)) pastorCache.set(k, api.getPastor(token).catch(() => null))
  return pastorCache.get(k)!
}

function PastorTag() {
  return <span className="badge mode" style={{ background: 'var(--orange)', marginLeft: 6 }}>Pastor</span>
}

/**
 * Escolhe uma pessoa já cadastrada ou cadastra uma nova na hora
 * (nome, telefone e observação). O pastor aparece como atalho no topo.
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
  const isAdmin = token === null
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState<Partial<Person> | null>(null)
  const [saving, setSaving] = useState(false)
  const [pastor, setPastor] = useState<Person | null>(null)

  useEffect(() => {
    loadPastor(token).then(setPastor)
  }, [token])

  useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(() => {
      api.searchPeople(token, q).then((r) => alive && setResults(r.filter((p) => !p.is_pastor))).catch(() => {})
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, open, token])

  function pick(p: Person | null) {
    onChange(p)
    setOpen(false)
    setQ('')
  }

  function pickPastor() {
    if (pastor) return pick(pastor)
    if (isAdmin) setCreating({ name: '', is_pastor: true })
  }

  async function saveNew() {
    if (!creating?.name?.trim()) return
    setSaving(true)
    try {
      const p = await api.savePerson(token, creating)
      if (p.is_pastor) {
        pastorCache.set(token || 'admin', Promise.resolve(p))
        setPastor(p)
      }
      pick(p)
      setCreating(null)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const pastorLabel = isAdmin ? 'Eu (Pastor)' : `Pastor ${pastor?.name || ''}`.trim()
  const showPastorBtn = !!pastor || isAdmin

  if (creating) {
    const asPastor = !!creating.is_pastor
    return (
      <div className="card stack" style={{ background: 'var(--orange-light)', boxShadow: 'none' }}>
        <div className="h2" style={{ fontSize: 13 }}>{asPastor ? 'Seu nome (pastor)' : 'Cadastrar pessoa'}</div>
        {asPastor && <p className="tiny muted" style={{ margin: 0 }}>Só na primeira vez. Depois é só tocar em “Eu (Pastor)”. Quando você for o responsável, fica confirmado automaticamente.</p>}
        <label className="field">
          <span>Nome</span>
          <input className="input" autoFocus value={creating.name || ''} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder={asPastor ? 'Ex.: Pr. Fulano de Tal' : 'Nome completo'} />
        </label>
        {!asPastor && (
          <>
            <label className="field">
              <span>WhatsApp</span>
              <input className="input" inputMode="tel" value={creating.phone || ''} onChange={(e) => setCreating({ ...creating, phone: e.target.value })} placeholder="(00) 00000-0000" />
            </label>
            <label className="field">
              <span>Observação</span>
              <input className="input" value={creating.note || ''} onChange={(e) => setCreating({ ...creating, note: e.target.value })} placeholder="Ex.: filha da irmã Maria" />
            </label>
          </>
        )}
        <div className="row">
          <button type="button" className="btn ghost grow" onClick={() => setCreating(null)}>Cancelar</button>
          <button type="button" className="btn grow" disabled={saving || !creating.name?.trim()} onClick={saveNew}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    )
  }

  const pastorBtn = showPastorBtn && (
    <button type="button" className="person-opt" onClick={pickPastor} style={{ borderColor: 'var(--orange-soft)' }}>
      <div className="avatar" style={{ background: 'var(--orange)', color: '#fff' }}>{pastor ? initials(pastor.name) : '★'}</div>
      <div className="grow">
        <div style={{ fontWeight: 700 }}>{pastorLabel}</div>
        <div className="tiny muted">Confirmado automaticamente, sem convite</div>
      </div>
    </button>
  )

  return (
    <div className="field">
      <span>{label}</span>
      {value && !open ? (
        <div className="person-opt on" style={{ cursor: 'default' }}>
          <div className="avatar" style={value.is_pastor ? { background: 'var(--orange)', color: '#fff' } : undefined}>{initials(value.name)}</div>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{value.name}{value.is_pastor && <PastorTag />}</div>
            <div className="tiny muted">{value.is_pastor ? 'Confirmado automaticamente' : [value.phone, value.note].filter(Boolean).join(' · ') || 'Sem telefone'}</div>
          </div>
          <button type="button" className="btn sm secondary" onClick={() => setOpen(true)}>Trocar</button>
          <button type="button" className="icon-btn plain" aria-label="Remover" onClick={() => onChange(null)}><Icon.close /></button>
        </div>
      ) : open ? (
        <div className="stack tight">
          {!q && value?.id !== pastor?.id && pastorBtn}
          <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo nome…" />
          <button type="button" className="person-opt" onClick={() => setCreating({ name: q })}>
            <div className="avatar" style={{ background: 'var(--graphite)', color: '#fff' }}><Icon.plus /></div>
            <div style={{ fontWeight: 700 }}>{q ? `Cadastrar “${q}”` : 'Cadastrar nova pessoa'}</div>
          </button>
          {results.map((p) => (
            <button type="button" key={p.id} className={`person-opt ${value?.id === p.id ? 'on' : ''}`} onClick={() => pick(p)}>
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
        <div className="stack tight">
          <button type="button" className="person-opt" onClick={() => setOpen(true)}>
            <div className="avatar"><Icon.plus /></div>
            <div className="muted" style={{ fontWeight: 600 }}>Escolher pessoa</div>
          </button>
          {pastorBtn}
        </div>
      )}
    </div>
  )
}
