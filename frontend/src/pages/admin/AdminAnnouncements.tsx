import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useLocalize } from '../../lib/localize'
import { useFormat } from '../../lib/format'
import { TypeBadge } from '../../components/AnnouncementCard'
import { Alert, EmptyState, ErrorState, PageHeader, Skeleton, cn } from '../../components/ui'

export default function AdminAnnouncements() {
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()
  const queryClient = useQueryClient()

  // `all=true` includes scheduled and expired announcements.
  const q = useQuery({ queryKey: ['announcements', 'admin'], queryFn: () => api.announcements({ all: 'true', pageSize: 100 }) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['announcements'] })
  const pin = useMutation({ mutationFn: ({ id, is_pinned }: { id: number; is_pinned: boolean }) => api.updateAnnouncement(id, { is_pinned }), onSuccess: refresh })
  const remove = useMutation({ mutationFn: api.deleteAnnouncement, onSuccess: refresh })

  return (
    <>
      <PageHeader
        title={t('admin.announcements')}
        actions={
          <Link to="/admin/announcements/new" className="btn-primary">
            <Plus className="size-4" /> {t('admin.newAnnouncement')}
          </Link>
        }
      />
      {(pin.isError || remove.isError) && (
        <div className="mb-4">
          <Alert>{errorMessage(pin.error ?? remove.error, t)}</Alert>
        </div>
      )}
      {q.isError ? (
        <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon="📭" title={t('announcements.empty')} />
      ) : (
        <ul className="card divide-y divide-slate-100">
          {q.data.items.map((a) => (
            <li key={a.id} className={cn('flex flex-wrap items-center gap-3 p-4', !a.is_active && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <TypeBadge type={a.category} />
                  {a.is_pinned && <Pin className="size-3.5 text-brand-600" />}
                  <span className="text-xs text-slate-500">
                    {t(`announcements.priority.${a.priority}`)} · {f.shortDate(a.published_at)}
                    {a.expires_at && ` → ${f.shortDate(a.expires_at)}`}
                  </span>
                </div>
                <Link to={`/announcements/${a.id}`} className="font-semibold hover:text-brand-700">
                  {L(a, 'title')}
                </Link>
              </div>
              <div className="flex gap-1">
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => pin.mutate({ id: a.id, is_pinned: !a.is_pinned })}
                  title={t('admin.form.pinned')}
                  disabled={pin.isPending}
                >
                  {a.is_pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                </button>
                <Link to={`/admin/announcements/${a.id}/edit`} className="btn-ghost btn-sm" title={t('common.edit')}>
                  <Pencil className="size-4" />
                </Link>
                <button
                  className="btn-ghost btn-sm text-rose-600"
                  onClick={() => window.confirm(t('common.confirmDelete')) && remove.mutate(a.id)}
                  title={t('common.delete')}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
