'use client'

import { db } from '@/lib/db/local'
import { SYNCED_TABLES, type SyncedTable } from '@/lib/db/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

/**
 * Sincronização entre o IndexedDB e o Supabase.
 *
 * Modelo: push-then-pull, last-write-wins por `updated_at`.
 *
 * Por que last-write-wins basta aqui: cada linha pertence a um único
 * terapeuta e é editada por uma pessoa de cada vez. O conflito real —
 * dois aparelhos editando o mesmo prontuário no mesmo minuto — não
 * acontece na prática deste uso. Em compensação o modelo é simples o
 * bastante para ser confiável, que é o que importa quando há dado
 * clínico esperando numa fila offline.
 */

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncReport {
  pushed: number
  pulled: number
  error?: string
}

/** Uma sincronização por vez: várias telas podem pedir ao mesmo tempo. */
let inFlight: Promise<SyncReport> | null = null

export function syncNow(): Promise<SyncReport> {
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function runSync(): Promise<SyncReport> {
  if (!isSupabaseConfigured()) {
    return { pushed: 0, pulled: 0, error: 'Supabase não configurado.' }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { pushed: 0, pulled: 0, error: 'offline' }
  }

  const sb = supabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return { pushed: 0, pulled: 0, error: 'Sem sessão.' }

  const pushed = await push()
  const pulled = await pull(auth.user.id)
  return { pushed, pulled }
}

/**
 * Envia as linhas pendentes. Cada tabela vai em bloco, na ordem declarada em
 * SYNCED_TABLES — que respeita as chaves estrangeiras (um prontuário não pode
 * chegar antes do paciente dele).
 */
async function push(): Promise<number> {
  const local = db()
  const sb = supabase()
  const queue = await local.outbox.toArray()
  if (queue.length === 0) return 0

  let sent = 0

  for (const table of SYNCED_TABLES) {
    const entries = queue.filter((e) => e.table === table)
    if (entries.length === 0) continue

    const rows = (
      await Promise.all(entries.map((e) => local.table(table).get(e.row_id)))
    ).filter(Boolean)
    if (rows.length === 0) {
      await local.outbox.bulkDelete(entries.map((e) => e.key))
      continue
    }

    const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' })
    if (error) {
      // Para tudo: as tabelas seguintes podem depender destas linhas.
      // O que já saiu foi removido da fila; o resto tenta de novo depois.
      throw new Error(`Falha ao enviar ${table}: ${error.message}`)
    }

    await local.outbox.bulkDelete(entries.map((e) => e.key))
    sent += rows.length
  }

  return sent
}

/**
 * Traz o que mudou no servidor desde a última vez. Uma linha remota só
 * sobrescreve a local se for mais recente E se a local não tiver alteração
 * pendente — o trabalho ainda não enviado nunca é perdido.
 */
async function pull(therapistId: string): Promise<number> {
  const local = db()
  const sb = supabase()
  let received = 0

  for (const table of SYNCED_TABLES) {
    const state = await local.sync_state.get(table)
    const since = state?.last_pulled_at ?? '1970-01-01T00:00:00.000Z'

    const { data, error } = await sb
      .from(table)
      .select('*')
      .eq('therapist_id', therapistId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(1000)

    if (error) throw new Error(`Falha ao buscar ${table}: ${error.message}`)
    if (!data || data.length === 0) continue

    const pendingKeys = new Set(
      (await local.outbox.where('table').equals(table).toArray()).map(
        (e) => e.row_id,
      ),
    )

    const toApply = []
    for (const remote of data as Array<{ id: string; updated_at: string }>) {
      if (pendingKeys.has(remote.id)) continue
      const localRow = (await local.table(table).get(remote.id)) as
        | { updated_at: string }
        | undefined
      if (localRow && localRow.updated_at >= remote.updated_at) continue
      toApply.push(remote)
    }

    if (toApply.length > 0) {
      await local.table(table).bulkPut(toApply)
      received += toApply.length
    }

    const newest = data[data.length - 1] as { updated_at: string }
    await local.sync_state.put({
      table: table as SyncedTable,
      last_pulled_at: newest.updated_at,
    })
  }

  return received
}

/**
 * Primeira carga após o login: traz tudo do servidor para o aparelho, para
 * que o app já abra funcional mesmo que a próxima sessão seja sem sinal.
 */
export async function initialLoad(): Promise<void> {
  const local = db()
  await local.sync_state.clear()
  await syncNow()
}
