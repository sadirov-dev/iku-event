import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Flag, Pencil, Plus, Send, Trash2, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api, errorMessage } from '../../lib/api'
import type { EventItem, EventStatus } from '../../lib/types'
import { useLocalize } from '../../lib/localize'
import { useFormat } from '../../lib/format'
import { Alert, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, StatusBadge } from '../../components/ui'

const STATUSES: EventStatus[] = ['DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED', 'COMPLETED', 'CANCELLED']
const PAGE_SIZE = 20

export default function AdminEvents() {
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? 1)

  const query = { search, status, page, pageSize: PAGE_SIZE, sort: 'date_desc', mine: isAdmin ? undefined : 'true' }
  const q = useQuery({ queryKey: ['events', 'admin', query], queryFn: () => api.events(query), placeholderData: keepPreviousData })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['event'] })
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }
  const update = useMutation({ mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => api.updateEvent(id, body), onSuccess: refresh })
  const remove = useMutation({ mutationFn: (id: number) => api.deleteEvent(id), onSuccess: refresh })
  const busy = update.isPending || remove.isPending

  const setStatus = (e: EventItem, s: EventStatus) => {
    if (s === 'CANCELLED' && !window.confirm(t('admin.cancelEventConfirm'))) return
    update.mutate({ id: e.id, body: { status: s } })
  }

  return (
    <>
      <PageHeader
        title={t('admin.events')}
        actions={
          <Link to="/admin/events/new" className="btn-primary">
            <Plus className="size-4" /> {t('admin.newEvent')}
          </Link>
        }
      />
      {!isAdmin && (
        <div className="mb-4">
          <Alert kind="info">{t('admin.reviewHint')}</Alert>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          className="input sm:max-w-sm"
          placeholder={t('filters.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input sm:w-56" value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
          <option value="">{t('admin.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {(update.isError || remove.isError) && (
        <div className="mb-4">
          <Alert>{errorMessage(update.error ?? remove.error, t)}</Alert>
        </div>
      )}

      {q.isError ? (
        <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon="🗓️" title={t('empty.events')} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t('admin.form.titleField')}</th>
                  <th className="px-4 py-3 font-semibold">{t('event.date')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.form.status')}</th>
                  <th className="px-4 py-3 font-semibold">{t('event.participants')}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {q.data.items.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link to={`/events/${e.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                        {e.category?.icon} {L(e, 'title')}
                      </Link>
                      <p className="text-xs text-slate-500">{e.venue ? L(e.venue, 'name') : '—'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {f.dayMonth(e.date)}, {e.start_time}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {e.registered_count}
                      {e.capacity ? ` / ${e.capacity}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {isAdmin && (e.status === 'PENDING' || e.status === 'APPROVED' || e.status === 'DRAFT') && (
                          <button className="btn-ghost btn-sm text-emerald-700" disabled={busy} onClick={() => setStatus(e, 'PUBLISHED')} title={t('admin.publish')}>
                            <CheckCircle2 className="size-4" />
                          </button>
                        )}
                        {!isAdmin && e.status === 'DRAFT' && (
                          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus(e, 'PENDING')} title={t('admin.form.submitReview')}>
                            <Send className="size-4" />
                          </button>
                        )}
                        {isAdmin && e.status === 'PUBLISHED' && e.is_past && (
                          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus(e, 'COMPLETED')} title={t('admin.complete')}>
                            <Flag className="size-4" />
                          </button>
                        )}
                        <Link to={`/admin/events/${e.id}/registrations`} className="btn-ghost btn-sm" title={t('admin.registrations')}>
                          <Users className="size-4" />
                        </Link>
                        <Link to={`/admin/events/${e.id}/edit`} className="btn-ghost btn-sm" title={t('common.edit')}>
                          <Pencil className="size-4" />
                        </Link>
                        {e.status !== 'CANCELLED' && e.status !== 'COMPLETED' && (
                          <button className="btn-ghost btn-sm text-amber-700" disabled={busy} onClick={() => setStatus(e, 'CANCELLED')} title={t('admin.cancelEvent')}>
                            <Ban className="size-4" />
                          </button>
                        )}
                        {(isAdmin || e.status === 'DRAFT') && (
                          <button
                            className="btn-ghost btn-sm text-rose-600"
                            disabled={busy}
                            onClick={() => window.confirm(t('common.confirmDelete')) && remove.mutate(e.id)}
                            title={t('common.delete')}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={q.data.total}
            pageSize={PAGE_SIZE}
            onChange={(p) => setParams({ ...(status ? { status } : {}), page: String(p) })}
          />
        </>
      )}
    </>
  )
}
