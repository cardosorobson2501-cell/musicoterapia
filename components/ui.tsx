'use client'

import { forwardRef } from 'react'

/**
 * Primitivos de interface.
 *
 * Duas regras valem em todos eles, porque o app é usado com o celular na mão
 * durante o atendimento: nada abaixo de 48px de altura de toque, e nenhum
 * texto de campo abaixo de 16px (senão o iOS dá zoom ao focar).
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-ink active:brightness-90',
  secondary:
    'bg-surface-2 text-ink border border-border active:bg-border',
  ghost: 'text-ink-soft active:bg-surface-2',
  danger: 'bg-danger text-white active:brightness-90',
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    full?: boolean
  }
>(function Button(
  { variant = 'primary', full, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        'tap inline-flex items-center justify-center gap-2 rounded-xl px-4 font-medium',
        'transition-[filter,background-color] disabled:opacity-40',
        BUTTON_STYLES[variant],
        full && 'w-full',
        className,
      )}
      {...props}
    />
  )
})

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'rounded-[var(--radius-card)] border border-border bg-surface p-4',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

const INPUT_BASE =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-ink ' +
  'outline-none placeholder:text-ink-soft/60 focus:border-brand'

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx(INPUT_BASE, 'tap', className)} {...props} />
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(INPUT_BASE, 'resize-y leading-relaxed', className)}
      {...props}
    />
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select ref={ref} className={cx(INPUT_BASE, 'tap', className)} {...props} />
  )
})

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'brand'
}) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-soft',
    ok: 'bg-ok/15 text-ok',
    warn: 'bg-warn/20 text-warn',
    danger: 'bg-danger/15 text-danger',
    brand: 'bg-brand/15 text-brand',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-soft">
      <span
        className="size-5 animate-spin rounded-full border-2 border-border border-t-brand"
        aria-hidden
      />
      <span className="text-sm">{label ?? 'Carregando…'}</span>
    </div>
  )
}
