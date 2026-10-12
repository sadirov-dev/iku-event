import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import type { EventStatus } from '../lib/types'

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />
}

export function PageSpinner() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-400" role="status">
      <Spinner className="size-6" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function EmptyState({
  icon = '🗓️',
  title,
  text,
  action,
}: {
  icon?: ReactNode
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <AlertTriangle className="mb-2 size-7 text-rose-500" />
      <p className="font-medium text-rose-800">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-4" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
  }
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', styles[kind])}>
      {children}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-full max-w-lg rounded-t-3xl bg-transparent p-0 backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:max-w-full sm:rounded-3xl"
    >
      {open && (
        <div className="max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <button onClick={onClose} className="btn-ghost -mr-2 -mt-1 p-2" aria-label={t('common.close')}>
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

const STATUS_STYLES: Record<EventStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-sky-100 text-sky-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
}

export function StatusBadge({ status }: { status: EventStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLES[status])}>
      {t(`status.${status}`)}
    </span>
  )
}

export function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="pagination">
      <button className="btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t('common.prev')}
      </button>
      <span className="text-sm text-slate-500">{t('common.page', { page, total: pages })}</span>
      <button className="btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        {t('common.next')}
      </button>
    </nav>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; count?: number }[]
}) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition',
            value === it.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-xs',
                value === it.value ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500',
              )}
            >
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
