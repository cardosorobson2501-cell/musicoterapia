'use client'

import { useEffect, useRef, useState } from 'react'
import {
  NoteOnsetTracker,
  detectPitch,
  frequencyToMidi,
} from '@/lib/domain/notes'

/**
 * Entradas de nota para a tela "Notas coloridas": teclado MIDI (cabo USB ou
 * Bluetooth) e microfone. Cada uma chama `onNote(midi)` a cada nota tocada.
 */

export type InputStatus =
  | { state: 'off' }
  | { state: 'starting' }
  | { state: 'on'; detail: string }
  | { state: 'error'; message: string }

/** Escuta todos os teclados MIDI conectados, inclusive os plugados depois. */
export function useMidiInput(enabled: boolean, onNote: (midi: number) => void) {
  const [status, setStatus] = useState<InputStatus>({ state: 'off' })
  const onNoteRef = useRef(onNote)
  onNoteRef.current = onNote

  useEffect(() => {
    if (!enabled) {
      setStatus({ state: 'off' })
      return
    }
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setStatus({
        state: 'error',
        message:
          'Este navegador não aceita teclado MIDI. Use o Chrome ou o Edge (no computador ou no Android). No iPhone, use o microfone.',
      })
      return
    }

    let access: MIDIAccess | null = null
    let cancelled = false
    setStatus({ state: 'starting' })

    const handle = (e: MIDIMessageEvent) => {
      if (!e.data || e.data.length < 3) return
      const [statusByte, note, velocity] = e.data
      // Note On com força > 0 (Note On com força 0 é como soltar a tecla).
      if ((statusByte & 0xf0) === 0x90 && velocity > 0) onNoteRef.current(note)
    }

    const attach = () => {
      if (!access || cancelled) return
      const names: string[] = []
      access.inputs.forEach((input) => {
        input.onmidimessage = handle
        if (input.state === 'connected') names.push(input.name || 'Teclado')
      })
      setStatus({
        state: 'on',
        detail:
          names.length > 0
            ? `Conectado: ${names.join(', ')}`
            : 'Nenhum teclado encontrado. Conecte o cabo USB do teclado.',
      })
    }

    navigator
      .requestMIDIAccess()
      .then((a) => {
        if (cancelled) return
        access = a
        a.onstatechange = attach
        attach()
      })
      .catch(() => {
        if (!cancelled)
          setStatus({
            state: 'error',
            message:
              'O navegador não deu acesso ao teclado MIDI. Verifique a permissão do site.',
          })
      })

    return () => {
      cancelled = true
      if (access) {
        access.onstatechange = null
        access.inputs.forEach((input) => {
          input.onmidimessage = null
        })
      }
    }
  }, [enabled])

  return status
}

/** Ouve o instrumento pelo microfone e descobre qual nota foi tocada. */
export function useMicrophoneInput(
  enabled: boolean,
  onNote: (midi: number) => void,
  sensitivity: number,
) {
  const [status, setStatus] = useState<InputStatus>({ state: 'off' })
  const [hearing, setHearing] = useState<number | null>(null)
  const onNoteRef = useRef(onNote)
  onNoteRef.current = onNote
  const sensitivityRef = useRef(sensitivity)
  sensitivityRef.current = sensitivity

  useEffect(() => {
    if (!enabled) {
      setStatus({ state: 'off' })
      setHearing(null)
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus({
        state: 'error',
        message: 'Este navegador não dá acesso ao microfone.',
      })
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let frame = 0
    const tracker = new NoteOnsetTracker()
    setStatus({ state: 'starting' })

    navigator.mediaDevices
      .getUserMedia({
        // Sem os "filtros de chamada": eles abafam justamente o som do
        // instrumento, que o navegador confunde com ruído de fundo.
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        ctx = new AudioContext()
        await ctx.resume()
        const source = ctx.createMediaStreamSource(s)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        const buffer = new Float32Array(analyser.fftSize)
        const sampleRate = ctx.sampleRate
        setStatus({ state: 'on', detail: 'Ouvindo… toque uma nota.' })

        let lastShown: number | null = null
        const loop = () => {
          if (cancelled) return
          analyser.getFloatTimeDomainData(buffer)
          // Sensibilidade 1 (baixa) a 3 (alta) → volume mínimo para contar.
          const minRms = [0.04, 0.02, 0.008][sensitivityRef.current - 1] ?? 0.02
          const r = detectPitch(buffer, sampleRate, minRms)
          const midi = r ? Math.round(frequencyToMidi(r.frequency)) : null
          const played = tracker.push(midi, r?.rms ?? 0)
          if (played !== null) onNoteRef.current(played)
          if (midi !== lastShown) {
            lastShown = midi
            setHearing(midi)
          }
          frame = requestAnimationFrame(loop)
        }
        loop()
      })
      .catch(() => {
        if (!cancelled)
          setStatus({
            state: 'error',
            message:
              'Não foi possível usar o microfone. Libere a permissão de microfone para este site e tente de novo.',
          })
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
      ctx?.close().catch(() => {})
      setHearing(null)
    }
  }, [enabled])

  return { status, hearing }
}

/** Toca um som curto, para o teclado da tela não ficar mudo. */
export function useTonePlayer() {
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(
    () => () => {
      ctxRef.current?.close().catch(() => {})
    },
    [],
  )

  return (frequency: number) => {
    if (typeof AudioContext === 'undefined') return
    const ctx = (ctxRef.current ??= new AudioContext())
    ctx.resume().catch(() => {})
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.85)
  }
}
