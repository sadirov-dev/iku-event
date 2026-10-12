import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import type { EventItem } from '../lib/types'
import { useLocalize } from '../lib/localize'
import { addDays, parseDate, startOfWeek, toISODate, useFormat } from '../lib/format'
import { EventRow } from '../components/EventCard'
import { EmptyState, ErrorState, PageHeader, Spinner, Tabs, cn } from '../components/ui'

type Mode = 'month' | 'week' | 'day'

function EventChip({ event }: { event: EventItem }) {
  const L = useLocalize()
  const color = event.category?.color ?? '#6366f1'
  return (
    <Link
      to={`/events/${event.id}`}
      className={cn(
        'block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight transition hover:brightness-95',
        event.status === 'CANCELLED' && 'line-through opacity-60',
      )}
      style={{ background: `${color}1f`, color, borderLeft: `3px solid ${color}` }}
      title={L(event, 'title')}
    >
      <span className="font-semibold">{event.start_time}</span> {L(event, 'title')}
    </Link>
  )
}

export default function CalendarPage() {
  const { t } = useTranslation()
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const mode = (['month', 'week', 'day'].includes(params.get('view') ?? '') ? params.get('view') : 'month') as Mode
  const cursor = params.get('date') ? parseDate(params.get('date')!) : new Date()
  const todayISO = toISODate(new Date())

  const go = (view: Mode, date: Date) => setParams({ view, date: toISODate(date) }, { replace: true })

  const range = useMemo(() => {
    if (mode === 'day') return { from: cursor, days: 1 }
    if (mode === 'week') return { from: startOfWeek(cursor), days: 7 }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    return { from: startOfWeek(first), days: 42 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, toISODate(cursor)])

  const dates = Array.from({ length: range.days }, (_, i) => addDays(range.from, i))
  const dateFrom = toISODate(dates[0]!)
  const dateTo = toISODate(dates[dates.length - 1]!)

  const q = useQuery({
    queryKey: ['events', 'calendar', dateFrom, dateTo],
    queryFn: () => api.events({ date_from: dateFrom, date_to: dateTo, pageSize: 100, sort: 'date_asc' }),
    placeholderData: keepPreviousData,
  })

  const byDate = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const e of q.data?.items ?? []) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [q.data])

  const step = (dir: 1 | -1) => {
    if (mode === 'day') go(mode, addDays(cursor, dir))
    else if (mode === 'week') go(mode, addDays(cursor, 7 * dir))
    else go(mode, new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1))
  }

  const heading =
    mode === 'month'
      ? f.monthYear(cursor)
      : mode === 'week'
        ? `${f.dayMonth(dateFrom)} – ${f.dayMonth(dateTo)}`
        : f.fullDate(toISODate(cursor))

  return (
    <div className="container-page py-8">
      <PageHeader title={t('calendar.title')} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button className="btn-secondary p-2" onClick={() => step(-1)} aria-label={t('calendar.prev')}>
            <ChevronLeft className="size-5" />
          </button>
          <button className="btn-secondary" onClick={() => go(mode, new Date())}>
            {t('calendar.today')}
          </button>
          <button className="btn-secondary p-2" onClick={() => step(1)} aria-label={t('calendar.next')}>
            <ChevronRight className="size-5" />
          </button>
          <h2 className="ml-2 text-lg font-bold text-slate-900">{heading}</h2>
          {q.isFetching && <Spinner className="text-slate-400" />}
        </div>
        <div className="sm:w-72">
          <Tabs
            value={mode}
            onChange={(v) => go(v, cursor)}
            items={[
              { value: 'month', label: t('calendar.month') },
              { value: 'week', label: t('calendar.week') },
              { value: 'day', label: t('calendar.day') },
            ]}
          />
        </div>
      </div>

      {q.isError && <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />}

      {mode === 'month' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-500">
            {dates.slice(0, 7).map((d) => (
              <div key={d.getDay()} className="py-2">
                {f.weekdayShort(d)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dates.map((d) => {
              const iso = toISODate(d)
              const events = byDate.get(iso) ?? []
              const outside = d.getMonth() !== cursor.getMonth()
              return (
                <div
                  key={iso}
                  className={cn('min-h-16 border-b border-r border-slate-100 p-1 sm:min-h-28 sm:p-1.5', outside && 'bg-slate-50/70')}
                >
                  <button
                    onClick={() => go('day', d)}
                    className={cn(
                      'mb-1 flex size-7 items-center justify-center rounded-full text-sm font-medium transition hover:bg-slate-100',
                      outside ? 'text-slate-400' : 'text-slate-700',
                      iso === todayISO && 'bg-brand-600 text-white hover:bg-brand-700',
                    )}
                    aria-label={f.fullDate(iso)}
                  >
                    {d.getDate()}
                  </button>
                  {/* Phones: dots; larger screens: titled chips. */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {events.slice(0, 4).map((e) => (
                      <span key={e.id} className="size-1.5 rounded-full" style={{ background: e.category?.color ?? '#6366f1' }} />
                    ))}
                  </div>
                  <div className="hidden space-y-0.5 sm:block">
                    {events.slice(0, 3).map((e) => <EventChip key={e.id} event={e} />)}
                    {events.length > 3 && (
                      <button onClick={() => go('day', d)} className="px-1 text-[11px] font-semibold text-slate-500 hover:text-brand-600">
                        {t('calendar.more', { count: events.length - 3 })}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'week' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {dates.map((d) => {
            const iso = toISODate(d)
            const events = byDate.get(iso) ?? []
            return (
              <div key={iso} className={cn('card p-2 md:min-h-64', iso === todayISO && 'ring-2 ring-brand-500')}>
                <button onClick={() => go('day', d)} className="mb-2 w-full rounded-lg px-1 py-1 text-left hover:bg-slate-50">
                  <span className="text-xs font-semibold uppercase text-slate-500">{f.weekdayShort(d)}</span>{' '}
                  <span className="font-bold text-slate-900">{d.getDate()}</span>
                </button>
                <div className="space-y-1">
                  {events.map((e) => <EventChip key={e.id} event={e} />)}
                  {events.length === 0 && <p className="px-1 text-xs text-slate-300 md:hidden">—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mode === 'day' &&
        ((byDate.get(toISODate(cursor)) ?? []).length === 0 ? (
          !q.isPending && <EmptyState icon="🗓️" title={t('calendar.noEvents')} />
        ) : (
          <div className="card p-2">
            {byDate.get(toISODate(cursor))!.map((e) => <EventRow key={e.id} event={e} />)}
          </div>
        ))}
    </div>
  )
}
