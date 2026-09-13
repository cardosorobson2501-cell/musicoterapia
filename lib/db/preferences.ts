'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './local'
import type { ProntuarioLayout } from '@/lib/domain/prontuario-text'

/**
 * Preferências de uso do app, uma por chave em `settings` (local, não
 * sincroniza — cada aparelho pode preferir um formato diferente).
 */

const LAYOUT_KEY = 'prontuario_layout'

/** Como o texto do prontuário é organizado ao compartilhar. */
export function useProntuarioLayout(): ProntuarioLayout {
  const stored = useLiveQuery(async () => {
    const row = await db().settings.get(LAYOUT_KEY)
    return (row?.value as ProntuarioLayout | undefined) ?? 'topics'
  })
  return stored ?? 'topics'
}

export async function setProntuarioLayout(
  layout: ProntuarioLayout,
): Promise<void> {
  await db().settings.put({ key: LAYOUT_KEY, value: layout })
}
