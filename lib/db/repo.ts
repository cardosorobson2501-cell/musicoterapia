import { db } from './local'
import type { SyncBase, SyncedTable } from './types'

/**
 * Toda escrita do app passa por aqui.
 *
 * A regra é sempre a mesma: grava no IndexedDB e enfileira no outbox, dentro
 * da mesma transação. O app nunca espera a rede para considerar um dado
 * salvo — é isso que permite atender numa sala sem sinal.
 */

export function newId(): string {
  return crypto.randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

/** Cria ou atualiza uma linha e marca para envio. */
export async function save<T extends SyncBase>(
  table: SyncedTable,
  row: T,
): Promise<T> {
  const local = db()
  const stamped = { ...row, updated_at: now() }
  await local.transaction('rw', local.table(table), local.outbox, async () => {
    await local.table(table).put(stamped)
    await local.outbox.put({
      key: `${table}:${stamped.id}`,
      table,
      row_id: stamped.id,
      queued_at: now(),
    })
  })
  return stamped
}

/**
 * Exclusão lógica. A linha permanece no banco com deleted_at preenchido —
 * sem isso a remoção feita offline seria desfeita pela próxima sincronização.
 */
export async function remove(table: SyncedTable, id: string): Promise<void> {
  const local = db()
  const row = (await local.table(table).get(id)) as SyncBase | undefined
  if (!row) return
  await save(table, { ...row, deleted_at: now() })
}

/** Monta os campos comuns de uma entidade nova. */
export function baseFields(therapistId: string): SyncBase {
  const ts = now()
  return {
    id: newId(),
    therapist_id: therapistId,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  }
}

/** Quantas alterações ainda não chegaram ao servidor. */
export async function pendingCount(): Promise<number> {
  return db().outbox.count()
}
