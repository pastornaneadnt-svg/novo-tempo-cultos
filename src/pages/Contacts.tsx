import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { whatsappUrl } from '../lib/share'
import type { Person } from '../lib/types'
import { Icon, Sheet, initials, useToast } from '../components/ui'

function ContactSheet({ person, onClose, onSaved }: { person: Partial<Person>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ name: person.name || '', phone: person.phone || '', note: person.note || '' })
  const [busy, setBusy] = useState(false)
  const isNew = !person.id

  async function save() {
    if (!f.name.trim()) return toast('Digite o nome')
    setBusy(true)
    try {
      await api.savePerson(null, { ...f, id: person.id, is_pastor: person.is_pastor })
      toast(isNew ? 'Contato cadastrado' : 'Contato atualizado')
      onSaved()
      onClose()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const uses = person.uses || 0
    const msg = uses
      ? `Excluir ${person.name}? Ele(a) está em ${uses} oportunidade(s), que vão ficar sem responsável.`
      : `Excluir ${person.name}?`
    if (!confirm(msg)) return
    try {
      await api.deletePerson(person.id!)
      toast('Contato excluído')
      onSaved()
      onClose()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <Sheet
      title={isNew ? 'Novo contato' : 'Editar contato'}
      onClose={onClose}
      footer={
        <>
          {!isNew && !person.is_pastor && <button className="btn danger" onClick={remove} aria-label="Excluir"><Icon.trash /></button>}
          <button className="btn grow" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      <label className="field">
        <span>Nome</span>
        <input className="input" autoFocus={isNew} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome completo" />
      </label>
      {!person.is_pastor && (
        <>
          <label className="field">
            <span>WhatsApp</span>
            <input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(00) 00000-0000" />
          </label>
          <label className="field">
            <span>Observação</span>
            <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ex.: filha da irmã Maria" />
          </label>
        </>
      )}
      {person.is_pastor && <p className="small muted" style={{ margin: 0 }}>Este é o cadastro do pastor. As oportunidades dele ficam confirmadas automaticamente.</p>}
      {!isNew && person.phone && !person.is_pastor && (
        <a className="btn whats block" href={whatsappUrl(person.phone, 'A paz do Senhor! 🙏')} target="_blank" rel="noreferrer"><Icon.whats /> Conversar no WhatsApp</a>
      )}
      {!isNew && <p className="tiny muted" style={{ margin: 0 }}>Participa de {person.uses || 0} oportunidade(s) cadastrada(s).</p>}
    </Sheet>
  )
}

export function ContactsPage() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [people, setPeople] = useState<Person[] | null>(null)
  const [open, setOpen] = useState<Partial<Person> | null>(null)

  const load = useCallback(async () => {
    try {
      setPeople(await api.listPeople(q))
    } catch (e) {
      toast((e as Error).message)
      setPeople([])
    }
  }, [q, toast])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="icon-btn" aria-label="Voltar"><Icon.back /></Link>
        <div className="title">
          <div className="t1">Contatos</div>
          <div className="t2">{people ? `${people.length} pessoa(s)` : 'Carregando…'}</div>
        </div>
      </header>
      <main className="page">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, telefone ou observação…" inputMode="search" />
        <div className="card flush">
          {people?.length ? (
            people.map((p) => (
              <button key={p.id} className="ev" style={{ width: '100%', border: 0, borderTop: '1px solid var(--line)', background: '#fff', textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpen(p)}>
                <div className="avatar" style={p.is_pastor ? { background: 'var(--orange)', color: '#fff' } : undefined}>{initials(p.name)}</div>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>
                    {p.name}
                    {p.is_pastor && <span className="badge mode" style={{ background: 'var(--orange)', marginLeft: 6 }}>Pastor</span>}
                  </div>
                  <div className="tiny muted">{[p.phone, p.note].filter(Boolean).join(' · ') || (p.is_pastor ? '' : 'Sem telefone')}</div>
                </div>
                <span className="muted" style={{ display: 'grid', width: 20 }}><Icon.next /></span>
              </button>
            ))
          ) : (
            <div className="empty">
              <b>{people === null ? 'Carregando…' : q ? 'Ninguém encontrado' : 'Nenhum contato ainda'}</b>
              {people !== null && 'Cadastre aqui ou direto na hora de escolher a pessoa de uma oportunidade.'}
            </div>
          )}
        </div>
      </main>
      <button className="btn fab" onClick={() => setOpen({ name: q })}><Icon.plus /> Novo contato</button>
      {open && <ContactSheet person={open} onClose={() => setOpen(null)} onSaved={load} />}
    </div>
  )
}
