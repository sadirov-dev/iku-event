import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api, errorMessage } from '../../lib/api'
import { useLocalize } from '../../lib/localize'
import { useFormat } from '../../lib/format'
import { EventRow } from '../../components/EventCard'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui'

function StatTile({ label, value, sub, to }: { label: string; value: string | number; sub?: string; to?: string }) {
  const body = (
    <>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </>
  )
  return to ? (
    <Link to={to} className="card block p-5 transition hover:shadow-md">
      {body}
    </Link>
  ) : (
    <div className="card p-5">{body}</div>
  )
}

/** ТЗ §20: the organizer's own numbers — events, participants, upcoming, completed. */
function OrganizerDashboard() {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['events', 'organizer-overview'],
    queryFn: () => api.events({ mine: 'true', pageSize: 100, sort: 'date_asc' }),
  })
  if (q.isError) return <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />

  const items = q.data?.items ?? []
  const upcoming = items.filter((e) => e.status === 'PUBLISHED' && !e.is_past)
  const count = (pred: (s: string, past: boolean) => boolean) => items.filter((e) => pred(e.status, e.is_past)).length

  return (
    <>
      <PageHeader
        title={t('nav.organizerPanel')}
        subtitle={t('admin.reviewHint')}
        actions={
          <Link to="/admin/events/new" className="btn-primary">
            <Plus className="size-4" /> {t('admin.newEvent')}
          </Link>
        }
      />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {!q.data ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatTile label={t('admin.org.total')} value={q.data.total} to="/admin/events" />
            <StatTile label={t('admin.org.participants')} value={items.reduce((n, e) => n + e.registered_count, 0)} />
            <StatTile label={t('admin.org.upcoming')} value={upcoming.length} />
            <StatTile label={t('admin.org.completed')} value={count((s, past) => s === 'COMPLETED' || (s === 'PUBLISHED' && past))} />
            <StatTile label={t('admin.org.pending')} value={count((s) => s === 'PENDING')} to="/admin/events?status=PENDING" />
            <StatTile label={t('admin.org.drafts')} value={count((s) => s === 'DRAFT')} to="/admin/events?status=DRAFT" />
          </>
        )}
      </div>
      <section className="card p-3">
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <h2 className="font-bold">{t('admin.org.nextEvents')}</h2>
          <Link to="/admin/events" className="text-sm font-semibold text-brand-600">
            {t('home.seeAll')}
          </Link>
        </div>
        {q.data && upcoming.length === 0 ? (
          <p className="px-2 py-6 text-sm text-slate-500">{t('admin.org.empty')}</p>
        ) : (
          upcoming.slice(0, 6).map((e) => <EventRow key={e.id} event={e} />)
        )}
      </section>
    </>
  )
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: api.adminStats, enabled: user?.role === 'ADMIN' })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.updateEvent(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  // Organizers get their own overview; the global numbers are for admins only.
  if (user?.role !== 'ADMIN') return <OrganizerDashboard />

  if (q.isError) return <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />

  const s = q.data?.totals
  const maxCat = Math.max(1, ...(q.data?.by_category.map((c) => c.registrations) ?? [1]))

  return (
    <>
      <PageHeader
        title={t('admin.dashboard')}
        actions={
          <Link to="/admin/events/new" className="btn-primary">
            <Plus className="size-4" /> {t('admin.newEvent')}
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {!s ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <StatTile label={t('admin.stats.students')} value={s.students} to="/admin/users?role=STUDENT" />
            <StatTile
              label={t('admin.stats.events')}
              value={s.events}
              sub={t('admin.stats.eventsThisMonth', { count: s.events_this_month })}
              to="/admin/events"
            />
            <StatTile label={t('admin.stats.registrations')} value={s.registrations} />
            <StatTile label={t('admin.stats.pending')} value={s.pending_events} to="/admin/events?status=PENDING" />
            <StatTile label={t('admin.stats.attendance')} value={s.attendance_rate === null ? '—' : `${s.attendance_rate}%`} />
            <StatTile label={t('admin.stats.important')} value={s.important_announcements} to="/admin/announcements" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">
            {t('admin.stats.pendingList')} {s && s.pending_events > 0 && <span className="text-amber-600">({s.pending_events})</span>}
          </h2>
          {!q.data ? (
            <Skeleton className="h-24" />
          ) : q.data.pending.length === 0 ? (
            <p className="text-sm text-slate-500">{t('admin.stats.noPending')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {q.data.pending.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/events/${e.id}`} className="font-semibold hover:text-brand-700">
                      {L(e, 'title')}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {f.dayMonth(e.date)} · {e.start_time} · {e.organizer?.full_name}
                    </p>
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: e.id, status: 'PUBLISHED' })}
                  >
                    <Check className="size-3.5" /> {t('admin.publish')}
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: e.id, status: 'DRAFT' })}
                  >
                    <X className="size-3.5" /> {t('admin.reject')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-bold">{t('admin.stats.byCategory')}</h2>
          {!q.data ? (
            <Skeleton className="h-40" />
          ) : (
            <ul className="space-y-2.5">
              {q.data.by_category.map((c) => (
                <li key={c.slug} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm" title={`${L(c, 'name')}: ${c.registrations}`}>
                  <span className="truncate text-slate-600">{L(c, 'name')}</span>
                  <span className="h-3 rounded-r bg-slate-100">
                    <span
                      className="block h-full rounded-r bg-brand-500"
                      style={{ width: `${(c.registrations / maxCat) * 100}%`, minWidth: c.registrations ? 4 : 0 }}
                    />
                  </span>
                  <span className="text-right font-semibold tabular-nums text-slate-900">{c.registrations}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-3 lg:col-span-2">
          <div className="flex items-center justify-between px-2 pb-1 pt-2">
            <h2 className="font-bold">{t('admin.stats.upcoming')}</h2>
            <Link to="/admin/events" className="text-sm font-semibold text-brand-600">
              {t('home.seeAll')}
            </Link>
          </div>
          {q.data?.upcoming.map((e) => <EventRow key={e.id} event={e} />)}
        </section>
      </div>
    </>
  )
}
