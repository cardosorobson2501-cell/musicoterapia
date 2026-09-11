import type { ScheduleSlot } from './db/types'

export const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

/** "2026-09-10" → "10/09/2026". Sem Date, para não sofrer com fuso horário. */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Data de hoje no formato aceito por <input type="date">, no fuso local. */
export function todayISO(): string {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

/** Hora atual como "14:30", no fuso local. */
export function nowTime(): string {
  return new Date().toTimeString().slice(0, 5)
}

export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null
  const [y, m, d] = birthDate.slice(0, 10).split('-').map(Number)
  const today = new Date()
  let age = today.getFullYear() - y
  const passou =
    today.getMonth() + 1 > m ||
    (today.getMonth() + 1 === m && today.getDate() >= d)
  if (!passou) age -= 1
  return age >= 0 ? age : null
}

export function ageLabel(birthDate: string | null): string {
  const age = ageFrom(birthDate)
  return age === null ? 'Idade não informada' : `${age} anos`
}

/** Faixa etária de 3 anos, usada na exportação anonimizada. */
export function ageBracket(birthDate: string | null): string {
  const age = ageFrom(birthDate)
  if (age === null) return 'idade não informada'
  const base = Math.floor(age / 3) * 3
  return `${base}-${base + 2} anos`
}

export function formatSchedule(schedule: ScheduleSlot[]): string {
  if (!schedule?.length) return 'Sem horário fixo'
  return schedule
    .map((s) => `${WEEKDAYS_SHORT[s.weekday] ?? '?'} ${s.start_time}`)
    .join(' · ')
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Só os dígitos, no formato que o link do WhatsApp espera. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Número brasileiro digitado sem o código do país: acrescenta 55.
  if (digits.length <= 11 && !digits.startsWith('55')) return `55${digits}`
  return digits
}
