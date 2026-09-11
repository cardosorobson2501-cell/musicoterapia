import type { Patient } from '@/lib/db/types'
import { BR_GIVEN_NAMES, BR_SURNAMES } from './br-names'

/**
 * Anonimização da exportação.
 *
 * Roda inteiramente no aparelho. Duas etapas:
 *
 *  1. Substituição determinística — nomes que o app conhece (paciente,
 *     apelido, responsáveis, instituição) viram rótulos estáveis. O mesmo
 *     paciente recebe sempre o mesmo código, em qualquer exportação, para a
 *     IA conseguir acompanhar a evolução do caso ao longo do tempo.
 *
 *  2. Varredura do texto livre — procura outros nomes de pessoa dentro dos
 *     prontuários. O que ela encontra NÃO é trocado automaticamente: vira
 *     lista de sugestões para o terapeuta revisar. Nenhum detector acerta
 *     100% em texto livre, e trocar demais é tão ruim quanto trocar de menos.
 */

export interface AnonymizationMap {
  /** frases de duas ou mais palavras (normalizadas) → rótulo anônimo.
   *  Aplicadas antes das palavras soltas, para "Clínica Ágil" não virar
   *  "Instituição Instituição". */
  phrases: Map<string, string>
  /** tokens isolados (normalizados) → rótulo anônimo */
  words: Map<string, string>
  patientCode: string
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacriticos combinantes
    .toLowerCase()
    .trim()

/** Monta o mapa de substituições conhecidas para um paciente. */
export function buildMap(
  patient: Patient,
  institutionName: string | null,
  options: { anonymizeInstitution: boolean },
): AnonymizationMap {
  const phrases = new Map<string, string>()
  const words = new Map<string, string>()

  /**
   * @param splitParts quando true, cada palavra do nome também é registrada
   *   isoladamente — bom para nomes de pessoa ("o João melhorou", "com
   *   Silva"). Para instituição fica false: "clínica" e "ágil" são palavras
   *   comuns e não devem ser trocadas fora da frase inteira.
   */
  const addName = (full: string, label: string, splitParts: boolean) => {
    const trimmed = full.trim()
    if (!trimmed) return
    const parts = trimmed.split(/\s+/)
    if (parts.length > 1) phrases.set(norm(trimmed), label)
    else words.set(norm(trimmed), label)
    if (splitParts) {
      for (const part of parts) {
        if (part.length >= 3) words.set(norm(part), label)
      }
    }
  }

  addName(patient.full_name, patient.code, true)
  if (patient.nickname) addName(patient.nickname, patient.code, true)

  patient.guardians.forEach((g, i) => {
    if (g.name) addName(g.name, `Responsável ${i + 1}`, true)
  })

  if (options.anonymizeInstitution && institutionName) {
    addName(institutionName, 'Instituição', false)
  }

  return { phrases, words, patientCode: patient.code }
}

/**
 * Aplica as substituições conhecidas a um texto.
 *
 * Trabalha sobre a lista de palavras com suas posições: primeiro tenta casar
 * as frases (janelas de 2+ palavras consecutivas, da mais longa para a mais
 * curta), depois as palavras isoladas. Comparação sempre normalizada, então
 * acento e caixa não importam.
 */
export function applyMap(text: string, map: AnonymizationMap): string {
  if (!text) return text

  const tokens = [...text.matchAll(/[\p{L}][\p{L}\p{M}'-]*/gu)].map((m) => ({
    raw: m[0],
    norm: norm(m[0]),
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }))
  if (tokens.length === 0) return text

  const phraseKeys = [...map.phrases.keys()].sort(
    (a, b) => b.split(/\s+/).length - a.split(/\s+/).length,
  )

  // [start, end) no texto original → rótulo
  const spans: Array<{ start: number; end: number; label: string }> = []
  const consumed = new Array(tokens.length).fill(false)

  for (const key of phraseKeys) {
    const parts = key.split(/\s+/)
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      if (consumed[i]) continue
      let ok = true
      for (let k = 0; k < parts.length; k++) {
        if (consumed[i + k] || tokens[i + k].norm !== parts[k]) {
          ok = false
          break
        }
      }
      if (!ok) continue
      spans.push({
        start: tokens[i].start,
        end: tokens[i + parts.length - 1].end,
        label: map.phrases.get(key)!,
      })
      for (let k = 0; k < parts.length; k++) consumed[i + k] = true
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue
    const hit = map.words.get(tokens[i].norm)
    if (hit) spans.push({ start: tokens[i].start, end: tokens[i].end, label: hit })
  }

  if (spans.length === 0) return text
  spans.sort((a, b) => a.start - b.start)

  let out = ''
  let cursor = 0
  for (const s of spans) {
    if (s.start < cursor) continue
    out += text.slice(cursor, s.start) + s.label
    cursor = s.end
  }
  out += text.slice(cursor)
  return out
}

export interface NameCandidate {
  /** trecho exato como aparece no texto */
  text: string
  /** onde foi encontrado, para mostrar em contexto */
  context: string
  /** por que foi sinalizado */
  reason: 'dicionário' | 'maiúscula no meio da frase' | 'nome + sobrenome'
}

const STOPWORDS = new Set([
  'a','o','as','os','e','ou','de','da','do','das','dos','em','no','na','nos','nas',
  'um','uma','para','por','com','sem','sob','sobre','ao','aos','à','às','que','se',
  'foi','era','está','esta','este','esse','essa','isso','ele','ela','eles','elas',
  'seu','sua','seus','suas','meu','minha','muito','mais','menos','já','ainda','então',
  'quando','como','onde','porque','pois','mas','porém','também','após','durante','até',
  'hoje','ontem','amanhã','sessão','paciente','terapeuta','mãe','pai','responsável',
  'segunda','terça','quarta','quinta','sexta','sábado','domingo','janeiro','fevereiro',
  'março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro',
])

/**
 * Procura candidatos a nome de pessoa num texto já passado pela substituição
 * determinística (então o nome do paciente e dos responsáveis já saíram).
 */
export function scanForNames(text: string): NameCandidate[] {
  if (!text?.trim()) return []
  const found = new Map<string, NameCandidate>()

  // Percorre frase a frase para saber o que é "início de frase".
  const sentences = text.split(/(?<=[.!?:;\n])\s+/)

  for (const sentence of sentences) {
    const tokens = [...sentence.matchAll(/[\p{Lu}][\p{L}\p{M}'-]+/gu)]

    for (let i = 0; i < tokens.length; i++) {
      const m = tokens[i]
      const word = m[0]
      const lower = norm(word)
      if (lower.length < 3 || STOPWORDS.has(lower)) continue

      const atSentenceStart = (m.index ?? 0) === 0
      const inDictionary = BR_GIVEN_NAMES.has(lower)

      // Nome seguido de sobrenome conhecido: "com Ana Beatriz", "o Pedro Rocha".
      const next = tokens[i + 1]
      const nextIsAdjacent =
        next && (next.index ?? 0) === (m.index ?? 0) + word.length + 1
      const nextLower = next ? norm(next[0]) : ''
      const pairIsName =
        nextIsAdjacent &&
        (BR_GIVEN_NAMES.has(lower) || BR_GIVEN_NAMES.has(nextLower)) &&
        (BR_SURNAMES.has(nextLower) || BR_GIVEN_NAMES.has(nextLower))

      let reason: NameCandidate['reason'] | null = null
      let matchText = word

      if (pairIsName) {
        reason = 'nome + sobrenome'
        matchText = `${word} ${next![0]}`
        i++ // consome o sobrenome
      } else if (inDictionary && !atSentenceStart) {
        reason = 'dicionário'
      } else if (inDictionary && atSentenceStart) {
        // No começo da frase a maiúscula não diz nada; o dicionário sozinho
        // ainda vale como pista.
        reason = 'dicionário'
      } else if (!atSentenceStart && !STOPWORDS.has(lower)) {
        reason = 'maiúscula no meio da frase'
      }

      if (!reason) continue

      const key = norm(matchText)
      if (found.has(key)) continue

      const start = Math.max(0, (m.index ?? 0) - 30)
      const end = Math.min(sentence.length, (m.index ?? 0) + matchText.length + 30)
      const context =
        (start > 0 ? '…' : '') +
        sentence.slice(start, end).trim() +
        (end < sentence.length ? '…' : '')

      found.set(key, { text: matchText, context, reason })
    }
  }

  return [...found.values()]
}
