import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NoteOnsetTracker,
  detectPitch,
  frequencyToMidi,
  noteOf,
  octaveOf,
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

test('segurar a nota conta uma vez; tocar de novo conta outra', () => {
  const t = new NoteOnsetTracker(3)
  const out: Array<number | null> = []
  // Toca Dó e segura.
  for (let i = 0; i < 10; i++) out.push(t.push(60, 0.3 - i * 0.01))
  // Silêncio, toca Dó de novo.
  out.push(t.push(null, 0))
  for (let i = 0; i < 5; i++) out.push(t.push(60, 0.3))
  assert.deepEqual(out.filter((x) => x !== null), [60, 60])
})

test('novo ataque na mesma nota conta de novo, sem precisar de silêncio', () => {
  const t = new NoteOnsetTracker(2)
  const out: Array<number | null> = []
  for (let i = 0; i < 4; i++) out.push(t.push(67, 0.1))
  for (let i = 0; i < 4; i++) out.push(t.push(67, 0.4))
  assert.deepEqual(out.filter((x) => x !== null), [67, 67])
})
