import Dexie, { type EntityTable } from 'dexie'
import type {
  Activity,
  ActivityRecord,
  Institution,
  Patient,
  PatientActivity,
  Session,
  SyncedTable,
} from './types'

/**
 * Fila de envio. Guarda apenas *qual linha* mudou, nunca o conteúdo: na hora
 * de sincronizar lemos o estado atual da linha local e enviamos. Assim várias
 * edições seguidas do mesmo prontuário viram um único envio, e a exclusão
 * (que é lógica) não precisa de tratamento separado.
 */
export interface OutboxEntry {
  /** `${table}:${row_id}` — garante uma entrada por linha. */
  key: string
  table: SyncedTable
  row_id: string
  queued_at: string
}

/** Marca d'água do pull, por tabela. */
export interface SyncState {
  table: SyncedTable
  /** updated_at da linha remota mais recente já trazida. */
  last_pulled_at: string
}

/** Preferências locais do aparelho — não sincronizam. */
export interface LocalSetting {
  key: string
  value: unknown
}

export class MusicoterapiaDB extends Dexie {
  institutions!: EntityTable<Institution, 'id'>
  patients!: EntityTable<Patient, 'id'>
  activities!: EntityTable<Activity, 'id'>
  patient_activities!: EntityTable<PatientActivity, 'id'>
  sessions!: EntityTable<Session, 'id'>
  activity_records!: EntityTable<ActivityRecord, 'id'>
  outbox!: EntityTable<OutboxEntry, 'key'>
  sync_state!: EntityTable<SyncState, 'table'>
  settings!: EntityTable<LocalSetting, 'key'>

  constructor() {
    super('musicoterapia')
    this.version(1).stores({
      institutions: 'id, name, updated_at, deleted_at',
      patients: 'id, code, full_name, status, institution_id, updated_at, deleted_at',
      activities: 'id, name, measurement_type, is_active, updated_at, deleted_at',
      patient_activities: 'id, patient_id, activity_id, is_active, updated_at, deleted_at',
      sessions: 'id, patient_id, session_date, status, updated_at, deleted_at',
      activity_records: 'id, session_id, patient_id, activity_id, updated_at, deleted_at',
      outbox: 'key, table, queued_at',
      sync_state: 'table',
      settings: 'key',
    })
  }
}

/**
 * Instância única. Em ambiente sem IndexedDB (renderização no servidor) o
 * Dexie não pode ser construído, então só criamos no navegador.
 */
let _db: MusicoterapiaDB | null = null

export function db(): MusicoterapiaDB {
  if (typeof window === 'undefined') {
    throw new Error('O banco local só existe no navegador.')
  }
  if (!_db) _db = new MusicoterapiaDB()
  return _db
}

/** Apaga tudo que está guardado neste aparelho (logout, troca de conta). */
export async function wipeLocalData(): Promise<void> {
  if (typeof window === 'undefined') return
  if (_db) {
    await _db.delete()
    _db = null
  } else {
    await Dexie.delete('musicoterapia')
  }
}
