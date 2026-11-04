import { useState } from 'react'
import { PROGRAM_KINDS, SUPPORT_KINDS, type KindDef } from '../lib/catalog'
import { Icon, Sheet } from './ui'

export function AddItemSheet({ section, onPick, onClose }: { section: 'programa' | 'apoio'; onPick: (k: KindDef) => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const kinds = section === 'programa' ? PROGRAM_KINDS : SUPPORT_KINDS
  const groups: [string, KindDef[]][] = []
  for (const k of kinds) {
    const g = k.group || ''
    const last = groups[groups.length - 1]
    if (last && last[0] === g) last[1].push(k)
    else groups.push([g, [k]])
  }
  return (
    <Sheet title={section === 'programa' ? 'Adicionar oportunidade' : 'Adicionar função de apoio'} onClose={onClose}>
      {groups.map(([g, list]) => (
        <div className="stack tight" key={g}>
          {g && <div className="kind-group">{g}</div>}
          <div className="kind-list">
            {list.map((k) => (
              <button key={k.key} className="kind-btn" disabled={busy} onClick={() => { setBusy(true); onPick(k) }}>
                <span>{k.label}</span>
                <span className="row tiny muted" style={{ gap: 4 }}>
                  {section === 'programa' && `${k.duration} min`}
                  <span style={{ color: 'var(--orange)', display: 'grid' }}><Icon.plus /></span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  )
}
