'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './local'
import type {
  Activity,
  ActivityRecord,
  Institution,
  Patient,
  PatientActivity,
  Session,
} from './types'

/**
 * Leituras do banco local.
 *
 * Tudo aqui passa por useLiveQuery: as telas se atualizam sozinhas quando a
 * sincronização traz algo novo, sem precisar recarregar nada. E como a origem
 * é o IndexedDB, funcionam igual com ou sem internet.
 *
 * Toda consulta filtra `deleted_at` — exclusão no app é lógica.
 */

const alive = <T extends { deleted_at: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => !r.deleted_at)

const byName = (a: { full_name?: string; name?: string }, b: typeof a) =>
  (a.full_name ?? a.name ?? '').localeCompare(b.full_name ?? b.name ?? '', 'pt-BR')

export function usePatients(includeInactive = false): Patient[] | undefined {
  return useLiveQuery(async () => {
    const rows = alive(await db().patients.toArray())
    return rows
      .filter((p) => includeInactive || p.status === 'active')
      .sort(byName)
  }, [includeInactive])
}

export function usePatient(id: string | undefined): Patient | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null
    const row = await db().patients.get(id)
    return row && !row.deleted_at ? row : null
  }, [id])
}

export function useInstitutions(): Institution[] | undefined {
  return useLiveQuery(async () =>
    alive(await db().institutions.toArray()).sort(byName),
  )
}

export function useActivities(includeInactive = false): Activity[] | undefined {
  return useLiveQuery(async () => {
    const rows = alive(await db().activities.toArray())
    return rows.filter((a) => includeInactive || a.is_active).sort(byName)
  }, [includeInactive])
}

export function useActivity(id: string | undefined): Activity | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null
    const row = await db().activities.get(id)
    return row && !row.deleted_at ? row : null
  }, [id])
}

/** Atividades atribuídas a um paciente, já com os dados da atividade. */
export function usePatientActivities(
  patientId: string | undefined,
): Array<{ link: PatientActivity; activity: Activity }> | undefined {
  return useLiveQuery(async () => {
    if (!patientId) return []
    const links = alive(
      await db().patient_activities.where('patient_id').equals(patientId).toArray(),
    ).filter((l) => l.is_active)

    const out = []
    for (const link of links.sort((a, b) => a.sort_order - b.sort_order)) {
      const activity = await db().activities.get(link.activity_id)
      if (activity && !activity.deleted_at) out.push({ link, activity })
    }
    return out
  }, [patientId])
}

/** Prontuários de um paciente, do mais recente para o mais antigo. */
export function usePatientSessions(
  patientId: string | undefined,
): Session[] | undefined {
  return useLiveQuery(async () => {
    if (!patientId) return []
    return alive(
      await db().sessions.where('patient_id').equals(patientId).toArray(),
    ).sort((a, b) => b.session_date.localeCompare(a.session_date))
  }, [patientId])
}

export function useSession(id: string | undefined): Session | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null
    const row = await db().sessions.get(id)
    return row && !row.deleted_at ? row : null
  }, [id])
}

export function useSessionRecords(
  sessionId: string | undefined,
): ActivityRecord[] | undefined {
  return useLiveQuery(async () => {
    if (!sessionId) return []
    return alive(
      await db().activity_records.where('session_id').equals(sessionId).toArray(),
    )
  }, [sessionId])
}

/** Prontuários finalizados que ainda não foram enviados para algum destino. */
export function usePendingDeliveries(): Session[] | undefined {
  return useLiveQuery(async () =>
    alive(await db().sessions.toArray())
      .filter(
        (s) =>
          s.status === 'final' && (!s.sent_clinica_at || !s.sent_whatsapp_at),
      )
      .sort((a, b) => b.session_date.localeCompare(a.session_date)),
  )
}

/**
 * Gera o próximo código de paciente (P001, P002…).
 *
 * Calculado a partir do maior código existente, e não da contagem: pacientes
 * arquivados continuam ocupando o número deles, e reaproveitar um código
 * confundiria duas pessoas diferentes numa exportação anonimizada.
 */
export async function nextPatientCode(): Promise<string> {
  const rows = await db().patients.toArray()
  const maior = rows.reduce((max, p) => {
    const n = Number.parseInt(p.code.replace(/\D/g, ''), 10)
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `P${String(maior + 1).padStart(3, '0')}`
}
