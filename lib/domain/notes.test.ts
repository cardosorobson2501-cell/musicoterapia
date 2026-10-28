import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NoteOnsetDetector,
  detectPitch,
  frequencyToMidi,
  noteOf,
  octaveOf,
  DEFAULT_DETECTOR_SETTINGS,
  levelOf,
  rmsOfLevel,
  sanitizeSettings,
} from './notes'

test('Dó é vermelho e Sol é azul, em qualquer oitava', () => {
  assert.equal(noteOf(60).name, 'Dó')
  assert.equal(noteOf(48).name, 'Dó')
  assert.equal(noteOf(60).color, '#e53935')
  assert.equal(noteOf(67).name, 'Sol')
  assert.equal(noteOf(79).color, '#1e88e5')
  assert.equal(octaveOf(60), 4)
})

test('converte frequência em nota', () => {
  assert.equal(Math.round(frequencyToMidi(440)), 69)
  assert.equal(Math.round(frequencyToMidi(261.63)), 60)
})

function tone(freq: number, sampleRate = 44100, size = 2048, amp = 0.5) {
  const buf = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    // Fundamental + harmônicos, como um instrumento de verdade.
    const t = i / sampleRate
    buf[i] =
      amp *
      (Math.sin(2 * Math.PI * freq * t) +
        0.5 * Math.sin(2 * Math.PI * 2 * freq * t) +
        0.25 * Math.sin(2 * Math.PI * 3 * freq * t))
  }
  return buf
}

test('detecta a altura de notas do teclado', () => {
  for (const [freq, name] of [
    [130.81, 'Dó'],
    [261.63, 'Dó'],
    [392.0, 'Sol'],
    [440, 'Lá'],
    [659.25, 'Mi'],
  ] as const) {
    const r = detectPitch(tone(freq), 44100)
    assert.ok(r, `sem leitura para ${freq} Hz`)
    assert.equal(noteOf(Math.round(frequencyToMidi(r.frequency))).name, name)
  }
})

test('ignora silêncio', () => {
  assert.equal(detectPitch(new Float32Array(2048), 44100), null)
})

const SR = 48000

/** Teclas sintéticas: ataque rápido, decaimento exponencial, harmônicos e um pouco de ruído. */
function render(
  notes: Array<{ t: number; midi: number; amp?: number; off?: number }>,
  seconds: number,
  tau = 0.35,
) {
  const out = new Float32Array(Math.floor(seconds * SR))
  let seed = 12345
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5)
  for (const { t, midi, amp = 0.5, off } of notes) {
    const f = 440 * 2 ** ((midi - 69) / 12)
    const start = Math.floor(t * SR)
    for (let i = start; i < out.length; i++) {
      const x = (i - start) / SR
      // `off`: duração até soltar a tecla; depois disso o abafador corta o som.
      const released = off !== undefined && x > off ? Math.exp(-(x - off) / 0.03) : 1
      const env = amp * released * Math.exp(-x / tau) * (1 - Math.exp(-x / 0.003))
      if (x > 0.05 && env < 1e-4) break
      out[i] +=
        env *
        (Math.sin(2 * Math.PI * f * x) +
          0.5 * Math.exp(-x / 0.2) * Math.sin(4 * Math.PI * f * x) +
          0.25 * Math.exp(-x / 0.1) * Math.sin(6 * Math.PI * f * x))
    }
  }
  for (let i = 0; i < out.length; i++) out[i] += rnd() * 0.004
  return out
}

function listen(signal: Float32Array, chunk = 512, minRms = 0.02) {
  const d = new NoteOnsetDetector(SR, { minRms })
  const got: number[] = []
  for (let i = 0; i < signal.length; i += chunk)
    got.push(...d.push(signal.subarray(i, i + chunk)))
  return got
}

/** `off`: soltar a tecla depois de ~60% do intervalo (como quem toca de verdade). */
const seq = (midis: number[], gap: number, amp?: number, off = false) =>
  midis.map((midi, i) => ({
    t: 0.3 + i * gap,
    midi,
    amp,
    off: off ? gap * 0.6 : undefined,
  }))

