// Tom do hino/louvor: só a nota (C, D, Em…). Opcional.
export const TONES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']
const ALL = [...TONES, ...TONES.map((t) => t + 'm')]

export function ToneSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <select className="select tone-select" value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label="Tom">
      <option value="">Tom</option>
      <optgroup label="Maior">
        {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
      </optgroup>
      <optgroup label="Menor">
        {ALL.filter((t) => t.endsWith('m')).map((t) => <option key={t} value={t}>{t}</option>)}
      </optgroup>
    </select>
  )
}
