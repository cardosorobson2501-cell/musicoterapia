'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Expand,
  Mic,
  Piano,
  Shrink,
  Trash2,
  Undo2,
} from 'lucide-react'
import {
  DEFAULT_DETECTOR_SETTINGS,
  NOTES,
  midiToFrequency,
  noteOf,
  octaveOf,
  sanitizeSettings,
} from '@/lib/domain/notes'
import {
  type InputStatus,
  useMicrophoneInput,
  useMidiInput,
  useTonePlayer,
} from '@/lib/music/useNoteInput'
import { Button, Card, PageHeader, cx } from '@/components/ui'
import { CalibrationPanel } from '@/components/notes/CalibrationPanel'

type Bubble = { id: number; midi: number }

const SETTINGS_KEY = 'notas-coloridas:calibracao'

/**
 * Notas coloridas: cada nota tocada no teclado vira uma bolinha colorida na
 * tela (Dó vermelho, Sol azul…). A nota chega por teclado MIDI, pelo
 * microfone ou tocando no teclado desenhado na própria tela.
 */
export default function ColoredNotesPage() {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [midiOn, setMidiOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_DETECTOR_SETTINGS)
  const [showNames, setShowNames] = useState(true)
  const [big, setBig] = useState(false)
  const nextId = useRef(0)
  const boardEnd = useRef<HTMLDivElement>(null)
  const playTone = useTonePlayer()

  const addNote = useCallback((midi: number) => {
    setBubbles((prev) => [...prev, { id: nextId.current++, midi }])
  }, [])

  const midiStatus = useMidiInput(midiOn, addNote)
  const mic = useMicrophoneInput(micOn, addNote, settings)

  // A calibração fica guardada neste aparelho, para não refazer a cada uso.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) setSettings(sanitizeSettings(JSON.parse(saved)))
    } catch {}
  }, [])
  const updateSettings = (next: typeof settings) => {
    setSettings(next)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {}
  }

  useEffect(() => {
    boardEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [bubbles.length])

  // Tela cheia de verdade quando o aparelho permite; no iPhone, a ampliação
  // fica só por CSS (o Safari não deixa um trecho da página ocupar a tela).
  const toggleBig = () => {
    const next = !big
    setBig(next)
    if (next) document.documentElement.requestFullscreen?.().catch(() => {})
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setBig(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const counts = new Map<number, number>()
  for (const b of bubbles) {
    const pc = noteOf(b.midi).pitchClass
    counts.set(pc, (counts.get(pc) ?? 0) + 1)
  }

  const onScreenKey = (midi: number) => {
    // Com o microfone ligado, o som do aparelho seria contado duas vezes.
    if (!micOn) playTone(midiToFrequency(midi))
    addNote(midi)
  }

  const board = (
    <div
      className={cx(
        'overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface p-4',
        big ? 'min-h-0 flex-1' : 'h-[45dvh] min-h-64',
      )}
      aria-live="polite"
      aria-label="Notas tocadas"
    >
      {bubbles.length === 0 ? (
        <p className="flex h-full items-center justify-center text-center text-ink-soft">
          Toque uma nota no teclado
          <br />e ela aparece aqui como uma bolinha colorida.
        </p>
      ) : (
        <ul className={cx('flex flex-wrap content-start', big ? 'gap-4' : 'gap-2.5')}>
          {bubbles.map((b) => {
            const n = noteOf(b.midi)
            return (
              <li
                key={b.id}
                className={cx(
                  'note-pop flex items-center justify-center rounded-full font-semibold shadow-sm',
                  big ? 'size-20 text-lg' : 'size-12 text-xs',
                )}
                style={{ background: n.color, color: n.ink }}
                title={`${n.name}${octaveOf(b.midi)}`}
              >
                {showNames ? n.short : <span className="sr-only">{n.name}</span>}
              </li>
            )
          })}
        </ul>
      )}
      <div ref={boardEnd} />
    </div>
  )

  const tally = (
    <ul className="flex flex-wrap gap-2" aria-label="Contagem por nota">
      {NOTES.filter((n) => counts.has(n.pitchClass)).map((n) => (
        <li
          key={n.pitchClass}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm"
        >
          <span
            className="inline-block size-5 rounded-full"
            style={{ background: n.color }}
            aria-hidden
          />
          {n.name} × {counts.get(n.pitchClass)}
        </li>
      ))}
    </ul>
  )

  const actions = (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        className="flex-1"
        disabled={bubbles.length === 0}
        onClick={() => setBubbles((prev) => prev.slice(0, -1))}
      >
        <Undo2 className="size-5" aria-hidden /> Desfazer
      </Button>
      <Button
        variant="secondary"
        className="flex-1"
        disabled={bubbles.length === 0}
        onClick={() => setBubbles([])}
      >
        <Trash2 className="size-5" aria-hidden /> Limpar
      </Button>
      <Button variant="secondary" onClick={toggleBig} aria-label={big ? 'Sair da tela cheia' : 'Tela cheia'}>
        {big ? <Shrink className="size-5" aria-hidden /> : <Expand className="size-5" aria-hidden />}
      </Button>
    </div>
  )

  if (big) {
    return (
      <div className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col gap-3 bg-bg p-4">
        {board}
        {tally}
        <OnScreenKeyboard onKey={onScreenKey} />
        {actions}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Notas coloridas"
        subtitle="Cada nota tocada vira uma bolinha colorida"
      />

      <div className="space-y-4">
        <Card className="space-y-3">
          <SourceToggle
            icon={<Piano className="size-5" aria-hidden />}
            label="Teclado MIDI"
            hint="Ligue o teclado no celular ou computador pelo cabo USB."
            on={midiOn}
            onToggle={() => setMidiOn((v) => !v)}
            status={midiStatus}
          />
          <SourceToggle
            icon={<Mic className="size-5" aria-hidden />}
            label="Microfone"
            hint="Para teclado sem cabo: o aparelho escuta o som e descobre a nota."
            on={micOn}
            onToggle={() => setMicOn((v) => !v)}
            status={mic.status}
          />
          {micOn && mic.status.state === 'on' && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-ink-soft">
                Ouvindo agora:
                {mic.hearing !== null ? (
                  <>
                    <span
                      className="inline-block size-4 rounded-full"
                      style={{ background: noteOf(mic.hearing).color }}
                      aria-hidden
                    />
                    <strong className="text-ink">{noteOf(mic.hearing).name}</strong>
                  </>
                ) : (
                  <span>—</span>
                )}
              </span>
            </div>
          )}
          <CalibrationPanel
            settings={settings}
            onChange={updateSettings}
            level={mic.level}
            listening={micOn && mic.status.state === 'on'}
          />
        </Card>

        {board}
        {tally}
        {actions}

        <section>
          <p className="mb-2 text-sm text-ink-soft">
            Teclado na tela — para testar ou usar sem instrumento:
          </p>
          <OnScreenKeyboard onKey={onScreenKey} />
        </section>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-[var(--color-brand)]"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
          />
          Escrever o nome da nota dentro da bolinha
        </label>

        <Legend />
      </div>
    </>
  )
}

function SourceToggle({
  icon,
  label,
  hint,
  on,
  onToggle,
  status,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  on: boolean
  onToggle: () => void
  status: InputStatus
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-ink-soft">{icon}</span>
          <div className="min-w-0">
            <p className="font-medium">{label}</p>
            <p className="text-xs text-ink-soft">{hint}</p>
          </div>
        </div>
        <Button
          variant={on ? 'primary' : 'secondary'}
          onClick={onToggle}
          aria-pressed={on}
          className="shrink-0"
        >
          {on ? 'Ligado' : 'Ligar'}
        </Button>
      </div>
      {status.state === 'starting' && (
        <p className="mt-1.5 text-xs text-ink-soft">Conectando…</p>
      )}
      {status.state === 'on' && (
        <p className="mt-1.5 text-xs text-ok">{status.detail}</p>
      )}
      {status.state === 'error' && (
        <p className="mt-1.5 text-xs text-danger">{status.message}</p>
      )}
    </div>
  )
}

/** Uma oitava (Dó central a Si), com as teclas pretas por cima. */
function OnScreenKeyboard({ onKey }: { onKey: (midi: number) => void }) {
  const whites = NOTES.filter((n) => !n.sharp)
  // Posição da tecla preta: logo depois de qual tecla branca (índice).
  const blacks = [
    { pc: 1, after: 0 },
    { pc: 3, after: 1 },
    { pc: 6, after: 3 },
    { pc: 8, after: 4 },
    { pc: 10, after: 5 },
  ]
  const base = 60

  return (
    <div className="relative flex h-32 select-none touch-manipulation">
      {whites.map((n) => (
        <button
          key={n.pitchClass}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            onKey(base + n.pitchClass)
          }}
          onClick={(e) => {
            // Teclado do computador (Enter/Espaço) não gera toque.
            if (e.detail === 0) onKey(base + n.pitchClass)
          }}
          className="flex flex-1 flex-col items-center justify-end rounded-b-lg border border-border bg-white pb-2 text-xs font-medium text-neutral-700 active:brightness-90"
          aria-label={n.name}
        >
          <span
            className="mb-1 inline-block size-4 rounded-full"
            style={{ background: n.color }}
            aria-hidden
          />
          {n.short}
        </button>
      ))}
      {blacks.map(({ pc, after }) => (
        <button
          key={pc}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault()
            onKey(base + pc)
          }}
          onClick={(e) => {
            // Teclado do computador (Enter/Espaço) não gera toque.
            if (e.detail === 0) onKey(base + pc)
          }}
          className="absolute top-0 z-10 flex h-[60%] w-[9%] -translate-x-1/2 items-end justify-center rounded-b-md bg-neutral-900 pb-1.5 active:bg-neutral-700"
          style={{ left: `${((after + 1) / whites.length) * 100}%` }}
          aria-label={NOTES[pc].name}
        >
          <span
            className="inline-block size-3 rounded-full"
            style={{ background: NOTES[pc].color }}
            aria-hidden
          />
        </button>
      ))}
    </div>
  )
}

function Legend() {
  return (
    <Card>
      <p className="mb-3 text-sm font-medium">Cores das notas</p>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-3 text-sm sm:grid-cols-6">
        {NOTES.map((n) => (
          <li key={n.pitchClass} className="flex items-center gap-2">
            <span
              className="inline-block size-5 shrink-0 rounded-full"
              style={{ background: n.color }}
              aria-hidden
            />
            {n.name}
          </li>
        ))}
      </ul>
    </Card>
  )
}
