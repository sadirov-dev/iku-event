import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { useLocalize } from '../lib/localize'
import EventCard, { EventCardSkeleton } from '../components/EventCard'
import { EmptyState, ErrorState, PageHeader, Pagination, cn } from '../components/ui'

const PERIODS = ['upcoming', 'today', 'tomorrow', 'week', 'month', 'past'] as const
const SORTS = ['date_asc', 'date_desc', 'newest', 'popular'] as const
const SORT_LABEL: Record<(typeof SORTS)[number], string> = {
  date_asc: 'filters.sortDateAsc',
  date_desc: 'filters.sortDateDesc',
  newest: 'filters.sortNewest',
  popular: 'filters.sortPopular',
}
const PAGE_SIZE = 12

export default function EventsPage() {
  const { t } = useTranslation()
  const L = useLocalize()
  const [params, setParams] = useSearchParams()

  const period = params.get('period') ?? 'upcoming'
  const category = params.get('category') ?? ''
  const sort = params.get('sort') ?? (period === 'past' ? 'date_desc' : 'date_asc')
  const page = Number(params.get('page') ?? 1)
  const search = params.get('q') ?? ''

  // Search box updates the URL after a short pause so we don't query on every keystroke.
  const [searchInput, setSearchInput] = useState(search)
  useEffect(() => {
    setSearchInput(search)
  }, [search])
  useEffect(() => {
    if (searchInput === search) return
    const id = setTimeout(() => update({ q: searchInput || null }), 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories, staleTime: 5 * 60_000 })
  const query = { search, category, period, sort, page, pageSize: PAGE_SIZE }
  const events = useQuery({
    queryKey: ['events', query],
    queryFn: () => api.events(query),
    placeholderData: keepPreviousData,
  })

  const hasFilters = !!(search || category || period !== 'upcoming' || params.get('sort'))

  return (
    <div className="container-page py-8">
      <PageHeader title={t('nav.events')} />

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('filters.searchPlaceholder')}
          aria-label={t('filters.searchPlaceholder')}
          className="input h-12 rounded-2xl pl-12 text-base"
          maxLength={100}
        />
      </div>

      {/* Period chips */}
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t('filters.when')}>
        {PERIODS.map((p) => (
          <button key={p} onClick={() => update({ period: p === 'upcoming' ? null : p })} className={period === p ? 'chip-on' : 'chip-off'}>
            {t(`filters.${p}`)}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t('event.category')}>
        <button onClick={() => update({ category: null })} className={!category ? 'chip-on' : 'chip-off'}>
          {t('filters.allCategories')}
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            onClick={() => update({ category: category === c.slug ? null : c.slug })}
            className={category === c.slug ? 'chip-on' : 'chip-off'}
          >
            <span aria-hidden>{c.icon}</span> {L(c, 'name')}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500" aria-live="polite">
          {events.data && t('filters.found', { count: events.data.total })}
        </p>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button className="btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>
              <X className="size-3.5" /> {t('filters.reset')}
            </button>
          )}
          <label className="sr-only" htmlFor="sort">
            {t('filters.sort')}
          </label>
          <select id="sort" className="input w-auto py-2" value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(SORT_LABEL[s])}
              </option>
            ))}
          </select>
        </div>
      </div>

      {events.isError ? (
        <ErrorState message={errorMessage(events.error, t)} onRetry={() => events.refetch()} />
      ) : events.isPending ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <EventCardSkeleton key={i} />)}
        </div>
      ) : events.data.items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={t('empty.events')}
          text={t('empty.eventsHint')}
          action={hasFilters && <button className="btn-secondary" onClick={() => setParams({})}>{t('filters.reset')}</button>}
        />
      ) : (
        <>
          <div className={cn('grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 transition-opacity', events.isPlaceholderData && 'opacity-60')}>
            {events.data.items.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
          <Pagination
            page={page}
            total={events.data.total}
            pageSize={PAGE_SIZE}
            onChange={(p) => {
              update({ page: String(p) })
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </>
      )}
    </div>
  )
}
