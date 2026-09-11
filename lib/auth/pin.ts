'use client'

import { db } from '@/lib/db/local'

/**
 * Bloqueio local por PIN.
 *
 * Isto não substitui o login: a sessão do Supabase é que dá acesso aos dados.
 * O PIN protege o cenário mais provável de vazamento no uso real — o aparelho
 * destravado na mão de outra pessoa, ou perdido, com o app já logado.
 *
 * Guardamos apenas o hash PBKDF2 com salt aleatório; o PIN em si nunca é
 * escrito em lugar nenhum.
 */

const PIN_HASH_KEY = 'pin_hash'
const PIN_SALT_KEY = 'pin_salt'
const UNLOCKED_AT_KEY = 'pin_unlocked_at'

/** Depois desse tempo em segundo plano, pede o PIN de novo. */
export const LOCK_AFTER_MS = 2 * 60 * 1000

const ITERATIONS = 210_000

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return [...new Uint8Array(bits)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export async function hasPin(): Promise<boolean> {
  const row = await db().settings.get(PIN_HASH_KEY)
  return Boolean(row?.value)
}

export async function setPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await hashPin(pin, salt)
  await db().settings.bulkPut([
    { key: PIN_SALT_KEY, value: toHex(salt) },
    { key: PIN_HASH_KEY, value: hash },
  ])
  await markUnlocked()
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [saltRow, hashRow] = await Promise.all([
    db().settings.get(PIN_SALT_KEY),
    db().settings.get(PIN_HASH_KEY),
  ])
  if (!saltRow?.value || !hashRow?.value) return false
  const hash = await hashPin(pin, fromHex(saltRow.value as string))
  // Comparação de tempo constante: o custo é irrisório e evita medir o acerto
  // dígito a dígito.
  const expected = hashRow.value as string
  if (hash.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export async function clearPin(): Promise<void> {
  await db().settings.bulkDelete([PIN_HASH_KEY, PIN_SALT_KEY, UNLOCKED_AT_KEY])
}

export async function markUnlocked(): Promise<void> {
  await db().settings.put({ key: UNLOCKED_AT_KEY, value: Date.now() })
}

export async function isUnlocked(): Promise<boolean> {
  const row = await db().settings.get(UNLOCKED_AT_KEY)
  const at = typeof row?.value === 'number' ? row.value : 0
  return Date.now() - at < LOCK_AFTER_MS
}

export async function lock(): Promise<void> {
  await db().settings.put({ key: UNLOCKED_AT_KEY, value: 0 })
}
