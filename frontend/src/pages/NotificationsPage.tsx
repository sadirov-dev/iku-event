import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import type { AppNotification } from '../lib/types'
import { useLocalize } from '../lib/localize'
import { useFormat } from '../lib/format'
import { EmptyState, ErrorState, PageHeader, Skeleton, Spinner, Tabs, cn } from '../components/ui'

const ICONS: Record<string, string> = {
  REGISTRATION: '✅',
  REMINDER: '⏰',
  EVENT_CHANGED: '🕒',
  VENUE_CHANGED: '📍',
  EVENT_CANCELLED: '❌',
  ANNOUNCEMENT: '📢',
  ACHIEVEMENT: '🏆',
  SYSTEM: 'ℹ️',
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const q = useQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: () => api.notifications({ unread: filter === 'unread' ? 'true' : undefined, pageSize: 50 }),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  const markAll = useMutation({ mutationFn: api.markAllRead, onSuccess: refresh })

  const open = async (n: AppNotification) => {
    if (!n.is_read) {
      // Optimistically mark as read so the badge updates instantly.
      queryClient.setQueryData(['notifications', 'unread'], (old: { unread: number } | undefined) =>
        old ? { unread: Math.max(0, old.unread - 1) } : old,
      )
      api.markRead(n.id).finally(refresh)
    }
    if (n.link) navigate(n.link)
  }

  return (
    <div className="container-page max-w-2xl py-8">
      <PageHeader
        title={t('notifications.title')}
        actions={
          !!q.data?.unread && (
            <button className="btn-secondary btn-sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              {markAll.isPending ? <Spinner /> : <CheckCheck className="size-4" />} {t('notifications.markAllRead')}
            </button>
          )
        }
      />
      <div className="mb-5">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: t('notifications.all') },
            { value: 'unread', label: t('notifications.unread'), count: q.data?.unread },
          ]}
        />
      </div>

      {q.isError ? (
        <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
      ) : q.data.items.length === 0 ? (
        <EmptyState icon="🔔" title={t('empty.notifications')} />
      ) : (
        <ul className="space-y-2">
          {q.data.items.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => open(n)}
                className={cn(
                  'card flex w-full items-start gap-3 p-4 text-left transition hover:shadow-md',
                  !n.is_read && 'border-brand-200 bg-brand-50/50',
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl ring-1 ring-slate-200" aria-hidden>
                  {ICONS[n.type] ?? '🔔'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm', n.is_read ? 'font-medium text-slate-700' : 'font-bold text-slate-900')}>{L(n, 'title')}</p>
                    <span className="shrink-0 text-xs text-slate-400">{f.relative(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{L(n, 'message')}</p>
                </div>
                {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-label={t('notifications.unread')} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
