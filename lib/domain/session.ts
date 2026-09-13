'use client'

import { db } from '@/lib/db/local'
import { baseFields, patch, save, now } from '@/lib/db/repo'
import type {
  Activity,
  ActivityRecord,
  Patient,
  Session,
  Trial,
} from '@/lib/db/types'
import { computePercent } from './performance'
import { todayISO, nowTime } from '@/lib/format'

/**
 * Operações de uma sessão de atendimento.
 *
 * Tudo passa por save(), então cada toque durante o atendimento já fica
 * guardado no aparelho — se o app fechar no meio, nada se perde.
 */

/**
 * Abre a sessão de hoje para um paciente, ou devolve a que já existe.
 *
 * Regra de "uma por dia": dois toques em "iniciar atendimento" no mesmo dia
 * não criam prontuários duplicados. Se precisar de dois atendimentos no
 * mesmo dia, o segundo é criado explicitamente.
 */
export async function openTodaySession(
  therapistId: string,
  patient: Patient,
): Promise<Session> {
  const today = todayISO()
  const existing = (await db().sessions.toArray()).find(
    (s) =>
      !s.deleted_at &&
      s.patient_id === patient.id &&
      s.session_date === today,
  )
  if (existing) return existing

  const session: Session = {
    ...(baseFields(therapistId) as Session),
    patient_id: patient.id,
    institution_id: patient.institution_id,
    session_date: today,
    start_time: nowTime(),
    end_time: '',
    objectives: '',
    resources: '',
    description: '',
    patient_response: '',
    incidents: '',
    conduct: '',
    status: 'draft',
    sent_clinica_at: null,
    sent_whatsapp_at: null,
  }
  return save('sessions', session)
}

export async function createSession(
  therapistId: string,
  patient: Patient,
  date: string,
): Promise<Session> {
  const session: Session = {
    ...(baseFields(therapistId) as Session),
    patient_id: patient.id,
    institution_id: patient.institution_id,
    session_date: date,
    start_time: nowTime(),
    end_time: '',
    objectives: '',
    resources: '',
    description: '',
    patient_response: '',
    incidents: '',
    conduct: '',
    status: 'draft',
    sent_clinica_at: null,
    sent_whatsapp_at: null,
  }
  return save('sessions', session)
}

/**
 * Grava uma alteração parcial no prontuário (autosave).
 *
 * Usa patch(), não save(): os blocos do prontuário salvam sozinhos e em
 * paralelo, então a mesclagem precisa partir do estado mais recente no
 * banco, não da cópia da sessão que este campo específico está segurando —
 * senão o autosave de um campo apaga o que outro acabou de gravar.
 */
export async function patchSession(
  session: Session,
  changes: Partial<Session>,
): Promise<Session> {
  return patch('sessions', session.id, changes)
}

export async function finalizeSession(session: Session): Promise<Session> {
  return patch<Session>('sessions', session.id, {
    status: 'final',
    end_time: session.end_time || nowTime(),
  })
}

export async function reopenSession(session: Session): Promise<Session> {
  return patch<Session>('sessions', session.id, { status: 'draft' })
}

/**
 * Pega o registro de desempenho de uma atividade nesta sessão, criando-o
 * vazio na primeira vez. O snapshot do tipo e da config é tirado agora: se a
 * atividade for editada depois, este registro continua sendo lido com as
 * regras que valiam no dia.
 */
export async function ensureRecord(
  therapistId: string,
  session: Session,
  activity: Activity,
): Promise<ActivityRecord> {
  const existing = (
    await db().activity_records.where('session_id').equals(session.id).toArray()
  ).find((r) => !r.deleted_at && r.activity_id === activity.id)
  if (existing) return existing

  const record: ActivityRecord = {
    ...(baseFields(therapistId) as ActivityRecord),
    session_id: session.id,
    patient_id: session.patient_id,
    activity_id: activity.id,
    measurement_type: activity.measurement_type,
    config_snapshot: activity.config,
    activity_name: activity.name,
    trials: [],
    score: null,
    duration_seconds: null,
    count_value: null,
    computed_percent: null,
    notes: '',
  }
  return save('activity_records', record)
}

/**
 * Recalcula o percentual e grava. Chamado a cada toque de registro.
 *
 * Recebe só os campos alterados (`changes`), não o registro inteiro: a
 * gravação (patch) mescla sobre o estado mais recente no banco, então as
 * notas da atividade — que salvam sozinhas, em paralelo — não são apagadas
 * por um toque no contador que partiu de uma cópia mais antiga do registro.
 */
async function persistRecord(
  record: ActivityRecord,
  changes: Partial<ActivityRecord>,
): Promise<ActivityRecord> {
  const merged = { ...record, ...changes }
  const computed_percent = computePercent(
    merged.measurement_type,
    merged.config_snapshot,
    merged,
  )
  return patch('activity_records', record.id, { ...changes, computed_percent })
}

export async function addTrial(
  record: ActivityRecord,
  trial: Omit<Trial, 'n' | 'at'>,
): Promise<ActivityRecord> {
  const next: Trial = {
    ...trial,
    n: record.trials.length + 1,
    at: now(),
  }
  return persistRecord(record, { trials: [...record.trials, next] })
}

export async function removeLastTrial(
  record: ActivityRecord,
): Promise<ActivityRecord> {
  return persistRecord(record, { trials: record.trials.slice(0, -1) })
}

export async function setScore(
  record: ActivityRecord,
  score: number | null,
): Promise<ActivityRecord> {
  return persistRecord(record, { score })
}

export async function setCount(
  record: ActivityRecord,
  count_value: number,
): Promise<ActivityRecord> {
  return persistRecord(record, { count_value: Math.max(0, count_value) })
}

export async function setDuration(
  record: ActivityRecord,
  duration_seconds: number,
): Promise<ActivityRecord> {
  return persistRecord(record, { duration_seconds })
}

export async function setRecordNotes(
  record: ActivityRecord,
  notes: string,
): Promise<ActivityRecord> {
  return patch<ActivityRecord>('activity_records', record.id, { notes })
}

/**
 * Atribui ou reativa uma atividade para um paciente. É o que faz a atividade
 * aparecer na tela de atendimento dele.
 */
export async function attachActivity(
  therapistId: string,
  patientId: string,
  activityId: string,
): Promise<void> {
  const link = (
    await db().patient_activities.where('patient_id').equals(patientId).toArray()
  ).find((l) => l.activity_id === activityId)

  if (link) {
    await save('patient_activities', {
      ...link,
      is_active: true,
      deleted_at: null,
    })
    return
  }

  const count = (
    await db().patient_activities.where('patient_id').equals(patientId).toArray()
  ).filter((l) => !l.deleted_at).length

  await save('patient_activities', {
    ...baseFields(therapistId),
    patient_id: patientId,
    activity_id: activityId,
    target: '',
    sort_order: count,
    is_active: true,
  })
}

export async function detachActivity(
  patientId: string,
  activityId: string,
): Promise<void> {
  const link = (
    await db().patient_activities.where('patient_id').equals(patientId).toArray()
  ).find((l) => l.activity_id === activityId && !l.deleted_at)
  if (link) await save('patient_activities', { ...link, is_active: false })
}
