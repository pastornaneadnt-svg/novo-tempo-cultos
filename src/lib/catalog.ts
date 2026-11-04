// Catálogo dos tipos de oportunidade e das funções da equipe de apoio.

export type FieldKey =
  | 'hymns'
  | 'songs'
  | 'mode'
  | 'regente'
  | 'solista'
  | 'vocalistas'
  | 'musicos'
  | 'instrumentos'
  | 'reference'
  | 'message_title'
  | 'notes'

export interface KindDef {
  key: string
  label: string
  duration: number
  personLabel: string
  fields: FieldKey[]
  group?: string
}

const GROUP_FIELDS: FieldKey[] = ['songs', 'mode', 'regente', 'solista', 'musicos', 'notes']
const SONG_FIELDS: FieldKey[] = ['songs', 'mode', 'notes']

export const PROGRAM_KINDS: KindDef[] = [
  { key: 'oracao_abertura', label: 'Oração de Abertura', duration: 3, personLabel: 'Quem vai orar', fields: ['notes'], group: 'Abertura' },
  { key: 'harpa', label: 'Louvores da Harpa Cristã', duration: 10, personLabel: 'Quem vai cantar / dirigir', fields: ['hymns', 'notes'], group: 'Abertura' },
  { key: 'leitura_inicial', label: 'Leitura Bíblica Inicial', duration: 3, personLabel: 'Quem vai ler', fields: ['reference', 'notes'], group: 'Abertura' },
  { key: 'oracao_igreja', label: 'Oração pela Igreja e pelos Pedidos', duration: 5, personLabel: 'Quem vai orar', fields: ['notes'], group: 'Abertura' },

  { key: 'grupo_louvor', label: 'Grupo de Louvor', duration: 15, personLabel: 'Líder do grupo', fields: ['songs', 'mode', 'vocalistas', 'musicos', 'notes'], group: 'Louvor' },
  { key: 'grupo_criancas', label: 'Grupo das Crianças', duration: 8, personLabel: 'Líder do grupo', fields: GROUP_FIELDS, group: 'Louvor' },
  { key: 'grupo_adolescentes', label: 'Grupo dos Adolescentes', duration: 8, personLabel: 'Líder do grupo', fields: GROUP_FIELDS, group: 'Louvor' },
  { key: 'grupo_jovens', label: 'Grupo dos Jovens', duration: 8, personLabel: 'Líder do grupo', fields: GROUP_FIELDS, group: 'Louvor' },
  { key: 'grupo_varoes', label: 'Grupo dos Varões', duration: 8, personLabel: 'Líder do grupo', fields: GROUP_FIELDS, group: 'Louvor' },
  { key: 'grupo_irmas', label: 'Grupo das Irmãs', duration: 8, personLabel: 'Líder do grupo', fields: GROUP_FIELDS, group: 'Louvor' },
  { key: 'coral', label: 'Coral', duration: 8, personLabel: 'Líder / regente do coral', fields: GROUP_FIELDS, group: 'Louvor' },
  { key: 'louvor_avulso', label: 'Louvor Avulso', duration: 5, personLabel: 'Quem vai cantar', fields: SONG_FIELDS, group: 'Louvor' },
  { key: 'louvor_instrumental', label: 'Louvor Instrumental', duration: 5, personLabel: 'Quem vai tocar', fields: ['songs', 'instrumentos', 'notes'], group: 'Louvor' },

  { key: 'saudacao', label: 'Saudação', duration: 3, personLabel: 'Quem vai saudar', fields: ['notes'], group: 'Momentos' },
  { key: 'testemunho', label: 'Testemunho', duration: 5, personLabel: 'Quem vai testemunhar', fields: ['notes'], group: 'Momentos' },
  { key: 'apresentacao_visitantes', label: 'Apresentação de Visitantes', duration: 5, personLabel: 'Responsável', fields: ['notes'], group: 'Momentos' },
  { key: 'avisos', label: 'Avisos e Comunicados', duration: 5, personLabel: 'Quem vai dar os avisos', fields: ['notes'], group: 'Momentos' },

  { key: 'oracao_ofertas', label: 'Oração pelas Ofertas', duration: 2, personLabel: 'Quem vai orar', fields: ['notes'], group: 'Ofertas' },
  { key: 'recolhimento_ofertas', label: 'Recolhimento de Dízimos e Ofertas', duration: 5, personLabel: 'Responsável', fields: ['notes'], group: 'Ofertas' },
  { key: 'louvor_ofertas', label: 'Louvor durante as Ofertas', duration: 5, personLabel: 'Quem vai cantar', fields: SONG_FIELDS, group: 'Ofertas' },

  { key: 'leitura_principal', label: 'Leitura Bíblica Principal', duration: 3, personLabel: 'Quem vai ler', fields: ['reference', 'notes'], group: 'Palavra' },
  { key: 'pregacao', label: 'Palavra Principal — Pregação', duration: 40, personLabel: 'Pregador', fields: ['message_title', 'reference', 'notes'], group: 'Palavra' },
  { key: 'apelo', label: 'Apelo', duration: 5, personLabel: 'Quem vai fazer o apelo', fields: ['notes'], group: 'Palavra' },
  { key: 'oracao_aceitaram', label: 'Oração pelos que Aceitaram Jesus', duration: 3, personLabel: 'Quem vai orar', fields: ['notes'], group: 'Palavra' },
  { key: 'oracao_cura', label: 'Oração por Cura e Libertação', duration: 5, personLabel: 'Quem vai orar', fields: ['notes'], group: 'Palavra' },

  { key: 'ceia_ministracao', label: 'Santa Ceia — Ministração', duration: 10, personLabel: 'Quem vai ministrar', fields: ['notes'], group: 'Santa Ceia' },
  { key: 'ceia_distribuicao', label: 'Santa Ceia — Distribuição', duration: 10, personLabel: 'Responsável', fields: ['notes'], group: 'Santa Ceia' },

  { key: 'louvor_final', label: 'Louvor Final', duration: 5, personLabel: 'Quem vai cantar', fields: SONG_FIELDS, group: 'Encerramento' },
  { key: 'oracao_final', label: 'Oração Final', duration: 2, personLabel: 'Quem vai orar', fields: ['notes'], group: 'Encerramento' },
  { key: 'bencao_apostolica', label: 'Bênção Apostólica', duration: 2, personLabel: 'Quem vai impetrar a bênção', fields: ['notes'], group: 'Encerramento' },
  { key: 'encerramento', label: 'Encerramento', duration: 2, personLabel: 'Responsável', fields: ['notes'], group: 'Encerramento' },

  { key: 'outro', label: 'Outra oportunidade', duration: 5, personLabel: 'Responsável', fields: ['notes'], group: 'Outros' },
]

