import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../lib/api'
import type { AnnouncementType } from '../lib/types'
import AnnouncementCard, { AnnouncementSkeleton } from '../components/AnnouncementCard'
import { EmptyState, ErrorState, PageHeader, Pagination } from '../components/ui'

const TYPES: AnnouncementType[] = ['URGENT', 'IMPORTANT', 'ACADEMIC', 'EVENT', 'GENERAL']
const PAGE_SIZE = 10

export default function AnnouncementsPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const category = params.get('type') ?? ''
  const page = Number(params.get('page') ?? 1)

  const q = useQuery({
    queryKey: ['announcements', { category, page }],
    queryFn: () => api.announcements({ category, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="container-page max-w-3xl py-8">
      <PageHeader title={t('announcements.title')} subtitle={t('announcements.subtitle')} />

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <button onClick={() => setParams({})} className={!category ? 'chip-on' : 'chip-off'}>
          {t('announcements.all')}
        </button>
        {TYPES.map((type) => (
          <button key={type} onClick={() => setParams({ type })} className={category === type ? 'chip-on' : 'chip-off'}>
            {t(`announcements.type.${type}`)}
          </button>
        ))}
      </div>

      {q.isError ? (
        <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <AnnouncementSkeleton key={i} />)}</div>
      ) : q.data.items.length === 0 ? (
        <EmptyState icon="📭" title={t('announcements.empty')} />
      ) : (
        <>
          <div className="space-y-3">
            {q.data.items.map((a) => <AnnouncementCard key={a.id} a={a} />)}
          </div>
          <Pagination
            page={page}
            total={q.data.total}
            pageSize={PAGE_SIZE}
            onChange={(p) => setParams({ ...(category ? { type: category } : {}), page: String(p) })}
          />
        </>
      )}
    </div>
  )
}
