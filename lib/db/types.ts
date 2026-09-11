/**
 * Tipos do domínio, compartilhados entre o banco local (Dexie) e o Supabase.
 * Os nomes de campo são idênticos aos das colunas do Postgres — o que trafega
 * na sincronização é a linha crua, sem conversão.
 */

/** Campos presentes em toda entidade sincronizável. */
export interface SyncBase {
  id: string
  therapist_id: string
  created_at: string
  /** Base da resolução de conflito (last-write-wins). Sempre gerado no cliente. */
  updated_at: string
  /** Exclusão lógica: linha apagada continua existindo para poder sincronizar. */
  deleted_at: string | null
}

export interface Institution extends SyncBase {
  name: string
  kind: string
  notes: string
}

export interface Guardian {
  name: string
  relationship: string
  phone: string
  is_whatsapp_contact: boolean
}

export interface ScheduleSlot {
  /** 0 = domingo … 6 = sábado */
  weekday: number
  /** "14:00" */
  start_time: string
  duration_min: number
}

export type WhatsAppMode = 'contact' | 'group' | 'none'

export interface WhatsAppTarget {
  mode: WhatsAppMode
  /** Só para mode 'contact'. Formato E.164 sem "+": 5511999999999 */
  phone?: string
  /** Rótulo para o terapeuta se localizar. Ex.: "Grupo do João" */
  label?: string
}

export type PatientStatus = 'active' | 'paused' | 'discharged'

export interface Patient extends SyncBase {
  /** Pseudônimo estável usado na exportação anonimizada. Nunca muda. */
  code: string
  full_name: string
  nickname: string
  birth_date: string | null
  guardians: Guardian[]
  diagnosis: string
  allergies: string
  initial_condition: string
  main_demand: string
  institution_id: string | null
  schedule: ScheduleSlot[]
  whatsapp_target: WhatsAppTarget
  status: PatientStatus
  notes: string
}

export type MeasurementType =
  | 'trials'
  | 'prompt_levels'
  | 'scale'
  | 'duration'
  | 'count'

/** Configuração dos rótulos e limites de cada tipo de medição. */
export interface ActivityConfig {
  /** trials / prompt_levels: quantas tentativas se pretende aplicar. */
  target_trials?: number
  /** prompt_levels: do mais independente para o mais assistido. */
  levels?: string[]
  /** scale */
  min?: number
  max?: number
  labels?: Record<string, string>
  /** count: o que está sendo contado. Ex.: "vocalizações" */
  unit?: string
}

export interface Activity extends SyncBase {
  name: string
  description: string
  objective: string
  measurement_type: MeasurementType
  config: ActivityConfig
  mastery_criteria: string
  is_active: boolean
}

export interface PatientActivity extends SyncBase {
  patient_id: string
  activity_id: string
  target: string
  sort_order: number
  is_active: boolean
}

export type SessionStatus = 'draft' | 'final'

export interface Session extends SyncBase {
  patient_id: string
  institution_id: string | null
  /** "2026-09-10" */
  session_date: string
  start_time: string
  end_time: string
  objectives: string
  resources: string
  description: string
  patient_response: string
  incidents: string
  conduct: string
  status: SessionStatus
  sent_clinica_at: string | null
  sent_whatsapp_at: string | null
}

/** Resultado de uma tentativa em atividade do tipo 'trials'. */
export type TrialResult = 'correct' | 'incorrect' | 'prompted'

export interface Trial {
  n: number
  /** Preenchido em measurement_type 'trials'. */
  result?: TrialResult
  /** Índice em config.levels — preenchido em 'prompt_levels'. */
  prompt_level?: number
  note?: string
  /** Momento do toque, útil para reconstruir o ritmo da sessão. */
  at: string
}

export interface ActivityRecord extends SyncBase {
  session_id: string
  patient_id: string
  activity_id: string
  /** Cópia do tipo no momento do registro: editar a atividade depois não
   *  pode reinterpretar dados históricos. */
  measurement_type: MeasurementType
  config_snapshot: ActivityConfig
  activity_name: string
  trials: Trial[]
  score: number | null
  duration_seconds: number | null
  count_value: number | null
  computed_percent: number | null
  notes: string
}

export interface ExportLog {
  id: string
  therapist_id: string
  exported_at: string
  period_start: string | null
  period_end: string | null
  patient_count: number
  anonymized: boolean
  format: string
  contents: string
  created_at: string
  updated_at: string
}

export interface Therapist {
  id: string
  full_name: string
  council_id: string
  created_at: string
  updated_at: string
}

/** Nome das tabelas que participam da sincronização, na ordem em que devem
 *  ser enviadas — respeita as chaves estrangeiras do Postgres. */
export const SYNCED_TABLES = [
  'institutions',
  'patients',
  'activities',
  'patient_activities',
  'sessions',
  'activity_records',
] as const

export type SyncedTable = (typeof SYNCED_TABLES)[number]
