import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePercent, summarizeRecord } from './performance'
import type { ActivityRecord } from '@/lib/db/types'

const trial = (over: Record<string, unknown>) => ({ n: 1, at: '', ...over })

test('trials: acerto conta, ajuda e erro não', () => {
  const pct = computePercent('trials', {}, {
    trials: [
      trial({ result: 'correct' }),
      trial({ result: 'correct' }),
      trial({ result: 'prompted' }),
      trial({ result: 'incorrect' }),
    ] as never,
  })
  assert.equal(pct, 50)
})

test('trials: sem tentativas devolve null', () => {
  assert.equal(computePercent('trials', {}, { trials: [] }), null)
})

test('prompt_levels: independente = 100, mais assistido = 0', () => {
  const config = { levels: ['Indep', 'Verbal', 'Gestual', 'Física'] }
  assert.equal(
    computePercent('prompt_levels', config, {
      trials: [trial({ prompt_level: 0 })] as never,
    }),
    100,
  )
  assert.equal(
    computePercent('prompt_levels', config, {
      trials: [trial({ prompt_level: 3 })] as never,
    }),
    0,
  )
  // média entre nível 0 (100) e nível 2 (33.3) => 66.7
  assert.equal(
    computePercent('prompt_levels', config, {
      trials: [
        trial({ prompt_level: 0 }),
        trial({ prompt_level: 2 }),
      ] as never,
    }),
    66.7,
  )
})

test('scale: posição na escala configurada', () => {
  assert.equal(
    computePercent('scale', { min: 0, max: 5 }, { score: 4 }),
    80,
  )
  assert.equal(
    computePercent('scale', { min: 2, max: 4 }, { score: 3 }),
    50,
  )
})

test('duration e count não têm percentual', () => {
  assert.equal(
    computePercent('duration', {}, { duration_seconds: 120 }),
    null,
  )
  assert.equal(computePercent('count', {}, { count_value: 8 }), null)
})

test('summarizeRecord: texto de tentativas', () => {
  const rec = {
    measurement_type: 'trials',
    config_snapshot: {},
    trials: [
      trial({ result: 'correct' }),
      trial({ result: 'prompted' }),
    ],
    computed_percent: 50,
  } as unknown as ActivityRecord
  assert.match(summarizeRecord(rec), /1 acerto\(s\), 1 com ajuda/)
})
