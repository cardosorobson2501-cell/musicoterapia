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
 * Transforma o som contínuo do microfone em "notas tocadas".
 *
 * Cada golpe de tecla é um ataque: o volume sobe de repente. O detector
 * acompanha a energia do som em passos curtos (~5 ms, sem lacunas entre
 * eles) e conta uma nota sempre que a energia dá um salto em relação ao que
 * vinha soando um instante antes — mesmo que a nota anterior ainda esteja
 * ressoando, como em repetições rápidas da mesma tecla. Segurar a tecla
 * (som só decaindo) conta uma vez.
 *
 * A altura da nota é lida alguns milissegundos depois do ataque, quando o
 * som já se estabilizou. Como segurança, uma troca de nota sem ataque claro
 * (notas ligadas, bem suaves) também é contada.
 */
export class NoteOnsetDetector {
  /** Nota MIDI que está soando agora (ou null), para mostrar na tela. */
  hearing: number | null = null

  private static readonly HOP = 256
  private static readonly RING = 8192
  private static readonly PITCH_WINDOW = 1536
  /** Quanto esperar depois do ataque antes de ler a altura (amostras). */
  private static readonly WAIT = 1280
  private static readonly GIVE_UP = 3840
  /** Salto de energia (vezes) que caracteriza um novo ataque. */
  private static readonly ATTACK_RATIO = 1.5
  /**
   * Salto nos agudos (energia da diferença entre amostras). Todo golpe de
   * tecla recoloca os harmônicos e o "estalo" do ataque, que a nota anterior
   * já perdeu — então este sinal sobe mesmo quando o volume total quase não
   * muda (nota nova somando com a cauda da anterior).
   */
  private static readonly HF_RATIO = 2.2

  private readonly ring = new Float32Array(NoteOnsetDetector.RING)
  private readonly pitchBuf = new Float32Array(NoteOnsetDetector.PITCH_WINDOW)
  private readonly refractoryHops: number
  private pos = 0
  private hopSum = 0
  private hopFill = 0
  private hopSumD = 0
  private prevSample = 0
  private hopSums: number[] = []
  private hopSumsD: number[] = []
  private history: number[] = []
  private historyD: number[] = []
  private hops = 0
  private lastOnsetHop = -1e9
  private pending: Array<{ at: number; last: number | null }> = []
  private lastEmitted: number | null = null
  private candidate: number | null = null
  private candidateCount = 0
  private silentEvals = 0

  constructor(
    private readonly sampleRate: number,
    private minRms = 0.02,
  ) {
    // ~60 ms sem aceitar outro ataque: cobre até ~15 notas por segundo.
    this.refractoryHops = Math.ceil((0.06 * sampleRate) / NoteOnsetDetector.HOP)
  }

  setMinRms(minRms: number) {
    this.minRms = minRms
  }

  reset() {
    this.ring.fill(0)
    this.pos = 0
    this.hopSum = 0
    this.hopSumD = 0
    this.prevSample = 0
    this.hopFill = 0
    this.hopSums = []
    this.hopSumsD = []
    this.history = []
    this.historyD = []
    this.hops = 0
    this.lastOnsetHop = -1e9
    this.pending = []
    this.lastEmitted = null
    this.candidate = null
    this.candidateCount = 0
    this.silentEvals = 0
    this.hearing = null
  }

  /** Recebe um pedaço de áudio (qualquer tamanho); devolve as notas MIDI contadas. */
  push(chunk: Float32Array): number[] {
    const out: number[] = []
    const mask = NoteOnsetDetector.RING - 1
    for (let i = 0; i < chunk.length; i++) {
      const v = chunk[i]
      this.ring[this.pos & mask] = v
      this.pos++
      this.hopSum += v * v
      const d = v - this.prevSample
      this.prevSample = v
      this.hopSumD += d * d
      if (++this.hopFill === NoteOnsetDetector.HOP) {
        this.hopFill = 0
        this.step(out)
      }
    }
    return out
  }

