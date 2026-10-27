/**
 * Notas musicais e suas cores, para a tela "Notas coloridas".
 *
 * As sete notas naturais seguem a ordem do arco-íris (Dó vermelho … Si
 * violeta), como nos tubos sonoros coloridos usados em musicalização. As
 * notas com sustenido ganham um tom intermediário entre as vizinhas, para que
 * cada tecla do teclado tenha a sua cor.
 */

export type NoteInfo = {
  /** 0 = Dó, 1 = Dó#, … 11 = Si. */
  pitchClass: number
  name: string
  short: string
  color: string
  /** Cor do texto escrito por cima da bolinha. */
  ink: string
  sharp: boolean
}

export const NOTES: NoteInfo[] = [
  { pitchClass: 0, name: 'Dó', short: 'Dó', color: '#e53935', ink: '#fff', sharp: false },
  { pitchClass: 1, name: 'Dó#', short: 'Dó#', color: '#f4511e', ink: '#fff', sharp: true },
  { pitchClass: 2, name: 'Ré', short: 'Ré', color: '#fb8c00', ink: '#fff', sharp: false },
  { pitchClass: 3, name: 'Ré#', short: 'Ré#', color: '#ffb300', ink: '#3a2a00', sharp: true },
  { pitchClass: 4, name: 'Mi', short: 'Mi', color: '#fdd835', ink: '#3a2a00', sharp: false },
  { pitchClass: 5, name: 'Fá', short: 'Fá', color: '#43a047', ink: '#fff', sharp: false },
  { pitchClass: 6, name: 'Fá#', short: 'Fá#', color: '#00897b', ink: '#fff', sharp: true },
  { pitchClass: 7, name: 'Sol', short: 'Sol', color: '#1e88e5', ink: '#fff', sharp: false },
  { pitchClass: 8, name: 'Sol#', short: 'Sol#', color: '#3949ab', ink: '#fff', sharp: true },
  { pitchClass: 9, name: 'Lá', short: 'Lá', color: '#5e35b1', ink: '#fff', sharp: false },
  { pitchClass: 10, name: 'Lá#', short: 'Lá#', color: '#8e24aa', ink: '#fff', sharp: true },
  { pitchClass: 11, name: 'Si', short: 'Si', color: '#d81b60', ink: '#fff', sharp: false },
]

/** Classe de altura (0–11) de uma nota MIDI. Dó central = 60. */
export function pitchClassOf(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
}

export function noteOf(midi: number): NoteInfo {
  return NOTES[pitchClassOf(midi)]
}

/** Oitava no padrão científico (Dó central = Dó4). */
export function octaveOf(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1
}

/** Frequência (Hz) → número MIDI fracionário. Lá4 = 440 Hz = 69. */
export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/**
 * Detecta a frequência fundamental de um trecho de áudio por autocorrelação
 * normalizada (variação simplificada do método McLeod). Devolve `null` quando
 * o som está baixo demais ou não tem altura definida (ruído, fala, palmas).
 *
 * Faixa coberta: ~50 Hz a ~2.000 Hz, que inclui quase todo o teclado usado em
 * atendimento.
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  minRms = 0.01,
): { frequency: number; clarity: number; rms: number } | null {
  const n = buffer.length
  let sumSq = 0
  for (let i = 0; i < n; i++) sumSq += buffer[i] * buffer[i]
  const rms = Math.sqrt(sumSq / n)
  if (rms < minRms) return null

  const minLag = Math.floor(sampleRate / 2000)
  const maxLag = Math.min(Math.floor(sampleRate / 50), Math.floor(n / 2))

  // NSDF: autocorrelação normalizada, vai de -1 a 1.
  const nsdf = new Float32Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acf = 0
    let energy = 0
    for (let i = 0; i < n - lag; i++) {
      acf += buffer[i] * buffer[i + lag]
      energy += buffer[i] * buffer[i] + buffer[i + lag] * buffer[i + lag]
    }
    nsdf[lag] = energy > 0 ? (2 * acf) / energy : 0
  }

  // Picos positivos entre cruzamentos por zero; o primeiro que chega perto
  // do maior é a fundamental (evita confundir com a oitava de baixo).
  const peaks: number[] = []
  let lag = minLag
  while (lag < maxLag && nsdf[lag] > 0) lag++
  while (lag < maxLag) {
    while (lag < maxLag && nsdf[lag] <= 0) lag++
    let best = lag
    while (lag < maxLag && nsdf[lag] > 0) {
      if (nsdf[lag] > nsdf[best]) best = lag
      lag++
    }
    if (best < maxLag && nsdf[best] > 0) peaks.push(best)
  }
  if (peaks.length === 0) return null

  const highest = Math.max(...peaks.map((p) => nsdf[p]))
  const chosen = peaks.find((p) => nsdf[p] >= 0.9 * highest) ?? peaks[0]
  const clarity = nsdf[chosen]
  if (clarity < 0.6) return null

  // Interpolação parabólica para refinar a posição do pico.
  const a = nsdf[chosen - 1] ?? nsdf[chosen]
  const b = nsdf[chosen]
  const c = nsdf[chosen + 1] ?? nsdf[chosen]
  const denom = a - 2 * b + c
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0
  const period = chosen + shift

  return { frequency: sampleRate / period, clarity, rms }
}

/**
 * Transforma a leitura contínua do microfone em "notas tocadas".
 *
 * Uma tecla de piano dá um ataque forte e depois vai sumindo. A regra é:
 * conta uma nota quando a mesma altura aparece estável por alguns quadros
 * seguidos; depois disso só conta de novo quando o som some, muda de nota ou
 * há um novo ataque (volume sobe de repente) — assim, tocar Dó três vezes
 * gera três bolinhas, mas segurar a tecla gera só uma.
 */
export class NoteOnsetTracker {
  private candidate: number | null = null
  private stableFrames = 0
  private emitted: number | null = null
  private lastRms = 0

  constructor(
    private readonly framesToConfirm = 3,
    private readonly attackRatio = 1.6,
  ) {}

  /** Recebe a nota MIDI detectada no quadro (ou null) e o volume. */
  push(midi: number | null, rms: number): number | null {
    const attack = this.lastRms > 0 && rms > this.lastRms * this.attackRatio
    this.lastRms = rms

    if (midi === null) {
      this.candidate = null
      this.stableFrames = 0
      this.emitted = null
      return null
    }

    if (attack) this.emitted = null

    if (midi === this.candidate) {
      this.stableFrames++
    } else {
      this.candidate = midi
      this.stableFrames = 1
    }

    if (this.stableFrames >= this.framesToConfirm && this.emitted !== midi) {
      this.emitted = midi
      return midi
    }
    return null
  }

  reset() {
    this.candidate = null
    this.stableFrames = 0
    this.emitted = null
    this.lastRms = 0
  }
}