test('repetição rápida da mesma nota: cada golpe vira uma bolinha', () => {
  // Pior caso: a tecla não é solta e a nota anterior ainda ressoa por cima.
  for (const gap of [0.25, 0.18, 0.14]) {
    const midis = Array(8).fill(60)
    const got = listen(render(seq(midis, gap), 0.3 + 8 * gap + 0.6))
    assert.deepEqual(got, midis, `sem soltar, intervalo de ${gap * 1000} ms`)
  }
  // Tocando de verdade: a tecla sobe entre um golpe e outro.
  for (const gap of [0.25, 0.18, 0.14, 0.11, 0.09, 0.08]) {
    const midis = Array(8).fill(60)
    const got = listen(render(seq(midis, gap, undefined, true), 0.3 + 8 * gap + 0.6))
    assert.deepEqual(got, midis, `soltando, intervalo de ${gap * 1000} ms`)
  }
})

test('repetição rápida funciona com blocos de áudio de tamanhos diferentes', () => {
  const midis = Array(6).fill(67)
  const signal = render(seq(midis, 0.12, undefined, true), 1.8)
  for (const chunk of [128, 512, 1024, 4096]) {
    assert.deepEqual(listen(signal, chunk), midis, `bloco de ${chunk}`)
  }
})

test('repetição com toques mais suaves e mais fortes misturados', () => {
  const notes = [0.6, 0.35, 0.5, 0.25, 0.6, 0.4].map((amp, i) => ({
    t: 0.3 + i * 0.14,
    midi: 64,
    amp,
    off: 0.09,
  }))
  assert.deepEqual(listen(render(notes, 1.6)), Array(6).fill(64))
})

test('sequência rápida de notas diferentes e repetidas', () => {
  const midis = [60, 60, 62, 62, 64, 64, 64, 67, 67, 60]
  assert.deepEqual(listen(render(seq(midis, 0.13, undefined, true), 2.2)), midis)
})

test('segurar a nota conta uma vez só', () => {
  assert.deepEqual(listen(render([{ t: 0.3, midi: 60 }], 3, 2)), [60])
})

test('silêncio e ruído baixo não geram notas', () => {
  assert.deepEqual(listen(render([], 2)), [])
})

test('os ajustes mudam o comportamento do detector', () => {
  const signal = render(seq(Array(6).fill(60), 0.12, undefined, true), 1.5)
  // Volume mínimo alto demais: nada conta.
  assert.deepEqual(listen(signal, 512, 0.9), [])
  // Intervalo mínimo longo demais: só pega parte dos golpes.
  const d = new NoteOnsetDetector(SR, { minGapMs: 250 })
  const got: number[] = []
  for (let i = 0; i < signal.length; i += 512) got.push(...d.push(signal.subarray(i, i + 512)))
  assert.ok(got.length > 0 && got.length < 6, `contou ${got.length}`)
  // Trocar o ajuste durante a escuta tem efeito imediato.
  d.reset()
  d.configure({ minGapMs: 60 })
  const again: number[] = []
  for (let i = 0; i < signal.length; i += 512) again.push(...d.push(signal.subarray(i, i + 512)))
  assert.equal(again.length, 6)
})

test('medidor: nível e volume são inversos e o detector informa o volume', () => {
  assert.equal(levelOf(0), 0)
  assert.ok(Math.abs(rmsOfLevel(levelOf(0.02)) - 0.02) < 1e-9)
  const d = new NoteOnsetDetector(SR)
  d.push(render([{ t: 0, midi: 60 }], 0.3, 2))
  assert.ok(d.level > 0.1, `volume ${d.level}`)
})

test('ajustes inválidos guardados no aparelho viram valores seguros', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_DETECTOR_SETTINGS)
  assert.deepEqual(sanitizeSettings({ minRms: 'x', attackRatio: 99, hfRatio: -1, minGapMs: NaN }), {
    ...DEFAULT_DETECTOR_SETTINGS,
    attackRatio: 3,
    hfRatio: 1.3,
  })
})
