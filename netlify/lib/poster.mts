// Monta o pedido de banner completo para a IA de imagem da OpenAI.

export type PhotoRole = 'pastores' | 'pregador' | 'cantor' | 'grupo' | 'outra'

export interface PosterPhoto {
  role: PhotoRole
  name?: string
  data: string // data:image/jpeg;base64,...
}

export interface PosterInput {
  format: 'vertical' | 'quadrado'
  title: string
  headline: string
  subtitle?: string
  concept?: string
  info: {
    data?: string
    horario?: string
    local?: string
    tema?: string
    versiculo?: string
    pregador?: string
    pastores?: string
    extra?: string
  }
  photos: PosterPhoto[]
  reference?: string
  previous?: string
  instruction?: string
}

const ROLE_TEXT: Record<PhotoRole, string> = {
  pastores: 'the senior pastors of the church (Pastores Presidentes)',
  pregador: 'the preacher of this event',
  cantor: 'a guest singer of this event',
  grupo: 'a church group / choir that will sing',
  outra: 'an image the pastor wants included in the poster',
}

/** Ordem das imagens enviadas: (banner atual se for alteração), fotos, referência por último. */
export function orderedImages(input: PosterInput): string[] {
  return [...(input.previous ? [input.previous] : []), ...input.photos.map((p) => p.data), ...(input.reference ? [input.reference] : [])]
}

function q(s: string) {
  return `"${s.replace(/"/g, "'").trim()}"`
}

export function buildPrompt(input: PosterInput): string {
  const shape = input.format === 'quadrado' ? 'square (1:1)' : 'vertical (2:3)'
  const offset = input.previous ? 1 : 0
  const photoLines = input.photos.map((p, i) => {
    const who = ROLE_TEXT[p.role]
    const name = p.name?.trim() ? ` — name: ${q(p.name)}` : ''
    return `- Image ${i + 1 + offset}: photo of ${who}${name}.`
  })
  const refIndex = input.reference ? input.photos.length + 1 + offset : 0

  const i = input.info
  const texts: string[] = [`- Main title (biggest, most striking): ${q(input.headline)}`]
  if (input.subtitle?.trim()) texts.push(`- Short phrase under the title: ${q(input.subtitle)}`)
  if (i.tema?.trim() && i.tema.trim().toLowerCase() !== input.headline.trim().toLowerCase()) texts.push(`- Theme line: ${q('Tema: ' + i.tema)}`)
  if (i.pregador?.trim()) texts.push(`- Preacher label + name: ${q('Ministrando a Palavra')} and ${q(i.pregador)}`)
  if (i.pastores?.trim()) texts.push(`- Senior pastors label + names: ${q('Pastores Presidentes')} and ${q(i.pastores)}`)
  for (const p of input.photos) if ((p.role === 'cantor' || p.role === 'grupo') && p.name?.trim()) texts.push(`- Name next to that photo: ${q(p.name)}`)
  if (i.versiculo?.trim()) texts.push(`- Bible verse (smaller, italic, in quotes, with the reference below it): ${q(i.versiculo)}`)
  if (i.data?.trim()) texts.push(`- Date (with a calendar icon): ${q(i.data)}`)
  if (i.horario?.trim()) texts.push(`- Time (with a clock icon): ${q(i.horario)}`)
  if (i.local?.trim()) texts.push(`- Address (with a location pin icon): ${q(i.local)}`)
  if (i.extra?.trim()) texts.push(`- Extra line: ${q(i.extra)}`)

  const common = `
TEXT RULES: write ONLY the texts listed, in Brazilian Portuguese, spelled EXACTLY as given, with correct accents (ç, ã, á, é, ê, í, ó, ô, ú). No other words, no lorem ipsum, no English.
PEOPLE: keep every person exactly as in the photos — same face, skin tone, hair, glasses, body and clothes. Do not invent new people, do not change faces, do not add hands or extra limbs. Cut them out cleanly and integrate them with matching lighting.
LOGO: keep the TOP-CENTER area (top 12% of the height, center) completely clean and simple — the church's official logo will be placed there afterwards. Do NOT draw any logo, emblem, watermark or church name.`

  if (input.previous) {
    return `Image 1 is the current church event poster. Edit it applying exactly this change requested by the pastor: ${q(input.instruction || 'improve the overall design')}.
Keep everything else as it is (layout, people, colors, texts) unless the change requires otherwise.
${photoLines.length ? 'Other images provided:\n' + photoLines.join('\n') : ''}
${texts.length ? 'The poster texts must remain (unless the change says otherwise):\n' + texts.join('\n') : ''}
${common}`
  }

  return `Design a professional ${shape} social-media poster for a Brazilian evangelical church event (Assembleia de Deus), in the polished style of modern Brazilian church flyers: cinematic lighting, glowing light effects and bokeh, depth, rich gradient background, people as clean cutout portraits, bold modern typography mixing a large heavy title with a lighter or elegant script word, and tidy information blocks with simple white line icons (calendar, clock, location pin) inside rounded outlined boxes.
EVENT: ${q(input.title)}.
WHAT IT IS ABOUT / VISUAL CONCEPT: ${input.concept?.trim() || 'a reverent, joyful worship service'}. Add tasteful symbolic elements that match this event (for example bread, grapes and a chalice for Holy Communion; flowers and a pink ribbon for a women's Outubro Rosa event; open Bible and light for a teaching service).
COLORS: use the church brand — vibrant orange #FE6402, dark graphite #283135 and warm golden light — unless the event clearly calls for another palette (e.g. pink tones for women's events).
TEXTS TO WRITE:
${texts.join('\n')}
${photoLines.length ? 'PHOTOS PROVIDED:\n' + photoLines.join('\n') : 'No photos of people were provided: do not draw any people.'}
${refIndex ? `STYLE REFERENCE: Image ${refIndex} is a poster the pastor liked. Follow its layout, composition, typography style and overall feel, but do NOT copy its texts, people, logos or exact images.` : ''}
${common}`
}

