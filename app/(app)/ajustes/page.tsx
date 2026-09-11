'use client'

import { useEffect, useState } from 'react'
import { LogOut, Plus, Trash2, KeyRound } from 'lucide-react'
import { useInstitutions } from '@/lib/db/queries'
import { baseFields, remove, save } from '@/lib/db/repo'
import { useAuth, useTherapistId } from '@/lib/auth/AuthProvider'
import {
  useTherapistProfile,
  saveTherapistProfile,
} from '@/lib/db/therapist'
import { clearPin } from '@/lib/auth/pin'
import type { Institution } from '@/lib/db/types'
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { SyncBadge, useSync } from '@/components/SyncProvider'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const therapistId = useTherapistId()
  const institutions = useInstitutions()
  const profile = useTherapistProfile()
  const { pending, lastSyncAt, error } = useSync()
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('')
  const [profName, setProfName] = useState('')
  const [profCouncil, setProfCouncil] = useState('')
  const [profSaved, setProfSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setProfName(profile.full_name)
      setProfCouncil(profile.council_id)
    }
  }, [profile])

  async function addInstitution(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await save('institutions', {
      ...baseFields(therapistId),
      name: newName.trim(),
      kind: newKind.trim(),
      notes: '',
    } as Institution)
    setNewName('')
    setNewKind('')
  }

  return (
    <>
      <PageHeader title="Ajustes" action={<SyncBadge />} />

      <section className="mb-6">
        <SectionTitle>Seus dados profissionais</SectionTitle>
        <Card>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              await saveTherapistProfile({
                id: therapistId,
                full_name: profName.trim(),
                council_id: profCouncil.trim(),
              })
              setProfSaved(true)
              setTimeout(() => setProfSaved(false), 2000)
            }}
          >
            <Field label="Nome" hint="Assina os prontuários enviados à clínica.">
              <Input
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
              />
            </Field>
            <Field label="Registro profissional" hint="Opcional.">
              <Input
                value={profCouncil}
                onChange={(e) => setProfCouncil(e.target.value)}
                placeholder="ex.: 12345/MT"
              />
            </Field>
            <Button type="submit" full>
              {profSaved ? 'Salvo' : 'Salvar dados'}
            </Button>
          </form>
        </Card>
      </section>

      <section className="mb-6">
        <SectionTitle>Instituições de atendimento</SectionTitle>

        {institutions === undefined ? (
          <Spinner />
        ) : (
          <ul className="mb-3 space-y-2">
            {institutions.map((i) => (
              <li
                key={i.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.name}</span>
                  {i.kind && (
                    <span className="text-xs text-ink-soft">{i.kind}</span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Remover ${i.name}`}
                  className="tap px-2 text-danger"
                  onClick={() => {
                    if (
                      confirm(
                        `Remover "${i.name}"? Os pacientes ligados a ela ficam sem instituição, mas nada mais é apagado.`,
                      )
                    ) {
                      void remove('institutions', i.id)
                    }
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Card>
          <form onSubmit={addInstitution} className="space-y-3">
            <Field label="Nome">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Clínica Ágil"
              />
            </Field>
            <Field label="Tipo" hint="Opcional. Clínica, escola, domiciliar…">
              <Input
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
              />
            </Field>
            <Button type="submit" full disabled={!newName.trim()}>
              <Plus className="size-4" aria-hidden /> Adicionar instituição
            </Button>
          </form>
        </Card>
      </section>

      <section className="mb-6">
        <SectionTitle>Segurança deste aparelho</SectionTitle>
        <Card className="space-y-3">
          <Button
            variant="secondary"
            full
            onClick={async () => {
              if (
                confirm(
                  'Apagar o PIN atual? Você definirá um novo na próxima abertura do app.',
                )
              ) {
                await clearPin()
                location.reload()
              }
            }}
          >
            <KeyRound className="size-4" aria-hidden /> Trocar o PIN
          </Button>
          <p className="text-xs leading-relaxed text-ink-soft">
            O app pede o PIN sempre que fica dois minutos em segundo plano.
          </p>
        </Card>
      </section>

      <section className="mb-6">
        <SectionTitle>Sincronização</SectionTitle>
        <Card className="space-y-2 text-sm">
          <Row
            label="Pendentes de envio"
            value={pending === 0 ? 'Nenhum' : `${pending} registro(s)`}
          />
          <Row
            label="Última sincronização"
            value={
              lastSyncAt
                ? new Date(lastSyncAt).toLocaleString('pt-BR')
                : 'Ainda não sincronizou'
            }
          />
          {error && (
            <p className="pt-1 text-xs text-danger">Último erro: {error}</p>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>Conta</SectionTitle>
        <Card className="space-y-3">
          <Row label="E-mail" value={user?.email ?? '—'} />
          <Button
            variant="danger"
            full
            onClick={() => {
              if (
                confirm(
                  pending > 0
                    ? `Há ${pending} registro(s) que ainda não subiram para o servidor. Sair agora apaga os dados deste aparelho e esses registros serão perdidos. Continuar?`
                    : 'Sair da conta? Os dados guardados neste aparelho serão apagados. O que já foi sincronizado continua no servidor.',
                )
              ) {
                void signOut()
              }
            }}
          >
            <LogOut className="size-4" aria-hidden /> Sair da conta
          </Button>
        </Card>
      </section>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
      {children}
    </h2>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-36 shrink-0 text-ink-soft">{label}</span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </div>
  )
}
