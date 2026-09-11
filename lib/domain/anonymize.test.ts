import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyMap, buildMap, scanForNames } from './anonymize'
import type { Patient } from '@/lib/db/types'

const patient = {
  id: 'x',
  code: 'P007',
  full_name: 'João Pedro Alves',
  nickname: 'Joãozinho',
  birth_date: '2017-05-10',
  guardians: [
    { name: 'Maria Alves', relationship: 'mãe', phone: '', is_whatsapp_contact: true },
  ],
} as unknown as Patient

test('substitui nome completo, primeiro nome e apelido pelo código', () => {
  const map = buildMap(patient, 'Clínica Ágil', { anonymizeInstitution: true })
  assert.equal(
    applyMap('João melhorou muito, o Joãozinho está mais atento.', map),
    'P007 melhorou muito, o P007 está mais atento.',
  )
})

test('substitui nome do responsável pelo rótulo', () => {
  const map = buildMap(patient, null, { anonymizeInstitution: false })
  assert.equal(
    applyMap('A mãe, Maria, relatou avanços em casa.', map),
    'A mãe, Responsável 1, relatou avanços em casa.',
  )
})

test('substitui a instituição só quando pedido', () => {
  const on = buildMap(patient, 'Clínica Ágil', { anonymizeInstitution: true })
  assert.equal(applyMap('Atendimento na Clínica Ágil.', on), 'Atendimento na Instituição.')

  const off = buildMap(patient, 'Clínica Ágil', { anonymizeInstitution: false })
  assert.equal(applyMap('Atendimento na Clínica Ágil.', off), 'Atendimento na Clínica Ágil.')
})

test('não mexe em palavras comuns capitalizadas no início da frase', () => {
  const map = buildMap(patient, null, { anonymizeInstitution: false })
  const texto = 'Durante a sessão houve boa resposta. Objetivos atingidos.'
  assert.equal(applyMap(texto, map), texto)
})

test('varredura encontra nome no dicionário no meio da frase', () => {
  const nomes = scanForNames('Na chegada, a Fernanda ajudou na transição.')
  assert.ok(nomes.some((c) => c.text === 'Fernanda'))
})

test('varredura ignora início de frase que não é nome', () => {
  const nomes = scanForNames('Choveu forte. Depois melhorou.')
  assert.equal(nomes.length, 0)
})

test('varredura pega nome + sobrenome', () => {
  const nomes = scanForNames('O acompanhante Carlos Silva trouxe o material.')
  assert.ok(nomes.some((c) => c.text === 'Carlos Silva'))
})