// ---------- Só a ARTE DE FUNDO (sem pessoas, sem texto) ----------
// As pessoas são recortadas da foto original e o texto é montado pelo app,
// para o rosto NUNCA ser alterado e as letras saírem sempre certas.
export interface BackgroundInput {
  kind: 'background'
  format: 'vertical' | 'quadrado'
  title: string
  concept?: string
  hasPeople: boolean
  reference?: string
  previous?: string
  instruction?: string
}

export function backgroundImages(input: BackgroundInput): string[] {
  if (input.previous) return [input.previous]
  return input.reference ? [input.reference] : []
}

export function buildBackgroundPrompt(input: BackgroundInput): string {
  const vertical = input.format !== 'quadrado'
  const layout = vertical
    ? `- Top 12% of the height: plain, calm and fairly dark (the logo goes there).
- ${input.hasPeople ? 'From 12% to 62% of the height, CENTER: keep it clear, soft and uncluttered with a gentle glow/backlight — photos of people will be placed there later.' : 'Upper-middle area: soft and uncluttered, with a gentle light glow (a big title goes there).'}
- Bottom 40%: darker and calm, for white text; decorative props of the theme may sit low on the left and right edges and slightly behind where the title will be, never covering the center.`
    : `- Left 55%: darker, calm and uncluttered for white text; the logo goes at the top-left.
- ${input.hasPeople ? 'Right 45%: soft glow/backlight, clear of objects — photos of people will be placed there later.' : 'Right side: elegant theme props and light.'}
- Theme props may sit in the bottom corners.`

  const rules = `STRICTLY: NO people, NO faces, NO hands, NO silhouettes of people, NO text, NO letters, NO numbers, NO words, NO logos, NO watermarks, NO frames, NO borders.`

  if (input.previous) {
    return `Image 1 is the background artwork of a church event poster. Change it exactly as requested: "${(input.instruction || '').replace(/"/g, "'")}".
Keep the same composition rules:
${layout}
${rules}`
  }

  return `Create ONLY the BACKGROUND ARTWORK for a modern ${vertical ? 'vertical (2:3)' : 'square (1:1)'} church event poster — no text and no people; text and people photos will be added on top later.
STYLE: contemporary large-church / worship-conference visual identity: premium, minimal and cinematic, high-end studio lighting, depth of field, soft haze, subtle light rays and bokeh, rich gradients, refined 3D-like objects. Modern, not cartoonish, not cluttered.
EVENT: "${input.title.replace(/"/g, "'")}". WHAT IT IS ABOUT: ${input.concept?.trim() || 'a reverent and joyful worship service'}.
Add elegant symbolic objects that match this event (e.g. bread, grapes and a golden chalice for Holy Communion; flowers and a pink ribbon for a women's Outubro Rosa event; an open Bible and light for a teaching night; water for a baptism).
COLORS: church brand — vibrant orange #FE6402, deep graphite #283135 and warm golden light — unless the event clearly calls for another palette (e.g. pink for women's events).
${input.reference ? 'Image 1 is a reference poster the pastor liked: borrow its color palette, lighting mood and decorative style ONLY. Do NOT include its people, texts, logos or layout boxes.\n' : ''}COMPOSITION (very important):
${layout}
${rules}`
}
