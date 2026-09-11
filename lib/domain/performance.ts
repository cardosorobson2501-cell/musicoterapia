import type {
  ActivityConfig,
  ActivityRecord,
  MeasurementType,
  Trial,
} from '@/lib/db/types'

/**
 * Cálculo de desempenho.
 *
 * Um número só, comparável entre sessões, para cada tipo de medição. É o que
 * alimenta a evolução do paciente e o resumo que vai no prontuário.
 */

export const DEFAULT_PROMPT_LEVELS = [
  'Independente',
  'Ajuda verbal',
  'Ajuda gestual',
  'Ajuda física parcial',
  'Ajuda física total',
]

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  trials: 'Tentativas (acerto / erro / com ajuda)',
  prompt_levels: 'Níveis de ajuda',
  scale: 'Escala de desempenho',
  duration: 'Tempo (cronômetro)',
  count: 'Contagem de ocorrências',
}

export const TRIAL_RESULT_LABELS = {
  correct: 'Acerto',
  incorrect: 'Erro',
  prompted: 'Com ajuda',
} as const

export function promptLevels(config: ActivityConfig): string[] {
  return config.levels?.length ? config.levels : DEFAULT_PROMPT_LEVELS
}

/**
 * Percentual de desempenho, de 0 a 100.
 *
 * - trials: proporção de acertos independentes sobre o total de tentativas.
 *   "Com ajuda" conta como tentativa realizada, mas não como acerto — é o
 *   que mantém o número comparável com o critério de domínio.
 * - prompt_levels: grau médio de independência. O nível mais independente
 *   vale 100, o mais assistido vale 0, e os intermediários se distribuem
 *   uniformemente entre os dois.
 * - scale: posição da nota dentro da escala configurada.
 * - duration e count: não têm percentual — o número bruto é o dado.
 */
export function computePercent(
  measurementType: MeasurementType,
  config: ActivityConfig,
  data: {
    trials?: Trial[]
    score?: number | null
    duration_seconds?: number | null
    count_value?: number | null
  },
): number | null {
  if (measurementType === 'trials') {
    const trials = data.trials ?? []
    if (trials.length === 0) return null
    const acertos = trials.filter((t) => t.result === 'correct').length
    return round1((acertos / trials.length) * 100)
  }

  if (measurementType === 'prompt_levels') {
    const trials = (data.trials ?? []).filter(
      (t) => typeof t.prompt_level === 'number',
    )
    if (trials.length === 0) return null
    const levels = promptLevels(config)
    const ultimo = levels.length - 1
    // Com um único nível configurado não há gradiente a medir.
    if (ultimo <= 0) return null
    const soma = trials.reduce(
      (acc, t) => acc + (ultimo - (t.prompt_level ?? 0)) / ultimo,
      0,
    )
    return round1((soma / trials.length) * 100)
  }

  if (measurementType === 'scale') {
    const score = data.score
    if (score === null || score === undefined) return null
    const min = config.min ?? 0
    const max = config.max ?? 5
    if (max === min) return null
    return round1(((score - min) / (max - min)) * 100)
  }

  return null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Texto curto do desempenho, para o resumo do prontuário e para as listas. */
export function summarizeRecord(record: ActivityRecord): string {
  const { measurement_type: type, config_snapshot: config } = record

  if (type === 'trials') {
    const trials = record.trials ?? []
    if (trials.length === 0) return 'sem tentativas registradas'
    const acertos = trials.filter((t) => t.result === 'correct').length
    const ajuda = trials.filter((t) => t.result === 'prompted').length
    const erros = trials.filter((t) => t.result === 'incorrect').length
    const partes = [`${acertos} acerto(s)`]
    if (ajuda) partes.push(`${ajuda} com ajuda`)
    if (erros) partes.push(`${erros} erro(s)`)
    return `${partes.join(', ')} em ${trials.length} tentativa(s) — ${record.computed_percent ?? 0}% de acerto`
  }

  if (type === 'prompt_levels') {
    const trials = record.trials ?? []
    if (trials.length === 0) return 'sem tentativas registradas'
    const levels = promptLevels(config)
    const contagem = new Map<number, number>()
    for (const t of trials) {
      const lvl = t.prompt_level ?? 0
      contagem.set(lvl, (contagem.get(lvl) ?? 0) + 1)
    }
    const detalhe = [...contagem.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([lvl, n]) => `${n}× ${levels[lvl] ?? `nível ${lvl}`}`)
      .join(', ')
    return `${trials.length} tentativa(s): ${detalhe} — ${record.computed_percent ?? 0}% de independência`
  }

  if (type === 'scale') {
    const min = config.min ?? 0
    const max = config.max ?? 5
    if (record.score === null) return 'sem nota registrada'
    const rotulo = config.labels?.[String(record.score)]
    return `nota ${record.score} de ${max}${min !== 0 ? ` (escala ${min}–${max})` : ''}${rotulo ? ` — ${rotulo}` : ''}`
  }

  if (type === 'duration') {
    const s = record.duration_seconds ?? 0
    const m = Math.floor(s / 60)
    return m > 0 ? `${m} min ${s % 60}s` : `${s}s`
  }

  if (type === 'count') {
    const unidade = config.unit?.trim() || 'ocorrência(s)'
    return `${record.count_value ?? 0} ${unidade}`
  }

  return '—'
}

/** Config inicial coerente para cada tipo, usada ao criar uma atividade. */
export function defaultConfig(type: MeasurementType): ActivityConfig {
  switch (type) {
    case 'trials':
      return { target_trials: 10 }
    case 'prompt_levels':
      return { target_trials: 10, levels: [...DEFAULT_PROMPT_LEVELS] }
    case 'scale':
      return {
        min: 0,
        max: 5,
        labels: { '0': 'Não realizou', '5': 'Independente' },
      }
    case 'count':
      return { unit: 'ocorrências' }
    case 'duration':
      return {}
  }
}
