import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import type { EventItem } from '../lib/types'
import { useLocalize } from '../lib/localize'
import { useFormat } from '../lib/format'
import { EventCover } from '../components/EventCard'
import { EmptyState, ErrorState, PageHeader, Skeleton, Tabs, cn } from '../components/ui'

type Tab = 'upcoming' | 'past' | 'cancelled'

function MyEventItem({ event, tab }: { event: EventItem; tab: Tab }) {
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()

  let badge: React.ReactNode = null
  if (tab === 'cancelled') {
    badge = (
      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
        {event.status === 'CANCELLED' ? t('myEvents.eventCancelled') : t('myEvents.youCancelled')}
      </span>
    )
  } else if (tab === 'upcoming') {
    badge = <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{t('event.registered')}</span>
  } else if (event.my_attended) {
    badge = (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
        <CheckCircle2 className="size-3.5" /> {t('myEvents.attended')}
      </span>
    )
  }

  return (
    <Link to={`/events/${event.id}`} className="card group flex gap-4 overflow-hidden p-3 transition hover:shadow-md">
      <div className="size-20 shrink-0 overflow-hidden rounded-xl sm:size-24">
        <EventCover event={event} className={cn(tab !== 'upcoming' && 'grayscale-[60%]')} />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-brand-600">
          {event.category && L(event.category, 'name')}
        </p>
        <h3 className="truncate font-bold text-slate-900 group-hover:text-brand-700">{L(event, 'title')}</h3>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {f.eventDay(event.date)} · {event.start_time}–{event.end_time}
          {event.venue && ` · ${L(event.venue, 'name')}`}
        </p>
        <div className="mt-2">{badge}</div>
      </div>
    </Link>
  )
}

export default function MyEventsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const tab = (['upcoming', 'past', 'cancelled'].includes(params.get('tab') ?? '') ? params.get('tab') : 'upcoming') as Tab

  const q = useQuery({ queryKey: ['my-events', tab], queryFn: () => api.myEvents(tab) })
  const counts = q.data?.counts

  const empty = {
    upcoming: t('myEvents.empty'),
    past: t('myEvents.emptyPast'),
    cancelled: t('myEvents.emptyCancelled'),
  }

  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader title={t('myEvents.title')} />
      <div className="mb-6">
        <Tabs
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          items={[
            { value: 'upcoming', label: t('myEvents.upcoming'), count: counts?.upcoming },
            { value: 'past', label: t('myEvents.past'), count: counts?.past },
            { value: 'cancelled', label: t('myEvents.cancelled'), count: counts?.cancelled },
          ]}
        />
      </div>

      {q.isError ? (
        <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : q.data.items.length === 0 ? (
        <EmptyState
          icon={tab === 'upcoming' ? '🎟️' : tab === 'past' ? '📚' : '🗂️'}
          title={empty[tab]}
          action={tab === 'upcoming' && <Link to="/events" className="btn-primary">{t('myEvents.browse')}</Link>}
        />
      ) : (
        <div className="space-y-3">
          {q.data.items.map((e) => <MyEventItem key={e.id} event={e} tab={tab} />)}
        </div>
      )}
    </div>
  )
}