export const SUPPORT_KINDS: KindDef[] = [
  { key: 'fotografia', label: 'Fotografia', duration: 0, personLabel: 'Quem vai fotografar', fields: ['notes'] },
  { key: 'filmagem', label: 'Filmagem / Transmissão', duration: 0, personLabel: 'Responsável', fields: ['notes'] },
  { key: 'servir_ceia', label: 'Servir a Santa Ceia', duration: 0, personLabel: 'Quem vai servir', fields: ['notes'] },
  { key: 'recolher_oferta', label: 'Recolher a Oferta', duration: 0, personLabel: 'Quem vai recolher', fields: ['notes'] },
  { key: 'recepcao', label: 'Recepção / Portaria', duration: 0, personLabel: 'Responsável', fields: ['notes'] },
  { key: 'som', label: 'Som / Mesa', duration: 0, personLabel: 'Responsável', fields: ['notes'] },
  { key: 'projecao', label: 'Projeção / Data show', duration: 0, personLabel: 'Responsável', fields: ['notes'] },
  { key: 'intercessao', label: 'Intercessão', duration: 0, personLabel: 'Responsável', fields: ['notes'] },
  { key: 'cuidado_criancas', label: 'Cuidado das Crianças', duration: 0, personLabel: 'Responsável', fields: ['notes'] },
  { key: 'apoio_outro', label: 'Outra função', duration: 0, personLabel: 'Responsável', fields: ['notes'] },
]

const ALL = new Map([...PROGRAM_KINDS, ...SUPPORT_KINDS].map((k) => [k.key, k]))

export function kindDef(key: string): KindDef {
  return ALL.get(key) ?? { key, label: key, duration: 5, personLabel: 'Responsável', fields: ['notes'] }
}

export function itemLabel(item: { kind: string; title?: string | null }): string {
  return item.title?.trim() || kindDef(item.kind).label
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  hymns: 'Hinos da Harpa Cristã',
  songs: 'Louvor(es)',
  mode: 'Tocado ou playback?',
  regente: 'Quem vai reger',
  solista: 'Quem vai solar',
  vocalistas: 'Vocalistas',
  musicos: 'Quem vai tocar (músicos)',
  instrumentos: 'Instrumentos',
  reference: 'Texto bíblico',
  message_title: 'Título da mensagem',
  notes: 'Observações',
}

export const FIELD_PLACEHOLDERS: Partial<Record<FieldKey, string>> = {
  songs: 'Nome do louvor (um por linha)',
  regente: 'Nome',
  solista: 'Nome',
  vocalistas: 'Nomes',
  musicos: 'Ex.: João (teclado), Pedro (bateria)',
  instrumentos: 'Ex.: violino, teclado',
  reference: 'Ex.: Salmos 23:1-6',
  message_title: 'Ex.: O tempo de Deus',
  notes: 'Alguma informação importante',
}

// Ordem padrão de um culto, usada para começar um culto novo já montado.
export const DEFAULT_ORDER = [
  'oracao_abertura',
  'harpa',
  'leitura_inicial',
  'oracao_igreja',
  'grupo_louvor',
  'saudacao',
  'apresentacao_visitantes',
  'avisos',
  'oracao_ofertas',
  'recolhimento_ofertas',
  'louvor_ofertas',
  'leitura_principal',
  'pregacao',
  'apelo',
  'oracao_final',
  'bencao_apostolica',
]
