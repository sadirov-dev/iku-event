import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Pin } from 'lucide-react'
import { api, errorCode, errorMessage } from '../lib/api'
import { useLocalize } from '../lib/localize'
import { useFormat } from '../lib/format'
import { TypeBadge } from '../components/AnnouncementCard'
import { EmptyState, ErrorState, Skeleton } from '../components/ui'

export default function AnnouncementDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const L = useLocalize()
  const f = useFormat()
  const q = useQuery({ queryKey: ['announcement', id], queryFn: () => api.announcement(id!) })

  return (
    <div className="container-page max-w-3xl py-8">
      <Link to="/announcements" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t('announcements.back')}
      </Link>

      {q.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : q.isError ? (
        errorCode(q.error) === 'ANNOUNCEMENT_NOT_FOUND' ? (
          <EmptyState icon="📭" title={t('errors.ANNOUNCEMENT_NOT_FOUND')} />
        ) : (
          <ErrorState message={errorMessage(q.error, t)} onRetry={() => q.refetch()} />
        )
      ) : (
        <article className="card overflow-hidden">
          {q.data.image && <img src={q.data.image} alt="" className="aspect-[2/1] w-full object-cover" />}
          <div className="p-5 sm:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <TypeBadge type={q.data.category} />
              {q.data.is_pinned && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                  <Pin className="size-3.5" /> {t('announcements.pinned')}
                </span>
              )}
              {q.data.priority === 'HIGH' && (
                <span className="text-xs font-semibold text-rose-600">
                  {t('admin.form.priority')}: {t('announcements.priority.HIGH')}
                </span>
              )}
            </div>
            <h1 className="mb-4 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{L(q.data, 'title')}</h1>
            <p className="mb-6 text-sm text-slate-500">
              {t('announcements.published')}: {f.dateTime(q.data.published_at)}
              {q.data.author && ` · ${t('announcements.by')}: ${q.data.author.full_name}`}
              {q.data.expires_at && ` · ${t('announcements.expires', { date: f.shortDate(q.data.expires_at) })}`}
            </p>
            <p className="prose-text text-[15px]">{L(q.data, 'content')}</p>
            {q.data.attachment && (
              <a href={q.data.attachment} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-6">
                <Download className="size-4" /> {t('announcements.attachment')} · {t('announcements.download')}
              </a>
            )}
          </div>
        </article>
      )}
    </div>
  )
}
