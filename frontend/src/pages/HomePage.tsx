import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Sparkles } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { toISODate } from '../lib/format'
import { useLocalize } from '../lib/localize'
import EventCard, { EventCardSkeleton, EventRow } from '../components/EventCard'
import AnnouncementCard, { AnnouncementSkeleton } from '../components/AnnouncementCard'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'

function SectionTitle({ title, to }: { title: string; to?: string }) {
  const { t } = useTranslation()
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {to && (
        <Link to={to} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-brand-600 hover:text-brand-700">
          {t('home.seeAll')} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const L = useLocalize()

  const today = useQuery({
    queryKey: ['events', { period: 'today' }],
    queryFn: () => api.events({ period: 'today', pageSize: 6 }),
  })
  const upcoming = useQuery({
    queryKey: ['events', { period: 'upcoming', home: true }],
    queryFn: () => api.events({ period: 'upcoming', pageSize: 12, status: 'PUBLISHED' }),
  })
  const week = useQuery({
    queryKey: ['events', { period: 'week', count: true }],
    queryFn: () => api.events({ period: 'week', pageSize: 1, status: 'PUBLISHED' }),
  })
  const announcements = useQuery({
    queryKey: ['announcements', { home: true }],
    queryFn: () => api.announcements({ pageSize: 4 }),
  })
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories, staleTime: 5 * 60_000 })

  const todayISO = toISODate(new Date())
  const upcomingItems = (upcoming.data?.items ?? []).filter((e) => e.date !== todayISO).slice(0, 6)

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 size-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="container-page relative py-12 sm:py-16 lg:py-20">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t('hero.title')}</h1>
            <p className="mt-4 text-base text-brand-100 sm:text-lg">{t('hero.subtitle')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/events" className="btn bg-white px-6 py-3 text-brand-700 shadow-lg hover:bg-brand-50">
                <Sparkles className="size-4" /> {t('hero.browse')}
              </Link>
              <Link to="/calendar" className="btn border border-white/30 bg-white/10 px-6 py-3 text-white hover:bg-white/20">
                <CalendarDays className="size-4" /> {t('hero.calendar')}
              </Link>
            </div>
            <div className="mt-8 flex gap-6 text-sm">
              <div>
                <span className="text-2xl font-extrabold">{today.data?.total ?? '–'}</span>{' '}
                <span className="text-brand-100">{t('hero.statToday')}</span>
              </div>
              <div>
                <span className="text-2xl font-extrabold">{week.data?.total ?? '–'}</span>{' '}
                <span className="text-brand-100">{t('hero.statWeek')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page space-y-12 py-10">
        {/* Today */}
        <section>
          <SectionTitle title={t('home.today')} to="/events?period=today" />
          {today.isError ? (
            <ErrorState message={errorMessage(today.error, t)} onRetry={() => today.refetch()} />
          ) : today.isPending ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <EventCardSkeleton key={i} />)}
            </div>
          ) : today.data.items.length === 0 ? (
            <EmptyState icon="☀️" title={t('home.todayEmpty')} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {today.data.items.map((e) => <EventCard key={e.id} event={e} />)}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
          {/* Upcoming */}
          <section className="lg:col-span-3">
            <SectionTitle title={t('home.upcoming')} to="/events" />
            <div className="card p-2">
              {upcoming.isError ? (
                <ErrorState message={errorMessage(upcoming.error, t)} onRetry={() => upcoming.refetch()} />
              ) : upcoming.isPending ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
                </div>
              ) : upcomingItems.length === 0 ? (
                <p className="p-6 text-center text-slate-500">{t('errors.EVENT_NOT_FOUND')}</p>
              ) : (
                upcomingItems.map((e) => <EventRow key={e.id} event={e} />)
              )}
            </div>
          </section>

          {/* Announcements */}
          <section className="lg:col-span-2">
            <SectionTitle title={t('home.announcements')} to="/announcements" />
            <div className="space-y-3">
              {announcements.isError ? (
                <ErrorState message={errorMessage(announcements.error, t)} onRetry={() => announcements.refetch()} />
              ) : announcements.isPending ? (
                [0, 1, 2].map((i) => <AnnouncementSkeleton key={i} />)
              ) : announcements.data.items.length === 0 ? (
                <EmptyState icon="📭" title={t('announcements.empty')} />
              ) : (
                announcements.data.items.map((a) => <AnnouncementCard key={a.id} a={a} compact />)
              )}
            </div>
          </section>
        </div>

        {/* Categories */}
        {categories.data && (
          <section>
            <SectionTitle title={t('home.categories')} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {categories.data.map((c) => (
                <Link
                  key={c.id}
                  to={`/events?category=${c.slug}`}
                  className="card flex items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: `${c.color ?? '#6366f1'}1f` }}
                    aria-hidden
                  >
                    {c.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{L(c, 'name')}</p>
                    <p className="text-xs text-slate-500">{t('home.upcomingCount', { count: c.upcoming_count ?? 0 })}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
