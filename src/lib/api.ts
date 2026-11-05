import { supabase } from './supabase'
import type { EventBundle, EventSummary, InviteBundle, Item, Person, Status } from './types'

// Oportunidade do pastor, ou que não precisa de confirmação, é sempre confirmada.
export function autoConfirmed(i: Pick<Item, 'person' | 'needs_confirmation'>): boolean {
  return !!i.person && (!!i.person.is_pastor || i.needs_confirmation === false)
}

function pastorConfirmed<T extends { items: Item[] }>(b: T): T {
  return { ...b, items: b.items.map((i) => (autoConfirmed(i) ? { ...i, status: 'aceito' as Status } : i)) }
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const msg = error.message === 'sem permissão' ? 'Você não tem permissão para isso (link inválido ou expirado).' : error.message
    throw new Error(msg)
  }
  return data as T
}

export const api = {
  hasAdmin: () => rpc<boolean>('has_admin'),
  isAdmin: () => rpc<boolean>('is_admin'),
  claimAdmin: () => rpc<boolean>('claim_admin'),

  listEvents: (from: string, to: string) => rpc<EventSummary[]>('list_events', { p_from: from, p_to: to }),
  directorEvent: (token: string) => rpc<string | null>('director_event', { p_token: token }),
  getEvent: (id: string, token: string | null) => rpc<EventBundle>('get_event', { p_event: id, p_token: token }).then(pastorConfirmed),
  saveEvent: (token: string | null, p: Record<string, unknown>) => rpc<string>('save_event', { p_token: token, p }),
  deleteEvent: (id: string) => rpc<void>('delete_event', { p_id: id }),
  regenDirectorToken: (id: string) => rpc<string>('regen_director_token', { p_id: id }),

  saveItem: (token: string | null, p: Record<string, unknown>) => rpc<string>('save_item', { p_token: token, p }),
  deleteItem: (token: string | null, id: string) => rpc<void>('delete_item', { p_token: token, p_id: id }),
  reorderItems: (token: string | null, eventId: string, ids: string[]) =>
    rpc<void>('reorder_items', { p_token: token, p_event: eventId, p_ids: ids }),
  regenItemToken: (token: string | null, id: string) => rpc<string>('regen_item_token', { p_token: token, p_id: id }),

  searchPeople: (token: string | null, q: string) => rpc<Person[]>('search_people', { p_token: token, q }),
  getPastor: (token: string | null) => rpc<Person | null>('get_pastor', { p_token: token }),
  listPeople: (q: string) => rpc<Person[]>('list_people', { q }),
  deletePerson: (id: string) => rpc<void>('delete_person', { p_id: id }),
  savePerson: (token: string | null, p: Partial<Person>) => rpc<Person>('save_person', { p_token: token, p }),

  getInvite: (token: string) =>
    rpc<InviteBundle | null>('get_invite', { p_token: token }).then((b) => {
      if (!b) return b
      const n = pastorConfirmed(b)
      return { ...n, item: autoConfirmed(b.item) ? { ...b.item, status: 'aceito' as Status } : b.item }
    }),
  respondInvite: (token: string, status: Status, details: Record<string, unknown>, note: string) =>
    rpc<void>('respond_invite', { p_token: token, p_status: status, p_details: details, p_note: note }),
}
