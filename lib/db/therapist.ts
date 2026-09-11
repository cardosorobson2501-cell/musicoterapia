'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './local'
import { supabase } from '@/lib/supabase/client'
import type { Therapist } from './types'

/**
 * Perfil do terapeuta. Fica numa chave de `settings` do banco local (não é
 * uma tabela sincronizada bidirecionalmente — o perfil muda raramente e
 * pertence a uma linha só).
 */
const KEY = 'therapist_profile'

export function useTherapistProfile(): Therapist | null | undefined {
  return useLiveQuery(async () => {
    const row = await db().settings.get(KEY)
    return (row?.value as Therapist | undefined) ?? null
  })
}

export async function loadTherapistProfile(userId: string): Promise<void> {
  const { data, error } = await supabase()
    .from('therapists')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return
  await db().settings.put({ key: KEY, value: data })
}

export async function saveTherapistProfile(
  profile: Pick<Therapist, 'id' | 'full_name' | 'council_id'>,
): Promise<void> {
  const now = new Date().toISOString()
  const row: Therapist = {
    ...profile,
    created_at: now,
    updated_at: now,
  }
  await db().settings.put({ key: KEY, value: row })
  await supabase()
    .from('therapists')
    .update({
      full_name: profile.full_name,
      council_id: profile.council_id,
      updated_at: now,
    })
    .eq('id', profile.id)
}
