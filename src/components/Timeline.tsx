import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { itemLabel } from '../lib/catalog'
import { fmtMin } from '../lib/format'
import type { Item } from '../lib/types'
import { detailsSummary } from './DetailFields'
import { Icon, StatusBadge } from './ui'

interface Row {
  item: Item
  start: number
}

function Card({ row, readingHint, onOpen, highlight, handle }: { row: Row; readingHint?: string | null; onOpen?: () => void; highlight?: boolean; handle?: ReactNode }) {
  const { item } = row
  const cls = item.person ? item.status : 'vazio'
  const sum = detailsSummary(item.kind, item.details || {}, readingHint)
  return (
    <div className={`tl-card ${cls} ${highlight ? 'me' : ''}`} onClick={onOpen} role={onOpen ? 'button' : undefined}>
      <div className="grow">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="name">{itemLabel(item)}</div>
          {item.section === 'programa' && <div className="dur">{item.duration_min} min</div>}
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
          <span className="who">{item.person?.name || '—'}</span>
          <StatusBadge status={item.status} hasPerson={!!item.person} />
          {item.details?.mode && <span className="badge mode">{item.details.mode === 'playback' ? 'Playback' : 'Tocado'}</span>}
        </div>
        {sum && <div className="det">{sum}</div>}
      </div>
      {handle}
    </div>
  )
}

function SortableRow({ row, readingHint, onOpen, showTime }: { row: Row; readingHint?: string | null; onOpen: () => void; showTime: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.item.id })
  return (
    <div ref={setNodeRef} className={`tl-item ${isDragging ? 'dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {showTime && <div className="tl-time">{fmtMin(row.start)}</div>}
      {showTime && <div className="tl-rail"><i /></div>}
      <Card
        row={row}
        readingHint={readingHint}
        onOpen={onOpen}
        handle={
          <button ref={setActivatorNodeRef} className="handle" aria-label="Arrastar para reordenar" onClick={(e) => e.stopPropagation()} {...attributes} {...listeners}>
            <Icon.grip />
          </button>
        }
      />
    </div>
  )
}

export function Timeline({
  rows,
  readingHint,
  onOpen,
  onReorder,
  showTime = true,
}: {
  rows: Row[]
  readingHint?: string | null
  onOpen: (row: Row) => void
  onReorder: (ids: string[]) => void
  showTime?: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = rows.map((r) => r.item.id)
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={rows.map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
        <div className="tl">
          {rows.map((row) => (
            <SortableRow key={row.item.id} row={row} readingHint={readingHint} onOpen={() => onOpen(row)} showTime={showTime} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/** Versão só para leitura (página do convidado). */
export function ReadOnlyTimeline({ rows, readingHint, highlightId, showTime = true }: { rows: Row[]; readingHint?: string | null; highlightId?: string; showTime?: boolean }) {
  return (
    <div className="tl">
      {rows.map((row) => (
        <div className="tl-item" key={row.item.id}>
          {showTime && <div className="tl-time">{fmtMin(row.start)}</div>}
          {showTime && <div className="tl-rail"><i /></div>}
          <Card row={row} readingHint={readingHint} highlight={row.item.id === highlightId} />
        </div>
      ))}
    </div>
  )
}

export function TimeBar({ start, end, filled }: { start: number; end: number; filled: number }) {
  const total = Math.max(1, end - start)
  const diff = total - filled
  const cls = diff === 0 ? 'tb-ok' : diff > 0 ? 'tb-under' : 'tb-over'
  const pct = Math.min(100, (filled / total) * 100)
  const fmt = (m: number) => {
    const a = Math.abs(m)
    const h = Math.floor(a / 60)
    const mm = a % 60
    return h ? `${h}h${mm ? String(mm).padStart(2, '0') : ''}` : `${mm} min`
  }
  const label = diff === 0 ? 'Tempo completo ✓' : diff > 0 ? `Faltam ${fmt(diff)}` : `Passou ${fmt(-diff)}`
  return (
    <div className={`timebar ${cls}`}>
      <div className="card">
        <div className="row between small">
          <span><b>{fmt(filled)}</b> <span className="muted">de {fmt(total)}</span></span>
          <b className="lbl">{label}</b>
        </div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="row between tiny muted" style={{ marginTop: 4 }}>
          <span>{fmtMin(start)}</span>
          <span>termina {fmtMin(start + filled)}</span>
          <span>{fmtMin(end)}</span>
        </div>
      </div>
    </div>
  )
}
