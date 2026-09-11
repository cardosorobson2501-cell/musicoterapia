'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente do Supabase para o navegador.
 *
 * O app é inteiramente client-side (é um PWA que roda offline), então esta é
 * a única porta de saída para o servidor. A chave `anon` pode ficar exposta:
 * o que protege os dados é o Row Level Security, que filtra toda consulta
 * por `therapist_id = auth.uid()`.
 */

let _client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copie .env.local.example para .env.local e preencha.',
    )
  }

  _client = createBrowserClient(url, key)
  return _client
}

/** Permite renderizar telas de aviso em vez de quebrar o app. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