  private step(out: number[]) {
    const { HOP, WAIT, GIVE_UP, ATTACK_RATIO, HF_RATIO } = NoteOnsetDetector
    this.hopSums.push(this.hopSum)
    this.hopSumsD.push(this.hopSumD)
    this.hopSum = 0
    this.hopSumD = 0
    if (this.hopSums.length > 4) {
      this.hopSums.shift()
      this.hopSumsD.shift()
    }
    if (this.hopSums.length < 4) return
    this.hops++

    // Energia média nos últimos ~20 ms, atualizada a cada passo.
    const energy = (this.hopSums[0] + this.hopSums[1] + this.hopSums[2] + this.hopSums[3]) / (4 * HOP)
    const energyD = (this.hopSumsD[0] + this.hopSumsD[1] + this.hopSumsD[2] + this.hopSumsD[3]) / (4 * HOP)
    const floor = this.minRms * this.minRms
    if (this.history.length >= 4) {
      let ref = Infinity
      let refD = Infinity
      for (const h of this.history) if (h < ref) ref = h
      for (const h of this.historyD) if (h < refD) refD = h
      const prev = this.history[this.history.length - 1]
      const prevD = this.historyD[this.historyD.length - 1]
      const rising =
        (energy > prev && energy > ref * ATTACK_RATIO) ||
        (energyD > prevD && energyD > refD * HF_RATIO)
      if (this.hops - this.lastOnsetHop > this.refractoryHops && energy > floor && rising) {
        this.lastOnsetHop = this.hops
        this.pending.push({ at: this.pos, last: null })
      }
    }
    this.history.push(energy)
    this.historyD.push(energyD)
    if (this.history.length > 8) {
      this.history.shift()
      this.historyD.shift()
    }

    // Lê a altura dos ataques que já "assentaram".
    this.pending = this.pending.filter((p) => {
      const age = this.pos - p.at
      if (age < WAIT) return true
      if (age > GIVE_UP) return false
      const r = this.pitchNow(0.5)
      if (!r) return true
      const midi = Math.round(frequencyToMidi(r.frequency))
      if (p.last === midi || r.clarity >= 0.9) {
        this.lastEmitted = midi
        this.candidate = null
        this.candidateCount = 0
        out.push(midi)
        return false
      }
      p.last = midi
      return true
    })

    // Acompanha o som para a tela e pega trocas de nota sem ataque claro.
    if (this.hops % 4 === 0) {
      const r = this.pitchNow(0.5)
      const midi = r ? Math.round(frequencyToMidi(r.frequency)) : null
      this.hearing = midi
      const quiet =
        this.pending.length === 0 &&
        this.hops - this.lastOnsetHop > this.refractoryHops + 8
      if (midi === null) {
        if (++this.silentEvals >= 3) this.lastEmitted = null
        this.candidate = null
        this.candidateCount = 0
      } else {
        this.silentEvals = 0
        if (quiet && r!.clarity >= 0.85) {
          if (midi === this.candidate) this.candidateCount++
          else {
            this.candidate = midi
            this.candidateCount = 1
          }
          const sameClass =
            this.lastEmitted !== null &&
            pitchClassOf(midi) === pitchClassOf(this.lastEmitted)
          if (this.candidateCount >= 4 && !sameClass) {
            this.lastEmitted = midi
            this.candidateCount = 0
            out.push(midi)
          }
        } else {
          this.candidate = null
          this.candidateCount = 0
        }
      }
    }
  }

  private pitchNow(minRmsFactor: number) {
    const n = NoteOnsetDetector.PITCH_WINDOW
    if (this.pos < n) return null
    const mask = NoteOnsetDetector.RING - 1
    for (let i = 0; i < n; i++) this.pitchBuf[i] = this.ring[(this.pos - n + i) & mask]
    return detectPitch(this.pitchBuf, this.sampleRate, this.minRms * minRmsFactor)
  }
}
