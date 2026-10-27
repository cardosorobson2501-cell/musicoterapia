'use client'

import { useEffect, useRef, useState } from 'react'
import { NoteOnsetDetector } from '@/lib/domain/notes'

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

// Sensibilidade 1 (baixa) a 3 (alta) → volume mínimo para contar como nota.
const MIN_RMS = [0.04, 0.02, 0.008]

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
    let processor: ScriptProcessorNode | null = null
    setStatus({ state: 'starting' })

    navigator.mediaDevices
      .getUserMedia({
        // Sem os "filtros de chamada": eles abafam o som do instrumento e
        // "achatam" os golpes repetidos, que o navegador confunde com ruído.
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
        const detector = new NoteOnsetDetector(ctx.sampleRate)
        const source = ctx.createMediaStreamSource(s)
        // Recebe o áudio em blocos contínuos, sem lacunas: é o que permite
        // pegar cada golpe de uma repetição rápida.
        processor = ctx.createScriptProcessor(512, 1, 1)
        let lastShown: number | null = null
        processor.onaudioprocess = (e) => {
          if (cancelled) return
          detector.setMinRms(MIN_RMS[sensitivityRef.current - 1] ?? MIN_RMS[1])
          for (const midi of detector.push(e.inputBuffer.getChannelData(0))) {
            onNoteRef.current(midi)
          }
          if (detector.hearing !== lastShown) {
            lastShown = detector.hearing
            setHearing(lastShown)
          }
        }
        // O processador só roda se estiver ligado à saída; o ganho zero
        // impede que o som do microfone saia no alto-falante.
        const mute = ctx.createGain()
        mute.gain.value = 0
        source.connect(processor)
        processor.connect(mute).connect(ctx.destination)
        setStatus({ state: 'on', detail: 'Ouvindo… toque uma nota.' })
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
      if (processor) processor.onaudioprocess = null
      processor?.disconnect()
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
