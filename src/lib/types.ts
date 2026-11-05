export interface Person {
  id: string
  name: string
  phone?: string | null
  note?: string | null
  is_pastor?: boolean
  uses?: number
}

export type Status = 'pendente' | 'aceito' | 'recusado'

export interface Hymn {
  number: number
  title: string
}

export interface ItemDetails {
  hymns?: Hymn[]
  hymn_count?: number
  songs?: string
  song_count?: number
  mode?: 'tocado' | 'playback' | ''
  tone?: string
  playback_link?: string
  regente?: string
  solista?: string
  vocalistas?: string
  musicos?: string
  instrumentos?: string
  reference?: string
  message_title?: string
  notes?: string
}

export interface Item {
  id: string
  event_id: string
  section: 'programa' | 'apoio'
  position: number
  kind: string
  title: string | null
  duration_min: number
  person_id: string | null
  person: Person | null
  details: ItemDetails
  status: Status
  needs_confirmation?: boolean
  response_note?: string | null
  responded_at?: string | null
  invite_token?: string
}

export interface CultEvent {
  id: string
  kind: string
  title: string
  event_date: string
  start_time: string
  end_time: string
  theme: string | null
  verse: string | null
  main_reading: string | null
  notes: string | null
  director_id: string | null
  director: Person | null
  director_token?: string
}

export interface EventSummary {
  id: string
  kind: string
  title: string
  event_date: string
  start_time: string
  end_time: string
  theme: string | null
  director_name: string | null
  filled_min: number
  invited: number
  accepted: number
  declined: number
}

export interface EventBundle {
  is_admin: boolean
  event: CultEvent
  items: Item[]
}

export interface InviteBundle {
  item: Item
  event: CultEvent
  items: Item[]
}
